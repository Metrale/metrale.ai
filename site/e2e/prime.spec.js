// =============================================================================
// prime.spec.js — Metrale Prime on the page. The Worker is a Playwright route
// that answers the way deploy/cloudflare/prime-worker does (its events, in its
// order), so the page's whole path is exercised with no network and no model:
// the launcher, the lazy panel, the stream, the thinking strip, the markdown,
// the sources, the telemetry, the audience, the partner code, the sheet on a
// phone and the dock on a desk. Runs in both projects.
// =============================================================================

import { test, expect } from '@playwright/test';
import { frame } from '../deploy/cloudflare/prime-worker/src/sse.js';

const ENDPOINT = 'https://prime.test'; // playwright.config.js builds the site with this address
const CHAT = `${ENDPOINT}/chat`;
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

// The last line is a real hazard: an unbreakable URL longer than the panel, and
// a long code span. Real answers carry both, and on 2026-09-21 they widened the
// column and clipped every line at the panel's edge.
const LONG_URL = 'https://atlascybernetics.ai/benchmarks#qwen38-27b-nvfp4-concurrency-ladder-eight-rungs-measured-on-one-gb10-round-eleven';
const ANSWER = [
  'The ladder has **eight rungs** and Metrale wins every one [1].',
  '',
  '| C | Metrale | vLLM + MTP |',
  '|---|---:|---:|',
  '| 1 | 23.6 | 19.7 |',
  '| 128 | 478.1 | 358.6 |',
  '',
  'Reproduce it from the [benchmarks page](/benchmarks) [2].',
  '',
  `Receipt: ${LONG_URL} and \`bench/ladder38/RESULTS-round-eleven-qwen38-27b-nvfp4-eight-rungs.md\`.`,
].join('\n');

/** The Worker's stream for one answer, as one body. */
function answerBody({ text = ANSWER, partner = false } = {}) {
  const parts = [
    frame('meta', {
      id: 'e2e-1',
      model: 'grok-4.7',
      effort: 'low',
      partner,
      corpus: { built: '2026-09-21', commit: 'abc', public: 700, partner: partner ? 37 : 0 },
    }),
    frame('phase', { phase: 'reading' }),
    frame('phase', { phase: 'reasoning' }),
    frame('reasoning', { text: 'The visitor wants the measured margin. ' }),
    frame('reasoning', { text: 'I will search the ladder.' }),
    frame('phase', { phase: 'searching', detail: 'concurrency ladder vllm' }),
    frame('tool', {
      name: 'search_site',
      args: { query: 'concurrency ladder vllm' },
      summary: '6 passages for "concurrency ladder vllm"',
      ms: 4,
    }),
    frame('phase', { phase: 'writing' }),
  ];
  for (const piece of text.match(/[\s\S]{1,24}/g)) parts.push(frame('delta', { text: piece }));
  parts.push(
    frame('sources', [
      {
        n: 1,
        title: 'Benchmarks · Metrale',
        section: 'The ladder',
        url: 'http://127.0.0.1:4173/benchmarks',
        kind: 'page',
        tier: 'public',
        cited: true,
      },
      {
        n: 2,
        title: 'Verification walkthrough',
        section: '',
        url: 'http://127.0.0.1:4173/diligence',
        kind: 'page',
        tier: 'public',
        cited: true,
      },
      {
        n: 3,
        title: 'Concurrency ladder results log',
        section: 'Round 11',
        url: 'https://github.com/x/atlas/blob/main/bench/RESULTS.md',
        kind: 'doc',
        tier: 'public',
        cited: false,
      },
    ]),
    frame('usage', {
      model: 'grok-4.7',
      effort: 'low',
      rounds: 2,
      tools: ['search_site'],
      prompt_tokens: 3400,
      cached_tokens: 900,
      completion_tokens: 120,
      reasoning_tokens: 60,
      cost_usd: 0.0079,
      ttft_ms: 850,
      first_answer_ms: 1900,
      total_ms: 4200,
    }),
    frame('done', {})
  );
  const total = parts.reduce((a, p) => a + p.length, 0);
  const body = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    body.set(p, at);
    at += p.length;
  }
  return Buffer.from(body);
}

