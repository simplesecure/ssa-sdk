// See this site for usage and logger configuration:
//   - https://github.com/pimterry/loglevel
//
const log = require('loglevel')
// The prefix library calls setLevel with no option regarding persistence to
// local storage.
const prefix = require('loglevel-plugin-prefix');

const ROOT_KEY = 'loglevel'
const ALLOWED_SCOPES = [ ROOT_KEY,
                        `${ROOT_KEY}:helpers` ]
const ALLOWED_LEVELS = [ 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR' ]
// const DEFAULT_LOG_LEVEL="INFO"
const DEFAULT_LOG_LEVEL="DEBUG"


function configureLogPrefix(aLog) {
  prefix.apply(aLog, {
    format(level, name, timestamp) {
      const moduleName = (name !== 'root') ?
        ` (${name})` : ''
      return `${level} SID-SDK${moduleName}:`;
    },
  })
}

prefix.reg(log)
configureLogPrefix(log)

/**
 *  getLog:
 *
 *    Returns a logger configured with our prefixes etc.
 *
 *  TODO:
 *    - Do we need to track calls to this to prevent duplicate reg/apply calls?
 *
 */
export function getLog(logName=undefined) {
   let theLog = log
   if (logName) {
     theLog = log.getLogger(logName)
     configureLogPrefix(theLog)
   }

   return theLog
 }

/**
 *  configureDebugScopes:
 *
 *  Sets the debug log levels on all modules to the default values or any
 *  confirming override values specified in the parent component using the
 *  SimpleID SDK.
 *
 * TODO:
 *      - refactor to it's own file and the consts too
 */
export function configureDebugScopes(debugScopes={}) {
  for (const scopeKey of ALLOWED_SCOPES) {
    // Get the module name from the scopeKey:
    const moduleName = scopeKey.replace(`${ROOT_KEY}:`, '')

    let scopeValue = DEFAULT_LOG_LEVEL
    try {
      const overriddenScopeValue = debugScopes[scopeKey]
      if (ALLOWED_LEVELS.includes(overriddenScopeValue)) {
        scopeValue = overriddenScopeValue
      }
    } catch (suppressedError) {
      log.debug(`Suppressed error getting override iFrame log level for ${moduleName}.\n${suppressedError}`)
    }

    try {
      if (moduleName === ROOT_KEY) {
        log.setLevel(scopeValue)
      } else {
        log.getLogger(moduleName).setLevel(scopeValue)
      }
    } catch (suppressedError) {
      log.debug(`Suppressed error setting the iframe log level for ${moduleName} to ${scopeValue}.\n${suppressedError}`)
    }
  }
}

/**
 *  getDebugScopes:
 *
 *  Fetches known debug scopes from local storage to forward to the widget
 *  iFrame for dynamic debug capability from an App Console.
 *
 *  @returns a map of the scope keys to their string values.
 */
export function getDebugScopes() {
  const debugScopes = {}
  for (const key of ALLOWED_SCOPES) {
    debugScopes[key] = DEFAULT_LOG_LEVEL
  }

  for (const scopeKey in debugScopes) {
    try {
      const scope = localStorage.getItem(scopeKey)
      if (ALLOWED_LEVELS.includes(scope)) {
        debugScopes[scopeKey] = scope
      }
    } catch (suppressedError) {
      log.debug(`Suppressed error fetching ${scopeKey} from local storage. Setting ${scopeKey} to default value, ${DEFAULT_LOG_LEVEL}.\n${suppressedError}`)
    }
  }

  return debugScopes
}

export function setDebugScope(scopeKey, scopeLevel) {
  if (scopeKey && !scopeKey.startsWith(ROOT_KEY)) {
    scopeKey = `${ROOT_KEY}:${scopeKey}`
  }

  if (!scopeLevel) {
    scopeLevel = 'DEBUG'
  }

  if (ALLOWED_SCOPES.includes(scopeKey) && ALLOWED_LEVELS.includes(scopeLevel)) {
    localStorage.setItem(scopeKey, scopeLevel)
  }
}

export function setAllDebugScopes(scopeLevel='DEBUG') {
  if (!ALLOWED_LEVELS.includes(scopeLevel)) {
    console.log(`Scope level ${scopeLevel} is not supported.  Supported levels are ${JSON.stringify(ALLOWED_LEVELS, 0, 2)}.`)
    return
  }

  const debugScopes = getDebugScopes()
  for (const scopeKey in debugScopes) {
    localStorage.setItem(scopeKey, scopeLevel)
  }

  return
}
