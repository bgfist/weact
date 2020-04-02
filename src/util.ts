/// <reference types="miniprogram-api-typings" />

export type ConnectFunc<C = any> = (c: C, isComponent: boolean) => C

export function splitFieldsAndMethods(obj: AnyObject) {
  const fields: AnyObject = {}
  const methods: AnyObject = {}
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

export function transformProperties(properties: AnyObject | undefined) {
  if (!properties) {
    return
  }

  return Object.keys(properties).reduce((obj: AnyObject, key) => {
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

export function deepCopy(obj: any) {
  return JSON.parse(JSON.stringify(obj))
}