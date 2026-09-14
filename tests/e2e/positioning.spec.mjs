import { expect, test } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const bundleSource = readFileSync(new URL("../../dist/index.js", import.meta.url), "utf8");

function fixture({ collapsed = false, board = false } = {}) {
  return '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>html,body{margin:0;font:18px Arial,sans-serif}main{margin:160px 40px 0;min-height:2200px}' +
    '.lia-header__left{position:fixed;left:80px;top:60px;display:flex}' +
    '#lia-btn-toc{box-sizing:border-box;flex:none;width:40px;height:40px;padding:0}' +
    '.lia-navigation--hidden #lia-btn-toc{width:22px;height:22px}' +
    '#lia-tff-inline-slot-v2{box-sizing:border-box;position:relative;width:46px;height:40px;flex:none}' +
    '#lia-tff-btn-v2{position:absolute;left:6px;top:3px;width:34px;height:34px;padding:0}' +
    '.lia-navigation--hidden #lia-tff-inline-slot-v2{display:none}' +
    'section[aria-hidden="true"]{display:none}</style></head><body>' +
    '<div class="lia-canvas lia-mode--presentation ' + (collapsed ? 'lia-navigation--hidden' : '') + '">' +
    '<header id="lia-toolbar-nav"><div class="lia-header__left">' +
    '<button id="lia-btn-toc" aria-label="Table of contents">TOC</button>' +
    (board ? '<div id="lia-tff-inline-slot-v2"><button id="lia-tff-btn-v2">Aa</button></div>' : '') +
    '</div></header><main class="reveal"><div class="slides">' +
    '<section id="slide-one" class="present" aria-hidden="false">First slide</section>' +
    '<section id="slide-two" aria-hidden="true">Second slide</section></div></main></div></body></html>';
}

// Only visualViewport is simulated; element geometry, events, observers and
// animation frames remain browser-native. A separate test below sends native
// Chromium touch input without replacing visualViewport.
async function installSimulatedViewport(page) {
  await page.evaluate(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, { width: innerWidth, height: innerHeight, offsetLeft: 0, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    window.setTestViewport = (values) => {
      Object.assign(viewport, values);
      viewport.dispatchEvent(new Event("resize"));
      viewport.dispatchEvent(new Event("scroll"));
    };
  });
}

async function settle(page, count = 3) {
  await page.evaluate(async (count) => {
    for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame);
  }, count);
}

async function loadFixture(page, options = {}) {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.setContent(fixture(options));
  await installSimulatedViewport(page);
  await page.addScriptTag({ content: bundleSource });
  await expect(page.locator("#lia-hl-btn")).toBeVisible();
  await settle(page);
}

async function geometry(page) {
  return page.evaluate(() => {
    const rect = (id) => document.getElementById(id)?.getBoundingClientRect().toJSON();
    return {
      button: rect("lia-hl-btn"), panel: rect("lia-hl-panel"), toc: rect("lia-btn-toc"),
      viewport: {
        width: visualViewport.width, height: visualViewport.height,
        left: visualViewport.offsetLeft, top: visualViewport.offsetTop, scale: visualViewport.scale,
      },
    };
  });
}

function bounded(value, low, high) { return Math.max(low, Math.min(high, value)); }

function expectButtonPosition(result, { collapsed = false, board = false, anchor = result.toc } = {}) {
  const { button, viewport } = result;
  const lane = board ? (collapsed ? 28 : 46) : 0;
  const baseLeft = collapsed ? anchor.left + (anchor.width - button.width) / 2 : anchor.right + 8;
  const baseTop = collapsed ? anchor.bottom + 6 : anchor.top + (anchor.height - button.height) / 2;
  const left = bounded(baseLeft, viewport.left + 8,
    viewport.left + viewport.width - button.width - 8 - (collapsed ? 0 : lane)) + (collapsed ? 0 : lane);
  const top = bounded(baseTop, viewport.top + 8,
    viewport.top + viewport.height - button.height - 8 - (collapsed ? lane : 0)) + (collapsed ? lane : 0);
  expect(Math.abs(button.left - left), "button layout-viewport x").toBeLessThanOrEqual(1);
  expect(Math.abs(button.top - top), "button layout-viewport y").toBeLessThanOrEqual(1);
}

