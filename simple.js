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
const BLOCKSTACK_DEFAULT_HUB = "https://hub.blockstack.org";
const BLOCKSTACK_SESSION = 'blockstack-session';
const ethers = require('ethers');
let headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
let tx;
let thisTx;
let txSigned;
let action;
//const version = "0.5.0";
let iframe = document.createElement('iframe');
iframe.setAttribute('src', 'http://localhost:3003');
iframe.setAttribute("id", "sid-widget");
iframe.style.position = 'fixed';
iframe.style.top = '0';
iframe.style.left = '0';
iframe.style.width = '100vw';
iframe.style.height = '100vh';

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
    this.subProvider = new Web3.providers.HttpProvider(this.network === "local" ? this.localRPCServer : this.network === "layer2" ? LAYER2_RPC_SERVER : `https://${this.network}.infura.io/v3/${INFURA_KEY}`);
    //web3 = new Web3(this.provider);
    headers['Authorization'] = this.apiKey;
    this.simple = ethers;
  }

  _initProvider() {
    const engine = new ProviderEngine();
    const query = new Query(engine);

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
          var message = `The Portis Web3 object does not support synchronous methods like ${
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
        web3_clientVersion: `Portis/v${this.config.version}/javascript`,
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
          console.log(address);
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
          let error = "canceled";
          thisTx = {
            appName: this.config.appName, 
            tx: txParams
          }
          action = 'transaction';
          const popup = await this.createPopup();
          console.log(popup);   
          txSigned = popup;  
          cb(error, popup);
        }, 
        signTransaction: async (txParams, cb) => {
          return txSigned;
        },
        signMessage: async (msgParams, cb) => {
          let error = "canceled";
          console.log("Message tx ", msgParams);
          console.log("Decoding: ", web3.utils.toUtf8(msgParams.data))
          thisTx = {
            appName: this.config.appName, 
            tx: msgParams
          }
          action = "message";
          const popup = await this.createPopup();
          cb(error, popup);
        },
        signPersonalMessage: async (msgParams, cb) => {
          let error;
          console.log("Message tx ", msgParams);
          console.log("Decoding: ", web3.utils.toUtf8(msgParams.data))
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
      }),
    );

    engine.addProvider({
      setEngine: _ => _,
      handleRequest: async (payload, next, end) => {
        let result;
  
          
        engine.networkVersion = this.network;
        result = this.network;
        end("", result);
      },
    });

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

  createPopup() {
    console.log(action);
    const scopes = this.scopes;
    const params = this.config;
    return new Promise(function(resolve, reject) {
      //Launch the widget;
    const connection = connectToChild({
      // The iframe to which a connection should be made
      iframe,
      // Methods the parent is exposing to the child
      methods: {
        getPopUpInfo() {
          //This is where we can pass the tx details
          return thisTx;
        }, 
        getConfig(){
          return params;
        }, 
        storeWallet(userData) {
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
          action = "";
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);

          }
          if(reload) {
            window.location.reload();
          }
          resolve();
        },
        checkAction() {
          console.log("ACTION FROM SDK: ", action)
          return action;
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

  //This returns the blockstack-specific user-session. Example usage in-app: 
  //const userSession = simple.getBlockstackSession();
  //userSession.putFile(FILE_NAME, FILE_CONTENT);
  
  getBlockstackSession() {
    const appConfig = new AppConfig(this.scopes);
    const userSession = new UserSession({ appConfig });
    return userSession;
  }

  checkForApproval(txParams, email) {
    //
  }

  async createUser(userData) {
    const { network, devId, development } = this.config;
    let parsedData = JSON.parse(userData);
    console.log(parsedData)
    const { email, encryptedKeychain } = parsedData;
    //Check if the user exists in the DB. Based on email address
    const payload = JSON.stringify({
      email,
      encryptedKeychain, 
      network, 
      devId, 
      development
    });
    var options = { url: config.CREATE_USER_URL, method: 'POST', headers: headers, body: payload };
    try {
      const postData = await postToApi(options);
      return postData
    } catch(error) {
      return { success: false, body: error }
    }
  }

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
    localStorage.removeItem('blockstack-session');
    localStorage.removeItem(SIMPLEID_USER_SESSION);
    window.location.reload();
  }

  buyCrypto(params) {
    //const moonEnv = params.env === "test" ? "buy-staging" : "buy";
    //const apiKey = params.env === "test" ? "pk_test_gEFnegtEHajeQURGYVxg0GjVriooNltf" : "" //TODO: enter prod key
    const moonEnv = "test";
    const apiKey = "pk_test_gEFnegtEHajeQURGYVxg0GjVriooNltf";
    const div = document.createElement("DIV");
    const closeButton = document.createElement("span");
    const iFrame = document.createElement("iframe");
    iFrame.setAttribute('src', `https://${moonEnv}.moonpay.io/?apiKey=${apiKey}&currencyCode=${params.currency}&walletAddress=${params.address}&baseCurrency=${params.baseCurrency}&email=${params.email}`);
    iFrame.setAttribute('height', "500");
    div.appendChild(closeButton);
    div.appendChild(iFrame);
    div.style.display = "block";
    div.style.background = "#fff";
    div.style.border = "1px #eee solid";
    div.style.borderRadius = "5px";
    div.style.padding = "20px";
    div.style.paddingTop = "35px";
    div.style.position = "fixed";
    div.style.bottom = "10px";
    div.style.right = "10px";
    div.style.zIndex = "1024";
    closeButton.innerText = "Close";
    closeButton.style.position = "absolute";
    closeButton.style.top = "5px";
    closeButton.style.right = "15px";
    closeButton.style.cursor = "pointer";
    closeButton.addEventListener('click', () => {
      div.style.display = "none";
    })
    document.body.appendChild(div);
    //const envi = params.env === "test" ? "testwyre" : "sendwyre";
    //window.location.replace(`https://pay.${envi}.com/purchase?destCurrency=${params.currency}&dest=${params.address}&paymentMethod=${params.method}&redirectUrl=${params.redirectUrl}`)
  }

  async fetchContract(abi, address) {
    const provider = new ethers.providers.Web3Provider(this.provider);
    let contract = new ethers.Contract(address, abi, provider);
    return contract;
  }

  async createContract(payload) {
    const { email, fromEmail, account, bytecode, abi } = payload;
    const txCount = await web3.eth.getTransactionCount(account);
    try {
      // Build the transaction
      tx = {
        from: account,
        nonce:    txCount,
        gasLimit: 21000,
        gasPrice: ethers.utils.bigNumberify("20000000000"),
        data: bytecode, 
        type: "contract", 
        abi  
      }
      const params = {
        email, 
        fromEmail, 
        txObject: tx
      }
      const approval = await this.generateApproval(params);
      if(approval.success) {
        return approval;
      } else {
        return {
          success: false, 
          body: approval.body
        }
      }
    } catch (error) {
      console.log("ERROR", error);
      return {success: false, body: error};
    }
  }

  async createContractTransaction(params) {
    const { method, value, abi, address, email, fromEmail } = params;
    const { network, devId, development } = this.config;
    tx = params;
    tx.to = address;
    let estimate;
    const provider = new ethers.providers.Web3Provider(this.provider);
    let contract = new ethers.Contract(address, abi, provider);
    if(value instanceof Array) {
      estimate = await contract.estimate[method](...value);
    } else {
      estimate = await contract.estimate[method](value);
    }

    const approvalObj = JSON.stringify({
      email,
      fromEmail,
      gasEst: estimate.toNumber(), 
      tx, 
      network, 
      devId, 
      development
    });
    var options = { url: config.SEND_TX_APPROVAL, method: 'POST', headers: headers, body: approvalObj };
    try {
      const postData = await postToApi(options);
      return postData.body;
    } catch(error) {
      return { success: false, body: error }
    }
  }

  async deployContract(params) {
    const { devId, development, network } = this.config;
    const { email, code, constructor } = params;
    const payload = JSON.stringify({
      devId,
      email, 
      network,
      // abi: tx.abi, //transaction stored in memory
      // bytecode: tx.data, //transaction stored in memory
      code,
      constructor, //When deploying a contract it's possible that a constructor value may be passed
      development: development ? true : false
    });
    headers['Authorization'] = this.apiKey;
    var options = { url: config.CREATE_CONTRACT_URL, method: 'POST', headers: headers, body: payload };
    try {
      const postData = await postToApi(options);
      return postData.body;
    } catch(error) {
      return { success: false, body: error }
    }
  }

  async broadcastTransaction(params) {
    console.log("Broadcasting...")
    const { devId, development, network } = this.config;
    const { email, code, threeBox, contractTx, threeBoxTx, contract } = params;
    //const provider = new ethers.providers.Web3Provider(this.provider);
    const payload = {
      devId,
      email, 
      network,
      contractTx,
      code,
      threeBox,
      threeBoxTx, 
      contract,
      development: development ? true : false
    }
    headers['Authorization'] = this.apiKey;
    var options = { url: config.BROADCAST_TX, method: 'POST', headers: headers, body: JSON.stringify(payload) };
    try {
      const postData = await postToApi(options);
      return {
        success: true, 
        body: postData.body
      }
    } catch(error) {
      return { success: false, body: error }
    }
  }

  async signTx(email, code) {
    const { devId, development, network } = this.config;
    const payload = JSON.stringify({
      email,
      network, 
      devId, 
      code, 
      development
    });
    headers['Authorization'] = this.apiKey;
    var options = { url: config.SIGN_TX, method: 'POST', headers: headers, body: payload };
    try {
      const postData = await postToApi(options);
      return postData.body;
    } catch(error) {
      return { success: false, body: error }
    }
  }

  async generateApproval(params) {
    const { email, fromEmail, txObject } = params;
    const { devId, development, network } = this.config;
    const provider = new ethers.providers.Web3Provider(this.provider);
    
    //const estimate = await provider.estimateGas(txObject)//await web3.eth.estimateGas(txObject);
    const approvalObj = JSON.stringify({
      email,
      fromEmail,
      //gasEst: estimate.toNumber(), 
      tx: txObject, 
      network, 
      devId, 
      development
    });
    headers['Authorization'] = this.apiKey;
    var options = { url: config.SEND_TX_APPROVAL, method: 'POST', headers: headers, body: approvalObj };
    try {
      const postData = await postToApi(options);
      return postData.body;
    } catch(error) {
      return { success: false, body: error }
    }
  }

  async pollForStatus(tx) {
    //TODO: Need to convert this to the ethers.js equivalent
    const status = await web3.eth.getTransaction(tx);
    console.log(status);
    if(status && status.blockNumber) {
      return "Mined";
    } else {
      return "Not mined"
    }
  }

  //TODO: Pinata support needs significant upgrades
  async pinContent(params) {
    const payload = JSON.stringify({
      devId: this.devId,
      email: params.email,
      devSuppliedIdentifier: params.id,
      contentToPin: params.content,
      development: this.development ? true : false
    })
    headers['Authorization'] = this.apiKey;
    var options = { url: config.PIN_CONTENT_URL, method: 'POST', headers: headers, body: payload };
    try {
      const postData = await postToApi(options);
      return postData;
    } catch(error) {
      return { success: false, body: error }
    }
  }

  async fetchPinnedContent(params) {
    const payload = JSON.stringify({
      devId: this.devId,
      email: params.email,
      devSuppliedIdentifier: params.id,
      development: this.development ? true : false
    })
    headers['Authorization'] = this.apiKey;
    var options = { url: config.FETCH_PINNED_CONTENT_URL, method: 'POST', headers: headers, body: payload };
    try {
      const postData = await postToApi(options);
      return postData;
    } catch(error) {
      return { success: false, body: error }
    }
  }

  //***Dev App Specific Functions***//
  async getConfig(params) {
    const payload = JSON.stringify({
      devId: params.devId,
      development: params.development ? true : false
    });
    headers['Authorization'] = params.apiKey;
    var options = { url: config.GET_CONFIG_URL, method: 'POST', headers: headers, body: payload };
    try {
      const postData = await postToApi(options);
      return postData;
    } catch(error) {
      return { success: false, body: error }
    }
  }

  async updateConfig(updates, verification) {
    const payload = JSON.stringify({
      devId: updates.username,
      config: updates.config,
      development: updates.development ? true : false
    });
    if(verification) {
      headers['Authorization'] = updates.verificationID;
    } else {
      headers['Authorization'] = updates.apiKey;
    }
    var options = { url: config.UPDATE_CONFIG_URL, method: 'POST', headers: headers, body: payload };
    try {
      const postData = await postToApi(options);
      return postData;
    } catch(error) {
      return { success: false, body: error }
    }
  }
  //*******//
    
  async blockstackNameCheck(name) {
    const nameAvailable = await nameLookUp(name);
    return nameAvailable;
  }

  async registerBlockstackSubdomain(name, idAddress) {
    try {
      const registered = await registerSubdomain(name, idAddress);
      return registered;
    } catch(error) {
      return {
        success: false, body: error
      }
    }
  }

  async createBlockstackSession(params) {
    const appObj = {
      scopes: this.scopes, 
      appOrigin: this.appOrigin, 
      apiKey: this.apiKey, 
      devId: this.devId, 
      development: params.development ? params.development : false
    }
    const profile = await updateProfile(params.name, appObj);

    const sessionObj = {
      scopes: this.scopes,
      appOrigin: this.appOrigin,
      appPrivKey: params.privateKey,
      hubUrl: params.hubUrl ? params.hubUrl : "https://hub.blockstack.org",
      username: params.username,
      profile, 
      apiKey: this.apiKey, 
      configObj
    }

    try {
      const userSession = await makeUserSession(sessionObj, idAddress);
      return userSession;
    } catch(error) {
      return {success: false, body: error}
    }
  }

  threeBox() {
    return {
      send: async (data, callback) => {
        const txObject = {
          threeBox: true, 
          threeBoxTx: data.params[0], 
          email: this.getUserData().email
        }
        const signed = await this.broadcastTransaction(txObject);
        if(signed.body.success) {
          callback(null, { result: signed.body.body });
        } else {
          console.log("Error", signed)
        }
      }
    }
  }
}
