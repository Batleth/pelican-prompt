module.exports = [
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|\.webpack|__tests__|\.test\.|\.spec\.)/,
    use: {
      loader: 'ts-loader',
      options: {
        transpileOnly: true
      }
    }
  }
];
