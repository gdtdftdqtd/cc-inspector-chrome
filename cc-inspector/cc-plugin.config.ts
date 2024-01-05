// @ts-ignore
import {
  CocosPluginManifest,
  CocosPluginOptions,
  Panel,
  PluginType,
} from "cc-plugin/src/declare";

const pkgName = "cc-inspector";

function i18n(key: string) {
  return `i18n:${pkgName}.${key}`;
}

const manifest: CocosPluginManifest = {
  name: pkgName,
  version: "1.0.0",
  description: "cc-inspector",
  author: "xu_yanfeng",
  main: "./src/main.ts",
  panels: [
    {
      name: "main",
      type: Panel.Type.DockAble,
      main: "./src/panel/index.ts",
      title: "cc-inspector",
      width: 500,
      height: 400,
      minWidth: 50,
      minHeight: 400,
    },
  ],
  menus: [
    {
      path: `cc-inspector/${i18n("title")}`,
      message: {
        name: "showPanel",
      },
    },
  ],
  i18n_en: "./src/i18n/en.ts",
  i18n_zh: "./src/i18n/zh.ts",
  chrome: {
    view_devtools: "",
    view_options: "",
    view_popup: "",
    script_background: "",
    script_content: "",
    script_inject: "",
  },
};
// 这里的options变量名暂时不支持修改，发布时会进行必要的修改
const options: CocosPluginOptions = {
  server: {
    enabled: true,
    port: 2022,
  },
  watchBuild: true,
  outputProject: {
    web: "./web",
  },
};
export default { manifest, options };
