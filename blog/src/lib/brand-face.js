// SPDX-License-Identifier: AGPL-3.0-only
//
// The brand face, Manrope, added to the page after it has loaded and gone
// idle, so its download is never on the path of the first or the largest
// paint (src/app.css says what that cost when it was declared in the sheet).
// The file is the kit's, copied by site/scripts/brand/kit.mjs under a
// versioned name, because the blog caches /fonts/* immutably for a year.
// Once a visitor has it, later pages add it at once, from the cache.
import { brandFiles } from '../../../web-shared/brand-files.mjs';

export const BRAND_FACE = {
  family: 'Manrope',
  url: brandFiles.blogManrope,
  descriptors: { style: 'normal', weight: '200 800', display: 'swap' },
};
const WARM = 'metrale-blog-face';

/**
 * @param {Window} win
 * @param {Document} doc
 */
export function attachBrandFace(win, doc) {
  if (!win.FontFace || !doc.fonts) return;
  let done = false;
  const add = () => {
    if (done) return;
    done = true;
    const face = new win.FontFace(BRAND_FACE.family, `url(${BRAND_FACE.url}) format('woff2')`, BRAND_FACE.descriptors);
    doc.fonts.add(face);
    face
      .load()
      .then(() => {
        try {
          win.localStorage.setItem(WARM, '1');
        } catch {
          /* private mode */
        }
      })
      .catch(() => {});
  };
  let warm = false;
  try {
    warm = win.localStorage.getItem(WARM) === '1';
  } catch {
    /* private mode */
  }
  if (warm) return add();
  const idle = () => (win.requestIdleCallback ? win.requestIdleCallback(add, { timeout: 2000 }) : win.setTimeout(add, 200));
  if (doc.readyState === 'complete') idle();
  else win.addEventListener('load', idle, { once: true });
}
