const path = require('path');
const webpack = require('webpack');
const InlinedTestManifestPlugin = require('../inlined-test-manifest-plugin');

const config = {
  context: __dirname,
  entry: '/fixtures/import_image.js',
  output: {
    filename: '[name].js',
    publicPath: '',
    path: path.join(__dirname, 'test-output'),
    assetModuleFilename: `images/[name].[hash:4][ext]`
  },
  mode: 'development',
  //optimization: { chunkIds: 'named' },
  module: {
    rules: [
      {
        test: /\.(png)/,
        type: 'asset/resource'
      }
    ]
  },
  plugins: [
    new InlinedTestManifestPlugin(),
  ],
};

const compiler = webpack(config);
compiler.run((error, stats) => {
  if (error) {
    throw error;
  }

  if (stats.hasErrors()) {
    console.log('Stat Errors', stats.toJson());
  }

  //console.log(stats);
});
