/// <reference path="../typings/weapp/index.d.ts" />

import shallowEqual, { transformProperties } from "./util"

interface HookRecords<T> {
  [index: number]: T
  [index: string]: T
}

type UpdaterParam<T> = T | ((prev: T) => T)
type Updater<T> = (value: UpdaterParam<T>) => void

type UnLoad = (() => void) | void

interface Ref<T = any> {
  current?: T
}

interface RendererHooksCtx {
  rerender: () => void
  state: HookRecords<any>
  effect: HookRecords<{
    unload: UnLoad
    lastDeps?: any[]
  }>
  layoutEffect: HookRecords<{
    effectFunc?: () => UnLoad
    unload?: UnLoad
  }>
  memo: HookRecords<any>
  ref: HookRecords<Ref>
}

interface WXRenderHooksCtx {
  $$hooksCtx: RendererHooksCtx
}

type WXRenderer = (Page.WXPage | Component.WXComponent) & WXRenderHooksCtx

type HookFunc<T = any> = (props: T) => AnyObject | void

let currentRenderer: WXRenderer | null = null
let hookCursor = 0

function assetRendering() {
  if (!currentRenderer) {
    throw new Error("hook未在函数式组件中使用")
  }
}

function splitDataAndMethod(def: AnyObject) {
  const data: AnyObject = {}
  const methods: AnyObject = {}

  Object.keys(def).forEach(key => {
    const value = def[key]
    if (typeof value === "function") {
      methods[key] = value.bind(null)
    } else {
      data[key] = value
    }
  })

  return { data, methods }
}

function propChangeObserver(this: Component.WXComponent & WXRenderHooksCtx, newVal: any, oldVal: any) {
  if (newVal !== oldVal) {
    if (this.$$hooksCtx) {
      this.$$hooksCtx.rerender()
    }
  }
}

export function useState<T>(initValue: T): [T, Updater<T>] {
  assetRendering()

  const inst = currentRenderer!
  const cursor = hookCursor++

  if (inst.$$hooksCtx.state[cursor] === undefined) {
    inst.$$hooksCtx.state[cursor] = initValue
  }

  const updater = (value: UpdaterParam<T>) => {
    if (typeof value === "function") {
      inst.$$hooksCtx.state[cursor] = value.call(null, inst.$$hooksCtx.state[cursor])
    } else {
      inst.$$hooksCtx.state[cursor] = value
    }
    inst.$$hooksCtx.rerender()
  }

  return [inst.$$hooksCtx.state[cursor], updater]
}

/**
 *
 * @param deps 不传表示每次更新都触发，传空数组表示只在创建和销毁时触发，传非空数组表示依赖变化时触发
 */
export function useEffect(effectFunc: () => UnLoad, deps?: any[]) {
  assetRendering()

  const inst = currentRenderer!
  const cursor = hookCursor++
  const effect = inst.$$hooksCtx.effect[cursor]

  if (effect === undefined) {
    // 初次渲染
    inst.$$hooksCtx.effect[cursor] = {
      unload: effectFunc.call(null),
      lastDeps: deps
    }
  } else {
    const lastDeps = effect.lastDeps || []
    effect.lastDeps = deps

    if (deps) {
      let i = 0
      const len = deps.length
      for (; i < len; i++) {
        if (deps[i] !== lastDeps[i]) {
          break
        }
      }
      if (i === len) {
        return
      }
    }

    if (effect.unload) {
      effect.unload.call(null)
    }
    effect.unload = effectFunc.call(null)
  }
}

export function useLayoutEffect(effectFunc: () => UnLoad, deps?: any[]) {
  assetRendering()

  const inst = currentRenderer!
  const cursor = hookCursor++
  if (!inst.$$hooksCtx.layoutEffect[cursor]) {
    inst.$$hooksCtx.layoutEffect[cursor] = {}
  }
  useEffect(() => {
    inst.$$hooksCtx.layoutEffect[cursor].effectFunc = effectFunc
  }, deps)
}

