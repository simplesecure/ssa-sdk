const assert = require('assert');
const crypto = require('crypto-browserify');
//const { AppConfig, UserSession, getFile, putFile } = require('blockstack');
const auth = require('./authTest');
const availableName = `username_${Date.now()}`;
const emailToUse = "justin@graphitedocs.com";
const appObj = { 
  appOrigin: "https://app.graphitedocs.com", 
  scopes: ['store_write', 'publish_data'], 
  apiKey: "-LmBW1g7xQCtaPGaVN7T", 
  devId: "ID-13CYqQGJYu13tXSgFTup4sFQY8rSjgqdAQ"
}
const credObj = {id: availableName, password: "super secure password", hubUrl: "https://gaia.blockstack.org", email: emailToUse}
const credObjLogIn = {id: "testing12348572634", password: "this is a test password", hubUrl: "https://gaia.blockstack.org", email: "justin.edward.hunter@gmail.com"}
//We'll need to add profile signing and storage tests in the near future
// let sampleProfile = require('./sampleProfile.json');
// let signedProfileData;

//Stand alone tests
let testKeychain

// describe('User session returned', function() {
//   it('should return a valid user session', async function() {
//       const appPrivKey = '8681e1cdaa96c5caf0c5da4e3a49c587b6b468fce89f71bef0525d28ce5450fc';
//       const hubUrl = 'https://hub.blockstack.org';
//       const scopes = ['store_write'];
//       const appOrigin = 'helloblockstack.com'
//       const userData = {
//           appPrivKey,
//           hubUrl,
//           scopes,
//           appOrigin,
//           id: credObj.id
//       }
//       const userSession = await auth.makeUserSession(userData);
//       assert(userSession.message, "user session created");
//   })
// });

// describe("NameLookUp", function() {
//   this.timeout(7000);
//   it("name should be available", async function() {
//     const nameResponse = await auth.nameLookUp(availableName);
//     assert.equal(nameResponse.message, 'name available');
//   })
//   it("name should be taken", async function() {
//     const takenResponse = await auth.nameLookUp(takenName);
//     assert.equal(takenResponse.message, 'name taken');
//   })
// })

// describe('MakeKeyChain', function() {
//   this.timeout(10000);
//   it('should create and return a keychain', async function() {
//     const keychain = await auth.makeKeychain(credObj);
//     console.log(keychain);
//     assert.equal(keychain.message, 'successfully created keychain');
//   })
// })

// describe('Make dev keychain', function() {
//   const config = {
//     development: true
//   }
//   this.timeout(10000);
//   it('should create and return a keychain for new dev sign ups', async function() {
//     const keychain = await auth.makeKeychain(credObj, config);
//     console.log(keychain);
//     assert.equal(keychain.message, 'successfully created keychain');
//   })
// })

// describe('Update config', function() {
//   this.timeout(10000);
//   it('should properly update the dev config', async function() {
//     const updates = {
//       userId: "ID-1NVgM7H7axuuBgfc2Hr8TbQV3JfqKBvxji",
//       username: "username_1565723789639",
//       verificationID: "-LmBPGcCWk465gHOBNWB", 
//       config: {
//         accountInfo: {
//           isCurrent: false
//         }, 
//         isUpgraded: false, 
//         isVerified: true
//       },
//       development: true
//     }
//     const configUpdate = await auth.updateConfig(updates, true);
//     console.log(configUpdate);
//     assert.equal(configUpdate.message, 'updated developer account');
//   })
// })

//Account Creation
describe('CreateAccount', function() {
  this.timeout(10000);
  it('should return account created message', async function() {
      const create = await auth.createUserAccount(credObj, appObj);
      console.log(create)
      assert.equal(create.message,"user session created")
  });
});

// describe('CreateDevAccount', function() {
//   this.timeout(10000);
//   const config = {
//     appOrigin: "https://app.graphitedocs.com", 
//     scopes: ['store_write', 'publish_data'], 
//     isDev: true, 
//     development: true
//   }
//   it('should return account created message', async function() {
//       const create = await auth.createUserAccount(credObj, config);
//       console.log(create)
//       assert.equal(create.message,"user session created")
//   });
// });


// //Log In
// describe('LogIn', function() {
//   this.timeout(10000);
//   it('kick off recovery flow with email, username, and password', async function() {
//     const params = {
//       credObj: credObjLogIn,
//       appObj,
//       userPayload: {}
//     }
//     const loggedIn = await auth.login(params);
//     console.log(loggedIn);
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
