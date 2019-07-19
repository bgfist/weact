/// <reference path="../typings/weapp/index.d.ts" />

import { transformProperties, endlessProxy, deepCopy } from "./util"
import { genDiff } from './diff'
import { debug, debugIt } from './debug'

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
  batchUpdating: boolean
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
export function useState<T>(initValue: T | ((...args: any[]) => T)): [T, Updater<T>]
export function useState<T>(initValue?: T | ((...args: any[]) => T)): [T, Updater<T>] {
  assetRendering()

  const inst = currentRenderer!
  const cursor = hookCursor++

  if (!(cursor in inst.$$hooksCtx.state)) {
    inst.$$hooksCtx.state[cursor] = typeof initValue === 'function' ? initValue.call(null) : initValue
  }

  const updater = (value: UpdaterParam<T>) => {
    if (typeof value === "function") {
      inst.$$hooksCtx.state[cursor] = value.call(null, inst.$$hooksCtx.state[cursor])
    } else {
      inst.$$hooksCtx.state[cursor] = value
    }
    if (!inst.$$hooksCtx.batchUpdating) {
      inst.$$hooksCtx.rerender()
    }
  }

  return [inst.$$hooksCtx.state[cursor], updater]
}

/**
 * 与react-hooks的useEffect有执行时机的区别，effectFunc直接在当前render函数中执行，
 * 所以不要在effectFunc中同步更新数据
 * 
 * @param effectFunc 在每次依赖变化时执行的副作用函数，
 * @param deps 不传表示每次更新都触发，传空数组表示只在创建和销毁时触发，传非空数组表示依赖变化时触发
 * @param onlyUpdate 仅在更新时触发，初始时不触发
 */
