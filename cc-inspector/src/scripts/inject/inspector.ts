// eval 注入脚本的代码,变量尽量使用var,后来发现在import之后,let会自动变为var
import { uniq } from "lodash";
import { Msg, PluginEvent, RequestLogData, RequestNodeInfoData, RequestSetPropertyData, ResponseGameInfoData, ResponseNodeInfoData, ResponseSetPropertyData, ResponseSupportData, ResponseTreeInfoData } from "../../core/types";
import { ArrayData, BoolData, ColorData, DataType, EngineData, Group, ImageData, Info, InvalidData, NodeInfoData, NumberData, ObjectCircleData, ObjectData, Property, StringData, TreeData, Vec2Data, Vec3Data, Vec4Data } from "../../views/devtools/data";
import { InjectEvent } from "./event";
import { Hint } from "./hint";
import { injectView } from "./inject-view";
import { inspectTarget } from "./inspect-list";
import { getValue, trySetValueWithConfig } from "./setValue";
import { BuildArrayOptions, BuildImageOptions, BuildObjectOptions, BuildVecOptions } from "./types";
import { isHasProperty } from "./util";

declare const cc: any;
export class Inspector extends InjectEvent {
  inspectorGameMemoryStorage: Record<string, any> = {};
  private hint: Hint = new Hint(this);

  private getAtlasViewFunction() {
    // 之前只有v2版本支持
    return cc?.dynamicAtlasManager?.showDebug;
  }
  onMessage(pluginEvent: PluginEvent): void {
    switch (pluginEvent.msg) {
      case Msg.RequestSupport: {
        const isCocosGame = this._isCocosGame();
        this.notifySupportGame(isCocosGame);
        break;
      }
      case Msg.RequstTreeInfo: {
        this.updateTreeInfo();
        break;
      }
      case Msg.VisibleFPS: {
        const b = pluginEvent.data as boolean;
        if (b) {
          if (cc.profiler?.showStats) {
            cc.profiler.showStats();
          } else if (cc.debug?.setDisplayStats) {
            cc.debug.setDisplayStats(true);
          }
        } else {
          if (cc.profiler?.hideStats) {
            cc.profiler.hideStats();
          } else if (cc.debug?.setDisplayStats) {
            cc.debug.setDisplayStats(false);
          }
        }
        break;
      }
      case Msg.RequestGameInfo: {
        const ret = new ResponseGameInfoData();
        const atlasManager = cc?.dynamicAtlasManager || cc.internal?.dynamicAtlasManager || null;
        if (atlasManager) {
          ret.dynamicAtals.enable = atlasManager.enabled;
          ret.dynamicAtals.atlasCount = atlasManager.atlasCount;
          ret.dynamicAtals.maxAtlasCount = atlasManager.maxAtlasCount;
          ret.dynamicAtals.maxFrameSize = atlasManager.maxFrameSize;
          ret.dynamicAtals.textureSize = atlasManager.textureSize;
          ret.dynamicAtals.textureBleeding = atlasManager.textureBleeding;
          ret.dynamicAtals.supportView = !!this.getAtlasViewFunction();
          this.sendMsgToContent(Msg.ResponseGameInfo, ret);
        }
        break;
      }
      case Msg.RequestDynamicAtlasView: {
        const b = pluginEvent.data as boolean;
        const cb = this.getAtlasViewFunction();
        if (cb) {
          cb(b);
          this.sendMsgToContent(Msg.ResponseDynamicAtlasView, b);
        }
        break;
      }
      case Msg.RequestNodeInfo: {
        const data = pluginEvent.data as RequestNodeInfoData;
        this.getNodeInfo(data.uuid);
        break;
      }
      case Msg.RequestSetProperty: {
        const data: RequestSetPropertyData = pluginEvent.data;
        let value = data.data;
        if (data.type === DataType.Color) {
          // @ts-ignore
          value = cc.color().fromHEX(value);
        }

        if (this.setValue(data.path, value)) {
          this.sendMsgToContent(Msg.ResponseSetProperty, data as ResponseSetPropertyData);
        } else {
          console.warn(`设置失败：${data.path}`);
        }
        break;
      }
      case Msg.RequestLogData: {
        const data: RequestLogData = pluginEvent.data;
        const value = getValue(this.inspectorGameMemoryStorage, data);
        // 直接写console.log会被tree shaking
        const logFunction = console.log;
        logFunction(value);
        break;
      }
      case Msg.RequestLogCustom: {
        const logFunction = console.log;
        logFunction(pluginEvent.data);
        break;
      }
      case Msg.ReqWriteClipboard: {
        navigator.clipboard
          .writeText(pluginEvent.data)

          .then(() => {
            console.log("ok");
          })
          .catch((e) => {
            console.log("fail", e);
          });
        break;
      }
      case Msg.RequestVisible: {
        const uuid: string = pluginEvent.data;
        const node = this.inspectorGameMemoryStorage[uuid];
        if (node) {
          node.active = !node.active;
        }
        break;
      }
      case Msg.HoverNode: {
        const uuid: string = pluginEvent.data;
        if (uuid) {
          const node = this.inspectorGameMemoryStorage[uuid];
          if (node && node.isValid) {
            this.hint.setHover(node);
          } else {
            this.hint.cleanHover();
          }
        } else {
          this.hint.cleanHover();
        }
        break;
      }
      case Msg.SelectNode: {
        const uuid: string = pluginEvent.data;
        if (uuid) {
          const node = this.inspectorGameMemoryStorage[uuid];
          if (node && node.isValid) {
            this.hint.setSelected(node);
          } else {
            this.hint.cleanSelected();
          }
        } else {
          this.hint.cleanSelected();
        }
        break;
      }
      case Msg.RequestDestroy: {
        const uuid: string = pluginEvent.data;
        const node = this.inspectorGameMemoryStorage[uuid];
        if (node && node.isValid && node.destroy) {
          node.destroy();
        }
        break;
      }
    }
  }
  init() {
    console.log(...this.terminal.init());
    this.watchIsCocosGame();
  }

