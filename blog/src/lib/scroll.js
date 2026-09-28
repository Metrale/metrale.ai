// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Scroll progress for a post told in beats.
 *
 * Every `[data-beat]` under the node is taller than the screen and holds a
 * sticky stage. As the reader scrolls a beat past the pin line, the action
 * writes that beat's progress to `--m` (0 to 1, eased at both ends) and names
 * the face in front in `data-face`, `line` or `record`. What the turn looks
 * like is the post's own CSS: this only says how far through it the reader is,
 * so each post can bring its own effect to the same engine.
 *
 * `from` and `to` are the fractions of a beat's travel over which the turn
 * happens; `pin` is where, as a fraction of the viewport from the top, a beat
 * starts to count. Reduced motion is the post's CSS to honour: the values are
 * still written, and a stylesheet that stacks the beats simply ignores them.
 *
 * @param {HTMLElement} node
 * @param {{ from?: number, to?: number, pin?: number }} [options]
 */
export function beats(node, { from = 0.22, to = 0.62, pin = 0.16 } = {}) {
  const els = [...node.querySelectorAll('[data-beat]')];
  const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ease = (t) => {
    const u = clamp((t - from) / (to - from));
    return u * u * (3 - 2 * u);
  };
  let frame = 0;

  const paint = () => {
    frame = 0;
    const vh = window.innerHeight || 1;
    // Every read before any write: a write between two reads forces a layout
    // per beat.
    const turn = els.map((el) => {
      const travel = Math.max(1, el.offsetHeight - vh * 0.42);
      return ease((vh * pin - el.getBoundingClientRect().top) / travel);
    });
    els.forEach((el, i) => {
      el.style.setProperty('--m', turn[i].toFixed(3));
      el.dataset.face = turn[i] < 0.5 ? 'line' : 'record';
    });
  };
  const queue = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };

  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue, { passive: true });
  paint();
  return {
    destroy() {
      removeEventListener('scroll', queue);
      removeEventListener('resize', queue);
      cancelAnimationFrame(frame);
    }
  };
}
