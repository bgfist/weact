/// <reference path="../typings/weapp/index.d.ts" />

import { transformProperties, endlessProxy } from "./util"
import { genDiff } from './diff'
import { debug } from './debug'

interface HookRecords<T> {
  [index: number]: T
  [index: string]: T
}

type UpdaterParam<T> = T | ((prev: T) => T)
export type Updater<T> = (value: UpdaterParam<T>) => void

type UnLoad = any

interface Ref<T = any> {
  current: T
}

interface RendererHooksCtx<T extends HookProps = any> {
  renderName: string,
  props: T
  oldData?: AnyObject
  rerenderTriggerringByProp: boolean
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

interface WXRenderHooksCtx<T extends HookProps = any> {
  $$hooksCtx: RendererHooksCtx<T>
}

type WXRenderer<T extends HookProps = any> = (Page.WXPage | Component.WXComponent) & WXRenderHooksCtx<T>

type HookProps = AnyObject | undefined

type HookReturn = AnyObject | void

type HookFunc<T extends HookProps, R extends HookReturn> = (props: T) => NotOverlap<R, T>

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
  debug("PropChanged", this.$$hooksCtx && this.$$hooksCtx.renderName, newVal === oldVal || !this.$$hooksCtx ? '[rerender skipped]' : '')
  if (newVal !== oldVal) {
    if (this.$$hooksCtx) {
      debug("PropChanged:Rerender", this.$$hooksCtx.renderName, newVal, this.$$hooksCtx.rerenderTriggerringByProp ? '[skipped]' : '')
      if (!this.$$hooksCtx.rerenderTriggerringByProp) {
        this.$$hooksCtx.rerenderTriggerringByProp = true
        wx.nextTick(() => this.$$hooksCtx.rerenderTriggerringByProp = false)
        this.$$hooksCtx.rerender()
      }
    }
  }
}

