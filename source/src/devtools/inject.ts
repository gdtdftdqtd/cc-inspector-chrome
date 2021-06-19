// eval 注入脚本的代码,变量尽量使用var,后来发现在import之后,let会自动变为var
import {
  ArrayData,
  BoolData,
  ColorData,
  DataType, EngineData,
  Group, ImageData,
  Info,
  NullOrUndefinedData,
  NumberData,
  ObjectData,
  Property,
  StringData,
  TreeData,
  Vec2Data,
  Vec3Data
} from "./data";
import {Msg, Page, PluginEvent} from '@/core/types'

// @ts-ignore typescript-eslint/no-namespace
declare namespace cc {
  export function v2(x: number, y: number): any;
}

class CCInspector {
  inspectorGameMemoryStorage: Record<string, any> = {}

  init() {
    console.log('cc-inspector init ~~~');
    let timer = setInterval(() => {
      if (this._isCocosGame()) {
        clearInterval(timer)
        // @ts-ignore
        cc.director.on(cc.Director.EVENT_AFTER_SCENE_LAUNCH, () => {
          let isCocosGame = this._isCocosGame();
          this.notifySupportGame(isCocosGame)
        })
      }
    }, 300)
    window.addEventListener("message", (event) => {
      // 接受来自content的事件，有可能也会受到其他插件的
      if (!event || !event.data) {
        return
      }
      let pluginEvent: PluginEvent = event.data;
      if (PluginEvent.check(pluginEvent, Page.Content, Page.Inject)) {
        console.log(`%c[Inject] ${JSON.stringify(pluginEvent)}`, 'color:green;');
        PluginEvent.finish(pluginEvent)
        switch (pluginEvent.msg) {
          case Msg.UrlChange:
          case Msg.Support: {
            let isCocosGame = this._isCocosGame();
            this.notifySupportGame(isCocosGame)
            break;
          }
          case Msg.TreeInfo: {
            this.updateTreeInfo();
            break;
          }
          case Msg.NodeInfo: {
            let nodeUUID = pluginEvent.data;
            this.getNodeInfo(nodeUUID);
            break;
          }
          case Msg.SetProperty: {
            const data: Info = pluginEvent.data;
            let value = data.data;
            if (data.type === DataType.Color) {
              // @ts-ignore
              value = cc.color().fromHEX(value);
            }

            this.setValue(data.path, value);
            this.sendMsgToContent(Msg.UpdateProperty, data);
            break;
          }
        }
      }
    });
  }

  sendMsgToContent(msg: Msg, data: any) {
    // 发送给content.js处理，也会导致发送给了自身，死循环
    window.postMessage(new PluginEvent(Page.Inject, Page.Content, msg, data), "*");
  }

  notifySupportGame(b: boolean) {
    this.sendMsgToContent(Msg.Support, b);
  }

  updateTreeInfo() {
    let isCocosCreatorGame = this._isCocosGame();
    if (isCocosCreatorGame) {
      //@ts-ignore
      let scene = cc.director.getScene();
      if (scene) {
        let treeData = new TreeData();
        this.getNodeChildren(scene, treeData)
        this.sendMsgToContent(Msg.TreeInfo, treeData);
      } else {
        this.sendMsgToContent(Msg.Support, {support: false, msg: "未发现游戏场景,不支持调试游戏!"});
      }
    } else {
      this.notifySupportGame(false)
    }
  }


  // @ts-ignore
  draw: cc.Graphics = null;

  _drawRect(node: any) {
    let draw = this.draw;

    if (!draw) {
      // @ts-ignore
      let node = new cc.Node('draw-node');
      // @ts-ignore
      cc.director.getScene().addChild(node);
      // @ts-ignore
      draw = this.draw = node.addComponent(cc.Graphics);
    }
    draw.clear()
    draw.lineWidth = 10;
    // @ts-ignore
    draw.strokeColor = new cc.Color().fromHEX('#ff0000')
    const {anchorX, anchorY, width, height, x, y} = node;
    let halfWidth = width / 2;
    let halfHeight = height / 2;
    let leftBottom = node.convertToWorldSpaceAR(cc.v2(-halfWidth, -halfHeight))
    let leftTop = node.convertToWorldSpaceAR(cc.v2(-halfWidth, halfHeight));
    let rightBottom = node.convertToWorldSpaceAR(cc.v2(halfWidth, -halfHeight));
    let rightTop = node.convertToWorldSpaceAR(cc.v2(halfWidth, halfHeight));

    function line(began: any, end: any) {
      draw.moveTo(began.x, began.y);
      draw.lineTo(end.x, end.y);
    }

    line(leftBottom, rightBottom)
    line(rightBottom, rightTop)
    line(rightTop, leftTop)
    line(leftTop, leftBottom)
    this.draw.stroke();
  }

