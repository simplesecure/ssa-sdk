var CryptoJS = require("crypto-js");
//For the sake of testing, defining this here then using it later
let ciphertext;

module.exports = {
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
    createUserAccount: function(credObj) {
        //Take the credentials object and run the following in order: 
        //1: Create an obj with the results of call to makeKeychain, makeKeypair, and the user's selected id
        //2: Encrypt obj with password
        //3: Save encrypted obj to db
        
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
    }, 
    login: function(credObj) {
        //Take the credentials object and do our thing

        //Fetch the cipherText from the db first

        //then decrypt it with the password if password is valid
        var bytes  = CryptoJS.AES.decrypt(ciphertext.toString(), credObj.pass);
        try {
            var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
            const res = {
                message: "success",
                body: decryptedData
            }
            return res;
        } catch(error) {
            const resFail = {
                message: "invalid password",
                body: null
            }
            return resFail
        }
    }
}