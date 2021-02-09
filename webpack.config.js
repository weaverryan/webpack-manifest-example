const path = require('path');
const InlinedTestManifestPlugin = require('./inlined-test-manifest-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: '[name].[contenthash:8].js',
    assetModuleFilename: 'assets/[name].[hash:8][ext]',
    path: path.resolve(__dirname, 'dist'),
  },
  mode: 'development',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.(png)$/i,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new InlinedTestManifestPlugin()
  ]
};
