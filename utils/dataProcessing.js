import { walletAnalyticsDataTableGet,
         organizationDataTableGet,
         walletAnalyticsDataTablePut,
         organizationDataTablePut } from './dynamoConveniences.js';
import { getLog } from './debugScopes.js'

const rp = require('request-promise');
const CONFIG = require('../config.json')

const log = getLog('dataProcessing')



export async function handleData(dataToProcess) {
  log.debug("DATA IN HANDLE DATA FUNCTION: ", dataToProcess)
  const { data, type } = dataToProcess;

  if (type === 'ping') {
    const appId = data && data.appDetails && data.appDetails.appId ? data.appDetails.appId : undefined
    //First we fetch the data from the org
    try {
      const appData = await walletAnalyticsDataTableGet(appId)
      //Now we can post the ping data back
      const dataToModify = appData.Item
      dataToModify['verified'] = {
        success: true,
        date: data.date,
        origin: data.origin
      }
      await walletAnalyticsDataTablePut(dataToModify)
      return true
    } catch(e) {
      log.error(e)
    }
  } else if(type === 'notifications') {
    const { appId, address } = data
    let results = undefined
    log.debug(data)
    //First we need to fetch the org_id because the app doesn't have it
    //TODO: should we give the app the org id? Are there any security concerns in doing so?
    const appData = await walletAnalyticsDataTableGet(appId);
    if(appData.Item) {
      const org_id = appData.Item.org_id
      //Now with the org_id, we can fetch the notification info from the org_table
      const orgData = await organizationDataTableGet(org_id);
      log.debug(orgData)
      if(orgData.Item) {
        const thisApp = orgData.Item.apps[appId]
        log.debug("DATA: ", orgData)
        if(thisApp) {
          const { currentSegments, notifications } = thisApp;
          let notificationsToReturn = []
          //Check to see if there are any notifications for this app
          if(notifications && notifications.length > 0) {
            for(const notification of notifications) {
              //Check the segment for the logged in user
              const thisSegment = currentSegments.filter(a => a.id === notification.segmentId)[0]
              const users = thisSegment.users;
              const thisUser = users.filter(u => u.toLowerCase() === address.toLowerCase())[0];
              if(thisUser) {
                log.debug("THIS USER FOUND", thisUser);
                notification['org_id'] = org_id
                notificationsToReturn.push(notification);
              }
            }
            results = notificationsToReturn;
          } else {
            results = []
          }
        } else {
          //TODO: The engagement app doesn't have any apps nested under it. We need to fix this
          //I think it's tied to the app ID we're using
        }
      } else {
        return "Error fetching org data"
      }
    } else {
      results = "Error fetching app data"
    }
    return results;
  } else if(type === 'notification-seen') {
    log.debug("Notification has been seen!")
    log.debug(data)
    //This is where we can count number of seen messages
    // const appData = await walletAnalyticsDataTableGet(data.appData.appId);
    // if(appData.Item) {
    //   const org_id = appData.Item.org_id
    //   //Now with the org_id, we can fetch the notification info from the org_table
    //   const orgData = await organizationDataTableGet(org_id);
    //   try {
    //     const anObject = orgData.Item
    //     let apps = anObject.apps
    //     let thisApp = apps[data.appData.appId]
    //     let notifications = thisApp.notifications
    //     let thisNotification = notifications[data.messageID]
    //     if(thisNotification.seenCount) {
    //       thisNotification.seenCount = thisNotification.seenCount++
    //     } else {
    //       thisNotification['seenCount'] = 1
    //     }
    //     anObject.apps = apps;

    //     anObject[CONFIG.OD_TABLE_PK] = org_id

    //     await organizationDataTablePut(anObject)

    //   } catch (suppressedError) {
    //     log.error(`ERROR: problem writing to DB.\n${suppressedError}`)
    //   }
    // }
  }
}
