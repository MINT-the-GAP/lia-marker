import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const bundleSource = readFileSync(new URL("../../dist/index.js", import.meta.url), "utf8");
const explanation = "Ein Baum ist eine Pflanze mit einem verholzten Stamm.";

async function loadFixture(page) {
  const requests = [];
  await page.route("https://*.wiktionary.org/w/api.php?*", async (route) => {
    requests.push(new URL(route.request().url()).searchParams.get("page").toLowerCase());
    await route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ parse: { wikitext: `# ${explanation}` } }),
    });
  });
  await page.setContent(`<!doctype html><html lang="de"><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      html, body { margin: 0; font: 24px/1.5 Arial, sans-serif; }
      .lia-header__left { position: fixed; left: 40px; top: 40px; display: flex; }
      #lia-btn-toc { width: 40px; height: 40px; }
      main { margin: 180px 60px; min-height: 1400px; }
      p { width: 500px; }
    </style>
  </head><body>
    <header id="lia-toolbar-nav"><div class="lia-header__left">
      <button id="lia-btn-toc">TOC</button>
    </div></header>
    <main><p id="sentence">Ein Baum steht im Garten.</p></main>
  </body></html>`);
  await page.addScriptTag({ content: bundleSource });
  await expect(page.locator("#lia-hl-btn")).toBeVisible();
  return requests;
}

async function wordPoint(page, word) {
  // Measure a word inside a multiword text node without changing Selection.
  return page.locator("#sentence").evaluate((element, word) => {
    const node = element.firstChild;
    const start = node.textContent.indexOf(word);
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + word.length);
    const rect = range.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, word);
}

async function activateTool(page, tool, touch = false) {
  const activate = async (selector) => {
    if (touch) await page.locator(selector).tap();
    else await page.locator(selector).click();
  };
  await activate("#lia-hl-btn");
  await activate(`#hl-tool-${tool}`);
  await expect(page.locator("#lia-hl-panel")).toBeHidden();
}

async function doubleTap(page, point) {
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(point.x, point.y);
}

async function expectExplanation(page, word) {
  await expect(page.locator("#lia-hl-explain-tip")).toBeVisible();
  await expect(page.locator("#lia-hl-explain-word")).toHaveText(word);
  await expect(page.locator("#lia-hl-explain-body")).toHaveText(explanation);
  await expect(page.locator('.lia-hl-rect[data-kind="user"]')).toHaveCount(0);
}

async function expectMarkedWord(page, word) {
  await expect.poll(() => page.evaluate(() => {
    const registry = window.__LIA_TEXTMARKER_REG_V4__;
    const instance = Object.values(registry.instances).find((item) => item.__alive);
    const nodeAtPath = (path) => path.split("/").reduce(
      (node, index) => node.childNodes[Number(index)], document.body,
    );
    return instance.HL.filter((item) => item.kind === "user").map((item) => {
      const range = document.createRange();
      range.setStart(nodeAtPath(item.anchor.sp), item.anchor.so);
      range.setEnd(nodeAtPath(item.anchor.ep), item.anchor.eo);
      return range.toString();
    });
  })).toEqual([word]);
  await expect(page.locator('.lia-hl-rect[data-kind="user"]')).toHaveCount(1);
}

test("touch explains the tapped word only after two taps and keeps the close button usable", async ({ browser, browserName }) => {
  test.skip(browserName === "firefox", "Playwright does not support native touch input in Firefox");
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 900, height: 700 } });
  try {
    const page = await context.newPage();
    const requests = await loadFixture(page);
    await activateTool(page, "explain", true);
    const point = await wordPoint(page, "Baum");
    expect(await page.evaluate(() => getSelection().toString())).toBe("");

    await page.touchscreen.tap(point.x, point.y);
    await page.waitForTimeout(550);
    await expect(page.locator("#lia-hl-explain-tip")).toBeHidden();
    expect(requests).toEqual([]);

    await doubleTap(page, point);
    await expectExplanation(page, "Baum");
    expect(requests).toEqual(["baum"]);
    await page.locator("#lia-hl-explain-close").tap();
    await page.waitForTimeout(550);
    await expect(page.locator("#lia-hl-explain-tip")).toBeHidden();
    expect(requests).toEqual(["baum"]);

    await doubleTap(page, await wordPoint(page, "Garten"));
    await expectExplanation(page, "Garten");
    expect(requests).toEqual(["baum", "garten"]);
  } finally {
    await context.close();
  }
});

