const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const exclusionList = require("metro-config/private/defaults/exclusionList").default;

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
config.watchFolders = [projectRoot];
config.resolver.blockList = exclusionList([
  new RegExp(`${workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[/\\\\]\\.next[/\\\\].*`)
]);

module.exports = config;
