let $debugIt = false

export const debugIt = () => $debugIt

/**
 * 打开weact的调试日志开关
 * 
 * @param debug 是否打印调试日志
 */
export const debugWeact = (debug = true) => {
  $debugIt = debug
}

export const debug = (type: string, renderName: string, ...args: any[]) => {
  if ($debugIt) {
    console.log(`%cWeact:${type}:%c${renderName}`, "color: blue", "color: green", ...args)
  }
}