test("two touch taps on different words do not explain either word", async ({ browser, browserName }) => {
  test.skip(browserName === "firefox", "Playwright does not support native touch input in Firefox");
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 900, height: 700 } });
  try {
    const page = await context.newPage();
    const requests = await loadFixture(page);
    await activateTool(page, "explain", true);
    for (const word of ["Baum", "Garten"]) {
      const point = await wordPoint(page, word);
      await page.touchscreen.tap(point.x, point.y);
    }
    await page.waitForTimeout(550);
    await expect(page.locator("#lia-hl-explain-tip")).toBeHidden();
    expect(requests).toEqual([]);
  } finally {
    await context.close();
  }
});

test("touch double tap still marks exactly the touched word", async ({ browser, browserName }) => {
  test.skip(browserName === "firefox", "Playwright does not support native touch input in Firefox");
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 900, height: 700 } });
  try {
    const page = await context.newPage();
    const requests = await loadFixture(page);
    await activateTool(page, "mark", true);
    await doubleTap(page, await wordPoint(page, "Baum"));
    await expectMarkedWord(page, "Baum");
    await expect(page.locator("#lia-hl-explain-tip")).toBeHidden();
    expect(requests).toEqual([]);
  } finally {
    await context.close();
  }
});

test("touch movement and multitouch do not complete an explanation gesture", async ({ browser, browserName }, testInfo) => {
  test.skip(browserName !== "chromium" || testInfo.project.name !== "chromium", "CDP touch gestures are tested once in bundled Chromium");
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 900, height: 700 } });
  try {
    const page = await context.newPage();
    const requests = await loadFixture(page);
    await activateTool(page, "explain", true);
    const client = await context.newCDPSession(page);
    for (const multitouch of [false, true]) {
      const point = await wordPoint(page, "Baum");
      await page.touchscreen.tap(point.x, point.y);
      const touch = { id: 0, x: point.x, y: point.y, radiusX: 3, radiusY: 3, force: 1 };
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: multitouch ? [touch, { ...touch, id: 1, x: point.x + 40 }] : [touch],
      });
      if (!multitouch) {
        await client.send("Input.dispatchTouchEvent", {
          type: "touchMove", touchPoints: [{ ...touch, x: point.x + 40 }],
        });
      }
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(550);
      await expect(page.locator("#lia-hl-explain-tip")).toBeHidden();
      expect(requests).toEqual([]);
    }
    await doubleTap(page, await wordPoint(page, "Baum"));
    await expectExplanation(page, "Baum");
  } finally {
    await context.close();
  }
});

test("mouse double click still explains the clicked word", async ({ page }) => {
  const requests = await loadFixture(page);
  await activateTool(page, "explain");
  const point = await wordPoint(page, "Baum");
  await page.mouse.dblclick(point.x, point.y);
  await expectExplanation(page, "Baum");
  expect(requests).toEqual(["baum"]);
});

test("mouse double click still marks the clicked word", async ({ page }) => {
  const requests = await loadFixture(page);
  await activateTool(page, "mark");
  const point = await wordPoint(page, "Baum");
  await page.mouse.dblclick(point.x, point.y);
  await expectMarkedWord(page, "Baum");
  expect(requests).toEqual([]);
});

test("mouse explanation keeps a word spanning inline formatting intact", async ({ page }) => {
  const requests = await loadFixture(page);
  await page.locator("#sentence").evaluate((element) => {
    element.innerHTML = "Ein <strong>Ap</strong>fel liegt im Garten.";
  });
  await activateTool(page, "explain");
  await page.locator("#sentence strong").dblclick();
  await expectExplanation(page, "Apfel");
  expect(requests).toEqual(["apfel"]);
});
