var CryptoJS = require("crypto-js");
var config = require('blockstack/lib/auth/appConfig');
var store = require('blockstack/lib/auth/sessionStore');
var session = require('blockstack/lib/auth/userSession');
var profile = require('blockstack/lib/profiles/profileLookup');
var axios = require('axios');
var request = require('request');
var crypto = require('crypto-browserify');
var blockstackCrypto = require('blockstack/lib/encryption');
//For the sake of testing, defining this here then using it later
let ciphertext;
let idPayload;
var storageKeys;
require('dotenv').config()

module.exports = {
    nameLookUp: function(name) {
        if(name === "nametaken.id") { 
            return {
                pass: false,
                message: "name already taken"
            }
        } else {
            return {
                pass: true,
                message: "name available"
            }
        }
    },
    makeKeychain: async function(userId, keyPair) {
        //Generate a random passphrase: 
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
        //TODO implemtn this properly...

        //Now we send the username and the passphrase which will be used by the server to encrypt sensitive data
        const payload = {
            publicKey: keyPair.pub,
            username: userId
        }
        const config = {
            method: 'POST',
            url: process.env.DEV_KEYCHAIN_URL,
            data: payload, 
            headers: {
                'Content-Type': "application/json"
            }
          }
        //This is a simple call to replicate blockstack's make keychain function
        return axios(config)
            .then(async (res) => {
                const data = res.data.split('Client: ')[1];
                try {
                    const decryptedData = await blockstackCrypto.decryptECIES(keyPair.priv, JSON.parse(data));
                    console.log(decryptedData);
                    return {
                        message: "successfully created keychain", 
                        body: decryptedData
                    }
                } catch(error) {
                    return {
                        message: "failed to create keychain", 
                        body: error
                    }
                }  
            }).catch((err) => {
                console.log(err);
                return {
                    message: "failed to create keychain", 
                    body: err
                }
            });
    }, 
    generateTransitKey: function(credObj, appObj) {
        idPayload = {
            url: appObj.appOrigin, 
            user: credObj.id, 
            timestamp: Date.now()
        }
        return axios.post('https://trasitkeyurl.com', JSON.stringify(idPayload))
            .then((res) => {
                return {
                    message: "transit key generated", 
                    body: res.data
                }
            }).catch((err) => {
                return {
                    message: "error generating transit key", 
                    body: err
                }
            })
    }, 
    makeAppKeyPair: function(keychain, appObj, keyPair) {
        //encrypt the mnemonic with the key sent by the server
        const serverKey = JSON.parse(keychain).publicKey;
        const mnemonic = JSON.parse(keychain).mnemonic;
        const encryptedMnemonic = blockstackCrypto.encryptECIES(serverKey, mnemonic);
        //Config for the post
        const payload = {
            publicKey: keyPair.pub, 
            id: JSON.parse(keychain).ownerKeyInfo.idAddress,
            url: appObj.appOrigin, 
            mnemonic: encryptedMnemonic
        }
        var request = require('request');
        var headers = { 'Content-Type': 'application/json' };

        var dataString = JSON.stringify(payload);

        var options = { url: process.env.DEV_APP_KEY_URL, method: 'POST', headers: headers, body: dataString };

        return request(options, (error, response, body) => {
            if (!error && response.statusCode == 200) { 
                console.log(body)
                return {
                    message: "successfully created app keypair", 
                    body: body
                }
            } else {
                console.log(error);
                return {
                    message: "failed to created app keypair", 
                    body: error
                }
            };
        });
    }, 
    createUserAccount: async function(credObj, appObj) {
        //Take the credentials object and run the following in order: 
        //1. Check to see if name is available. 
        //2. If available, make a keychain
        //3. Fetch a transit public key from the server
        //4. Encrypt the mnemonic with the transit pubKey
        //5. Send identifier plus encrypted mnemonic to server
        //6. Server should send back appPrivKey
        //7. Encrypt mnemonic with password
        //8. Post password encrypted mnemonic and id to server
        //9. Return mnemonic and app key payload to the client so user can log in.
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
            ciphertext = res.data.encryptedMnenomic
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
                    scopes: appObj.scopes,
                    appOrigin: appObj.appOrigin, 
                    appPrivKey: appKeys.body,
                    hubUrl: credObj.hubUrl, //Still have to think through this one
                    username: credObj.id
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
                scopes: appObj.scopes,
                appOrigin: appObj.appOrigin, 
                appPrivKey: userPayload.appPrivKey,
                hubUrl: credObj.hubUrl, //Still have to think through this one
                username: credObj.id
            }
            const userSession = await this.makeUserSession(sessionObj)
            return userSession;
        }
    },
    makeUserSession: async function(sessionObj) {
        const appConfig = new config.AppConfig(
            sessionObj.scopes, 
            sessionObj.appOrigin /* your app origin */ 
          )
          const dataStore = new store.InstanceDataStore({ 
            userData: {
              appPrivateKey: sessionObj.appPrivKey, /* A user's app private key */
              hubUrl: sessionObj.hubUrl, 
              username: sessionObj.username,
              profile: await profile.lookupProfile(sessionObj.username), 
            }
          })
          const userSession = new session.UserSession({
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
}