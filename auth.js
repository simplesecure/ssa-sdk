require('dotenv').config()
const CryptoJS = require("crypto-js");
const Cookies = require('js-cookie');
const request = require('request-promise');
const { createECDH } = require('crypto-browserify');
const { InstanceDataStore } = require('blockstack/lib/auth/sessionStore');
const { AppConfig, UserSession, lookupProfile } = require('blockstack');
const { encryptECIES, decryptECIES } = require('blockstack/lib/encryption');
let mnemonic;
let serverPublicKey;
let idAddress;

const headers = { 'Content-Type': 'application/json' };

module.exports = {
  nameLookUp: function(name) {
    console.log(`${name}.id`)
    //Note: if we want to support other names spaces and other root id, we will need a different approach.
    const options = { url: `${process.env.NAME_LOOKUP_URL}${name}.id`, method: 'GET' };
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
  makeKeychain: async function(email, username, keypair) {
    //Send the username and the passphrase which will be used by the server to encrypt sensitive data
    const { publicKey, privateKey } = keypair
    const dataString = JSON.stringify({
      publicKey,
      username, 
      email
    })
    //This is a simple call to replicate blockstack's make keychain function
    const options = { url: process.env.DEV_KEYCHAIN_URL, method: 'POST', headers: headers, body: dataString };
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
  makeAppKeyPair: async function(params) {
    //Need to determine if this call is being made on account registration or not
    let dataString;
    let encryptedMnemonic;
    if(params.login) {
      const { publicKey } = params.keyPair;
      encryptedMnemonic = await encryptECIES(params.serverPublicKey, params.decryptedMnemonic);
      dataString = JSON.stringify({
        publicKey,
        username: params.username,
        url: params.appObj.appOrigin,
        mnemonic: encryptedMnemonic
      });
    } else {
      //encrypt the mnemonic with the key sent by the server
      const { privateKey, publicKey } = params.keyPair;
      const decryptedData = JSON.parse(await decryptECIES(privateKey, JSON.parse(params.keychain)));
      idAddress = decryptedData.ownerKeyInfo.idAddress.split("ID-")[1];
      serverPublicKey = decryptedData.publicKey;
      mnemonic = decryptedData.mnemonic;
      encryptedMnemonic = await encryptECIES(serverPublicKey, mnemonic);
      //Config for the post
      dataString = JSON.stringify({
        publicKey,
        username: params.username,
        url: params.appObj.appOrigin,
        mnemonic: encryptedMnemonic
      });
    }

    var options = { url: process.env.DEV_APP_KEY_URL, method: 'POST', headers: headers, body: dataString };
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
  },
  createUserAccount: async function(credObj, appObj) {
    //Take the credentials object and run the following in order:
    //1. Check to see if name is available.
    //2. If available, generate transit keypair and send request to server to make a keychain along with transit pubKey to be used for encrypting the response
    //3. Decrypt response with transit privKey, then send request for server to derive appKeyPair, send transit pubKey again so server can encrypt response
    //4. Verify user session can be created with info now available
    //5. Encrypt mnemonic with password
    //6. Post password encrypted mnemonic and id to server
    //7. Encrypt mnemonic with password
    //8. Post password encrypted mnemonic and id to server

    //Step One
    const nameCheck = await this.nameLookUp(credObj.id);
    if(nameCheck.pass) {
      //Step Two
      //generate transit keys then make a keychain
      const keyPair = await this.makeTransitKeys();
      const { privateKey } = keyPair;
      const keychain = await this.makeKeychain(credObj.email, credObj.id, keyPair);

      //Step Three
      const appKeyParams = {
        username: credObj.id,
        keychain: keychain.body,
        appObj,
        keyPair
      }
      const appKeys = await this.makeAppKeyPair(appKeyParams);
      const encryptedKeys = appKeys.body;
      const decryptedKeys = await decryptECIES(privateKey, JSON.parse(encryptedKeys));
      const appPrivateKey = JSON.parse(decryptedKeys).private;
      //Step Four
      const userSessionParams = {
        login: false,
        credObj,
        appObj,
        userPayload: {
          privateKey: appPrivateKey
        }
      }
      try {
        const userSession = await this.login(userSessionParams);
        if (typeof window === 'undefined') {
          //this is node or mobile, so we need to store encrypted user session data a different way
        } else {
          const encryptedUserPayload = CryptoJS.AES.encrypt(JSON.stringify(userSessionParams.userPayload), credObj.password);
          const cookiePayload = {
            username: credObj.id,
            userPayload: encryptedUserPayload.toString()
          }
        
          Cookies.set('simple-secure', JSON.stringify(cookiePayload), { expires: 7 });
        }
        return {
          message: "successfully created user session",
          body: userSession
        }
      } catch (err) {
        return {
          message: "failed to create user session",
          body: err
        }
      }
    } else {
      return {
        message: nameCheck.message,
        body: null
      }
    }
  },
  makeTransitKeys: async function() {
    const clientTransmitKeys = createECDH('secp256k1')
    await clientTransmitKeys.generateKeys()
    const clientPrivateKey = await clientTransmitKeys.getPrivateKey('hex').toString()
    const clientPublicKey = await clientTransmitKeys.getPublicKey('hex', 'compressed').toString()
    const keyPair = {
        privateKey: clientPrivateKey,
        publicKey: clientPublicKey
    }
    return keyPair;
  },
  login: async function(params) {
    let userPayload;
    //params object should include the credentials obj, appObj, (optional) user payload with appKey and mnemonic and (optional) a bool determining whether we need to fetch data from the DB
    //@params fetchFromDB is a bool. Should be false if account was just created
    //@params credObj is simply the username and password
    //@params appObj is provided by the developer and is an object containing app scopes and app origin
    //@params userPayload object that includes the app key and the mnemonic
    if(params.login) {
      if(params.credObj.email) {
        const username = params.credObj.id;
        const email = params.credObj.email;
        //First we need to generate a transit keypair
        const keyPair = await this.makeTransitKeys();
        const { publicKey, privateKey } = keyPair;
        const dataString = JSON.stringify({publicKey, username, email});
        const options = { url: 'https://i7sev8z82g.execute-api.us-west-2.amazonaws.com/dev/getMnemonic-dev', method: 'POST', headers: headers, body: dataString };
        return request(options)
        .then(async (body) => {
          // POST succeeded...
          const { encryptedKeychain, serverPublicKey, idHash } = JSON.parse(body);
          //this will get us the encrypted mnemonic
          const encryptedMnemonic = JSON.parse(decryptECIES(privateKey, JSON.parse(encryptedKeychain)));
          //then decrypt it with the password if password is valid
          try {
            const bytes  = CryptoJS.AES.decrypt(encryptedMnemonic.toString(), params.credObj.password);
            const decryptedMnemonic = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
            console.log(decryptedMnemonic);
            //Now we need to derive the app keys
            const appKeyParams = {
              login: true,
              username: params.credObj.id,
              decryptedMnemonic,
              appObj: params.appObj,
              keyPair,
              serverPublicKey
            }
            const appKeys = await this.makeAppKeyPair(appKeyParams);
            const decryptedAppKeys = JSON.parse(await decryptECIES(privateKey, JSON.parse(appKeys.body)));
            idAddress = idHash;
            userPayload = {
              privateKey: decryptedAppKeys.privateKey
            }
            const sessionObj = {
              scopes: params.appObj.scopes,
              appOrigin: params.appObj.appOrigin,
              appPrivKey: userPayload.privateKey,
              hubUrl: params.credObj.hubUrl, //Still have to think through this one
              username: params.credObj.id
            }
            const userSession = await this.makeUserSession(sessionObj);
            if(userSession) {
              return {
                message: "user session created",
                body: userSession
              }
            } else {
              return {
                message: "error creating user session"
              }
            }
          } catch(error) {
            return {
              message: "invalid password", 
              body: error
            }
          }
        })
        .catch(err => {
          // POST failed...
          console.log('ERROR: ', err)
          return {
            message: "failed to fetch user info from db",
            body: err
          }
        });
      } else {
        //Check to see if there is an encrypted mnemonic in cookie storage
        const mnemonicAvailable = await Cookies.get('simple-secure');
        if(mnemonicAvailable) {
          //Just use the available mnemonic, decrypt with password and get to work
          const cookiePayload = JSON.parse(mnemonicAvailable);
          if(cookiePayload.username === params.credObj.id) {
            const encryptedKeychain = cookiePayload.userPayload;
            const bytes  = CryptoJS.AES.decrypt(encryptedKeychain, params.credObj.password);
            const decryptedMnemonic = bytes.toString(CryptoJS.enc.Utf8);
            const privateKey = JSON.parse(decryptedMnemonic).privateKey;
            userPayload = {
              privateKey
            }
            idAddress= cookiePayload.idAddress;
            const sessionObj = {
              scopes: params.appObj.scopes,
              appOrigin: params.appObj.appOrigin,
              appPrivKey: userPayload.privateKey,
              hubUrl: params.credObj.hubUrl, //Still have to think through this one
              username: params.credObj.id
            }
            const userSession = await this.makeUserSession(sessionObj);
            if(userSession) {
              return {
                message: "user session created",
                body: userSession
              }
            } else {
              return {
                message: "error creating user session"
              }
            }
          } else {
            return {
              message: "Need to go through recovery flow"
            }
          }
        } else {
          //Need to kick off a recovery flow that requires email address
          return {
            message: "Need to go through recovery flow"
          }
        }
      }
    } else {
      userPayload = params.userPayload;
      const sessionObj = {
        scopes: params.appObj.scopes,
        appOrigin: params.appObj.appOrigin,
        appPrivKey: userPayload.privateKey,
        hubUrl: params.credObj.hubUrl, //Still have to think through this one
        username: params.credObj.id
      }
      const userSession = await this.makeUserSession(sessionObj);
      if(userSession) {
        //Step five
        const encryptedMnenomic = CryptoJS.AES.encrypt(JSON.stringify(mnemonic), params.credObj.password);
        const doubleEncryptedMnemonic = await encryptECIES(serverPublicKey, encryptedMnenomic.toString());
        const id = params.credObj.id;
        const storeMnemonic = await this.storeMnemonic(id, doubleEncryptedMnemonic);
        if(storeMnemonic) {
          //Finally, let's register the username onchain (eventually)
          console.log("registering subdomain")
          const registeredName = await this.registerSubdomain(params.credObj.id, idAddress)
          if(registeredName.message === "username registered") {
            return userSession;
          } else {
            return {
              message: registeredName.message,
              body: registeredName.body
            }
          }
        } else {
          return "Error storing mnemonic"
        }
      } else {
        return "Error creating user session"
      }
    }
  },
  makeUserSession: async function(sessionObj) {
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
        username: sessionObj.username, 
        gaiaHubConfig: {
          address: idAddress,
          server: 'https://hub.blockstack.org',
          token: '',
          url_prefix: 'https://gaia.blockstack.org/hub/'
        }
        // profile: profileObj,  ***We will need to be returning the profile object here once we figure it out***
      }, 
      username: sessionObj.username
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
  },
  storeMnemonic: async function (username, encryptedMnemonic) {
    const dataString = JSON.stringify({username, encryptedKeychain: encryptedMnemonic});
    const options = { url: process.env.DEV_STORE_ENCRYPTED_KEYCHAIN, method: 'POST', headers: headers, body: dataString };
    return request(options)
    .then(async (body) => {
      // POST succeeded...
      return {
        message: "successfully stored encrypted mnemonic",
        body: body
      }
    })
    .catch(error => {
      // POST failed...
      console.log('ERROR: ', error)
      return {
        message: "failed to store encrypted mnemonic",
        body: error
      }
    });
  }, 
  registerSubdomain: function(name, idAddress) {
    const zonefile = `$ORIGIN ${name}\n$TTL 3600\n_https._tcp URI 10 1`
    const dataString = JSON.stringify({name, owner_address: idAddress, zonefile});
    console.log(dataString);
    const options = { url: process.env.SUBDOMAIN_REGISTRATION, method: 'POST', headers: headers, body: dataString };
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
}