  // 收集节点信息
  getNodeChildren(node: any, data: TreeData) {
    data.uuid = node.uuid;
    data.name = node.name;
    // @ts-ignore
    if (node instanceof cc.Scene) {
      // 场景不允许获取active，引擎会报错
    } else {
      data.active = !!node.active;
    }
    this.inspectorGameMemoryStorage[node.uuid] = node;
    let nodeChildren = node.getChildren();
    for (let i = 0; i < nodeChildren.length; i++) {
      let childItem = nodeChildren[i];
      let treeData = new TreeData();
      this.getNodeChildren(childItem, treeData);
      data.children.push(treeData)
    }
  }

  _isCocosGame() {
    // @ts-ignore 检测是否包含cc变量
    return typeof cc !== "undefined";
  }

  _getNodeKeys(node: any) {
    let keys = [];
    let excludeProperty = [
      "children", "quat", "node",
      // 生命周期函数
      "onFocusInEditor", "onRestore", "start", "lateUpdate", "update", "resetInEditor", "onLostFocusInEditor",
      "onEnable", "onDisable", "onDestroy", "onLoad",
    ];
    for (let key in node) {
      if (!key.startsWith("_") &&
        !excludeProperty.includes(key) &&
        typeof node[key] !== "function") {
        keys.push(key);
      }
    }
    return keys;
  }

  _getPairProperty(key: string) {
    let pairProperty: Record<string, any> = {
      rotation: ["rotationX", "rotationY"],
      anchor: ["anchorX", "anchorY"],
      size: ["width", "height"],
      skew: ['skewX', 'skewY'],
      position: ["x", "y", "z"],
      scale: ["scaleX", "scaleY", "scaleZ"],
      designResolution: ["width", "height"], // 这个比较特殊，在key下边，其他的都不是在key下
    };
    for (let value in pairProperty) {
      if (pairProperty.hasOwnProperty(value)) {
        let pair = pairProperty[value];
        if (pair.includes(key)) {
          return {key: value, values: pair};
        }
      }
    }
    return null;
  }

  _buildVecData(options: any) {
    const ctor: Function = options.ctor;
    const keys: Array<string> = options.keys;
    const value: Object = options.value;
    const data: Vec3Data | Vec2Data = options.data;
    const path: Array<string> = options.path;

    if (ctor && value instanceof ctor) {
      let hasUnOwnProperty = keys.find(key => !value.hasOwnProperty(key))
      if (!hasUnOwnProperty) {
        for (let key in keys) {
          let propName = keys[key];
          if (value.hasOwnProperty(propName)) {
            let propPath = path.concat(propName);
            let itemData = this._genInfoData(value, propName, propPath)
            if (itemData) {
              data.add(new Property(propName, itemData))
            }
          }
        }
        return data;
      }
    }
    return null;
  }

  _buildImageData(options: any) {
    const ctor: Function = options.ctor;
    const value: Object = options.value;
    const data: ImageData = options.data;
    const path: Array<string> = options.path;
    if (ctor && value instanceof ctor) {
      if (value.hasOwnProperty('_textureFilename')) {
        data.path = path;
        //@ts-ignore
        data.data = `${window.location.origin}/${value._textureFilename}`;
        return data;
      }
    }
    return null;
  }

  _genInfoData(node: any, key: string, path: Array<string>) {
    let propertyValue = node[key];
    let info = null;
    switch (typeof propertyValue) {
      case "boolean":
        info = new BoolData(propertyValue);
        break;
      case "number":
        info = new NumberData(propertyValue);
        break;
      case "string":
        info = new StringData(propertyValue);
        break;
      default:
        if (propertyValue == null || typeof propertyValue === "undefined") {
          info = new NullOrUndefinedData();
          //@ts-ignore
        } else if (propertyValue instanceof cc.Color) {
          let hex = propertyValue.toHEX();
          info = new ColorData(`#${hex}`);
        } else if (Array.isArray(propertyValue)) {
          let keys = [];
          for (let i = 0; i < propertyValue.length; i++) {
            keys.push(i);
          }
          info = this._buildObjectOrArrayData({
            data: new ArrayData(),
            path: path,
            value: propertyValue,
            keys: keys,
          })
        } else {
          !info && (info = this._buildVecData({
            // @ts-ignore
            ctor: cc.Vec3,
            path: path,
            data: new Vec3Data(),
            keys: ['x', 'y', 'z'],
            value: propertyValue,
          }))
          !info && (info = this._buildVecData({
            // @ts-ignore
            ctor: cc.Vec2,
            path: path,
            data: new Vec2Data(),
            keys: ['x', 'y'],
            value: propertyValue
          }))
          !info && (info = this._buildImageData({
            //@ts-ignore
            ctor: cc.SpriteFrame,
            data: new ImageData(),
            path: path,
            value: propertyValue,
          }))
          if (!info) {
            if (typeof propertyValue === "object") {
              let ctorName = propertyValue.constructor.name;
              if (ctorName.startsWith('cc_')) {
                info = new EngineData();
                info.engineType = ctorName;
                info.engineName=propertyValue.name;
                info.engineUUID=propertyValue.uuid;
              } else {
                info = this._buildObjectOrArrayData({
                  data: new ObjectData(),
                  path: path,
                  value: propertyValue,
                  keys: Object.keys(propertyValue),
                })
              }
            }
          }
        }
        break;
    }
    if (info) {
      info.readonly = this._isReadonly(node, key)
      info.path = path;
    } else {
      console.error(`暂不支持的属性值`, propertyValue);
    }
    return info;
  }

