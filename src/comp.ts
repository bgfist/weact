/// <reference path="../typings/weapp/index.d.ts" />

import { collectClassProps, splitFieldsAndMethods, identity, transformProperties, ConnectFunc } from "./util"
import { debug } from "./debug";

interface WXComponent<P extends AnyObject = never, D extends AnyObject = never, A extends AnyObject = never> extends Component.WXComponent<P, D> {
  actions: A
}

type WXComponentOptions = Component.WXComponent<any, any> & AnyObject
type WXComponentBehaviorOptions = Component.WXComponentBehavior<any, any> & AnyObject

class WXComponent<P extends AnyObject = never, D extends AnyObject = never, A extends AnyObject = never> {
  public init(connect: ConnectFunc = identity) {
    let props: WXComponentOptions = collectClassProps(this, "init")

    checkCreatedProp(props)
    checkMethodsProp(props)
    checkActionsProp(props)
    checkForbiddenProps(props)

    props = connect(props, true)
    checkCreatedProp(props)
    checkForbiddenProps(props)

    const {
      options,
      externalClasses,
      behaviors,
      properties,
      data,
      observers,
      lifetimes,
      pageLifetimes,
      export: $export,
      relations,
      created,
      attached,
      ready,
      moved,
      detached,
      error,
      ...others
    } = props

    // deal with property
    const transformedProperties = transformProperties(properties)
    props.properties = transformedProperties

    // prepare fields and methods
    const { fields, methods } = splitFieldsAndMethods(others)

    // deal with fields
    moveFieldsToThisWhenAttatched(props, fields)

    // deal with methods
    props.methods = {
      ...props.methods,
      ...methods
    }

    debug("Component:options", (this as any).__proto__.constructor.name, props)

    Component(props)
  }
}

interface WXComponentBehavior<P extends AnyObject = any, D extends AnyObject = any, A extends AnyObject = never> extends Component.WXComponentBehavior<P, D> {
  actions: A
}

class WXComponentBehavior<P extends AnyObject = any, D extends AnyObject = any, A extends AnyObject = never> {
  public init(connect: ConnectFunc<WXComponentBehaviorOptions> = identity) {
    let props: WXComponentBehaviorOptions = collectClassProps(this, "init")

    checkCreatedProp(props)
    checkMethodsProp(props)
    checkActionsProp(props)
    checkForbiddenProps(props)

    props = connect(props, true)
    checkCreatedProp(props)
    checkForbiddenProps(props)

    const { behaviors, properties, data, created, attached, ready, moved, detached, error, ...others } = props


    // deal with property
    const transformedProperties = transformProperties(properties)
    props.properties = transformedProperties

    // prepare fields and methods
    const { fields, methods } = splitFieldsAndMethods(others)

    // deal with fields
    moveFieldsToThisWhenAttatched(props, fields)

    // deal with methods
    props.methods = {
      ...props.methods,
      ...methods
    }

    debug("Behavior:options", (this as any).__proto__.constructor.name, props)

    return Behavior(props)
  }
}

function checkCreatedProp(props: WXComponentOptions | WXComponentBehaviorOptions) {
  if (props.created) {
    throw new Error("WXComponent: 不支持created钩子")
  }
}

function checkMethodsProp(props: WXComponentOptions | WXComponentBehaviorOptions) {
  if (props.methods) {
    throw new Error("WXComponent: 子类不应声明methods属性，应该直接写成类的方法")
  }
}

function checkActionsProp(props: WXComponentOptions | WXComponentBehaviorOptions) {
  if (props.actions) {
    throw new Error("WXComponent: 子类不应声明actions属性，这是给redux预留的，应当由redux注入")
  }
}

function checkForbiddenProps(props: WXComponentOptions | WXComponentBehaviorOptions) {
  const {
    is,
    id,
    dataset,
    setData,
    triggerEvent,
    createSelectorQuery,
    createIntersectionObserver,
    selectComponent,
    selectAllComponents,
    getRelationNodes,
    groupSetData,
    getTabBar,
    getPageId,
  } = props

  if (
    is ||
    id ||
    dataset ||
    setData ||
    triggerEvent ||
    createSelectorQuery ||
    createIntersectionObserver ||
    selectComponent ||
    selectAllComponents ||
    getRelationNodes ||
    groupSetData ||
    getTabBar ||
    getPageId
  ) {
    throw new Error("WXComponent: 子类中覆盖了微信内部的属性或变量，请检查")
  }
}

function moveFieldsToThisWhenAttatched(props: WXComponentOptions | WXComponentBehaviorOptions, fields: AnyObject) {
  const { attached } = props

  props.attached = function (this: WXComponent<any, any, any> | WXComponentBehavior<any, any, any>) {
    this.actions = props.actions
    for (const k in fields) {
      Object.defineProperty(this, k, {
        value: fields[k]
      })
    }
    attached && attached.call(this)
  }
}

export { WXComponent, WXComponentBehavior }
