# Contributing

Thanks for helping out. This is a small theme, so the bar for a change is mostly
"it is tested and it does not break the bundle".

## Setup

```bash
git clone https://github.com/PreCogSecurity/a-wp-react-redux-theme.git
cd a-wp-react-redux-theme
nvm use            # Node 14, from .nvmrc
npm ci             # install exactly what package-lock.json pins
npm run verify     # lint + tests, same as CI
```

`npm ci` (not `npm install`) is what CI uses. If it fails with
"lock file out of sync", run `npm install` to refresh `package-lock.json` and
commit the result with your change.

## Pointing the theme at a local WordPress

1. Clone or copy this directory into `wp-content/themes/a-wp-react-redux-theme`
   of your local install. A symlink works and avoids copying builds:
   ```bash
   ln -s "$PWD" /path/to/wp-content/themes/a-wp-react-redux-theme
   ```
2. Activate the theme and assign menus to the `main_menu` and `footer_menu`
   locations.
3. Confirm the REST API is reachable at `https://your-site.test/wp-json/`. The
   theme reads that URL at runtime from `RT_API.root`; there is nothing to
   configure in the front end.
4. Set the comment policy under *Settings → Discussion*. With *Users must be
   registered and logged in to comment* enabled, the REST API rejects comments
   from logged-out visitors and the comment form shows the error.
5. Build the bundle (`npm run build`) and reload.

Useful URLs for checking a change:

| URL | What it exercises |
| --- | --- |
| `/` | Post index, dynamic menus |
| `/page/2` | Pagination |
| `/search/<term>` | Search, and search-term validation |
| `/category/<slug>/` | Category archive, taxonomy id resolution |
| `/tag/<slug>` | Tag archive |
| `/<any-post-slug>/` | Pretty permalink resolution, threaded comments |
| `/wp-json/react-theme/v1/menu-locations/main_menu` | Menu endpoint |

## Before you push

```bash
npm run verify     # eslint --max-warnings=0, then jest with coverage
npm run build      # regenerate bundle.js / bundle.css
```

CI additionally fails if `npm run build` errors, and publishes the freshly
built bundle as a workflow artifact.

## House rules

- **One focused commit per change, with its tests.** A change to
  `src/actions/` or `src/reducers/` that does not change a test in the same
  commit is not finished. Coverage thresholds in `package.json` are enforced, so
  a large untested addition fails the build.
- **Rebuild the bundle in the same commit** when you touch `src/` or `src/sass/`.
  WordPress serves `bundle.js` directly, so an uncommitted rebuild means the
  change is not actually live.
- **Do not hand-edit `bundle.js` or `bundle.css`.** They are generated.
- **No `console.log` in `src/`.** `no-console` is an error; use `console.error` /
  `console.warn` if you really need output, and prefer the `REQUEST_FAILED`
  lifecycle so the UI shows the problem instead of the console.
- **Validate at the boundary.** Route params, query strings and form state all
  end up in a URL or a request body. Validate them in `src/actions/index.js`
  rather than trusting the caller, and let an invalid value produce
  `REQUEST_FAILED` instead of a silently wrong request.
- **Never put credentials in the repo or in `RT_API`.** No API keys, no
  nonces in source, no `.env`. `RT_API` is serialized into the page source and is
  public by definition.
- **Escape output in PHP.** Hand-built markup must use `esc_attr()`, `esc_url()`,
  `esc_html()`; REST responses use `WP_Error` with a status rather than returning
  nothing.
- **Declare `permission_callback` on any new REST route.** WordPress 5.5+ rejects
  routes registered without one.

## Style

The codebase is not reformatted by this project, so match the file you are
editing:

- `src/containers/comments/*` and most reducers use **4 spaces**.
- `src/index.js`, `src/components/main.js`, `src/components/main/*` and
  `src/containers/parts/content.js` use **tabs**.
- `lib/*.php` uses **tabs**, and WP coding standards: spaces inside
  parentheses, Yoda-ish comparisons as in the existing code, and short array
  syntax.

ESLint runs with `eslint:recommended` plus `no-console`, `eqeqeq` and a
`varsIgnorePattern` of `^[A-Z]`. That last one exists because the project does
not depend on `eslint-plugin-react`, and without it every component used only
inside JSX looks unused. It still catches genuinely unused lowercase bindings,
which is where real mistakes live.

## Toolchain constraints

Node is pinned to 14 in `.nvmrc` and `engines`. `node-sass@4` has no prebuilt
bindings for Node 16+ and webpack 3 requires the OpenSSL 1.1 that Node 14
bundles, so a build on a modern Node will fail. If you are on a newer Node, use
`nvm use`.

`.npmrc` sets `legacy-peer-deps=true` because
`react-addons-css-transition-group@15` declares a React 15 peer dependency while
the project runs React 16; without the setting, npm 7+ refuses to build a tree
and `npm ci` fails outright. Please do not remove it as "cleanup" — if you remove
the shim, remove the setting in the same change.

## Releasing

1. Bump `version` in `package.json`.
2. Add the release to `CHANGELOG.md`.
3. `npm ci && npm run build`, commit `bundle.js` and `bundle.css`.
4. `npm run verify`.
5. Tag the release and zip the theme directory for WordPress.org, excluding
   `node_modules/`, `test/`, `coverage/`, `.github/` and the source `src/`
   directory if the bundle is committed.

## Reporting a security issue

Do not open a public issue. Email the maintainers with the details, the
affected file and a reproduction if you have one. Credential exposure, XSS and
comment-authorization problems are the priority: a comment created through the
REST API is stored and rendered to every visitor of that post.
