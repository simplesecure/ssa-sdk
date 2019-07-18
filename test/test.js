const assert = require('assert');
const crypto = require('crypto-browserify');
const auth = require('../auth');
const availableName = "thisnameshouldbeavailableright.id";
const takenName = "jehunter5811.id";
const appObj = { appOrigin: "https://app.graphitedocs.com", scopes: ['store_write', 'publish_data']}

const clientTransmitKeys = crypto.createECDH('secp256k1')
clientTransmitKeys.generateKeys()
const clientPrivateKey = clientTransmitKeys.getPrivateKey('hex').toString()
const clientPublicKey = clientTransmitKeys.getPublicKey('hex', 'compressed').toString()
const clientKeyPair = {
    privateKey: clientPrivateKey,
    publicKey: clientPublicKey
}

let testKeychain;

//Stand alone tests

describe("NameLookUp", function() {
  this.timeout(5000);
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
    const keychain = await auth.makeKeychain("jehunter5811.id", clientKeyPair);
    //console.log('*****************', keychain);
    testKeychain = keychain.body;
    assert.equal(keychain.message, 'successfully created keychain');
  })
})

describe('MakeAppKeypair', function() {
  this.timeout(10000);
  it('should create and an app specific keypair', async function() {
    const keypair = await auth.makeAppKeyPair(testKeychain, appObj, clientKeyPair);
    console.log(keypair);
    assert.equal(keypair.message, 'successfully created app keypair');
  })
})

//Account Creation
// describe('CreateAccount', function() {
//   describe('AccountSuccess', function() {
//     it('should return account created message', async function() {
//         const create = await auth.createUserAccount(creds);
//         assert.equal(create.message,"account created")
//     });
//   });
//   describe('NameTaken', function() {
//       it('should not allow account to be created', async function() {
//         const creds = {id: "nametaken.id", pass: "thisisasecurepassword123!"}
//         const create = await auth.createUserAccount(creds);
//         assert.equal(create.message,"name already taken")
//       });
//   })
// });


// //Log In
// describe('LogIn', function() {
//     describe('user session returned', function() {
//         it('should return a valid user session', async function() {
//             const appPrivKey = '8681e1cdaa96c5caf0c5da4e3a49c587b6b468fce89f71bef0525d28ce5450fc';
//             const hubUrl = 'https://hub.blockstack.org';
//             const scopes = ['store_write'];
//             const appOrigin = 'helloblockstack.com'
//             const userData = {
//                 appPrivKey,
//                 hubUrl,
//                 scopes,
//                 appOrigin,
//                 id: creds.id
//             }
//             const userSession = await auth.makeUserSession(userData);

//             assert(userSession.message, "user session created");
//         })
//     });
//     describe('full login', function() {
//       it('should use supplied username and password to log in', async function() {
//         const credObj = creds;
//         const appObj = {
//           hubUrl: 'https://hub.blockstack.org',
//           scopes: ['store_write'],
//           appOrigin: 'helloblockstack.com'
//         }
//         const loggedIn = await auth.login(credObj, appObj);

//         assert(loggedIn.message, "user session created");
//       })
//     })
// });

//BlockstackJS Operations
