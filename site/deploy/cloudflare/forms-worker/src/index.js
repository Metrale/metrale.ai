// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// metrale-forms — where the site's forms go
// -----------------------------------------------------------------------------
// The marketing site is static files. Its three forms (the demo request, the
// Community Edition waitlist, the careers interest form) post JSON here, and this
// Worker does two things with a request, in this order:
//
//   1. KEEPS it, in a KV namespace, if one is bound. A request that has been
//      stored cannot be lost to a webhook that was down for a minute.
//   2. TELLS someone, through whichever channels have a secret configured:
//      a Discord webhook, a Slack webhook, an email through Resend's API.
//
// It answers 200 if the request was kept OR at least one channel took it. If
// neither happened it answers 502, and the form on the site falls back to
// drafting an email, so the visitor is never told "thank you" for a request
// nobody will see.
//
// It is deliberately a separate Worker, not a Pages Function inside the site.
// The site is uploaded by CI as plain files, and a mistake here cannot take a
// page down. README.md beside this file has the setup, and the options that were
// weighed against this one.
//
// No dependency, no build step: `wrangler deploy` ships this file as it is.
// The logic is exercised by site/src/lib/forms-worker.test.js.
// =============================================================================

/** The forms that exist, the inbox each belongs to, and the env var that overrides it. */
const SOURCES = {
  demo: { label: 'Demo request', to: 'TO_DEMO' },
  waitlist: { label: 'Community Edition waitlist', to: 'TO_WAITLIST' },
  careers: { label: 'Careers interest', to: 'TO_CAREERS' },
  // A visitor who asked the chatbot (deploy/cloudflare/prime-worker) for a person.
  prime: { label: 'Prime conversation', to: 'TO_DEMO' },
};

/** Every field any form sends, with the longest value it may carry. Anything else is dropped. */
const FIELDS = {
  name: 200,
  email: 254,
  company: 200,
  segment: 120,
  hardware: 400,
  engine: 120,
  use: 120,
  role: 160,
  work: 500,
  notes: 5000,
  page: 200,
};
const MAX_BODY = 16 * 1024;
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

/** The CORS headers for this caller, or null when the caller is not one of ours. */
export function corsFor(origin, env) {
  if (!origin) return null;
  const exact = String(env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const suffixes = String(env.ALLOWED_ORIGIN_SUFFIXES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  let host = '';
  try {
    const u = new URL(origin);
    if (u.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) return null;
    host = u.hostname;
  } catch {
    return null;
  }
  const ok = exact.includes(origin) || suffixes.some((s) => host.endsWith(s));
  if (!ok) return null;
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

/** Keep only the fields we know, as trimmed strings, and say what is wrong with them. */
export function clean(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'The request must be a JSON object.' };
  const source = String(input.source ?? '');
  if (!Object.hasOwn(SOURCES, source)) return { error: 'Unknown form.' };
  const lead = { source };
  for (const [key, max] of Object.entries(FIELDS)) {
    if (input[key] === undefined || input[key] === null) continue;
    const value = String(input[key]).replaceAll('\0', '').trim();
    if (!value) continue;
    if (value.length > max) return { error: `"${key}" is too long.` };
    lead[key] = value;
  }
  if (!lead.email || !EMAIL.test(lead.email)) return { error: 'A valid email address is needed.' };
  // A field no person can see. Anything that fills it in is not a person.
  const bot = typeof input.website === 'string' && input.website.trim() !== '';
  return { lead, bot };
}

const lines = (lead) =>
  Object.entries(lead)
    .filter(([k]) => k !== 'source')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

// ---- the channels. Each returns true when the other side accepted the message. ----

async function toDiscord(url, lead, meta) {
  const fields = Object.entries(lead)
    .filter(([k]) => k !== 'source')
    .map(([name, value]) => ({ name, value: value.slice(0, 1024), inline: value.length < 40 }))
    .slice(0, 25);
  const body = {
    // Never let a visitor's text ping anyone: no @everyone, no role or user mentions.
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: SOURCES[lead.source].label,
        fields,
        footer: { text: `${meta.id} · ${meta.country || 'unknown country'}` },
        timestamp: meta.at,
      },
    ],
  };
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return res.ok;
}

async function toSlack(url, lead, meta) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const text = `*${SOURCES[lead.source].label}*\n${esc(lines(lead))}\n_${meta.id}_`;
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
  return res.ok;
}

async function toEmail(env, lead, meta) {
  const to = env[SOURCES[lead.source].to];
  if (!to || !env.MAIL_FROM) return false;
  const who = lead.company || lead.name || lead.email;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [to],
      reply_to: lead.email,
      subject: `${SOURCES[lead.source].label}: ${who}`.slice(0, 200),
      text: `${lines(lead)}\n\n${meta.id}`,
    }),
  });
  return res.ok;
}

/** A speed bump, not a wall: at most `limit` requests a minute from one address, counted in KV. */
async function tooMany(env, ip, limit = 6) {
  if (!env.LEADS || !ip) return false;
  const key = `rate:${ip}:${Math.floor(Date.now() / 60000)}`;
  const seen = Number((await env.LEADS.get(key)) ?? 0);
  if (seen >= limit) return true;
  await env.LEADS.put(key, String(seen + 1), { expirationTtl: 120 });
  return false;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') return json(200, { ok: true, service: 'metrale-forms' });
    if (url.pathname !== '/lead') return json(404, { ok: false, error: 'Not found.' });

    const cors = corsFor(request.headers.get('origin'), env);
    if (!cors) return json(403, { ok: false, error: 'This origin may not post here.' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json(405, { ok: false, error: 'POST only.' }, { ...cors, allow: 'POST, OPTIONS' });
    if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json'))
      return json(415, { ok: false, error: 'Send JSON.' }, cors);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json(413, { ok: false, error: 'That is too much text.' }, cors);
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return json(400, { ok: false, error: 'That is not JSON.' }, cors);
    }
    const { lead, bot, error } = clean(input);
    if (error) return json(400, { ok: false, error }, cors);
    // Tell a bot it worked. It learns nothing, and nothing is kept or sent.
    if (bot) return json(200, { ok: true }, cors);
    if (await tooMany(env, request.headers.get('cf-connecting-ip')))
      return json(429, { ok: false, error: 'Too many requests. Try again in a minute.' }, cors);

    const meta = {
      id: `${lead.source}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`,
      at: new Date().toISOString(),
      country: request.cf?.country ?? '',
    };
    // The visitor's address is never stored: the country is enough to read a list by.
    const record = { ...lead, ...meta };

    let kept = false;
    if (env.LEADS) {
      try {
        const days = Number(env.LEAD_TTL_DAYS ?? 180);
        await env.LEADS.put(
          `lead:${meta.at}:${meta.id}`,
          JSON.stringify(record),
          days > 0 ? { expirationTtl: Math.round(days * 86400) } : undefined
        );
        kept = true;
      } catch {
        kept = false;
      }
    }

    const channels = [];
    if (env.DISCORD_WEBHOOK_URL) channels.push(toDiscord(env.DISCORD_WEBHOOK_URL, lead, meta));
    if (env.SLACK_WEBHOOK_URL) channels.push(toSlack(env.SLACK_WEBHOOK_URL, lead, meta));
    if (env.RESEND_API_KEY) channels.push(toEmail(env, lead, meta));
    const told = (await Promise.allSettled(channels)).some((r) => r.status === 'fulfilled' && r.value === true);

    if (!kept && !told) return json(502, { ok: false, error: 'The request could not be delivered.' }, cors);
    return json(200, { ok: true, id: meta.id }, cors);
  },
};
