import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "dist/**",
      "*.config.js",
      "*.config.mjs"
    ]
  },
  {
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "off",
      "no-console": "off"
    }
  }
];
