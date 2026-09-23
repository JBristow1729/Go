import test from "node:test";
import assert from "node:assert/strict";
import { createProvider } from "../src/provider.mjs";
const feature = (id = "a", country = "GBR", coords = [-1.5, 51]) => ({
  properties: {
    id,
    name: "City Hall",
    locality: "Belfast",
    label: "City Hall, Belfast",
    country_a: country,
  },
  geometry: { coordinates: coords },
});
test("UK search is softly biased and keeps distinct valid results", async () => {
  let seen;
  const p = createProvider({
    apiKey: "secret",
    fetchImpl: async (url, init) => {
      seen = { url: new URL(url), init };
      return Response.json({
        features: [
          feature(),
          feature(),
          feature("b", "IRL"),
          feature("c", "GBR", [NaN, 2]),
          feature("d"),
        ],
      });
    },
  });
  const results = await p.search("  City Hall Belfast & centre  ");
  assert.equal(seen.url.searchParams.get("boundary.country"), "GBR");
  assert.equal(seen.url.searchParams.get("size"), "3");
  assert.equal(seen.url.searchParams.get("text"), "City Hall Belfast & centre");
  assert.ok(seen.url.searchParams.has("focus.point.lat"));
  assert.equal(seen.url.searchParams.has("boundary.circle.radius"), false);
  assert.equal(results.length, 2);
  assert.equal(results[0].locality, "Belfast");
  assert.equal(seen.init.headers.Authorization, "secret");
  assert.ok(!seen.url.toString().includes("secret"));
});
test("empty search, missing key and bad selection fail before HTTP", async () => {
  let calls = 0;
  const p = createProvider({
    apiKey: "key",
    fetchImpl: async () => {
      calls++;
    },
  });
  for (const text of ["", "x".repeat(161)])
    await assert.rejects(() => p.search(text), { code: "input" });
  await assert.rejects(
    () => p.route({ coordinates: [200, 0] }, { coordinates: [0, 0] }, "walk"),
    { code: "input" },
  );
  await assert.rejects(
    () => p.route({ coordinates: [0, 0] }, { coordinates: [0, 0] }, "bus"),
    { code: "input" },
  );
  await assert.rejects(() => createProvider({}).search("Romsey"), {
    code: "configuration",
  });
  assert.equal(calls, 0);
});
for (const [status, code] of [
  [401, "configuration"],
  [403, "configuration"],
  [429, "quota"],
  [503, "unavailable"],
])
  test(`HTTP ${status} is safely classified`, async () => {
    const p = createProvider({
      apiKey: "secret",
      fetchImpl: async () => new Response("secret", { status }),
    });
    await assert.rejects(
      () => p.search("Romsey"),
      (e) => e.code === code && !e.message.includes("secret"),
    );
  });
test("timeout and malformed data are safe errors", async () => {
  for (const fetchImpl of [
    async () => {
      throw new DOMException("timeout", "TimeoutError");
    },
    async () => new Response("not json"),
  ]) {
    await assert.rejects(
      () => createProvider({ apiKey: "key", fetchImpl }).search("Romsey"),
      (e) => ["unavailable", "invalid-data"].includes(e.code),
    );
  }
});
test("route uses correct profile and rejects unusable response", async () => {
  let url, body;
  const point = { coordinates: [-1.5, 51] };
  const p = createProvider({
    apiKey: "key",
    fetchImpl: async (u, i) => {
      url = u;
      body = JSON.parse(i.body);
      return Response.json({
        routes: [
          {
            segments: [
              {
                steps: [
                  {
                    type: 11,
                    duration: 30,
                    instruction: "Head north",
                    name: "Road",
                  },
                  { type: 10, duration: 0, instruction: "Arrive" },
                ],
              },
            ],
          },
        ],
      });
    },
  });
  await p.route(point, point, "walk");
  assert.match(url, /foot-walking$/);
  assert.deepEqual(body.extra_info, ["waytype"]);
  assert.deepEqual(body.coordinates, [
    [-1.5, 51],
    [-1.5, 51],
  ]);
  await p.route(point, point, "drive");
  assert.match(url, /driving-car$/);
  await assert.rejects(
    () =>
      createProvider({
        apiKey: "key",
        fetchImpl: async () => Response.json({ routes: [] }),
      }).route(point, point, "walk"),
    { code: "no-route" },
  );
});
test("zero or one search match stays zero or one", async () => {
  for (const features of [[], [feature()]])
    assert.equal(
      (
        await createProvider({
          apiKey: "x",
          fetchImpl: async () => Response.json({ features }),
        }).search("Romsey")
      ).length,
      features.length,
    );
});
