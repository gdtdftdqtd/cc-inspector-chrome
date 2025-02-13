import CCPlugin from "../../../cc-plugin.config";
import { githubMirrorMgr } from "./github";

export class AdItem {
  /**
   * 广告的名字
   */
  name: string = "";
  /**
   * 鼠标悬浮提示
   */
  tip: string = "";
  /**
   * 分类，目前支持2类：ai绘图、我的插件
   */
  type: string = "";
  /**
   * 插件的试用地址
   */
  try: string | Array<{ name: string; url: string }> = "";
  /**
   * 广告的store购买链接
   */
  store: string = "";
  /**
   * 广告的展示时间，单位s
   */
  duration: number = 0;
  /**
   * 广告的有效性
   */
  valid: boolean = true;
  /**
   * 背景图
   */
  img: string = "";
  getTryInfos(): Array<{ name: string; url: string; type: string }> {
    if (typeof this.try === "string" && this.try) {
      return [{ name: this.name, url: this.try, type: this.type }];
    } else if (Array.isArray(this.try)) {
      return this.try.map((el) => {
        return { name: el.name, url: el.url, type: this.type };
      });
    }
    return [];
  }
  parse(data: AdItem) {
    this.name = data.name;
    this.store = data.store || "";
    this.parseStore();

    this.try = data.try || "";
    this.tip = data.tip || "";
    this.type = data.type || "";
    this.duration = data.duration || 0;
    this.valid = !!data.valid;
    const img = data.img || "";
    this.img = githubMirrorMgr.getFileUrl(img);
    return this;
  }
  parseStore() {
    const flag = "${git}";
    if (this.store.startsWith(flag)) {
      const file = this.store.split(flag)[1];
      this.store = githubMirrorMgr.getFileUrl(file);
    }
  }
}
export class AdData {
  desc: string = "";
  /**
   * 是否启用广告
   */
  valid: boolean = false;
  /**
   * 多少分钟不再展示，单位分钟，默认10分钟
   */
  showDuration: number = 10;
  /**
   * 底部广告多少秒滚动一次
   */
  scrollDuration: number = 3;
  /**
   * 将位置随机打乱，保证用户每次看到的插件数量不一样，提高转换率
   */
  randomIndex: boolean = false;
  /**
   * 展示的广告数量，-1为所有
   */
  showCount: number = -1;
  /**
   * 类型对应文本
   */
  keys: Record<string, string> = {};
  data: Array<AdItem> = [];
  parse(data: AdData) {
    this.desc = data.desc;
    this.valid = !!data.valid;
    this.showDuration = data.showDuration || 10;
    this.scrollDuration = data.scrollDuration || 3;
    this.randomIndex = !!data.randomIndex;
    this.showCount = data.showCount || -1;
    this.keys = data.keys || {};
    if (data.data) {
      if (this.randomIndex) {
        data.data.sort(() => Math.random() - 0.5);
      }
      data.data.forEach((el) => {
        if (this.showCount !== -1 && this.data.length >= this.showCount) {
          return;
        }
        const item = new AdItem().parse(el);
        if (!item.duration) {
          // console.warn(`add failed, ad.duration is ${item.duration}, ${JSON.stringify(item)}`);
        }
        this.data.push(item);
      });
    }
  }
  sortByName() {
    this.data.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
  }
}

export async function getAdData(): Promise<AdData | null> {
  await githubMirrorMgr.init();
  const data = await githubMirrorMgr.getData(`ad-${CCPlugin.manifest.version}.json`);
  if (data) {
    const ad = new AdData();
    ad.parse(data as AdData);
    return ad;
  }
  return null;
}
