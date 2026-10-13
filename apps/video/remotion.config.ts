import { Config } from "@remotion/cli/config";
import { webpackOverride } from "./webpack-override.ts";

Config.overrideWebpackConfig(webpackOverride);
Config.setJpegQuality(92);
Config.setDefaultEditor("vscode");
Config.setDefaultCodingAgent("claude-code");
Config.setPublicLicenseKey("free-license");
