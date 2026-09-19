import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const templateSource = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
const bundleSource = readFileSync(new URL("../../dist/index.js", import.meta.url), "utf8");
const rawBase = "https://raw.githubusercontent.com/MINT-the-GAP/lia-marker/main";

async function openCourse(page, body) {
  for (const [path, contentType, source] of [
    ["README.md", "text/markdown; charset=utf-8", templateSource],
    ["dist/index.js", "application/javascript; charset=utf-8", bundleSource],
  ]) {
    await page.route(`${rawBase}/${path}`, (route) => route.fulfill({
      status: 200,
      contentType,
      headers: { "access-control-allow-origin": "*", "cache-control": "no-store" },
      body: source,
    }));
  }

  const source = `<!--\nversion: 1.0.0\nlanguage: de\nimport: ${rawBase}/README.md\n-->\n\n${body}`;
  await page.goto(
    `https://liascript.github.io/course/?data:text/plain;charset=utf-8,${encodeURIComponent(source)}`,
    { waitUntil: "domcontentloaded" },
  );
  await expect(page.locator("#lia-hl-btn")).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const registry = window.__LIA_TEXTMARKER_REG_V4__;
    return Object.values(registry?.instances || {}).some((instance) => instance.__alive);
  })).toBe(true);
}

async function expectHighlightOver(page, target, kind) {
  await expect.poll(async () => {
    const targetRect = await target.boundingBox();
    if (!targetRect) return false;
    const rectangles = await page.locator(`.lia-hl-rect[data-kind="${kind}"]`).evaluateAll(
      (elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }),
    );
    return rectangles.length > 0 && rectangles.every((rect) =>
      rect.x >= targetRect.x - 2 &&
      rect.y >= targetRect.y - 2 &&
      rect.x + rect.width <= targetRect.x + targetRect.width + 2 &&
      rect.y + rect.height <= targetRect.y + targetRect.height + 2,
    );
  }).toBe(true);
}

test("keeps prefilled legend colors off bold text after slide navigation", async ({ page }) => {
  await openCourse(page, `
# Navigationstest

Startseite

## Markerfarben

@markedred(Farblegende)

## Markerquiz

**Fettvorgabe**

<div class="markerquiz">
@markred(Quizantwort)
@TextmarkerQuiz
</div>
`);

  await page.keyboard.press("ArrowRight");
  const prefill = page.locator(".lia-hl-prefill");
  await expect(prefill).toHaveText("Farblegende");
  await expectHighlightOver(page, prefill, "prefill");

  for (let visit = 0; visit < 2; visit += 1) {
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".markerquiz")).toBeVisible();
    await expect(page.locator("strong").filter({ hasText: "Fettvorgabe" })).toBeVisible();
    await expect(prefill).toHaveCount(0);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.locator('.lia-hl-rect[data-kind="prefill"]')).toHaveCount(0);

    await page.keyboard.press("ArrowLeft");
    await expect(prefill).toHaveText("Farblegende");
    await expectHighlightOver(page, prefill, "prefill");
  }
});

test("keeps a prefill attached to its authored text after sibling insertion", async ({ page }) => {
  await openCourse(page, `
# Dynamischer Inhalt

@markedred(Farblegende)

<div class="markerquiz">
@markred(Quizantwort)
@TextmarkerQuiz
</div>
`);

  const prefill = page.locator(".lia-hl-prefill");
  await expectHighlightOver(page, prefill, "prefill");
  await prefill.evaluate((element) => {
    const bold = document.createElement("strong");
    bold.textContent = "Fettvorgabe ";
    element.before(bold);
  });
  await expect(page.locator("strong").filter({ hasText: "Fettvorgabe" })).toBeVisible();
  await expectHighlightOver(page, prefill, "prefill");
});

