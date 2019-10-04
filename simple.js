import { updateProfile, handleAuth } from './simpleidapi/actions';
import { nameLookUp, registerSubdomain, makeUserSession } from './blockstack/actions';
const request = require('request-promise');
const config = require('./config.json');
const keys = require('./keys.json');
const infuraKey = keys.INFURA_KEY;
const Web3 = require('web3');
let headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
let web3;
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
        body: error
      }
    });
}

export default class SimpleID {
  constructor(params) {
    this.config = params;
    this.network = params.network;
    this.apiKey = params.apiKey;
    this.devId = params.devId;
    this.scopes = params.scopes;
    this.appOrigin = params.appOrigin;
    this.provider = new Web3.providers.HttpProvider(this.network === "local" ? 'http://localhost:7545' : `https://${this.network}.infura.io/v3/${infuraKey}`);
  }
  getProvider() {
    return this.provider;
  }
  getUserData() {
    return JSON.parse(localStorage.getItem('SimpleID-User-Session'));
  }

  async authenticate(payload, options={}) {
    payload.config = this.config;
    const statusCallbackFn = options.hasOwnProperty('statusCallbackFn') ? options['statusCallbackFn'] : undefined
  
    if (statusCallbackFn) {
      statusCallbackFn("Checking email address...");
    }
  
    const account = await handleAuth(payload);
    if(account.body) {
      //Set local storage to ensure user session exists
      localStorage.setItem('SimpleID-User-Session', JSON.stringify(account.body.wallet));
    }
    return account;
  }

  async createContract(account, bytecode) {
    web3 = new Web3(this.getProvider());
    let txObject;
    await web3.eth.getTransactionCount(account, async (err, txCount) => {
      try {
        // Build the transaction
        txObject = {
          from: account,
          nonce:    web3.utils.toHex(txCount),
          value:    web3.utils.toHex(web3.utils.toWei('0', 'ether')),
          gasLimit: web3.utils.toHex(2100000),
          gasPrice: web3.utils.toHex(web3.utils.toWei('6', 'gwei')),
          data: bytecode  
        }
      } catch (error) {
        console.log(error);
        return {success: false, body: error};
      }
    });
    return {success: true, body: txObject};
  }

  async deployContract(params) {
    const { devId, development, network } = this.config;
    const { email, abi, bytecode, code, constructor } = params;
    const payload = JSON.stringify({
      devId,
      email, 
      network,
      abi,
      bytecode,
      code,
      constructor, 
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

  async signTransaction(payload) {
    headers['Authorization'] = payload.apiKey;
    var options = { url: config.SIGN_TX, method: 'POST', headers: headers, body: JSON.stringify(payload) };
    try {
      const postData = await postToApi(options);
      return postData;
    } catch(error) {
      return { success: false, body: error }
    }
  }

  async generateApproval(params) {
    const { email, fromEmail, txObject } = params;
    const { devId, development, network } = this.config;
    const estimate = await web3.eth.estimateGas(txObject);
    const approvalObj = JSON.stringify({
      email,
      fromEmail,
      gasEst: estimate, 
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
    if(status.blockNumber) {
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
