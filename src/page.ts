/// <reference path="../typings/weapp/index.d.ts" />

import { collectClassProps, identity } from "./util"
import { debug } from "./debug";

interface WXPage<D extends AnyObject = never, A extends AnyObject = never> extends Page.WXPage<D> {
  actions: A
}

class WXPage<D extends AnyObject = never, A extends AnyObject = never> {
  /**
   * 调用小程序的Page函数注册一个页面,
   * 类中声明的属性和方法都会传给Page函数
   */
  public init(connect: AnyFunction = identity) {
    let props = collectClassProps(this, "init")

    props = checkActionsProp(props)
    props = checkForbiddenProps(props)
    props = connect(props)
    props = injectActions(props)

    debug("Page:options", (this as any).__proto__.constructor.name, props)

    Page(props)
  }
}

function checkActionsProp(props: any) {
  const { actions, ...others } = props
  if (actions) {
    throw new Error("WXComponent: 子类不应声明actions属性，这是给redux预留的，应当由redux注入")
  }
  return others
}

function checkForbiddenProps(props: any) {
  const { route, setData, ...others } = props
  if (route || setData) {
    throw new Error("WXPage: 子类中覆盖了微信内部的属性或变量，请检查")
  }
  return others
}

function injectActions(props: any) {
  for (const k in props.actions) {
    props["actions." + k] = props.actions[k]
  }
  return props
}

export { WXPage } 
