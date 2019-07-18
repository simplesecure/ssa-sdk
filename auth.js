require('dotenv').config()
const CryptoJS = require("crypto-js");
const request = require('request-promise');
const { createECDH } = require('crypto-browserify');
const { InstanceDataStore } = require('blockstack/lib/auth/sessionStore');
const { AppConfig, UserSession, lookupProfile } = require('blockstack');
const { encryptECIES, decryptECIES } = require('blockstack/lib/encryption');
let mnemonic;
let serverPublicKey;

const headers = { 'Content-Type': 'application/json' };

module.exports = {
  nameLookUp: function(name) {
    const options = { url: `${process.env.NAME_LOOKUP_URL}${name}`, method: 'GET' };
    return request(options)
    .then(async () => {
      return {
        pass: false,
        message: "name taken"
      }
    })
    .catch(error => {
      if(error.error === '{\n  "status": "available"\n}\n') {
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
  makeKeychain: async function(username, keypair) {
    //Send the username and the passphrase which will be used by the server to encrypt sensitive data
    const { publicKey, privateKey } = keypair
    const dataString = JSON.stringify({
      publicKey,
      username
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
  makeAppKeyPair: async function(keychain, appObj, clientKeyPair) {
    //encrypt the mnemonic with the key sent by the server
    const { privateKey, publicKey } = clientKeyPair
    const decryptedData = JSON.parse(await decryptECIES(privateKey, JSON.parse(keychain)));
    serverPublicKey = decryptedData.publicKey;
    mnemonic = decryptedData.mnemonic;
    const encryptedMnemonic = await encryptECIES(serverPublicKey, mnemonic);
    //Config for the post
    const dataString = JSON.stringify({
      publicKey,
      id: decryptedData.ownerKeyInfo.idAddress,
      url: appObj.appOrigin,
      mnemonic: encryptedMnemonic
    })
    var options = { url: process.env.DEV_APP_KEY_URL, method: 'POST', headers: headers, body: dataString };
    return request(options)
    .then((body) => {
      console.log(body)
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
      const clientTransmitKeys = createECDH('secp256k1')
      clientTransmitKeys.generateKeys()
      const clientPrivateKey = clientTransmitKeys.getPrivateKey('hex').toString()
      const clientPublicKey = clientTransmitKeys.getPublicKey('hex', 'compressed').toString()
      const keyPair = {
          privateKey: clientPrivateKey,
          publicKey: clientPublicKey
      }

      const keychain = await this.makeKeychain(credObj.id, keyPair);

      //Step Three
      const appKeys = await this.makeAppKeyPair(keychain.body, appObj, keyPair);
      const encryptedKeys = appKeys.body.split('encrypted ')[1];
      const decryptedKeys = await decryptECIES(clientPrivateKey, JSON.parse(encryptedKeys))
      const appPrivateKey = JSON.parse(decryptedKeys).private;
      //Step Four
      const userSessionParams = {
        fetchFromDB: false,
        credObj,
        appObj,
        userPayload: {
          privateKey: appPrivateKey
        }
      }
      try {
        const userSession = await this.login(userSessionParams);
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
  login: async function(params) {
    let userPayload;
    //params object should include the credentials obj, appObj, (optional) user payload with appKey and mnemonic and (optional) a bool determining whether we need to fetch data from the DB
    //@params fetchFromDB is a bool. Should be false if account was just created
    //@params credObj is simply the username and password
    //@params appObj is provided by the developer and is an object containing app scopes and app origin
    //@params userPayload object that includes the app key and the mnemonic
    if(params.fetchFromDB) {
      //Fetch the data from the db first
      //this will get us the encrypted mnemonic
      let ciphertext = res.data.encryptedMnenomic
      //then decrypt it with the password if password is valid
      var bytes  = CryptoJS.AES.decrypt(ciphertext.toString(), credObj.pass);
      try {
        var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        var mnemonic = decryptedData;
        //Go get a transit public key
        const transitKey = await this.generateTransitKey(params.credObj, params.appObj);
        const encryptedMnenomic = encryptContent(mnemonic, transitKey);
        const keyGenPayload = {
          reference: idPayload,
          encryptedMnenomic
        }
        const appKeys = await this.makeAppKeyPair(keyGenPayload);
        //Build up an object to use for the userSession:
        const sessionObj = {
          scopes: params.appObj.scopes,
          appOrigin: params.appObj.appOrigin,
          appPrivKey: params.appKeys.body,
          hubUrl: params.credObj.hubUrl, //Still have to think through this one
          username: params.credObj.id
        }
        const userSession = await this.makeUserSession(sessionObj)
        return userSession;
      } catch(error) {
        const resFail = {
          message: "invalid password",
          body: null
        }
        return resFail
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
      if(usersession) {
        //Step five
        const encryptedMnenomic = CryptoJS.AES.encrypt(JSON.stringify(mnemonic), params.credObj.password);
        const doubleEncryptedMnemonic = await encryptECIES(serverPublicKey, encryptedMnenomic);
        const id = params.credObj.id
        const storeMnemonic = await this.storeMnemonic(id, doubleEncryptedMnemonic);
        if(storeMnemonic) {
          return userSession;
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
        username: sessionObj.username
        // profile: profileObj,  ***We will need to be returning the profile object here once we figure it out***
      }
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
  }
}
