/// <reference path="../typings/weapp/index.d.ts" />

export function collectClassProps(obj: any, ...excludes: string[]) {
  const props: any = {}
  for (const k in obj) {
    // @ts-ignore
    props[k] = obj[k]
  }
  delete props.constructor
  excludes.forEach(exclude => delete props[exclude])
  return props
}

export function splitFieldsAndMethods(obj: any) {
  const fields: any = {}
  const methods: any = {}
  for (const k in obj) {
    if (typeof obj[k] === "function") {
      methods[k] = obj[k]
    } else {
      fields[k] = obj[k]
    }
  }
  return {
    fields,
    methods
  }
}

export function identity<T = any>(t: T) {
  return t
}

/**
 *
 * @param newData 新的数据，可能是部分
 * @param oldData 老的数据，为全部
 *
 * 只比较新数据中的字段
 */
export default function shallowEqual(newData: any, oldData: any) {
  if (newData === oldData) {
    return true
  }

  const keysA = Object.keys(newData)

  // Test for A's keys different from B.
  const hasOwn = Object.prototype.hasOwnProperty
  for (const key of keysA) {
    if (!hasOwn.call(oldData, key) || newData[key] !== oldData[key]) {
      return false
    }
  }

  return true
}

export function transformProperties(properties: any) {
  if (!properties) {
    return
  }

  return Object.keys(properties).reduce((obj: any, key) => {
    const value = properties[key]

    let type: any
    switch (typeof value) {
      case "undefined":
      case "symbol":
      case "bigint":
        throw new Error(`WXComponent: 不支持的属性类型，key=${key}, type=${typeof value}`)
      case "boolean":
        type = Boolean
        break
      case "number":
        type = Number
        break
      case "string":
        type = String
        break
      case "function":
        type = null
        break
      case "object":
        if (value instanceof Array) {
          type = Array
        } else {
          type = Object
        }
        break
    }

    obj[key] = {
      type,
      value
    }

    return obj
  }, {})
}