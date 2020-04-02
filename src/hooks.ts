/// <reference types="miniprogram-api-typings"/>

import { transformProperties, deepCopy, splitFieldsAndMethods } from "./util"
import { genDiff } from './diff'
import { debug, debugIt } from './debug'

type AnyObject = Record<string, any>
type AnyFunction = (...args: any[]) => any
type NotOverlap<Dist, Src> = Extract<keyof Dist, keyof Src> extends never ? Dist : never

/**
 * hook的参数，为以下三种情况
 * 1. 不传
 * 2. 传page的onLoad函数中接收到的options
 * 3. 传component的properties
 */
export type HookProp = AnyObject | undefined
/**
 * hook的返回值，为数据和方法的集合
 */
export type HookReturn = AnyObject | void
/**
 * hook函数的类型定义，参数和返回值之间不能有冲突字段
 */
export type HookFunc<T extends HookProp, R extends HookReturn> = (props: T) => NotOverlap<R, T>


// ------------------------ 以下为hook上下文的相关定义 ----------------------------

export type HookRecord<T> = Record<string, T>
export type HookUpdaterParam<T> = T | ((prev: T) => T)
export type HookUpdater<T> = (value: HookUpdaterParam<T>) => void
export type HookUnLoad = any
export type HookRef<T> = { current: T }
export type HookContext<T extends HookProp> = {
  renderName: string,
  props: T
  oldData?: AnyObject
  applyingPropChange: boolean
  render: () => void
  state: HookRecord<any>
  effect: HookRecord<{
    unload: HookUnLoad
    lastDeps?: any[]
  }>
  layoutEffect: HookRecord<{
    effectFunc?: () => HookUnLoad
    unload?: HookUnLoad
  }>
  memo: HookRecord<any>
  ref: HookRecord<HookRef<any>>
  batchUpdating: boolean
}
export type HookRendererContext<T extends HookProp> = { $$hooksCtx: HookContext<T> }
export type HookRenderer<T extends HookProp> = (WechatMiniprogram.Page.TrivialInstance | WechatMiniprogram.Component.TrivialInstance) & HookRendererContext<T>


// -------------------------- 以下为hook的实现代码 ----------------------------

let currentRenderer: HookRenderer<any> | null = null
let hookCursor = 0

function assetRendering() {
  if (!currentRenderer) {
    throw new Error("hook未在函数式组件中使用")
  }
}

function propChangeObserver(this: WechatMiniprogram.Component.TrivialInstance & HookRendererContext<AnyObject>, newVal: any, oldVal: any) {
  debug("PropChanged", this.$$hooksCtx && this.$$hooksCtx.renderName, newVal === oldVal || !this.$$hooksCtx ? '[render skipped]' : '')
  if (newVal !== oldVal) {
    if (this.$$hooksCtx) {
      const hooksCtx = this.$$hooksCtx
      debug("propChanged:render", hooksCtx.renderName, newVal, hooksCtx.applyingPropChange ? '[skipped]' : '')
      // 加锁，多个属性同时改变会依次触发这个observer
      if (!hooksCtx.applyingPropChange) {
        hooksCtx.applyingPropChange = true
        wx.nextTick(() => hooksCtx.applyingPropChange = false)
        hooksCtx.render()
      }
    }
  }
}

