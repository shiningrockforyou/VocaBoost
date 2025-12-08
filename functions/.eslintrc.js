module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
  extends: ["eslint:recommended"],
  globals: {
    require: "readonly",
    module: "readonly",
    exports: "readonly",
    __dirname: "readonly",
    __filename: "readonly",
    process: "readonly",
    Buffer: "readonly",
    global: "readonly",
  },
  rules: {
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
  },
};