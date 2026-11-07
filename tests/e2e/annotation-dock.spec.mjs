import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const bundleSource = readFileSync(
  new URL('../../dist/index.js', import.meta.url),
  'utf8',
);

function fixture({ board = false } = {}) {
  return '<!doctype html><html><head>' +
    '<meta name=viewport content=width=device-width,initial-scale=1>' +
    '<style>html,body{margin:0;font:18px Arial,sans-serif}' +
    'main{margin:160px 40px 0;min-height:1200px}' +
    '.lia-header__left{position:fixed;left:80px;top:60px;display:flex}' +
    '#lia-btn-toc{box-sizing:border-box;flex:none;width:40px;height:40px;padding:0}' +
    '#lia-tff-inline-slot-v2{box-sizing:border-box;position:relative;width:46px;height:40px;flex:none}' +
    '#lia-tff-btn-v2{position:absolute;left:6px;top:3px;width:34px;height:34px;padding:0}' +
    '</style></head><body>' +
    '<div class=\'lia-canvas lia-mode--presentation\'>' +
    '<header id=lia-toolbar-nav><div class=lia-header__left>' +
    '<button id=lia-btn-toc aria-label=\'Table of contents\'>TOC</button>' +
    (board
      ? '<div id=lia-tff-inline-slot-v2><button id=lia-tff-btn-v2>Board</button></div>'
      : '') +
    '</div></header><main><p id=course-text>Course text for marker integration.</p></main>' +
    '</div></body></html>';
}

async function settle(pageOrFrame, count = 5) {
  await pageOrFrame.evaluate(async frameCount => {
    for (let i = 0; i < frameCount; i++) {
      await new Promise(requestAnimationFrame);
    }
  }, count);
}

async function prepareFixture(page, options = {}) {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.setContent(fixture(options));
}

async function loadMarker(pageOrFrame, source = bundleSource) {
  await pageOrFrame.addScriptTag({ content: source });
  await expect(pageOrFrame.locator('#lia-hl-btn')).toBeVisible();
  await settle(pageOrFrame);
}

async function installAnnotationDouble(pageOrFrame, options = {}) {
  await pageOrFrame.evaluate(({ accept = true, incomplete = false } = {}) => {
    if (incomplete) {
      window.__LIA_ANNOTATION__ = {
        registerToolbarControl() { return false; },
      };
      return;
    }

    let acceptsRegistration = accept;
    let toolbar;
    let host;
    const registry = new Map();
    const calls = [];
    const unregisterCalls = [];

    function createToolbar() {
      const nextToolbar = document.createElement('aside');
      nextToolbar.className = 'lia-annot-toolbar';
      Object.assign(nextToolbar.style, {
        position: 'fixed',
        right: '12px',
        top: '80px',
        zIndex: '8990',
        width: '44px',
        padding: '6px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'rgb(245,245,245)',
      });
      const nextHost = document.createElement('div');
      nextHost.className = 'lia-annot-external-actions';
      Object.assign(nextHost.style, {
        width: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
      });
      nextToolbar.append(nextHost);
      document.body.append(nextToolbar);
      return { toolbar: nextToolbar, host: nextHost };
    }

    function placeAll() {
      const entries = Array.from(registry.entries()).sort((a, b) =>
        a[1].order - b[1].order || a[0].localeCompare(b[0])
      );
      for (const [, entry] of entries) host.append(entry.element);
    }

    function unregisterToolbarControl(id) {
      unregisterCalls.push(id);
      const entry = registry.get(id);
      if (!entry) return false;
      registry.delete(id);
      entry.element.classList.remove('lia-annot-external-control');
      entry.element.removeAttribute('data-lia-annotation-control');
      entry.element.removeAttribute('data-lia-annotation-hosted');
      if (entry.placeholder.parentNode) {
        entry.placeholder.parentNode.insertBefore(
          entry.element,
          entry.placeholder,
        );
      } else {
        document.body.append(entry.element);
      }
      entry.placeholder.remove();
      return true;
    }

    const created = createToolbar();
    toolbar = created.toolbar;
    host = created.host;

    const api = {
      registerToolbarControl(id, element, options = {}) {
        calls.push({ id, element, order: options.order });
        if (!acceptsRegistration) return false;
        const existing = registry.get(id);
        const order = Number.isFinite(options.order) ? options.order : 0;
        if (existing?.element === element && existing.order === order &&
            element.parentElement === host) {
          return true;
        }
        if (existing) unregisterToolbarControl(id);

        const placeholder = document.createComment(
          'lia-annotation-control:' + id,
        );
        if (element.parentNode) {
          element.parentNode.insertBefore(placeholder, element);
        } else {
          document.body.append(placeholder);
        }
        registry.set(id, { element, order, placeholder });
        element.classList.add('lia-annot-external-control');
        element.setAttribute('data-lia-annotation-control', id);
        element.setAttribute('data-lia-annotation-hosted', 'true');
        placeAll();
        return true;
      },
      unregisterToolbarControl,
      hasToolbarControl(id) {
        return registry.has(id);
      },
    };

    window.__annotationDouble = {
      api,
      calls,
      unregisterCalls,
      get toolbar() { return toolbar; },
      get host() { return host; },
      registrySize() { return registry.size; },
      setAccept(value) { acceptsRegistration = value; },
      dispatchReady() {
        window.dispatchEvent(new CustomEvent(
          'lia-annotation-toolbar-ready',
          { detail: api },
        ));
      },
      setToolbarPosition(values) {
        Object.assign(toolbar.style, values);
      },
      rebuildToolbar() {
        const previous = toolbar;
        const replacement = createToolbar();
        toolbar = replacement.toolbar;
        host = replacement.host;
        placeAll();
        previous.remove();
      },
    };
    window.__LIA_ANNOTATION__ = api;
  }, options);
}

