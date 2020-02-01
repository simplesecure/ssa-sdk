import { getGlobal } from 'reactn';
import { closeWidget } from './postMessage';
import { walletAnalyticsDataTableGet, organizationDataTableGet, walletAnalyticsDataTablePut, organizationDataTablePut } from '../utils/dynamoConveniences';
import { getSidSvcs } from '../index';

import { getLog } from './../utils/debugScopes'
const log = getLog('dataProcessing')

const rp = require('request-promise');
const ethers = require('ethers');


const ALETHIO_KEY = process.env.REACT_APP_ALETHIO_KEY;
const rootUrl = `https://api.aleth.io/v1`;
const ROOT_EMAIL_SERVICE_URL = 'https://cnv69peos0.execute-api.us-west-2.amazonaws.com/e1' //!process.env.NODE_ENV === 'production' ? 'https://cnv69peos0.execute-api.us-west-2.amazonaws.com/e1/v1/email' : 'http://localhost:3000' //This should be an env variable
const headers = { Authorization: `Bearer ${ALETHIO_KEY}`, 'Content-Type': 'application/json' }
let addresses = []
export async function handleData(dataToProcess) {
  log.debug("DATA IN HANDLE DATA FUNCTION: ", dataToProcess)
  const { data, type } = dataToProcess;
  if(type === 'update-segments') {
    //Take the whole org data payload and execute on it
    log.debug("ORG DATA PAYLOAD")
    log.debug(data);
    const thisApp = data.appData && data.appData.Item ? data.appData.Item.apps[data.app_id] : undefined
    log.debug("This APP : ", thisApp)
    const currentSegments = thisApp.currentSegments;
    const updatedSegments = []
    let saveToDb = false
    for(const seg of currentSegments) {
      const dataForProcessing = {
        type: 'segment',
        data: seg
      }
      const results = await handleData(dataForProcessing)
      log.debug("RESULTS: ", results)
      if(results.length > seg.userCount) {
        seg.users = results;
        seg.userCount = results.length
        saveToDb = true
        updatedSegments.push(seg)
      } else {
        updatedSegments.push(seg)
      }
    }

    log.debug("UPDATED SEGMENTS: ", updatedSegments)

    if(saveToDb === true) {
      const orgData = data.appData
      try {
        const anObject = orgData.Item
        let apps = anObject.apps
        let thisApp = apps[data.app_id]
        let segments = updatedSegments
        thisApp.currentSegments = segments
        apps[data.app_id] = thisApp

        anObject.apps = apps;

        anObject[process.env.REACT_APP_OD_TABLE_PK] = data.org_id

        await organizationDataTablePut(anObject)
        return updatedSegments
      } catch (suppressedError) {
        log.error(`ERROR: problem writing to DB.\n${suppressedError}`)
        return undefined
      }
    } else {
      return updatedSegments
    }
  } else if(type === 'segment') {
    let results;
    //Need to fetch user list that matches segment criteria
    //TODO: AC return the entire user list here so we can use it to plug into analytics service and filter
    try {
      log.debug(data.appId);
      const appData = await walletAnalyticsDataTableGet(data.appId);
      const users = Object.keys(appData.Item.analytics);
      log.debug(appData);
      switch(data.filter.filter) {
        case "Smart Contract Transactions":
          results = await filterByContract(users, data.contractAddress);
          break;
        case "All Users":
          //placeholder for all users
          results = users;
          break;
        case "Last Seen":
          //placeholder for Last Seen
          results = await filterByLastSeen(appData.Item.analytics, data);
          break;
        case "Wallet Balance":
          //placeholder for Wallet Balance
          results = await filterByWalletBalance(users, data.numberRange)
          break;
        case "Total Transactions":
          //placeholder for Total Transactions
          results = await fetchTotalTransactions(users);
          break;
        default:
          break;
      }
      return results;
    } catch(e) {
      log.error("Error: ", e)
      return e
    }
  } else if(type === 'email messaging') {
    //Here we will do something similar to segment data except we will send the appropriate message
    //Data should include the following:
    //const { addresses, app_id, template, subject } = data;
    //Commented out because we don't need each individual item separately
    log.info(`handleData ${type} ...`)
    const { template, subject, from } = data
    if (!template || !subject || !from) {
      throw new Error('Email messaging expects the template, subject, and from address to be defined.')
    }

    let uuidList = undefined
    try {
      uuidList = await getSidSvcs().getUuidsForWalletAddresses(data)
    } catch(e) {
      log.error("Error fetching list of uuids for wallet addresses: ", e)
    }

    //Now we need to take this list and fetch the emails for the users
    const dataForEmailService = {
      uuidList,
      template,
      subject,
      from
    }

    //Once we have the emails, send them to the email service lambda with the template
    const sendEmails = await handleEmails(dataForEmailService, ROOT_EMAIL_SERVICE_URL)

    //When we finally finish this function, we'll need to return a success indicator rather than a list of anything
    //   TODO: check for status code not a string.
    return sendEmails
  } else if(type === 'ping') {
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
    const appData = await walletAnalyticsDataTableGet(data.appData.appId);
    if(appData.Item) {
      const org_id = appData.Item.org_id
      //Now with the org_id, we can fetch the notification info from the org_table
      const orgData = await organizationDataTableGet(org_id);
      try {
        const anObject = orgData.Item
        let apps = anObject.apps
        let thisApp = apps[data.appData.appId]
        let notifications = thisApp.notifications
        let thisNotification = notifications[data.messageID]
        if(thisNotification.seenCount) {
          thisNotification.seenCount = thisNotification.seenCount++
        } else {
          thisNotification['seenCount'] = 1
        }
        anObject.apps = apps;

        anObject[process.env.REACT_APP_OD_TABLE_PK] = org_id

        await organizationDataTablePut(anObject)

      } catch (suppressedError) {
        log.error(`ERROR: problem writing to DB.\n${suppressedError}`)
      }
    }
  } else if(type === 'create-project') {
    const { appObject, orgId } = data;
    const createProject = await getSidSvcs().createAppId(orgId, appObject)
    log.debug(createProject)
    return createProject
  } else if (type === 'AC Terrible Test') {
    log.debug('AC\'s Terrible Test:')
    log.debug('  getting uuids')
    const uuids = await getSidSvcs().getUuidsForWalletAddresses(data)
    log.debug('  uuids:')
    log.debug(JSON.stringify(uuids, 0, 2))
    log.debug('  getting emails from uuids')
    const emails = await getSidSvcs().getEmailsForUuids(uuids)
    log.debug('  emails: ')
    log.debug(JSON.stringify(emails, 0 , 2))
    log.debug('done...')
    return 'Better return something or no tomorrow.'
  }
  closeWidget();
}

