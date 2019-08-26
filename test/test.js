const assert = require('assert');
const crypto = require('crypto-browserify');
//const { AppConfig, UserSession, getFile, putFile } = require('blockstack');
const auth = require('./authTest');
const availableName = `username_${Date.now()}`;
const takenName = 'justin';
const emailToUse = "testemail@mailinator.com";
const appObj = {
  appOrigin: "https://app.graphitedocs.com",
  scopes: ['store_write', 'publish_data'],
  apiKey: "-LmCb96-TquOlN37LpM0",
  devId: "imanewdeveloper",
  development: true,
  storageModules: ['blockstack', 'ethereum', 'textile'],
  authModules: ['blockstack', 'pinata']
}
const credObj = {id: availableName, password: "super secure password", hubUrl: "https://gaia.blockstack.org", email: emailToUse}
const credObjLogIn = {id: "", password: "super secure password", hubUrl: "https://gaia.blockstack.org", email: "justin.edward.hunter@gmail.com"}
//For Ethereum
const contractAddress = "0x4f7DE17889C29c9F2482B017d467a481cE3376C0";
const abi = [
  "event ValueChanged(address indexed author, string oldValue, string newValue)",
  "constructor(string value)",
  "function getValue() view returns (string value)",
  "function setValue(string value)"
];
const bytecode = "0x608060405234801561001057600080fd5b506040516105bd3803806105bd8339" +
"8101604081815282518183526000805460026000196101006001841615020190" +
"91160492840183905293019233927fe826f71647b8486f2bae59832124c70792" +
"fba044036720a54ec8dacdd5df4fcb9285919081906020820190606083019086" +
"9080156100cd5780601f106100a2576101008083540402835291602001916100" +
"cd565b820191906000526020600020905b815481529060010190602001808311" +
"6100b057829003601f168201915b505083810382528451815284516020918201" +
"9186019080838360005b838110156101015781810151838201526020016100e9" +
"565b50505050905090810190601f16801561012e578082038051600183602003" +
"6101000a031916815260200191505b5094505050505060405180910390a28051" +
"610150906000906020840190610157565b50506101f2565b8280546001816001" +
"16156101000203166002900490600052602060002090601f0160209004810192" +
"82601f1061019857805160ff19168380011785556101c5565b82800160010185" +
"5582156101c5579182015b828111156101c55782518255916020019190600101" +
"906101aa565b506101d19291506101d5565b5090565b6101ef91905b80821115" +
"6101d157600081556001016101db565b90565b6103bc806102016000396000f3" +
"0060806040526004361061004b5763ffffffff7c010000000000000000000000" +
"0000000000000000000000000000000000600035041663209652558114610050" +
"57806393a09352146100da575b600080fd5b34801561005c57600080fd5b5061" +
"0065610135565b60408051602080825283518183015283519192839290830191" +
"85019080838360005b8381101561009f57818101518382015260200161008756" +
"5b50505050905090810190601f1680156100cc57808203805160018360200361" +
"01000a031916815260200191505b509250505060405180910390f35b34801561" +
"00e657600080fd5b506040805160206004803580820135601f81018490048402" +
"8501840190955284845261013394369492936024939284019190819084018382" +
"80828437509497506101cc9650505050505050565b005b600080546040805160" +
"20601f6002600019610100600188161502019095169490940493840181900481" +
"0282018101909252828152606093909290918301828280156101c15780601f10" +
"610196576101008083540402835291602001916101c1565b8201919060005260" +
"20600020905b8154815290600101906020018083116101a457829003601f1682" +
"01915b505050505090505b90565b604080518181526000805460026000196101" +
"00600184161502019091160492820183905233927fe826f71647b8486f2bae59" +
"832124c70792fba044036720a54ec8dacdd5df4fcb9285918190602082019060" +
"60830190869080156102715780601f1061024657610100808354040283529160" +
"200191610271565b820191906000526020600020905b81548152906001019060" +
"200180831161025457829003601f168201915b50508381038252845181528451" +
"60209182019186019080838360005b838110156102a557818101518382015260" +
"200161028d565b50505050905090810190601f1680156102d257808203805160" +
"01836020036101000a031916815260200191505b509450505050506040518091" +
"0390a280516102f49060009060208401906102f8565b5050565b828054600181" +
"600116156101000203166002900490600052602060002090601f016020900481" +
"019282601f1061033957805160ff1916838001178555610366565b8280016001" +
"0185558215610366579182015b82811115610366578251825591602001919060" +
"01019061034b565b50610372929150610376565b5090565b6101c991905b8082" +
"1115610372576000815560010161037c5600a165627a7a723058202225a35c50" +
"7b31ac6df494f4be31057c7202b5084c592bdb9b29f232407abeac0029";

