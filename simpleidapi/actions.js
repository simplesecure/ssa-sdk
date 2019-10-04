import { lookupProfile } from 'blockstack';
const config = require('../config.json');
const request = require('request-promise');
let headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

export function handleAuth(payload) {
  headers['Authorization'] = payload.config.apiKey;
  const dataString = JSON.stringify(payload)
  const options = { url: config.AUTHENTICATION_URL, method: 'POST', headers: headers, body: dataString };
  return request(options)
  .then(async (body) => {
    return JSON.parse(body)
  })
  .catch(error => {
    // POST failed...
    console.log('ERROR: ', error)
    return {
      success: false, 
      body: JSON.parse(error.error).message
    }
  });
}
export function makeKeychain(credObj, devConfig) {
  //Send the username and the passphrase which will be used by the server to encrypt sensitive data
  const dataString = JSON.stringify({
    username: credObj.id,
    email: credObj.email,
    password: credObj.password,
    development: devConfig.development ? true : false,
    devId: devConfig.devId,
    storageModules: devConfig.storageModules,
    authModules: devConfig.authModules
  });

  headers['Authorization'] = devConfig.apiKey;

  //This is a simple call to replicate blockstack's make keychain function
  const options = { url: config.KEYCHAIN_URL, method: 'POST', headers: headers, body: dataString };
  return request(options)
  .then(async (body) => {
    // POST succeeded...
    return {
      success: true,
      message: "successfully created keychain",
      body: body
    }
  })
  .catch(error => {
    // POST failed...
    console.log('ERROR: ', error)
    return {
      success: false,
      message: "failed to create keychain",
      body: error
    }
  });
}

export function makeAppKeyPair(params, profile) {
  //Need to determine if this call is being made on account registration or not
  const dataString = JSON.stringify({
   username: params.username,
   password: params.password,
   url: params.appObj.appOrigin,
   profile: profile && profile.apps ? profile : null,
   development: params.appObj.development ? true : false,
   isDeveloper: params.appObj.isDev ? true : false,
   devId: params.appObj.devId,
   storageModules: params.appObj.storageModules,
   authModules: params.appObj.authModules
 })

 headers['Authorization'] = params.appObj.apiKey;

 var options = { url: config.APP_KEY_URL, method: 'POST', headers: headers, body: dataString };
 return request(options)
 .then((body) => {
   return {
     success: true,
     message: "successfully created app keypair",
     body: body
   }
 })
 .catch((error) => {
   console.log('Error: ', error.message);
   return {
     success: false,
     message: "failed to created app keypair",
     body: error.message
   }
 });
}

export function makeProfile(appObj) {
  let profile = {
    '@type': 'Person',
    '@context': 'http://schema.org',
    'apps': {}
  }
  if(appObj.scopes.indexOf("publish_data") > -1) {
    profile.apps[appObj.appOrigin] = ""
  }

  return profile;
}

export async function updateProfile(name, appObj) {
  //First we look up the profile
  let profile
  try {
    profile = await lookupProfile(`${name}.id.blockstack`);
    console.log("PROFILE:", profile);
    if (profile.apps) {
      if(profile.apps[appObj.appOrigin]) {
        //Don't need to do anything unless the gaia hub url is an empty string
      } else {
        if(appObj.scopes.indexOf("publish_data") > -1) {
          profile.apps[appObj.appOrigin] = ""
        }
      }
    }
    return profile;
  }
  catch (error) {
    console.log("ERROR:", error);
    profile = {
      '@type': 'Person',
      '@context': 'http://schema.org',
      'apps': {}
    }
    if(appObj.scopes.indexOf("publish_data") > -1) {
      profile.apps[appObj.appOrigin] = ""
    }
    return profile;
  }
}