async function expectPanelAnchoredToButton(page) {
  const geometry = await page.evaluate(() => {
    const button = document.getElementById('lia-hl-btn').getBoundingClientRect();
    const panel = document.getElementById('lia-hl-panel').getBoundingClientRect();
    return {
      button: button.toJSON(),
      panel: panel.toJSON(),
      width: visualViewport?.width || document.documentElement.clientWidth,
      height: visualViewport?.height || document.documentElement.clientHeight,
      left: visualViewport?.offsetLeft || 0,
      top: visualViewport?.offsetTop || 0,
    };
  });
  const { button, panel, width, height, left, top } = geometry;
  expect(panel.left).toBeGreaterThanOrEqual(left + 7);
  expect(panel.right).toBeLessThanOrEqual(left + width - 7);
  expect(panel.top).toBeGreaterThanOrEqual(top + 7);
  expect(panel.bottom).toBeLessThanOrEqual(top + height - 7);

  const expectedLeft = Math.max(
    left + 8,
    Math.min(button.left, left + width - panel.width - 8),
  );
  let expectedTop = button.bottom + 10;
  if (expectedTop + panel.height + 8 > top + height) {
    expectedTop = button.top - 10 - panel.height;
  }
  expectedTop = Math.max(
    top + 8,
    Math.min(expectedTop, top + height - panel.height - 8),
  );
  expect(Math.abs(panel.left - expectedLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(panel.top - expectedTop)).toBeLessThanOrEqual(1);
}

function isolatedBundle(source, suffix) {
  const match = source.match(/\bparcelRequire[A-Za-z0-9_$]+\b/);
  if (!match) throw new Error('Parcel runtime name not found');
  return source.split(match[0]).join(match[0] + suffix);
}

test('annotation before marker hosts the original control and preserves interaction', async ({ page }) => {
  await prepareFixture(page, { board: true });
  await installAnnotationDouble(page);
  await loadMarker(page);

  const details = await page.evaluate(() => {
    const double = window.__annotationDouble;
    const button = document.getElementById('lia-hl-btn');
    double.toolbar.classList.add('lia-annot-readonly');
    double.setToolbarPosition({
      top: '',
      right: '8px',
      bottom: '8px',
    });
    document.body.classList.add('lia-hl-navstack');
    const style = getComputedStyle(button);
    const iconStyle = getComputedStyle(button.querySelector('.icon'));
    const dotStyle = getComputedStyle(button.querySelector('.dot'));
    return {
      callCount: double.calls.length,
      id: double.calls[0]?.id,
      order: double.calls[0]?.order,
      sameElement: double.calls[0]?.element === button,
      count: document.querySelectorAll('#lia-hl-btn').length,
      hosted: button.dataset.liaAnnotationHosted,
      parentIsHost: button.parentElement === double.host,
      panelInToolbar: !!document.getElementById('lia-hl-panel')
        .closest('.lia-annot-toolbar'),
      width: button.getBoundingClientRect().width,
      height: button.getBoundingClientRect().height,
      position: style.position,
      iconWidth: parseFloat(iconStyle.width),
      iconHeight: parseFloat(iconStyle.height),
      dotWidth: parseFloat(dotStyle.width),
      disabled: button.disabled,
      left: button.getBoundingClientRect().left,
    };
  });

  expect(details).toMatchObject({
    callCount: 1,
    id: 'lia-marker',
    order: 100,
    sameElement: true,
    count: 1,
    hosted: 'true',
    parentIsHost: true,
    panelInToolbar: false,
    width: 32,
    height: 32,
    position: 'relative',
    iconWidth: 18,
    iconHeight: 18,
    dotWidth: 7,
    disabled: false,
  });

  await page.evaluate(() => {
    Object.assign(document.getElementById('lia-tff-btn-v2').style, {
      position: 'fixed',
      left: '760px',
      top: '420px',
    });
    window.dispatchEvent(new Event('resize'));
  });
  await settle(page);
  const afterBoardMove = await page.locator('#lia-hl-btn').evaluate(
    element => element.getBoundingClientRect().left,
  );
  expect(Math.abs(afterBoardMove - details.left)).toBeLessThanOrEqual(1);

  const button = page.locator('#lia-hl-btn');
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.locator('#lia-hl-panel')).toBeVisible();
  await settle(page);
  await expectPanelAnchoredToButton(page);
  expect(await button.evaluate(element => getComputedStyle(element).boxShadow))
    .not.toBe('none');
  await page.keyboard.press('Escape');
  await expect(page.locator('#lia-hl-panel')).toBeHidden();

  await page.waitForTimeout(280);
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#lia-hl-panel')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.waitForTimeout(280);
  await button.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#lia-hl-panel')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('marker before annotation moves the same element once and survives toolbar rebuilds', async ({ page }) => {
  await prepareFixture(page);
  await loadMarker(page);
  const standalone = await page.evaluate(() => {
    const button = document.getElementById('lia-hl-btn');
    window.__originalMarkerButton = button;
    const style = getComputedStyle(button);
    return {
      parent: button.parentElement?.id,
      width: button.getBoundingClientRect().width,
      position: style.position,
    };
  });
  expect(standalone).toEqual({
    parent: 'lia-hl-ui-overlay-v1',
    width: 40,
    position: 'absolute',
  });

  await installAnnotationDouble(page);
  await page.evaluate(() => window.__annotationDouble.dispatchReady());
  await settle(page);
  await page.evaluate(() => {
    window.__hostedButtonMutations = 0;
    const button = document.getElementById('lia-hl-btn');
    const observer = new MutationObserver(records => {
      window.__hostedButtonMutations += records.length;
    });
    observer.observe(button, { attributes: true });
    window.__hostedButtonObserver = observer;
  });

  await page.evaluate(() => {
    const double = window.__annotationDouble;
    for (let i = 0; i < 5; i++) double.dispatchReady();
    double.rebuildToolbar();
    double.setToolbarPosition({ top: '210px' });
    const peer = document.createElement('button');
    peer.id = 'lia-tff-btn-v2';
    document.body.append(peer);
    const paragraph = document.createElement('p');
    paragraph.textContent = 'A content mutation forces a normal marker tick.';
    document.querySelector('main').append(paragraph);
  });
  await settle(page, 8);

  const result = await page.evaluate(() => {
    window.__hostedButtonObserver.disconnect();
    const button = document.getElementById('lia-hl-btn');
    return {
      sameElement: button === window.__originalMarkerButton,
      callCount: window.__annotationDouble.calls.length,
      parentIsRebuiltHost: button.parentElement === window.__annotationDouble.host,
      count: document.querySelectorAll('#lia-hl-btn').length,
      width: button.getBoundingClientRect().width,
      mutations: window.__hostedButtonMutations,
      panelStyle: document.getElementById('lia-hl-panel').getAttribute('style'),
    };
  });
  expect(result).toMatchObject({
    sameElement: true,
    callCount: 1,
    parentIsRebuiltHost: true,
    count: 1,
    width: 32,
    mutations: 0,
    panelStyle: null,
  });
});

