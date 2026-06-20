/**
 * Storage service: R2 wrapper for encrypted memo blobs.
 * Object key convention: `users/{userId}/memos/{memoId}.md.enc`
 */

export interface StorageService {
  objectKey(userId: string, memoId: string): string;
  put(key: string, body: ArrayBuffer | Uint8Array): Promise<void>;
  get(key: string): Promise<ArrayBuffer | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class R2StorageService implements StorageService {
  constructor(private readonly bucket: R2Bucket) {}

  objectKey(userId: string, memoId: string): string {
    return `users/${userId}/memos/${memoId}.md.enc`;
  }

  async put(key: string, body: ArrayBuffer | Uint8Array): Promise<void> {
    const data =
      body instanceof Uint8Array
        ? body
        : new Uint8Array(body as ArrayBuffer);
    await this.bucket.put(key, data);
  }

  async get(key: string): Promise<ArrayBuffer | null> {
    const obj = await this.bucket.get(key);
    if (!obj) return null;
    return await obj.arrayBuffer();
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const head = await this.bucket.head(key);
    return head !== null;
  }
}

/** In-process storage for dev/test without R2 binding. */
export class InMemoryStorageService implements StorageService {
  private store = new Map<string, Uint8Array>();
  objectKey(userId: string, memoId: string): string {
    return `users/${userId}/memos/${memoId}.md.enc`;
  }
  async put(key: string, body: ArrayBuffer | Uint8Array): Promise<void> {
    const buf =
      body instanceof Uint8Array
        ? new Uint8Array(body)
        : new Uint8Array(body as ArrayBuffer);
    this.store.set(key, buf);
  }
  async get(key: string): Promise<ArrayBuffer | null> {
    const v = this.store.get(key);
    if (!v) return null;
    // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer typing issues.
    const out = new Uint8Array(v.byteLength);
    out.set(v);
    return out.buffer;
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}