  _buildObjectOrArrayData(options: any) {
    let propertyValue: Object = options.value;
    let path: Array<string> = options.path;
    let data: ObjectData | ArrayData = options.data;
    let keys: Array<string> = options.keys;
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      let propPath = path.concat(key.toString());
      let itemData = this._genInfoData(propertyValue, key, propPath);
      if (itemData) {
        data.add(new Property(key.toString(), itemData))
      }
    }
    return data;
  }

  _getGroupData(node: any) {
    let nodeGroup = new Group(node.constructor.name);
    let keys = this._getNodeKeys(node);
    for (let i = 0; i < keys.length;) {
      let key = keys[i];
      let propertyValue = node[key];
      let pair = this._getPairProperty(key);
      if (pair) {
        let bSplice = false;
        // 把这个成对的属性剔除掉
        pair.values.forEach((item: string) => {
          let index = keys.findIndex(el => el === item);
          if (index !== -1) {
            keys.splice(index, 1);
            bSplice = true;
          }
        });
        // 序列化成对的属性
        let info: Vec2Data | Vec3Data | null = null;
        let pairValues = pair.values;
        if (pairValues.length === 2) {
          info = new Vec2Data();
        } else if (pairValues.length === 3) {
          info = new Vec3Data();
        }
        pairValues.forEach((el: string) => {
          if (el in node) {
            let propertyPath = [node.uuid, el];
            let vecData = this._genInfoData(node, el, propertyPath);
            if (vecData) {
              info && info.add(new Property(el, vecData));
            }
          } else {
            console.warn(`属性异常，节点丢失属性: ${el}，请检查 pairProperty的设置`);
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

  // 获取节点信息
  getNodeInfo(uuid: string) {
    let node = this.inspectorGameMemoryStorage[uuid];
    if (node) {
      let groupData = [];
      // 收集节点信息
      let nodeGroup = this._getGroupData(node);
      groupData.push(nodeGroup);
      // 收集组件信息
      let nodeComp = node._components;
      for (let i = 0; i < nodeComp.length; i++) {
        let itemComp = nodeComp[i];
        this.inspectorGameMemoryStorage[itemComp.uuid] = itemComp;
        let compGroup = this._getGroupData(itemComp);
        groupData.push(compGroup);
      }
      this.sendMsgToContent(Msg.NodeInfo, groupData);
    } else {
      // 未获取到节点数据
      console.log("未获取到节点数据");
    }
  }

  logValue(uuid: string, key: string) {
    let nodeOrComp = this.inspectorGameMemoryStorage[uuid];
    if (nodeOrComp) {
      console.log(nodeOrComp[key]);
    }
  }

  _isReadonly(base: Object, key: string): boolean {
    let ret = Object.getOwnPropertyDescriptor(base, key)
    if (ret) {
      return !(ret.set || ret.writable);
    } else {
      let proto = Object.getPrototypeOf(base);
      return this._isReadonly(proto, key)
    }
  }

  setValue(pathArray: Array<string>, value: string) {
    let target = this.inspectorGameMemoryStorage;

    for (let i = 0; i < pathArray.length; i++) {
      let path = pathArray[i];
      if (i === pathArray.length - 1) {
        // 到最后的key了
        if (this._isReadonly(target, path)) {
          console.warn(`值不允许修改`);
        } else {
          target[path] = value;
        }
      } else {
        if (target.hasOwnProperty(path)) {
          target = target[path];
        }
      }
    }
  }


  onMemoryInfo() {
    this.sendMsgToContent(Msg.MemoryInfo, {
      performance: {
        // @ts-ignore
        jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit,
        // @ts-ignore
        totalJSHeapSize: window.performance.memory.totalJSHeapSize,
        // @ts-ignore
        usedJSHeapSize: window.performance.memory.usedJSHeapSize,
      },
      console: {
        jsHeapSizeLimit: console.memory.jsHeapSizeLimit,
        totalJSHeapSize: console.memory.totalJSHeapSize,
        usedJSHeapSize: console.memory.usedJSHeapSize,
      },
    });
  }
}

let inspector = new CCInspector();
inspector.init();
//@ts-ignore
window.CCInspector = inspector;




