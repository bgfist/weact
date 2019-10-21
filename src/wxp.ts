interface PromisableParam {
  success?: AnyFunction
  fail?: AnyFunction
  complete?: AnyFunction
  [k: string]: any
}

interface SuccessCallBackParamWithData {
  data: any
}

interface SuccessCallBackParamWithRes {
  res: any
}

interface SuccessCallBackParamWithResult {
  result: any
}

type PromiseValue_<C extends PromisableParam> = Parameters<Exclude<C["success"], undefined>>[0]
type PromiseValue<C extends PromisableParam> = PromiseValue_<C> extends SuccessCallBackParamWithData
  ? PromiseValue_<C>["data"]
  : PromiseValue_<C> extends SuccessCallBackParamWithRes
  ? PromiseValue_<C>["res"]
  : PromiseValue_<C> extends SuccessCallBackParamWithResult
  ? PromiseValue_<C>["result"]
  : PromiseValue_<C>
type PromisedApiOptional<C extends PromisableParam | undefined> = (
  options?: Omit<Exclude<C, undefined>, "success" | "fail" | "complete">
) => Promise<PromiseValue<Exclude<C, undefined>>>
type PromisedApiRequired<C extends PromisableParam> = (options: Omit<C, "success" | "fail" | "complete">) => Promise<PromiseValue<C>>
type PromisableFunc<F> = F extends AnyFunction
  ? (Parameters<F>[0] extends PromisableParam | undefined
    ? PromisedApiOptional<Parameters<F>[0]>
    : Parameters<F>[0] extends PromisableParam
    ? PromisedApiRequired<Parameters<F>[0]>
    : never)
  : never

type WxPromisedApi<O> = { [K in keyof O]: PromisableFunc<O[K]> }

/**
* 将wx的回调函数式api转成promise形式
* ```ts
* wxp.request({url: ...}).then(res=> )  // res已经解包(不需要再`res.data`了)，是success回调返回的值的三个字段之一 "data" | "res" | "result"
* ```
*/
// @ts-ignore
const wxp: WxPromisedApi<typeof wx> = {}

for (const $key in wx) {
  const key = $key as keyof typeof wx

  if (wx.hasOwnProperty(key) && typeof wx[key] === "function") {
    // @ts-ignore
    wxp[key] = (options: any) =>
      new Promise((resolve, reject) => {
        options = options || {}
        options.success = (res: any) => resolve(res.data || res.res || res.result || res)
        options.fail = (err: any) => {
          reject(err)
        }
        // @ts-ignore
        wx[key](options)
      })
  }
}

export { wxp }