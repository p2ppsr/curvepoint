import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin"; // Correct import for typescript-eslint
import tsParser from "@typescript-eslint/parser"; // Parser for TypeScript
import pluginReact from "eslint-plugin-react";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"], // Matches JS, TS, and JSX/TSX files
    languageOptions: {
      parser: tsParser, // Use TypeScript parser
      globals: globals.browser, // Add browser globals
    },
    rules: {
      // Additional rules can be specified here if needed
    },
  },
  pluginJs.configs.recommended,
  tseslint.configs.recommended, // Spread is unnecessary for objects
  pluginReact.configs.flat.recommended,
];
