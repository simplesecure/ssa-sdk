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
