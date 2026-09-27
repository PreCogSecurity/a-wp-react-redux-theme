# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **Removed a credential leak in the runtime configuration.** `lib/theme-enqueue.php`
  passed `wp_get_current_user()` into `wp_localize_script()`. `WP_User::$data` is
  a public property holding the raw `wp_users` row, so `wp_json_encode()` wrote
  the current user's **password hash and password-reset activation key** into the
  HTML source of every page, for every logged-in visitor. The front end never
  read the value. The `RT_API` payload is now limited to public site metadata.
- **Comment authorization now respects the site's own policy.** The theme forced
  `rest_allow_anonymous_comments` to `true`, ignoring *Users must be registered
  and logged in to comment* and leaving every installation with an open,
  unauthenticated comment endpoint. The filter now mirrors the classic
  `wp-comments-post.php` gate and is overridable with the
  `react_theme_allow_anonymous_comments` filter.
- **Comment payloads are whitelisted.** `createComment` forwards only
  `post`, `parent`, `author_name`, `author_email` and `content`, so an unexpected
  key in form state (for example `status` or `user_id`) can no longer be sent to
  the WP API. Field lengths are capped and the values are coerced to their
  expected types.
- **Every request value is validated at the boundary.** Post types, taxonomies,
  ids, page numbers, permalinks, menu locations and search terms are checked
  against explicit patterns and passed through axios' `params` serialiser instead
  of being concatenated into a query string, closing off query-parameter and path
  injection.
- **All REST routes declare a `permission_callback`.** The four `react-theme/v1`
  menu routes and the pretty-permalink route did not, which WordPress 5.5+
  rejects and which leaves the access decision implicit.
- **The pretty-permalink endpoint validates its input and 404s properly.** It now
  rejects absolute URLs (so it cannot be used to probe other hosts), `..`
  traversal, control characters and oversized input, and returns a real
  `WP_Error` with a 404 status instead of constructing a post controller for a
  post that does not exist.
- **Errors no longer carry secrets.** Failed requests are reduced to a
  `{message, status}` pair before reaching Redux. The raw axios error was dropped
  because `error.config.headers` contains the `X-WP-Nonce` value and
  `error.response` can contain arbitrary server output.
- **The Bootstrap CDN stylesheet is pinned with SRI.** `wp_style_add_data()` adds
  an `integrity`/`crossorigin` pair so a compromised CDN or a hostile network
  position cannot inject CSS into trusted pages. Recompute the hash if the URL or
  version changes.
- **Hand-built PHP markup is escaped.** The search form interpolates
  `get_query_var( 's' )` and `home_url()` into raw HTML without escaping;
  `Theme_Helpers::get_class()` echoes a class name unescaped. `header.php` now
  uses `esc_url()`/`esc_attr()`, and the site-name link uses `home_url()` so
  subdirectory installs work.
- **`functions.php` and `lib/theme-helpers.php` gained an `ABSPATH` guard**, and
  the bootstrap `include`s are anchored to `__DIR__` instead of relying on the
  current working directory.

### Fixed

- **A failed comment no longer reports success.** The comment form set its
  `posted` flag on submit, so a rejected or failed request still rendered
  "Thank you for your comment" and the visitor's text was lost. The form now
  tracks the real `REQUEST_PENDING`/`REQUEST_SUCCEEDED`/`REQUEST_FAILED`
  lifecycle, disables the button while in flight, and renders the API's error
  message. Each form on a post gets its own request key so replying to one
  comment does not reset the others.
- **No more request failures swallowed.** Every axios call in
  `src/actions/index.js` had a `.then()` and no `.catch()`; a failed WP-API
  request left the UI on a permanent loading state. All calls now dispatch
  `REQUEST_FAILED`.
- **Posts without a featured image no longer emit a broken `<img>`.**
  `wp_get_attachment_image_src()` returns `false` for a missing image, so
  indexing `[0]` wrote PHP warnings and `null` into every size. The endpoint now
  returns early, and the article only renders the `<img>` when there is a URL.
- **Links inside post content no longer blank the post.**
  `src/containers/parts/content.js` called `.toLowerCase()` on the result of
  `getAttribute('target')`, which is `null` for any link without a `target`
  attribute — the common case — throwing a `TypeError` mid-render.
