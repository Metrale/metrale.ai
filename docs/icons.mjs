// The icons and the social card the docs ship beside the book, by the plain
// names the book's head links, each from the file the site serves it as
// (site/static; the card under its versioned name, web-shared/brand-files.mjs).
import { brandFiles } from '../web-shared/brand-files.mjs';

export const DOCS_ICONS = {
  'favicon.svg': 'favicon.svg',
  'favicon.ico': 'favicon.ico',
  'apple-touch-icon.png': 'apple-touch-icon.png',
  'og-image.png': brandFiles.ogImage.slice(1),
};