//For Pinata
const pinBody = {
  id: "12345",
  title: "This is another test",
  content: "Heyo heyo heyo heyo"
}
//Stand alone tests
let testKeychain

describe('User session returned', function() {
  this.timeout(7000);
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
      console.log(userSession);
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
    const keychain = await auth.makeKeychain(credObj, appObj);
    console.log(keychain);
    assert.equal(keychain.message, 'successfully created keychain');
  })
})

//NOTE: As of now, this will never work from automated tests 
//since it requires an origin to be received by the server

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

//NOTE: Need to explore ways to automate the testing of this since the address we test 
//with here won't have ether yet

// describe('Create Contract', function() {
//   const config = {
//     development: true
//   }
//   this.timeout(10000);
//   it('should create a contract and return the contract hash and address', async function() {
//     const params = {
//       development: true,
//       username: "username_1565978003511",
//       password: credObj.password, //your user's password
//       devId: appObj.devId, //available in your dev account user interface
//       apiKey: appObj.apiKey, //available in your dev account user iterface
//       abi, //the abi you/your user created in building the smart contract
//       bytecode //the compiled bytecode from solidity
//     }
//     const contract = await auth.createContract(params);
//     console.log(contract);
//     assert.equal(contract.message, 'contract created and deployed');
//   })
// })

describe('Fetch Contract', function() {
  this.timeout(10000);
  it('should fetch and execute a contract', async function() {
    const params = {
      development: true,
      devId: appObj.devId,
      apiKey: appObj.apiKey,
      contractAddress,
      abi
    }
    const contract = await auth.fetchContract(params);
    console.log(contract);
    assert.equal(contract.message, 'retreived contract and executed');
  })
})

describe('Pin Content', function() {
  this.timeout(10000);
  it('should pin content to IPFS and return a hash', async function() {
    const params = {
      devId: appObj.devId,
      username: "graphite",
      id: "12345",
      content: pinBody,
      apiKey: appObj.apiKey,
      development: true
    }

    const pinnedContent = await auth.pinContent(params);
    console.log(pinnedContent);
    assert.equal(pinnedContent.message, 'content successfully pinned');
  })
});

describe('Fetch Pinned Content', function() {
  this.timeout(10000);
  it('should fetch content from IPFS', async function() {
    const params = {
      devId: appObj.devId,
      username: "graphite",
      id: "12345",
      apiKey: appObj.apiKey,
      development: true
    }

    const pinnedContent = await auth.fetchPinnedContent(params);
    console.log(pinnedContent);
    assert.equal(pinnedContent.message, 'Found pinned content');
  })
});


//NOTE: This cannot be run from the automated tests since the server expects an origin
// describe('Update config', function() {
//   this.timeout(10000);
//   it('should properly update the dev config', async function() {
//     const updates = {
//       username: "imanewdeveloper",
//       apiKey: "-LmCb96-TquOlN37LpM0",
//       verificationID: "-LmCb96-TquOlN37LpM0",
//       config: {
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

//NOTE: This cannot be run from the automated tests since the server expects an origin
// describe('Get config', function() {
//   this.timeout(10000);
//   it('should properly get the dev config', async function() {
//     const params = {
//       devId: "imanewdeveloper",
//       development: true,
//       apiKey: "-LmCb96-TquOlN37LpM0"
//     }
//     const getConfig = await auth.getConfig(params);
//     console.log(getConfig);
//     assert.equal(getConfig.message, 'get developer account config');
//   })
// })

//Account Creation
describe('CreateAccount', function() {
  this.timeout(10000);
  it('should return account created message', async function() {
      const create = await auth.createUserAccount(credObj, appObj);
      credObjLogIn.id = credObj.id;
      console.log(create)
      assert.equal(create.message,"user session created")
  });
});

//NOTE: This cannot be run from the automated tests since the server expects an origin
// describe('CreateDevAccount', function() {
//   this.timeout(10000);
//   const config = {
//     appOrigin: "https://app.graphitedocs.com",
//     scopes: ['store_write', 'publish_data'],
//     isDev: true,
//     apiKey: "-LmCb96-TquOlN37LpM0",
//     devId: "imanewdeveloper",
//     development: true
//   }
//   it('should return account created message', async function() {
//       const create = await auth.createUserAccount(credObj, config);
//       console.log(create)
//       assert.equal(create.message,"user session created")
//   });
// });


//Log In
describe('LogIn', function() {
  this.timeout(10000);
  it('kick off recovery flow with email, username, and password', async function() {
    const params = {
      credObj: credObjLogIn,
      appObj,
      userPayload: {}
    }
    const loggedIn = await auth.login(params);
    console.log(loggedIn);
    assert(loggedIn.message, "user session created");
  })
});

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