  private watchIsCocosGame() {
    const timer = setInterval(() => {
      const b = this._isCocosGame();
      if (b) {
        clearInterval(timer);
        injectView.init();
        cc.director.on(cc.Director.EVENT_AFTER_DRAW, () => {
          this.hint.update();
        });
        const version = this.getEngineVersion();
        this.hint.setEngineVersion(version);
        if (b && version) {
          this.uploadEngineVersion(version);
        }
      }
    }, 300);
  }
  private getEngineVersion(): string {
    if (this._isCocosGame()) {
      return cc.ENGINE_VERSION || "";
    } else {
      return "";
    }
  }
  public isCreatorV2() {
    return this.getEngineVersion().startsWith("2.");
  }
  public isCreatorV3() {
    return this.getEngineVersion().startsWith("3.");
  }
  notifySupportGame(b: boolean) {
    const version = this.getEngineVersion();
    this.sendMsgToContent(Msg.ResponseSupport, { support: b, msg: "", version } as ResponseSupportData);
  }
  /**
   * 防止后台收到大量的Engine版本数据，每次调试只上传一次
   */
  private hasUploadEngineVersion = false;
  private uploadEngineVersion(version: string) {
    if (this.hasUploadEngineVersion) {
      return;
    }
    if (version) {
      this.hasUploadEngineVersion = true;
      this.sendEngineVersion(version);
    }
  }
  forEachNode(cb: (node: any) => void) {
    for (let key in this.inspectorGameMemoryStorage) {
      const item = this.inspectorGameMemoryStorage[key];
      if (item && item.isValid && item instanceof cc.Node) {
        if (inspectTarget.enabled) {
          if (inspectTarget.checkNodeComponentsIsInList(item)) {
            cb(item);
          }
        } else {
          cb(item);
        }
      }
    }
  }
  updateTreeInfo(notify: boolean = true) {
    let isCocosCreatorGame = this._isCocosGame();
    if (isCocosCreatorGame) {
      let scene = cc.director.getScene();
      if (scene) {
        let treeData = new TreeData();
        this.getNodeChildren(scene, treeData);
        notify && this.sendMsgToContent(Msg.ResponseTreeInfo, treeData as ResponseTreeInfoData);
      } else {
        let treeData = new TreeData();
        treeData.id = "";
        treeData.text = "empty scene";
        notify && this.sendMsgToContent(Msg.ResponseTreeInfo, treeData as ResponseTreeInfoData);
      }
    } else {
      notify && this.notifySupportGame(false);
    }
  }

