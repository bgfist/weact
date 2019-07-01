export let debugIt = false

export const debugWeact = (disable?: boolean) => debugIt = !disable

export const debug = (message: string, ...args: any[]) => {
  if (debugIt) {
    console.log(`%cWeact:${message}`, "color: blue", ...args)
  }
}