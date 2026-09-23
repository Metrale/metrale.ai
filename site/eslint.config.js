import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

export default [
  {
    ignores: [
      'build/',
      '.svelte-kit/',
      'node_modules/',
      'static/',
      'playwright-report/',
      'test-results/',
      '.lighthouseci/',
      'scripts/.cache/',
      'deploy/cloudflare/prime-worker/corpus/',
    ],
  },
  js.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      // `const { drop, ...rest } = obj` is how a key is removed without mutating.
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
      // Playwright reads fixtures from the first parameter, so `({}, testInfo)` is its documented form.
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
      // Internal links come from `routes` in content/brand.js and the site is served from the root,
      // so wrapping each in `resolve()` adds nothing. content/site.test.js checks every route and anchor.
      'svelte/no-navigation-without-resolve': 'off',
      // Keys matter for lists whose items move while holding state. These lists are content rendered
      // in a fixed order, and a key that is not unique throws at runtime.
      'svelte/require-each-key': 'off',
      // The Maps and Sets it flags are private bookkeeping or scratch values built inside `$derived`,
      // deliberately not reactive. Swapping in SvelteMap would add reactivity nothing reads.
      'svelte/prefer-svelte-reactivity': 'off',
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.js'],
    languageOptions: { parserOptions: { svelteConfig } },
  },
  {
    files: ['scripts/**', 'e2e/**', '*.config.js', 'test-runes.js', 'test-stubs/**'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.test.js', 'test-runes.js'],
    languageOptions: { globals: { ...globals.node, Bun: 'readonly' } },
  },
  {
    files: ['deploy/cloudflare/*/src/**'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
];
