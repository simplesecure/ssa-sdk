/**
 * jsonParseToBuffer:
 *
 * Notes:
 *    Adapted from: https://stackoverflow.com/questions/34557889/how-to-deserialize-a-nested-buffer-using-json-parse
 *
 * TODO:
 *        1. Refactor to common area.
 *
 */
export function jsonParseToBuffer(aStringifiedObj) {
  return JSON.parse(
    aStringifiedObj,
    (k, v) => {
      if ( v != null               &&
           typeof v === 'object'   &&
           'type' in v             &&
           v.type === 'Buffer'     &&
           'data' in v             &&
           Array.isArray(v.data) ) {
        return Buffer.from(v.data)
      }
      return v
    }
  )
}

function _intToHex(aNumber) {
  return aNumber.toString(16).padStart(2, '0');
}

export function getRandomString(numBytes) {
  const randomValues = new Uint8Array(numBytes)

  if (!window) {
    throw Error(`ERROR: SID Services is unable to access window.`)
  }
  window.crypto.getRandomValues(randomValues)
  return Array.from(randomValues).map(_intToHex).join('');
}
