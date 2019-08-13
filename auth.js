import { lookupProfile } from 'blockstack';

require('dotenv').config()
const config = require('./config.json');
const request = require('request-promise');
const { InstanceDataStore } = require('blockstack/lib/auth/sessionStore');
const { connectToGaiaHub } = require('blockstack/lib/storage/hub');
const { AppConfig, UserSession } = require('blockstack');
let idAddress;

const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

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

export async function makeKeychain(credObj, devConfig) {
  //Send the username and the passphrase which will be used by the server to encrypt sensitive data
  const dataString = {
    username: credObj.id,
    email: credObj.email,
    password: credObj.password, 
    development: devConfig && devConfig.development ? true : false
  }
  //This is a simple call to replicate blockstack's make keychain function
  let endpointURL = devConfig.development ? config.DEV_DEVELOPER_KEYCHAIN_URL : config.DEV_KEYCHAIN_URL;
  const options = { url: endpointURL, method: 'POST', headers: headers, form: dataString };
  return request(options)
  .then(async (body) => {
    // POST succeeded...
    return {
      message: "successfully created keychain",
      body: body
    }
  })
  .catch(error => {
    // POST failed...
    console.log('ERROR: ', error)
    return {
      message: "failed to create keychain",
      body: error
    }
  });
}

export async function makeAppKeyPair(params, profile) {
  //Need to determine if this call is being made on account registration or not
  const dataString = {
    username: params.username,
    password: params.password,
    url: params.appObj.appOrigin,
    profile: profile && profile.apps ? JSON.stringify(profile) : null
  }

  var options = { url: config.DEV_APP_KEY_URL, method: 'POST', headers: headers, form: dataString };
  return request(options)
  .then((body) => {
    return {
      message: "successfully created app keypair",
      body: body
    }
  })
  .catch(error => {
    console.log('Error: ', error);
    return {
      message: "failed to created app keypair",
      body: error
    }
  });
}

export async function createUserAccount(credObj, config) {
  console.log("Checking name...");
  const nameCheck = await nameLookUp(credObj.id);
  if(nameCheck.pass) {
    console.log("Name check passed");
    try {
      console.log("Making keychain...");
      const keychain = await makeKeychain(credObj, config);        
      if(keychain) {
        console.log("Keychain made")
        idAddress = keychain.body;
        //Now we make the profile
        let profile = await makeProfile(config);
        
        const appKeyParams = {
          username: credObj.id,
          appObj: config,
          password: credObj.password
        }
        
        try {
          console.log("Making app keys...");
          const appKeys = await makeAppKeyPair(appKeyParams, profile);            
          if(appKeys) {
            console.log("App keys created");
            const appPrivateKey = JSON.parse(appKeys.body).private;
            const appUrl = appKeys.body.appUrl;
            profile.apps[config.appOrigin] = appUrl;
            //Let's register the name now
            console.log("Registering name...");
            const registeredName = await registerSubdomain(credObj.id, idAddress);
            if(registeredName) {
              console.log("Name registered");
            }
            //Now, we login
            try {
              const userSessionParams = {
                accountCreation: true,
                credObj,
                appObj: config,
                userPayload: {
                  privateKey: appPrivateKey,
                }
              }
              console.log("Logging in...");
              const userSession = await login(userSessionParams, profile);
              if(userSession) {
                console.log("Logged in");
                return {
                  message: "user session created", 
                  body: userSession.body
                }
              } else {
                return {
                  message: "trouble creating user session", 
                  body: null
                }
              }
            } catch (loginErr) {
              return {
                message: "trouble logging in", 
                body: loginErr
              }
            }              
          } else {
            return {
              message: "error creating app keys", 
              body: null
            }
          }
        } catch(error) {
          return {
            message: "error creating app keys", 
            body: error
          }
        }
      } else {
        return {
          message: "error with keychain", 
          body: null
        }
      }
    } catch(keychainErr) {
      return {
        message: "Failed to create keychain",
        body: keychainErr
      }
    }
  } else {
    return {
      message: nameCheck.message,
      body: null
    }
  }
}

