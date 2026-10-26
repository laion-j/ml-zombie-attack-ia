const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  devtool: 'eval-source-map',
  output: {
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: [/\.vert$/, /\.frag$/],
        type: 'asset/source',
      },
      {
        test: /\.(gif|png|jpe?g|svg|xml)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      CANVAS_RENDERER: JSON.stringify(true),
      WEBGL_RENDERER: JSON.stringify(true),
      CANVAS_WIDTH: JSON.stringify(512),
      CANVAS_HEIGHT: JSON.stringify(544),
    }),
    new HtmlWebpackPlugin({
      template: './index.html',
    }),
    // modelo do detector (TFJS) servido como arquivo estático em /model/
    new CopyWebpackPlugin({
      patterns: [{ from: path.resolve(__dirname, '../src/ml/modelo'), to: 'model', noErrorOnMissing: true }],
    }),
  ],
};