function expectPanelPosition({ button, panel, viewport }) {
  const left = bounded(button.left, viewport.left + 8, viewport.left + viewport.width - panel.width - 8);
  let top = button.bottom + 10;
  if (top + panel.height + 8 > viewport.top + viewport.height) top = button.top - 10 - panel.height;
  top = bounded(top, viewport.top + 8, viewport.top + viewport.height - panel.height - 8);
  expect(Math.abs(panel.left - left), "panel layout-viewport x").toBeLessThanOrEqual(1);
  expect(Math.abs(panel.top - top), "panel layout-viewport y").toBeLessThanOrEqual(1);
}

for (const collapsed of [false, true]) {
  test("simulated viewport: " + (collapsed ? "collapsed" : "normal") + " navigation keeps its anchor through zoom and pan", async ({ page }) => {
    await loadFixture(page, { collapsed });
    const anchor = (await geometry(page)).toc;
    for (const viewport of [
      { width: 700, height: 520, offsetLeft: 35.25, offsetTop: 25.5, scale: 1.6 },
      { width: 460, height: 380, offsetLeft: 185.5, offsetTop: 145.25, scale: 2.4 },
      { width: 700, height: 520, offsetLeft: 35.25, offsetTop: 25.5, scale: 1.6 },
    ]) {
      await page.evaluate((values) => window.setTestViewport(values), viewport);
      await settle(page);
      expectButtonPosition(await geometry(page), { collapsed, anchor });
    }
    // Temporarily unmeasurable anchors retain their established dock.
    await page.evaluate(() => {
      document.getElementById("lia-btn-toc").style.display = "none";
      window.setTestViewport({ offsetLeft: 60, offsetTop: 40 });
    });
    await settle(page);
    expectButtonPosition(await geometry(page), { collapsed, anchor });
    await page.evaluate(() => {
      document.getElementById("lia-btn-toc").style.display = "";
      window.setTestViewport({ offsetLeft: 0, offsetTop: 0, scale: 1, width: innerWidth, height: innerHeight });
    });
    await settle(page);
    expectButtonPosition(await geometry(page), { collapsed });
  });
}

for (const collapsed of [false, true]) {
  test("simulated viewport: board-mode reserves the " + (collapsed ? "vertical" : "horizontal") +
    " lane independently of peer visibility and stale geometry", async ({ page }) => {
    await loadFixture(page, { collapsed, board: true });
    expectButtonPosition(await geometry(page), { collapsed, board: true });
    for (const peerStyle of [
      { left: "-900px", top: "-700px", visibility: "hidden" },
      { left: "900px", top: "650px", visibility: "visible", opacity: "0" },
      { display: "none" },
      { display: "", opacity: "1", left: "6px", top: "3px" },
    ]) {
      await page.evaluate((style) => {
        Object.assign(document.getElementById("lia-tff-btn-v2").style, style);
        window.setTestViewport({ width: 460, height: 380, offsetLeft: 185.5, offsetTop: 145.25, scale: 2.4 });
      }, peerStyle);
      await settle(page);
      expectButtonPosition(await geometry(page), { collapsed, board: true });
    }
    // The board initializes after the marker in the reverse load order.
    await page.evaluate(() => document.getElementById("lia-tff-inline-slot-v2").remove());
    await settle(page);
    expectButtonPosition(await geometry(page), { collapsed });
    await page.evaluate(() => {
      const peer = document.createElement("button");
      peer.id = "lia-tff-btn-v2";
      peer.style.display = "none";
      document.body.append(peer);
    });
    await settle(page);
    expectButtonPosition(await geometry(page), { collapsed, board: true });
    // Clamp the reserved group at the far edge while retaining its order.
    await page.evaluate(() => {
      Object.assign(document.querySelector(".lia-header__left").style, { left: "1000px", top: "740px" });
      window.setTestViewport({ offsetLeft: 0, offsetTop: 0, scale: 1, width: innerWidth, height: innerHeight });
    });
    await settle(page);
    expectButtonPosition(await geometry(page), { collapsed, board: true });
  });
}

