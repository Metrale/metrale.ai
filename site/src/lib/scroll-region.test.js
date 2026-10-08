// SPDX-License-Identifier: AGPL-3.0-only
//
// web-shared/scroll-region.js keeps a sideways-scrolling box focusable and
// named only while it scrolls (axe scrollable-region-focusable, and no empty
// Tab stops or landmarks when it does not). The node is a stand-in with the
// two widths and an attribute map; ResizeObserver and document.fonts are
// stand-ins too, so a resize and a late font can be driven by hand. That is
// the whole of the action's input: no layout engine is involved.
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { scrollRegion } from '../../../web-shared/scroll-region.js';

let observers;
let fontListeners;
let saved;
let frames;
let windowListeners;
beforeEach(() => {
  saved = {
    ResizeObserver: globalThis.ResizeObserver,
    document: globalThis.document,
    window: globalThis.window,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  observers = [];
  fontListeners = [];
  frames = new Map();
  windowListeners = [];
  let next = 1;
  globalThis.requestAnimationFrame = (fn) => {
    frames.set(next, fn);
    return next++;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  globalThis.window = {
    addEventListener: (type, fn) => type === 'resize' && windowListeners.push(fn),
    removeEventListener: (type, fn) => (windowListeners = windowListeners.filter((f) => f !== fn)),
  };
  globalThis.ResizeObserver = class {
    constructor(cb) {
      this.cb = cb;
      this.connected = false;
      observers.push(this);
    }
    observe() {
      this.connected = true;
    }
    disconnect() {
      this.connected = false;
    }
  };
  globalThis.document = {
    fonts: {
      ready: Promise.resolve(),
      addEventListener: (type, fn) => fontListeners.push(fn),
      removeEventListener: (type, fn) => (fontListeners = fontListeners.filter((f) => f !== fn)),
    },
  };
});
// Put back whatever the preload installed: other suites share these globals.
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) globalThis[k] = v;
});
// Run the frame callbacks queued so far, as the browser does on the next frame.
const nextFrame = () => {
  const due = [...frames.values()];
  frames.clear();
  for (const fn of due) fn();
};

// What the server renders: the focusable form, right with scripts off.
const box = (scrollWidth, clientWidth, attrs = { tabindex: '0', role: 'region', 'aria-label': 'Command to run X' }) => {
  const a = new Map(Object.entries(attrs));
  return {
    scrollWidth,
    clientWidth,
    setAttribute: (k, v) => a.set(k, String(v)),
    removeAttribute: (k) => a.delete(k),
    attrs: () => Object.fromEntries(a),
  };
};

test('a box that overflows stays a named, focusable region', () => {
  const node = box(900, 300);
  scrollRegion(node, { label: 'Command to run X' });
  expect(node.attrs()).toEqual({ tabindex: '0', role: 'region', 'aria-label': 'Command to run X' });
});

test('a box that fits is neither a Tab stop nor a landmark', () => {
  const node = box(300, 300);
  scrollRegion(node, { label: 'Command to run X' });
  expect(node.attrs()).toEqual({});
});

test('a resize and a late font are measured again, both ways', () => {
  const node = box(300, 300);
  scrollRegion(node, { label: 'Command to run X' });
  expect(node.attrs()).toEqual({});
  node.clientWidth = 200; // the viewport narrowed
  observers[0].cb();
  expect(node.attrs()).toEqual({ tabindex: '0', role: 'region', 'aria-label': 'Command to run X' });
  node.scrollWidth = 180; // the web font set it narrower
  for (const f of fontListeners) f();
  expect(node.attrs()).toEqual({});
});

test('a scroll width that settles after the resize is caught on the next frame (WebKit)', () => {
  const node = box(300, 300);
  scrollRegion(node, { label: 'Command to run X' });
  node.clientWidth = 200; // the box narrowed, but its scroll width has not caught up
  node.scrollWidth = 200;
  observers[0].cb();
  expect(node.attrs()).toEqual({});
  node.scrollWidth = 300; // it settles before the next frame
  nextFrame();
  expect(node.attrs()).toEqual({ tabindex: '0', role: 'region', 'aria-label': 'Command to run X' });
});

test('a window resize is measured even when the box reports no change of its own', () => {
  const node = box(300, 300);
  scrollRegion(node, { label: 'L' });
  node.clientWidth = 250;
  for (const f of windowListeners) f();
  expect(node.attrs()).toEqual({ tabindex: '0', role: 'region', 'aria-label': 'L' });
});

test('without a label only the tabindex follows: a figure keeps its own role and name', () => {
  const node = box(300, 300, { tabindex: '0', 'aria-label': 'diagram' });
  scrollRegion(node);
  expect(node.attrs()).toEqual({ 'aria-label': 'diagram' });
  node.scrollWidth = 760;
  observers[0].cb();
  expect(node.attrs()).toEqual({ tabindex: '0', 'aria-label': 'diagram' });
});

test('destroy stops listening', () => {
  const node = box(300, 300);
  const action = scrollRegion(node, { label: 'L' });
  expect(observers[0].connected).toBe(true);
  expect(fontListeners).toHaveLength(1);
  expect(windowListeners).toHaveLength(1);
  observers[0].cb(); // leaves a frame queued
  action.destroy();
  expect(observers[0].connected).toBe(false);
  expect(fontListeners).toHaveLength(0);
  expect(windowListeners).toHaveLength(0);
  expect(frames.size).toBe(0);
});
