const equalSymbol = Symbol("equal")
const replaceSymbol = Symbol("replace")

function deepDiff(newData: any, oldData: any): any {
  if (newData === oldData) {
    return equalSymbol
  }

  if (newData === null || oldData === null || typeof newData !== 'object' || typeof oldData !== 'object') {
    if (typeof newData === 'object' && newData) {
      newData[replaceSymbol] = true
    }
    return newData
  }

  const diff: any = {}

  Object.keys(newData).forEach(keyA => {
    const _diff = deepDiff(newData[keyA], oldData[keyA])
    if (_diff !== equalSymbol) {
      diff[keyA] = _diff
    }
  })

  Object.keys(oldData).forEach(keyB => {
    if (!(keyB in newData)) {
      diff[keyB] = undefined
    }
  })

  return diff
}

function genUpdatedPathAndValue(out: any, diff: any, parentPath: string) {
  if (diff === null || typeof diff !== 'object' || diff[replaceSymbol]) {
    out[parentPath] = diff
    return
  }

  Object.keys(diff).forEach(key => {
    const path = parentPath ? parentPath + '.' + key : key
    genUpdatedPathAndValue(out, diff[key], path)
  })
}

export function genDiff(newData: any, oldData: any): any {
  const ret = {}
  const diff = deepDiff(newData, oldData)

  if (diff === equalSymbol) {
    return ret
  }

  genUpdatedPathAndValue(ret, diff, '')

  return ret
}
