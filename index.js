var CryptoJS = require("crypto-js");
var config = require('blockstack/lib/auth/appConfig');
var store = require('blockstack/lib/auth/sessionStore');
var session = require('blockstack/lib/auth/userSession');
var profile = require('blockstack/lib/profiles/profileLookup');
//For the sake of testing, defining this here then using it later
let ciphertext;

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
    makeKeychain: function() {
        //This is a simple call to replicate blockstack's make keychain function
        return {
            id: 123,
            key: 123456778,
            type: "Master"
        }
    }, 
    makeAppKeyPair: function() {
        //Make the app-specific pub/priv keypair
        return {
            pub: 1234,
            priv: 123456788
        }
    }, 
    createUserAccount: async function(credObj) {
        //Take the credentials object and run the following in order: 
        //1: Create an obj with the results of call to makeKeychain, makeKeypair, and the user's selected id
        //2: Encrypt obj with password
        //3: Save encrypted obj to db
        const nameCheck = await this.nameLookUp(credObj.id);
        if(nameCheck.pass) {
            var data = {
                keyChain: this.makeKeychain(), 
                keyPair: this.makeAppKeyPair(), 
                id: credObj.id
            }
       
            // Encrypt
            ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), credObj.pass);
            
            //Save to DB here
    
            //TODO: Determine if and how we should send the keychain info to the client
            
            //We're returning this to the client so the app can use it to log in
            return {
                message: "account created", 
                body: ciphertext
            }
        } else {
            return {
                message: nameCheck.message,
                body: null
            }
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
    },
    login: async function(credObj, appObj) {
        //Take the credentials object and an appObj and do our thing
        // @credObj is simply the username and password
        // @appObj is provided by the developer and is an object containing app scopes and app origin

        //Fetch the cipherText from the db first


        //then decrypt it with the password if password is valid
        var bytes  = CryptoJS.AES.decrypt(ciphertext.toString(), credObj.pass);
        try {
            var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
            //Build up an object to use for the userSession: 
            const sessionObj = {
                scopes: appObj.scopes,
                appOrigin: appObj.appOrigin, 
                appPrivKey: decryptedData.appPrivKey,
                hubUrl: decryptedData.hubUrl,
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
    }
}