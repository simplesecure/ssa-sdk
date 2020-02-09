/*****************************************************************************
 *
 * Private Methods (Web API refactor of SDK)
 *
 * TODO:
 *      - look into using closure to block access as needed from this class.
 *      - clean up with JH
 *
 *
 ****************************************************************************/

// Refactor TODO:
//
//  - Anything using dynamo dynamoConveniences needs to be refactored into
//    serverUtils
//
import { walletAnalyticsDataTableGet,
        organizationDataTableGet,
        walletAnalyticsDataTablePut,
        organizationDataTablePut } from './../serverUtils/dynamoConveniences.js'



import { getLog } from './sdkUtils/debugScopes.js'
const log = getLog('helpers')

export const SIMPLEID_USER_SESSION = 'SimpleID-User-Session';

const ACTIVE_SID_MESSAGE = 'active-sid-message'
const PINGED_SIMPLE_ID = 'pinged-simple-id'
const MESSAGES_SEEN = 'messages-seen'
const SIMPLEID_NOTIFICATION_FETCH = 'sid-notifications'

const SID_APP_ID = "00000000000000000000000000000000"

// TODO: migrate to non-global soln
let notificationCheck = true
let pingChecked = false
let buttonEl = undefined
let messageEl = undefined


/**
 *  __issueWebApiCmd:
 *
 *  cmdObj format is:
 *  {
 *    command: <string>,
 *    data: { <arguments for command as properties> }
 *  }
 *
 *  @returns:  a result object containing an error property that is undefined if
 *             successful with any processed data in a data property. On failure
 *             a message is returned in the error property and data remains
 *             undefined.
 */
export async function __issueWebApiCmd(cmdObj) {
  const result = {
    error: undefined,
    data: undefined
  }

  try {

  } catch (error) {
  }

  return results
}

// TODO:
//       - I think there's an infinite loop implied here:
//          __loadButton --> __dismissMessages --> __fetchNotifications --> __loadButton
//          (I believe the global notificationCheck var is trying to mitigate that)
//
// TODO: Justin, AC:
//       - remove notificationCheck altogether (it's in there to prevent an infintie loop)
export async __fetchNotifications(appId, renderNotifications, config) {
  if(notificationCheck) {
    const ud = __getUserData()
    const address = ud ? ud.wallet.ethAddr : "";
    const appId = appId
    if(address) {
      const data = {
        address, appId
      }
      notificationCheck = false;
      let notificationsToReturn = []
      //const notificationData = await __handleNotificationData(data)
      const cmdObj = {
        command: 'handleNotificationData',
        data
      }
      const result = await __issueWebApiCmd(cmdObj)
      if (result.error) {
        throw new Error(result.error)
      }
      notificationData = (result && result.data) ? result.data : undefined

      if (notificationData &&
          notificationData !== 'Error fetching app data' &&
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
            if (renderNotifications === true) {
              __loadButton(appId, renderNotifications, config)
            } else {
              if(notificationsToReturn.length > 0) {
                const updated = __addPlainText(notificationsToReturn)
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
          if(renderNotifications && notificationsToReturn.length > 0) {
            //Throw up the button for the SID widget
            const notification = notificationsToReturn[0];
            const dataToPass = {
              notification,
              appId: appId
            }
            localStorage.setItem(ACTIVE_SID_MESSAGE, JSON.stringify(dataToPass))
            __loadButton(appId, renderNotifications, config)
          } else {
            if(notificationsToReturn.length > 0) {
              const messageToStore = notificationsToReturn[0]
              localStorage.setItem(ACTIVE_SID_MESSAGE, JSON.stringify(messageToStore))
              const updated = __addPlainText(notificationsToReturn)
              if(updated.length > 0) {
                notificationsToReturn = updated
              }
            }
            localStorage.setItem(SIMPLEID_NOTIFICATION_FETCH, JSON.stringify(notificationsToReturn))
            return notificationsToReturn
          }
        }
      } else {
        if(notificationsToReturn.length > 0) {
          const updated = __addPlainText(notificationsToReturn)
          if(updated.length > 0) {
            notificationsToReturn = updated
          }
        }
        return notificationsToReturn
      }
    }
  }
}


// This returns the wallet info for the SimpleID user
function __getUserData() {
  try {
  return JSON.parse(localStorage.getItem(SIMPLEID_USER_SESSION));
  } catch (suppressedError) {}

  return undefined
}

function __loadButton(appId, renderNotifications, config) {
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
    __loadMessages()
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
    __dismissMessages(appId, renderNotifications, config)
  }

  messageEl.appendChild(closeButton);

  head.appendChild(linkEl);
  document.body.appendChild(buttonEl);
}

function __loadMessages() {
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

async function __dismissMessages(appId, renderNotifications, config) {
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

  if (messageEl) {
    messageEl.style.display = "none";
  }

  //Need to hide the message but we also need to send data to the orgData table
  //Specifically need to show that this user has seen the message
  const data = {
    appData: config,
    address: __getUserData().wallet.ethAddr,
    dateSeen: Date.now(),
    messageID
  }

  try {
    // await __handleNotificationSeen(data)
    const cmdObj = {
      command: 'handleNotificationSeen',
      data
    }
    const result = await __issueWebApiCmd(cmdObj)
    if (result.error) {
      throw new Error(result.error)
    }
  } catch (suppressedError) {
    log.error(`Failed marking notifications as seen while dismissing messages.\n${suppressedError}`)
    // TODO: Justin what abt. localStorage below etc.?
  }

  localStorage.removeItem(ACTIVE_SID_MESSAGE);

  notificationCheck = true
  __fetchNotifications(appId, renderNotifications, config)
}

function __addPlainText(notificationsToReturn) {
  let updatedNotifications = []
  for (const notification of notificationsToReturn) {
    const plainText = notification.content.replace(/(<([^>]+)>)/ig,"");
    notification['plain_text'] = plainText
    updatedNotifications.push(notification)
  }
  return updatedNotifications
}

export async function __pingSimpleID(appId, renderNotifications, config) {
  if (pingChecked) {
    //No need to always ping
    //This is to prevent endless loops that eventually can bog down memory
    //Now we can check notifications

    //TODO: If we want to handle notifications in the engagement app, this won't fly
    if (notificationCheck && (appId !== SID_APP_ID) && renderNotifications) {
        __fetchNotifications(appId, renderNotifications, config)
    }
  } else {
    //Check localStorage for a flag that indicates a ping
    const pinged = JSON.parse(localStorage.getItem(PINGED_SIMPLE_ID))
    const thisOrigin = window.location.origin
    pingChecked = true
    if (pinged && pinged.date) {
      if (notificationCheck && (appId !== SID_APP_ID) && renderNotifications) {
        __fetchNotifications(appId, renderNotifications, config)
      }
    } else {
      //Now we need to fire off a method that will ping SimpleID and let us know the app is connected
      const data = {
        appDetails: config,
        date: Date.now(),
        origin: thisOrigin
      }
      //TODO: Uncomment and pick up work after web worker stuff
      try {
        // await __handlePing(data)
        const cmdObj = {
          command: 'handlePing',
          data
        }
        const result = await __issueWebApiCmd(cmdObj)
        if (result.error) {
          throw new Error(result.error)
        }

        localStorage.setItem(PINGED_SIMPLE_ID, JSON.stringify(data))
        //Only when the ping is complete should we fetch notifications
        if ((appId !== SID_APP_ID) && renderNotifications) {
          __fetchNotifications(appId, renderNotifications, config)
        }
      } catch(e) {
        log.error("Error pinging: ", e)
      }
    }
  }
}