function onCreate<T extends HookProp, R extends HookReturn>(this: HookRenderer<T>, hook: HookFunc<T, R>, props: T) {
  let rendering = false

  const hooksCtx: HookContext<T> = this.$$hooksCtx = {
    renderName: hook.name,
    props,
    oldData: undefined,
    applyingPropChange: false,
    state: [],
    effect: {},
    layoutEffect: {},
    memo: {},
    ref: {},
    batchUpdating: false,
    render: () => {
      if (rendering) {
        throw new Error("嵌套调用hook，请检查hook中是否有同步调用update的操作，可使用wx.nextTick规避")
      }

      rendering = true
      currentRenderer = this
      hookCursor = 0
      const newDef = (hook.call(null, hooksCtx.props) || {}) as AnyObject
      currentRenderer = null
      rendering = false

      const { fields: data, methods } = splitFieldsAndMethods(newDef)

      if (debugIt()) {
        debug("newDataAndMethods", hooksCtx.renderName, deepCopy(data), methods)
      }

      Object.keys(methods).forEach(key => {
        ; (this as any)[key] = methods[key]
      })

      const triggerEffect = () => {
        Object.keys(hooksCtx.layoutEffect).forEach(key => {
          const { effectFunc, unload } = hooksCtx.layoutEffect[key]
          if (effectFunc) {
            if (typeof unload === "function") {
              unload.call(null)
            }
            hooksCtx.layoutEffect[key].effectFunc = undefined
            hooksCtx.layoutEffect[key].unload = effectFunc.call(null)
          }
        })
      }

      const diff = genDiff(data, hooksCtx.oldData)
      hooksCtx.oldData = data

      const noUpdate = !Object.keys(diff).length

      if (debugIt()) {
        debug("setData", hooksCtx.renderName, deepCopy(diff), noUpdate ? '[skipped]' : '')
      }

      if (noUpdate) {
        wx.nextTick(() => triggerEffect())
        return
      }

      this.setData(diff as any, () => {
        debug("setData:updated", hooksCtx.renderName)
        triggerEffect()
      })
    }
  }
  hooksCtx.render()
}

function onDestroy(this: HookRenderer<any>) {
  const hooksCtx = this.$$hooksCtx

  Object.keys(hooksCtx.effect).forEach(key => {
    const effect = hooksCtx.effect[key]
    const unload = effect.unload
    if (typeof unload === "function") {
      unload.call(null)
    }
  })
  Object.keys(hooksCtx.layoutEffect).forEach(key => {
    const effect = hooksCtx.layoutEffect[key]
    const unload = effect.unload
    if (typeof unload === "function") {
      unload.call(null)
    }
  })
}

/**
 * @param initValue 初始值，传函数则直接执行该函数然后将其返回值存为初始值
 */
export function useState<T>(): [T | undefined, HookUpdater<T | undefined>]
export function useState<T>(initValue: T | ((...args: any[]) => T)): [T, HookUpdater<T>]
export function useState<T>(initValue?: T | ((...args: any[]) => T)): [T, HookUpdater<T>] {
  assetRendering()

  const hooksCtx = currentRenderer!.$$hooksCtx
  const cursor = hookCursor++

  if (!(cursor in hooksCtx.state)) {
    hooksCtx.state[cursor] = typeof initValue === 'function' ? (initValue as (...args: any[]) => T).call(null) : initValue
  }

  const updater = (value: HookUpdaterParam<T>) => {
    if (typeof value === "function") {
      hooksCtx.state[cursor] = (value as (prev: T) => T).call(null, hooksCtx.state[cursor])
    } else {
      hooksCtx.state[cursor] = value
    }
    if (!hooksCtx.batchUpdating) {
      hooksCtx.render()
    }
  }

  return [hooksCtx.state[cursor], updater]
}

/**
 * @param effectFunc 在每次依赖变化时执行的副作用函数，effectFunc直接同步执行
 * @param deps 不传表示每次更新都触发，传空数组表示只在创建和销毁时触发，传非空数组表示依赖变化时触发
 * @param onlyUpdate 仅在更新时触发，初始时不触发
 */
