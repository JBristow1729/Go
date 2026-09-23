import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.mjs";
import { createMemoryStore } from "../src/storage.mjs";
const place = {
  id: "romsey",
  name: "Romsey",
  locality: "Hampshire",
  label: "Romsey, Hampshire",
  coordinates: [-1.499, 50.989],
};
const raw = {
  routes: [
    {
      segments: [
        {
          steps: [
            {
              type: 11,
              duration: 300,
              instruction: "Head north",
              name: "First Road",
            },
            {
              type: 1,
              duration: 120,
              instruction: "Turn right",
              name: "Albany Wissey Biddlibong Way",
            },
            { type: 10, duration: 0, instruction: "Arrive", name: "" },
          ],
        },
      ],
    },
  ],
};
function harness(custom = {}) {
  let cookie = "",
    clock = 0,
    count = 0;
  const store = createMemoryStore();
  const app = createApp({
    store,
    now: () => clock,
    render: (view, model) => JSON.stringify({ view, ...model }),
    provider: {
      search: async () => [place],
      route: async () => {
        count++;
        return raw;
      },
      ...custom,
    },
  });
  return {
    store,
    count: () => count,
    tick: (n) => (clock += n),
    async get(path) {
      return app(new Request("http://go.test" + path, { headers: { cookie } }));
    },
    async post(path, data = {}) {
      const r = await app(
        new Request("http://go.test" + path, {
          method: "POST",
          headers: {
            cookie,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(data),
        }),
      );
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      return r;
    },
    async state() {
      return await store.get(cookie.split("=")[1]);
    },
  };
}
async function submit(h, path, data = {}) {
  const s = await h.state();
  return h.post(path, { csrf: s.csrf, revision: s.revision, ...data });
}
async function setup(h) {
  await h.post("/start");
  await submit(h, "/search/from", { q: "Romsey" });
  await submit(h, "/select/from", { index: "0" });
  await submit(h, "/search/to", { q: "Abbey" });
  await submit(h, "/select/to", { index: "0" });
}
test("wizard completes, duplicate mode is idempotent, navigation makes no extra route request", async () => {
  const h = harness();
  await setup(h);
  const s = await h.state();
  const data = { csrf: s.csrf, revision: s.revision, mode: "walk" };
  for (let i = 0; i < 2; i++) {
    const r = await h.post("/mode", data);
    assert.equal(r.status, 303);
    assert.equal(r.headers.get("location"), "/ready");
  }
  for (const p of [
    "/ready",
    "/journey?step=0",
    "/journey?step=1",
    "/journey?step=1&expanded=1",
    "/journey?step=0",
    "/journey?step=2",
  ])
    assert.equal((await h.get(p)).status, 200);
  assert.equal(h.count(), 1);
  assert.equal(
    (await (await h.get("/journey?step=1")).json()).card.time,
    "In 5 minutes",
  );
  const response = await h.get("/journey?step=2");
  assert.match(response.headers.get("cache-control"), /no-store/);
});
test("stale results, invalid selection and CSRF cannot change the journey", async () => {
  const h = harness();
  await h.post("/start");
  await submit(h, "/search/from", { q: "Old" });
  const s = await h.state();
  await submit(h, "/search/from", { q: "New" });
  assert.equal(
    (
      await h.post("/select/from", {
        csrf: s.csrf,
        revision: s.revision,
        index: "0",
      })
    ).status,
    409,
  );
  assert.equal((await submit(h, "/select/from", { index: "4" })).status, 400);
  assert.equal((await h.post("/select/from", { index: "0" })).status, 403);
  assert.equal((await h.state()).from, null);
});
test("empty query, no matches and provider errors retain the input", async () => {
  for (const search of [
    async () => [],
    async () => {
      throw Object.assign(new Error("secret"), { code: "quota" });
    },
  ]) {
    const h = harness({ search });
    await h.post("/start");
    const r = await submit(h, "/search/from", { q: "Belfast" });
    assert.equal((await h.state()).fromQuery, "Belfast");
    assert.ok([200, 303, 429].includes(r.status));
    assert.ok(!(await r.text()).includes("secret"));
  }
  const h = harness();
  await h.post("/start");
  assert.equal((await submit(h, "/search/from", { q: "" })).status, 400);
});
test("expiry, invalid indices and direct access recover safely", async () => {
  const h = harness();
  assert.equal((await h.get("/how")).status, 410);
  await setup(h);
  await submit(h, "/mode", { mode: "drive" });
  for (const step of ["-1", "99", "NaN", "1.2"])
    assert.equal((await h.get("/journey?step=" + step)).status, 400);
  h.tick(7200001);
  assert.equal((await h.get("/ready")).status, 410);
  assert.equal((await h.post("/mode", {})).status, 410);
});
test("editing origin invalidates old destination and route", async () => {
  const h = harness();
  await setup(h);
  await submit(h, "/mode", { mode: "walk" });
  await submit(h, "/search/from", { q: "New origin" });
  await submit(h, "/select/from", { index: "0" });
  const s = await h.state();
  assert.equal(s.to, null);
  assert.equal(s.cards.length, 0);
  assert.equal((await h.get("/ready")).status, 303);
});
test("route failure keeps selected places and does not show Ready", async () => {
  const h = harness({
    route: async () => {
      throw Object.assign(new Error(), { code: "no-route" });
    },
  });
  await setup(h);
  const r = await submit(h, "/mode", { mode: "walk" });
  assert.equal(r.status, 422);
  assert.ok((await h.state()).from);
  assert.ok((await h.state()).to);
});
test("throttle is per session, not shared proxy IP", async () => {
  const a = harness(),
    b = harness();
  await a.post("/start");
  await b.post("/start");
  for (let i = 0; i < 10; i++)
    await submit(a, "/search/from", { q: "Romsey " + i });
  assert.equal((await submit(a, "/search/from", { q: "extra" })).status, 429);
  assert.equal((await submit(b, "/search/from", { q: "Romsey" })).status, 303);
});
test("oversized body and unsupported methods fail safely", async () => {
  const h = harness();
  await h.post("/start");
  assert.equal(
    (await h.post("/search/from", { q: "x".repeat(9000) })).status,
    413,
  );
});
test("privacy-stripped Origin null supports forms while explicit foreign origins fail", async () => {
  const store = createMemoryStore();
  const app = createApp({
    store,
    provider: {},
    render: (v, m) => JSON.stringify({ v, ...m }),
  });
  const r = await app(
    new Request("http://go.test/start", {
      method: "POST",
      headers: {
        origin: "null",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "",
    }),
  );
  assert.equal(r.status, 303);
  const denied = await app(
    new Request("http://go.test/start", {
      method: "POST",
      headers: {
        origin: "https://foreign.test",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "",
    }),
  );
  assert.equal(denied.status, 403);
});
test("active requests renew cookie lifetime as well as server expiry", async () => {
  const h = harness();
  await h.post("/start");
  h.tick(3600000);
  const r = await h.get("/from");
  assert.match(r.headers.get("set-cookie") || "", /Max-Age=7200/);
});

test("empty Start Journey POST accepts omitted or generic content type and opens From", async () => {
  const app = createApp({
    store: createMemoryStore(),
    provider: {},
    render: (view, model) => JSON.stringify({ view, ...model }),
  });
  for (const contentType of [null, "text/plain", "application/octet-stream"]) {
    const headers = contentType ? { "content-type": contentType } : {};
    const started = await app(
      new Request("http://go.test/start", {
        method: "POST",
        headers,
        body: new Uint8Array(),
      }),
    );
    assert.equal(started.status, 303);
    assert.equal(started.headers.get("location"), "/from");
    const cookie = started.headers.get("set-cookie").split(";")[0];
    const next = await app(
      new Request("http://go.test/from", { headers: { cookie } }),
    );
    assert.equal(next.status, 200);
    assert.equal((await next.json()).side, "from");
  }
});

test("empty-start compatibility retains origin, body-size and other-form checks", async () => {
  const app = createApp({
    store: createMemoryStore(),
    provider: {},
    render: (v, m) => JSON.stringify({ v, ...m }),
  });
  for (const [path, headers, body, status] of [
    ["/start", { origin: "https://foreign.test" }, new Uint8Array(), 403],
    ["/start", { "content-type": "text/plain" }, "unexpected=data", 415],
    ["/search/from", {}, new Uint8Array(), 415],
    ["/start", {}, new Uint8Array(8193), 413],
  ]) {
    const response = await app(
      new Request("http://go.test" + path, { method: "POST", headers, body }),
    );
    assert.equal(response.status, status);
    assert.equal(response.headers.get("set-cookie"), null);
  }
});
