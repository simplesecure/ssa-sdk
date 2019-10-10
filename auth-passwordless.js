import { lookupProfile } from 'blockstack';

require('dotenv').config()
const config = require('./config.json');
const request = require('request-promise');
const { InstanceDataStore } = require('blockstack/lib/auth/sessionStore');
const { connectToGaiaHub } = require('blockstack/lib/storage/hub');
const { AppConfig, UserSession } = require('blockstack');
let idAddress;
let configObj;
let apiKey;
let wallet;
let textile;

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

export async function makeKeychain(credObj, devConfig) {
  //Send the username and the passphrase which will be used by the server to encrypt sensitive data
  const dataString = {
    username: credObj.id,
    email: credObj.email,
    password: credObj.password,
    development: devConfig.development ? true : false,
    devId: devConfig.devId,
    storageModules: devConfig.storageModules,
    authModules: devConfig.authModules
  }

  headers['Authorization'] = devConfig.apiKey;

  //This is a simple call to replicate blockstack's make keychain function
  const options = { url: config.KEYCHAIN_URL, method: 'POST', headers: headers, form: dataString };
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

export async function makeAppKeyPair(params, profile, options={}) {
    const passwordless =
      options.hasOwnProperty('passwordless') ? options['passwordless'] : false

   //Need to determine if this call is being made on account registration or not
   const dataString = {
    username: params.username,
    password: params.password,
    url: params.appObj.appOrigin,
    profile: profile && profile.apps ? JSON.stringify(profile) : null,
    development: params.appObj.development ? true : false,
    isDeveloper: params.appObj.isDev ? true : false,
    devId: params.appObj.devId,
    storageModules: params.appObj.storageModules,
    authModules: params.appObj.authModules
  }
  if (passwordless) {
    dataString['email'] = params.email
    // TODO: Need some way to resolve a devId to a dev email now that they're in
    //       the same db, or we can use the origin.
    //
  }

  headers['Authorization'] = params.appObj.apiKey;

  var options = { url: config.APP_KEY_URL, method: 'POST', headers: headers, form: dataString };
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

export async function createUserAccount(credObj, config, options={}) {
  const statusCallbackFn =
    options.hasOwnProperty('statusCallbackFn') ? options['statusCallbackFn'] : undefined

  const passwordless =
    options.hasOwnProperty('passwordless') ? options['passwordless'] : false
  if (passwordless) {
    console.log(`INFO(auth::createUserAccount): passwordless flow enabled.`)
  }

  // passwordless: skip the namecheck for the moment and use a hash of the
  //               email + simple for the name. The hash should be strong against
  //               collisions so lets do that on the lambda rather than push it
  //               here into the sdk.  TODO

  //For now we can continue to use Blockstack's name lookup, even for non-Blockstack auth
  let nameCheck = undefined
  if (!passwordless) {
    console.log("Verifying name availability...");
    if (statusCallbackFn) {
      statusCallbackFn("Verifying name availability...")
    }
    nameCheck = await nameLookUp(credObj.id);
  }

  if (passwordless || nameCheck.pass) {
    if (!passwordless) {
      console.log("Name check passed");
    }

    try {
      console.log("Making keychain...");
      if (statusCallbackFn) {
        statusCallbackFn("Making keychain...")
      }
      const keychain = await makeKeychain(credObj, config);
      if(keychain.success === false) {
        //This would happen for a variety of reasons, just return the server message
        return {
          success: false,
          message: keychain.body
        }
      } else {
        console.log("Keychain made")
        idAddress = keychain.body;
        //Now we make the profile
        let profile = makeProfile(config);

        const appKeyParams = {
          username: credObj.id,
          appObj: config,
          password: credObj.password
        }

        try {
          console.log("Making app keys...");
          if (statusCallbackFn) {
            statusCallbackFn("Making app keys...")
          }
          if (passwordless) {
            appKeyParams['email'] = credObj.email
          }
          const appKeys = await makeAppKeyPair(appKeyParams, profile, { passwordless });
          if(appKeys) {
            console.log("App keys created");
            const appPrivateKey = JSON.parse(appKeys.body).blockstack ? JSON.parse(appKeys.body).blockstack.private : "";
            configObj = JSON.parse(appKeys.body).config || {};
            apiKey = JSON.parse(appKeys.body).apiKey || "";
            wallet = JSON.parse(appKeys.body).wallet;
            textile = JSON.parse(appKeys.body).textile || "";
            const appUrl = JSON.parse(appKeys.body).blockstack.appUrl || "";
            profile.apps[config.appOrigin] = appUrl;

            //Let's register the name now
            console.log("Registering name...");
            if (statusCallbackFn) {
              statusCallbackFn("Registering name...")
            }

            // TODO: something sensinsble by someone with slepep who can spell.
            if (!passwordless) {
              const registeredName = await registerSubdomain(credObj.id, idAddress);
              if(registeredName) {
                console.log("Name registered");
              }
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
              if (statusCallbackFn) {
                statusCallbackFn("Logging in...")
              }
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
      hubUrl: params.credObj.hubUrl ? params.credObj.hubUrl : "https://hub.blockstack.org", //Still have to think through this one
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
      if(appKeys.success) {
        const appPrivateKey = JSON.parse(appKeys.body).blockstack ? JSON.parse(appKeys.body).blockstack.private : "";
        const appUrl = JSON.parse(appKeys.body).blockstack.appUrl || "";
        configObj = JSON.parse(appKeys.body).config;
        apiKey = JSON.parse(appKeys.body).apiKey || "";
        wallet = JSON.parse(appKeys.body).wallet;
        textile = JSON.parse(appKeys.body).textile || "";

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
          const userPayload = userSessionParams.userPayload;
          const sessionObj = {
            scopes: params.appObj.scopes,
            appOrigin: params.appObj.appOrigin,
            appPrivKey: userPayload.privateKey,
            hubUrl: params.credObj.hubUrl ? params.credObj.hubUrl : "https://hub.blockstack.org", //Still have to think through this one
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
          body: appKeys.body
        }
      }
    } catch(error) {
      return {
        message: "error creating app keys",
        body: appKeys.body ? appKeys.body : error
      }
    }
  }
}

export async function makeUserSession(sessionObj) {
  if(!configObj) {
    configObj = {};
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
      username: sessionObj.username,
      gaiaHubConfig: await connectToGaiaHub('https://hub.blockstack.org', sessionObj.appPrivKey,""),
      profile: sessionObj.profile,
      wallet: wallet ? wallet : {},
      textile,
      apiKey
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

export function registerSubdomain(name) {
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

export function getConfig(params) {
  const payload = {
    devId: params.devId,
    development: params.development ? true : false
  };
  headers['Authorization'] = params.apiKey;
  console.log(payload);
  console.log(headers);
  var options = { url: config.GET_CONFIG_URL, method: 'POST', headers: headers, form: payload };
  return request(options)
  .then((body) => {
    console.log(body);
    return {
      message: "get developer account config",
      body: body
    }
  })
  .catch(error => {
    console.log('Error: ', error);
    return {
      message: "failed to get developer account",
      body: error
    }
  });
}

export function updateConfig(updates, verification) {
  const payload = {
    devId: updates.username,
    config: JSON.stringify(updates.config),
    development: updates.development ? true : false
  };
  console.log(payload);
  if(verification) {
    headers['Authorization'] = updates.verificationID;
  } else {
    headers['Authorization'] = updates.apiKey;
  }
  console.log(headers);
  var options = { url: config.UPDATE_CONFIG_URL, method: 'POST', headers: headers, form: payload };
  return request(options)
  .then((body) => {
    console.log(body);
    return {
      message: "updated developer account",
      body: body
    }
  })
  .catch(error => {
    console.log('Error: ', error);
    return {
      message: "failed to update developer account",
      body: error
    }
  });
}

export function createContract(params) {
  const payload = {
    devId: params.devId,
    password: params.password,
    username: params.username,
    abi: JSON.stringify(params.abi),
    bytecode: params.bytecode,
    development: params.development ? true : false
  }
  headers['Authorization'] = params.apiKey;
  var options = { url: config.CREATE_CONTRACT_URL, method: 'POST', headers: headers, form: payload };
  return request(options)
  .then((body) => {
    console.log(body);
    return {
      message: "contract created and deployed",
      body: body
    }
  })
  .catch(error => {
    console.log('Error: ', error);
    return {
      message: "failed to create contract",
      body: error
    }
  });
}

export function fetchContract(params) {
  const payload = {
    devId: params.devId,
    contractAddress: params.contractAddress,
    abi: JSON.stringify(params.abi),
    development: params.development ? true : false
  }
  headers['Authorization'] = params.apiKey;
  var options = { url: config.FETCH_CONTRACT_URL, method: 'POST', headers: headers, form: payload };
  return request(options)
  .then((body) => {
    console.log(body);
    return {
      message: "retreived contract and executed",
      body: body
    }
  })
  .catch(error => {
    console.log('Error: ', error);
    return {
      message: "failed to retreive contract",
      body: error
    }
  });
}

export function pinContent(params) {
  const payload = {
    devId: params.devId,
    username: params.username,
    devSuppliedIdentifier: params.id,
    contentToPin: JSON.stringify(params.content),
    development: params.development ? true : false
  }
  headers['Authorization'] = params.apiKey;
  var options = { url: config.PIN_CONTENT_URL, method: 'POST', headers: headers, form: payload };
  return request(options)
  .then((body) => {
    return {
      message: "content successfully pinned",
      body: body
    }
  })
  .catch(error => {
    console.log('Error: ', error);
    return {
      message: "failed to pin content",
      body: error
    }
  });
}

export function fetchPinnedContent(params) {
  const payload = {
    devId: params.devId,
    username: params.username,
    devSuppliedIdentifier: params.id,
    development: params.development ? true : false
  }
  headers['Authorization'] = params.apiKey;
  var options = { url: config.FETCH_PINNED_CONTENT_URL, method: 'POST', headers: headers, form: payload };
  return request(options)
  .then((body) => {
    return {
      message: "Found pinned content",
      body: body
    }
  })
  .catch(error => {
    console.log('Error: ', error);
    return {
      message: "failed to find pinned content",
      body: error
    }
  });
}