  // 收集节点信息
  getNodeChildren(node: any, data: TreeData) {
    data.id = node.uuid;
    data.text = node.name;
    // @ts-ignore
    if (node instanceof cc.Scene) {
      // 场景不允许获取active，引擎会报错
    } else {
      data.active = !!node.active;
    }
    this.inspectorGameMemoryStorage[node.uuid] = node;
    let nodeChildren = node.children;
    for (let i = 0; i < nodeChildren.length; i++) {
      let childItem = nodeChildren[i];
      let treeData = new TreeData();
      this.getNodeChildren(childItem, treeData);
      data.children.push(treeData);
    }
  }

  _isCocosGame() {
    // @ts-ignore 检测是否包含cc变量
    return typeof cc !== "undefined";
  }

  getAllPropertyDescriptors(obj: Object): string[] {
    let keys: string[] = [];

    function circle(root: Object) {
      const descriptors = Object.getOwnPropertyDescriptors(root);
      for (let descriptorsKey in descriptors) {
        if (Object.hasOwnProperty.call(descriptors, descriptorsKey)) {
          const value = descriptors[descriptorsKey];
          // 不可枚举的属性，并且允许修改get set的才有效
          if (!value.enumerable && value.configurable) {
            keys.push(descriptorsKey);
          }
        }
      }
      const proto = Object.getPrototypeOf(root);
      if (proto) {
        circle(proto);
      }
    }

    circle(obj);
    return keys;
  }

  isExcludeProperty(node: any, key: string) {
    const mapArray = [
      {
        type: cc.UITransformComponent || cc.UITransform,
        keys: ["priority"],
      },
      {
        type: null, // null 表示所有适配类型
        keys: [
          "children",
          "quat",
          "node",
          "components",
          "enabledInHierarchy",
          "hideFlags",
          "isValid",
          "parent",
          // 生命周期函数
          "onFocusInEditor",
          "onRestore",
          "start",
          "lateUpdate",
          "update",
          "resetInEditor",
          "onLostFocusInEditor",
          "onEnable",
          "onDisable",
          "onDestroy",
          "onLoad",
          "internalLateUpdate",
          "internalOnDestroy",
          "internalOnEnable",
          "internalOnDisable",
          "internalUpdate",
          "internalPreload",
          "internalOnLoad",
          "internalStart",
        ],
      },
    ];
    for (let i = 0; i < mapArray.length; i++) {
      const { type, keys } = mapArray[i];
      if (type === null) {
        if (keys.find((v) => v === key)) {
          return true;
        }
      } else {
        if (type && node instanceof type) {
          if (keys.find((v) => v === key)) {
            return true;
          }
        }
      }
    }
    return false;
  }
  _getNodeKeys(node: any) {
    // 3.x变成了getter
    const keyHidden = this.getAllPropertyDescriptors(node);
    const keyVisible1 = Object.keys(node); // Object不走原型链
    let keyVisible2: string[] = [];
    for (let nodeKey in node) {
      // 走原型链
      keyVisible2.push(nodeKey);
    }
    let allKeys: string[] = uniq(keyHidden.concat(keyVisible1, keyVisible2)).sort();
    allKeys = allKeys.filter((key) => {
      return !key.startsWith("_") && !this.isExcludeProperty(node, key);
    });

    allKeys = allKeys.filter((key) => {
      try {
        this.warnSilent(true);
        const type = typeof node[key];
        this.warnSilent(false);
        return type !== "function";
      } catch (e) {
        // console.warn(`属性${key}出现异常：\n`, e);
        return false;
      }
    });
    return allKeys;
  }

