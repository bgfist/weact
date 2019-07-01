# Weact

A Framework For Writing Wechat MiniProgram Like React, And With Typescript

## install
```bash
npm i @bgfist/weact
```

## tsconfig.json

```js
{
  "compilerOptions": {
    ...
    "target": "es5", // add this to compile to es5, do not let wechatdevtools compile for you
    "noLib": true // add this to ignore typescript's default lib, thus all ES6 api come from this package
  }
}
```

## use namespace wx
at your app entry app.ts, import this package before all:

app.ts
```ts
import * as Weact from "@bgfist/weact";

...
```

or add the triple slash directive:

app.ts
```ts
/// <reference types="@bgfist/weact"/>

```

## class-style
```ts
import { WXPage } from "@bgfist/weact";

interface Data {
  name: string
}

class DemoPage extends WXPage<Data> {
  public data: Data = {
    name: "react",
  }

  private field = 0

  public onLoad(options: Page.ILoadOption) {
    this.setData({ name: "weact" }, this.method)
  }

  private method() {
    console.log(this.field++)
  }
}

new DemoPage().init()
```

> all instance fields and methods will be packed as options to wx's `Page` function

> and `WXComponent` will automatically bundle all methods into `options.methods`

## hook-style
```ts
import { FPage, useState, useEffect } from "@bgfist/weact"

function Demo() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => console.log("timer trigger"), count * 1000)
    return () => clearTimeout(timer)
  }, [count])

  const incrCount = () => setCount(count + 1)
  const decrCount = () => setCount(s => s - 1)

  return {
    count, // data
    incrCount, // method
    decrCount, // method
  }
}

FPage(Demo)
```

> for an elegant writing style, weact will group fields and methods for your return using the `typeof` operator

All supported hooks are listed below, peek their code annotation for a detail explain: 

- useState
- useEffect
- useLayoutEffect
- useMemo
- useCallback
- useRef
- useReducer
- usePrevious
- useThisAsPage
- useThisAsComp
