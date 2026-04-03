const path = require('path');
const fs = require('fs');

class CopyPublicAssetsPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('CopyPublicAssetsPlugin', (compilation) => {
      const publicDir = path.resolve(__dirname, 'public');
      const { RawSource } = compiler.webpack.sources;

      if (!fs.existsSync(publicDir)) return;

      const emitDirectory = (directoryPath, relativeBase = '') => {
        const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

        entries.forEach((entry) => {
          const fullPath = path.join(directoryPath, entry.name);
          const relativePath = path.posix.join(relativeBase, entry.name);

          if (entry.isDirectory()) {
            emitDirectory(fullPath, relativePath);
            return;
          }

          const fileContents = fs.readFileSync(fullPath);
          compilation.emitAsset(relativePath, new RawSource(fileContents));
        });
      };

      emitDirectory(publicDir);
    });
  }
}

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    chunkFilename: '[name].[contenthash:8].js',
    publicPath: '/',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  plugins: [
    new CopyPublicAssetsPlugin(),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    port: 3000,
    historyApiFallback: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
};