test("simulated viewport: open panel follows pan, navigation mode, actual window resize and slide replacement", async ({ page }) => {
  await loadFixture(page, { board: true });
  await page.locator("#lia-hl-btn").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#lia-hl-panel")).toBeVisible();
  await page.evaluate(() => window.setTestViewport({ width: 600, height: 500, offsetLeft: 120, offsetTop: 90, scale: 1.8 }));
  await settle(page);
  expectButtonPosition(await geometry(page), { board: true });
  expectPanelPosition(await geometry(page));
  await page.evaluate(() => document.querySelector(".lia-canvas").classList.add("lia-navigation--hidden"));
  await settle(page);
  expectButtonPosition(await geometry(page), { collapsed: true, board: true });
  expectPanelPosition(await geometry(page));
  // This changes the actual layout viewport and then synchronizes the mock.
  await page.setViewportSize({ width: 720, height: 540 });
  await page.evaluate(() => window.setTestViewport({ width: innerWidth, height: innerHeight, offsetLeft: 0, offsetTop: 0, scale: 1 }));
  await settle(page);
  expectButtonPosition(await geometry(page), { collapsed: true, board: true });
  expectPanelPosition(await geometry(page));
  await page.evaluate(() => {
    document.querySelector("main").outerHTML =
      '<main class="reveal"><div class="slides"><section class="present" aria-hidden="false">Replacement slide</section></div></main>';
    const toolbar = document.getElementById("lia-toolbar-nav");
    const replacement = toolbar.cloneNode(true);
    replacement.querySelector(".lia-header__left").style.top = "190px";
    toolbar.replaceWith(replacement);
    location.hash = "#2";
  });
  await settle(page, 5);
  expectButtonPosition(await geometry(page), { collapsed: true, board: true });
  expectPanelPosition(await geometry(page));
  await page.keyboard.press("Escape");
  await expect(page.locator("#lia-hl-panel")).toBeHidden();
});

