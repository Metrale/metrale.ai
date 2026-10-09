// SPDX-License-Identifier: AGPL-3.0-only
//
// The public names of the brand files that pages and the web manifest link.
//
// Static files are cached by their name: a month for images in the browser
// (site/static/_headers), and as long again at the edge. A file whose content
// changes under the same name keeps being served in its old form until those
// copies expire, which is what happened to the first kit's icons, social card
// and font sheet after the v2 deploy. So a brand file that a page links
// carries the brand version in its name, and a new kit that changes it moves
// the version here. scripts/brand/kit.mjs writes the files under these names;
// scripts/check-static-names.mjs (CI) fails when a long-cached file under
// static/ changes content and keeps its name.
//
// Files a browser asks for by a fixed name (favicon.ico, the touch icon) cannot
// be renamed. The pages link them with ICON_QUERY, so a changed file is fetched
// under a new address; bump it when one of them changes.

export const BRAND_VERSION = 'v2';
const versioned = (name, ext) => `/${name}-${BRAND_VERSION}.${ext}`;

export const brandFiles = {
  ogImage: versioned('og-image', 'png'),
  icon192: versioned('icon-192', 'png'),
  icon512: versioned('icon-512', 'png'),
  iconMaskable512: versioned('icon-maskable-512', 'png'),
};

export const ICON_QUERY = '?v=3';