export async function filterByContract(userList, contractAddress) {
  const uri = `${rootUrl}/contracts/${contractAddress}/transactions?page[limit]=100`;
  await fetchFromURL(uri, "contract");
  const uniqueAddresses = [...new Set(addresses)];
  log.debug(uniqueAddresses);
  log.debug(userList)
  let resultingAddresses = []
  for(const addr of userList) {
    const match = uniqueAddresses.indexOf(addr.toLowerCase());
    log.debug(match);
    if(match > -1) {
      resultingAddresses.push(uniqueAddresses[match])
    }
  }
  return resultingAddresses;
}

export function fetchFromURL(url, functionType) {
  log.debug("API URL: ", url);
  const options = {
    method: 'GET',
    uri: url,
    headers,
    json: true
  }
  return rp(options)
  .then(async function (parsedBody) {
    if(functionType === "contract") {
      const transactions = parsedBody.data;
      const addressesToPush = transactions.map(a => a.relationships.from.data.id);
      addresses.push(...addressesToPush);
      if(parsedBody.meta.page.hasNext) {
        const newUrl = parsedBody.links.next;
        await fetchFromURL(newUrl, "contract");
      } else {
        return addresses;
      }
    } else {
      log.debug("FROM ALETHIO: ", parsedBody);
    }
  })
  .catch(function (err) {
    log.error(err.message);
  });
}

