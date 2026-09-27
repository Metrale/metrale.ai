// =============================================================================
// diligence.spec.js — the verification deck fits its window at every width
// -----------------------------------------------------------------------------
// Three things a slide deck under a sticky site header can get wrong, each
// once true of this page:
//
//   1. a slide's first line sits under the header. The deck used to fill the
//      whole window from y=0 and pad its slides by a share of the viewport
//      width, so on a wide window the eyebrow was cut by the bar and on a
//      phone the whole heading was.
//   2. a wide component (a two-column list, a table, a command) reaches past
//      the slide's edge and is clipped, with no way to scroll to the rest.
//   3. the deck does not follow its own deep links: `#7` worked on a fresh
//      load only, so a link from inside the page did nothing.
//
// Every check runs on every slide, at the phone widths in the mobile project
// and the desktop widths in the chromium one. A slide is reached by a fresh
// load of its hash, the way a reader arrives from a link.
// =============================================================================

import { test, expect } from '@playwright/test';
import { routes } from '../src/lib/content/index.js';

// The deck's length is a design decision: twelve slides, four movements. A
// slide added or removed changes this number on purpose, in the same change.
const SLIDES = 12;

const WIDTHS = {
  chromium: [1024, 1280, 1440, 1920],
  mobile: [360, 390, 768],
};
const heightFor = (w) => (w <= 480 ? 844 : w <= 800 ? 1024 : 900);

/** A fresh load of slide `n`. */
async function open(page, n) {
  await page.goto('about:blank');
  await page.goto(`${routes.diligence}#${n}`, { waitUntil: 'networkidle' });
  await expect(page.locator('.sl-active')).toHaveCount(1);
}

/** The header's bottom edge and the top edge of the first thing a reader sees on the active slide. */
const firstLineOf = (page) =>
  page.evaluate(() => {
    const header = document.querySelector('.av-header').getBoundingClientRect();
    const slide = document.querySelector('.sl-active');
    const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.height === 0) continue;
      const el = n.parentElement;
      // What is painted at the first line's top-left: the deck, or the bar over it.
      const hit = document.elementFromPoint(r.left + 2, r.top + 2);
      return {
        headerBottom: header.bottom,
        top: r.top,
        text: n.textContent.trim().slice(0, 40),
        under: hit ? !!hit.closest('.dk') : false,
        tag: `${el.tagName.toLowerCase()}.${el.className}`,
      };
    }
    return null;
  });

/**
 * What on the active slide is out of reach sideways: any element or run of
 * text past the slide's right edge with no scroll box around it, and any box
 * whose overflow-x is hidden or clip while its content is wider than it —
 * the slide itself included, since it clips rather than scrolls sideways.
 */
const sidewaysOf = (page) =>
  page.evaluate(() => {
    const doc = document.documentElement;
    const slide = document.querySelector('.sl-active');
    const edge = slide.getBoundingClientRect().right + 0.5;
    const scrolls = (ox) => ox === 'auto' || ox === 'scroll';
    const scrollBoxOf = (el) => {
      for (let p = el; p && p !== slide.parentElement; p = p.parentElement) {
        if (scrolls(getComputedStyle(p).overflowX) && p.getBoundingClientRect().right <= edge) return p;
      }
      return null;
    };
    const name = (el) => `${el.tagName.toLowerCase()}.${typeof el.className === 'string' ? el.className : ''}`;
    const past = [];
    const clipped = [];
    for (const el of [slide, ...slide.querySelectorAll('*')]) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > edge && !scrollBoxOf(el) && past.length < 6)
        past.push(`${name(el)} right ${Math.round(r.right)} > ${Math.round(edge)}`);
      const clips = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
      if (el instanceof HTMLElement && clips && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && clipped.length < 6) {
        clipped.push(`${name(el)} cuts ${el.scrollWidth} to ${el.clientWidth}`);
      }
    }
    const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n && past.length < 6; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.right > edge && !scrollBoxOf(n.parentElement))
        past.push(`${name(n.parentElement)} "${n.textContent.trim().slice(0, 40)}" right ${Math.round(r.right)}`);
    }
    return { document: { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth }, past, clipped };
  });

test.describe('the verification deck', () => {
  test('has the slides the design calls for, and the header declares the height the deck reads', async ({ page }) => {
    await open(page, 1);
    await expect(page.locator('.sl')).toHaveCount(SLIDES);
    const navH = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--nav-h').trim());
    const headerH = await page.evaluate(() => document.querySelector('.av-header-in').getBoundingClientRect().height);
    expect(navH).toBe(`${Math.round(headerH)}px`);
  });

  test('every slide starts below the site header, at every width', async ({ page }, testInfo) => {
    for (const width of WIDTHS[testInfo.project.name]) {
      await page.setViewportSize({ width, height: heightFor(width) });
      for (let n = 1; n <= SLIDES; n++) {
        await open(page, n);
        const first = await firstLineOf(page);
        expect(first, `slide ${n} at ${width}px has a first line`).not.toBeNull();
        expect(
          first.top,
          `slide ${n} at ${width}px: "${first.text}" (${first.tag}) starts at ${first.top}, header ends at ${first.headerBottom}`
        ).toBeGreaterThanOrEqual(first.headerBottom);
        expect(first.under, `slide ${n} at ${width}px: something paints over "${first.text}"`).toBe(true);
      }
    }
  });

  test('nothing reaches past the slide unless it scrolls, and the page never scrolls sideways', async ({ page }, testInfo) => {
    for (const width of WIDTHS[testInfo.project.name]) {
      await page.setViewportSize({ width, height: heightFor(width) });
      for (let n = 1; n <= SLIDES; n++) {
        await open(page, n);
        const s = await sidewaysOf(page);
        expect(s.document.scrollWidth, `slide ${n} at ${width}px widens the document`).toBeLessThanOrEqual(s.document.clientWidth);
        expect(s.past, `slide ${n} at ${width}px: past the slide's edge with no scroll box`).toEqual([]);
        expect(s.clipped, `slide ${n} at ${width}px: wider than its box and clipped rather than scrollable`).toEqual([]);
      }
    }
  });

  test('a wide command scrolls inside its own box rather than wrapping or clipping', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'only a phone is narrower than the serve command');
    await open(page, 6);
    const pre = page.locator('.sl-active pre').last();
    const box = await pre.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowX: getComputedStyle(el).overflowX,
    }));
    expect(box.scrollWidth).toBeGreaterThan(box.clientWidth);
    expect(['auto', 'scroll']).toContain(box.overflowX);
  });

  test('moves with the keyboard, the buttons and the hash', async ({ page }) => {
    await open(page, 1);
    const active = () => page.evaluate(() => [...document.querySelectorAll('.sl')].findIndex((s) => s.classList.contains('sl-active')) + 1);

    await page.keyboard.press('ArrowRight');
    await expect.poll(active).toBe(2);
    expect(new URL(page.url()).hash).toBe('#2');

    await page.keyboard.press('ArrowLeft');
    await expect.poll(active).toBe(1);
    expect(new URL(page.url()).hash).toBe('#1');

    await page.keyboard.press('End');
    await expect.poll(active).toBe(SLIDES);
    await page.keyboard.press('Home');
    await expect.poll(active).toBe(1);

    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect.poll(active).toBe(2);
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect.poll(active).toBe(1);

    // A link from inside the page: the hash changes without a load.
    await page.evaluate(() => {
      location.hash = '#7';
    });
    await expect.poll(active).toBe(7);

    // A deep link on a fresh load, including the last slide.
    await open(page, SLIDES);
    expect(await active()).toBe(SLIDES);
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  });
});
