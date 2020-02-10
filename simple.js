import { SIMPLEID_USER_SESSION,
         __pingSimpleID,
         __fetchNotifications,
         __issueWebApiCmd,
         __getUserData } from './utils/helpers.js'

import { getLog,
         setDebugScope,
         setAllDebugScopes } from './utils/debugScopes.js'
const log = getLog()



export default class SimpleID {
  /*****************************************************************************
   *
   * Public Methods
   *
   ****************************************************************************/

  constructor(params) {
    this.config = params;
    this.appId = params.appId;
    this.appOrigin = params.appOrigin;
    this.renderNotifications = params.renderNotifications
    this.activeNotifications = []

    // TODO: Change this.
    //       Intention is to communicate to customer in SAAS product that
    //       installation is complete. Shouldn't run for every user (i.e. check
    //       DB).
    //       Notification checking should just start.
    //       Shouldn't check for notifications if someone is not signed in.
    __pingSimpleID(this.appId, this.renderNotifications, this.config)


    this.passUserInfoStatus = undefined
  }

  /**
   *  passUserInfo:
   *
   *    Apps call this *** ONCE *** to register a user's information with
   *    simple ID.  They pass in a userInfo object which is:
   *
   *      userInfo = {
   *        email:   <an email address - optional>,
   *        address: <a wallet address - required>
   *      };
   *
   *    Calling this more than once in a session results in warnings being
   *    presented in the console unless the first call resulted in an error,
   *    in which case subsequent calls can be made until success.
   *
   *    @returns A string 'success' or an error string.
   */
  async passUserInfo(userInfo) {
    const method = 'SimpleID::passUserInfo'

    // Inexpensive test to see if this has been called already:
    //
    if (this.passUserInfoStatus) {
      const msg = `${method}: This method is only intended to be called once per session. Ignoring this call. This warning occurs when this method is called in the wrong place (i.e. the render method).`
      log.warn(msg)
      return msg
    }

    // More expensive test to see if this has been called already:
    // (sign out will clear session data, we'll need to tell devs to tie
    //  their sign out process to ours to clear this key from local storage TODO)
    let sessiondata = undefined
    try {
      sessiondata = localStorage.getItem(SIMPLEID_USER_SESSION)
      log.debug('Checking session data:')
      log.debug(sessiondata)
      if (sessiondata) {
        const msg = `${method}: This method is only intended to be called once per session. Ignoring this call. This warning occurs when this method is called in the wrong place (i.e. the render method).`
        log.warn(msg)
        return msg
      }
    } catch (suppressedError) {}

    // Check to make sure that at least the wallet address has been specified
    //
    if (!userInfo.address) {
      const msg = `${method}: This method requires a valid address property passed in through userInfo.  userInfo.address=${userInfo.address}`
      log.error(msg)
      return msg
    }

    this.passUserInfoStatus = 'processing'

    let result = undefined
    let newUser = undefined
    try {
      // newUser = await registerUser(this.appId, userInfo.email, userInfo.address)
      const cmdObj = {
        command: 'registerUser',
        data: {
          appId: this.appId,
          email: userInfo.email,
          address: userInfo.address
        }
      }
      const webApiResult = await __issueWebApiCmd(cmdObj)
      if (webApiResult.error) {
        throw new Error(webApiResult.error)
      }
      newUser = webApiResult.data
    } catch (error) {
      this.passUserInfoStatus = undefined
      const msg = `${method}: Failed registering user data.\n${error}`
      log.error(msg)
      result = msg
    }

    try {
      if (newUser) {
        log.debug(`Writing local storage:\nkey:${SIMPLEID_USER_SESSION}\nvalue:${JSON.stringify(newUser)}\n`)
        localStorage.setItem(SIMPLEID_USER_SESSION, JSON.stringify(newUser))
        this.passUserInfoStatus = 'complete'
        result = 'success'
        log.info(`${method}: Succeeded.`)
      }
    } catch (error) {
      this.passUserInfoStatus = undefined
      const msg = `${method}: Failed writing session to local storage.\n${error}`
      log.error(msg)
      result = msg
    }

    if (result === 'success') {
      //TODO: need to make this happen without a refresh
      const delayMs = 2000
      setTimeout( () => {
                    __fetchNotifications(
                      this.appId, this.renderNotifications, this.config)
                  },
                  delayMs)
    }

    return result
  }

  async notifications() {
    return await __fetchNotifications(
      this.appId, this.renderNotifications, this.config)
  }

  signOut() {
    try {
      localStorage.removeItem(SIMPLEID_USER_SESSION)
    } catch (suppressedError) {}
    window.location.reload();
  }

  // TODO: talk w/ Justin about whether not including this in the public api is
  //       an oversight.
  getUserData() {
    return __getUserData()
  }
}




// Workaround for queck and easy debug from browser console
//
// TODO:
//       - Analyze as exposure of security problem.
//
if (window) {
  window.sid = {
    debugScope: function(aScope, aLevel=undefined) {
      setDebugScope(aScope, aLevel)
    },
    debugAll: function() {
      "use strict";
      setAllDebugScopes();
    },
    debugOff: function() {
      "use strict";
      setAllDebugScopes('INFO');
    }
  }
}
