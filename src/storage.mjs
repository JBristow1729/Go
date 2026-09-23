import {
  mkdir,
  readFile,
  writeFile,
  rename,
  unlink,
  readdir,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
const valid = (id) => {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid session");
  return id;
};
function leases() {
  const locks = new Map();
  return async (id, now) => {
    valid(id);
    if ((locks.get(id)?.until || 0) > now) return null;
    const token = randomUUID();
    locks.set(id, { token, until: now + 30000 });
    return async () => {
      if (locks.get(id)?.token === token) locks.delete(id);
    };
  };
}
export function createMemoryStore() {
  const records = new Map();
  return {
    async get(id) {
      valid(id);
      return structuredClone(records.get(id) || null);
    },
    async set(id, value) {
      valid(id);
      records.set(id, structuredClone(value));
    },
    async delete(id) {
      records.delete(valid(id));
    },
    async *entries() {
      for (const entry of records) yield structuredClone(entry);
    },
    acquire: leases(),
  };
}
export function createFileStore(directory) {
  return {
    async get(id) {
      try {
        return JSON.parse(
          await readFile(join(directory, valid(id) + ".json"), "utf8"),
        );
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    async set(id, value) {
      valid(id);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const path = join(directory, id + ".json"),
        temp = path + "." + randomUUID();
      await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
      await rename(temp, path);
    },
    async delete(id) {
      await unlink(join(directory, valid(id) + ".json")).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
    },
    async *entries() {
      let files;
      try {
        files = await readdir(directory);
      } catch (e) {
        if (e.code === "ENOENT") return;
        throw e;
      }
      for (const file of files)
        if (/^[a-f0-9]{64}\.json$/.test(file)) {
          const id = file.slice(0, -5);
          const record = await this.get(id);
          if (record) yield [id, record];
        }
    },
    acquire: leases(),
  };
}
