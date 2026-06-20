/**
 * Envelope encryption service.
 * - DEK (Data Encryption Key) per-memo, AES-256-GCM.
 * - KEK (Key Encryption Key) per-environment, wraps DEKs (also AES-256-GCM).
 *
 * Phase 1: KEK stored in Cloudflare Secrets. Phase 2 may delegate to external KMS.
 */

export interface EncryptedEnvelope {
  ciphertext: ArrayBuffer; // body + GCM tag
  iv: Uint8Array; // 12 bytes
  encryptedDek: ArrayBuffer; // DEK wrapped by KEK
  dekAlgo: "aes-256-gcm";
  sha256: string; // hex digest of plaintext for integrity
}

export interface CryptoService {
  generateDek(): Promise<ArrayBuffer>;
  encrypt(plaintext: string): Promise<EncryptedEnvelope>;
  encryptWithDek(
    plaintext: string,
    encryptedDek: ArrayBuffer,
  ): Promise<EncryptedEnvelope>;
  decrypt(envelope: {
    ciphertext: ArrayBuffer;
    iv: Uint8Array;
    encryptedDek: ArrayBuffer;
  }): Promise<string>;
  rotateDek(
    encryptedDek: ArrayBuffer,
    newKekBase64: string,
  ): Promise<ArrayBuffer>;
}

const DEK_IV_LEN = 12;
const KEK_WRAP_IV_LEN = 12;

function base64ToBytes(b64: string): Uint8Array {
  // Works in both Node and Workers runtime.
  if (typeof atob === "function") {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  // Node fallback
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Buffer } = require("node:buffer") as typeof import("node:buffer");
  const buf = Buffer.from(b64, "base64");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

function bytesToHex(buf: ArrayBuffer | Uint8Array): string {
  const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < view.length; i++) {
    const h = view[i].toString(16);
    out += h.length === 1 ? `0${h}` : h;
  }
  return out;
}

async function importKekKey(kekBase64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(kekBase64);
  if (raw.byteLength !== 32) {
    throw new Error(
      `KEK must be 32 raw bytes (got ${raw.byteLength}); pass base64 of 32 bytes`,
    );
  }
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function importDekKey(rawDek: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    rawDek,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(digest);
}

export class WorkersCryptoService implements CryptoService {
  constructor(private readonly kekBase64: string) {}

  async generateDek(): Promise<ArrayBuffer> {
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    return raw.buffer.slice(0);
  }

  /** Wrap a raw DEK using the KEK. Layout: iv(12) || ciphertext(rawDek + tag) */
  private async wrapDek(rawDek: ArrayBuffer): Promise<ArrayBuffer> {
    const kek = await importKekKey(this.kekBase64);
    const iv = new Uint8Array(KEK_WRAP_IV_LEN);
    crypto.getRandomValues(iv);
    const wrapped = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      kek,
      rawDek,
    );
    const out = new Uint8Array(iv.byteLength + wrapped.byteLength);
    out.set(iv, 0);
    out.set(new Uint8Array(wrapped), iv.byteLength);
    return out.buffer.slice(0);
  }

  private async unwrapDek(encryptedDek: ArrayBuffer): Promise<ArrayBuffer> {
    return this.unwrapDekWithKek(encryptedDek, this.kekBase64);
  }

  private async unwrapDekWithKek(
    encryptedDek: ArrayBuffer,
    kekBase64: string,
  ): Promise<ArrayBuffer> {
    const buf = new Uint8Array(encryptedDek);
    if (buf.byteLength < KEK_WRAP_IV_LEN + 1) {
      throw new Error("encryptedDek too short");
    }
    const iv = buf.slice(0, KEK_WRAP_IV_LEN);
    const ct = buf.slice(KEK_WRAP_IV_LEN);
    const kek = await importKekKey(kekBase64);
    const raw = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      kek,
      ct,
    );
    return raw;
  }

  async encrypt(plaintext: string): Promise<EncryptedEnvelope> {
    const rawDek = await this.generateDek();
    return this.encryptInternal(plaintext, rawDek, await this.wrapDek(rawDek));
  }

  async encryptWithDek(
    plaintext: string,
    encryptedDek: ArrayBuffer,
  ): Promise<EncryptedEnvelope> {
    const rawDek = await this.unwrapDek(encryptedDek);
    return this.encryptInternal(plaintext, rawDek, encryptedDek);
  }

  private async encryptInternal(
    plaintext: string,
    rawDek: ArrayBuffer,
    encryptedDek: ArrayBuffer,
  ): Promise<EncryptedEnvelope> {
    const dek = await importDekKey(rawDek);
    const iv = new Uint8Array(DEK_IV_LEN);
    crypto.getRandomValues(iv);
    const ptBytes = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      dek,
      ptBytes,
    );
    return {
      ciphertext,
      iv,
      encryptedDek,
      dekAlgo: "aes-256-gcm",
      sha256: await sha256Hex(plaintext),
    };
  }

  async decrypt(envelope: {
    ciphertext: ArrayBuffer;
    iv: Uint8Array;
    encryptedDek: ArrayBuffer;
  }): Promise<string> {
    const rawDek = await this.unwrapDek(envelope.encryptedDek);
    const dek = await importDekKey(rawDek);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: envelope.iv },
      dek,
      envelope.ciphertext,
    );
    return new TextDecoder().decode(pt);
  }

  async rotateDek(
    encryptedDek: ArrayBuffer,
    newKekBase64: string,
  ): Promise<ArrayBuffer> {
    const rawDek = await this.unwrapDek(encryptedDek);
    // Wrap with the new KEK
    const next = new WorkersCryptoService(newKekBase64);
    return next.wrapDek(rawDek);
  }
}
