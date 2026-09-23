import { randomUUID } from "node:crypto";
const valid = (id) => {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid session");
  return id;
};
const validEtag = (etag) => typeof etag === "string" && etag.length > 0;
const ownEtag = (record, etag) => {
  if (!validEtag(etag)) throw new Error("Storage ownership unavailable");
  Object.defineProperty(record, "_etag", {
    value: etag,
    writable: true,
    configurable: true,
  });
  return record;
};
function checkedWrite(result) {
  if (!result?.modified || !validEtag(result.etag))
    throw new Error("Storage write unavailable or conflicted");
  return result.etag;
}
export function createNetlifyStore(client) {
  return {
    async get(id) {
      const entry = await client.getWithMetadata("sessions/" + valid(id), {
        type: "json",
      });
      return entry ? ownEtag(entry.data, entry.etag) : null;
    },
    async set(id, record) {
      // The ETag fences stale owners even if their lease expires during a slow request.
      const condition = record._etag
        ? { onlyIfMatch: record._etag }
        : { onlyIfNew: true };
      const result = await client.setJSON("sessions/" + valid(id), record, {
        ...condition,
        metadata: { expiresAt: record.expiresAt },
      });
      ownEtag(record, checkedWrite(result));
    },
    async delete(id, expected) {
      const record = expected || (await this.get(id));
      if (!record) return;
      if (!validEtag(record._etag))
        throw new Error("Storage ownership unavailable");
      // Fence outstanding writers before physical deletion; they cannot recreate this key.
      checkedWrite(
        await client.setJSON(
          "sessions/" + valid(id),
          { expiresAt: 0 },
          { onlyIfMatch: record._etag, metadata: { expiresAt: 0 } },
        ),
      );
      await client.delete("sessions/" + id);
      await client.delete("locks/" + id);
    },
    async *entries() {
      for await (const page of client.list({
        prefix: "sessions/",
        paginate: true,
      })) {
        for (const { key } of page.blobs) {
          const id = key.slice(9),
            record = await this.get(id);
          if (record) yield [id, record];
        }
      }
    },
    async acquire(id, now) {
      const key = "locks/" + valid(id),
        previous = await client.getWithMetadata(key, { type: "json" });
      if (previous && !validEtag(previous.etag))
        throw new Error("Storage ownership unavailable");
      if (previous?.data?.until > now) return null;
      const token = randomUUID(),
        result = await client.setJSON(
          key,
          { token, until: now + 30000 },
          previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true },
        );
      if (!result.modified) return null;
      // The SDK can report modified=true with an empty ETag after conditional PUT errors.
      const etag = checkedWrite(result);
      return async () => {
        const result = await client.setJSON(
          key,
          { token, until: 0 },
          { onlyIfMatch: etag },
        );
        if (result.modified) checkedWrite(result);
      };
    },
  };
}