export async function login(params, newProfile) {
  //params object should include the credentials obj, appObj, (optional) user payload with appKey and mnemonic and (optional) a bool determining whether we need to fetch data from the DB
  //@params fetchFromDB is a bool. Should be false if account was just created
  //@params credObj is simply the username and password
  //@params appObj is provided by the developer and is an object containing app scopes and app origin
  //@params userPayload object that includes the app key and the mnemonic
  if(params.accountCreation) {
    const userPayload = params.userPayload;
    const sessionObj = {
      scopes: params.appObj.scopes,
      appOrigin: params.appObj.appOrigin,
      appPrivKey: userPayload.privateKey,
      hubUrl: params.credObj.hubUrl, //Still have to think through this one
      username: params.credObj.id,
      profile: newProfile
    }
    try {
      const userSession = await makeUserSession(sessionObj);
      if(userSession) {
        return {
          message: "user session created", 
          body: userSession.body
        }
      } else {
        return {
          message: "error creating user session", 
          body: null
        }
      }
    } catch (userSessErr) {
      return {
        message: "error creating user session", 
        body: userSessErr
      }
    }
  } else {
    const appKeyParams = {
      username: params.credObj.id,
      appObj: params.appObj,
      password: params.credObj.password
    }
    const profile = await updateProfile(params.credObj.id, params.appObj);
    try {
      const appKeys = await makeAppKeyPair(appKeyParams, profile);
      if(appKeys) {
        const appPrivateKey = JSON.parse(appKeys.body).private;
        const appUrl = appKeys.body.appUrl;
        profile.apps[params.appObj.appOrigin] = appUrl;
        //Now, we login
        try {
          const userSessionParams = {
            credObj: params.credObj,
            appObj: params.appObj,
            userPayload: {
              privateKey: appPrivateKey,
            }
          }
          console.log("Logging in....");
          const userPayload = userSessionParams.userPayload;
          const sessionObj = {
            scopes: params.appObj.scopes,
            appOrigin: params.appObj.appOrigin,
            appPrivKey: userPayload.privateKey,
            hubUrl: params.credObj.hubUrl, //Still have to think through this one
            username: params.credObj.id,
            profile: newProfile
          }
          const userSession = await makeUserSession(sessionObj);
          
          if(userSession) {
            return {
              message: "user session created", 
              body: userSession.body
            }
          } else {
            return {
              message: "trouble creating user session", 
              body: null
            }
          }
        } catch (loginErr) {
          return {
            message: "trouble logging in", 
            body: loginErr
          }
        }              
      } else {
        return {
          message: "error creating app keys", 
          body: null
        }
      }
    } catch(error) {
      return {
        message: "error creating app keys", 
        body: error
      }
    }
  }
}

export async function makeUserSession(sessionObj) {
  //TODO need to fetch the profile if it's an existing user, or build up a profile if it's a new user
  // const profile = await lookupProfile(sessionObj.username);
  const appConfig = new AppConfig(
    sessionObj.scopes,
    sessionObj.appOrigin
  )
  const dataStore = new InstanceDataStore({
    userData: {
      appPrivateKey: sessionObj.appPrivKey,
      hubUrl: sessionObj.hubUrl,
      identityAddress: idAddress,
      username: sessionObj.username,
      gaiaHubConfig: await connectToGaiaHub('https://hub.blockstack.org', sessionObj.appPrivKey,""),
      profile: sessionObj.profile
    },
  })
  const userSession = new UserSession({
    appConfig,
    sessionStore: dataStore
  })
  console.log(userSession);
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

export function registerSubdomain(name) {
  const zonefile = JSON.stringify(`$ORIGIN ${name}.id.blockstack\n$TTL 3600\n_http._tcp\tIN\tURI\t10\t1\t\"https://gaia.blockstack.org/hub/${idAddress}/profile.json\"\n\n`);
  const dataString = JSON.stringify({name, owner_address: idAddress, zonefile});
  console.log(dataString);
  const options = { url: config.SUBDOMAIN_REGISTRATION, method: 'POST', headers: headers, body: dataString };
  return request(options)
  .then(async (body) => {
    // POST succeeded...
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

