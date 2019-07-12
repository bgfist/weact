const equalSymbol = Symbol("equal")
const replaceSymbol = Symbol("replace")

type AnyData = (AnyObject & { [replaceSymbol]?: boolean }) | undefined

type EqualData = typeof equalSymbol
type ReplaceValueData = number | null | string | undefined | Function | boolean
type ReplacedObjectData = AnyObject & { [replaceSymbol]: true }
type DiffObjectData = AnyObject & { [replaceSymbol]?: false }
type DiffData = EqualData | ReplaceValueData | ReplacedObjectData | DiffObjectData

function deepDiff(newData: AnyData, oldData: AnyData): DiffData {
  if (newData === oldData) {
    return equalSymbol
  }

  if (newData === null || oldData === null || typeof newData !== 'object' || typeof oldData !== 'object') {
    if (typeof newData === 'object' && newData) {
      newData[replaceSymbol] = true
    }
    return newData
  }

  // 如果删除了字段，直接传全部
  let keyDeleted = false
  const oldKeys = Object.keys(oldData)
  for (let i = 0; i < oldKeys.length; i++) {
    if (!(oldKeys[i] in newData)) {
      keyDeleted = true
      break
    }
  }
  if (keyDeleted) {
    newData[replaceSymbol] = true
    return newData
  }

  const newDataIsArray = Array.isArray(newData)
  const oldDataIsArray = Array.isArray(oldData)

  if ((newDataIsArray && !oldDataIsArray) || (!newDataIsArray && oldDataIsArray)) {
    newData[replaceSymbol] = true
    return newData
  }

  const diff: DiffObjectData = newDataIsArray ? [] : {}

  Object.keys(newData).forEach(keyA => {
    const _diff = deepDiff(newData[keyA], oldData[keyA])
    if (_diff !== equalSymbol) {
      diff[keyA] = _diff
    }
  })

  return diff
}

function genUpdatedPathAndValue(out: AnyObject, diff: DiffData, parentPath: string) {
  if (diff === null || typeof diff !== 'object') {
    out[parentPath] = diff
    return
  }

  if (diff[replaceSymbol]) {
    delete diff[replaceSymbol]
    out[parentPath] = diff
    return
  }

  const diffIsArray = Array.isArray(diff)

  Object.keys(diff).forEach(key => {
    const path = !parentPath ? key : (diffIsArray ? `${parentPath}[${key}]` : `${parentPath}.${key}`)
    genUpdatedPathAndValue(out, diff[key], path)
  })
}

export function genDiff(newData: AnyData, oldData: AnyData): AnyObject {
  const ret: AnyObject = {}
  const diff = deepDiff(newData, oldData)

  if (diff === equalSymbol || diff === null || typeof diff !== 'object') {
    return ret
  }

  if (diff[replaceSymbol]) {
    delete diff[replaceSymbol]
    return diff
  }

  genUpdatedPathAndValue(ret, diff, '')

  return ret
}
