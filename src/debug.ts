let $debugIt = false

export const debugIt = () => $debugIt

export const debugWeact = (disable?: boolean) => {
  $debugIt = !disable
}

export const debug = (type: string, renderName: string, ...args: any[]) => {
  if ($debugIt) {
    console.log(`%cWeact:${type}:%c${renderName}`, "color: blue", "color: green", ...args)
  }
}