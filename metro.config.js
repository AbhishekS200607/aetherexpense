// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Required for Drizzle ORM: enable importing .sql migration files as inline text
config.resolver.sourceExts.push('sql');

module.exports = config;
