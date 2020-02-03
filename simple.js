import { handleData } from './utils/dataProcessing.js';
import { setDebugScope,
         setAllDebugScopes } from './utils/debugScopes.js'
import { createSidSvcs, getSidSvcs } from './utils/sidServices.js'

const log = require('loglevel')

const SIMPLEID_USER_SESSION = 'SimpleID-User-Session';
const ACTIVE_SID_MESSAGE = 'active-sid-message'
const PINGED_SIMPLE_ID = 'pinged-simple-id';
const MESSAGES_SEEN = 'messages-seen'
const SIMPLEID_NOTIFICATION_FETCH = 'sid-notifications'
let notificationCheck = true;
let pingChecked = false
let buttonEl
let messageEl

const SID_APP_ID = "00000000000000000000000000000000"


export default class SimpleID {
  constructor(params) {
    this.config = params;
    this.appId = params.appId;
    this.appOrigin = params.appOrigin;
    this.renderNotifications = params.renderNotifications
    this.activeNotifications = []

    this.ping = params.isHostedApp === true ? null : this.pingSimpleID();

    this.passUserInfoStatus = undefined

    createSidSvcs(this.config)
  }

  async notifications() {
    return await this.checkNotifications()
  }

  async checkNotifications() {
    
    if(notificationCheck) {
      const address = this.getUserData() ? this.getUserData().wallet.ethAddr : "";
      const appId = this.appId
      if(address) {
        const data = {
          address, appId
        }
        notificationCheck = false;
        let notificationsToReturn = []
        const notificationData = await this.processData('notifications', data);
        if(notificationData !== 'Error fetching app data' &&
          notificationData && notificationData.length > 0) {
          log.debug(`notificationData value = ${notificationData}`)
          log.debug(`notificationData type = ${typeof notificationData}`)
          let activeNotifications = notificationData.filter(a => a.active === true)
          //Now we check to see if there are more than one notification:
          if(activeNotifications.length > 1) {
            //Filter out the messages that have been seen
            const messagesSeen = localStorage.getItem(MESSAGES_SEEN) !== "undefined" ?
              JSON.parse(localStorage.getItem(MESSAGES_SEEN)) : undefined
            if(messagesSeen && messagesSeen.length > 0) {
              for (const noti of activeNotifications) {
                const foundMessage = messagesSeen.filter(a => a === noti.id)
                if (!foundMessage || !(foundMessage.length > 0)) {
                  notificationsToReturn.push(noti);
                }
              }
            } else {
              notificationsToReturn = activeNotifications
            }

            if(notificationsToReturn && notificationsToReturn.length > 0) {
              const messageToStore = notificationsToReturn[0]
              localStorage.setItem(ACTIVE_SID_MESSAGE, JSON.stringify(messageToStore))
              if(this.renderNotifications === true) {
                this.loadButton()
              } else {
                if(notificationsToReturn.length > 0) {
                  const updated = this._addPlainText(notificationsToReturn)
                  if(updated.length > 0) {
                    notificationsToReturn = updated
                  }
                }
                
                return notificationsToReturn
              }
            } else {
              return []
            }

          } else if(activeNotifications.length === 1) {

            //Filter out the messages that have been seen
            const messagesSeen = localStorage.getItem(MESSAGES_SEEN) !== "undefined" ?
                JSON.parse(localStorage.getItem(MESSAGES_SEEN)) : undefined
            if(messagesSeen && messagesSeen.length > 0) {
              for (const noti of activeNotifications) {
                const foundMessage = messagesSeen.filter(a => a === noti.id)
                if (foundMessage && foundMessage.length > 0) {
                  //Don't do anything here
                } else {
                  notificationsToReturn.push(noti);
                }
              }
            } else {
              notificationsToReturn = activeNotifications
            }
            //need to check if the developer expects us to handle the widget
            if(this.renderNotifications && notificationsToReturn.length > 0) {
              //Throw up the button for the SID widget
              const notification = notificationsToReturn[0];
              const dataToPass = {
                notification,
                appId: this.appId
              }
              localStorage.setItem(ACTIVE_SID_MESSAGE, JSON.stringify(dataToPass))
              this.loadButton()
            } else {
              if(notificationsToReturn.length > 0) {
                const messageToStore = notificationsToReturn[0]
                localStorage.setItem(ACTIVE_SID_MESSAGE, JSON.stringify(messageToStore))
                const updated = this._addPlainText(notificationsToReturn)
                if(updated.lenght > 0) {
                  notificationsToReturn = updated
                }
              }
              
              localStorage.setItem(SIMPLEID_NOTIFICATION_FETCH, JSON.stringify(notificationsToReturn))
              return notificationsToReturn
            }
          }
        } else {
          if(notificationsToReturn.length > 0) {
            const updated = this._addPlainText(notificationsToReturn)
            if(updated.lenght > 0) {
              notificationsToReturn = updated
            }
          }
          
          return notificationsToReturn
        }
      }
    }
  }

