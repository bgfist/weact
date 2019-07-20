let $debugIt = false

export const debugIt = () => $debugIt

/**
 * 打开weact的调试日志开关
 * 
 * @param disable 禁用调试日志
 */
export const debugWeact = (disable?: boolean) => {
  $debugIt = !disable
}

export const debug = (type: string, renderName: string, ...args: any[]) => {
  if ($debugIt) {
    console.log(`%cWeact:${type}:%c${renderName}`, "color: blue", "color: green", ...args)
  }
}