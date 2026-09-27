const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

/**
 * The bundle is loaded by WordPress in production, so the config defaults to a
 * production `process.env.NODE_ENV`. That matters for more than React's dev
 * warnings: `src/index.js` uses the value to decide whether to install
 * `redux-logger`, which otherwise dumps every action and the whole Redux state
 * (post bodies, comment content, ...) into the browser console of a live site.
 *
 * `npm run watch` passes `--env.development` to get the logger back while
 * working locally. If a CLI ever fails to forward `--env`, the default is
 * production, i.e. logging off - the safe direction to fail.
 */
module.exports = function (env) {
	const isDevelopment = Boolean(env && env.development);

	return {
		devtool: 'source-map',
		entry: './src/index.js',
		output: {
			path: __dirname,
			filename: 'bundle.js',
		},
		module: {
			rules: [
				{
					test: /\.jsx?$/,
					exclude: /(node_modules|bower_components)/,
					loader: 'babel-loader',
					query: {
						presets: ['env', 'stage-2', 'react', 'minify'],
					},
				},
				{
					test: /\.scss$/,
					exclude: /(node_modules|bower_components)/,
					use: ExtractTextPlugin.extract({
						use: [
							{
								loader: 'css-loader',
								options: {sourceMap: true},
							}, {
								loader: 'postcss-loader',
								options: {
									sourceMap: true,
									plugins: () => ([
										require('autoprefixer')({
											browsers: ['last 2 versions', 'ie > 8'],
										}),
									]),
								},
							}, {
								loader: 'sass-loader',
								options: {sourceMap: true},
							}],
					}),
				},
			],
		},
		plugins: [
			new ExtractTextPlugin({filename: 'bundle.css', allChunks: true}),
			new webpack.DefinePlugin({
				'process.env.NODE_ENV': JSON.stringify(isDevelopment ? 'development' : 'production'),
			}),
		],
	};
};
