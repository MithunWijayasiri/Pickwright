const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

// Build target drives manifest shape and output directory.
//   TARGET=chrome  (default) → service-worker background, no gecko settings → dist/
//   TARGET=firefox           → scripts background + gecko settings        → dist-firefox/
const TARGET = process.env.TARGET || 'chrome';
const OUT_DIR = process.env.OUT_DIR || 'dist';

module.exports = {
  entry: {
    background: './src/background/index.ts',
    content: './src/content/picker.ts',
    popup: './src/popup/index.tsx',
    // Engine unit-test harness — gated so production builds never carry it.
    ...(process.env.TEST_HARNESS
      ? { 'engine-harness': './tests/engine/harness-entry.ts' }
      : {}),
  },
  output: {
    path: path.resolve(__dirname, OUT_DIR),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: [/node_modules/, path.resolve(__dirname, 'tests')],
      },
      {
        // Test harness sits outside the root tsconfig's rootDir (./src), so it
        // needs the test config or ts-loader fails with TS6059.
        test: /\.tsx?$/,
        include: path.resolve(__dirname, 'tests'),
        use: { loader: 'ts-loader', options: { configFile: 'tsconfig.test.json' } },
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              // Drop legacy .woff fallbacks — Chrome only needs .woff2.
              url: { filter: (url) => !url.endsWith('.woff') },
            },
          },
        ],
      },
      {
        test: /\.woff2$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]',
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/manifest.json',
          to: 'manifest.json',
          // Emit a browser-specific manifest. Chrome ignores `scripts` and
          // chokes on store validation if both background keys ship; Firefox
          // MV3 uses event-page `scripts` and needs `browser_specific_settings`.
          transform(content) {
            const manifest = JSON.parse(content.toString());
            if (TARGET === 'firefox') {
              manifest.background = { scripts: ['background.js'] };
            } else {
              manifest.background = { service_worker: 'background.js' };
              delete manifest.browser_specific_settings;
            }
            return JSON.stringify(manifest, null, 2);
          },
        },
        { from: 'src/icons', to: 'icons', noErrorOnMissing: true },
      ],
    }),
    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup'],
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
  ],
  optimization: {
    splitChunks: false,
  },
  devtool: process.env.NODE_ENV === 'production' ? false : 'cheap-module-source-map',
};