export function useEffect(effectFunc: () => UnLoad, deps?: any[], onlyUpdate?: boolean) {
  assetRendering()

  const inst = currentRenderer!
  const cursor = hookCursor++
  const effect = inst.$$hooksCtx.effect[cursor]

  if (effect === undefined) {
    if (onlyUpdate) {
      inst.$$hooksCtx.effect[cursor] = {
        unload: undefined,
        lastDeps: deps
      }
    } else {
      inst.$$hooksCtx.effect[cursor] = {
        unload: effectFunc.call(null),
        lastDeps: deps
      }
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

/**
 * 与react-hooks的useLayoutEffect有执行时机的区别，effectFunc将在视图刷新后执行
 */
export function useLayoutEffect(effectFunc: () => UnLoad, deps?: any[], onlyUpdate?: boolean) {
  assetRendering()

  const inst = currentRenderer!
  const cursor = hookCursor++
  if (!inst.$$hooksCtx.layoutEffect[cursor]) {
    inst.$$hooksCtx.layoutEffect[cursor] = {}
  }
  useEffect(() => {
    inst.$$hooksCtx.layoutEffect[cursor].effectFunc = effectFunc
  }, deps, onlyUpdate)
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
  const previous = useRef<T>()
  const previousValue = previous.current
  previous.current = value

  return previousValue
}

/**
 * 让函数在条件满足时(只)执行一次
 * 
 * @param condition 满足条件，不传默认为true
 */
export function useOnce(func: AnyFunction, condition = true) {
  const invoked = useRef(false)
  if (!invoked.current && condition) {
    invoked.current = true
    return func.call(null)
  }
}

/**
 * 批量更新数据
 */
export function useBatchUpdate<A, B>(updaterA: Updater<A>, updaterB: Updater<B>): (valueA: UpdaterParam<A>, valueB: UpdaterParam<B>) => void
export function useBatchUpdate<A, B, C>(updaterA: Updater<A>, updaterB: Updater<B>, updaterC: Updater<C>): (valueA: UpdaterParam<A>, valueB: UpdaterParam<B>, valueC: UpdaterParam<C>) => void
export function useBatchUpdate<A, B, C, D>(updaterA: Updater<A>, updaterB: Updater<B>, updaterC: Updater<C>, updaterD: Updater<D>): (valueA: UpdaterParam<A>, valueB: UpdaterParam<B>, valueC: UpdaterParam<C>, valueD: UpdaterParam<D>) => void
export function useBatchUpdate<A, B, C, D, E>(updaterA: Updater<A>, updaterB: Updater<B>, updaterC: Updater<C>, updaterD: Updater<D>, updaterE: Updater<E>): (valueA: UpdaterParam<A>, valueB: UpdaterParam<B>, valueC: UpdaterParam<C>, valueD: UpdaterParam<D>, valueE: UpdaterParam<E>) => void
export function useBatchUpdate<A, B, C, D, E, F>(updaterA: Updater<A>, updaterB: Updater<B>, updaterC: Updater<C>, updaterD: Updater<D>, updaterE: Updater<E>, updaterF: Updater<F>): (valueA: UpdaterParam<A>, valueB: UpdaterParam<B>, valueC: UpdaterParam<C>, valueD: UpdaterParam<D>, valueE: UpdaterParam<E>, valueF: UpdaterParam<F>) => void
export function useBatchUpdate<A, B, C, D, E, F, G>(updaterA: Updater<A>, updaterB: Updater<B>, updaterC: Updater<C>, updaterD: Updater<D>, updaterE: Updater<E>, updaterF: Updater<F>, updaterG: Updater<G>): (valueA: UpdaterParam<A>, valueB: UpdaterParam<B>, valueC: UpdaterParam<C>, valueD: UpdaterParam<D>, valueE: UpdaterParam<E>, valueF: UpdaterParam<F>, valueG: UpdaterParam<G>) => void
export function useBatchUpdate<T>(...updaters: Array<Updater<T>>): (...values: Array<UpdaterParam<T>>) => void
export function useBatchUpdate(...updaters: Array<Updater<any>>) {
  assetRendering()

  const inst = currentRenderer!

  return (...values: Array<UpdaterParam<any>>) => {
    inst.$$hooksCtx.batchUpdating = true
    updaters.forEach((updater, i) => updater.call(null, values[i]))
    inst.$$hooksCtx.batchUpdating = false
    inst.$$hooksCtx.rerender()
  }
}


type ChunkedPage = Omit<Page.WXPageInstance<any>, "setData">

/**
 * 获取当前page实例(阉割版，只有部分方法和属性)
 * - 不传func则直接返回page实例
 * - 传func，则func的第一个参数是page实例，useThisAsPage将返回func函数的返回
 */
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

/**
 * 获取当前component实例(阉割版，只有部分方法和属性)
 * - 不传func则直接返回component实例
 * - 传func，则func的第一个参数是component实例，useThisAsComp将返回func函数的返回
 */
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

function onCreate<T extends HookProps, R extends HookReturn>(this: WXRenderer<T>, hook: HookFunc<T, R>, props: T) {
  this.$$hooksCtx = {
    renderName: hook.name,
    props,
    oldData: undefined,
    rerenderTriggerringByProp: false,
    state: [],
    effect: {},
    layoutEffect: {},
    memo: {},
    ref: {},
    batchUpdating: false,
    rerender: () => {
      currentRenderer = this
      hookCursor = 0
      const newDef = (hook.call(null, this.$$hooksCtx.props) || {}) as AnyObject
      currentRenderer = null

      const { data, methods } = splitDataAndMethod(newDef)

      if (debugIt()) {
        debug("NewDataAndMethods", this.$$hooksCtx.renderName, deepCopy(data), methods)
      }

      Object.keys(methods).forEach(key => {
        ; (this as any)[key] = methods[key]
      })

      const triggerLayoutEffect = () => {
        Object.keys(this.$$hooksCtx.layoutEffect).forEach(key => {
          const { effectFunc, unload } = this.$$hooksCtx.layoutEffect[key]
          if (effectFunc) {
            if (typeof unload === "function") {
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

      if (debugIt()) {
        debug("setData", this.$$hooksCtx.renderName, deepCopy(diff), noUpdate ? '[skipped]' : '')
      }

      if (noUpdate) {
        wx.nextTick(() => triggerLayoutEffect())
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
  Object.keys(this.$$hooksCtx.layoutEffect).forEach(key => {
    const effect = this.$$hooksCtx.layoutEffect[key]
    const unload = effect.unload
    if (typeof unload === "function") {
      unload.call(null)
    }
  })
  // @ts-ignore
  this.$$hooksCtx = null
}

type PageHookFunc<R extends HookReturn> = (options: any) => R

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

/**
 * 注册一个页面
 * 
 * @param hook 页面的render函数
 * @param extraOptions 其他选项，参见Page(options)
 */
export function FPage<R extends HookReturn>(hook: PageHookFunc<R>, extraOptions?: ExtraPageOptionsThis<R>) {
  // @ts-ignore
  return Page<any, WXRenderHooksCtx>({
    onLoad(options) {
      onCreate.call(this, hook as HookFunc<any, R>, options)
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

/**
 * 注册一个组件
 * 
 * @param hook 组件的render函数
 * @param defaultProps 组件的默认属性
 * @param extraOptions 组件的其他选项，参见Component(options)
 */
export function FComp<T extends undefined, R extends HookReturn>(func: HookFunc<T, R>, defaultProps?: T, extraOptions?: ExtraCompOptionsThis<R>): void
export function FComp<T extends AnyObject, R extends HookReturn>(func: HookFunc<T, R>, defaultProps: T, extraOptions?: ExtraCompOptionsThis<R>): void
export function FComp<T extends HookProps, R extends HookReturn>(hook: HookFunc<T, R>, defaultProps?: T, extraOptions?: ExtraCompOptionsThis<R>) {
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
      onCreate.call<WXRenderer, HookFunc<T, R>, T, void>(this, hook, this.properties)
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