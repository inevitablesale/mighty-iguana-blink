import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact_hooks from "eslint-plugin-react-hooks";
import pluginReact_refresh from "eslint-plugin-react-refresh";

export default [
  {
    languageOptions: {
      globals: globals.browser,
    },
    ignores: ["supabase/functions/**"], // This is the fix.
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": pluginReact_hooks,
      "react-refresh": pluginReact_refresh,
    },
    rules: {
      "react-refresh/only-export-components": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];