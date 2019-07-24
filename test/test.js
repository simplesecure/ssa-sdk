const assert = require('assert');
const crypto = require('crypto-browserify');
const CryptoJS = require("crypto-js");
const { encryptECIES, decryptECIES } = require('blockstack/lib/encryption');
const { AppConfig, UserSession, getFile, putFile } = require('blockstack');
const auth = require('./authTest');
const availableName = `thisismyusername_${Date.now()}`;
const emailToUse = "justin@graphitedocs.com";
const takenName = "jehunter5811";
const appObj = { appOrigin: "https://app.graphitedocs.com", scopes: ['store_write', 'publish_data']}
const credObj = {id: availableName, password: "this is my super secure password", hubUrl: "https://gaia.blockstack.org", email: emailToUse}
const clientTransmitKeys = crypto.createECDH('secp256k1')
clientTransmitKeys.generateKeys()
const clientPrivateKey = clientTransmitKeys.getPrivateKey('hex').toString()
const clientPublicKey = clientTransmitKeys.getPublicKey('hex', 'compressed').toString()
const clientKeyPair = {
    privateKey: clientPrivateKey,
    publicKey: clientPublicKey
}
// standardized username template: ‘simpleid_${username}_date.now()’

//Stand alone tests
let testKeychain

describe('User session returned', function() {
  it('should return a valid user session', async function() {
      const appPrivKey = '8681e1cdaa96c5caf0c5da4e3a49c587b6b468fce89f71bef0525d28ce5450fc';
      const hubUrl = 'https://hub.blockstack.org';
      const scopes = ['store_write'];
      const appOrigin = 'helloblockstack.com'
      const userData = {
          appPrivKey,
          hubUrl,
          scopes,
          appOrigin,
          id: credObj.id
      }
      const userSession = await auth.makeUserSession(userData);

      assert(userSession.message, "user session created");
  })
});

describe("NameLookUp", function() {
  this.timeout(7000);
  it("name should be available", async function() {
    const nameResponse = await auth.nameLookUp(availableName);
    assert.equal(nameResponse.message, 'name available');
  })
  it("name should be taken", async function() {
    const takenResponse = await auth.nameLookUp(takenName);
    assert.equal(takenResponse.message, 'name taken');
  })
})

describe('MakeKeyChain', function() {
  this.timeout(10000);
  it('should create and return a keychain', async function() {
    const keychain = await auth.makeKeychain(credObj.email, credObj.id, clientKeyPair);
    testKeychain = keychain.body;
    assert.equal(keychain.message, 'successfully created keychain');
  })
})

describe('MakeAppKeypair', function() {
  this.timeout(10000);
  it('should create and an app specific keypair', async function() {
    const appKeyParams = {
      login: false,
      username: credObj.id,
      keychain: testKeychain,
      appObj,
      keyPair: clientKeyPair
    }
    const keypair = await auth.makeAppKeyPair(appKeyParams)
    assert.equal(keypair.message, 'successfully created app keypair');
  })
})

describe('StoreEncryptedMnemonic', function() {
  this.timeout(10000);
  it('should encrypt the mnemonic with the password and the server transit key', async function() {
    const decryptedData = JSON.parse(await decryptECIES(clientKeyPair.privateKey, JSON.parse(testKeychain)))
    const serverPublicKey = decryptedData.publicKey;
    const mnemonic = decryptedData.mnemonic;
    const encryptedMnenomic = CryptoJS.AES.encrypt(JSON.stringify(mnemonic), credObj.password);
    const doubleEncryptedMnemonic = await encryptECIES(serverPublicKey, encryptedMnenomic.toString());
    const postedMnemonic = await auth.storeMnemonic(credObj.id, doubleEncryptedMnemonic);
    assert.equal(postedMnemonic.message, 'successfully stored encrypted mnemonic');
  })
})

//Account Creation
// describe('CreateAccount', function() {
//   this.timeout(10000);
//   it('should return account created message', async function() {
//       const create = await auth.createUserAccount(credObj, appObj);
//       console.log(create)
//       assert.equal(create.message,"successfully created user session")
//   });
// });
//
//
// //Log In
// describe('LogIn', function() {
//   this.timeout(10000);
//   it('kick off recovery flow with email, username, and password', async function() {
//     const params = {
//       login: true,
//       credObj,
//       appObj,
//       userPayload: {}
//     }
//     const loggedIn = await auth.login(params);
//     assert(loggedIn.message, "user session created");
//   })
// });

//BlockstackJS Operations

// describe("Storage, putFile", function() {
//   this.timeout(10000);
//   it("should build up a user session and store the file", async function() {
//     const appPrivKey = '8681e1cdaa96c5caf0c5da4e3a49c587b6b468fce89f71bef0525d28ce5450fc';
//     const hubUrl = 'https://hub.blockstack.org';
//     const scopes = ['store_write'];
//     const appOrigin = 'helloblockstack.com'
//     const userData = {
//         appPrivKey,
//         hubUrl,
//         scopes,
//         appOrigin,
//         id: credObj.id
//     }
//     const session = await auth.makeUserSession(userData);
//     const appConfig = new AppConfig(
//       ['store_write'],
//       'helloblockstack.com' /* your app origin */
//     )
//     const userSession = new UserSession({ appConfig, sessionStore: session.body.store.sessionData });
//     userSession.putFile("hello.json", "hello world", {encrypt: false})
//       .then((res) => {
//         console.log(res);
//       }).catch(err => console.log(err));
//   })
// })
