import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const bundleSource = readFileSync(new URL("../../dist/index.js", import.meta.url), "utf8");
const markerSelector = '.lia-hl-rect[data-kind="user"][data-id="1"]';

const innerFixture = {
  css: `
    main {
      margin: 130px 80px 0;
      width: 510px; height: 350px;
      border: 9px solid #888; padding: 27px;
      overflow: auto;
    }
    .content { width: 1200px; height: 1600px; padding: 160px 230px; }
  `,
  html: '<main><div class="content"><span id="marked-text">Markierter Text</span></div></main>',
};

const documentFixture = {
  css: `
    header {
      position: fixed; inset: 0 0 auto; height: 110px;
      background: #333; color: white; z-index: 100;
    }
    main { margin-top: 140px; padding: 110px 230px; min-height: 1800px; }
  `,
  html: '<header id="lia-toolbar-nav">Kursnavigation</header><main><span id="marked-text">Markierter Text</span></main>',
};

async function loadFixture(page, { css, html }) {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.setContent(`
    <!doctype html><html><head><style>
      html, body { margin: 0; }
      body { font: 24px/1.5 Arial, sans-serif; }
      * { scroll-behavior: auto !important; }
      #marked-text { white-space: nowrap; }
      ${css}
    </style></head><body>${html}</body></html>
  `);
  await page.addScriptTag({ content: bundleSource });
  await page.evaluate(() => {
    const node = document.querySelector("#marked-text").firstChild;
    const parts = [];
    for (let current = node; current !== document.body; current = current.parentNode) {
      parts.unshift(Array.prototype.indexOf.call(current.parentNode.childNodes, current));
    }
    const path = parts.join("/");
    const registry = window.__LIA_TEXTMARKER_REG_V4__;
    const instance = Object.values(registry.instances).find((entry) => entry.__alive);
    registry.setHighlights([...(instance?.HL ?? []).filter((item) => item.kind === "prefill"), {
      id: 1,
      kind: "user",
      color: "yellow",
      scope: "global",
      slide: "global",
      rects: [],
      anchor: { sp: path, so: 0, ep: path, eo: node.textContent.length },
    }]);

    window.readHighlightGeometry = () => {
      const text = document.createRange();
      text.selectNodeContents(document.querySelector("#marked-text"));
      const rect = document.querySelector('.lia-hl-rect[data-kind="user"][data-id="1"]');
      if (!rect) return null;
      const serialize = ({ left, top, width, height }) => ({ left, top, width, height });
      return {
        text: serialize(text.getBoundingClientRect()),
        marker: serialize(rect.getBoundingClientRect()),
      };
    };
  });
  await expect(page.locator(markerSelector)).toHaveCount(1);
  await expect.poll(async () => page.evaluate(() => {
    const geometry = window.readHighlightGeometry();
    return geometry
      ? Math.max(
          Math.abs(geometry.text.left - geometry.marker.left),
          Math.abs(geometry.text.top - geometry.marker.top),
        )
      : Infinity;
  })).toBeLessThanOrEqual(1);
}

function expectAligned(geometry) {
  expect(geometry).not.toBeNull();
  for (const key of ["left", "top", "width", "height"]) {
    expect(Math.abs(geometry.marker[key] - geometry.text[key]), key).toBeLessThanOrEqual(1);
  }
}

test("highlights follow both axes of a bordered, padded scroll container immediately", async ({ page }) => {
  await loadFixture(page, innerFixture);

  // Read geometry in the same JavaScript task as scrolling. Waiting for an
  // animation frame here would hide the visible lag caused by a fixed overlay.
  const result = await page.evaluate(() => {
    const main = document.querySelector("main");
    const before = window.readHighlightGeometry();
    main.scrollTop = 96;
    main.scrollLeft = 112;
    return {
      before,
      after: window.readHighlightGeometry(),
      scrollTop: main.scrollTop,
      scrollLeft: main.scrollLeft,
    };
  });

  expect(result.scrollTop).toBe(96);
  expect(result.scrollLeft).toBe(112);
  expectAligned(result.before);
  expectAligned(result.after);
  expect(result.after.marker.top - result.before.marker.top).toBeCloseTo(-96, 0);
  expect(result.after.marker.left - result.before.marker.left).toBeCloseTo(-112, 0);
});

