require('dotenv').config();
const config = require('../config.json');
const request = require('request-promise');
const { InstanceDataStore } = require('blockstack/lib/auth/sessionStore');
const { AppConfig, UserSession, lookupProfile, connectToGaiaHub } = require('blockstack');
let idAddress;
let configObj;
let wallet;
let textile;

let headers = { 'Content-Type': 'application/json' };

module.exports = {
  nameLookUp: function(name) {
    console.log(`${name}.id.blockstack`)
    //Note: if we want to support other names spaces and other root id, we will need a different approach.
    const options = { url: `${config.NAME_LOOKUP_URL}${name}.id.blockstack`, method: 'GET' };
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
  },
  makeKeychain: async function(credObj, devConfig) {
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
  },
  makeAppKeyPair: async function(params, profile) {
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

    headers['Authorization'] = params.appObj.apiKey;

    var options = { url: config.APP_KEY_URL, method: 'POST', headers: headers, form: dataString };
    return request(options)
    .then((body) => {
      console.log(body);
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
  },
  createUserAccount: async function(credObj, config) {
    //For now we can continue to use Blockstack's name lookup, even for non-Blockstack auth
    const nameCheck = await this.nameLookUp(credObj.id);
    console.log("Verifying name availability...");
    if(nameCheck.pass) {
      console.log("Name check passed");
      try {
        console.log("Making keychain...");
        const keychain = await this.makeKeychain(credObj, config);
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
          let profile = await this.makeProfile(config);

          const appKeyParams = {
            username: credObj.id,
            appObj: config,
            password: credObj.password
          }

          try {
            console.log("Making app keys...");
            const appKeys = await this.makeAppKeyPair(appKeyParams, profile);
            if(appKeys) {
              console.log("App keys created");
              const appPrivateKey = JSON.parse(appKeys.body).blockstack ? JSON.parse(appKeys.body).blockstack.private : "";
              configObj = JSON.parse(appKeys.body).config || {};
              apiKey = JSON.parse(appKeys.body).apiKey || "";
              wallet = JSON.parse(appKeys.body).walet;
              textile = JSON.parse(appKeys.body).textile || "";
              const appUrl = JSON.parse(appKeys.body).blockstack.appUrl || "";
              profile.apps[config.appOrigin] = appUrl;
              //Let's register the name now
              console.log("Registering name...");
              const registeredName = await this.registerSubdomain(credObj.id, idAddress);
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
                const userSession = await this.login(userSessionParams, profile);
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
  },
  login: async function(params, newProfile) {
    console.log(params);
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
        const userSession = await this.makeUserSession(sessionObj);
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
      const profile = await this.updateProfile(params.credObj.id, params.appObj);
      try {
        const appKeys = await this.makeAppKeyPair(appKeyParams, profile);
        if(appKeys) {
          const appPrivateKey = JSON.parse(appKeys.body).blockstack ? JSON.parse(appKeys.body).blockstack.private : "";
          const appUrl = JSON.parse(appKeys.body).blockstack.appUrl || "";
          configObj = JSON.parse(appKeys.body).config;
          apiKey = JSON.parse(appKeys.body).apiKey || "";
          wallet = JSON.parse(appKeys.body).walet;
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
            console.log("Logging in....");
            const userPayload = userSessionParams.userPayload;
            const sessionObj = {
              scopes: params.appObj.scopes,
              appOrigin: params.appObj.appOrigin,
              appPrivKey: userPayload.privateKey,
              hubUrl: params.credObj.hubUrl ? params.credObj.hubUrl : "https://hub.blockstack.org", //Still have to think through this one
              username: params.credObj.id,
              profile: newProfile
            }
            const userSession = await this.makeUserSession(sessionObj);

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
  },
  makeUserSession: async function(sessionObj) {
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
        textile
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
  },
  registerSubdomain: function(name, idAddress) {
    const zonefile = JSON.stringify(`$ORIGIN ${name}.id.blockstack\n$TTL 3600\n_http._tcp\tIN\tURI\t10\t1\t\"https://gaia.blockstack.org/hub/${idAddress}/profile.json\"\n\n`);
    const dataString = JSON.stringify({name, owner_address: idAddress, zonefile});
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
      // console.log('ERROR: ', error)
      return {
        message: "failed to register username",
        body: error
      }
    });
  },
  updateProfile: async function(name, appObj) {
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
  },
  makeProfile: function(appObj) {
    let profile = {
      '@type': 'Person',
      '@context': 'http://schema.org',
      'apps': {}
    }
    if(appObj.scopes.indexOf("publish_data") > -1) {
      profile.apps[appObj.appOrigin] = ""
    }

    return profile;
  },
  getConfig: function(params) {
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
  },
  updateConfig: function(updates, verification) {
    const payload = {
      devId: updates.username,
      config: JSON.stringify(updates.config),
      development: updates.development ? true : false
    };
    console.log(payload.config);
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
  },
  createContract: function(params) {
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
  },
  fetchContract: function(params) {
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
  },
  pinContent: function(params) {
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
  },
  fetchPinnedContent: function(params) {
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
}
