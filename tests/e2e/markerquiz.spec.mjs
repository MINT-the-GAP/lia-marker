import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const templateSource = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
const bundleSource = readFileSync(new URL("../../dist/index.js", import.meta.url), "utf8");
const fixtureSource = readFileSync(new URL("../fixtures/solution.md", import.meta.url), "utf8");

const remoteRef = process.env.LIA_MARKER_TEST_REF || "main";
const rawBase = `https://raw.githubusercontent.com/MINT-the-GAP/lia-marker/${remoteRef}`;
const readmeUrl = `${rawBase}/README.md`;
const bundleUrl = `${rawBase}/dist/index.js`;
const useLiveRemote = process.env.LIA_MARKER_TEST_LIVE === "1";
const liveEditorBase = "https://liascript.github.io/LiveEditor/";
const dynFlexUrl =
  "https://raw.githubusercontent.com/MINT-the-GAP/lia-DynFlex/refs/heads/main/README.md";
const timerUrl =
  "https://raw.githubusercontent.com/MINT-the-GAP/lia-timer/refs/heads/main/README.md";
const lootUrl =
  "https://raw.githubusercontent.com/MINT-the-GAP/lia-loot/refs/heads/main/README.md";
const freezeUrl =
  "https://raw.githubusercontent.com/MINT-the-GAP/lia-freeze-v2/refs/heads/main/README.md";
const weeklyTaskImports = [
  dynFlexUrl,
  timerUrl,
];
const exactLootWeeklyTaskBody = `
# Exakter Wochenaufgaben-Block

<section class=dynFlex>

<div class=flex-child>

**$a)\\\\;\\\\;$**
<div class=markerquiz>
@markred(Die neugierige Schülerin) @markblue(entdeckt) @markgreen(eine alte Schachtel).

<!-- data-solution-timer="120s" data-solution-timer-start="oncheck" data-solution-timer-badge="off" -->
@TextmarkerQuiz
</div>
*****************
@Energiekiste
@Schatztruhe(markerquiz)
*****************

@ADetails(BE=3;Satzglieder)

</div>
</section>
`;

function makeCourse(body, imports = []) {
  return `<!--
version: 1.0.0
language: de
import: ${readmeUrl}
${imports.map((url) => `import: ${url}`).join("\n")}
-->

${body}
`;
}

function makeExactLootWeeklyTaskCourse() {
  return `<!--
version: 1.0.0
language: de
import: ${dynFlexUrl}
import: ${timerUrl}
import: ${readmeUrl}
import: ${freezeUrl}
import: ${lootUrl}
-->

${exactLootWeeklyTaskBody}
`;
}

function courseUrl(body) {
  return sourceUrl(makeCourse(body));
}

function sourceUrl(sourceText) {
  const source = `data:text/plain;charset=utf-8,${encodeURIComponent(sourceText)}`;
  return `https://liascript.github.io/course/?${source}`;
}

function liveEditorUrl(sourceText) {
  const encoded = Buffer.from(sourceText, "utf8").toString("base64");
  return `${liveEditorBase}?${encodeURIComponent(`/show/code/${encoded}`)}`;
}

function collectBrowserErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function routeWorkingTree(page) {
  const hits = { readme: 0, bundle: 0 };

  await page.route(readmeUrl, async (route) => {
    hits.readme += 1;
    await route.fulfill({
      status: 200,
      contentType: "text/markdown; charset=utf-8",
      headers: { "access-control-allow-origin": "*", "cache-control": "no-store" },
      body: templateSource,
    });
  });

  await page.route(bundleUrl, async (route) => {
    hits.bundle += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      headers: { "access-control-allow-origin": "*", "cache-control": "no-store" },
      body: bundleSource,
    });
  });

  return hits;
}

async function waitForPlugin(page) {
  await expect(page.locator(".markerquiz").first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const registry = window.__LIA_TEXTMARKER_REG_V4__;
    return !!registry && Object.values(registry.instances || {}).some((instance) => instance.__alive);
  })).toBe(true);
}

async function openSource(page, sourceText, { local = !useLiveRemote } = {}) {
  const errors = collectBrowserErrors(page);
  const hits = local ? await routeWorkingTree(page) : null;

  await page.goto(sourceUrl(sourceText), { waitUntil: "domcontentloaded" });
  await waitForPlugin(page);

  if (hits) {
    await expect.poll(() => hits.readme).toBeGreaterThan(0);
    await expect.poll(() => hits.bundle).toBeGreaterThan(0);
  }

  return { errors, hits };
}

async function openCourse(page, body, options = {}) {
  const { imports = [], ...openOptions } = options;
  return openSource(page, makeCourse(body, imports), openOptions);
}

