import test from "node:test";
import assert from "node:assert/strict";
import { normaliseRoute, formatTime } from "../src/instructions.mjs";
const route = (steps) => ({ routes: [{ segments: [{ steps }] }] });
const step = (
  type,
  duration,
  name = "Road",
  instruction = "Continue",
  extra = {},
) => ({ type, duration, name, instruction, ...extra });
test("turn uses preceding segment time and arrival appears once", () => {
  const cards = normaliseRoute(
    route([
      step(11, 300, "First Road", "Head north"),
      step(1, 120, "Second Road", "Turn right"),
      step(10, 0),
    ]),
  );
  assert.deepEqual(
    cards.map((c) => c.time),
    ["Now", "In 5 minutes", "In 2 minutes"],
  );
  assert.equal(cards[1].road, "Second Road");
  assert.equal(cards[1].icon, "right");
  assert.equal(cards.filter((c) => c.kind === "arrival").length, 1);
});
test("duration boundaries are not a countdown", () => {
  for (const [s, want] of [
    [0, "Now"],
    [30, "In <1 minute"],
    [60, "In 1 minute"],
    [89, "In 1 minute"],
    [90, "In 2 minutes"],
  ])
    assert.equal(formatTime(s), want);
  for (const bad of [-1, NaN, Infinity]) assert.throws(() => formatTime(bad));
});
test("roundabout, sharp turn, U-turn, unknown and unnamed preserve meaning", () => {
  const cards = normaliseRoute(
    route([
      step(11, 0),
      step(7, 10, "Exit Road", "Take the third exit", { exit_number: 3 }),
      step(3, 20, "Sharp Road"),
      step(9, 30, "-"),
      step(99, 20, "", "Cross the footbridge"),
      step(10, 0),
    ]),
  );
  assert.equal(cards[1].action, "Take 3rd exit");
  assert.equal(cards[2].action, "Sharp right");
  assert.equal(cards[3].icon, "uturn");
  assert.equal(cards[4].action, "Cross the footbridge");
  assert.equal(cards[4].icon, "neutral");
  assert.equal(cards[3].road, "");
});
test("invalid route data cannot manufacture navigation", () => {
  for (const raw of [
    route([]),
    route([step(11, -1)]),
    route([step(11, undefined)]),
    {},
  ])
    assert.throws(() => normaliseRoute(raw));
});

test("roundabout exit number remains concise when only instruction text contains it", () => {
  const cards = normaliseRoute(
    route([
      step(11, 40),
      step(
        7,
        60,
        "Road",
        "Enter the roundabout and take the 3rd exit onto Road",
      ),
      step(10, 0),
    ]),
  );
  assert.equal(cards[1].action, "Take 3rd exit");
});

test("turn names the destination road, including when its name stays the same", () => {
  const cards = normaliseRoute(
    route([
      step(11, 300, "Winchester Road", "Head north on Winchester Road"),
      step(0, 120, "Hut Farm Place", "Turn left onto Hut Farm Place"),
      step(1, 60, "Hut Farm Place", "Turn right to stay on Hut Farm Place"),
      step(10, 0, "", "Arrive"),
    ]),
  );
  assert.equal(cards[1].road, "Hut Farm Place");
  assert.equal(cards[2].road, "Hut Farm Place");
});

test("unnamed turns use outgoing path type, then the last named road", () => {
  const raw = route([
    step(11, 30, "Winchester Road", "Head north", { way_points: [0, 2] }),
    step(1, 20, "-", "Turn right", { way_points: [2, 4] }),
    step(0, 20, "-", "Turn left", { way_points: [4, 6] }),
    step(1, 20, "Hut Farm Place", "Turn right", { way_points: [6, 8] }),
    step(10, 0),
  ]);
  raw.routes[0].extras = {
    waytypes: {
      values: [
        [0, 2, 3],
        [2, 4, 7],
        [4, 6, 0],
        [6, 8, 7],
      ],
    },
  };
  const cards = normaliseRoute(raw);
  assert.equal(cards[1].roadLabel, "On to footpath");
  assert.equal(cards[2].roadLabel, "On Winchester Road");
  assert.equal(cards[3].roadLabel, "On to Hut Farm Place");
  delete raw.routes[0].extras;
  assert.equal(normaliseRoute(raw)[1].roadLabel, "On Winchester Road");
});