  _getPairProperty(key: string): null | { key: string; values: string[] } {
    let pairProperty: Record<string, any> = {
      rotation: ["rotationX", "rotationY"],
      anchor: ["anchorX", "anchorY"],
      size: ["width", "height"],
      skew: ["skewX", "skewY"],
      position: ["x", "y", "z"], // position比较特殊，过来的key就是position也需要能处理
      scale: ["scaleX", "scaleY", "scaleZ"],
    };
    for (let pairPropertyKey in pairProperty) {
      if (pairProperty.hasOwnProperty(pairPropertyKey)) {
        let pair = pairProperty[pairPropertyKey];
        if (pair.includes(key) || key === pairPropertyKey) {
          return { key: pairPropertyKey, values: pair };
        }
      }
    }
    return null;
  }

  _buildVecData(options: BuildVecOptions) {
    const ctor: Function = options.ctor;
    const keys = options.keys;
    const value: Object = options.value;
    const data: Vec3Data | Vec2Data = options.data;
    const path: Array<string> = options.path;

    if (ctor && value instanceof ctor) {
      let hasUnOwnProperty = keys.find((item) => !value.hasOwnProperty(item.key));
      if (!hasUnOwnProperty) {
        for (let key in keys) {
          const propName = keys[key].key;
          const stepFunc = keys[key].step;
          const disabledFunc = keys[key].disabled;

          if (value.hasOwnProperty(propName)) {
            let propPath = path.concat(propName);
            let itemData = this._genInfoData(value, propName, propPath);
            if (itemData) {
              if (itemData instanceof NumberData) {
                if (stepFunc) {
                  itemData.step = stepFunc(propName);
                } else if (options.step) {
                  itemData.step = options.step;
                } else {
                  itemData.step = 1;
                }
                itemData.disabled = disabledFunc ? disabledFunc(propName, itemData) : false;
              }
              data.add(new Property(propName, itemData));
            }
          }
        }
        return data;
      }
    }
    return null;
  }