export function useState<T>(): [T | undefined, Updater<T | undefined>]
export function useState<T>(initValue: T): [T, Updater<T>]
export function useState<T>(initValue?: T): [T, Updater<T>] {
  assetRendering()

  const inst = currentRenderer!
  const cursor = hookCursor++

  if (!(cursor in inst.$$hooksCtx.state)) {
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

    if (typeof effect.unload === "function") {
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

export function useCallback(callback: AnyFunction, inputs?: any[]) {
  return useMemo(() => callback, inputs)
}

export function useRef<T>(): Ref<T | undefined>
export function useRef<T>(initValue: T): Ref<T>
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

type ChunkedPage = Omit<Page.WXPageInstance<any>, "setData">

export function useThisAsPage(): ChunkedPage
export function useThisAsPage(func: (this: ChunkedPage, self: ChunkedPage) => any): AnyFunction
export function useThisAsPage(func?: (this: ChunkedPage, self: ChunkedPage) => any) {
  assetRendering()

  const inst = currentRenderer as ChunkedPage

  if (!func) {
    return inst
  }

  return () => func.call(inst, inst)
}

type ChunkedComp = Omit<Component.WXComponentInstance<any>, "setData">

export function useThisAsComp(): ChunkedComp
export function useThisAsComp(func: (this: ChunkedComp, self: ChunkedComp) => any): AnyFunction
export function useThisAsComp(func?: (this: ChunkedComp, self: ChunkedComp) => any) {
  assetRendering()

  const inst = currentRenderer as ChunkedComp

  if (!func) {
    return inst
  }

  return () => func.call(inst, inst)
}

function onCreate<T extends HookProps, R extends HookReturn>(this: WXRenderer<T>, func: HookFunc<T, R>, props: T) {
  this.$$hooksCtx = {
    renderName: func.name,
    props,
    oldData: undefined,
    rerenderTriggerringByProp: false,
    state: [],
    effect: {},
    layoutEffect: {},
    memo: {},
    ref: {},
    rerender: () => {
      currentRenderer = this
      hookCursor = 0
      const newDef = (func.call(null, this.$$hooksCtx.props) || {}) as AnyObject
      currentRenderer = null

      const { data, methods } = splitDataAndMethod(newDef)
      debug("NewDataAndMethods", this.$$hooksCtx.renderName, data, methods)

      Object.keys(methods).forEach(key => {
        ; (this as any)[key] = methods[key]
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

      const diff = genDiff(data, this.$$hooksCtx.oldData)
      this.$$hooksCtx.oldData = data

      const noUpdate = !Object.keys(diff).length

      debug("setData", this.$$hooksCtx.renderName, diff, noUpdate ? '[skipped]' : '')

      if (noUpdate) {
        triggerLayoutEffect()
        return
      }

      this.setData(diff as any, () => {
        debug("setData:updated", this.$$hooksCtx.renderName)
        triggerLayoutEffect()
      })
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

type PageHookFunc<R extends HookReturn> = (options?: AnyObject) => R

type PickDataFromHookReturn_<R extends AnyObject> = { [K in keyof R]: R[K] extends AnyFunction ? never : R[K] }
type PickDataFromHookReturn<R extends AnyObject> = Readonly<PickDataFromHookReturn_<R>>
type PickMethodsFromHookReturn<R extends AnyObject> = { [K in keyof R]: R[K] extends AnyFunction ? R[K] : never }

type ExtraPageOptionsView<R> = ChunkedPage & { readonly data: PickDataFromHookReturn<R> } & PickMethodsFromHookReturn<R>;
type ExtraPageOptions_ = Omit<Page.WXPageConstructorOptions,
  | "data" // these are provided by hookfunc
  | "onLoad" | "onUnload" // these can be mocked by useEffect
>
type ExtraPageOptions = Required<ExtraPageOptions_>
type ExtraPageOptionsThis_<R> = { [K in keyof ExtraPageOptions]: ExtraPageOptions[K] extends AnyFunction ? (this: ExtraPageOptionsView<R>, ...args: Parameters<ExtraPageOptions[K]>) => ReturnType<ExtraPageOptions[K]> : ExtraPageOptions[K] }
type ExtraPageOptionsThis<R> = Optional<ExtraPageOptionsThis_<R>>

export function FPage<R extends HookReturn>(func: PageHookFunc<R>, extraOptions?: ExtraPageOptionsThis<R>) {
  // @ts-ignore
  return Page<any, WXRenderHooksCtx>({
    onLoad(options) {
      onCreate.call(this, func as HookFunc<any, R>, options)
    },
    onUnload() {
      onDestroy.call(this)
    },
    ...extraOptions
  })
}

type ExtraCompOptionsView<R> = ChunkedComp & { readonly data: PickDataFromHookReturn<R> } & PickMethodsFromHookReturn<R>;
type ExtraCompOptions_ = Omit<Component.WXComponentConstructorOptions,
  | "data" | "properties" | "methods" | "observers" // these are provided by props and hookfunc
  | "attached" | "detached" // these can be mocked by useEffect
  | "behaviors" | "lifetimes" // these are forbidden
>
type ExtraCompOptions = Required<ExtraCompOptions_>
type ExtraCompOptionsThis_<R> = { [K in keyof ExtraCompOptions]: ExtraCompOptions[K] extends AnyFunction ? (this: ExtraCompOptionsView<R>, ...args: Parameters<ExtraCompOptions[K]>) => ReturnType<ExtraCompOptions[K]> : ExtraCompOptions[K] }
type ExtraCompOptionsThis<R> = Optional<ExtraCompOptionsThis_<R>>

export function FComp<T extends undefined, R extends HookReturn>(func: HookFunc<T, R>, extraOptions?: ExtraCompOptionsThis<R>): void
export function FComp<T extends AnyObject, R extends HookReturn>(func: HookFunc<T, R>, defaultProps: T, extraOptions?: ExtraCompOptionsThis<R>): void

export function FComp<T extends HookProps, R extends HookReturn>(func: HookFunc<T, R>, defaultProps?: T, extraOptions?: ExtraCompOptionsThis<R>) {
  const properties: any = transformProperties(defaultProps)
  const propertyKeys: string[] = []
  for (const k in properties) {
    properties[k].observer = propChangeObserver
    propertyKeys.push(k)
  }
  // @ts-ignore
  return Component<T, any, WXRenderHooksCtx>({
    properties,
    attached() {
      onCreate.call<WXRenderer, HookFunc<T, R>, T, void>(this, func, this.properties)
    },
    detached() {
      onDestroy.call(this)
    },
    ...extraOptions
  })
}

export function createHookRunner<T extends HookProps, R extends HookReturn>(hook: HookFunc<T, R>, defaultProps: T) {
  // @ts-ignore
  const mockRenderrer: WXPage = {
    data: {},
    setData(data: any, callback?: () => void) { setTimeout(callback) },
    onLoad() {
      onCreate.call<WXRenderer, HookFunc<T, R>, T, void>(this, hook, defaultProps)
    },
    onUnload() {
      onDestroy.call(this)
    }
  }

  const proxy = new Proxy(mockRenderrer, {
    get(target: any, key: string) {
      if (key in target) {
        return target[key]
      }
      return endlessProxy
    }
  })

  proxy.onLoad()

  return {
    unMount() {
      proxy.onUnload()
    },
    run(props?: T) {
      if (props) {
        proxy.$$hooksCtx.props = props
      }
      proxy.$$hooksCtx.rerender()
    }
  }
}

export function diffHookReturnData(newRet: any, oldRet: any) {
  const { data: newData } = splitDataAndMethod(newRet || {})
  const { data: oldData } = splitDataAndMethod(oldRet || {})

  return genDiff(newData, oldData)
}