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

function makeCourse(body) {
  return `<!--
version: 1.0.0
language: de
import: ${readmeUrl}
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

async function openCourse(page, body, options) {
  return openSource(page, makeCourse(body), options);
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
