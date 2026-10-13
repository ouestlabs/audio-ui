import { Config } from "@remotion/cli/config";
import { webpackOverride } from "./webpack-override.ts";

Config.overrideWebpackConfig(webpackOverride);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
