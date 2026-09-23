import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore, createFileStore } from "../src/storage.mjs";
import { createSessions } from "../src/sessions.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("expired sessions are inaccessible and cleaned up", async () => {
  let instant = 0;
  const store = createMemoryStore();
  const sessions = createSessions({ store, now: () => instant });
  const s = await sessions.create();
  assert.match(s.id, /^[a-f0-9]{64}$/);
  instant = 7200001;
  assert.equal(await sessions.load(s.id), null);
  assert.equal(await store.get(s.id), null);
  const next = await sessions.create();
  instant += 7200001;
  await sessions.cleanup();
  assert.equal(await store.get(next.id), null);
});
test("active session refreshes and locks isolate independent users", async () => {
  let instant = 0;
  const store = createMemoryStore();
  const sessions = createSessions({ store, now: () => instant });
  const s = await sessions.create();
  instant = 1000;
  assert.equal((await sessions.load(s.id)).expiresAt, 7201000);
  const release = await store.acquire(s.id, instant);
  assert.equal(await store.acquire(s.id, instant), null);
  const other = await store.acquire("b".repeat(64), instant);
  assert.equal(typeof other, "function");
  await release();
  assert.ok(await store.acquire(s.id, instant));
  await other();
});
test("file records survive adapter recreation and reject traversal", async () => {
  const dir = await mkdtemp(join(tmpdir(), "go-test-"));
  try {
    const s = createFileStore(dir);
    const id = "a".repeat(64);
    await s.set(id, { expiresAt: 42 });
    assert.deepEqual(await createFileStore(dir).get(id), { expiresAt: 42 });
    await assert.rejects(() => s.get("../escape"));
    const entries = [];
    for await (const e of s.entries()) entries.push(e);
    assert.equal(entries.length, 1);
    await s.delete(id);
    assert.equal(await s.get(id), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