  private getUrl() {
    const url = window.location.href;
    const arr = url.split("/");
    if (arr[arr.length - 1].indexOf(".html") > -1) {
      arr.pop();
    }
    const ret = arr.join("/");
    return ret;
  }
  _buildImageData(options: BuildImageOptions) {
    const ctor: Function = options.ctor;
    const value: Object = options.value;
    const data: ImageData = options.data;
    const path: Array<string> = options.path;
    if (ctor && value instanceof ctor) {
      data.path = path;
      // 2.4.6 没有了这个属性
      if (value.hasOwnProperty("_textureFilename")) {
        //@ts-ignore
        data.data = `${this.getUrl()}/${value._textureFilename}`;
      } else {
        data.data = null;
      }
      const desc = [];
      if (value["_rect"]) {
        const rect = value["_rect"];
        desc.push(`frame[${rect.width}*${rect.height}]`);
      }
      if (value["_texture"]) {
        const texture = value["_texture"];
        desc.push(`texture[${texture.width}*${texture.height}]`);
      }
      data.desc = desc.join(",");
      return data;
    }
    return null;
  }
  private warnSilent(v: boolean) {
    if (typeof cc !== undefined && typeof cc.warn === "function") {
      if (v) {
        cc.warn = () => {};
      } else {
        cc.warn = console.warn.bind(console);
      }
    }
  }
  private isDisabledX(node: any, item: Info) {
    const widget = node.getComponent(cc.Widget);
    if (widget && widget.enabled) {
      if (widget.isAlignLeft) {
        item.tip = "widget.isAlignLeft";
        return true;
      }
      if (widget.isAlignRight) {
        item.tip = "widget.isAlignRight";
        return true;
      }
    }
    item.tip = "";
    return false;
  }
  private isDisabledY(node: any, item: Info) {
    const widget = node.getComponent(cc.Widget);
    if (widget && widget.enabled) {
      if (widget.isAlignTop) {
        item.tip = "widget.isAlignTop";
        return true;
      }
      if (widget.isAlignBottom) {
        item.tip = "widget.isAlignBottom";
        return true;
      }
    }
    item.tip = "";
    return false;
  }
  private getDisabled(node: any, key: string | number, v: string, item: Info) {
    if (typeof key !== "string") {
      return false;
    }
    const cfgArray: Array<{ type: any; keys: Array<{ key: string; disabled: () => boolean }> }> = [
      {
        type: cc.Node,
        keys: [
          {
            key: "position.x",
            disabled: () => {
              return this.isDisabledX(node, item);
            },
          },
          {
            key: "position.y",
            disabled: () => {
              return this.isDisabledY(node, item);
            },
          },
        ],
      },
    ];
    for (let i = 0; i < cfgArray.length; i++) {
      const { type, keys } = cfgArray[i];
      if (node instanceof type) {
        const ret = keys.find((item) => item.key === `${key.trim()}.${v.trim()}`);
        if (ret) {
          return ret.disabled();
        }
      }
    }
    return false;
  }
  private getStep(node: any, key: string | number) {
    if (typeof key !== "string") {
      return 1;
    }
    const cfgArray: Array<{ type: any; keys: Array<{ key: string; step: number }> }> = [];
    if (cc.Node) {
      cfgArray.push({
        type: cc.Node,
        keys: [
          { key: "anchorX", step: 0.1 },
          { key: "anchorY", step: 0.1 },
          { key: "scaleX", step: 0.1 },
          { key: "scaleY", step: 0.1 },
          { key: "scale", step: 0.1 },
          { key: "worldScale", step: 0.1 },
        ],
      });
    }
    const tr = cc.UITransformComponent || cc.UITransform;
    if (tr) {
      cfgArray.push({
        type: tr,
        keys: [{ key: "anchorPoint", step: 0.1 }],
      });
    }
    for (let i = 0; i < cfgArray.length; i++) {
      const { type, keys } = cfgArray[i];
      if (node instanceof type) {
        const ret = keys.find((item) => item.key === key);
        if (ret) {
          return ret.step;
        }
      }
    }
    return 1;
  }
  _genInfoData(node: any, key: string | number, path: Array<string>): Info | null {
    this.warnSilent(true);
    const propertyValue = node[key];
    this.warnSilent(false);
    const make = (info: Info | null) => {
      info.readonly = this._isReadonly(node, key);
      info.path = path;
      return info;
    };

    let invalidType = this._isInvalidValue(propertyValue);
    if (invalidType) {
      const info = new InvalidData(invalidType);
      return make(info);
    }
    switch (typeof propertyValue) {
      case "boolean": {
        const info = new BoolData(propertyValue);
        return make(info);
      }
      case "number": {
        const info = new NumberData(propertyValue);
        info.step = this.getStep(node, key);
        return make(info);
      }
      case "string": {
        const info = new StringData(propertyValue);
        return make(info);
      }
    }

    if (propertyValue instanceof cc.Color) {
      let hex = propertyValue.toHEX();
      const info = new ColorData(`#${hex}`);
      return make(info);
    }
    if (Array.isArray(propertyValue)) {
      let keys: number[] = [];
      for (let i = 0; i < propertyValue.length; i++) {
        keys.push(i);
      }
      const info = this._buildArrayData({
        data: new ArrayData(),
        path: path,
        value: propertyValue,
        keys: keys,
      });
      return make(info);
    }
    let info: Info = this._buildVecData({
      ctor: cc.Size,
      path: path,
      data: new Vec2Data(),
      keys: [{ key: "width" }, { key: "height" }],
      value: propertyValue,
    });
    if (info) {
      return make(info);
    }
    info = this._buildVecData({
      // @ts-ignore
      ctor: cc.Vec3,
      path: path,
      data: new Vec3Data(),
      keys: [
        {
          key: "x",
          disabled: (v: string, item: Info) => {
            return this.getDisabled(node, key, v, item);
          },
        },
        {
          key: "y",
          disabled: (v: string, item: Info) => {
            return this.getDisabled(node, key, v, item);
          },
        },
        { key: "z" },
      ],
      step: this.getStep(node, key),
      value: propertyValue,
    });
    if (info) {
      return make(info);
    }
    info = this._buildVecData({
      // @ts-ignore
      ctor: cc.Quat,
      path: path,
      data: new Vec4Data(),
      keys: [{ key: "x" }, { key: "y" }, { key: "z" }, { key: "w" }],
      value: propertyValue,
    });
    if (info) {
      return make(info);
    }
    info = this._buildVecData({
      // @ts-ignore
      ctor: cc.Vec2,
      path: path,
      data: new Vec2Data(),
      step: this.getStep(node, key),
      keys: [
        {
          key: "x",
          disabled: (v: string, item: Info) => {
            return this.getDisabled(node, key, v, item);
          },
        },
        {
          key: "y",
          disabled: (v: string, item: Info) => {
            return this.getDisabled(node, key, v, item);
          },
        },
      ],
      value: propertyValue,
    });
    if (info) {
      return make(info);
    }
    info = this._buildImageData({
      ctor: cc.SpriteFrame,
      data: new ImageData(),
      path: path,
      value: propertyValue,
    });
    if (info) {
      return make(info);
    }
    let ctorName = propertyValue.__classname__;
    if (ctorName) {
      const engine = new EngineData();
      engine.engineType = ctorName;
      engine.engineName = propertyValue.name;
      if (propertyValue instanceof cc.Node) {
        engine.engineNode = engine.engineNode = propertyValue.uuid;
      } else if (propertyValue instanceof cc.Asset) {
        engine.engineUUID = propertyValue._uuid;
        engine.engineNode = "";
      } else if (propertyValue instanceof cc.Component) {
        engine.engineUUID = propertyValue.uuid;
        if (propertyValue.node) {
          engine.engineNode = propertyValue.node.uuid;
        } else {
          engine.engineNode = "";
        }
      }
      return make(engine);
    }
    if (typeof propertyValue === "object") {
      // 空{} MaterialVariant 2.4.0
      try {
        JSON.stringify(propertyValue);
        info = this._buildObjectData({
          data: new ObjectData(),
          path: path,
          value: propertyValue,
        });
      } catch {
        // Object存在循环引用的情况
        info = new ObjectCircleData();
      }

      if (info) {
        return make(info);
      }
    }
    return null;
  }

