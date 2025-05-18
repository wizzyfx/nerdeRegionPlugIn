import CopyWebpackPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';
import type { Configuration as DevServerConfiguration } from 'webpack-dev-server';
import type { Configuration } from 'webpack';
import { version, author, description, homepage } from './package.json';

const devServer: DevServerConfiguration = {
  static: path.join(__dirname, 'build'),
  compress: true,
  port: 4000,
  liveReload: true,
};

const staticPages: HtmlWebpackPlugin[] = ['devtools', 'panel', 'popup'].map(
  (page) => {
    return new HtmlWebpackPlugin({
      filename: `${page}.html`,
      template: path.join(__dirname, 'src', page, 'index.html'),
      cache: false,
      chunks: [page],
    });
  }
);

const createManifest: CopyWebpackPlugin = new CopyWebpackPlugin({
  patterns: [
    {
      from: path.join(__dirname, 'src', 'manifest', 'manifest.json'),
      to: path.join(__dirname, 'build', 'manifest.json'),
      force: true,
      transform: function (content, path) {
        return Buffer.from(
          JSON.stringify({
            ...JSON.parse(content.toString()),
            version: version,
            author: author,
            description: description,
            homepage_url: homepage,
          })
        );
      },
    },
  ],
});

const createIcons: CopyWebpackPlugin = new CopyWebpackPlugin({
  patterns: [
    {
      from: path.join(__dirname, 'src', 'assets'),
      to: path.join(__dirname, 'build'),
      force: true,
      filter: (path) => path.endsWith('.png'),
    },
  ],
});

const config: Configuration = {
  entry: {
    inject: path.join(__dirname, 'src', 'content', 'index.ts'),
    panel: path.join(__dirname, 'src', 'panel', 'index.ts'),
    devtools: path.join(__dirname, 'src', 'devtools', 'index.ts'),
    service: path.join(__dirname, 'src', 'service', 'index.ts'),
    popup: path.join(__dirname, 'src', 'popup', 'index.ts'),
  },
  mode: 'development',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.(ts|js)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'esbuild-loader',
            options: {
              loader: 'ts',
              target: 'es6',
            },
          },
        ],
      },
      {
        test: /\.less$/i,
        use: ['style-loader', 'css-loader', 'less-loader'],
      },
      {
        test: /\.(png)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(woff2)$/i,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].js',
    clean: true,
  },
  plugins: [createManifest, createIcons, ...staticPages],
  devServer: devServer,
};

export default config;
