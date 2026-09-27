# A React + Redux WordPress theme

WordPress theme that renders its front end with React and Redux on top of the
WordPress REST API. The PHP layer of the theme is deliberately thin: it registers
a few REST routes, hands the browser its runtime configuration, and lets the
React application do the rendering.

> **Note on the committed bundle.** WordPress serves `bundle.js` and `bundle.css`
> straight out of the theme directory, so both are committed. They are build
> artifacts: after changing anything under `src/`, rebuild and commit them, or
> the running site will keep executing the old code. See
> [Rebuilding the bundle](#rebuilding-the-bundle).

## Live Demo

[The theme running on the author's site.](http://www.jackreichert.com/)

## Why?

To explore the WP REST API, ES6 and transpiling, and to build a full project
with React + Redux. The author wrote about the journey
[on his blog](https://www.jackreichert.com/2017/01/developing-a-theme-for-wordpress-using-reactjs-redux-and-the-wp-rest-api/).

## Features

- Dynamic menus (main menu + footer menu)
- Template pages equivalent to `index.php`, `single.php`, `search.php` and
  `category.php`, but in React/Redux
- Search
- Category archive pages and first-level sub-categories
- Tags
- Bootstrap 4
- Threaded comments
- Dynamic `<head>` title tag

## Requirements

| Component | Version | Why |
| --- | --- | --- |
| WordPress | 5.5+ | The theme's REST routes declare an explicit `permission_callback`, which older releases do not expect. 5.5 also removed the last of the React-era WP APIs this theme used. |
| PHP | 7.4+ | The theme uses short array syntax and `??`-free constructs only, but runs on the PHP versions WordPress 5.5+ supports. |
| Node | 14.x | Pinned in `.nvmrc`. `node-sass@4` has no prebuilt bindings for Node > 14 and webpack 3 needs the OpenSSL 1.1 that Node 14 bundles. See [Toolchain notes](#toolchain-notes). |
| npm | 6+ | `npm ci` is what CI uses. |

## Installation

### As a WordPress theme

1. Copy the theme into `wp-content/themes/a-wp-react-redux-theme`.
2. Activate **A React+Redux WordPress theme** under *Appearance → Themes*.
3. Assign menus to the `main_menu` and `footer_menu` locations under
   *Appearance → Menus*.
4. Set **Settings → Discussion → Users must be registered and logged in to
   comment** according to your policy. The theme honours this setting: when it
   is on, the REST API rejects comments from logged-out visitors and the comment
   form reports the rejection instead of silently losing the comment.

### From a fresh clone (development)

```bash
git clone https://github.com/PreCogSecurity/a-wp-react-redux-theme.git
cd a-wp-react-redux-theme
nvm use            # picks up .nvmrc
npm ci             # reproducible install from package-lock.json
npm run build      # writes bundle.js / bundle.css
```

`npm ci` requires `package-lock.json` to be in sync with `package.json`; that is
exactly what CI enforces, so a green `verify` job means your clone is good.

## Architecture

```
functions.php                  Bootstrap: guards, includes, wiring
header.php / footer.php        Server-rendered <head>, nav, footer
index.php                      Server-rendered fallback (hidden once React boots)
style.css                      Theme header + Bootstrap-dependent tweaks

lib/
  theme-helpers.php            Small template helpers
  theme-support.php            Theme supports, menus, search form, comment policy
  theme-enqueue.php            Asset loading + the RT_API runtime config
  theme-endpoints.php          Registers the REST endpoints below
  endpoints/
    add-featured-image.php     rest_prepare_post: adds featured_image_url
    add-formatted-date.php     rest_prepare_post: adds formatted_date
    menus.php                  react-theme/v1/menus + /menu-locations
    pretty-permalinks.php      react-theme/v1/prettyPermalink/<path>

src/
  index.js                     Store construction, middleware, router, mount
  actions/index.js             Every REST call, input validation, error handling
  reducers/                    One pure reducer per slice + requests-reducer
  components/                  Presentational, not connected
  containers/                  Connected to the store and/or the router
```

The layering is the standard Redux one and worth keeping intact:

- **`src/actions/index.js`** is the only module that talks to the network. It
  validates every value that comes from a route, a query string or form state
  before it reaches a URL or a request body, brackets each call with
  `REQUEST_PENDING` / `REQUEST_SUCCEEDED` / `REQUEST_FAILED`, and converts
  failures into a sanitised `{message, status}` pair. Raw axios errors are never
  stored: they carry the `X-WP-Nonce` header and the full request config.
- **`src/reducers/`** are pure `(state, action) => state` functions.
  `requests-reducer.js` tracks the lifecycle of each request, keyed by the
  `source` the action creator passed.
- **`src/components/`** render props. They are not connected to the store.
- **`src/containers/`** are connected to the store and/or the router. This is
  where route params enter the application.

### Routes

| URL | Container | Notes |
| --- | --- | --- |
| `/` | `blog` | Post index |
| `/page/:pageNum` | `blog` | Post index, paged |
| `/search/:term` | `search` | Search results |
| `/category/:slug/` | `category` | Also handles `/category/:parent/:slug/` |
| `/tag/:slug` | `tag` | |
| `*` | `single` | Pretty permalink, resolved server-side |

## Runtime configuration (`RT_API`)

There is no `.env` file. The theme is a WordPress theme, so its runtime
configuration is produced by the server: `lib/theme-enqueue.php` calls
`wp_localize_script()` and the browser gets a `RT_API` global before `bundle.js`
runs. Treat these values as public.

| Key | Source | Purpose |
| --- | --- | --- |
| `root` | `esc_url_raw( rest_url() )` | REST API root, e.g. `https://example.com/wp-json/` |
| `nonce` | `wp_create_nonce( 'wp_rest' )` | Sent as `X-WP-Nonce` when posting a comment |
| `siteName` | `get_bloginfo( 'name' )` | Header and `<title>` |
| `baseUrl` | `get_bloginfo( 'url' )` | Site root, used to turn in-content links into router links |
| `siteDescription` | `get_bloginfo( 'description' )` | `<title>` |
| `categories` | `get_categories()` | `{term_id, name, slug, link}[]` for the category links on a post |
| `allowAnonymousComments` | *Discussion settings* | Whether logged-out visitors may comment |

`RT_API` deliberately contains **no user object**. An earlier revision passed
`wp_get_current_user()` here, which `wp_localize_script()` serialised in full —
including the password hash and the password-reset activation key — into the HTML
source of every page. If you add keys to this array, keep it to public site
metadata; never add a `WP_User`, an option row, or anything else holding
credentials.

For local work, override anything in `src/` with a `define`/mock; there is no
build-time env plumbing to configure.

## Development

```bash
npm run watch     # webpack --watch, with redux-logger enabled
npm run lint      # eslint, --max-warnings=0
npm test          # jest with coverage and enforced thresholds
npm run verify    # lint + test, the same thing CI runs before the build
npm run build     # production bundle (logger off)
npm run prod      # production bundle, minified
```

`npm run build` and `npm run prod` both default `process.env.NODE_ENV` to
`production`, which is what disables `redux-logger`. Only `npm run watch` opts
into the logger — in production it would print every dispatched action and the
entire Redux state (post bodies, comment content) to the console of a live site.
If `--env.development` ever fails to reach the config, the default is still
production, so logging stays off.

### Rebuilding the bundle

```bash
nvm use
npm ci
npm run build
git add bundle.js bundle.css
```

Keep `bundle.js` and `bundle.css` in sync with `src/` and `src/sass/` in the same
commit. CI builds the bundle and publishes it as a workflow artifact so you can
review and commit it without a local Node 14 environment.

## Testing

```bash
npm test
```

Jest runs in a `node` environment and covers `src/actions/` and `src/reducers/`
— the two layers where a regression is both most likely and most expensive.
Coverage thresholds are enforced by `coverageThreshold` in `package.json`, so a
drop below 80% statements fails `npm test` rather than being quietly ignored.

`test/setup.js` installs the `RT_API` global with inert placeholder values before
`src/actions/index.js` is imported; the module reads that global at import time.
If you add a key to `RT_API` and the actions module starts using it, add it to
the fixture too.

`axios` is mocked in `test/actions.test.js`. The assertions are about the
dispatched action types, the request URL/params and the field whitelist — not
about axios itself.

## Security notes

- **Comment authorization.** `rest_allow_anonymous_comments` is no longer forced
  to `true`. The theme mirrors the classic `wp-comments-post.php` gate and
  respects *Users must be registered and logged in to comment*. Override with the
  `react_theme_allow_anonymous_comments` filter.
- **Comment payload.** `createComment` whitelists the fields it sends, so an
  unexpected key in form state cannot smuggle `status` or `user_id` to the API.
  Field lengths are capped client-side; the server remains authoritative.
- **Query construction.** User-supplied values (post type, taxonomy, ids, search
  term, permalink, menu location) are validated against explicit patterns and
  passed to axios' `params` serialiser rather than concatenated into the query
  string, so a crafted URL cannot inject extra path segments or query parameters.
- **REST routes.** All four menu routes and the pretty-permalink route declare
  `permission_callback`. The permalink route rejects absolute URLs, `..`
  traversal, control characters and oversized input, and returns a real 404
  instead of constructing a controller for a non-existent post.
- **Third-party assets.** The Bootstrap CDN stylesheet is pinned with a
  Subresource Integrity hash. If you change the URL or version, recompute the
  hash or the stylesheet will be blocked.
- **HTML escaping.** Hand-built PHP markup (the search form, `Theme_Helpers`)
  escapes every interpolated value.
- **`dangerouslySetInnerHTML`.** Post and comment bodies are rendered as raw
  HTML, as they must be. This relies on the server-side sanitisation WordPress
  applies when producing `content.rendered`; the theme does not relax it, and it
  is the reason a content-level XSS in a plugin is a site-level XSS.

## Toolchain notes

The build chain is 2017-era: webpack 3, Babel 6, `node-sass` 4 and the archived
`react-addons-css-transition-group` shim. Two consequences:

- **Node is pinned to 14** in `.nvmrc` and `engines`. `node-sass@4` has no
  prebuilt bindings for Node 16+, and webpack 3 needs OpenSSL 1.1. CI installs
  with that Node, so `npm ci` has to build `node-sass` from a prebuilt binding
  rather than compiling it.
- **`.npmrc` sets `legacy-peer-deps=true`.** `react-addons-css-transition-group@15`
  declares `peerDependencies: {react: "^15.4.2"}` while the project runs React 16.
  npm 7+ refuses to build a tree for that, which broke `npm ci` entirely. The
  setting restores npm 6's permissive peer resolution; it does not weaken
  lockfile integrity or skip `npm audit`.

The build-time dependencies never reach production: WordPress serves the
pre-compiled `bundle.js`/`bundle.css` plus the PHP. The advisories that `npm audit`
reports against this tree are therefore mostly build-tool debt. The `audit` CI job
reports them without failing the build so the debt stays visible.

The upgrade path, in order: `node-sass` → `sass` (dart-sass) and
`sass-loader` 7+, webpack 3 → 5, Babel 6 → `@babel/preset-env` +
`babel-loader` 8+, `react-addons-css-transition-group` → `react-transition-group`,
`redux-logger` → removed or a dev-only entry point. Each step needs its own
commit and a rebuilt bundle.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes to `src/actions/` or
`src/reducers/` need tests in the same commit — that is what keeps
`npm test` meaningful.

## To Do

- Widgets
- Static home page
- Analytics reporting
- SEO
- more...

## What does it look like?

![it looks like this](screenshot.png)

## License

GPL-2.0. See [LICENSE](LICENSE).
