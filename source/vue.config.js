const Copy = require("./plugins/copy");
const Path = require("path");
module.exports = {
  publicPath: "/",
  outputDir: "dist",
  pages: {
    popup: "src/popup/index.ts",
    options: "src/options/index.ts",
    devtools: "src/devtools/index.ts",
  },
  pluginOptions: {
    browserExtension: {
      components: {
        background: true,
        contentScripts: true,
      },
      componentOptions: {
        contentScripts: {
          entries: {
            content: "src/content.ts",
            inject: "src/inject/index.ts",
          },
        },
        background: {
          entry: "src/background.ts",
        }
      }
    }
  },
  configureWebpack: {
    mode: "development",// production
    devtool: "#source-map",
  }
};
