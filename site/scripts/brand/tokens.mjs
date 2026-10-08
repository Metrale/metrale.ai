// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// tokens.mjs — read web-shared/metrale-tokens.css as resolved colours, per theme
// -----------------------------------------------------------------------------
// The token file names the kit's palette (--brand-*) rather than restating it,
// so a role's value is a chain of var() references. The contrast gate
// (.contrast-check.mjs) and the unit tests that hold the palette read the
// resolved values from here, so neither keeps a second copy of the file's
// grammar or of the colour maths.
// =============================================================================

const BLOCK = /^(:root|\[data-theme="light"\])\s*\{([\s\S]*?)\n\}/gm;

/**
 * @param {string} css the token file
 * @returns {{ dark: Record<string,string>, light: Record<string,string>, declared: { dark: Record<string,string>, light: Record<string,string> } }}
 *   `dark` and `light` are every token fully resolved for that theme (the light
 *   theme is the dark one with the light block over it); `declared` is what each
 *   block writes, unresolved.
 */
export function readTokens(css) {
  const declared = { dark: {}, light: {} };
  for (const [, selector, body] of css.matchAll(BLOCK)) {
    const into = selector === ':root' ? declared.dark : declared.light;
    for (const [, name, value] of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) into[name] = value.trim();
  }
  if (!Object.keys(declared.dark).length || !Object.keys(declared.light).length)
    throw new Error('the token file has no :root or no [data-theme="light"] block');
  const resolveAll = (map) => {
    const resolve = (value, seen) =>
      value.replace(/var\(--([\w-]+)(?:,\s*([^)]+))?\)/g, (_, name, fallback) => {
        if (seen.includes(name)) throw new Error(`--${name} refers to itself through ${seen.join(' -> ')}`);
        if (name in map) return resolve(map[name], [...seen, name]);
        if (fallback !== undefined) return resolve(fallback, seen);
        throw new Error(`--${name} is used but not defined`);
      });
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, resolve(v, [k])]));
  };
  const light = { ...declared.dark, ...declared.light };
  return { dark: resolveAll(declared.dark), light: resolveAll(light), declared };
}

/** #RRGGBB or rgba(r, g, b, a) as [r, g, b, a] with r, g, b in 0..255. */
export function rgba(colour) {
  const hex = colour.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1);
  const fn = colour.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (fn) return [+fn[1], +fn[2], +fn[3], fn[4] === undefined ? 1 : +fn[4]];
  throw new Error(`not a colour this reader knows: ${colour}`);
}

/** `top` composited over the opaque `ground`, or `top` mixed in at `share` (a 0..1 tint), as #RRGGBB. */
export function over(top, ground, share) {
  const [r, g, b, a] = rgba(top);
  const t = share ?? a;
  const base = rgba(ground);
  if (base[3] !== 1) throw new Error(`a ground must be opaque: ${ground}`);
  return (
    '#' +
    [r, g, b]
      .map((c, i) =>
        Math.round(c * t + base[i] * (1 - t))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
      .toUpperCase()
  );
}

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (colour) => {
  const [r, g, b, a] = rgba(colour);
  if (a !== 1) throw new Error(`contrast needs opaque colours; composite ${colour} first`);
  return 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
};

/** WCAG 2.x contrast ratio of two opaque colours. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