  async _addPlainText(notificationsToReturn) {
    let updatedNotifications = []
    for (const notification of notificationsToReturn) {
      const plainText = notification.content.replace(/(<([^>]+)>)/ig,"");
      notification['plain_text'] = plainText
      updatedNotifications.push(notification)
    }
    return updatedNotifications
  }

  async handleAction(anAction, options={}) {
    log.debug("ACTION: ", anAction);

   if (anAction === 'sign-out') {
      this.completeSignOut();
    } else if(anAction === 'sign-in-no-sid') {
      const { userInfo } = options

      const dataToReturn = await getSidSvcs().persistNonSIDUserInfo(userInfo);
      return dataToReturn
    } else if(anAction === 'process-data') {
      const { payload } = options
      const data = payload

      if (data) {
        const dataToReturn = await handleData(data);
        return dataToReturn
      }
    }
  }

  storeUserData(userData) {
    localStorage.setItem(SIMPLEID_USER_SESSION, userData);
    return true;
  }

  completeSignOut() {
    clearSidKeysFromLocalStore('simple.js')
    window.location.reload();
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
      newUser = await this.handleAction("sign-in-no-sid", { userInfo })
    } catch (error) {
      this.passUserInfoStatus = undefined
      const msg = `${method}: Failed registering user data.\n${error}`
      log.error(msg)
      result = msg
    }

    try {
      if (newUser) {
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
      this.handleNotificationsNonSIDUser()
    }

    return result
  }

  handleNotificationsNonSIDUser() {
    setTimeout(() => {
      this.checkNotifications()
    }, 2000)
  }

  async processData(type, data) {
    const options = {
      payload: {
        type,
        data
      }
    }
    return await this.handleAction('process-data', options)
  }

  async pingSimpleID() {
    if(pingChecked) {
      //No need to always ping
      //This is to prevent endless loops that eventually can bog down memory
      //Now we can check notifications

      //TODO: If we want to handle notifications in the engagement app, this won't fly
      if(notificationCheck) {
        this.config.appId === SID_APP_ID ? null : this.renderNotifications ? this.checkNotifications() : null;
      }
    } else {
      //Check localStorage for a flag that indicates a ping
      const pinged = JSON.parse(localStorage.getItem(PINGED_SIMPLE_ID))
      const thisOrigin = window.location.origin
      pingChecked = true
      if(pinged && pinged.date) {
        if(notificationCheck) {
          this.config.appId === SID_APP_ID ? null : this.renderNotifications ? this.checkNotifications() : null;
        }
      } else {
        //Now we need to fire off a method that will ping SimpleID and let us know the app is connected
        const data = {
          appDetails: this.config,
          date: Date.now(),
          origin: thisOrigin
        }
        //TODO: Uncomment and pick up work after web worker stuff
        try {
          await this.processData('ping', data)
          localStorage.setItem(PINGED_SIMPLE_ID, JSON.stringify(data))
          //Only when the ping is complete should we fetch notifications
          this.config.appId === SID_APP_ID ? null : this.renderNotifications ? this.checkNotifications() : null;
        } catch(e) {
          log.error("Error pinging: ", e)
        }
      }
    }
  }

