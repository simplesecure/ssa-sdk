import { makeKeychain, makeAppKeyPair, makeProfile, updateProfile } from './simpleidapi/actions';
import { nameLookUp, registerSubdomain, makeUserSession } from './blockstack/actions';
const request = require('request-promise');
const config = require('./config.json');
let headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
let idAddress;
let configObj;
let apiKey;
let wallet;
let textile;

export async function createUserAccount(credObj, config, options={}) {
  const statusCallbackFn = options.hasOwnProperty('statusCallbackFn') ? options['statusCallbackFn'] : undefined

  console.log("Verifying name availability...");
  if (statusCallbackFn) {
    statusCallbackFn("Verifying name availability...")
  }
  const nameCheck = await nameLookUp(credObj.id);
  if(nameCheck.pass) {
    console.log("Name check passed");
    try {
      console.log("Making keychain...");
      if (statusCallbackFn) {
        statusCallbackFn("Making keychain...")
      }
      const keychain = await makeKeychain(credObj, config);
      if(keychain.success === false) {
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
          const appKeys = await makeAppKeyPair(appKeyParams, profile);
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
            //If we want to prevent continuation after a name registration failure
            //we need to wrap this in a try/catch
            const registeredName = await registerSubdomain(credObj.id, idAddress);
            if(registeredName) {
              console.log("Name registered");
            } 
            console.log(registeredName);
            //Now, we login
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
              console.log(userSession);
              //Setting the usersession so the dev doesn't have to manually
              localStorage.setItem('blockstack-session', JSON.stringify(userSession.body.store.sessionData));
              return {
                success: true,
                message: "user session created",
                body: userSession.body
              }
            } else {
              console.log(userSession);
              return {
                success: false,
                message: "trouble creating user session",
                body: null
              }
            }
          } else {
            console.log(appKeys);
            return {
              success: false, 
              message: "error creating app keys",
              body: null
            }
          }
        } catch(error) {
          console.log(error);
          return {
            success: false,
            message: "error creating app keys",
            body: error
          }
        }
      }
    } catch(keychainErr) {
      console.log(keychainErr);
      return {
        success: false, 
        message: "Failed to create keychain",
        body: keychainErr
      }
    }
  } else {
    return {
      success: false, 
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
    console.log("Logging in from account creation...")
    const userPayload = params.userPayload;
    const sessionObj = {
      scopes: params.appObj.scopes,
      appOrigin: params.appObj.appOrigin,
      appPrivKey: userPayload.privateKey,
      hubUrl: params.credObj.hubUrl ? params.credObj.hubUrl : "https://hub.blockstack.org", //Still have to think through this one
      username: params.credObj.id,
      profile: newProfile, 
      wallet, 
      apiKey, 
      textile, 
      configObj
    }
    try {
      const userSession = await makeUserSession(sessionObj, idAddress);
      if(userSession) {
        return {
          success: true,
          message: "user session created",
          body: userSession.body
        }
      } else {
        return {
          success: false, 
          message: "error creating user session",
          body: null
        }
      }
    } catch (userSessErr) {
      return {
        success: false, 
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
            profile: newProfile, 
            wallet, 
            apiKey, 
            textile, 
            configObj
          }
          const userSession = await makeUserSession(sessionObj, idAddress);

          if(userSession) {
            console.log("Logged in")
            //Setting the usersession so the dev doesn't have to manually
            localStorage.setItem('blockstack-session', JSON.stringify(userSession.body.store.sessionData));
            return {
              success: true,
              message: "user session created",
              body: userSession.body
            }
          } else {
            return {
              success: false,
              message: "trouble creating user session",
              body: null
            }
          }
        } catch (loginErr) {
          return {
            success: false,
            message: "trouble logging in",
            body: loginErr
          }
        }
      } else {
        return {
          success: false,
          message: "error creating app keys",
          body: appKeys.body
        }
      }
    } catch(error) {
      return {
        success: false,
        message: "error creating app keys",
        body: appKeys.body ? appKeys.body : error
      }
    }
  }
}

