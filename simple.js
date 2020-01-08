import { updateProfile, handleAuth } from './simpleidapi/actions';
import { nameLookUp, registerSubdomain, makeUserSession } from './blockstack/actions';
import { UserSession, AppConfig } from 'blockstack';
import { Query } from './utils/query';
import connectToChild from 'penpal/lib/connectToChild';
const ProviderEngine = require('web3-provider-engine')
const CacheSubprovider = require('web3-provider-engine/subproviders/cache.js')
const FixtureSubprovider = require('web3-provider-engine/subproviders/fixture.js')
const FilterSubprovider = require('web3-provider-engine/subproviders/filters.js')
const SubscriptionsSubprovider = require('web3-provider-engine/subproviders/subscriptions')
const HookedWalletSubprovider = require('web3-provider-engine/subproviders/hooked-wallet.js')
const NonceSubprovider = require('web3-provider-engine/subproviders/nonce-tracker.js')
const RpcSubprovider = require('web3-provider-engine/subproviders/rpc.js')
const Web3 = require('web3');
const engine = new ProviderEngine()
const web3 = new Web3(engine)
const request = require('request-promise');
const config = require('./config.json');
const keys = require('./keys.json');
const INFURA_KEY = keys.INFURA_KEY;
const LAYER2_RPC_SERVER = 'https://testnet2.matic.network';
const SIMPLEID_USER_SESSION = 'SimpleID-User-Session';
const ethers = require('ethers');
let headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
let tx;
let thisTx;
let txSigned;
let action;
let globalMethodCheck;
//const version = "0.5.0";
let iframe = document.createElement('iframe');
iframe.setAttribute('src', 'http://localhost:3003');
iframe.setAttribute("id", "sid-widget");
iframe.style.position = 'fixed';
iframe.style.top = '0';
iframe.style.left = '0';
iframe.style.width = '100vw';
iframe.style.height = '100vh';
iframe.style.zIndex = '1024';

function postToApi(options) {
  return request(options)
    .then((body) => {
      return {
        success: true,
        body: JSON.parse(body)
      }
    })
    .catch(error => {
      console.log('Error: ', error);
      return {
        success: false,
        body: JSON.parse(error)
      }
    });
}

export default class SimpleID {
  constructor(params) {
    this.config = params;
    this._selectedAddress = "";
    this.localRPCServer = params.localRPCServer;
    this.network = params.network;
    this.apiKey = params.apiKey;
    this.devId = params.devId;
    this.scopes = params.scopes;
    this.appOrigin = params.appOrigin;
    this.development = params.development ? params.development : false;
    this.provider = this._initProvider();
    //this.provider = new Web3.providers.HttpProvider(this.network === "local" ? this.localRPCServer : this.network === "layer2" ? LAYER2_RPC_SERVER : `https://${this.network}.infura.io/v3/${INFURA_KEY}`);
    //this.subProvider = new Web3.providers.HttpProvider(this.network === "local" ? this.localRPCServer : this.network === "layer2" ? LAYER2_RPC_SERVER : `https://${this.network}.infura.io/v3/${INFURA_KEY}`);
    this.subProvider = new Web3.providers.HttpProvider(this.network === "local" ? this.localRPCServer : this.network === "layer2" ? LAYER2_RPC_SERVER : `https://shared-geth-ropsten.nodes.deploy.radar.tech/?apikey=a356caf36d191f896bac510e685d9e231e6897fc0d0835a9`);
    //web3 = new Web3(this.provider);
    headers['Authorization'] = this.apiKey;
    this.simple = ethers;
  }

