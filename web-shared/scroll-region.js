// SPDX-License-Identifier: AGPL-3.0-only
//
// A box that scrolls sideways (a long command, a wide table, a diagram on a
// phone) must be reachable by a keyboard (WCAG 2.1.1, axe
// scrollable-region-focusable): it takes tabindex="0", and a box that is not a
// figure takes role="region" and a name so a screen reader says what it holds.
// A box that does not scroll at the current width must not: it would be a Tab
// stop and a landmark with nothing to do.
//
// So the markup renders the focusable form, which is right with scripts off,
// and this Svelte action keeps it only while the box actually overflows,
// measured again whenever the box or the window changes size and whenever web
// fonts finish loading (the brand face arrives after first paint and changes
// widths). Each size change is measured once at once and once more on the next
// animation frame: WebKit can report a box's new size before its scroll width
// has settled, and without the second look a box stayed unreachable for seconds
// after the window narrowed.
//
//   <code tabindex="0" role="region" aria-label={name} use:scrollRegion={{ label: name }}>
//   <figure tabindex="0" aria-label={name} use:scrollRegion>   (keeps its own role and name)

/**
 * @param {HTMLElement} node
 * @param {{ label?: string }} [options] with a label, the box is a named region while it scrolls;
 *   without one, only its tabindex follows the overflow
 */
export function scrollRegion(node, options = {}) {
  let label = options.label ?? null;
  const sync = () => {
    const scrolls = node.scrollWidth > node.clientWidth + 1;
    if (scrolls) {
      node.setAttribute('tabindex', '0');
      if (label) {
        node.setAttribute('role', 'region');
        node.setAttribute('aria-label', label);
      }
    } else {
      node.removeAttribute('tabindex');
      if (label) {
        node.removeAttribute('role');
        node.removeAttribute('aria-label');
      }
    }
  };
  let frame = 0;
  const settle = () => {
    sync();
    if (typeof requestAnimationFrame !== 'function') return;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  };
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(settle) : null;
  resize?.observe(node);
  const win = typeof window !== 'undefined' ? window : undefined;
  win?.addEventListener?.('resize', settle);
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  fonts?.addEventListener?.('loadingdone', sync);
  fonts?.ready?.then(sync);
  sync();
  return {
    update(next = {}) {
      label = next.label ?? null;
      sync();
    },
    destroy() {
      resize?.disconnect();
      win?.removeEventListener?.('resize', settle);
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      fonts?.removeEventListener?.('loadingdone', sync);
    },
  };
}
