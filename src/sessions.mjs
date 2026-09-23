import { randomBytes } from "node:crypto";
export const TTL = 7200000;
export const token = () => randomBytes(32).toString("hex");
export function cookieId(request) {
  const raw = request.headers.get("cookie") || "";
  return raw.match(/(?:^|;\s*)go_session=([a-f0-9]{64})(?:;|$)/)?.[1] || null;
}
export function createSessions({ store, now = Date.now }) {
  return {
    async create() {
      const session = {
        id: token(),
        csrf: token(),
        expiresAt: now() + TTL,
        revision: 0,
        fromQuery: "",
        toQuery: "",
        candidates: { from: [], to: [] },
        from: null,
        to: null,
        mode: null,
        cards: [],
        completedSubmissions: {},
        apiTimes: [],
      };
      await store.set(session.id, session);
      return session;
    },
    async load(id) {
      if (!id) return null;
      const s = await store.get(id);
      if (!s) return null;
      if (s.expiresAt <= now()) {
        await store.delete(id, s);
        return null;
      }
      s.expiresAt = now() + TTL;
      await store.set(id, s);
      return s;
    },
    async save(s) {
      s.expiresAt = now() + TTL;
      await store.set(s.id, s);
    },
    async cleanup() {
      for await (const [id, record] of store.entries()) {
        if (record.expiresAt <= now()) {
          const release = await store.acquire(id, now());
          if (!release) continue;
          try {
            const fresh = await store.get(id);
            if (fresh && fresh.expiresAt <= now())
              await store.delete(id, fresh);
          } finally {
            await release();
          }
        }
      }
    },
  };
}