for (const axis of ["vertical", "horizontal"]) {
  test(`the scroll container clips ${axis} highlights at its inner border`, async ({ page }) => {
    await loadFixture(page, innerFixture);

    await page.evaluate((axis) => {
      const main = document.querySelector("main");
      const host = main.getBoundingClientRect();
      const { text } = window.readHighlightGeometry();
      if (axis === "vertical") {
        main.scrollTop += text.top + text.height / 2 - (host.top + main.clientTop);
      } else {
        main.scrollLeft += text.left + text.width / 2 - (host.left + main.clientLeft);
      }
    }, axis);

    // Allow repositioning to settle: clipping must also work after scrolling
    // stops, independently of the immediate-scroll regression above.
    await expect.poll(async () => page.evaluate(() => {
      const geometry = window.readHighlightGeometry();
      return geometry
        ? Math.max(
            Math.abs(geometry.text.left - geometry.marker.left),
            Math.abs(geometry.text.top - geometry.marker.top),
          )
        : Infinity;
    })).toBeLessThanOrEqual(1);

    const hits = await page.evaluate((axis) => {
      const main = document.querySelector("main");
      const host = main.getBoundingClientRect();
      const { text } = window.readHighlightGeometry();
      const x = text.left + text.width / 2;
      const y = text.top + text.height / 2;
      const left = host.left + main.clientLeft;
      const top = host.top + main.clientTop;
      const outside = axis === "vertical" ? [x, top - 5] : [left - 5, y];
      const inside = axis === "vertical" ? [x, top + 5] : [left + 5, y];
      const hitsMarker = ([px, py]) => document.elementsFromPoint(px, py)
        .some((element) => element.matches('.lia-hl-rect[data-kind="user"][data-id="1"]'));
      return { outside: hitsMarker(outside), inside: hitsMarker(inside) };
    }, axis);

    expect(hits.inside).toBe(true);
    expect(hits.outside).toBe(false);
  });
}

test("document highlights follow window scrolling immediately", async ({ page }) => {
  await loadFixture(page, documentFixture);

  const result = await page.evaluate(() => {
    const before = window.readHighlightGeometry();
    window.scrollTo(0, 96);
    return { before, after: window.readHighlightGeometry(), scrollY: window.scrollY };
  });

  expect(result.scrollY).toBe(96);
  expectAligned(result.before);
  expectAligned(result.after);
  expect(result.after.marker.top - result.before.marker.top).toBeCloseTo(-96, 0);
});

test("scrolled highlights stay behind a fixed course header", async ({ page }) => {
  await loadFixture(page, documentFixture);

  await page.evaluate(() => {
    const { text } = window.readHighlightGeometry();
    window.scrollTo(0, text.top + text.height / 2 - 55);
  });

  await expect.poll(async () => page.evaluate(() => {
    const geometry = window.readHighlightGeometry();
    return geometry ? Math.abs(geometry.marker.top - geometry.text.top) : Infinity;
  })).toBeLessThanOrEqual(1);

  const hit = await page.evaluate(() => {
    const { text } = window.readHighlightGeometry();
    const x = text.left + text.width / 2;
    const y = text.top + text.height / 2;
    const topElement = document.elementFromPoint(x, y);
    return { y, headerIsOnTop: !!topElement?.closest("#lia-toolbar-nav") };
  });

  expect(hit.y).toBeGreaterThan(0);
  expect(hit.y).toBeLessThan(110);
  expect(hit.headerIsOnTop).toBe(true);
});

test("highlights follow nested inner and outer scroll containers immediately", async ({ page }) => {
  await loadFixture(page, {
    css: `
      main {
        margin: 130px 80px 0; width: 700px; height: 420px;
        border: 7px solid #888; padding: 20px; overflow: auto;
      }
      .outer-content { width: 1200px; height: 1400px; padding: 60px 70px; }
      .inner {
        width: 440px; height: 220px;
        border: 5px solid #777; padding: 17px; overflow: auto;
      }
      .inner-content { width: 1000px; height: 1000px; padding: 100px 160px; }
    `,
    html: `<main><div class="outer-content"><div class="inner">
      <div class="inner-content"><span id="marked-text">Markierter Text</span></div>
    </div></div></main>`,
  });

  const result = await page.evaluate(() => {
    const main = document.querySelector("main");
    const inner = document.querySelector(".inner");
    const before = window.readHighlightGeometry();
    inner.scrollTop = 60;
    inner.scrollLeft = 50;
    const afterInner = window.readHighlightGeometry();
    main.scrollTop = 35;
    main.scrollLeft = 15;
    return { before, afterInner, afterOuter: window.readHighlightGeometry() };
  });

  expectAligned(result.before);
  expectAligned(result.afterInner);
  expectAligned(result.afterOuter);
  expect(result.afterOuter.text.top - result.before.text.top).toBeCloseTo(-95, 0);
  expect(result.afterOuter.text.left - result.before.text.left).toBeCloseTo(-65, 0);
});


