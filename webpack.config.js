//@ts-check

'use strict';

const path = require('path');
const TSLintPlugin = require('tslint-webpack-plugin');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node',

  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode',
    'applicationinsights-native-metrics': 'applicationinsights-native-metrics'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  plugins: [
    new TSLintPlugin({
      files: ['./src/**/*.ts'],
      config: './tslint.json',
      waitForLinting: true
    })
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  }
};
module.exports = config;