import test from "node:test";
import assert from "node:assert/strict";
import { renderPage, escapeHtml, compactText } from "../src/render.mjs";
const session = {
  csrf: "token",
  revision: 1,
  fromQuery: "<script>alert(1)</script>",
  toQuery: "",
  candidates: {
    from: [
      {
        name: "Romsey <Abbey>",
        locality: "Hampshire",
        label: "Romsey <Abbey>, Hampshire",
      },
    ],
    to: [],
  },
};
const card = {
  time: "In 5 minutes",
  icon: "roundabout",
  action: "Take 3rd exit",
  road: "Albany Wissey Biddlibong Way",
  fullText: "Take 3rd exit onto Albany Wissey Biddlibong Way",
  kind: "turn",
};
test("untrusted search and road data cannot create HTML", () => {
  assert.equal(
    escapeHtml('<img onerror="x">'),
    "&lt;img onerror=&quot;x&quot;&gt;",
  );
  const html = renderPage("input", { session, side: "from" });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(
    renderPage("results", { session, side: "from" }),
    /<Abbey>/,
  );
});
test("compact road is disclosed and required manoeuvre remains visible", () => {
  assert.equal(compactText("Albany Wissey Biddlibong Way", 12), "Albany Wiss…");
  const html = renderPage("journey", { card, step: 1, total: 4 });
  assert.match(html, /Take 3rd exit/);
  assert.match(html, /expanded=1/);
  assert.doesNotMatch(html, /<script/);
  const expanded = renderPage("journey", {
    card,
    step: 1,
    total: 4,
    expanded: true,
  });
  assert.match(expanded, /Albany Wissey Biddlibong Way/);
  assert.match(expanded, /Show less/);
  assert.match(expanded, /href="\/journey\?step=2"/);
});
test("modes use real forms and no unavailable bus button", () => {
  const html = renderPage("how", { session });
  assert.match(html, /value="walk"/);
  assert.match(html, /value="drive"/);
  assert.doesNotMatch(html, /value="bus"/);
  assert.match(html, /name="csrf"/);
});
test("long unknown instructions and result labels have full disclosure", () => {
  const html = renderPage("journey", {
    card: { ...card, action: "W".repeat(200), road: "" },
    step: 0,
    total: 2,
  });
  assert.match(html, /expanded=1/);
  assert.doesNotMatch(html, /W{100}/);
  const rows = renderPage("results", {
    session: {
      ...session,
      candidates: {
        from: [
          { name: "W".repeat(100), locality: "Hampshire", label: "Full place" },
        ],
      },
    },
    side: "from",
  });
  assert.match(rows, /detail=0/);
});
test("demo is visibly marked, normal landing has one journey button", () => {
  assert.match(renderPage("start", { demo: true }), /Demo/);
  assert.doesNotMatch(renderPage("start", {}), /Demo/);
  assert.equal((renderPage("start", {}).match(/<button/g) || []).length, 1);
});
test("wide short road names still provide access to the full instruction", () => {
  const html = renderPage("journey", {
    card: {
      ...card,
      action: "Continue",
      road: "W".repeat(23),
      fullText: "Continue",
    },
    step: 1,
    total: 3,
  });
  assert.match(html, /expanded=1/);
});

test("arrival retains access to destination-side information", () => {
  const arrival = {
    time: "In 2 minutes",
    icon: "arrival",
    action: "Arrived!",
    road: "",
    fullText: "Arrive at Road, on the left",
    kind: "arrival",
  };
  const compact = renderPage("journey", { card: arrival, step: 2, total: 3 });
  assert.match(compact, /expanded=1/);
  const full = renderPage("journey", {
    card: arrival,
    step: 2,
    total: 3,
    expanded: true,
  });
  assert.match(full, /on the left/);
  assert.match(full, /Show less/);
});

test("unnamed turn displays the explicit current road in compact and expanded views", () => {
  const unnamed = {
    time: "In 2 minutes",
    icon: "right",
    action: "Turn right",
    road: "",
    roadLabel: "On Winchester Road",
    fullText: "Turn right",
    kind: "turn",
  };
  for (const expanded of [false, true]) {
    const html = renderPage("journey", {
      card: unnamed,
      step: 1,
      total: 3,
      expanded,
    });
    assert.match(html, /On Winchester Road/);
    assert.doesNotMatch(html, /On this road/);
  }
});