test("simulated viewport: a constrained panel recovers its full height and placement in the first grow frame", async ({ page }) => {
  await loadFixture(page, { board: true });
  await page.evaluate(() => { document.querySelector(".lia-header__left").style.top = "600px"; });
  await page.locator("#lia-hl-btn").press("Enter");
  await settle(page, 5);
  const naturalHeight = (await geometry(page)).panel.height;
  await page.evaluate(() => window.setTestViewport({ height: 240 }));
  await settle(page, 5);
  expect((await geometry(page)).panel.height).toBeLessThan(naturalHeight);
  const firstGrowFrame = await page.evaluate(async () => {
    window.setTestViewport({ height: 800 });
    await new Promise(requestAnimationFrame);
    const rect = (id) => document.getElementById(id).getBoundingClientRect().toJSON();
    return {
      button: rect("lia-hl-btn"), panel: rect("lia-hl-panel"), toc: rect("lia-btn-toc"),
      viewport: { width: visualViewport.width, height: visualViewport.height,
        left: visualViewport.offsetLeft, top: visualViewport.offsetTop, scale: visualViewport.scale },
    };
  });
  expect(firstGrowFrame.panel.height).toBeCloseTo(naturalHeight, 0);
  expectButtonPosition(firstGrowFrame, { board: true });
  expectPanelPosition(firstGrowFrame);
});
test("simulated viewport: event bursts share one position measurement per frame and leave no idle UI writes", async ({ page }) => {
  await loadFixture(page, { board: true });
  await page.locator("#lia-hl-btn").press("Enter");
  await settle(page, 5);
  const result = await page.evaluate(async () => {
    const nextFrame = () => new Promise(requestAnimationFrame);
    const button = document.getElementById("lia-hl-btn");
    const anchor = document.getElementById("lia-btn-toc");
    const originalRect = anchor.getBoundingClientRect.bind(anchor);
    const panel = document.getElementById("lia-hl-panel");
    const originalPanelRect = panel.getBoundingClientRect.bind(panel);
    const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
    const positionStyles = new Set([button.style, panel.style, document.getElementById("lia-hl-ui-overlay-v1").style]);
    const operations = [];
    let frame = 0;
    const reads = [];
    let tracking = true;
    const advanceFrame = () => {
      frame++;
      if (tracking) requestAnimationFrame(advanceFrame);
    };
    requestAnimationFrame(advanceFrame);
    anchor.getBoundingClientRect = () => {
      reads.push(frame);
      operations.push({ frame, kind: "read" });
      return originalRect();
    };
    panel.getBoundingClientRect = () => {
      operations.push({ frame, kind: "read" });
      return originalPanelRect();
    };
    CSSStyleDeclaration.prototype.setProperty = function(name, value, priority) {
      if (positionStyles.has(this) && (name === "left" || name === "top")) {
        operations.push({ frame, kind: "write" });
      }
      return originalSetProperty.call(this, name, value, priority);
    };
    for (let i = 0; i < 12; i++) {
      window.setTestViewport({ offsetLeft: 100 + i, offsetTop: 80 + i, width: 650, height: 520, scale: 1.6 });
      window.dispatchEvent(new Event("resize"));
    }
    for (let i = 0; i < 6; i++) await nextFrame();
    const burstReads = reads.splice(0);
    let idleStyleWrites = 0;
    const observer = new MutationObserver((records) => { idleStyleWrites += records.length; });
    for (const element of [document.documentElement, document.body, button,
      document.getElementById("lia-hl-panel"), document.getElementById("lia-hl-ui-overlay-v1")]) {
      observer.observe(element, {
        attributes: true, attributeFilter: ["style"],
        subtree: element !== document.documentElement && element !== document.body,
      });
    }
    // Ordinary content edits must not turn into toolbar/theme work.
    for (let i = 0; i < 6; i++) {
      const content = document.createElement("span");
      content.textContent = " Unrelated update " + i;
      document.querySelector("section.present").append(content);
      await nextFrame();
    }
    // Older board-mode versions write their floating peer every frame. With
    // no viewport event, this must not wake marker positioning or theme work.
    for (let i = 0; i < 10; i++) {
      Object.assign(document.getElementById("lia-tff-btn-v2").style, {
        left: (900 + i) + "px", top: (650 + i) + "px", visibility: i % 2 ? "hidden" : "visible",
      });
      await nextFrame();
    }
    for (let i = 0; i < 25; i++) await nextFrame();
    observer.disconnect();
    tracking = false;
    delete anchor.getBoundingClientRect;
    delete panel.getBoundingClientRect;
    CSSStyleDeclaration.prototype.setProperty = originalSetProperty;
    return { burstReads, idleReads: reads, idleStyleWrites, operations };
  });
  expect(result.burstReads.length).toBeGreaterThan(0);
  const perFrame = Object.values(result.burstReads.reduce((counts, frame) => {
    counts[frame] = (counts[frame] || 0) + 1;
    return counts;
  }, {}));
  expect(Math.max(...perFrame)).toBeLessThanOrEqual(1);
  expect(result.idleReads).toEqual([]);
  expect(result.idleStyleWrites).toBe(0);
  expect(result.operations.some(({ kind }) => kind === "write")).toBe(true);
  const wroteInFrame = new Set();
  expect(result.operations.some(({ frame, kind }) => {
    if (kind === "write") wroteInFrame.add(frame);
    return kind === "read" && wroteInFrame.has(frame);
  }), "all layout reads precede position writes in each frame").toBe(false);
});