export function getConfig(params) {
  const payload = JSON.stringify({
    devId: params.devId,
    development: params.development ? true : false
  });
  headers['Authorization'] = params.apiKey;
  var options = { url: config.GET_CONFIG_URL, method: 'POST', headers: headers, body: payload };
  return request(options)
  .then((body) => {
    console.log(body);
    return {
      success: true,
      message: "get developer account config",
      body: body
    }
  })
  .catch(error => {
    console.log('Error: ', error);
    return {
      success: false,
      message: "failed to get developer account",
      body: error
    }
  });
}

export function updateConfig(updates, verification) {
  const payload = JSON.stringify({
    devId: updates.username,
    config: updates.config,
    development: updates.development ? true : false
  });
  console.log(payload);
  if(verification) {
    headers['Authorization'] = updates.verificationID;
  } else {
    headers['Authorization'] = updates.apiKey;
  }
  console.log(headers);
  var options = { url: config.UPDATE_CONFIG_URL, method: 'POST', headers: headers, body: payload };
  return request(options)
  .then((body) => {
    console.log(body);
    return {
      success: true,
      message: "updated developer account",
      body: body
    }
  })
  .catch(error => {
    console.log('Error: ', error);
    return {
      success: false,
      message: "failed to update developer account",
      body: error
    }
  });
}

export function createContract(params) {
  const payload = JSON.stringify({
    devId: params.devId,
    password: params.password,
    username: params.username,
    abi: params.abi,
    bytecode: params.bytecode,
    development: params.development ? true : false
  });
  headers['Authorization'] = params.apiKey;
  var options = { url: config.CREATE_CONTRACT_URL, method: 'POST', headers: headers, body: payload };
  return request(options)
  .then((body) => {
    console.log(body);
    return {
      success: true,
      message: "contract created and deployed",
      body: body
    }
  })
  .catch(error => {
    console.log('Error: ', error);
    return {
      success: false,
      message: "failed to create contract",
      body: error
    }
  });
}

export function fetchContract(params) {
  const payload = JSON.stringify({
    devId: params.devId,
    contractAddress: params.contractAddress,
    abi: params.abi,
    development: params.development ? true : false
  })
  headers['Authorization'] = params.apiKey;
  var options = { url: config.FETCH_CONTRACT_URL, method: 'POST', headers: headers, body: payload };
  return request(options)
  .then((body) => {
    console.log(body);
    return {
      success: true,
      message: "retreived contract and executed",
      body: body
    }
  })
  .catch(error => {
    console.log('Error: ', error);
    return {
      success: false, 
      message: "failed to retreive contract",
      body: error
    }
  });
}

export function pinContent(params) {
  const payload = JSON.stringify({
    devId: params.devId,
    username: params.username,
    devSuppliedIdentifier: params.id,
    contentToPin: params.content,
    development: params.development ? true : false
  })
  headers['Authorization'] = params.apiKey;
  var options = { url: config.PIN_CONTENT_URL, method: 'POST', headers: headers, body: payload };
  return request(options)
  .then((body) => {
    return {
      success: true,
      message: "content successfully pinned",
      body: body
    }
  })
  .catch(error => {
    console.log('Error: ', error);
    return {
      success: false, 
      message: "failed to pin content",
      body: error
    }
  });
}

export function fetchPinnedContent(params) {
  const payload = JSON.stringify({
    devId: params.devId,
    username: params.username,
    devSuppliedIdentifier: params.id,
    development: params.development ? true : false
  })
  headers['Authorization'] = params.apiKey;
  var options = { url: config.FETCH_PINNED_CONTENT_URL, method: 'POST', headers: headers, body: payload };
  return request(options)
  .then((body) => {
    return {
      success: true, 
      message: "Found pinned content",
      body: body
    }
  })
  .catch(error => {
    console.log('Error: ', error);
    return {
      success: false,
      message: "failed to find pinned content",
      body: error
    }
  });
}
