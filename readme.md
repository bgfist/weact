# Weact

A Framework For Writing Wechat MiniProgram Like React, And With Typescript

## install
```bash
npm i @bgfist/weact
```

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
- useMemo
- useRef
- useReducer
- usePrevious
- useThisAsPage
- useThisAsComp
- ...

## debug
```ts
import { debugWeact } from "@bgfist/weact"

debugWeact()
```