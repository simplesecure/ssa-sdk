import { updateProfile, handleAuth } from './simpleidapi/actions';
import { nameLookUp, registerSubdomain, makeUserSession } from './blockstack/actions';
import { UserSession, AppConfig } from 'blockstack';
const request = require('request-promise');
const config = require('./config.json');
const INFURA_KEY = "b8c67a1f996e4d5493d5ba3ae3abfb03"; //TODO: move this to the server to protect key
const LAYER2_RPC_SERVER = 'https://testnet2.matic.network';
const SIMPLEID_USER_SESSION = 'SimpleID-User-Session';
const BLOCKSTACK_DEFAULT_HUB = "https://hub.blockstack.org";
const BLOCKSTACK_SESSION = 'blockstack-session';
const Web3 = require('web3'); //TODO: remove web3 dependency
const ethers = require('ethers');
let headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
let web3;
let tx;

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
    this.localRPCServer = params.localRPCServer;
    this.network = params.network;
    this.apiKey = params.apiKey;
    this.devId = params.devId;
    this.scopes = params.scopes;
    this.appOrigin = params.appOrigin;
    this.development = params.development ? params.development : false;
    this.provider = new Web3.providers.HttpProvider(this.network === "local" ? this.localRPCServer : this.network === "layer2" ? LAYER2_RPC_SERVER : `https://${this.network}.infura.io/v3/${INFURA_KEY}`);
    web3 = new Web3(this.provider);
    headers['Authorization'] = this.apiKey;
    this.simple = ethers;
  }

  //If a developer wants to use the ethers.js library manually in-app, they can access it with this function
  simpleWeb3() {
    return this.simple;
  }

  getProvider() {
    return this.provider;
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

  async authenticate(payload, options={}) {
    const { email } = payload;
    payload.config = this.config;
    payload.url = this.appOrigin;
    const blockstackName = `${email.split('@')[0].split('.').join('_')}_simple`;
    //The statusCallbackFn is a hook for developers to give visibility about what our API is doing to users. 
    //It's a function the developer defines that changes the state on a component forcing a re-render with the message that we pass back. 
    let statusCallbackFn;
    try {
      statusCallbackFn = options.hasOwnProperty('statusCallbackFn') ? options['statusCallbackFn'] : undefined
    } catch(e) {
      console.log(e);
    }
  
    if (statusCallbackFn) {
      statusCallbackFn("Checking email address...");
    }
    const appObj = {
      scopes: this.scopes, 
      appOrigin: this.appOrigin, 
      apiKey: this.apiKey, 
      devId: this.devId, 
      development: this.development
    }
    const profile = await updateProfile(blockstackName, appObj);
    payload.profile = profile;
    const account = await handleAuth(payload);
    console.log(account);
    if(!account.success) {
      const appPrivateKey = account.blockstack ? account.blockstack.private : "";
      //Set local storage to ensure simpleid user session exists
      console.log("Setting local storage...");
      localStorage.setItem(SIMPLEID_USER_SESSION, JSON.stringify(account));
      console.log("Local storage should be set now")
      //Make blockstack user session and set it to local storage
      try {
        const userSessionParams = {
          appObj: appObj,
          userPayload: {
            privateKey: appPrivateKey,
          }
        }
        const userPayload = userSessionParams.userPayload;
        const sessionObj = {
          scopes: appObj.scopes,
          appOrigin: appObj.appOrigin,
          appPrivKey: userPayload.privateKey,
          hubUrl: this.hubUrl ? this.hubUrl : BLOCKSTACK_DEFAULT_HUB,
          username: blockstackName, //need to account for blockstack's name restrictions
          profile
        }
        const idAddress = account.blockstack.idAddress ? account.blockstack.idAddress : "";
        const userSession = await makeUserSession(sessionObj, idAddress);

        if(userSession) {
          console.log("Blockstack session created");
          //Setting the blockstack user session to local storage so the dev doesn't manually have to
          localStorage.setItem(BLOCKSTACK_SESSION, JSON.stringify(userSession.body.store.sessionData));
          return {
            message: "user session created",
            body: userSession.body
          }
        } else {
          console.log("ERROR: could not create Blockstack session")
          return {
            message: "trouble creating user session",
            body: null
          }
        }
      } catch (loginErr) {
        return {
          message: "trouble logging in",
          body: loginErr
        }
      }
    }
    return account;
  }

  signOut() {
    localStorage.removeItem('blockstack-session');
    localStorage.removeItem(SIMPLEID_USER_SESSION);
    window.location.reload();
  }

  buyCrypto(params) {
    const moonEnv = params.env === "test" ? "buy-staging" : "buy";
    const apiKey = params.env === "test" ? "pk_test_gEFnegtEHajeQURGYVxg0GjVriooNltf" : "" //TODO: enter prod key
    
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
    const { method, value, abi, address, account, email, fromEmail } = params;
    const { network, devId, development } = this.config;
    tx = params;
    tx.to = address;
    let estimate;
    //const txCount = await web3.eth.getTransactionCount(account);
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
    const { devId, development, network } = this.config;
    const { email, code, threeBox, contractTx, threeBoxTx } = params;
    const provider = new ethers.providers.Web3Provider(this.provider);
    const payload = {
      devId,
      email, 
      network,
      contractTx,
      code,
      threeBox,
      threeBoxTx, 
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

  async signTransaction(params) {
    //There are times when a message or piece of data needs to be signed but 
    //The actual data doesn't need to be broadcast on chain.
    //TODO: build this
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
