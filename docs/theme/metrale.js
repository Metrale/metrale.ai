/* The lockup in the menu bar. mdBook sets the book's title there as text; this
   replaces it with the wordmark, linked to the book's front page, and a small
   "Engine docs" beside it. The wordmark is inlined by docs/build.mjs in
   place of the placeholder below, so no extra request is made for it. The title text stays
   available to assistive technology through the link's name. */
(function () {
  var wordmark = __WORDMARK__;
  function place() {
    var h = document.querySelector('h1.menu-title');
    if (!h || h.querySelector('.metrale-lockup')) return;
    var root = typeof window.path_to_root === 'string' ? window.path_to_root : '';
    h.innerHTML =
      '<a class="metrale-lockup" href="' +
      root +
      'index.html" aria-label="Metrale Engine documentation, front page">' +
      wordmark +
      '</a><span class="metrale-docs" aria-hidden="true">Engine docs</span>';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place);
  else place();
})();