export async function filterByLastSeen(users, data) {
  const { dateRange } = data;
  //const datum = Date.parse(dateRange.date);

  let filteredList = []

  const userKeys = Object.keys(users)
  for (const userKey of userKeys) {
    if (dateRange.rangeType === "Before" && parseInt(users[userKey].last_seen, 10) < dateRange.date) {
      filteredList.push(userKey);
    } else if(dateRange.rangeType === "After" && parseInt(users[userKey].last_seen, 10) > dateRange.date) {
      filteredList.push(userKey);
    }
  }
  return filteredList;
}

export async function filterByWalletBalance(users, balanceCriteria) {
  const { config } = await getGlobal();
  const { operatorType, amount } = balanceCriteria;
  const provider = ethers.getDefaultProvider(config.network ? config.network : 'mainnet');
  let filteredUsers = [];
  if(operatorType === "More Than") {
    if(balanceCriteria.tokenType === "ERC-20") {
      for(const user of users) {
        const url = `https://api.tokenbalance.com/token/${balanceCriteria.tokenAddress}/0xf1363d3d55d9e679cc6aa0a0496fd85bdfcf7464`
        const balance = await tokenFetch(url)
        const numberBal = parseFloat(balance)
        const numberAmount = parseFloat(amount)
        const matchCriteria = numberBal > numberAmount
        if(matchCriteria) {
          filteredUsers.push(user);
        }
      }
    } else {
      for(const user of users) {
        const balance = await provider.getBalance(user);
        const etherString = ethers.utils.formatEther(balance);
        const numberBal = parseFloat(etherString)
        const numberAmount = parseFloat(amount)
        const matchCriteria = numberBal > numberAmount
        if(matchCriteria) {
          log.debug("Criteria Match");
          filteredUsers.push(user);
        }
      }
    }
    return filteredUsers;
  } else if(operatorType === "Less Than") {
    if(balanceCriteria.tokenType === "ERC-20") {
      for(const user of users) {
        const url = `https://api.tokenbalance.com/token/${balanceCriteria.tokenAddress}/0xf1363d3d55d9e679cc6aa0a0496fd85bdfcf7464`
        const balance = await tokenFetch(url)
        const numberBal = parseFloat(balance)
        const numberAmount = parseFloat(amount)
        const matchCriteria = numberBal < numberAmount
        if(matchCriteria) {
          filteredUsers.push(user);
        }
      }
    } else {
      for(const user of users) {
        const balance = await provider.getBalance(user);
        const etherString = ethers.utils.formatEther(balance);
        const numberBal = parseFloat(etherString)
        const numberAmount = parseFloat(amount)
        const matchCriteria = numberBal < numberAmount
        if(matchCriteria) {
          filteredUsers.push(user);
        }
      }
    }

    return filteredUsers;
  }
}

export async function fetchTotalTransactions(users) {
  log.debug(users);
  const { config } = getGlobal();
  const provider = ethers.getDefaultProvider(config.network ? config.network : 'mainnet');
  let txCount = 0;
  for (const user of users) {
    log.debug(txCount);
    const count = await provider.getTransactionCount(user);
    txCount = txCount + count;
  }
  return txCount;
}

export async function walletPDF() {
  document.title = "SimpleID Wallet";
  window.print();
}

export async function tokenFetch(url) {
  const options = {
    method: 'GET',
    uri: url,
    headers,
    json: true
  }
  return rp(options)
  .then(async function (parsedBody) {
    log.debug("Token Balance Api:", parsedBody)
    if(parsedBody && parsedBody.balance) {
      return parsedBody.balance
    } else {
      return 0
    }


  })
  .catch(function (err) {
    log.error(err.message);
  });
}

//Probably don't want to keep this here
export async function handleEmails(data, url) {
  log.debug(`handleEmails called ...`)

  const route = '/v1/email'
  const options = {
    method: 'POST',
    uri: url + route,
    headers,
    body: data,
    json: true
  }

  return rp(options)
  .then(async function (parsedBody) {
    return parsedBody
  })
  .catch(function (err) {
    return err
  });
}