test('an incomplete annotation API leaves the board-aware standalone dock intact', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await prepareFixture(page, { board: true });
  await installAnnotationDouble(page, { incomplete: true });
  await loadMarker(page);

  const result = await page.evaluate(() => {
    const button = document.getElementById('lia-hl-btn');
    const toc = document.getElementById('lia-btn-toc').getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    return {
      parent: button.parentElement?.id,
      hosted: button.hasAttribute('data-lia-annotation-hosted'),
      width: rect.width,
      position: getComputedStyle(button).position,
      left: rect.left,
      expectedLeft: toc.right + 8 + 46,
    };
  });
  expect(result.parent).toBe('lia-hl-ui-overlay-v1');
  expect(result.hosted).toBe(false);
  expect(result.width).toBe(40);
  expect(result.position).toBe('absolute');
  expect(Math.abs(result.left - result.expectedLeft)).toBeLessThanOrEqual(1);
  expect(pageErrors).toEqual([]);
});

test('a rejected registration stays standalone until a new ready signal permits retry', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await prepareFixture(page);
  await installAnnotationDouble(page, { accept: false });
  await loadMarker(page);

  await page.evaluate(() => {
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Trigger another ordinary marker tick.';
    document.querySelector('main').append(paragraph);
  });
  await settle(page, 7);
  let state = await page.evaluate(() => ({
    calls: window.__annotationDouble.calls.length,
    parent: document.getElementById('lia-hl-btn').parentElement?.id,
    hosted: document.getElementById('lia-hl-btn')
      .hasAttribute('data-lia-annotation-hosted'),
  }));
  expect(state).toEqual({
    calls: 1,
    parent: 'lia-hl-ui-overlay-v1',
    hosted: false,
  });

  await page.evaluate(() => {
    window.__annotationDouble.setAccept(true);
    window.__annotationDouble.dispatchReady();
  });
  await settle(page);
  state = await page.evaluate(() => ({
    calls: window.__annotationDouble.calls.length,
    parentIsHost: document.getElementById('lia-hl-btn').parentElement ===
      window.__annotationDouble.host,
    hosted: document.getElementById('lia-hl-btn').dataset.liaAnnotationHosted,
  }));
  expect(state).toEqual({
    calls: 2,
    parentIsHost: true,
    hosted: 'true',
  });
  expect(pageErrors).toEqual([]);
});

