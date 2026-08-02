// Functions-package flat config (eslint v9 resolves the NEAREST
// eslint.config.js, so runs inside functions/ get CommonJS-aware linting
// instead of the repo root's browser/ESM profile). [DEEPFIX2 r70 C8 — the
// package "lint" script's `|| exit 0` mask hid 38 spurious no-undef errors;
// this makes the real signal visible instead of silencing everything.]
const globals = {
  require: "readonly",
  module: "writable",
  exports: "writable",
  __dirname: "readonly",
  __filename: "readonly",
  process: "readonly",
  Buffer: "readonly",
  console: "readonly",
  global: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  URL: "readonly",
  fetch: "readonly",
};

module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals,
    },
    rules: {
      "no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "no-undef": "error",
    },
  },
];
