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
const weeklyTaskImports = [
  "https://raw.githubusercontent.com/MINT-the-GAP/lia-DynFlex/refs/heads/main/README.md",
  "https://raw.githubusercontent.com/MINT-the-GAP/lia-timer/refs/heads/main/README.md",
];

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

function courseUrl(body) {
  return sourceUrl(makeCourse(body));
}

function sourceUrl(sourceText) {
  const source = `data:text/plain;charset=utf-8,${encodeURIComponent(sourceText)}`;
  return `https://liascript.github.io/course/?${source}`;
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
