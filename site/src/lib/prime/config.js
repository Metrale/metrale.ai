// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// config.js — every constant for Metrale Prime on the page. No other module in
// this folder hardcodes an address, a key or a limit.
// =============================================================================
import { primeEndpoint } from '$lib/content/brand.js';

// The Worker's origin. brand.js is the production value, tracked by the site
// guide; VITE_PRIME_ENDPOINT lets a build point elsewhere (a local wrangler dev,
// the browser tests' stub). Empty means the guide is off and nothing renders.
export const ENDPOINT = String((import.meta.env ?? {}).VITE_PRIME_ENDPOINT || primeEndpoint || '').replace(/\/$/, '');
export const CHAT_URL = ENDPOINT ? `${ENDPOINT}/chat` : '';

// The page becomes a sheet below this width, and stays a dock above it.
export const SHEET_QUERY = '(max-width: 860px)';

// The conversation survives a reload for the tab's life, in sessionStorage.
export const SESSION_KEY = 'metrale-prime';
// Turns a visitor may keep in one conversation before it starts over.
export const MAX_TURNS = 24;
// The response-time chart shows the last this many answers.
export const CHART_POINTS = 12;
// The stopwatch under a thinking answer ticks this often.
export const TICK_MS = 100;