  _buildArrayData({ value, path, data, keys }: BuildArrayOptions) {
    keys = keys.filter((key) => !key.toString().startsWith("_"));
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      let propPath = path.concat(key.toString());
      let itemData = this._genInfoData(value, key, propPath);
      if (itemData) {
        data.add(new Property(key.toString(), itemData));
      }
    }
    return data;
  }

  _buildObjectData({ value, path, data }: BuildObjectOptions) {
    let keys = Object.keys(value);
    keys = this.filterKeys(keys);
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      let propPath = path.concat(key.toString());
      let itemData = this._genInfoData(value, key, propPath);
      if (itemData) {
        data.add(new Property(key, itemData));
      }
    }
    return data;
  }

  filterKeys(keys: string[]) {
    // 剔除_开头的属性
    return keys.filter((key) => !key.toString().startsWith("_"));
  }

  _isInvalidValue(value: any) {
    // !!Infinity=true
    if ((value && value !== Infinity) || value === 0 || value === false || value === "") {
      return false;
    }

    if (value === null) {
      return "null";
    } else if (value === Infinity) {
      return "Infinity";
    } else if (value === undefined) {
      return "undefined";
    } else if (Number.isNaN(value)) {
      return "NaN";
    } else {
      return false;
    }
  }

  private getCompName(comp: any): string {
    const nameKeys = [
      "__classname__", // 2.4.0 验证通过
    ];
    for (let i = 0; i < nameKeys.length; i++) {
      let key = nameKeys[i];
      // 一般来说，这里的name是不会出现假值
      if (comp[key]) {
        return comp[key];
      }
    }
    return comp.constructor.name;
  }

  // 校验keys的有效性，3.x有position，没有x,y,z
  _checkKeysValid(obj: any, keys: string[]) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (!isHasProperty(obj, key)) {
        return false;
      }
    }
    return true;
  }

  _getGroupData(node: any) {
    const name = this.getCompName(node);
    let nodeGroup = new Group(name, node.uuid);
    let keys = this._getNodeKeys(node);
    for (let i = 0; i < keys.length; ) {
      let key = keys[i];
      let pair = this._getPairProperty(key);
      if (pair && this._checkKeysValid(node, pair.values)) {
        let bSplice = false;
        // 把这个成对的属性剔除掉
        pair.values.forEach((item: string) => {
          let index = keys.findIndex((el) => el === item);
          if (index !== -1) {
            keys.splice(index, 1);
            if (pair && item === pair.key) {
              // 切掉了自己，才能步进+1
              bSplice = true;
            }
          }
        });
        // 序列化成对的属性
        let info: Vec2Data | Vec3Data | Vec4Data | null = null;
        let pairValues = pair.values;
        if (pairValues.length === 2) {
          info = new Vec2Data();
        } else if (pairValues.length === 3) {
          info = new Vec3Data();
        } else if (pairValues.length === 4) {
          info = new Vec4Data();
        }
        // todo path
        pairValues.forEach((el: string) => {
          let propertyPath = [node.uuid, el];
          let vecData = this._genInfoData(node, el, propertyPath);
          if (vecData) {
            info && info.add(new Property(el, vecData));
          }
        });
        if (info) {
          let property = new Property(pair.key, info);
          nodeGroup.addProperty(property);
        }
        if (!bSplice) {
          i++;
        }
      } else {
        let propertyPath = [node.uuid, key];
        let info = this._genInfoData(node, key, propertyPath);
        if (info) {
          nodeGroup.addProperty(new Property(key, info));
        }
        i++;
      }
    }
    nodeGroup.sort();
    return nodeGroup;
  }

  getNodeInfo(uuid: string) {
    let node = this.inspectorGameMemoryStorage[uuid];
    if (node) {
      let groupData = [];
      if (node.isValid) {
        // 收集节点信息
        let nodeGroup = this._getGroupData(node);
        groupData.push(nodeGroup);
        // 收集组件信息
        const nodeComp = node._components;
        if (nodeComp) {
          for (let i = 0; i < nodeComp.length; i++) {
            let itemComp = nodeComp[i];
            this.inspectorGameMemoryStorage[itemComp.uuid] = itemComp;
            let compGroup = this._getGroupData(itemComp);
            groupData.push(compGroup);
          }
        }
      }
      const data: NodeInfoData = new NodeInfoData(uuid, groupData);
      this.sendMsgToContent(Msg.ResponseNodeInfo, data as ResponseNodeInfoData);
    } else {
      const data: NodeInfoData = new NodeInfoData(uuid, []);
      this.sendMsgToContent(Msg.ResponseNodeInfo, data as ResponseNodeInfoData);
    }
  }

  logValue(uuid: string, key: string) {
    let nodeOrComp = this.inspectorGameMemoryStorage[uuid];
    if (nodeOrComp) {
      console.log(nodeOrComp[key]);
    }
  }

  _isReadonly(base: Object, key: string | number): boolean {
    let ret = Object.getOwnPropertyDescriptor(base, key);
    if (ret) {
      return !(ret.set || ret.writable);
    } else {
      let proto = Object.getPrototypeOf(base);
      if (proto) {
        return this._isReadonly(proto, key);
      } else {
        return false;
      }
    }
  }

  setValue(pathArray: Array<string>, value: string): boolean {
    let target = this.inspectorGameMemoryStorage;
    // 尝试设置creator3.x的数据
    if (trySetValueWithConfig(pathArray, target, value)) {
      return true;
    }
    for (let i = 0; i < pathArray.length; i++) {
      let path = pathArray[i];
      if (i === pathArray.length - 1) {
        // 到最后的key了
        if (this._isReadonly(target, path)) {
          console.warn(`值不允许修改`);
        } else {
          target[path] = value;
          return true;
        }
      } else {
        // creator3.x的enumerable导致无法判断
        if (target.hasOwnProperty(path) || target[path]) {
          target = target[path];
        } else {
          return false;
        }
      }
    }
    return false;
  }
}
