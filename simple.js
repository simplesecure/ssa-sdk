import { updateProfile, handleAuth } from './simpleidapi/actions';
import { nameLookUp, registerSubdomain, makeUserSession } from './blockstack/actions';
import { UserSession, AppConfig } from 'blockstack';
const request = require('request-promise');
const config = require('./config.json');
const keys = require('./keys.json');
const INFURA_KEY = keys.INFURA_KEY;
const SIMPLEID_USER_SESSION = 'SimpleID-User-Session';
const BLOCKSTACK_DEFAULT_HUB = "https://hub.blockstack.org";
const BLOCKSTACK_SESSION = 'blockstack-session';
const Web3 = require('web3');
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
        body: JSON.parse(error.error)
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
    this.provider = new Web3.providers.HttpProvider(this.network === "local" ? this.localRPCServer : `https://${this.network}.infura.io/v3/${INFURA_KEY}`);
    web3 = new Web3(this.provider);
    headers['Authorization'] = this.apiKey;
    this.simple = ethers;
  }

  simpleWeb3() {
    return this.simple;
  }

  getProvider() {
    return this.provider;
  }
  getUserData() {
    return JSON.parse(localStorage.getItem(SIMPLEID_USER_SESSION));
  }

  getBlockstackSession() {
    const appConfig = new AppConfig(this.scopes);
    const userSession = new UserSession({ appConfig });
    return userSession;
  }

  async authenticate(payload, options={}) {
    const { email } = payload;
    payload.config = this.config;
    const statusCallbackFn = options.hasOwnProperty('statusCallbackFn') ? options['statusCallbackFn'] : undefined
  
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
    const profile = await updateProfile(payload.email, appObj);
    payload.profile = profile;
    const account = await handleAuth(payload);
    console.log(account);
    if(account.body) {
      const appPrivateKey = account.body.wallet ? account.body.wallet.blockstack ? account.body.wallet.blockstack.private : "" : "";
      //Set local storage to ensure simpleid user session exists
      localStorage.setItem(SIMPLEID_USER_SESSION, JSON.stringify(account.body.wallet));
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
          username: `${email.split('@')[0].split('.').join('_')}_simple`, //need to account for blockstack's name restrictions
          profile
        }
        const idAddress = account.body.wallet ? account.body.wallet.blockstack.idAddress ? account.body.wallet.blockstack.idAddress : "" : "";
        const userSession = await makeUserSession(sessionObj, idAddress);

        if(userSession) {
          console.log("Blockstack session created");
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

  async fetchContract(abi, address) {
    const provider = new ethers.providers.Web3Provider(this.provider);
    //const contract = await new web3.eth.Contract(abi, address);
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
      console.log(error);
      return {success: false, body: error};
    }
  }

  async createContractTransaction(params) {
    const { method, value, abi, address, account, email, fromEmail } = params;
    const { network, devId, development } = this.config;
    tx = params;
    tx.to = address;
    const txCount = await web3.eth.getTransactionCount(account);
    const provider = new ethers.providers.Web3Provider(this.provider);
    let contract = new ethers.Contract(address, abi, provider);
    const estimate = await contract.estimate[method](value);
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
      abi: tx.abi, //transaction stored in memory
      bytecode: tx.data, //transaction stored in memory
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

  async signTransaction(params) {
    const { devId, development, network } = this.config;
    const { email, code, threeBox, txObject, contractTx } = params;
    const provider = new ethers.providers.Web3Provider(this.provider);
    const payload = {
      devId,
      email, 
      network,
      txObject,
      code,
      threeBox,
      development: development ? true : false
    }
    headers['Authorization'] = this.apiKey;
    var options = { url: config.SIGN_TX, method: 'POST', headers: headers, body: JSON.stringify(payload) };
    try {
      const postData = await postToApi(options);
      console.log(postData.body.body);
      const broadcast = await provider.sendTransaction(postData.body.body);
      console.log(broadcast);
      //const sendingTx = await web3.eth.sendSignedTransaction(postData.body.body);
      //console.log(sendingTx);
      if(broadcast.hash) {
        return { 
          success: true, 
          body: broadcast
        }
      } else {
        return { 
          success: false, 
          body: broadcast
        }
      }
    } catch(error) {
      return { success: false, body: error }
    }
  }

  async generateApproval(params) {
    const { email, fromEmail, txObject } = params;
    const { devId, development, network } = this.config;
    const provider = new ethers.providers.Web3Provider(this.provider);
    const estimate = await provider.estimateGas(txObject)//await web3.eth.estimateGas(txObject);
    const approvalObj = JSON.stringify({
      email,
      fromEmail,
      gasEst: estimate.toNumber(), 
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
    const status = await web3.eth.getTransaction(tx);
    console.log(status);
    if(status && status.blockNumber) {
      return "Mined";
    } else {
      return "Not mined"
    }
  }

  async pinContent(params) {
    const payload = JSON.stringify({
      devId: params.devId,
      username: params.username,
      devSuppliedIdentifier: params.id,
      contentToPin: params.content,
      development: params.development ? true : false
    })
    headers['Authorization'] = params.apiKey;
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
      devId: params.devId,
      username: params.username,
      devSuppliedIdentifier: params.id,
      development: params.development ? true : false
    })
    headers['Authorization'] = params.apiKey;
    var options = { url: config.FETCH_PINNED_CONTENT_URL, method: 'POST', headers: headers, body: payload };
    try {
      const postData = await postToApi(options);
      return postData;
    } catch(error) {
      return { success: false, body: error }
    }
  }

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
}
