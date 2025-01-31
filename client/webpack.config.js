const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack'); // Add this line
const path = require('path');

module.exports = (env) => {
  // Load environment variables from .env file (optional)
  const envKeys = Object.keys(process.env).reduce((prev, next) => {
    prev[`process.env.${next}`] = JSON.stringify(process.env[next]);
    return prev;
  }, {});

  return {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.js',
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
      }),
      new webpack.DefinePlugin(envKeys), // Inject environment variables
    ],
    devServer: {
      port: 3000,
    },
  };
};