export function useMemo<T>(create: () => T, inputs?: any[]): T {
  assetRendering()

  const inst = currentRenderer!
  const cursor = hookCursor++

  useEffect(() => {
    inst.$$hooksCtx.memo[cursor] = create()
  }, inputs)

  return inst.$$hooksCtx.memo[cursor]
}

export function useCallback<T>(callback: () => T, inputs?: any[]) {
  return useMemo(() => callback, inputs)
}

export function useRef<T>(initValue?: T): Ref<T> {
  assetRendering()

  const inst = currentRenderer!
  const cursor = hookCursor++
  if (!inst.$$hooksCtx.ref[cursor]) {
    inst.$$hooksCtx.ref[cursor] = { current: initValue }
  }

  return inst.$$hooksCtx.ref[cursor]
}

export function useReducer<S, I, A>(reducer: (state: S, action: A) => S, initialArg: I, init?: (initialArg: I) => S): [S, (action: A) => void] {
  const initalState = (init ? init(initialArg) : initialArg) as S
  const [state, setState] = useState(initalState)

  const dispatch = (action: A) => {
    const newState = reducer(state, action)
    if (newState !== state) {
      setState(newState)
    }
  }

  return [state, dispatch]
}

export function usePrevious<T>(value: T) {
  const ref = useRef<T>()

  useEffect(() => {
    ref.current = value
  })

  return ref.current
}

export function useThisAsPage(func: (this: Page.WXPage, self?: Page.WXPage) => void) {
  assetRendering()

  const inst = currentRenderer as Page.WXPage
  return () => func.call(inst, inst)
}

export function useThisAsComp(func: (this: Component.WXComponent, self: Component.WXComponent) => void) {
  assetRendering()

  const inst = currentRenderer as Component.WXComponent
  return () => func.call(inst, inst)
}

function onCreate(this: WXRenderer, func: HookFunc, props: AnyObject) {
  this.$$hooksCtx = {
    state: [],
    effect: {},
    layoutEffect: {},
    memo: {},
    ref: {},
    rerender: () => {
      currentRenderer = this
      hookCursor = 0
      const newDef = func.call(null, props) || {}
      currentRenderer = null

      const { data, methods } = splitDataAndMethod(newDef)
      Object.keys(methods).forEach(key => {
        ;(this as any)[key] = methods[key]
      })

      const triggerLayoutEffect = () => {
        Object.keys(this.$$hooksCtx.layoutEffect).forEach(key => {
          const { effectFunc, unload } = this.$$hooksCtx.layoutEffect[key]
          if (effectFunc) {
            if (unload) {
              unload.call(null)
            }
            this.$$hooksCtx.layoutEffect[key].unload = effectFunc.call(null)
            this.$$hooksCtx.layoutEffect[key].effectFunc = undefined
          }
        })
      }

      if (shallowEqual(data, this.data)) {
        triggerLayoutEffect()
        return
      }

      this.setData(data, triggerLayoutEffect)
    }
  }
  this.$$hooksCtx.rerender()
}

function onDestroy(this: WXRenderer) {
  Object.keys(this.$$hooksCtx.effect).forEach(key => {
    const effect = this.$$hooksCtx.effect[key]
    const unload = effect.unload
    if (typeof unload === "function") {
      unload.call(null)
    }
  })
  // @ts-ignore
  this.$$hooksCtx = null
}

export function FPage(func: HookFunc) {
  // @ts-ignore
  return Page<any, WXRenderHooksCtx>({
    onLoad(options) {
      onCreate.call(this, func, options)
    },
    onUnload() {
      onDestroy.call(this)
    }
  })
}

export function FComp<T>(func: HookFunc<T>, defaultProps: T) {
  const properties = transformProperties(defaultProps)
  for (const k in properties) {
    properties[k].observer = propChangeObserver
  }

  // @ts-ignore
  return Component<T, any, WXRenderHooksCtx>({
    properties,
    attached() {
      onCreate.call(this, func, this.properties)
    },
    detached() {
      onDestroy.call(this)
    }
  })
}

export { FComp as FMixin }
