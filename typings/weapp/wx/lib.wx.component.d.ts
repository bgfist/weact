declare namespace Component {

  interface WXComponentMethods {
    [name: string]: (...args: any[]) => void
  }

  interface WXComponentObserver {
    (...newVals: any[]): void
  }

  interface WXComponentDefinitionFilter {
    (defFields: WXComponent, definitionFilterArr: WXComponentDefinitionFilter[]): void
  }

  interface WXComponentEventOptions {
    /**
     * 事件是否冒泡
     */
    bubbles?: boolean
    /**
     * 事件是否可以穿越组件边界，为false时，事件将只能在引用组件的节点树上触发，不进入其他任何组件内部
     */
    composed?: boolean
    /**
     * 事件是否拥有捕获阶段
     */
    capturePhase?: boolean
  }

  interface WXComponentOptions {
    /**
     * 在组件定义时的选项中启用多slot支持
     */
    multipleSlots?: boolean
    /**
     * isolated 表示启用样式隔离，在自定义组件内外，使用 class 指定的样式将不会相互影响（一般情况下的默认值）；
     * apply-shared 表示页面 wxss 样式将影响到自定义组件，但自定义组件 wxss 中指定的样式不会影响页面；
     * shared 表示页面 wxss 样式将影响到自定义组件，自定义组件 wxss 中指定的样式也会影响页面和其他设置了 apply-shared 或 shared 的自定义组件。（这个选项在插件中不可用。）
     */
    styleIsolation?: 'isolated' | 'apply-shared' | 'shared'
    /**
     * 这个选项等价于设置 styleIsolation: apply-shared ，但设置了 styleIsolation 选项后这个选项会失效
     */
    addGlobalClass?: boolean
  }

  interface WXComponentRelation {
    /**
     * 目标组件的相对关系，可选的值为 parent 、 child 、 ancestor 、 descendant
     */
    type: 'parent' | 'child' | 'ancestor' | 'descendant'
    /**
     * 关系生命周期函数，当关系被建立在页面节点树中时触发，触发时机在组件attached生命周期之后
     */
    linked?: (target: wx.NodesRef) => void
    /**
     * 关系生命周期函数，当关系在页面节点树中发生改变时触发，触发时机在组件moved生命周期之后
     */
    linkChanged?: (target: wx.NodesRef) => void
    /**
     * 关系生命周期函数，当关系脱离页面节点树时触发，触发时机在组件detached生命周期之后
     */
    unlinked?: (target: wx.NodesRef) => void
    /**
     * 	如果这一项被设置，则它表示关联的目标节点所应具有的behavior，所有拥有这一behavior的组件节点都会被关联
     */
    target?: WXComponentBehavior
  }

  /**
   * 组建的生命周期函数
   */
  interface WXComponentLifeCycle {
    /**
     * 在组件实例刚刚被创建时执行
     */
    created?(): void
    /**
     * 在组件实例进入页面节点树时执行
     */
    attached?(): void
    /**
     * 在组件在视图层布局完成后执行
     */
    ready?(): void
    /**
     * 在组件实例被移动到节点树另一个位置时执行
     */
    moved?(): void
    /**
     * 在组件实例被从页面节点树移除时执行
     */
    detached?(): void
    /**
     * 每当组件方法抛出错误时执行	2.4.1
     * @param err 
     */
    error?(err: Error): void
  }

  /**
   * 组建内与页面相关的生命周期函数
   */
  interface WXComponentPageLifeCycle {
    /**
     * 组件所在的页面被展示时执行
     */
    show?(): void
    /**
     * 组件所在的页面被隐藏时执行
     */
    hide?(): void
    /**
     * 组件所在的页面尺寸变化时执行
     */
    resize?(size: { width: number; height: number }): void
  }

  type WXComponentBehaviourThisContext<P extends AnyObject = {}, D extends AnyObject = {}, M extends WXComponentMethods = {}> = ThisType<WXComponentBehavior<P, D> & M>

  /**
   * 构建mixin的可选字段
   */
  interface WXComponentBehaviorConstructorOptions<P extends AnyObject = {}, D extends AnyObject = {}, M extends WXComponentMethods = {}> {
    behaviors?: (WXComponentBehavior | string)[]

    definitionFilter?: WXComponentDefinitionFilter

    /**
     * 填默认值，小程序会将实际值填进去
     */
    properties?: P

    data?: NotOverlap<D, P>

    methods?: M & WXComponentBehaviourThisContext<P, D, M>
  }

  /** 
   * mixin的this实例
   * 
   * 一些字段即使没传也有默认值
   */
  interface WXComponentBehavior<P extends AnyObject = {}, D extends AnyObject = {}, M extends WXComponentMethods = {}> extends WXComponentBehaviorConstructorOptions<P, D, M>, WXComponentInstance<P, D> {
    properties: P
    data: NotOverlap<D, P>
  }

  /**
   * 组建的内部属性和方法
   */
  interface WXComponentInstance<P extends AnyObject = {}, D extends AnyObject = {}> {
    /**
     * 组件的文件路径
     */
    is: string

    /**
     * 节点id
     */
    id: string

    /**
     * 节点dataset
     */
    dataset: { [k: string]: string }

    setData(
      data: Optional<NotOverlap<D, P>> & AnyObject,
      callback?: () => void
    ): void

    triggerEvent(name: string, detail: object, options: WXComponentEventOptions): void

    createSelectorQuery(): wx.SelectorQuery;

    selectComponent(selector: string): WXComponent

    selectAllComponents(selector: string): WXComponent[]

    getRelationNodes(relationKey: string): wx.NodesRef[]

    groupSetData(callback: Function): void

    getTabBar(): WXComponent[]

    createIntersectionObserver(
      /** 选项 */
      options?: wx.CreateIntersectionObserverOption,
    ): wx.IntersectionObserver;

    /**
     * 返回页面标识符（一个字符串），可以用来判断几个自定义组件实例是不是在同一个页面内
     */
    getPageId(): string
  }

  type WXComponentThisContext<P extends AnyObject = {}, D extends AnyObject = {}, M = {}> = ThisType<WXComponent<P, D> & M>

  /**
   * 构建组件的可选字段
   */
  interface WXComponentConstructorOptions<P extends AnyObject = {}, D extends AnyObject = {}, M extends WXComponentMethods = {}> {
    options?: WXComponentOptions

    externalClasses?: string[]

    behaviors?: (WXComponentBehavior | string)[]

    /**
     * 填默认值，小程序会将实际值填进去
     */
    properties?: P

    data?: NotOverlap<D, P>

    methods?: M & WXComponentThisContext<P, D, M>

    observers?: { [keyPath in keyof (P | D)]: WXComponentObserver } & { [keyPath: string]: WXComponentObserver } & WXComponentThisContext<P, D, M>

    lifetimes?: WXComponentLifeCycle & WXComponentThisContext<P, D, M>

    pageLifetimes?: WXComponentPageLifeCycle & WXComponentThisContext<P, D, M>

    export?(): any

    relations?: { [k: string]: any }
  }

  /** 
   * 组件的this实例
   * 
   * 一些字段即使没传也有默认值
   */
  interface WXComponent<P extends AnyObject = {}, D extends AnyObject = {}, M extends WXComponentMethods = {}> extends WXComponentConstructorOptions<P, D, M>, WXComponentInstance<P, D> {
    properties: P
    data: NotOverlap<D, P>
  }

  type ComponentOptions<P extends AnyObject = {}, D extends AnyObject = {}, M extends WXComponentMethods = {}> = WXComponentConstructorOptions<P, D, M> & WXComponentLifeCycle & WXComponentThisContext<P, D, M>

  interface WXComponentConstructor {
    <P extends IAnyObject = {}, D extends AnyObject = {}, M extends WXComponentMethods = {}, E extends AnyObject = {}>(
      options: ComponentOptions<P, D, M> & E
    ): void
  }

  type BehaviourOptions<P extends AnyObject = {}, D extends AnyObject = {}, M extends WXComponentMethods = {}> = WXComponentBehaviorConstructorOptions<P, D, M> & WXComponentLifeCycle & WXComponentBehaviourThisContext<P, D, M>

  interface WXComponentBehaviorConstructor {
    <P extends AnyObject = {}, D extends AnyObject = {}, M extends WXComponentMethods = {}, E extends AnyObject = {}>(
      options: BehaviourOptions<P, D, M> & E
    ): WXComponentBehavior
  }

}

declare const Component: Component.WXComponentConstructor
declare const Behavior: Component.WXComponentBehaviorConstructor