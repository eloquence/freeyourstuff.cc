module.exports = {
  "parserOptions": {
    "ecmaVersion": 2017,
  },
  "globals": {
    "chrome": true
  },
  "env": {
    "browser": true,
    "es6": true
  },
  "extends": "eslint:recommended",
  "rules": {
    "linebreak-style": [
      "error",
      "unix"
    ],
    "quotes": [
      "error",
      "single"
    ],
    "semi": [
      "warn",
      "always"
    ],
    "no-console": "off",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" } ],
    "quotes": ["warn", "single", { "avoidEscape": true, allowTemplateLiterals: true }]
  }
};