test("keeps the toolbar button inside the LiveEditor preview", async ({ page, browserName }) => {
  test.skip(
    browserName === "webkit",
    "The public LiveEditor does not initialize its preview iframe in Playwright WebKit.",
  );

  const hits = await routeWorkingTree(page);
  const source = makeCourse(`
# LiveEditor-Position

<div class="markerquiz">
@mark(Zwei) Gruppen.

@TextmarkerQuiz
</div>
`);

  await page.goto(liveEditorUrl(source), { waitUntil: "domcontentloaded" });

  await expect(page.locator("#liascript-preview")).toBeVisible();
  const preview = page.frameLocator("#liascript-preview");
  await expect(preview.locator(".markerquiz").first()).toBeVisible();
  await expect.poll(() => hits.readme).toBeGreaterThan(0);
  await expect.poll(() => hits.bundle).toBeGreaterThan(0);

  await expect(page.locator("#lia-hl-btn")).toHaveCount(0);
  const button = preview.locator("#lia-hl-btn");
  await expect(button).toHaveCount(1);
  await expect(button).toBeVisible();

  const placement = await button.evaluate((element) => {
    const toc = document.getElementById("lia-btn-toc") ||
      document.querySelector("#lia-toolbar-nav .lia-header__left button");
    const buttonRect = element.getBoundingClientRect();
    const tocRect = toc?.getBoundingClientRect();
    return {
      parentId: element.parentElement?.id || "",
      left: buttonRect.left,
      right: buttonRect.right,
      top: buttonRect.top,
      bottom: buttonRect.bottom,
      centerY: buttonRect.top + buttonRect.height / 2,
      tocRight: tocRect?.right ?? null,
      tocCenterY: tocRect ? tocRect.top + tocRect.height / 2 : null,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
    };
  });

  expect(placement.parentId).toBe("lia-hl-ui-overlay-v1");
  expect(placement.left).toBeGreaterThanOrEqual(0);
  expect(placement.right).toBeLessThanOrEqual(placement.viewportWidth);
  expect(placement.top).toBeGreaterThanOrEqual(0);
  expect(placement.bottom).toBeLessThanOrEqual(placement.viewportHeight);
  expect(placement.tocRight).not.toBeNull();
  expect(placement.left - placement.tocRight).toBeGreaterThanOrEqual(4);
  expect(placement.left - placement.tocRight).toBeLessThanOrEqual(12);
  expect(Math.abs(placement.centerY - placement.tocCenterY)).toBeLessThanOrEqual(2);

  await button.click();
  await expect(preview.locator("#lia-hl-panel")).toBeVisible();
  await expect(page.locator("#lia-hl-panel")).toHaveCount(0);
});

async function markTarget(page, expectedColor, actualColor, expectedCount) {
  const target = page.locator(
    `.lia-hl-target[data-hl-expected="${expectedColor}"]`,
  ).first();
  await expect(target).toBeVisible();

  await target.evaluate((_element, color) => {
    const registry = window.__LIA_TEXTMARKER_REG_V4__;
    const instance = Object.values(registry.instances || {}).find((item) => item.__alive);
    if (!instance) throw new Error("Textmarker instance not available");

    instance.state.active = true;
    instance.state.panelOpen = false;
    instance.state.tool = "mark";
    instance.state.color = color;
  }, actualColor);
  await target.dblclick();

  await expect.poll(() => page.evaluate(() => {
    const registry = window.__LIA_TEXTMARKER_REG_V4__;
    const instance = Object.values(registry.instances || {}).find((item) => item.__alive);
    return instance?.HL.filter((item) => item.kind === "user").length || 0;
  })).toBe(expectedCount);
}

