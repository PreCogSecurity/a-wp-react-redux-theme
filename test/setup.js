/**
 * Jest global setup.
 *
 * `src/actions/index.js` reads the WordPress runtime configuration that
 * `lib/theme-enqueue.php` exposes to the browser as the `RT_API` global (via
 * `wp_localize_script`). Tests must provide that global before the module is
 * imported, otherwise the module-level endpoint constants blow up.
 *
 * The values are inert placeholders - no real site, no real nonce, no secrets.
 */
global.RT_API = {
  root: 'https://theme.test/wp-json/',
  nonce: 'unit-test-nonce',
  siteName: 'Test Site',
  baseUrl: 'https://theme.test',
  siteDescription: 'Just another test site',
  categories: []
};