test("Reveal highlights remain stable across frames and react to slide navigation", async ({ page }) => {
  await loadFixture(page, {
    css: `
      main { margin: 120px 80px; width: 700px; height: 400px; overflow: auto; }
      section { padding: 90px 140px; }
      section[aria-hidden="true"] { display: none; }
    `,
    html: `<div class="reveal"><main class="slides">
      <section id="first-slide" class="present" aria-hidden="false">
        <span id="marked-text">Markierter Text</span>
        <p><span class="lia-hl-prefill" data-hl-prefill="yellow">Gelbe Vorgabe</span></p>
      </section>
      <section id="second-slide" aria-hidden="true">
        <span class="lia-hl-prefill" data-hl-prefill="green">Gruene Vorgabe</span>
      </section>
    </main></div>`,
  });

  const yellowPrefills = page.locator('.lia-hl-rect[data-kind="prefill"][data-hl="yellow"]');
  const greenPrefills = page.locator('.lia-hl-rect[data-kind="prefill"][data-hl="green"]');
  await expect(yellowPrefills).toHaveCount(1);
  await expect(greenPrefills).toHaveCount(0);

  const frames = await page.evaluate(async () => {
    const nextFrame = () => new Promise(requestAnimationFrame);
    await nextFrame();
    await nextFrame();
    const registry = window.__LIA_TEXTMARKER_REG_V4__;
    const instance = Object.values(registry.instances).find((entry) => entry.__alive);
    // Inserting highlights after the slide observer has attached must not
    // recursively look like another navigation event.
    registry.setHighlights(instance.HL);
    await nextFrame();
    await nextFrame();

    const samples = [];
    for (let frame = 0; frame < 4; frame++) {
      await nextFrame();
      samples.push({
        count: document.querySelectorAll('.lia-hl-rect[data-kind="user"]').length,
        geometry: window.readHighlightGeometry(),
      });
    }
    return samples;
  });

  for (const sample of frames) {
    expect(sample.count).toBe(1);
    expectAligned(sample.geometry);
  }

  await page.evaluate(() => {
    document.querySelector("#first-slide").classList.remove("present");
    document.querySelector("#first-slide").setAttribute("aria-hidden", "true");
    document.querySelector("#second-slide").classList.add("present");
    document.querySelector("#second-slide").setAttribute("aria-hidden", "false");
  });
  await expect(page.locator(markerSelector)).toHaveCount(0);
  await expect(yellowPrefills).toHaveCount(0);
  await expect(greenPrefills).toHaveCount(1);

  await page.evaluate(() => {
    document.querySelector("#second-slide").classList.remove("present");
    document.querySelector("#second-slide").setAttribute("aria-hidden", "true");
    document.querySelector("#first-slide").classList.add("present");
    document.querySelector("#first-slide").setAttribute("aria-hidden", "false");
  });
  await expect(page.locator(markerSelector)).toHaveCount(1);
  await expect(yellowPrefills).toHaveCount(1);
  await expect(greenPrefills).toHaveCount(0);
  expectAligned(await page.evaluate(() => window.readHighlightGeometry()));
});

for (const retainPreviousMain of [false, true]) {
  test(`highlights recover after main replacement${retainPreviousMain ? " with a hidden previous main" : ""}`, async ({ page }) => {
    await loadFixture(page, {
      css: innerFixture.css,
      // Reserve the previous main's DOM slot so the visible text retains the
      // same persisted anchor path when LiaScript keeps its predecessor.
      html: `${retainPreviousMain ? '<main hidden id="previous-main"></main>' : ""}
        <main id="active-main"><div class="content"><span id="marked-text">Markierter Text</span></div></main>`,
    });

    const sizes = await page.evaluate((retainPreviousMain) => {
      const previous = document.querySelector("#active-main");
      const before = previous.getBoundingClientRect().toJSON();
      const replacement = previous.cloneNode(true);
      replacement.querySelectorAll("#lia-hl-overlay, .lia-hl-scroll-overlay").forEach((node) => node.remove());
      previous.replaceWith(replacement);
      if (retainPreviousMain) {
        const placeholder = document.querySelector("#previous-main");
        previous.id = "previous-main";
        previous.querySelector("#marked-text").id = "previous-text";
        previous.hidden = true;
        placeholder.replaceWith(previous);
      }
      return { before, after: replacement.getBoundingClientRect().toJSON() };
    }, retainPreviousMain);

    expect(sizes.after).toEqual(sizes.before);
    // No setHighlights call after replacement: that would explicitly render
    // and conceal a missing automatic remount.
    await expect(page.locator(markerSelector)).toHaveCount(1);
    await expect.poll(async () => page.evaluate(() => {
      const geometry = window.readHighlightGeometry();
      return geometry
        ? Math.max(
            Math.abs(geometry.text.left - geometry.marker.left),
            Math.abs(geometry.text.top - geometry.marker.top),
          )
        : Infinity;
    })).toBeLessThanOrEqual(1);

    const geometry = await page.evaluate(() => {
      document.querySelector("#active-main").scrollTop = 70;
      return window.readHighlightGeometry();
    });
    expectAligned(geometry);
  });
}