async function markWholeTarget(page, expectedColor, actualColor, expectedCount) {
  const target = page.locator(
    `.lia-hl-target[data-hl-expected="${expectedColor}"]`,
  ).first();
  await expect(target).toBeVisible();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await target.evaluate((element, color) => {
      const registry = window.__LIA_TEXTMARKER_REG_V4__;
      const instance = Object.values(registry.instances || {})
        .find((item) => item.__alive);
      if (!instance) throw new Error("Textmarker instance not available");

      instance.state.active = true;
      instance.state.panelOpen = false;
      instance.state.tool = "mark";
      instance.state.color = color;

      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      element.dispatchEvent(new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        detail: 1,
        view: window,
      }));
    }, actualColor);

    try {
      await expect.poll(() => page.evaluate(() => {
        const registry = window.__LIA_TEXTMARKER_REG_V4__;
        const instance = Object.values(registry.instances || {})
          .find((item) => item.__alive);
        return instance?.HL.filter((item) => item.kind === "user").length || 0;
      }), { timeout: 3_000 }).toBe(expectedCount);
      return;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

test("loads the published GitHub template and bundle", async ({ page }) => {
  const responses = [];
  page.on("response", (response) => {
    if (response.url().startsWith(rawBase)) {
      responses.push({ url: response.url(), status: response.status() });
    }
  });

  const { errors } = await openCourse(page, `
# Online import

<div class="markerquiz">
@markred(Online)
@TextmarkerQuiz
</div>
`, { local: false });

  await expect(page.locator('.lia-hl-target[data-hl-expected="red"]')).toHaveText("Online");
  await expect(page.locator(".hlq-resolution")).toHaveCount(0);
  await page.locator(".markerquiz .lia-quiz__resolve").click();
  await expect.poll(() => page.evaluate(() => {
    const registry = window.__LIA_TEXTMARKER_REG_V4__;
    const instance = Object.values(registry.instances || {}).find((item) => item.__alive);
    return instance?.HL.filter((item) => item.kind === "solution").length || 0;
  })).toBe(1);
  expect(responses).toEqual(expect.arrayContaining([
    expect.objectContaining({ url: readmeUrl, status: 200 }),
    expect.objectContaining({ url: bundleUrl, status: 200 }),
  ]));
  expect(errors).toEqual([]);
});

test("keeps the exterior solution hidden until Resolve", async ({ page }) => {
  const { errors } = await openCourse(page, `
# Markerquiz mit Musterlösung

<div class="markerquiz">
@markred(Katze) @markblue(Schritt)
@TextmarkerQuiz
</div>
**************
Musterlösungstext
**************
`);

  const scope = page.locator(".markerquiz");
  const resolution = page.locator(".hlq-resolution");
  const solution = page.getByText("Musterlösungstext", { exact: true });

  await expect(resolution).toBeHidden();
  await expect(solution).toBeHidden();
  await expect(page.locator(".hlq-resolution__delimiter")).toHaveCount(2);
  await expect(page.locator(".hlq-resolution__delimiter").first()).toBeHidden();

  await scope.locator(".lia-quiz__check").click();
  await expect(solution).toBeHidden();
  await expect(scope.locator(".lia-quiz")).toHaveClass(/\bopen\b/);

  await scope.locator(".lia-quiz__resolve").click();
  await expect(solution).toBeVisible();
  await expect(resolution).toHaveAttribute("data-hlq-state", "visible");
  await expect(scope.locator(".lia-quiz")).toHaveClass(/\bresolved\b/);

  await expect.poll(() => page.evaluate(() => {
    const registry = window.__LIA_TEXTMARKER_REG_V4__;
    const instance = Object.values(registry.instances || {}).find((item) => item.__alive);
    return instance?.HL
      .filter((item) => item.kind === "solution")
      .map((item) => item.color)
      .sort() || [];
  })).toEqual(["blue", "red"]);

  expect(errors).toEqual([]);
});

test("handles weekly-task solutions collapsed inside a raw flex wrapper", async ({ page }) => {
  const { errors } = await openCourse(page, `
# Wochenaufgaben-Layout

<section class="dynFlex">
<div class="flex-child">

__a)__ **Nomen**

<div class="markerquiz">
Der @markred(Forscher) oeffnet vorsichtig die schwere @markblue(Metallkiste).

<!-- data-solution-timer="120s" data-solution-timer-start="oncheck" data-solution-timer-badge="off" data-hint-button="2" data-solution-button="3" -->
@TextmarkerQuiz
</div>
**************
Musterloesung im Flex-Layout
**************

</div>
</section>
`, { imports: weeklyTaskImports });

  const metadata = page.locator(".hlq-metadata-artifact");
  const resolution = page.locator(".hlq-resolution");
  const solution = page.getByText("Musterloesung im Flex-Layout", { exact: true });

  await expect(metadata).toHaveCount(1);
  await expect(metadata).toBeHidden();
  await expect(resolution).toHaveCount(1);
  await expect(resolution).toBeHidden();
  await expect(solution).toBeHidden();
  await expect(page.locator(".hlq-resolution__delimiter")).toHaveCount(2);

  await page.locator(".lia-quiz__check").first().click();
  await expect(solution).toBeHidden();
  await expect(metadata).toBeHidden();

  await page.locator(".lia-quiz__resolve").first().click();
  await expect(solution).toBeVisible();
  await expect(resolution).toHaveAttribute("data-hlq-state", "visible");
  await expect(metadata).toBeHidden();

  await page.evaluate(() => {
    const registry = window.__LIA_TEXTMARKER_REG_V4__;
    for (const instance of Object.values(registry?.instances || {})) {
      if (!instance.__alive) continue;
      instance.__alive = false;
      instance.__cleanupResolutions?.();
    }
  });
  await expect(page.locator(".hlq-resolution")).toHaveCount(0);
  await expect(page.locator(".hlq-resolution__delimiter")).toHaveCount(0);
  await expect(page.locator(".hlq-metadata-artifact")).toHaveCount(0);
  await page.locator(".lia-quiz__resolve").first().dispatchEvent("click");
  await expect(page.locator(".hlq-resolution")).toHaveCount(0);
  await expect(page.locator(".hlq-resolution__delimiter")).toHaveCount(0);
  await expect(page.locator(".hlq-metadata-artifact")).toHaveCount(0);
  await expect.poll(() => page.locator(".markerquiz").evaluate((scope) => ({
    metadataRestored: (scope.textContent || "").includes("data-solution-timer"),
    solutionTextRestored: (scope.parentElement?.textContent || "").includes(
      "**************Musterloesung im Flex-Layout**************",
    ),
    generatedAnchors: Array.from(scope.parentElement?.childNodes || [])
      .filter((node) => node.nodeType === Node.COMMENT_NODE)
      .filter((node) => node.nodeValue === "hlq-text-resolution").length,
  }))).toEqual({
    metadataRestored: true,
    solutionTextRestored: true,
    generatedAnchors: 0,
  });
  expect(errors).toEqual([]);
});

for (const [name, quizSource] of [
  [
    "before the task label",
    `<!-- data-solution-timer="120s" data-solution-timer-start="oncheck" data-solution-timer-badge="off" data-hint-button="2" data-solution-button="3" -->
__$l)\\;\\;$__ **Numeralien**
<div class="markerquiz">
@mark(Zwei) Gruppen untersuchten insgesamt @mark(zwoelf) Fotografien.

@TextmarkerQuiz
</div>`,
  ],
  [
    "between the task label and marker quiz",
    `__$l)\\;\\;$__ **Numeralien**

<!-- data-solution-timer="120s" data-solution-timer-start="oncheck" data-solution-timer-badge="off" data-hint-button="2" data-solution-button="3" -->
<div class="markerquiz">
@mark(Zwei) Gruppen untersuchten insgesamt @mark(zwoelf) Fotografien.

@TextmarkerQuiz
</div>`,
  ],
]) {
  test(`applies marker-quiz metadata ${name}`, async ({ page }) => {
    const { errors } = await openCourse(page, `
# Markerquiz-Metadaten

${quizSource}
`, { imports: [timerUrl] });

    const configured = page.locator([
      '[data-solution-timer="120s"]',
      '[data-solution-timer-start="oncheck"]',
      '[data-solution-timer-badge="off"]',
      '[data-hint-button="2"]',
      '[data-solution-button="3"]',
    ].join(""));
    await expect.poll(() => configured.count()).toBeGreaterThan(0);
    await expect.poll(() => configured.evaluateAll((elements) =>
      elements.some((element) =>
        element.dataset.__solTimerArmedSolution === "1"
      )
    )).toBe(true);

    const check = page.locator(".lia-quiz__check").first();
    const resolve = page.locator(".lia-quiz__resolve").first();
    await expect(check).toBeVisible();
    await expect(resolve).toHaveCount(1);
    await expect(resolve).toBeHidden();
    await check.click();
    await expect(resolve).toBeHidden();
    expect(errors).toEqual([]);
  });
}

for (const [name, quizSource] of [
  [
    "before the task label",
    `<!-- data-hint-button="2" data-solution-button="3" -->
__$l)\\;\\;$__ **Numeralien**
<div class="markerquiz">
@mark(Zwei) Gruppen untersuchten insgesamt @mark(zwoelf) Fotografien.

@TextmarkerQuiz
</div>`,
  ],
  [
    "between the task label and marker quiz",
    `__$l)\\;\\;$__ **Numeralien**

<!-- data-hint-button="2" data-solution-button="3" -->
<div class="markerquiz">
@mark(Zwei) Gruppen untersuchten insgesamt @mark(zwoelf) Fotografien.

@TextmarkerQuiz
</div>`,
  ],
]) {
  test(`honors marker-quiz attempt gates ${name}`, async ({ page }) => {
    const { errors } = await openCourse(page, `
# Markerquiz-Versuchsgrenzen

${quizSource}
`);

    const check = page.locator(".lia-quiz__check").first();
    const resolve = page.locator(".lia-quiz__resolve").first();
    await expect(check).toBeVisible();
    await expect(resolve).toHaveCount(1);
    await expect(resolve).toBeHidden();

    await check.click();
    await expect(resolve).toBeHidden();
    await check.click();
    await expect(resolve).toBeHidden();
    await check.click();
    await expect(resolve).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("honors a hint attempt gate placed before the marker quiz", async ({ page }) => {
  const { errors } = await openCourse(page, `
# Markerquiz-Hinweisgrenze

__$l)\\;\\;$__ **Numeralien**

<!-- data-hint-button="2" -->
<div class="markerquiz">
@mark(Zwei) Gruppen untersuchten insgesamt @mark(zwoelf) Fotografien.

@TextmarkerQuiz
[[?]] Markiere zuerst ein Numerale.
[[?]] Im Satz gibt es zwei Numeralien.
</div>
`);

  const check = page.locator(".lia-quiz__check").first();
  const hint = page.locator(".lia-quiz__hint").first();
  await expect(check).toBeVisible();
  await expect(hint).toHaveCount(1);
  await expect(hint).toBeHidden();
  await check.click();
  await expect(hint).toBeHidden();
  await check.click();
  await expect(hint).toBeVisible();
  expect(errors).toEqual([]);
});

test("reveals a weekly-task solution element after a correct Check", async ({ page }) => {
  const { errors } = await openCourse(page, `
# Wochenaufgabe mit Element

<div class="flex-child">
<div class="markerquiz">
@markgreen(Elementloesung)
@TextmarkerQuiz
</div>
**************
<span data-testid="weekly-solution-element">Truhenloesung</span>
**************
</div>
`);

  const solution = page.getByTestId("weekly-solution-element");
  await expect(page.locator(".hlq-resolution")).toHaveCount(1);
  await expect(solution).toBeHidden();
  await markTarget(page, "green", "green", 1);
  await page.locator(".lia-quiz__check").first().click();
  await expect(solution).toBeVisible();
  expect(errors).toEqual([]);
});

test("keeps relocated Loot chests inside an exact weekly-task solution", async ({ page }) => {
  const { errors } = await openSource(page, makeExactLootWeeklyTaskCourse());
  const movedChest = page.locator(
    '[data-loot-chest-portal][data-loot-chest-location="markerquiz"]',
  );
  const energyButton = page.locator(
    '[data-loot-chest-button][data-loot-chest-reward="energy"]',
  );
  const details = page.locator(
    "lia-adetails[data-adetails='BE=3;Satzglieder']",
  );
  const metadata = page.locator(".hlq-metadata-artifact");

  await expect(details).toHaveCount(1);
  await expect(details).toBeVisible();
  await expect(metadata).toHaveCount(1);
  await expect(metadata).toBeHidden();
  await expect(page.locator(".hlq-resolution")).toHaveCount(0);
  await expect(page.locator(".lia-quiz__solution")).toHaveCount(0);
  await expect(energyButton).toHaveCount(0);
  await expect(movedChest).toHaveCount(1);
  await expect(movedChest).toBeHidden();
  await expect(movedChest).toHaveClass(/\bhlq-deferred-loot-portal\b/);

  await page.locator(".lia-quiz__check").first().click();
  await expect(page.locator(".lia-quiz")).toHaveClass(/\bopen\b/);
  await expect(page.locator(".lia-quiz__solution")).toHaveCount(0);
  await expect(energyButton).toHaveCount(0);
  await expect(movedChest).toBeHidden();

  await page.locator(".lia-quiz__resolve").first().click();
  await expect(page.locator(".lia-quiz")).toHaveClass(/\bresolved\b/);
  await expect(page.locator(".lia-quiz__solution")).toBeVisible();
  await expect(energyButton).toBeVisible();
  await expect(movedChest).toBeVisible();
  await expect(movedChest).not.toHaveClass(/\bhlq-deferred-loot-portal\b/);
  expect(errors).toEqual([]);
});

test("reveals both exact Loot solution chests after a correct Check", async ({ page }) => {
  const { errors } = await openSource(page, makeExactLootWeeklyTaskCourse());
  const movedChest = page.locator(
    '[data-loot-chest-portal][data-loot-chest-location="markerquiz"]',
  );
  const energyButton = page.locator(
    '[data-loot-chest-button][data-loot-chest-reward="energy"]',
  );

  await expect(movedChest).toHaveCount(1);
  await expect(movedChest).toBeHidden();
  await expect(energyButton).toHaveCount(0);
  await markWholeTarget(page, "red", "red", 1);
  await markTarget(page, "blue", "blue", 2);
  await markWholeTarget(page, "green", "green", 3);
  await expect(movedChest).toBeHidden();
  await expect(movedChest).toHaveClass(/\bhlq-deferred-loot-portal\b/);
  await expect(energyButton).toHaveCount(0);
  await page.locator(".lia-quiz__check").first().click();

  await expect(page.locator(".lia-quiz")).toHaveClass(/\bsolved\b/);
  await expect(page.locator(".lia-quiz__solution")).toBeVisible();
  await expect(energyButton).toBeVisible();
  await expect(movedChest).toBeVisible();
  expect(errors).toEqual([]);
});

test("keeps a markerquiz Loot chest outside a solution immediately available", async ({ page }) => {
  const { errors } = await openSource(page, makeCourse(`
# Direkte Truhe

<div class="markerquiz">
@markred(Sofort)
@TextmarkerQuiz
</div>

@Schatztruhe(markerquiz)
`, [lootUrl]));
  const movedChest = page.locator(
    '[data-loot-chest-portal][data-loot-chest-location="markerquiz"]',
  );

  await expect(movedChest).toHaveCount(1);
  await expect(movedChest).toBeVisible();
  await expect(movedChest).not.toHaveClass(/\bhlq-deferred-loot-portal\b/);
  expect(errors).toEqual([]);
});

test("separates identical immediate and solution Loot portals by source ID", async ({ page }) => {
  const { errors } = await openSource(page, makeCourse(`
# Zwei identische Truhen

@Schatztruhe(markerquiz)

<div class="markerquiz">
@markblue(Getrennt)
@TextmarkerQuiz
</div>
**************
@Schatztruhe(markerquiz)
**************
`, [lootUrl]));
  const portals = page.locator(
    '[data-loot-chest-portal][data-loot-chest-location="markerquiz"]',
  );
  const deferred = page.locator(
    '[data-loot-chest-portal][data-loot-chest-location="markerquiz"].hlq-deferred-loot-portal',
  );
  const immediate = page.locator(
    '[data-loot-chest-portal][data-loot-chest-location="markerquiz"]:not(.hlq-deferred-loot-portal)',
  );

  await expect(portals).toHaveCount(2);
  await expect(deferred).toHaveCount(1);
  await expect(immediate).toHaveCount(1);
  await expect(immediate).toBeVisible();
  await expect(deferred).toBeHidden();

  await page.locator(".lia-quiz__resolve").click();
  await expect(page.locator(".lia-quiz")).toHaveClass(/\bresolved\b/);
  await expect(portals).toHaveCount(2);
  await expect(page.locator(".hlq-deferred-loot-portal")).toHaveCount(0);
  await expect(portals.nth(0)).toBeVisible();
  await expect(portals.nth(1)).toBeVisible();
  expect(errors).toEqual([]);
});

test("reveals identical solution Loot portals only with their own quiz", async ({ page }) => {
  const { errors } = await openSource(page, makeCourse(`
# Zwei getrennte Lösungstruhen

<div class="markerquiz">
@markred(Erste)
@TextmarkerQuiz
</div>
**************
@Schatztruhe(markerquiz)
**************

Trennung.

<div class="markerquiz">
@markblue(Zweite)
@TextmarkerQuiz
</div>
**************
@Schatztruhe(markerquiz)
**************
`, [lootUrl]));
  const scopes = page.locator(".markerquiz");
  const portals = page.locator(
    '[data-loot-chest-portal][data-loot-chest-location="markerquiz"]',
  );
  const firstPortal = page.locator(
    '[data-loot-chest-portal$="-1:markerquiz"]',
  );
  const secondPortal = page.locator(
    '[data-loot-chest-portal$="-2:markerquiz"]',
  );

  await expect(scopes).toHaveCount(2);
  await expect(portals).toHaveCount(2);
  await expect(firstPortal).toBeHidden();
  await expect(secondPortal).toBeHidden();

  await scopes.nth(0).locator(".lia-quiz__resolve").click();
  await expect(scopes.nth(0).locator(".lia-quiz")).toHaveClass(/\bresolved\b/);
  await expect(firstPortal).toBeVisible();
  await expect(secondPortal).toBeHidden();

  await scopes.nth(1).locator(".lia-quiz__resolve").click();
  await expect(scopes.nth(1).locator(".lia-quiz")).toHaveClass(/\bresolved\b/);
  await expect(firstPortal).toBeVisible();
  await expect(secondPortal).toBeVisible();
  expect(errors).toEqual([]);
});

test("keeps identical solution Loot portals mapped across course sections", async ({ page }) => {
  const { errors } = await openSource(page, makeCourse(`
# Erste Sektion

<div class="markerquiz">
@markred(Erste)
@TextmarkerQuiz
</div>
**************
@Schatztruhe(markerquiz)
**************

# Zweite Sektion

<div class="markerquiz">
@markblue(Zweite)
@TextmarkerQuiz
</div>
**************
@Schatztruhe(markerquiz)
**************
`, [lootUrl]));
  const scopes = page.locator(".markerquiz");
  const firstPortal = page.locator(
    '[data-loot-chest-portal$="-1:markerquiz"]',
  );
  const secondPortal = page.locator(
    '[data-loot-chest-portal$="-2:markerquiz"]',
  );

  await expect(scopes).toHaveCount(1);
  await expect(scopes).toContainText("Erste");
  await expect(firstPortal).toHaveCount(1);
  await expect(firstPortal).toBeHidden();
  await expect(secondPortal).toHaveCount(0);

  await scopes.locator(".lia-quiz__resolve").click();
  await expect(firstPortal).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(scopes).toContainText("Zweite");
  await expect(firstPortal).toHaveCount(0);
  await expect(secondPortal).toHaveCount(1);
  await expect(secondPortal).toBeHidden();
  await scopes.locator(".lia-quiz__resolve").click();
  await expect(secondPortal).toBeVisible();

  await page.keyboard.press("ArrowLeft");
  await expect(scopes).toContainText("Erste");
  await expect(firstPortal).toHaveCount(1);
  await expect(firstPortal).toBeVisible();
  await expect(secondPortal).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("maps a shared weekly-task flex control to both solutions", async ({ page }) => {
  const { errors } = await openCourse(page, `
# Zwei Flex-Aufgaben

<section class="dynFlex">
<div class="flex-child">
<div class="markerquiz">
@markred(Erste)
@TextmarkerQuiz
</div>
**************
Erste Flex-Loesung
**************
</div>
<div class="flex-child">
<div class="markerquiz">
@markblue(Zweite)
@TextmarkerQuiz
</div>
**************
Zweite Flex-Loesung
**************
</div>
</section>
`);

  const first = page.getByText("Erste Flex-Loesung", { exact: true });
  const second = page.getByText("Zweite Flex-Loesung", { exact: true });
  const resolves = page.locator(".lia-quiz__resolve");

  await expect(page.locator(".markerquiz")).toHaveCount(2);
  await expect(page.locator(".hlq-resolution")).toHaveCount(2);
  await expect(resolves).toHaveCount(1);
  await expect(first).toBeHidden();
  await expect(second).toBeHidden();

  await markTarget(page, "red", "red", 1);
  await page.locator(".lia-quiz__check").click();
  await expect(first).toBeVisible();
  await expect(second).toBeHidden();
  await expect(page.locator(".lia-quiz")).toHaveClass(/\bopen\b/);

  await resolves.nth(0).click();
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await expect(page.locator(".lia-quiz")).toHaveClass(/\bresolved\b/);
  expect(errors).toEqual([]);
});

test("keeps all shared Check values through LiaScript rerenders", async ({ page }) => {
  const { errors } = await openCourse(page, `
# Zwei gemeinsam gepruefte Aufgaben

<section class="dynFlex">
<div class="flex-child">
<div class="markerquiz">
@markred(RotRichtig)
@TextmarkerQuiz
</div>
**************
Rote Musterloesung
**************
</div>
<div class="flex-child">
<div class="markerquiz">
@markblue(BlauRichtig)
@TextmarkerQuiz
</div>
**************
Blaue Musterloesung
**************
</div>
</section>
`);

  await markTarget(page, "red", "red", 1);
  await markTarget(page, "blue", "blue", 2);
  await page.locator(".lia-quiz__check").click();

  await expect(page.getByText("Rote Musterloesung", { exact: true })).toBeVisible();
  await expect(page.getByText("Blaue Musterloesung", { exact: true })).toBeVisible();
  await expect(page.locator(".lia-quiz")).toHaveClass(/\bsolved\b/);
  const inputs = page.locator(".markerquiz .hlq-proxy input");
  await expect(inputs).toHaveCount(2);
  await expect(inputs.nth(0)).toHaveValue("1");
  await expect(inputs.nth(1)).toHaveValue("1");
  expect(errors).toEqual([]);
});

test("keeps unrelated native quiz controls isolated", async ({ page }) => {
  const { errors } = await openCourse(page, `
# Standardquiz und Markerquiz

Ein unabhaengiges Standardquiz:

[[1]]

Ein trennender Absatz zwischen den Aufgaben.

<section class="dynFlex">
<div class="flex-child">
<div class="markerquiz">
@markpurple(ErsteIsolierte)
@TextmarkerQuiz
</div>
**************
Erste isolierte Markerloesung
**************
</div>
<div class="flex-child">
<div class="markerquiz">
@markorange(ZweiteIsolierte)
@TextmarkerQuiz
</div>
**************
Zweite isolierte Markerloesung
**************
</div>
</section>

Noch ein unabhaengiges Standardquiz:

[[2]]
`);

  const quizzes = page.locator(".lia-quiz");
  const first = page.getByText("Erste isolierte Markerloesung", { exact: true });
  const second = page.getByText("Zweite isolierte Markerloesung", { exact: true });

  await expect(quizzes).toHaveCount(3);
  await expect(first).toBeHidden();
  await expect(second).toBeHidden();
  await quizzes.nth(0).locator(".lia-quiz__resolve").click();
  await expect(first).toBeHidden();
  await expect(second).toBeHidden();
  await quizzes.nth(2).locator(".lia-quiz__resolve").click();
  await expect(first).toBeHidden();
  await expect(second).toBeHidden();
  await quizzes.nth(1).locator(".lia-quiz__resolve").click();
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  expect(errors).toEqual([]);
});

test("does not treat collapsed Markdown emphasis as a solution", async ({ page }) => {
  const { errors } = await openCourse(page, `
# Kein Musterloesungsblock

<div class="flex-child">
<div class="markerquiz">
@markorange(Normal)
@TextmarkerQuiz
</div>
***wichtiger Hinweis***
</div>
`);

  await expect(page.locator(".hlq-resolution")).toHaveCount(0);
  await expect(page.getByText("wichtiger Hinweis", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("keeps the native inside-div solution behavior", async ({ page }) => {
  const { errors } = await openCourse(page, `
# Native Musterlösung

<div class="markerquiz">
@markgreen(Nativ)
@TextmarkerQuiz
**************
Native Lösung sichtbar
**************
</div>
`);

  const scope = page.locator(".markerquiz");
  const solution = page.getByText("Native Lösung sichtbar", { exact: true });
  await expect(page.locator(".hlq-resolution")).toHaveCount(0);
  await expect(solution).toHaveCount(0);

  await scope.locator(".lia-quiz__resolve").click();
  await expect(solution).toBeVisible();
  await expect(scope.locator(".lia-quiz__solution")).toBeVisible();
  await expect(page.locator(".hlq-resolution")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("keeps two rendered exterior solutions scoped to their own quiz", async ({ page }) => {
  const onlineFixture = fixtureSource.replace(
    "import: ../../README.md",
    `import: ${readmeUrl}`,
  );
  const { errors } = await openSource(page, onlineFixture);

  const scopes = page.locator(".markerquiz");
  const resolutions = page.locator(".hlq-resolution");
  const firstSolution = page.getByText("Musterlösungstext", { exact: true });
  const secondSolution = page.getByText("Dynamische Farblösung sichtbar", { exact: true });

  await expect(scopes).toHaveCount(2);
  // LiaScript currently consumes a second exterior block in the same section.
  // Recreate the sibling DOM shape it emits for the first block to cover
  // dynamic binding and cross-quiz isolation independently of that parser limit.
  await scopes.nth(1).evaluate((scope) => {
    const opening = document.createElement("p");
    opening.className = "lia-problem";
    opening.textContent = "**************";
    const content = document.createElement("p");
    content.id = "authored-solution-anchor";
    content.textContent = "Dynamische Farblösung sichtbar";
    const closing = document.createElement("p");
    closing.className = "lia-problem";
    closing.textContent = "**************";
    scope.after(opening, content, closing);
  });

  await expect(resolutions).toHaveCount(2);
  await expect(page.locator(".hlq-resolution__delimiter")).toHaveCount(4);
  await expect(firstSolution).toHaveCount(1);
  await expect(secondSolution).toHaveCount(1);
  await expect(firstSolution).toBeHidden();
  await expect(secondSolution).toBeHidden();
  await expect(secondSolution).toHaveAttribute("id", "authored-solution-anchor");

  const lateSvg = page.getByTestId("late-solution-svg");
  await page.locator(".hlq-resolution__delimiter").last().evaluate((closing) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("data-testid", "late-solution-svg");
    svg.setAttribute("width", "120");
    svg.setAttribute("height", "30");
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "0");
    text.setAttribute("y", "20");
    text.textContent = "Nachgeladene Lösung";
    svg.append(text);
    closing.before(svg);
  });
  await expect(resolutions).toHaveCount(3);
  await expect(lateSvg).toBeHidden();
  await expect(lateSvg).toHaveAttribute("hidden", "");

  await scopes.nth(0).locator(".lia-quiz__resolve").click();
  await expect(firstSolution).toBeVisible();
  await expect(secondSolution).toBeHidden();
  await expect(lateSvg).toBeHidden();

  const firstResolutionId = await firstSolution.getAttribute("id");
  const secondResolutionId = await secondSolution.getAttribute("id");
  const lateResolutionId = await lateSvg.getAttribute("id");
  expect(firstResolutionId).toBeTruthy();
  expect(secondResolutionId).toBeTruthy();
  expect(lateResolutionId).toBeTruthy();
  const firstResolve = scopes.nth(0).locator(".lia-quiz__resolve");
  const secondResolve = scopes.nth(1).locator(".lia-quiz__resolve");
  expect((await firstResolve.getAttribute("aria-controls"))?.split(/\s+/)).toContain(
    firstResolutionId,
  );
  expect((await secondResolve.getAttribute("aria-controls"))?.split(/\s+/)).toContain(
    secondResolutionId,
  );
  expect((await secondResolve.getAttribute("aria-controls"))?.split(/\s+/)).toContain(
    lateResolutionId,
  );
  await expect(scopes.nth(0).locator(".lia-quiz__resolve")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(secondResolve).toHaveAttribute("aria-expanded", "false");
  await secondResolve.click();
  await expect(firstSolution).toBeVisible();
  await expect(secondSolution).toBeVisible();
  await expect(lateSvg).toBeVisible();

  await scopes.nth(1).evaluate((scope) => scope.remove());
  await expect(scopes).toHaveCount(1);
  await expect(page.locator(".hlq-resolution__delimiter")).toHaveCount(2);
  await expect(secondSolution).not.toHaveClass(/\bhlq-resolution\b/);
  await expect(secondSolution).toHaveAttribute("id", "authored-solution-anchor");
  await expect.poll(() => lateSvg.getAttribute("id")).toBeNull();
  expect(errors).toEqual([]);
});

test("keeps a revealed exterior solution after slide navigation", async ({ page }) => {
  const { errors } = await openCourse(page, `
# Wiederherstellung

<div class="markerquiz">
@markorange(Bleibt)
@TextmarkerQuiz
</div>
**************
Bleibt nach Navigation sichtbar
**************

## Andere Seite

Navigationstest
`);

  const solution = page.getByText("Bleibt nach Navigation sichtbar", { exact: true });
  await page.locator(".markerquiz .lia-quiz__resolve").click();
  await expect(solution).toBeVisible();

  await page.getByRole("button", { name: "weiter", exact: true }).click();
  await expect(page.getByText("Navigationstest", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "zurück", exact: true }).click();
  await expect(page.locator(".markerquiz")).toBeVisible();
  await expect(solution).toBeVisible();
  expect(errors).toEqual([]);
});

test("reveals the solution after a correct check with every color", async ({ page }) => {
  const { errors } = await openCourse(page, `
# Alle Markerfarben

<div class="markerquiz">
@markred(Rot) @markblue(Blau) @markgreen(Grün)
@markyellow(Gelb) @markpink(Pink) @markorange(Orange) @mark(Frei)
@TextmarkerQuiz
</div>
**************
Farblösung sichtbar
**************
`);

  const scope = page.locator(".markerquiz");
  const solution = page.getByText("Farblösung sichtbar", { exact: true });
  await expect(solution).toBeHidden();

  const markings = [
    ["red", "red"],
    ["blue", "blue"],
    ["green", "green"],
    ["yellow", "yellow"],
    ["pink", "pink"],
    ["orange", "orange"],
    ["any", "yellow"],
  ];

  for (let index = 0; index < markings.length; index += 1) {
    const [expected, actual] = markings[index];
    await markTarget(page, expected, actual, index + 1);
  }

  await scope.locator(".lia-quiz__check").click();
  await expect(scope.locator(".lia-quiz")).toHaveClass(/\bsolved\b/);
  await expect(page.locator(".hlq-resolution")).toHaveAttribute("data-hlq-state", "visible");
  await expect(solution).toBeVisible();

  const colors = await page.evaluate(() => {
    const registry = window.__LIA_TEXTMARKER_REG_V4__;
    const instance = Object.values(registry.instances || {}).find((item) => item.__alive);
    return instance?.HL
      .filter((item) => item.kind === "user")
      .map((item) => item.color)
      .sort() || [];
  });
  expect(colors).toEqual(["blue", "green", "orange", "pink", "red", "yellow", "yellow"]);
  expect(errors).toEqual([]);
});
