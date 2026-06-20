import { describe, it, expect } from "vitest";
import { WorkersCryptoService } from "../../src/services/crypto.service";

const FAKE_KEK_BASE64 = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="; // 32 bytes
const FAKE_KEK_2_BASE64 = "Hx4dHBsaGRgXFhUUExIREA8ODQwLCgkIBwYFBAMCAQA=";

describe("CryptoService (envelope encryption)", () => {
  const svc = new WorkersCryptoService(FAKE_KEK_BASE64);

  it("encrypt -> decrypt round-trip preserves plaintext", async () => {
    const plaintext = "오늘 점심은 비빔밥. 맛있었다.\n\n- ✅ 회고 완료";
    const env = await svc.encrypt(plaintext);
    expect(env.dekAlgo).toBe("aes-256-gcm");
    expect(env.iv.byteLength).toBe(12);
    expect(env.encryptedDek.byteLength).toBeGreaterThan(0);
    expect(env.sha256).toMatch(/^[0-9a-f]{64}$/);

    const back = await svc.decrypt({
      ciphertext: env.ciphertext,
      iv: env.iv,
      encryptedDek: env.encryptedDek,
    });
    expect(back).toBe(plaintext);
  });

  it("encrypting empty string still produces a valid envelope and decrypts to empty", async () => {
    const env = await svc.encrypt("");
    const back = await svc.decrypt({
      ciphertext: env.ciphertext,
      iv: env.iv,
      encryptedDek: env.encryptedDek,
    });
    expect(back).toBe("");
  });

  it("encryptWithDek reuses the wrapped DEK across edits", async () => {
    const first = await svc.encrypt("v1");
    const second = await svc.encryptWithDek("v2-changed", first.encryptedDek);
    // wrapped DEK bytes identical
    expect(new Uint8Array(second.encryptedDek)).toEqual(new Uint8Array(first.encryptedDek));
    // but IV must be fresh
    expect(new Uint8Array(second.iv)).not.toEqual(new Uint8Array(first.iv));

    const back = await svc.decrypt({
      ciphertext: second.ciphertext,
      iv: second.iv,
      encryptedDek: second.encryptedDek,
    });
    expect(back).toBe("v2-changed");
  });

  it("rotateDek re-wraps an existing DEK under a new KEK and decrypt still works", async () => {
    const env = await svc.encrypt("rotate me");
    const newWrapped = await svc.rotateDek(env.encryptedDek, FAKE_KEK_2_BASE64);
    expect(new Uint8Array(newWrapped)).not.toEqual(new Uint8Array(env.encryptedDek));

    const svc2 = new WorkersCryptoService(FAKE_KEK_2_BASE64);
    const back = await svc2.decrypt({
      ciphertext: env.ciphertext,
      iv: env.iv,
      encryptedDek: newWrapped,
    });
    expect(back).toBe("rotate me");
  });
});
