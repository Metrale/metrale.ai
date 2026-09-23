// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// telemetry.js — what every answer cost and how long it took, and the limits.
// -----------------------------------------------------------------------------
// One record per answer in KV, `log:<time>:<id>`, kept LOG_TTL_DAYS. It holds
// the model, the effort, the audience, the page, the tokens, the dollars, the
// three timings and whether it worked. It never holds the question or the
// answer: the text of a conversation is the visitor's.
//
// Two counters beside it: `spend:<day>` in USD ticks, which the daily budget
// reads, and `rate:<ip>:<minute>` and `rate:<ip>:<day>`, the speed bumps.
// KV has no atomic increment, so a burst can undercount a little. These are
// soft limits, and a soft limit that undercounts by one request is fine.
//
// GET /stats aggregates the records for the last days. The page's own
// telemetry (the sparkline, the per answer line) comes from the `usage` event
// on the stream and needs none of this.
// =============================================================================

const TICKS = 1e10;
const day = (d = new Date()) => d.toISOString().slice(0, 10);

/** Keep one answer's record, and add its cost to the day. */
export async function record(env, entry) {
  if (!env.PRIME) return;
  const days = Number(env.LOG_TTL_DAYS ?? 30);
  const at = entry.at ?? new Date().toISOString();
  try {
    await env.PRIME.put(
      `log:${at}:${entry.id}`,
      JSON.stringify({ ...entry, at }),
      days > 0 ? { expirationTtl: Math.round(days * 86400) } : undefined
    );
  } catch {
    /* telemetry never fails an answer */
  }
  const ticks = Math.round((entry.cost_usd ?? 0) * TICKS);
  if (ticks > 0) {
    const key = `spend:${day()}`;
    try {
      const seen = Number((await env.PRIME.get(key)) ?? 0);
      await env.PRIME.put(key, String(seen + ticks), { expirationTtl: 3 * 86400 });
    } catch {
      /* same */
    }
  }
}

/** Dollars spent so far today. */
export async function spentToday(env) {
  if (!env.PRIME) return 0;
  try {
    return Number((await env.PRIME.get(`spend:${day()}`)) ?? 0) / TICKS;
  } catch {
    return 0;
  }
}

/** True when today's spend has passed PRIME_DAILY_BUDGET_USD. */
export async function overBudget(env) {
  const cap = Number(env.PRIME_DAILY_BUDGET_USD ?? 0);
  if (!(cap > 0)) return false;
  return (await spentToday(env)) >= cap;
}

/** A speed bump per address: `perMinute` turns a minute and `perDay` a day. */
export async function tooMany(env, ip, { perMinute = 8, perDay = 120 } = {}) {
  if (!env.PRIME || !ip) return false;
  const now = Date.now();
  const checks = [
    { key: `rate:${ip}:m${Math.floor(now / 60000)}`, limit: perMinute, ttl: 120 },
    { key: `rate:${ip}:d${day()}`, limit: perDay, ttl: 2 * 86400 },
  ];
  for (const c of checks) {
    let seen;
    try {
      seen = Number((await env.PRIME.get(c.key)) ?? 0);
    } catch {
      return false;
    }
    if (seen >= c.limit) return true;
    try {
      await env.PRIME.put(c.key, String(seen + 1), { expirationTtl: c.ttl });
    } catch {
      /* a lost bump is a free request, not a failure */
    }
  }
  return false;
}

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Aggregate the records of the last `days`, newest day first. */
export async function stats(env, { days = 7, max = 2000 } = {}) {
  if (!env.PRIME) return { days: [], note: 'no KV namespace' };
  const out = [];
  const byModel = {};
  const tools = {};
  let all = [];
  for (let i = 0; i < days; i++) {
    const d = day(new Date(Date.now() - i * 86400000));
    const keys = [];
    let cursor;
    do {
      const page = await env.PRIME.list({ prefix: `log:${d}`, cursor, limit: 1000 });
      keys.push(...page.keys.map((k) => k.name));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor && keys.length < max);
    const records = (await Promise.all(keys.slice(0, max).map((k) => env.PRIME.get(k, 'json').catch(() => null)))).filter(Boolean);
    const ok = records.filter((r) => r.ok);
    const ttft = ok
      .map((r) => r.ttft_ms)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    const total = ok
      .map((r) => r.total_ms)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    const cost = records.reduce((a, r) => a + (r.cost_usd ?? 0), 0);
    out.push({
      day: d,
      answers: records.length,
      ok: ok.length,
      errors: records.length - ok.length,
      cost_usd: round(cost, 4),
      avg_cost_usd: records.length ? round(cost / records.length, 4) : 0,
      ttft_ms: { p50: pct(ttft, 50), p95: pct(ttft, 95), avg: ttft.length ? Math.round(ttft.reduce((a, b) => a + b, 0) / ttft.length) : 0 },
      total_ms: {
        p50: pct(total, 50),
        p95: pct(total, 95),
        avg: total.length ? Math.round(total.reduce((a, b) => a + b, 0) / total.length) : 0,
      },
      tokens: records.reduce((a, r) => a + (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0) + (r.reasoning_tokens ?? 0), 0),
      audiences: records.reduce((a, r) => ({ ...a, [r.audience || 'none']: (a[r.audience || 'none'] ?? 0) + 1 }), {}),
    });
    for (const r of records) {
      const m = `${r.model}/${r.effort}`;
      byModel[m] = byModel[m] ?? { answers: 0, cost_usd: 0, ttft_ms: [], total_ms: [] };
      byModel[m].answers++;
      byModel[m].cost_usd += r.cost_usd ?? 0;
      if (r.ok) {
        byModel[m].ttft_ms.push(r.ttft_ms);
        byModel[m].total_ms.push(r.total_ms);
      }
      for (const t of r.tools ?? []) tools[t] = (tools[t] ?? 0) + 1;
    }
    all = all.concat(records);
  }
  for (const m of Object.values(byModel)) {
    const t1 = m.ttft_ms.filter(Number.isFinite).sort((a, b) => a - b);
    const t2 = m.total_ms.filter(Number.isFinite).sort((a, b) => a - b);
    m.cost_usd = round(m.cost_usd, 4);
    m.ttft_ms = { p50: pct(t1, 50), p95: pct(t1, 95) };
    m.total_ms = { p50: pct(t2, 50), p95: pct(t2, 95) };
  }
  return {
    generated: new Date().toISOString(),
    spent_today_usd: round(await spentToday(env), 4),
    budget_usd: Number(env.PRIME_DAILY_BUDGET_USD ?? 0),
    answers: all.length,
    days: out,
    by_model: byModel,
    tools,
  };
}
