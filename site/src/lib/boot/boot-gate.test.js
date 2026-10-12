// SPDX-License-Identifier: AGPL-3.0-only
//
// The gate in app.html that starts the app after the first paint. It runs here
// from the app.html source, against the few globals it touches, with a clock
// the test moves by hand.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { BOOT_TYPE, PRELOADS_ID } from './defer-boot.js';

const APP_HTML = readFileSync(new URL('../../app.html', import.meta.url), 'utf8');
const gates = [...APP_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.includes('script[type="'));

test('app.html has one gate, and it opens what defer-boot.js closes', () => {
  expect(gates).toHaveLength(1);
  expect(gates[0]).toContain(`document.querySelector('script[type="${BOOT_TYPE}"]')`);
  expect(gates[0]).toContain(`document.getElementById('${PRELOADS_ID}')`);
});

/**
 * @param {{ readyState?: string, parsed?: boolean, paintTiming?: boolean, sw?: boolean }} [o]
 */
function load({ readyState = 'interactive', parsed = true, paintTiming = true, sw = true } = {}) {
  let now = 0;
  /** @type {{ at: number, fn: () => void }[]} */
  let timers = [];
  /** @type {(() => void)[]} */
  let frames = [];
  /** @type {Record<string, Set<Function>>} */
  const listeners = {};
  /** @type {((list: any, observer: any) => void) | null} */
  let paintObserver = null;
  const log = [];

  const preloads = { content: { preloads: 3 } };
  const boot = { textContent: 'BOOT SOURCE', parentNode: null };
  const parent = {
    replaceChild(next, old) {
      log.push(['replace', next.textContent, old === boot]);
    },
  };
  boot.parentNode = parent;

  const document = {
    readyState,
    head: { appendChild: (node) => log.push(['head', node]) },
    querySelector: (sel) => (sel === `script[type="${BOOT_TYPE}"]` && parsed ? boot : null),
    getElementById: (id) => (id === PRELOADS_ID && parsed ? preloads : null),
    createElement: (tag) => ({ tag, textContent: '' }),
  };
  const navigator = sw ? { serviceWorker: { register: (url) => log.push(['sw', url]) } } : {};
  function PerformanceObserver(cb) {
    if (!paintTiming) throw new Error('unsupported');
    paintObserver = cb;
    this.observe = () => {};
    this.disconnect = () => {};
  }
  const addEventListener = (type, fn) => (listeners[type] ??= new Set()).add(fn);
  const removeEventListener = (type, fn) => listeners[type]?.delete(fn);
  const setTimeout = (fn, ms) => timers.push({ at: now + ms, fn });
  const requestAnimationFrame = (fn) => frames.push(fn);

  new Function(
    'document',
    'navigator',
    'PerformanceObserver',
    'addEventListener',
    'removeEventListener',
    'setTimeout',
    'requestAnimationFrame',
    gates[0]
  )(document, navigator, PerformanceObserver, addEventListener, removeEventListener, setTimeout, requestAnimationFrame);

  const api = {
    log,
    started: () => log.some((e) => e[0] === 'replace'),
    /** Advance the clock, running due timers in order, and paint a frame every 16 ms. */
    advance(ms) {
      const end = now + ms;
      while (true) {
        const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
        const frame = frames.length ? Math.min(end, now + 16) : Infinity;
        if (due && due.at <= frame) {
          now = due.at;
          timers = timers.filter((t) => t !== due);
          due.fn();
        } else if (frame <= end) {
          now = frame;
          const run = frames;
          frames = [];
          run.forEach((f) => f());
        } else break;
      }
      now = end;
      return api;
    },
    paint() {
      paintObserver?.({ getEntriesByName: (n) => (n === 'first-contentful-paint' ? [{}] : []) }, { disconnect() {} });
      return api;
    },
    fire(type) {
      [...(listeners[type] ?? [])].forEach((fn) => fn());
      return api;
    },
    parse() {
      parsed = true;
      return api;
    },
    listening: (type) => listeners[type]?.size ?? 0,
  };
  return api;
}

test('nothing starts at load until the page has painted, then it starts on the next frame', () => {
  const page = load();
  page.fire('load').advance(900);
  expect(page.started()).toBe(false);
  page.paint().advance(40);
  expect(page.started()).toBe(true);
});

test('nothing starts at paint until load, so a large image is on screen first', () => {
  const page = load();
  page.paint().advance(500);
  expect(page.started()).toBe(false);
  page.fire('load').advance(40);
  expect(page.started()).toBe(true);
});

test('a page that had loaded before the gate ran starts as soon as it paints', () => {
  const page = load({ readyState: 'complete' });
  page.advance(100);
  expect(page.started()).toBe(false);
  page.paint().advance(40);
  expect(page.started()).toBe(true);
});

test('a slow load holds the app back for at most a second after the paint', () => {
  const page = load();
  page.paint().advance(990);
  expect(page.started()).toBe(false);
  page.advance(60);
  expect(page.started()).toBe(true);
});

test('a tap, a key or focus before the paint starts the app at once', () => {
  for (const cue of ['pointerdown', 'keydown', 'touchstart', 'focusin']) {
    const page = load();
    page.fire(cue);
    expect(page.started()).toBe(true);
  }
});

test('with no paint and no load, the app still starts at five seconds', () => {
  const page = load();
  page.advance(4990);
  expect(page.started()).toBe(false);
  page.advance(20);
  expect(page.started()).toBe(true);
});

test('a browser without paint timing starts after load as if it had painted', () => {
  const page = load({ paintTiming: false });
  page.fire('load').advance(40);
  expect(page.started()).toBe(true);
});

test('starting puts the preloads in the head first, then runs a copy of the boot script in its place', () => {
  const page = load();
  page.fire('keydown');
  expect(page.log).toEqual([
    ['head', { preloads: 3 }],
    ['replace', 'BOOT SOURCE', true],
    ['sw', '/service-worker.js'],
  ]);
});

test('the app starts once, however many cues arrive, and the cue listeners are removed', () => {
  const page = load();
  page.fire('pointerdown').fire('keydown').paint().fire('load').advance(6000);
  expect(page.log.filter((e) => e[0] === 'replace')).toHaveLength(1);
  for (const cue of ['pointerdown', 'keydown', 'touchstart', 'focusin']) expect(page.listening(cue)).toBe(0);
});

test('a cue that arrives before the boot script is parsed does not use up the start', () => {
  const page = load({ parsed: false });
  page.fire('pointerdown');
  expect(page.started()).toBe(false);
  page.parse().paint().fire('load').advance(40);
  expect(page.started()).toBe(true);
});

test('a browser without service workers starts the app and registers nothing', () => {
  const page = load({ sw: false });
  page.fire('keydown');
  expect(page.started()).toBe(true);
  expect(page.log.some((e) => e[0] === 'sw')).toBe(false);
});
