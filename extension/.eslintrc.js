module.exports = {
  "globals": {
    "chrome": true
  },
  "env": {
    "browser": true,
    "es6": true
  },
  "extends": "eslint:recommended",
  "rules": {
    "indent": [
      "error",
      2,
      { 'SwitchCase': 1 }
    ],
    "linebreak-style": [
      "error",
      "unix"
    ],
    "quotes": [
      "error",
      "single"
    ],
    "semi": [
      "error",
      "always"
    ],
    "no-console": "off",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" } ],
    "quotes": ["warn", "single", { "avoidEscape": true, allowTemplateLiterals: true }]
  }
};