/** Answer the Worker's routes. Returns the request bodies the page sent. */
async function stubWorker(page, { text, partner, status = 200, error } = {}) {
  const sent = [];
  await page.route(CHAT, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    sent.push(req.postDataJSON());
    if (error)
      return route.fulfill({
        status,
        headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify({ ok: false, error }),
      });
    return route.fulfill({
      status: 200,
      headers: { ...CORS, 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store' },
      body: answerBody({ text, partner }),
    });
  });
  return sent;
}

const launcher = (page) => page.getByRole('button', { name: /Open Metrale Prime/ });
const panel = (page) => page.locator('.pr-panel');
const composer = (page) => page.getByRole('textbox', { name: /Ask about the platform/ });

async function open(page) {
  await launcher(page).click();
  await expect(panel(page)).toBeVisible();
  await expect(composer(page)).toBeFocused();
}

test.describe('Metrale Prime', () => {
  test('the launcher is on every marketing page and on no developer page, and sends nothing until asked', async ({ page }) => {
    const calls = [];
    page.on('request', (r) => r.url().startsWith(ENDPOINT) && calls.push(r.url()));
    for (const path of ['/', '/pricing', '/company']) {
      await page.goto(path);
      await expect(launcher(page)).toBeVisible();
    }
    await page.goto('/engine');
    await expect(launcher(page)).toHaveCount(0);
    expect(calls).toEqual([]);
  });

  test('an answer streams with its thinking, its tool, its markdown, its sources and its receipt', async ({ page }) => {
    const sent = await stubWorker(page);
    await page.goto('/benchmarks');
    await open(page);
    await expect(page.locator('.pr-welcome-title')).toHaveText('Ask me anything on this site.');
    await composer(page).fill('How much faster is it than vLLM?');
    await composer(page).press('Enter');
    const print = page.locator('.pr-print').last();
    // The strip: it thought, it took steps, and it can be opened.
    const toggle = print.locator('.pr-think-toggle');
    await expect(toggle).toContainText(/thought for \d+\.\ds/);
    await expect(toggle).toContainText('1 steps');
    await toggle.click();
    await expect(print.locator('.pr-steps li')).toContainText('search site');
    await expect(print.locator('.pr-trace')).toContainText('I will search the ladder.');
    // The answer: markdown with a table, bold and two citations.
    await expect(print.locator('.pr-body strong')).toHaveText('eight rungs');
    await expect(print.locator('.pr-body table tbody tr')).toHaveCount(2);
    await expect(print.locator('.pr-body .pr-cite')).toHaveCount(2);
    await expect(print.locator('.pr-body a[href="/benchmarks"]')).toHaveText('benchmarks page');
    // The sources: the two cited first, the one only read behind a fold.
    await expect(print.locator('.pr-sources > ol > li')).toHaveCount(2);
    await expect(print.locator('.pr-sources > ol > li').first()).toContainText('Benchmarks · Metrale');
    await expect(print.locator('.pr-sources-more summary')).toContainText('also read 1');
    // A citation lights its source.
    await print.locator('.pr-cite').first().click();
    await expect(print.locator('.pr-sources li.is-hot')).toContainText('[1]');
    // Nothing in the answer widens the column: the long URL folds, the panel
    // keeps its width, and no line runs past its edge.
    const widths = await page.evaluate(() => {
      const log = document.querySelector('.pr-log');
      const print = [...document.querySelectorAll('.pr-print')].at(-1);
      return {
        logScroll: log.scrollWidth,
        logClient: log.clientWidth,
        print: print.getBoundingClientRect().width,
        panel: document.querySelector('.pr-panel').getBoundingClientRect().width,
      };
    });
    expect(widths.logScroll).toBeLessThanOrEqual(widths.logClient);
    expect(widths.print).toBeLessThanOrEqual(widths.panel);
    // The receipt, from the Worker's own figures, and the chart in the header.
    // 900 of 3,400 prompt tokens came from the cache (26%); 120 completion
    // tokens over the 3.35 s between the first token and the end is 36 tok/s.
    await expect(print.locator('.pr-meta-line')).toContainText(
      'grok-4.7 · low · first token 850ms · total 4.2s · 3,580 tokens · 26% cached · 36 tok/s · $0.0079'
    );
    await expect(page.locator('.pr-tele-num')).toHaveText('4.2s');
    await page.locator('.pr-tele-btn').click();
    await expect(page.locator('.pr-tele-pop tbody tr')).toHaveCount(1);
    await expect(page.locator('.pr-tele-pop tfoot')).toContainText('$0.0079');
    // What the page sent: the visitor's turn, the page it was on, no audience.
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      messages: [{ role: 'user', content: 'How much faster is it than vLLM?' }],
      audience: '',
      page: '/benchmarks',
    });
    // The fine print names the model it ran on.
    await expect(page.locator('.pr-fine')).toContainText('Runs on grok-4.7 via xAI');
  });

  test('who is asking changes the starters and travels with every request, and the transcript survives a reload', async ({ page }) => {
    const sent = await stubWorker(page, { text: 'Start with the [engine page](/engine) [1].' });
    await page.goto('/');
    await open(page);
    await page.getByRole('button', { name: 'I want to contribute' }).click();
    await expect(page.locator('.pr-starter').first()).toContainText('install the engine');
    await page.locator('.pr-starter').first().click();
    await expect(page.locator('.pr-print').last().locator('.pr-body')).toContainText('Start with the');
    expect(sent[0]).toMatchObject({ audience: 'contributor', page: '/' });
    await expect(page.locator('.pr-composer-aud')).toContainText('I want to contribute');
    await page.reload();
    await open(page);
    await expect(page.locator('.pr-user p')).toContainText('install the engine');
    await expect(page.locator('.pr-print .pr-body')).toContainText('Start with the');
    await expect(page.locator('.pr-tele-num')).toHaveText('4.2s');
    // Start over clears it.
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(page.locator('.pr-welcome-title')).toBeVisible();
  });

  test('a partner code is sent with the request and the answer says the tier is open', async ({ page }) => {
    const sent = await stubWorker(page, { partner: true });
    await page.goto('/company');
    await open(page);
    await page.getByRole('button', { name: 'Partner code' }).click();
    await page.getByLabel('Partner code').fill('open-sesame');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await composer(page).fill('What is the round for?');
    await composer(page).press('Enter');
    await expect(page.locator('.pr-print').last().locator('.pr-body')).toContainText('eight rungs');
    expect(sent[0].access).toBe('open-sesame');
    await expect(page.locator('.pr-head-kicker')).toContainText('partner documents unlocked');
  });

  test('a refusal from the Worker is a sentence in the log, not a blank', async ({ page }) => {
    await stubWorker(page, { status: 503, error: 'The assistant has reached its budget for today.' });
    await page.goto('/');
    await open(page);
    await composer(page).fill('Hello');
    await composer(page).press('Enter');
    await expect(page.locator('.pr-err')).toContainText('reached its budget');
  });

  test('a phone gets a sheet that locks the page; a desk gets a dock beside it; Escape closes both and returns focus', async ({
    page,
  }, testInfo) => {
    // The mobile project is a phone viewport, not Playwright's isMobile emulation,
    // so the branch follows the project name, as the marketing suite does.
    const phone = testInfo.project.name === 'mobile';
    await stubWorker(page);
    await page.goto('/pricing');
    await open(page);
    const p = panel(page);
    const locked = await page.evaluate(() => document.body.style.overflow === 'hidden');
    if (phone) {
      await expect(p).toHaveClass(/is-sheet/);
      await expect(p).toHaveAttribute('role', 'dialog');
      expect(locked).toBe(true);
      const box = await p.boundingBox();
      const vw = page.viewportSize().width;
      expect(Math.round(box.width)).toBe(vw);
      // Tab from the last control wraps to the first: the sheet holds focus.
      await page.locator('.pr-code-btn').focus();
      await page.keyboard.press('Tab');
      await expect(page.locator('.pr-tele-btn')).toBeFocused();
    } else {
      await expect(p).not.toHaveClass(/is-sheet/);
      await expect(p).toHaveAttribute('role', 'complementary');
      expect(locked).toBe(false);
      const box = await p.boundingBox();
      expect(box.width).toBeLessThanOrEqual(440);
      // The page beside it still scrolls.
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(200);
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    }
    await page.keyboard.press('Escape');
    await expect(p).toHaveCount(0);
    await expect(launcher(page)).toBeFocused();
  });

  test('anything on the page can open it with a question', async ({ page }) => {
    await stubWorker(page);
    await page.goto('/');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('prime:ask', { detail: { question: 'What does the console do?' } })));
    await expect(panel(page)).toBeVisible();
    await expect(composer(page)).toHaveValue('What does the console do?');
  });
});
