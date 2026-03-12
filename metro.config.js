const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Ensure Metro prefers React Native condition when resolving package exports.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = [
  "react-native",
  "browser",
  "require",
  "import",
  "default",
];

module.exports = config;