test("still allows the learner to highlight bold quiz text", async ({ page }) => {
  await openCourse(page, `
# Fettes Quizwort

<div class="markerquiz">
@markred(**Fettziel**)
@TextmarkerQuiz
</div>
`);

  const bold = page.locator(".markerquiz strong");
  await expect(bold).toHaveText("Fettziel");
  await expect(page.locator(".lia-hl-rect")).toHaveCount(0);
  await page.evaluate(() => {
    const registry = window.__LIA_TEXTMARKER_REG_V4__;
    const instance = Object.values(registry.instances).find((item) => item.__alive);
    instance.state.active = true;
    instance.state.panelOpen = false;
    instance.state.tool = "mark";
    instance.state.color = "red";
  });
  await bold.dblclick();
  await expectHighlightOver(page, bold, "user");
  await page.locator(".markerquiz .lia-quiz__check").click();
  await expect(page.locator(".markerquiz .lia-quiz")).toHaveClass(/\bsolved\b/);
});


test("does not reuse a removed prefill path for the next slide's bold text", async ({ page }) => {
  await page.setContent('<main><section><p><span class="lia-hl-prefill" data-hl-prefill="red">Farblegende</span></p></section></main>');
  await page.addScriptTag({ content: bundleSource });
  const prefill = page.locator(".lia-hl-prefill");
  await expectHighlightOver(page, prefill, "prefill");

  for (let visit = 0; visit < 2; visit += 1) {
    await page.locator("section").evaluate((section) => {
      section.innerHTML = '<p><strong>Fettvorgabe</strong></p><div class="markerquiz">Quiz</div>';
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.locator("strong")).toHaveText("Fettvorgabe");
    await expect(page.locator('.lia-hl-rect[data-kind="prefill"]')).toHaveCount(0);

    await page.locator("section").evaluate((section) => {
      section.innerHTML = '<p><span class="lia-hl-prefill" data-hl-prefill="red">Farblegende</span></p>';
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await expectHighlightOver(page, prefill, "prefill");
  }
});

test("preserves restored user highlights and array identity when refreshing prefills", async ({ page }) => {
  await page.setContent('<main><section><p><span class="lia-hl-prefill" data-hl-prefill="red">Farblegende</span></p><p><strong>Fettvorgabe</strong></p></section></main>');
  await page.addScriptTag({ content: bundleSource });
  await expectHighlightOver(page, page.locator(".lia-hl-prefill"), "prefill");

  const restoredState = await page.evaluate(() => {
    const registry = window.__LIA_TEXTMARKER_REG_V4__;
    const instance = Object.values(registry.instances).find((item) => item.__alive);
    const initialPrefill = instance.HL.find((item) => item.kind === "prefill");
    const parts = [];
    for (let node = document.querySelector("strong"); node !== document.body; node = node.parentNode) {
      parts.unshift(Array.prototype.indexOf.call(node.parentNode.childNodes, node));
    }
    const path = parts.join("/");
    const user = {
      ...JSON.parse(JSON.stringify(initialPrefill)),
      id: initialPrefill.id,
      kind: "user",
      color: "blue",
      anchor: { sp: path, so: 0, ep: path, eo: 1 },
    };
    const stalePrefill = { ...JSON.parse(JSON.stringify(initialPrefill)), color: "green", anchor: user.anchor };
    const restored = [user, stalePrefill];
    registry.setHighlights(restored);
    return {
      sameArray: instance.HL === restored,
      sameUser: instance.HL.includes(user),
      distinctIds: new Set(instance.HL.map((item) => item.id)).size === instance.HL.length,
      userCount: instance.HL.filter((item) => item.kind === "user").length,
      prefillColors: instance.HL.filter((item) => item.kind === "prefill").map((item) => item.color),
    };
  });
  expect(restoredState).toEqual({
    sameArray: true,
    sameUser: true,
    distinctIds: true,
    userCount: 1,
    prefillColors: ["red"],
  });
  await expectHighlightOver(page, page.locator(".lia-hl-prefill"), "prefill");
  await expectHighlightOver(page, page.locator("strong"), "user");
});
