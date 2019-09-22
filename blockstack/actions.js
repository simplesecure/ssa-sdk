const { InstanceDataStore } = require('blockstack/lib/auth/sessionStore');
const { connectToGaiaHub } = require('blockstack/lib/storage/hub');
const { AppConfig, UserSession } = require('blockstack');
const config = require('../config.json');
const request = require('request-promise');
let headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

export function nameLookUp(name) {
  //Note: if we want to support other names spaces and other root id, we will need a different approach.
  const options = { url: `https://core.blockstack.org/v1/names/${name}.id.blockstack`, method: 'GET' };
  return request(options)
  .then(async () => {
    return {
      pass: false,
      message: "name taken"
    }
  })
  .catch(error => {
    console.log(error.error)
    if(error.error === '{\n  "status": "available"\n}\n' || error.error === '{"status":"available"}') {
      return {
        pass: true,
        message: "name available"
      }
    } else {
      return {
        pass: false,
        body: error
      }
    }

  });
}

export async function makeUserSession(sessionObj, idAddress) {
  let configObj;
  if(!sessionObj.configObj) {
    configObj = {};
  } else { 
    configObj = sessionObj.configObj;
  }
  const appConfig = new AppConfig(
    sessionObj.scopes,
    sessionObj.appOrigin
  )
  const dataStore = new InstanceDataStore({
    userData: {
      appPrivateKey: sessionObj.appPrivKey,
      identityAddress: idAddress,
      hubUrl: sessionObj.hubUrl,
      identityAddress: idAddress,
      devConfig: configObj,
      username: `${sessionObj.username}.id.blockstack`,
      simpleid: sessionObj.username,
      gaiaHubConfig: await connectToGaiaHub('https://hub.blockstack.org', sessionObj.appPrivKey,""),
      profile: sessionObj.profile,
      wallet: sessionObj.wallet ? sessionObj.wallet : {},
      textile: sessionObj.textile,
      apiKey: sessionObj.apiKey
    },
  })
  const userSession = new UserSession({
    appConfig,
    sessionStore: dataStore
  })
  try {

    return {
        message: "user session created",
        body: userSession
    }
  } catch(err) {
    return {
        message: "failed to create user session",
        body: err
    }
  }
}

export function registerSubdomain(name, idAddress) {
  const newId = idAddress.split('ID-')[1]
  const zonefile = `$ORIGIN ${name}\n$TTL 3600\n_https._tcp URI 10 1 \"https://gaia.blockstack.org/hub/${newId}/profile.json\"\n`;
  const dataString = JSON.stringify({zonefile, name, owner_address: newId})
  console.log(dataString);
  const options = {
    url: config.SUBDOMAIN_REGISTRATION,
    method: 'POST',
    headers: {
      'cache-control': 'no-cache,no-cache',
      'Content-Type': 'application/json',
      'Authorization': 'bearer API-KEY-IF-USED'
    },
    body: dataString
  };
  return request(options)
  .then(async (body) => {
    // POST succeeded...
    console.log('success username registered')
    return {
      message: "username registered",
      body: body
    }
  })
  .catch(error => {
    // POST failed...
    console.log('ERROR: ', error)
    return {
      message: "failed to register username",
      body: error
    }
  });
}