test("simulated viewport: iframe content uses root coordinates and observes content replacement", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.setContent(fixture({ board: true }));
  await installSimulatedViewport(page);
  await page.evaluate(() => {
    document.querySelector("main").remove();
    const iframe = document.createElement("iframe");
    iframe.id = "course-content";
    iframe.style.cssText = "position:absolute;left:300px;top:220px;width:600px;height:430px;border:11px solid black;transform:scale(.8);transform-origin:top left";
    iframe.srcdoc = '<!doctype html><html><head><title>Embedded content</title></head><body><main>Embedded course</main></body></html>';
    document.body.append(iframe);
    window.setTestViewport({ width: 650, height: 520, offsetLeft: 95, offsetTop: 75, scale: 1.7 });
  });
  const frameHandle = await page.locator("#course-content").elementHandle();
  const frame = await frameHandle.contentFrame();
  await frame.waitForSelector("main");
  await installSimulatedViewport(frame);
  await frame.evaluate(() => window.setTestViewport({ width: 250, height: 200, offsetLeft: 290, offsetTop: 180, scale: 3 }));
  await frame.addScriptTag({ content: bundleSource });
  await expect(page.locator("#lia-hl-btn")).toBeVisible();
  await expect(frame.locator("#lia-hl-btn")).toHaveCount(0);
  await settle(page);
  expectButtonPosition(await geometry(page), { board: true });
  await page.locator("#lia-hl-btn").press("Enter");
  await settle(page);
  expectPanelPosition(await geometry(page));
  await frame.evaluate(() => {
    document.querySelector("main").outerHTML =
      '<main>New content <span class="lia-hl-prefill" data-hl-prefill="green">Embedded green prefill</span></main>';
  });
  await expect(frame.locator('.lia-hl-rect[data-kind="prefill"][data-hl="green"]')).toHaveCount(1);
  expectButtonPosition(await geometry(page), { board: true });
  expectPanelPosition(await geometry(page));
});

for (const collapsed of [false, true]) {
  test("native Chromium touch: " + (collapsed ? "collapsed" : "normal") + " navigation during pinch and pan with an open panel", async ({ browser, browserName }, testInfo) => {
    test.skip(browserName !== "chromium" || testInfo.project.name !== "chromium", "CDP touch input is tested once with bundled Chromium");
    const context = await browser.newContext({ viewport: { width: 900, height: 700 }, isMobile: true, hasTouch: true });
    try {
      const page = await context.newPage();
      await page.setContent(fixture({ board: true, collapsed }));
      await page.addScriptTag({ content: bundleSource });
      await expect(page.locator("#lia-hl-btn")).toBeVisible();
      await page.locator("#lia-hl-btn").press("Enter");
      await expect(page.locator("#lia-hl-panel")).toBeVisible();
      await settle(page, 5);
      const client = await context.newCDPSession(page);
      const point = (id, x, y) => ({ id, x, y, radiusX: 5, radiusY: 5, force: 1 });
      const before = await geometry(page);
      expect(before.viewport.scale).toBe(1);
      // The browser touch/zoom pipeline processes these input events. Neither
      // Emulation.setPageScaleFactor nor a replaced visualViewport is used.
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(0, 350, 250), point(1, 450, 350)] });
      for (let step = 1; step <= 4; step++) {
        await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [
          point(0, 350 - step * 5, 250 - step * 5), point(1, 450 + step * 5, 350 + step * 5),
        ] });
        await page.waitForTimeout(30);
      }
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect.poll(async () => (await geometry(page)).viewport.scale).toBeGreaterThan(1.1);
      await settle(page);
      const pinched = await geometry(page);
      expect(pinched.viewport.left).toBeGreaterThan(0);
      expect(pinched.viewport.top).toBeGreaterThan(0);
      expectButtonPosition(pinched, { board: true, collapsed });
      expectPanelPosition(pinched);
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(0, 80, 80)] });
      for (let step = 1; step <= 5; step++) {
        await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(0, 80 - step * 10, 80 - step * 10)] });
        await page.waitForTimeout(20);
      }
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect.poll(async () => (await geometry(page)).viewport.left).toBeGreaterThan(pinched.viewport.left + 10);
      await expect.poll(async () => (await geometry(page)).viewport.top).toBeGreaterThan(pinched.viewport.top + 10);
      await settle(page, 5);
      const panned = await geometry(page);
      expectButtonPosition(panned, { board: true, collapsed });
      expectPanelPosition(panned);
      const viewportEvidence = testInfo.outputPath("native-visual-viewport.json");
      writeFileSync(viewportEvidence, JSON.stringify({ before: before.viewport, pinched: pinched.viewport, panned: panned.viewport }, null, 2));
      await testInfo.attach("native-visual-viewport.json", { path: viewportEvidence, contentType: "application/json" });
    } finally {
      await context.close();
    }
  });
}
