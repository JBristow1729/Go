import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { createLocalServer } from "../../src/server.mjs";
import { createMemoryStore } from "../../src/storage.mjs";
import { createDemoProvider } from "../../src/demo-provider.mjs";
import { renderPage } from "../../src/render.mjs";
const screenshotDir = process.env.GO_SCREENSHOTS;
async function fits(page, label) {
  const box = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
    cw: innerWidth,
    ch: innerHeight,
  }));
  assert.ok(
    box.w <= box.cw && box.h <= box.ch,
    `${label}: ${JSON.stringify(box)}`,
  );
}
for (const height of [200, 240, 280, 320])
  test(`whole no-JavaScript journey fits 240x${height}`, async () => {
    const server = createLocalServer({
      provider: createDemoProvider(),
      store: createMemoryStore(),
      demo: true,
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 240, height },
      });
      const p = await context.newPage();
      await p.goto(base);
      await fits(p, "start");
      await p.getByRole("button", { name: "Start Journey" }).click();
      await fits(p, "from");
      await p.getByLabel("From:").fill("Romsey");
      await p.getByRole("button", { name: "Next", exact: true }).click();
      await fits(p, "results");
      if (screenshotDir && height === 240) {
        await mkdir(screenshotDir, { recursive: true });
        await p.screenshot({ path: screenshotDir + "/results.png" });
      }
      await p
        .getByRole("button", { name: "Romsey Hampshire", exact: true })
        .click();
      await fits(p, "to");
      await p.getByLabel("To:").fill("Abbey");
      await p.getByRole("button", { name: "Next", exact: true }).click();
      await p.getByRole("button", { name: /Romsey Abbey/ }).click();
      await fits(p, "how");
      if (screenshotDir && height === 240)
        await p.screenshot({ path: screenshotDir + "/how.png" });
      await p.getByRole("button", { name: "Walk", exact: true }).click();
      await fits(p, "ready");
      await p.getByRole("link", { name: "Begin", exact: true }).click();
      await fits(p, "departure");
      await p.getByRole("link", { name: "Next", exact: true }).click();
      await fits(p, "roundabout");
      assert.match(await p.textContent("main"), /In 5 minutes/);
      if (screenshotDir && height === 240)
        await p.screenshot({ path: screenshotDir + "/instruction.png" });
      await p.locator(".disclosure").click();
      assert.match(await p.textContent("main"), /Albany Wissey Biddlibong Way/);
      await p.getByRole("link", { name: "Show less" }).click();
      await fits(p, "collapsed");
      await p.getByRole("link", { name: "Prev", exact: true }).click();
      await fits(p, "prev");
      for (let i = 0; i < 5; i++) {
        await p.getByRole("link", { name: "Next", exact: true }).click();
        await fits(p, "step " + i);
      }
      assert.match(await p.textContent("main"), /Arrived!/);
      await p.getByRole("button", { name: "Start again" }).click();
      await fits(p, "restarted");
    } finally {
      await browser?.close();
      await new Promise((r) => server.close(r));
    }
  });
test("worst-case compact screens fit; only expanded text can scroll", async () => {
  const server = createLocalServer({
    provider: createDemoProvider(),
    store: createMemoryStore(),
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 240, height: 200 },
    });
    const p = await context.newPage();
    await p.goto(base);
    const session = {
      csrf: "token",
      revision: 1,
      fromQuery: "",
      toQuery: "",
      candidates: {
        from: Array.from({ length: 3 }, (_, i) => ({
          name: "W".repeat(100),
          locality: "W".repeat(100),
          label: "W".repeat(250),
        })),
      },
    };
    const card = {
      time: "In 12 minutes",
      icon: "neutral",
      action: "W".repeat(24),
      road: "W".repeat(23),
      fullText: "W".repeat(250),
      kind: "turn",
    };
    for (const [view, model] of [
      ["results", { session, side: "from" }],
      ["journey", { card, step: 1, total: 3 }],
      [
        "input",
        {
          session,
          side: "from",
          message: "Search limit reached. Try again shortly.",
        },
      ],
      ["how", { session, message: "No route found for this mode." }],
      ["error", { message: "Journey expired or cookies disabled." }],
      ["about", {}],
      ["privacy", {}],
      ["credits", {}],
    ]) {
      await p.setContent(renderPage(view, { ...model, demo: true }));
      await p.addStyleTag({ url: base + "/go.css" });
      await fits(p, view);
    }
    await p.setContent(
      renderPage("journey", { card, step: 1, total: 3, expanded: true }),
    );
    await p.addStyleTag({ url: base + "/go.css" });
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollHeight > innerHeight,
      ),
    );
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