- **The "Next" link on the blog index pointed at `/category/undefined/page/2/`.**
  `PageNav.getSlug()` had a guard comparing the result of `typeof` against the
  string `'undefined'`, which is never true, so it always fell through and
  interpolated an undefined slug. Blog pagination now uses `/page/N/`.
- **Menu rendering no longer crashes on a missing or failed menu response.**
  `renderMenu()` indexed `menu.items` without checking it was an array, and
  `getRelativeUrl()` called `.substr()` on a possibly-null URL.
- **Menu items pointing at a deleted post no longer fatal.** `get_menu_item()`
  read `->post_name` off the result of `get_post()`, which is `null` once the
  target is gone — a fatal error on PHP 8. An empty `implode()` separator list
  was likewise a `TypeError`; both are handled.
- **`#react-main` lookups, `routerMatch.params` access and duplicate
  `document.title` assignments** were tidied up in `index.js`, `page-nav.js` and
  `category.js`.

### Changed

- **`redux-logger` is development-only.** It was installed unconditionally, so
  every action and the whole Redux state — post bodies and comment content — was
  written to the console of a live site on every dispatch. The webpack config now
  defaults `process.env.NODE_ENV` to `production`; `npm run watch` opts back in.
- **A lockfile is committed and CI installs from it.** `npm ci` cannot run
  without `package-lock.json`, so the existing CI job failed on its third step
  and had never actually run a test. `package-lock.json` (1,653 packages,
  integrity hashes recorded) is now committed, along with `.npmrc`,
  `.nvmrc` and an `engines` range.
- **Dependency hygiene.** `axios` moved from `^0.17` to `^1.7` (resolving to
  1.20.0), which is shipped to visitors and had known advisories. Removed
  `postcss-cssnext`, `postcss-import`, `cssnano` and `style-loader`, none of which
  the webpack config referenced. `package.json` is now `private` with real
  metadata and an `entry` that is not the build config.
- **Action creators return their promise**, so callers can await a request
  instead of guessing when it finished.

### Added

- **Unit tests.** 57 Jest tests over `src/actions/` and `src/reducers/`, with
  `coverageThreshold` enforced in `package.json` (98% statements, 92% branches,
  100% functions at time of writing). They cover the request lifecycle, the input
  validators, the error sanitiser and every reducer transition.
- **`src/reducers/requests-reducer.js`**, tracking each request's status and
  sanitised error, keyed by source.
- **Lint is enforced.** `npm run lint` runs ESLint with `--max-warnings=0`.
  `.eslintrc.json` was extended with the JSX parser options, the `RT_API` global,
  `no-console` and `eqeqeq`. Previously the config existed but nothing ran it.
- **CI runs lint, tests and the build** on the pinned Node from `.nvmrc`, with
  least-privilege `permissions`, concurrency cancellation, a built-bundle
  artifact, and a non-blocking `npm audit` job so build-tool debt stays visible.
  `Dependabot` is configured for npm and GitHub Actions on a weekly schedule.
- **`babel.config.js`**, scoped to the `test` environment so `babel-jest` can
  transform the ESM sources without touching what webpack 3 / Babel 6 ships.
- **Documentation.** The README now covers the architecture and layering, the
  route table, the `RT_API` contract, the build/test workflow and a security
  section. `CONTRIBUTING.md` and this changelog are new. `coverage/` is ignored.

### Known issues

- **`bundle.js` / `bundle.css` still need a rebuild.** They are committed build
  artifacts, and the JavaScript changes in this release are not in them yet.
  Rebuilding requires the pinned Node 14 toolchain (`nvm use && npm ci && npm run
  build`). The PHP changes are live without a rebuild.
- **The build toolchain is 2017-era** and pinned accordingly: webpack 3, Babel 6,
  `node-sass` 4, and the archived `react-addons-css-transition-group` shim whose
  React 15 peer dependency requires `legacy-peer-deps=true` in `.npmrc`. The
  README documents the ordered upgrade path.
- **The containers are not covered end to end.** Reducer and action behaviour is
  unit tested, but there is no jsdom/React Testing Library suite for the
  containers. That needs a modern test toolchain, which is blocked on the build
  upgrade above.
