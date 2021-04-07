export enum DataType {
  Number,
  String,
  Text,
  Vec2,
  Vec3,
  Enum,
  Bool,
  Color,
  NullOrUndefined,
  Array, // 暂时在控制台打印下
  Object,
}

class Info {
  public type: DataType = DataType.Number;
  public data: any;
  public path: Array<string> = [];// 属性对应的路径
}

export class TextData extends Info {
  constructor() {
    super();
    this.type = DataType.Text;
  }
}

export class ArrayData extends Info {
  constructor() {
    super();
    this.type = DataType.Array;
  }
}

export class ObjectData extends Info {
  constructor() {
    super();
    this.type = DataType.Object;
  }
}

export class NullOrUndefinedData extends Info {
  constructor() {
    super();
    this.type = DataType.NullOrUndefined;

  }
}

export class ColorData extends Info {
  constructor(color: string) {
    super();
    this.type = DataType.Color;
    this.data = color;
  }
}

export class StringData extends Info {
  constructor(data: string) {
    super();
    this.type = DataType.String;
    this.data = data;
  }
}

export class NumberData extends Info {
  constructor() {
    super();
    this.type = DataType.Number;
    this.data = 1;
  }
}

export class BoolData extends Info {
  constructor(bol: boolean) {
    super();
    this.type = DataType.Bool;
    this.data = bol;
  }
}

export class Vec2Data extends Info {
  constructor() {
    super();
    this.type = DataType.Vec2
    this.data = [];
    return this;
  }

  add(info: Property) {
    this.data.push(info);
    return this;
  }
}

export class Vec3Data extends Info {

  constructor() {
    super();
    this.type = DataType.Vec3;
    this.data = [];
    return this;
  }

  add(info: Property) {
    this.data.push(info);
    return this;
  }
}

export class EnumData extends Info {
  constructor() {
    super();
    this.type = DataType.Enum;
  }

}

export class Property {
  public name: string = 'property';
  public value: Info = new Info();

  constructor(name: string, info: Info) {
    this.name = name;
    this.value = info;
  }
}

export class Group {
  public name: string = 'group';
  public data: Array<Property> = [];

  constructor(name: string) {
    this.name = name;
  }

  addProperty(property: Property) {
    this.data.push(property)
  }
}

class NodeInfo {
  public type: string = ''; // 类型


}

class CompInfo {

}

export const testData = [
  {
    name: "group1",
    uuid: 'node/comp uuid',
    data: [
      {name: "uuid", value: {type: DataType.String, data: 'abc', path: 'uuid'}},
      {name: "opacity", value: {type: DataType.Number, data: 100}},

      {
        name: "size",
        value: {
          type: DataType.Vec2,
          data: [
            {name: "X", value: {type: DataType.Number, data: 100}},
            {name: "Y", value: {type: DataType.Number, data: 200}},
          ]
        }
      },
      {
        name: "position",
        value: {
          type: DataType.Vec3,
          data: [
            {name: "X", value: {type: DataType.Number, data: 100}},
            {name: "Y", value: {type: DataType.Number, data: 200}},
            {name: "Z", value: {type: DataType.Number, data: 300}},
          ]
        }
      },
      {
        name: "layout",
        value: {
          type: DataType.Enum,
          data: 1,
          values: [
            {name: "horizontal", value: 1},
            {name: "vertical", value: 2},
          ]
        }
      },
      {
        name: "text",
        value: {
          type: DataType.Text,
          data: 'aaaaaaaaafsf',
        }
      }
    ]
  },
  {
    name: "group2",
    data: [
      {
        name: "bool", value: {
          type: DataType.Bool,
          data: true,
        }
      },
      {
        name: 'color',
        value: {
          type: DataType.Color,
          data: '#ff0000'
        }
      },
      {
        name: 'array',
        value: {
          type: DataType.Array,
          data: [1, 2, 3, 4]
        }
      }, {
        name: 'object',
        value: {
          type: DataType.Object,
          data: {a: '11111111111111111111111111111111111111111111111111111111111', b: 2, c: 3}
        }
      }
    ]
  },
];