  _initProvider() {
    const engine = new ProviderEngine();
    const query = new Query(engine);
    //const address = 

    engine.send = (payload, callback) => {
      // Web3 1.0 beta.38 (and above) calls `send` with method and parameters
      if (typeof payload === 'string') {
        return new Promise((resolve, reject) => {
          engine.sendAsync(
            {
              jsonrpc: '2.0',
              id: 42,
              method: payload,
              params: callback || [],
            },
            (error, response) => {
              if (error) {
                console.log("ERROR in send: ", error)
                reject(error);
              } else {
                resolve(response.result);
              }
            },
          );
        });
      }

      // Web3 1.0 beta.37 (and below) uses `send` with a callback for async queries
      if (callback) {
        engine.sendAsync(payload, callback);
        return;
      }

      let result = null;
      switch (payload.method) {
        case 'eth_accounts':
          result = this._selectedAddress ? [this._selectedAddress] : [];
          break;

        case 'eth_coinbase':
          result = this._selectedAddress ? [this._selectedAddress] : [];
          break;

        case 'net_version':
          result = this._network;
          break;
        case 'eth_uninstallFilter':
          engine.sendAsync(payload, _ => _);
          result = true;
          break;

        default:
          var message = `The SimpleID Web3 object does not support synchronous methods like ${
            payload.method
          } without a callback parameter.`;
          throw new Error(message);
      }

      return {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: result,
      };
    };

    engine.addProvider(
      new FixtureSubprovider({
        web3_clientVersion: `SIMPLEID/v${this.config.version}/javascript`,
        net_listening: true,
        eth_hashrate: '0x00',
        eth_mining: false,
        eth_syncing: true,
      }),
    );

    engine.addProvider(new CacheSubprovider());
    engine.addProvider(new SubscriptionsSubprovider());
    engine.addProvider(new FilterSubprovider());
    engine.addProvider(new NonceSubprovider());

    engine.addProvider({
      setEngine: _ => _,
      handleRequest: async (payload, next, end) => {
        globalMethodCheck = payload.method;
        // let result;
        // engine.networkVersion = this.network;
        // result = this.network;
        // end("", result);
        if (!payload.id) {
          payload.id = 42;
        }
        next();
      },
    });

    engine.addProvider(
      new HookedWalletSubprovider({
        getAccounts: async cb => {
          const address = this.getUserData() && this.getUserData().wallet ? this.getUserData().wallet.ethAddr : "";
          let addresses = [];
          addresses.push(address);
          const result = addresses;
          let error;
          if (result) {
            this._selectedAddress = result[0];
          } else {
            error = "Trouble getting account"
          }
          cb(error, result);
        },
        approveTransaction: async (txParams, cb) => {  
          console.log("APPROVE TX", txParams);
          let error;
          thisTx = {
            appName: this.config.appName, 
            tx: txParams
          }
          action = 'transaction';
          const popup = await this.createPopup(); 
          console.log("POPUP: ", popup);
          txSigned = popup; 
          cb(error, true);
        }, 
        signTransaction: (txParams, cb) => {          
          console.log("SIGN TX ", txParams);
          let error;
          console.log("RAWTX: ", txSigned);
          if(!txSigned) {
            error = "User canceled action"
          }
          cb(error, txSigned);
          // let error;
          // let result;
          // if(globalMethodCheck !== "eth_signTransaction") {
          //   console.log("Broadcasting...")
          //   console.log(txSigned)
          //   //web3.eth.sendSignedTransaction(txSigned);
          //   cb(error, txSigned);
          //   // setTimeout(() => {
          //   //   cb(error, txSigned);
          //   // }, 1500);
          //   // web3.eth.sendSignedTransaction(txSigned)
          //   // .on('transactionHash', (hash) => {
          //   //   console.log("SDK: ", hash);
          //   // })
          //   // .on('receipt', (receipt) => {
          //   //   console.log("SDK RECEIPT: ", receipt);
          //   //   cb(error, receipt);
          //   // })
          //   // result = sent;
          //   // cb(error, result);
          // } else {
          //   result = txSigned;
          //   cb(error, result);
          // }                       
        },
        publishTransaction: (rawTx, cb) => {
          // console.log("PUBLISH", rawTx);
          // let error;
          // return rawTx
          console.log("PUBLISHED TX: ", rawTx);
          cb(null, rawTx);
          // const sent = await web3.eth.sendSignedTransaction(rawTx)
          // console.log("SENT: ", sent);
          //cb(null, sent)
          // setTimeout(() => {
          //   cb(error, rawTx);
          // }, 2500)
        }, 
        signMessage: async (msgParams, cb) => {
          console.log("SIGN MSG");
          let error;
          thisTx = {
            appName: this.config.appName, 
            tx: msgParams
          }
          action = "message";
          const popup = await this.createPopup();
          cb(error, popup);
        },
        signPersonalMessage: async (msgParams, cb) => {
          console.log("SIGN PERSONAL MSG");
          let error;
          thisTx = {
            appName: this.config.appName, 
            tx: msgParams
          }
          action = "message";
          const popup = await this.createPopup();
          cb(error, popup);
        },
        signTypedMessage: async (msgParams, cb) => {
          const widgetCommunication = (await this.widget).communication;
          const params = Object.assign({}, msgParams, { messageStandard: 'signTypedMessage' });
          const { error, result } = await widgetCommunication.signMessage(params, this.config);
          cb(error, result);
        },
        signTypedMessageV3: async (msgParams, cb) => {
          const widgetCommunication = (await this.widget).communication;
          const params = Object.assign({}, msgParams, { messageStandard: 'signTypedMessageV3' });
          const { error, result } = await widgetCommunication.signMessage(params, this.config);
          cb(error, result);
        },
        estimateGas: async (txParams, cb) => {
          const gas = await getTxGas(query, txParams);
          cb(null, gas);
        },
        getGasPrice: async cb => {
          cb(null, '');
        },
        getTransactionCount: async (txParams, cb) => {
         const count = await web3.eth.getTransactionCount(this.getUserData() && this.getUserData().wallet ? this.getUserData().wallet.ethAddr : "") 
         cb(null, count);
         //return count;
        }
      }),
    );

    // engine.addProvider({
    //   setEngine: _ => _,
    //   handleRequest: async (payload, next, end) => {
    //     let result;
    //     let error;
    //     if(!this.network) {
    //       error = "no network provided";
    //     }
    //     //console.log("PAYLOAD: ", payload);
    //     engine.networkVersion = this.network;
    //     console.log(engine.networkVersion);
    //     result = this.network;
    //     end(error, result);
    //   },
    // });

    engine.addProvider(new RpcSubprovider({
      //rpcUrl: `https://${this.network}.infura.io/v3/${INFURA_KEY}`,
      rpcUrl: `https://shared-geth-ropsten.nodes.deploy.radar.tech/?apikey=a356caf36d191f896bac510e685d9e231e6897fc0d0835a9`,
    }))

    engine.enable = () =>
      new Promise((resolve, reject) => {
        engine.sendAsync({ method: 'eth_accounts' }, (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response.result);
          }
        });
      });

    engine.isConnected = () => {
      return true;
    };

    engine.isSimpleID = true;

    // engine.on('block', function(block){
    //   console.log('================================')
    //   console.log('BLOCK CHANGED:', '#'+block.number.toString('hex'), '0x'+block.hash.toString('hex'))
    //   console.log('================================')
    // })

    engine.on('error', error => {
      if (error && error.message && error.message.includes('PollingBlockTracker')) {
        console.warn('If you see this warning constantly, there might be an error with your RPC node.');
      } else {
        console.error(error);
      }
    });

    engine.start();
    return engine;
  }

  createPopup(invisible, payload) {
    if(invisible) {
      console.log("make it invisible")
      iframe.style.width = 0;
      iframe.style.height = 0;
    }
    //const scopes = this.scopes;
    const params = this.config;
    return new Promise(function(resolve, reject) {
      //Launch the widget;
    const connection = connectToChild({
      // The iframe to which a connection should be made
      iframe,
      // Methods the parent is exposing to the child
      methods: {
        dataToProcess() {
          console.log("From the SDK: ", payload);
          return payload;
        }, 
        getPopUpInfo() {
          //This is where we can pass the tx details
          return thisTx;
        }, 
        getConfig(){
          return params;
        }, 
        storeWallet(userData) {
          console.log("STORED WALLET: ", userData);
          localStorage.setItem(SIMPLEID_USER_SESSION, userData);
          return true;
        }, 
        signedMessage(message) {        
          resolve(message);
          //localStorage.setItem('signed-msg', JSON.stringify(message));
        }, 
        displayHash(hash) {
          resolve(hash);
        }, 
        async storeKeychain(keychainData) {
          //need to post this to the DB
          const createdUser = await new SimpleID(params).createUser(keychainData);
          return createdUser;
        },
        async fetchUser(email) {
          const user = await new SimpleID(params).checkUser(email);
          if(user.success === true) {
            return user.body;
          } else {
            return {
              success: false, 
              body: "User not found"
            }
          }
        },
        async signIn(creds){
          let payload;
          if(creds.token) {
            payload = {
              email: creds.email, 
              token: creds.token
            }
          } else {
            payload = {
              email: creds.email
            }
          }
          console.log("PAYLOAD: ", payload);
          const signedIn = await new SimpleID(params).authenticate(payload);
          console.log(signedIn);
          if(signedIn.success || signedIn.message === "user session created") {
            return true;
          } else {
            return false;
          }
        }, 
        close(reload){
          console.log("CLOSING iFRAME");
          action = "";
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);

          }
          if(reload) {
            window.location.reload();
          }
          resolve();
        },
        checkType() {
          return globalMethodCheck;
        }, 
        checkAction() {
          return action;
        }, 
        completeSignOut() {
          console.log("COMPLETE THE SIGN OUT!")
          localStorage.clear();
          window.location.reload();
        }
      }
    });
    
    connection.promise.then(child => {
      //Call Child Function
      // child.multiply(2, 6).then(total => console.log(total));
      // child.divide(12, 4).then(total => console.log(total));
    });

    document.body.appendChild(iframe);
    });
  }

  signUserIn() {
    action = "sign-in";
    this.createPopup(); 
  }

  processData(type, data) {
    const invisible = true;
    const payload = {
      type, data
    }
    this.createPopup(invisible, payload);
  }

  //If a developer wants to use the ethers.js library manually in-app, they can access it with this function
  simpleWeb3() {
    return this.simple;
  }

  getProvider() {
    return this.provider;
    //return this.subProvider;
  }

  //This returns the wallet info for the SimpleID user
  getUserData() {
    return JSON.parse(localStorage.getItem(SIMPLEID_USER_SESSION));
  }

  passUser() {
    //This is the method we should use to pass the wallet and email to SimpleID
    //TODO: Does this need to invoke the iframe? I think it probably does, but need to check with AC
  }

  // async createUser(userData) {
  //   const { network, devId, development } = this.config;
  //   let parsedData = JSON.parse(userData);
  //   console.log(parsedData)
  //   const { email, encryptedKeychain } = parsedData;
  //   //Check if the user exists in the DB. Based on email address
  //   const payload = JSON.stringify({
  //     email,
  //     encryptedKeychain, 
  //     network, 
  //     devId, 
  //     development
  //   });
  //   var options = { url: config.CREATE_USER_URL, method: 'POST', headers: headers, body: payload };
  //   try {
  //     const postData = await postToApi(options);
  //     return postData
  //   } catch(error) {
  //     return { success: false, body: error }
  //   }
  // }

  async checkUser(email) {
    const { network, devId, development } = this.config;
    //Check if the user exists in the DB. Based on email address
    const payload = JSON.stringify({
      email,
      network, 
      devId, 
      development
    });
    var options = { url: config.FETCH_USER_URL, method: 'POST', headers: headers, body: payload };
    try {
      const postData = await postToApi(options);
      return postData
    } catch(error) {
      return { success: false, body: error }
    }
  }

  signOut() {
    action = 'sign-out';
    this.createPopup(true, null);
  }
}
