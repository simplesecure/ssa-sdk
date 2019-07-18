require('dotenv').config()
const CryptoJS = require("crypto-js");
const request = require('request-promise');
const crypto = require('crypto-browserify');

const { AppConfig, InstanceDataStore, UserSession, Profile } = require('blockstack');
const { encryptECIES, decryptECIES } = require('blockstack/lib/encryption');
let idPayload;

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
    //Commented out for testing.
    // const clientTransmitKeys = crypto.createECDH('secp256k1')
    // clientTransmitKeys.generateKeys()
    // const clientPrivateKey = clientTransmitKeys.getPrivateKey('hex').toString()
    // const clientPublicKey = clientTransmitKeys.getPublicKey('hex', 'compressed').toString()
    // const keyPair = {
    //     priv: clientPrivateKey,
    //     pub: clientPublicKey
    // }

    //Store to device storage (web = localStorage, mobile = device, etc)
    //Now we send the username and the passphrase which will be used by the server to encrypt sensitive data
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
      console.log("\n\nCLIENT KEYCHAIN")
      const decryptedData = await decryptECIES(privateKey, JSON.parse(body))
      console.log('\nDecrypted Keychain: ', decryptedData);
      console.log('\n')
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
    const decryptedData = JSON.parse(await decryptECIES(privateKey, JSON.parse(keychain)))
    const mnemonic = decryptedData.mnemonic;
    const encryptedMnemonic = await encryptECIES(decryptedData.publicKey, mnemonic);
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
    const nameCheck = await this.nameLookUp(credObj.id);
    if(nameCheck.pass) {
      const keychain = await this.makeKeychain();
      const transitKey = await this.generateTransitKey(credObj, appObj);
      //encrypt the mnemonic and send it off to the server
      const encryptedMnenomic = encryptContent(keychain.body.mnemonic, transitKey);
      const keyGenPayload = {
        reference: idPayload,
        encryptedMnenomic
      }
      const appKeys = await this.makeAppKeyPair(keyGenPayload);
      if(appKeys) {
        return {
          message: "account successfully created",
          body: {
            menmonic: keychain.body.mnemonic,
            appPrivKey: appKeys.privKey
          }
        }
      } else {
        return {
          message: "could not create account",
          body: null
        }
      }
    } else {
      return {
        message: nameCheck.message,
        body: null
      }
    }
  },
  // login: async function(params) {
  //   let userPayload;
  //   //params object should include the credentials obj, appObj, (optional) user payload with appKey and mnemonic and (optional) a bool determining whether we need to fetch data from the DB
  //   //@params fetchFromDB is a bool. Should be false if account was just created
  //   //@params credObj is simply the username and password
  //   //@params appObj is provided by the developer and is an object containing app scopes and app origin
  //   //@params userPayload object that includes the app key and the mnemonic
  //   if(params.fetchFromDB) {
  //     //Fetch the data from the db first
  //     //this will get us the encrypted mnemonic
  //     let ciphertext = res.data.encryptedMnenomic
  //     //then decrypt it with the password if password is valid
  //     var bytes  = CryptoJS.AES.decrypt(ciphertext.toString(), credObj.pass);
  //     try {
  //       var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  //       var mnemonic = decryptedData;
  //       //Go get a transit public key
  //       const transitKey = await this.generateTransitKey(params.credObj, params.appObj);
  //       const encryptedMnenomic = encryptContent(mnemonic, transitKey);
  //       const keyGenPayload = {
  //         reference: idPayload,
  //         encryptedMnenomic
  //       }
  //       const appKeys = await this.makeAppKeyPair(keyGenPayload);
  //       //Build up an object to use for the userSession:
  //       const sessionObj = {
  //         scopes: appObj.scopes,
  //         appOrigin: appObj.appOrigin,
  //         appPrivKey: appKeys.body,
  //         hubUrl: credObj.hubUrl, //Still have to think through this one
  //         username: credObj.id
  //       }
  //       const userSession = await this.makeUserSession(sessionObj)
  //       return userSession;
  //     } catch(error) {
  //       const resFail = {
  //         message: "invalid password",
  //         body: null
  //       }
  //       return resFail
  //     }
  //   } else {
  //     userPayload = params.userPayload;
  //     const sessionObj = {
  //       scopes: appObj.scopes,
  //       appOrigin: appObj.appOrigin,
  //       appPrivKey: userPayload.appPrivKey,
  //       hubUrl: credObj.hubUrl, //Still have to think through this one
  //       username: credObj.id
  //     }
  //     const userSession = await this.makeUserSession(sessionObj)
  //     return userSession;
  //   }
  // },
  // makeUserSession: async function(sessionObj) {
  //   const appConfig = new AppConfig(
  //     sessionObj.scopes,
  //     sessionObj.appOrigin /* your app origin */
  //   )
  //   const dataStore = new InstanceDataStore({
  //     userData: {
  //       appPrivateKey: sessionObj.appPrivKey, /* A user's app private key */
  //       hubUrl: sessionObj.hubUrl,
  //       username: sessionObj.username,
  //       profile: await profile.lookupProfile(sessionObj.username),
  //     }
  //   })
  //   const userSession = new UserSession({
  //     appConfig,
  //     sessionStore: dataStore
  //   })
  //   try {
  //     return {
  //         message: "user session created",
  //         body: userSession
  //     }
  //   } catch(err) {
  //     return {
  //         message: "failed to create user session",
  //         body: err
  //     }
  //   }
  // }
}
