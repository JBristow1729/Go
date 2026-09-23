import test from "node:test";
import assert from "node:assert/strict";
import { createNetlifyStore } from "../src/netlify-storage.mjs";
import { createLocalServer } from "../src/server.mjs";
import { createDemoProvider } from "../src/demo-provider.mjs";
import { createMemoryStore } from "../src/storage.mjs";
const blobClient = () => {
  const data = new Map();
  let n = 0;
  return {
    async get(k, { type } = {}) {
      const r = data.get(k);
      return r ? structuredClone(r.data) : null;
    },
    async getWithMetadata(k) {
      return structuredClone(data.get(k) || null);
    },
    async setJSON(k, value, opts = {}) {
      const old = data.get(k);
      if (
        (opts.onlyIfNew && old) ||
        (opts.onlyIfMatch && old?.etag !== opts.onlyIfMatch)
      )
        return { modified: false };
      const etag = String(++n);
      data.set(k, {
        data: structuredClone(value),
        metadata: opts.metadata,
        etag,
      });
      return { modified: true, etag };
    },
    async delete(k) {
      data.delete(k);
    },
    async *list({ prefix }) {
      yield {
        blobs: [...data.keys()]
          .filter((k) => k.startsWith(prefix))
          .map((key) => ({ key })),
      };
    },
  };
};
test("Blob adapter persists records and excludes leases from cleanup listing", async () => {
  const client = blobClient(),
    store = createNetlifyStore(client),
    id = "b".repeat(64);
  await store.set(id, { expiresAt: 200 });
  assert.deepEqual(await store.get(id), { expiresAt: 200 });
  const release = await store.acquire(id, 0);
  assert.ok(release);
  assert.equal(await store.acquire(id, 0), null);
  const entries = [];
  for await (const e of store.entries()) entries.push(e);
  assert.equal(entries.length, 1);
  await release();
  assert.ok(await store.acquire(id, 1));
  await store.delete(id);
  assert.equal(await store.get(id), null);
});
test("expired lock ownership cannot release a replacement lock", async () => {
  const store = createNetlifyStore(blobClient()),
    id = "c".repeat(64);
  const first = await store.acquire(id, 0),
    second = await store.acquire(id, 30001);
  assert.ok(second);
  await first();
  assert.equal(await store.acquire(id, 30002), null);
  await second();
  assert.ok(await store.acquire(id, 30003));
});
test("local HTTP serves assets and usable no-JS form, never serves source", async () => {
  const server = createLocalServer({
    provider: createDemoProvider(),
    store: createMemoryStore(),
    demo: true,
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const root = `http://127.0.0.1:${server.address().port}`;
  try {
    let r = await fetch(root);
    assert.match(await r.text(), /Start Journey/);
    r = await fetch(root + "/go.css");
    assert.match(r.headers.get("content-type"), /text\/css/);
    r = await fetch(root + "/src/provider.mjs");
    assert.ok(r.status >= 400);
    r = await fetch(root + "/start", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "",
      redirect: "manual",
    });
    assert.equal(r.status, 303);
    assert.match(r.headers.get("set-cookie"), /HttpOnly/);
    assert.doesNotMatch(r.headers.get("set-cookie"), /Secure/);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
test("demo only supports explicit known queries and never pretends arbitrary routes are real", async () => {
  const p = createDemoProvider();
  assert.equal((await p.search("Romsey")).length, 3);
  assert.equal((await p.search("Belfast"))[0].locality, "Belfast");
  assert.equal((await p.search("nonsense")).length, 0);
});

test("actual Blob SDK conditional HTTP failures cannot grant a lease", async () => {
  const { getStore } = await import("@netlify/blobs");
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    const client = getStore({
      name: "go-sessions",
      siteID: "test",
      token: "test",
      edgeURL: "https://storage.test",
      uncachedEdgeURL: "https://storage.test",
      consistency: "strong",
      fetch: async (_url, init) =>
        init.method.toLowerCase() === "get"
          ? new Response(null, { status: 404 })
          : new Response("unavailable", { status: 503 }),
    });
    await assert.rejects(() =>
      createNetlifyStore(client).acquire("a".repeat(64), 0),
    );
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});

test("an expired owner cannot overwrite a newer session or delete it", async () => {
  const store = createNetlifyStore(blobClient()),
    id = "d".repeat(64);
  await store.set(id, { expiresAt: 7200000, query: "Original" });
  const releaseFirst = await store.acquire(id, 0);
  const stale = await store.get(id);
  const releaseSecond = await store.acquire(id, 30001);
  const fresh = await store.get(id);
  fresh.query = "Second";
  await store.set(id, fresh);
  stale.query = "First";
  await assert.rejects(() => store.set(id, stale));
  await assert.rejects(() => store.delete(id, stale));
  assert.equal((await store.get(id)).query, "Second");
  await releaseFirst();
  assert.equal(await store.acquire(id, 30002), null);
  await releaseSecond();
});