test('bundle reload cleans up the old registration without removing the new one', async ({ page }) => {
  await prepareFixture(page);
  await installAnnotationDouble(page);
  await loadMarker(page);
  await page.evaluate(() => {
    window.__firstMarkerButton = document.getElementById('lia-hl-btn');
    const instance = Object.values(
      window.__LIA_TEXTMARKER_REG_V4__.instances,
    )[0];
    window.__oldAnnotationCleanup = instance.__cleanupAnnotationDock;
  });

  await page.addScriptTag({
    content: isolatedBundle(bundleSource, 'AnnotationReload'),
  });
  await settle(page, 8);
  await page.evaluate(() => {
    window.__oldAnnotationCleanup();
    window.__annotationDouble.dispatchReady();
  });
  await settle(page);

  const result = await page.evaluate(() => {
    const button = document.getElementById('lia-hl-btn');
    return {
      sameElement: button === window.__firstMarkerButton,
      buttonCount: document.querySelectorAll('#lia-hl-btn').length,
      panelCount: document.querySelectorAll('#lia-hl-panel').length,
      registerCalls: window.__annotationDouble.calls.length,
      unregisterCalls: window.__annotationDouble.unregisterCalls.length,
      registrySize: window.__annotationDouble.registrySize(),
      parentIsHost: button.parentElement === window.__annotationDouble.host,
    };
  });
  expect(result).toEqual({
    sameElement: true,
    buttonCount: 1,
    panelCount: 1,
    registerCalls: 2,
    unregisterCalls: 1,
    registrySize: 1,
    parentIsHost: true,
  });

  await page.locator('#lia-hl-btn').click();
  await expect(page.locator('#lia-hl-panel')).toBeVisible();
});

test('an iframe marker prefers the safe root window annotation API', async ({ page }) => {
  await prepareFixture(page);
  await installAnnotationDouble(page);
  await page.evaluate(async () => {
    const frame = document.createElement('iframe');
    frame.id = 'marker-content-frame';
    frame.srcdoc = '<!doctype html><html><body><main>Frame content</main></body></html>';
    document.body.append(frame);
    await new Promise(resolve => {
      if (frame.contentDocument?.readyState === 'complete') resolve();
      else frame.addEventListener('load', resolve, { once: true });
    });
  });
  const contentFrame = page.frames().find(frame => frame !== page.mainFrame());
  expect(contentFrame).toBeTruthy();
  await contentFrame.addScriptTag({ content: bundleSource });
  await expect(page.locator('#lia-hl-btn')).toBeVisible();
  await settle(page);

  const rootResult = await page.evaluate(() => {
    const button = document.getElementById('lia-hl-btn');
    return {
      callCount: window.__annotationDouble.calls.length,
      sameElement: window.__annotationDouble.calls[0]?.element === button,
      parentIsHost: button.parentElement === window.__annotationDouble.host,
      hosted: button.dataset.liaAnnotationHosted,
    };
  });
  expect(rootResult).toEqual({
    callCount: 1,
    sameElement: true,
    parentIsHost: true,
    hosted: 'true',
  });
  await expect(contentFrame.locator('#lia-hl-btn')).toHaveCount(0);
});