export function useSideEffect(effectFunc: () => HookUnLoad, deps?: any[], onlyUpdate?: boolean) {
  assetRendering()

  const hooksCtx = currentRenderer!.$$hooksCtx
  const cursor = hookCursor++
  const effect = hooksCtx.effect[cursor]

  if (effect === undefined) {
    if (onlyUpdate) {
      hooksCtx.effect[cursor] = {
        unload: undefined,
        lastDeps: deps
      }
    } else {
      hooksCtx.effect[cursor] = {
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
 * @param effectFunc 在每次依赖变化时执行的副作用函数，将在视图更新后执行(异步执行)
 * @param deps 不传表示每次更新都触发，传空数组表示只在创建和销毁时触发，传非空数组表示依赖变化时触发
 * @param onlyUpdate 仅在更新时触发，初始时不触发
 */
export function useEffect(effectFunc: () => HookUnLoad, deps?: any[], onlyUpdate?: boolean) {
  assetRendering()

  const hooksCtx = currentRenderer!.$$hooksCtx
  const cursor = hookCursor++

  if (!hooksCtx.layoutEffect[cursor]) {
    hooksCtx.layoutEffect[cursor] = {}
  }

  useSideEffect(() => {
    hooksCtx.layoutEffect[cursor].effectFunc = effectFunc
  }, deps, onlyUpdate)
}

/**
 * @param compute 计算函数，每次依赖变化时执行
 * @param deps 不传表示每次更新都触发，传空数组表示只在创建和销毁时触发，传非空数组表示依赖变化时触发
 */
export function useMemo<T>(compute: () => T, deps?: any[]): T {
  assetRendering()

  const hooksCtx = currentRenderer!.$$hooksCtx
  const cursor = hookCursor++

  useSideEffect(() => {
    hooksCtx.memo[cursor] = compute()
  }, deps)

  return hooksCtx.memo[cursor]
}

/**
 * returns a mutable ref object whose .current property is initialized to the passed argument (initialValue). 
 * The returned object will persist for the full lifetime of the component.
 */
export function useRef<T>(): HookRef<T | undefined>
export function useRef<T>(initValue: T): HookRef<T>
export function useRef<T>(initValue?: T): HookRef<T> {
  assetRendering()

  const hooksCtx = currentRenderer!.$$hooksCtx
  const cursor = hookCursor++

  if (!hooksCtx.ref[cursor]) {
    hooksCtx.ref[cursor] = { current: initValue }
  }

  return hooksCtx.ref[cursor]
}

/**
 * An alternative to useState. Accepts a reducer of type (state, action) => newState, 
 * and returns the current state paired with a dispatch method
 */
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

/**
 * 每次都返回之前的值，第一次执行时返回undefined
 */
export function usePrevious<T>(value: T) {
  const previous = useRef<T>()
  const previousValue = previous.current
  previous.current = value

  return previousValue
}

/**
 * 让函数在条件满足时(只)执行一次
 * 
 * @param func 将在render完之后执行
 * @param condition 执行条件，不传默认为true
 */
export function useOnce(func: AnyFunction, condition = true) {
  const invoked = useRef(false)

  useEffect(() => {
    if (!invoked.current && condition) {
      invoked.current = true
      func.call(null)
    }
  })
}

/**
 * 批量更新数据
 * 
 * @params 传入updater(setState返回的第二个参数)的数组
 * 
 * ```ts
 * const [age, updateAge] = useState(0)
 * const [name, updateName] = useState("weact")
 * 
 * const updateAgeAndName = useBatchUpdate(updateAge, updateName)
 * // 然后像下面这样批量更新
 * // updateAgeAndName(20, "react")
 * ```
 */
export function useBatchUpdate<A, B>(updaterA: HookUpdater<A>, updaterB: HookUpdater<B>): (valueA: HookUpdaterParam<A>, valueB: HookUpdaterParam<B>) => void
export function useBatchUpdate<A, B, C>(updaterA: HookUpdater<A>, updaterB: HookUpdater<B>, updaterC: HookUpdater<C>): (valueA: HookUpdaterParam<A>, valueB: HookUpdaterParam<B>, valueC: HookUpdaterParam<C>) => void
export function useBatchUpdate<A, B, C, D>(updaterA: HookUpdater<A>, updaterB: HookUpdater<B>, updaterC: HookUpdater<C>, updaterD: HookUpdater<D>): (valueA: HookUpdaterParam<A>, valueB: HookUpdaterParam<B>, valueC: HookUpdaterParam<C>, valueD: HookUpdaterParam<D>) => void
export function useBatchUpdate<A, B, C, D, E>(updaterA: HookUpdater<A>, updaterB: HookUpdater<B>, updaterC: HookUpdater<C>, updaterD: HookUpdater<D>, updaterE: HookUpdater<E>): (valueA: HookUpdaterParam<A>, valueB: HookUpdaterParam<B>, valueC: HookUpdaterParam<C>, valueD: HookUpdaterParam<D>, valueE: HookUpdaterParam<E>) => void
export function useBatchUpdate<A, B, C, D, E, F>(updaterA: HookUpdater<A>, updaterB: HookUpdater<B>, updaterC: HookUpdater<C>, updaterD: HookUpdater<D>, updaterE: HookUpdater<E>, updaterF: HookUpdater<F>): (valueA: HookUpdaterParam<A>, valueB: HookUpdaterParam<B>, valueC: HookUpdaterParam<C>, valueD: HookUpdaterParam<D>, valueE: HookUpdaterParam<E>, valueF: HookUpdaterParam<F>) => void
export function useBatchUpdate<A, B, C, D, E, F, G>(updaterA: HookUpdater<A>, updaterB: HookUpdater<B>, updaterC: HookUpdater<C>, updaterD: HookUpdater<D>, updaterE: HookUpdater<E>, updaterF: HookUpdater<F>, updaterG: HookUpdater<G>): (valueA: HookUpdaterParam<A>, valueB: HookUpdaterParam<B>, valueC: HookUpdaterParam<C>, valueD: HookUpdaterParam<D>, valueE: HookUpdaterParam<E>, valueF: HookUpdaterParam<F>, valueG: HookUpdaterParam<G>) => void
export function useBatchUpdate<T>(...updaters: Array<HookUpdater<T>>): (...values: Array<HookUpdaterParam<T>>) => void
export function useBatchUpdate(...updaters: Array<HookUpdater<any>>) {
  assetRendering()

  const hooksCtx = currentRenderer!.$$hooksCtx

  return (...values: Array<HookUpdaterParam<any>>) => {
    hooksCtx.batchUpdating = true
    updaters.forEach((updater, i) => updater.call(null, values[i]))
    hooksCtx.batchUpdating = false
    hooksCtx.render()
  }
}


/**
 * 阉割版page实例，只有部分方法和属性
 */
export type ChunkedPage = Omit<WechatMiniprogram.Page.TrivialInstance, "setData">
/**
 * 获取当前page实例(阉割版，只有部分方法和属性)
 * - 不传func则直接返回page实例
 * - 传func，则func的第一个参数是阉割版page实例，useThisAsPage将返回func函数执行后的结果
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

/**
 * 阉割版component实例，只有部分方法和属性
 */
type ChunkedComp = Omit<WechatMiniprogram.Component.TrivialInstance, "setData">
/**
 * 获取当前component实例(阉割版，只有部分方法和属性)
 * - 不传func则直接返回component实例
 * - 传func，则func的第一个参数是阉割版component实例，useThisAsComp将返回func函数执行后的结果
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


// ---------------------- 以下为初始化page和component的接口 --------------------------

type PageHookFunc<R extends HookReturn> = (options: any) => R
type PickDataFromHookReturn_<R extends AnyObject> = { [K in keyof R]: R[K] extends AnyFunction ? never : R[K] }
type PickDataFromHookReturn<R extends AnyObject> = Readonly<PickDataFromHookReturn_<R>>
type PickMethodsFromHookReturn<R extends AnyObject> = { [K in keyof R]: R[K] extends AnyFunction ? R[K] : never }
type ExtraPageOptionsView<R> = ChunkedPage & { readonly data: PickDataFromHookReturn<R> } & PickMethodsFromHookReturn<R>;
type ExtraPageOptions_ = Omit<WechatMiniprogram.Page.Options<AnyObject, AnyObject>,
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
  return Page<any, HookRendererContext>({
    onLoad(options: any) {
      onCreate.call(this, hook as HookFunc<any, R>, options)
    },
    onUnload() {
      onDestroy.call(this)
    },
    ...extraOptions
  })
}

type ExtraCompOptionsView<R> = ChunkedComp & { readonly data: PickDataFromHookReturn<R> } & PickMethodsFromHookReturn<R>;
type ExtraCompOptions_ = Omit<WechatMiniprogram.Component.ComponentOptions,
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
export function FComp<T extends HookProp, R extends HookReturn>(hook: HookFunc<T, R>, defaultProps?: T, extraOptions?: ExtraCompOptionsThis<R>) {
  const properties: any = transformProperties(defaultProps)
  const propertyKeys: string[] = []
  for (const k in properties) {
    properties[k].observer = propChangeObserver
    propertyKeys.push(k)
  }
  // @ts-ignore
  return Component<T, any, HookRendererContext>({
    properties,
    attached() {
      onCreate.call(this, hook as HookFunc<any, R>, this.properties)
    },
    detached() {
      onDestroy.call(this)
    },
    ...extraOptions
  })
}