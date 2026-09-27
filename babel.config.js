/**
 * Babel configuration.
 *
 * The production bundle is produced by webpack + babel-loader, which is still
 * pinned to Babel 6 (see the `query.presets` block in webpack.config.js) so
 * that the legacy toolchain keeps working. Babel 6 ignores this file entirely.
 *
 * This config exists so that `babel-jest` (Babel 7) can transform the ESM /
 * JSX-flavoured sources under `src/` for the unit tests. It is scoped to the
 * `test` environment so it can never change what webpack ships.
 */
module.exports = {
  env: {
    test: {
      presets: [
        ['@babel/preset-env', {targets: {node: 'current'}}]
      ]
    }
  }
};