  loadButton() {
    const params = this.config
    const head = document.head || document.getElementsByTagName('head')[0]
    const linkEl = document.createElement('link');
    linkEl.rel = 'stylesheet';
    linkEl.href = 'https://use.fontawesome.com/releases/v5.0.6/css/all.css';

    const bellIcon = document.createElement('i');
    bellIcon.setAttribute('class', 'far fa-bell');
    bellIcon.style.color = "#fff";
    bellIcon.style.fontSize = "20px";

    buttonEl = document.createElement('button');
    buttonEl.setAttribute('id', 'notification-button')
    buttonEl.appendChild(bellIcon);
    buttonEl.style.width = "60px";
    buttonEl.style.height = "60px";
    buttonEl.style.background = "#2568EF";
    buttonEl.style.border = "none";
    buttonEl.style.borderRadius = "50%";
    buttonEl.style.cursor = "pointer";
    buttonEl.style.boxShadow = "0 3px 7px rgba(0,0,0,0.12)"
    buttonEl.style.position = "fixed";
    buttonEl.style.zIndex = "1024";
    buttonEl.style.bottom = "15px";
    buttonEl.style.right = "15px";
    buttonEl.setAttribute('id', 'appMessageButton');
    buttonEl.onclick = () => {
      this.loadMessages()
    }

    const alertDiv = document.createElement('div');
    alertDiv.style.background = "red";
    alertDiv.style.width = "8px";
    alertDiv.style.height = "8px";
    alertDiv.style.borderRadius = "50%";
    alertDiv.style.position = "absolute";
    alertDiv.style.bottom = "32px";
    alertDiv.style.right = "22px";

    buttonEl.appendChild(alertDiv);

    messageEl = document.createElement('div');
    messageEl.setAttribute('id', 'message-element')
    messageEl.style.width = "300px";
    messageEl.style.height = "85vh";
    messageEl.style.position = "fixed";
    messageEl.style.zIndex = "1024";
    messageEl.style.right = "15px";
    messageEl.style.bottom = "15px";
    messageEl.style.background = "#fff";
    messageEl.style.borderRadius = "5px";
    messageEl.style.boxShadow = "0 3px 7px rgba(0,0,0,0.12)"
    messageEl.style.paddingTop = "15px";

    const closeButton = document.createElement('button');
    closeButton.setAttribute('id', 'messagesClose');
    closeButton.style.border = "none";
    closeButton.style.position = "absolute";
    closeButton.style.right = "10px";
    closeButton.style.top = "10px";
    closeButton.style.background = "#fff";
    closeButton.style.cursor = "pointer";

    closeButton.innerText = "Dismiss";
    closeButton.onclick = () => {
      this.dismissMessages();
    }

    messageEl.appendChild(closeButton);

    head.appendChild(linkEl);
    document.body.appendChild(buttonEl);
  }

  loadMessages() {
    const messageData = JSON.parse(localStorage.getItem(ACTIVE_SID_MESSAGE))
    buttonEl.style.display = "none";

    let mainDiv = document.createElement('div');
    mainDiv.style.width = '100%';
    mainDiv.style.height = '100%';
    mainDiv.style.zIndex = '1024';
    mainDiv.style.border = "none";

    let secondDiv = document.createElement('div')
    mainDiv.appendChild(secondDiv)
    secondDiv.setAttribute('class', 'message-body')
    let thirdDiv = document.createElement('div');
    thirdDiv.innerHTML = messageData.notification ? messageData.notification.content : messageData.content //TODO: this is a terrible hack
    secondDiv.appendChild(thirdDiv)

    mainDiv.style.width ="100%"
    secondDiv.style.padding = "15px"

    thirdDiv.style.fontSize = "16px"
    thirdDiv.style.marginBottom = "10px"


    messageEl.appendChild(mainDiv);
    document.body.appendChild(messageEl);
  }

  async dismissMessages() {
    
    //First we get the notification id
    const messageData = JSON.parse(localStorage.getItem(ACTIVE_SID_MESSAGE))
    
    const messageID = messageData.notification ? messageData.notification.id : messageData.id //TODO: another terrible hack
    let messagesSeen = JSON.parse(localStorage.getItem(MESSAGES_SEEN))
    if(messagesSeen && messagesSeen.length > 0) {
      messagesSeen.push(messageID)
    } else {
      messagesSeen = []
      messagesSeen.push(messageID)
    }
    localStorage.setItem(MESSAGES_SEEN, JSON.stringify(messagesSeen))
    if(messageEl) {
      messageEl.style.display = "none";
    }
    //Need to hide the message but we also need to send data to the orgData table
    //Specifically need to show that this user has seen the message
    const data = {
      appData: this.config,
      address: this.getUserData().wallet.ethAddr,
      dateSeen: Date.now(),
      messageID
    }
    await this.processData('notification-seen', data);
    localStorage.removeItem(ACTIVE_SID_MESSAGE);
    notificationCheck = true
    this.checkNotifications()
  }

  //This returns the wallet info for the SimpleID user
  getUserData() {
    return JSON.parse(localStorage.getItem(SIMPLEID_USER_SESSION));
  }

  signOut() {
    this.handleAction('sign-out')
  }
}


/**
 *  clearSidKeysFromLocalStore:
 *
 *    Clears some keys from local store (but not debug or ping)
 *
 */
export function clearSidKeysFromLocalStore(context='') {
  const keysToClear = [SIMPLEID_USER_SESSION]
  for (const key of keysToClear) {
    try {
      localStorage.removeItem(key)
    } catch (suppressedError) {}
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
