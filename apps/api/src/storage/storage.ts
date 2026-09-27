import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StorageAdapter {
  save(storageKey: string, bytes: Uint8Array): Promise<void>;
  read(storageKey: string): Promise<Uint8Array>;
  delete(storageKey: string): Promise<void>;
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly root: string) {}

  private resolve(storageKey: string): string {
    if (storageKey.includes("..") || path.isAbsolute(storageKey)) {
      throw new Error("不合法的儲存路徑");
    }
    const full = path.resolve(this.root, storageKey);
    const root = path.resolve(this.root);
    if (!full.startsWith(`${root}${path.sep}`)) throw new Error("不合法的儲存路徑");
    return full;
  }

  async save(storageKey: string, bytes: Uint8Array): Promise<void> {
    const full = this.resolve(storageKey);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
  }

  async read(storageKey: string): Promise<Uint8Array> {
    return readFile(this.resolve(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await rm(this.resolve(storageKey), { force: true });
  }
}

export function createStorage(root: string): StorageAdapter {
  return new LocalStorageAdapter(root);
}
