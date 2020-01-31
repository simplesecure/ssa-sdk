import { Query } from './utils/query';
import connectToChild from 'penpal/lib/connectToChild';
const log = require('loglevel')
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
const INFURA_KEY = "b8c67a1f996e4d5493d5ba3ae3abfb03";
const LAYER2_RPC_SERVER = 'https://testnet2.matic.network';
const SIMPLEID_USER_SESSION = 'SimpleID-User-Session';
const ACTIVE_SID_MESSAGE = 'active-sid-message'
const PINGED_SIMPLE_ID = 'pinged-simple-id';
const MESSAGES_SEEN = 'messages-seen'
const SIMPLEID_NOTIFICATION_FETCH = 'sid-notifications'
const ethers = require('ethers');
let headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
let thisTx;
let txSigned;
let action;
let userDataForIFrame;
let globalMethodCheck;
let notificationCheck = true;
let activeNoti = []
let pingChecked = false
let buttonEl
let messageEl

const SID_APP_ID = "00000000000000000000000000000000"

export default class SimpleID {
  constructor(params) {
    const startTimeMs = Date.now()

    this.config = params;
    this._selectedAddress = "";
    this.localRPCServer = params.localRPCServer;
    this.network = params.network;
    this.appId = params.appId;
    this.devId = params.devId;
    this.scopes = params.scopes;
    this.appOrigin = params.appOrigin;
    this.devWidget = params.devWidget
    this.development = params.development ? params.development : false;
    this.useSimpledIdWidget = params.useSimpledIdWidget
    this.activeNotifications = []
    this.provider = undefined
    this.subProvider = undefined

    // AC: Commented this out as there is no apiKey defined in this class or
    //     from what I can see, in the params.
    //     TODO: talk with Justin further
    // headers['Authorization'] = this.apiKey;
    this.ping = params.isHostedApp === true ? null : this.pingSimpleID();

    this.passUserInfoStatus = undefined

    const endTimeMs = Date.now()
    log.debug(`Simple ID constructed in ${endTimeMs - startTimeMs} ms.`)
  }

  // Separate the wallet initialization from the constructor (not used at moment)
  _initWallet() {
    //this.provider = new Web3.providers.HttpProvider(this.network === "local" ? this.localRPCServer : this.network === "layer2" ? LAYER2_RPC_SERVER : `https://${this.network}.infura.io/v3/${INFURA_KEY}`);
    ///   IF We ever want to put Infrua back in, uncomment below and comment the Radar.
    //this.subProvider = new Web3.providers.HttpProvider(this.network === "local" ? this.localRPCServer : this.network === "layer2" ? LAYER2_RPC_SERVER : `https://${this.network}.infura.io/v3/${INFURA_KEY}`);
    this.provider = this.config.appId === SID_APP_ID ? null : this._initProvider();
    this.subProvider = new Web3.providers.HttpProvider(this.network === "local" ? this.localRPCServer : this.network === "layer2" ? LAYER2_RPC_SERVER : `https://shared-geth-ropsten.nodes.deploy.radar.tech/?apikey=a356caf36d191f896bac510e685d9e231e6897fc0d0835a9`);

    //web3 = new Web3(this.provider);
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
                log.error("ERROR in send: ", error)
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
          let error;
          thisTx = {
            appName: this.config.appName,
            tx: txParams
          }
          action = 'transaction';
          const popup = await this.createPopup();
          txSigned = popup;
          cb(error, true);
        },
        signTransaction: (txParams, cb) => {
          let error;
          if(!txSigned) {
            error = "User canceled action"
          }
          cb(error, txSigned);
        },
        publishTransaction: (rawTx, cb) => {
          cb(null, rawTx);
        },
        signMessage: async (msgParams, cb) => {
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
        }
      }),
    );

    engine.addProvider(new RpcSubprovider({
      rpcUrl: `https://${this.network}.infura.io/v3/${INFURA_KEY}`,
      //rpcUrl: `https://shared-geth-ropsten.nodes.deploy.radar.tech/?apikey=a356caf36d191f896bac510e685d9e231e6897fc0d0835a9`,
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
  async notifications() {
    const notifications = await this.checkNotifications()
    return notifications
  }
  // TODO: notificationCheck probably should be scoped to the class (i.e.
  //       a class member var--not sure what it means to have it as a global
  //       or file level global)
  async checkNotifications() {
    if(notificationCheck) {
      const address = this.getUserData() ? this.getUserData().wallet.ethAddr : "";
      const appId = this.appId
      if(address) {
        const data = {
          address, appId
        }
        action = 'process-data';
        notificationCheck = false;
        let notificationsToReturn = []
        const notificationData = await this.processData('notifications', data);
        if(notificationData !== 'Error fetching app data' &&
          notificationData && notificationData.length > 0) {
          log.debug(`notificationData value = ${notificationData}`)
          log.debug(`notificationData type = ${typeof notificationData}`)
          let activeNotifications = notificationData.filter(a => a.active === true)
          //No matter what, we need to return this to the developer
          activeNoti = activeNotifications;
          //Now we check to see if there are more than one notification:
          if(activeNotifications.length > 1) {
            //Filter out the messages that have been seen
            const messagesSeen = localStorage.getItem(MESSAGES_SEEN) !== "undefined" ? JSON.parse(localStorage.getItem(MESSAGES_SEEN)) : undefined
            if(messagesSeen && messagesSeen.length > 0) {
              for (const noti of activeNotifications) {
                const foundMessage = messagesSeen.filter(a => a === noti.id)
                if(foundMessage && foundMessage.length > 0) {
                  //Don't do anything here
                } else {
                  notificationsToReturn.push(noti);
                }
              }
            } else {
              notificationsToReturn = activeNotifications
            }

            if(notificationsToReturn && notificationsToReturn.length > 0) {
              if(this.useSimpledIdWidget) {
                const messageToStore = notificationsToReturn[0]
                localStorage.setItem(ACTIVE_SID_MESSAGE, JSON.stringify(messageToStore))
                this.loadButton()
              } else {
                if(notificationsToReturn.length > 0) {
                  const updated = this._addPlainText(notificationsToReturn)
                  if(updated.lenght > 0) {
                    notificationsToReturn = updated
                  }
                }
                this.notifications = notificationsToReturn
                return notificationData
              }
            } else {
              return []
            }

          } else if(activeNotifications.length === 1) {

            //Filter out the messages that have been seen
            const messagesSeen = localStorage.getItem(MESSAGES_SEEN) !== "undefined" ? JSON.parse(localStorage.getItem(MESSAGES_SEEN)) : undefined
            if(messagesSeen && messagesSeen.length > 0) {
              for (const noti of activeNotifications) {
                const foundMessage = messagesSeen.filter(a => a === noti.id)
                if(foundMessage && foundMessage.length > 0) {
                  //Don't do anything here
                } else {
                  notificationsToReturn.push(noti);
                }
              }
            } else {
              notificationsToReturn = activeNotifications
            }
            //need to check if the developer expects us to handle the widget
            if(this.useSimpledIdWidget && notificationsToReturn.length > 0) {
              //Throw up the button for the SID widget
              const notification = notificationsToReturn[0];
              const dataToPass = {
                notification,
                appId: this.appId
              }
              localStorage.setItem(ACTIVE_SID_MESSAGE, JSON.stringify(dataToPass))
              this.loadButton()
            } else {
              if(notificationsToReturn.length > 0) {
                const updated = this._addPlainText(notificationsToReturn)
                if(updated.lenght > 0) {
                  notificationsToReturn = updated
                }
              }
              this.notifications = notificationsToReturn
              localStorage.setItem(SIMPLEID_NOTIFICATION_FETCH, JSON.stringify(notificationsToReturn))
              return notificationsToReturn
            }
          }
        } else {
          if(notificationsToReturn.length > 0) {
            const updated = this._addPlainText(notificationsToReturn)
            if(updated.lenght > 0) {
              notificationsToReturn = updated
            }
          }
          this.notifications = notificationsToReturn
          return notificationData
        }
      }
    }
  }

  async _addPlainText(notificationsToReturn) {
    let updatedNotifications = []
    for (const notification of notificationsToReturn) {
      const plainText = notification.content.replace(/(<([^>]+)>)/ig,"");
      notification['plain_text'] = plainText
      updatedNotifications.push(notification)
    }
    return updatedNotifications
  }

  createPopup(invisible, payload) {
    let iframe;
    const checkIframe = document.getElementById('sid-widget');
    if(checkIframe) {
      //No need to open a new iFrame
      iframe = checkIframe
    } else {
      const devUrl = "http://localhost:3003"
      const prodUrl = 'https://processes.simpleid.xyz'

      iframe = document.createElement('iframe');
      this.devWidget ? iframe.setAttribute('src', devUrl) : iframe.setAttribute('src', prodUrl);

      iframe.setAttribute("id", "sid-widget");
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '100vw';
      iframe.style.height = '100vh';
      iframe.style.zIndex = '1024';
      iframe.style.border = "none"
      iframe.style.background = "transparent"
    }

    if(invisible) {
      iframe.style.width = 0;
      iframe.style.height = 0;
      iframe.style.border = "none"
      iframe.style.background = "transparent"
    }

    //const scopes = this.scopes;
    const params = this.config;

    params.orgId = undefined
    try {
      params.orgId = this.getUserData().orgId
      log.debug(`org ID found in local store: ${params.orgId}.`)
    } catch (suppressedError) {
      log.debug(`org ID not found in local store: "${suppressedError}"`)
    }

    return new Promise((resolve, reject) => {
      //Launch the widget;
      const connection = connectToChild({
        // The iframe to which a connection should be made
        iframe,
        // Methods the parent is exposing to the child
        methods: {
          dataToProcess() {
            if(payload) {
              return payload;
            } else if(userDataForIFrame) {    // TODO: this code may be innefective--consider removing or moving to userDataToProcess method below
              return userDataForIFrame
            }
          },
          // userDataToProcess fixes the problem of an iframe getting re-used
          // with the same payload value from an initial call (payload is bound
          // to the function instance where userDataForIFrame binds to the parent):
          userDataToProcess() {
            return userDataForIFrame
          },
          returnProcessedData(data) {
            resolve(data);
          },
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
            const createdUser = await this.createUser(keychainData);
            return createdUser;
          },
          async fetchUser(email) {
            const user = await this.checkUser(email);
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

            const signedIn = await this.authenticate(payload);

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
          checkType() {
            return globalMethodCheck;
          },
          checkAction() {
            return action;
          },
          completeSignOut() {
            localStorageClearPreserveDebugScopes()
            window.location.reload();
          }
        }
      });

      connection.promise.then(child => {
        // Pass debug scopes from local storage of the page using this SDK to the
        // widget for dynamic debugging capapbility.
        try {
          child.setDebugScopes(getIFrameDebugScopes())
        } catch (suppressedError) {
          log.debug(`Suppressed error setting iframe attribute debugScopes.\n${suppressedError}`)
        }
      });

      document.body.appendChild(iframe);
    });
  }

  signUserIn() {
    action = "sign-in";
    this.createPopup();
  }

  //OAuth Flow Would Use This Method
  signUserInWithEmail(email) {
    const objectToSend = {
      thisAction: 'sign-in-email-provided',
      email
    }
    action = objectToSend
    this.createPopup();
  }

  /**
   *  passUserInfo:
   *
   *    Apps call this *** ONCE *** to register a user's information with
   *    simple ID.  They pass in a userInfo object which is:
   *
   *      userInfo = {
   *        email:   <an email address - optional>,
   *        address: <a wallet address - required>
   *      };
   *
   *    Calling this more than once in a session results in warnings being
   *    presented in the console unless the first call resulted in an error,
   *    in which case subsequent calls can be made until success.
   *
   *    @returns A string 'success' or an error string.
   */
  async passUserInfo(userInfo) {
    const method = 'SimpleID::passUserInfo'

    // Inexpensive test to see if this has been called already:
    //
    if (this.passUserInfoStatus) {
      const msg = `${method}: This method is only intended to be called once per session. Ignoring this call. This warning occurs when this method is called in the wrong place (i.e. the render method).`
      log.warn(msg)
      return msg
    }

    // More expensive test to see if this has been called already:
    // (sign out will clear session data, we'll need to tell devs to tie
    //  their sign out process to ours to clear this key from local storage TODO)
    let sessiondata = undefined
    try {
      sessiondata = localStorage.getItem(SIMPLEID_USER_SESSION)
      log.debug('Checking session data:')
      log.debug(sessiondata)
      if (sessiondata) {
        const msg = `${method}: This method is only intended to be called once per session. Ignoring this call. This warning occurs when this method is called in the wrong place (i.e. the render method).`
        log.warn(msg)
        return msg
      }
    } catch (suppressedError) {}

    // Check to make sure that at least the wallet address has been specified
    //
    if (!userInfo.address) {
      const msg = `${method}: This method requires a valid address property passed in through userInfo.  userInfo.address=${userInfo.address}`
      log.error(msg)
      return msg
    }

    this.passUserInfoStatus = 'processing'

    let result = undefined
    let newUser = undefined
    try {
      //Send this info to the iFrame. Don't display the iFrame though as the user/app isn't using
      //the SimpleID wallet
      const invisible = true
      action = "sign-in-no-sid";
      userDataForIFrame = userInfo;
      newUser = await this.createPopup(invisible, userInfo)
    } catch (error) {
      this.passUserInfoStatus = undefined
      const msg = `${method}: Failed registering user data.\n${error}`
      log.error(msg)
      result = msg
    }

    try {
      if (newUser) {
        localStorage.setItem(SIMPLEID_USER_SESSION, JSON.stringify(newUser))
        this.passUserInfoStatus = 'complete'
        result = 'success'
        log.info(`${method}: Succeeded.`)
      }
    } catch (error) {
      this.passUserInfoStatus = undefined
      const msg = `${method}: Failed writing session to local storage.\n${error}`
      log.error(msg)
      result = msg
    }

    if (result === 'success') {
      //TODO: need to make this happen without a refresh
      this.handleNotificationsNonSIDUser()
    }

    return result
  }

  handleNotificationsNonSIDUser() {
    setTimeout(() => {
      this.checkNotifications()
    }, 2000)
  }

  async processData(type, data) {
    action = 'process-data';
    const invisible = true;
    const payload = {
      type, data
    }
    const returnedData = await this.createPopup(invisible, payload);
    action = ""
    return returnedData;
  }

  async openHostedWidget() {
    action = 'hosted-app';
    this.createPopup();
  }

  async pingSimpleID() {
    if(pingChecked) {
      //No need to always ping
      //This is to prevent endless loops that eventually can bog down memory
      //Now we can check notifications

      //TODO: If we want to handle notifications in the engagement app, this won't fly
      if(notificationCheck) {
        this.config.appId === SID_APP_ID ? null : this.useSimpledIdWidget ? this.checkNotifications() : null;
      }
    } else {
      //Check localStorage for a flag that indicates a ping
      const pinged = JSON.parse(localStorage.getItem(PINGED_SIMPLE_ID))
      const thisOrigin = window.location.origin
      pingChecked = true
      if(pinged && pinged.date) {
        if(notificationCheck) {
          this.config.appId === SID_APP_ID ? null : this.useSimpledIdWidget ? this.checkNotifications() : null;
        }
      } else {
        //Now we need to fire off a method that will ping SimpleID and let us know the app is connected
        const data = {
          appDetails: this.config,
          date: Date.now(),
          origin: thisOrigin
        }
        //TODO: Uncomment and pick up work after web worker stuff
        try {
          await this.processData('ping', data)
          localStorage.setItem(PINGED_SIMPLE_ID, JSON.stringify(data))
          //Only when the ping is complete should we fetch notifications
          this.config.appId === SID_APP_ID ? null : this.useSimpledIdWidget ? this.checkNotifications() : null;
        } catch(e) {
          log.error("Error pinging: ", e)
        }
      }
    }
  }

  loadButton() {
    const params = this.config
    const head = document.head || document.getElementsByTagName('head')[0]
    const linkEl = document.createElement('link');
    linkEl.rel = 'stylesheet';
    linkEl.href = 'https://use.fontawesome.com/releases/v5.0.6/css/all.css';

    const bellIcon = document.createElement('i');
    bellIcon.setAttribute('class', 'far fa-bell');
    bellIcon.style.color = "#fff";
    bellIcon.style.fontSize = "20px";

    buttonEl = document.createElement('button');
    buttonEl.setAttribute('id', 'notification-button')
    buttonEl.appendChild(bellIcon);
    buttonEl.style.width = "60px";
    buttonEl.style.height = "60px";
    buttonEl.style.background = "#2568EF";
    buttonEl.style.border = "none";
    buttonEl.style.borderRadius = "50%";
    buttonEl.style.cursor = "pointer";
    buttonEl.style.boxShadow = "0 3px 7px rgba(0,0,0,0.12)"
    buttonEl.style.position = "fixed";
    buttonEl.style.zIndex = "1024";
    buttonEl.style.bottom = "15px";
    buttonEl.style.right = "15px";
    buttonEl.setAttribute('id', 'appMessageButton');
    buttonEl.onclick = function() {
      new SimpleID(params).loadMessages()
    }

    const alertDiv = document.createElement('div');
    alertDiv.style.background = "red";
    alertDiv.style.width = "8px";
    alertDiv.style.height = "8px";
    alertDiv.style.borderRadius = "50%";
    alertDiv.style.position = "absolute";
    alertDiv.style.bottom = "32px";
    alertDiv.style.right = "22px";

    buttonEl.appendChild(alertDiv);

    messageEl = document.createElement('div');
    messageEl.setAttribute('id', 'message-element')
    messageEl.style.width = "300px";
    messageEl.style.height = "85vh";
    messageEl.style.position = "fixed";
    messageEl.style.zIndex = "1024";
    messageEl.style.right = "15px";
    messageEl.style.bottom = "15px";
    messageEl.style.background = "#fff";
    messageEl.style.borderRadius = "5px";
    messageEl.style.boxShadow = "0 3px 7px rgba(0,0,0,0.12)"
    messageEl.style.paddingTop = "15px";

    const closeButton = document.createElement('button');
    closeButton.setAttribute('id', 'messagesClose');
    closeButton.style.border = "none";
    closeButton.style.position = "absolute";
    closeButton.style.right = "10px";
    closeButton.style.top = "10px";
    closeButton.style.background = "#fff";
    closeButton.style.cursor = "pointer";

    closeButton.innerText = "Dismiss";
    closeButton.onclick = function() {
      new SimpleID(params).dismissMessages();
    }

    messageEl.appendChild(closeButton);

    head.appendChild(linkEl);
    document.body.appendChild(buttonEl);
  }

  loadMessages() {
    const messageData = JSON.parse(localStorage.getItem(ACTIVE_SID_MESSAGE))
    buttonEl.style.display = "none";

    let mainDiv = document.createElement('div');
    mainDiv.style.width = '100%';
    mainDiv.style.height = '100%';
    mainDiv.style.zIndex = '1024';
    mainDiv.style.border = "none";

    let secondDiv = document.createElement('div')
    mainDiv.appendChild(secondDiv)
    secondDiv.setAttribute('class', 'message-body')
    let thirdDiv = document.createElement('div');
    thirdDiv.innerHTML = messageData.notification ? messageData.notification.content : messageData.content //TODO: this is a terrible hack
    secondDiv.appendChild(thirdDiv)

    mainDiv.style.width ="100%"
    secondDiv.style.padding = "15px"

    thirdDiv.style.fontSize = "16px"
    thirdDiv.style.marginBottom = "10px"


    messageEl.appendChild(mainDiv);
    document.body.appendChild(messageEl);
  }

  async dismissMessages() {
    //First we get the notification id
    const messageData = JSON.parse(localStorage.getItem(ACTIVE_SID_MESSAGE))
    const messageID = messageData.notification ? messageData.notification.id : messageData.id //TODO: another terrible hack
    let messagesSeen = JSON.parse(localStorage.getItem(MESSAGES_SEEN))
    if(messagesSeen && messagesSeen.length > 0) {
      messagesSeen.push(messageID)
    } else {
      messagesSeen = []
      messagesSeen.push(messageID)
    }
    localStorage.setItem(MESSAGES_SEEN, JSON.stringify(messagesSeen))
    messageEl.style.display = "none";
    //Need to hide the message but we also need to send data to the orgData table
    //Specifically need to show that this user has seen the message
    const data = {
      appData: this.config,
      address: this.getUserData().wallet.ethAddr,
      dateSeen: Date.now(),
      messageID
    }
    action = 'process-data';
    await this.processData('notification-seen', data);
    localStorage.removeItem(ACTIVE_SID_MESSAGE);
    //localStorage.setItem(ACTIVE_SID_MESSAGE, JSON.stringify(messageData));
  }

  launchWallet() {
    const url = process.env.NODE_ENV === "production" ? "https://wallet.simpleid.xyz" : "http://localhost:3002";
    const element = document.createElement('a');
    element.setAttribute('href', url);
    element.setAttribute('target', '_blank');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  //If a developer wants to use the ethers.js library manually in-app, they can access it with this function
  simpleWeb3() {
    return ethers
  }

  getProvider() {
    return this.provider;
    //return this.subProvider;
  }

  //This returns the wallet info for the SimpleID user
  getUserData() {
    return JSON.parse(localStorage.getItem(SIMPLEID_USER_SESSION));
  }

  signOut() {
    action = 'sign-out';
    this.createPopup(true, null);
  }
}


// TODO: Figure out a good way to refactor the consts below and method to a common
//       file shared with the widget (which uses these from the file debugScopes.js)
//
const ROOT_KEY = 'loglevel'
const ALLOWED_SCOPES = [ ROOT_KEY,
                        `${ROOT_KEY}:dataProcessing`,
                        `${ROOT_KEY}:postMessage`,
                        `${ROOT_KEY}:sidServices` ]
const ALLOWED_LEVELS = [ 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR' ]
const DEFAULT_LOG_LEVEL="INFO"

/**
 *  localStorageClearPreserveDebugScopes:
 *
 *  Preserves the value of debug scopes in ALLOWED_SCOPES from local storage
 *  through a clear operation.
 *
 */
export function localStorageClearPreserveDebugScopes(context='') {
  const startTimeMs = Date.now()

  // Fetch and preserve any existing debug scopes before clearing local storage:
  //
  const debugScopes = {}
  for (const scopeKey of ALLOWED_SCOPES) {
    debugScopes[scopeKey] = undefined
    try {
      const scope = localStorage.getItem(scopeKey)
      if (ALLOWED_LEVELS.includes(scope)) {
        debugScopes[scopeKey] = scope
      }
    } catch (suppressedError) {}
  }

  localStorage.clear()

  // Restore the previously existing debug scopes now that local storage is
  // cleared:
  //
  for (const scopeKey of ALLOWED_SCOPES) {
    const scope = debugScopes[scopeKey]
    if (ALLOWED_LEVELS.includes(scope)) {
      try {
        localStorage.setItem(scopeKey, scope)
      } catch (suppressedError) {}
    }
  }

  const endTimeMs = Date.now()
  log.debug(`localStorageClearPreserveDebugScopes(${context}) completed in ${endTimeMs - startTimeMs} ms.`)
}

/**
 *  getDebugScopes:
 *
 *  Fetches known debug scopes from local storage to forward to the widget
 *  iFrame for dynamic debug capability from an App Console.
 *
 *  @returns a map of the scope keys to their string values.
 */
function getIFrameDebugScopes() {
  const debugScopes = {
    [ ROOT_KEY ] : DEFAULT_LOG_LEVEL,
    [ `${ROOT_KEY}:dataProcessing` ] : DEFAULT_LOG_LEVEL,
    [ `${ROOT_KEY}:postMessage` ] : DEFAULT_LOG_LEVEL,
    [ `${ROOT_KEY}:sidServices` ] : DEFAULT_LOG_LEVEL
  }

  for (const scopeKey in debugScopes) {
    try {
      const scope = localStorage.getItem(scopeKey)
      if (ALLOWED_LEVELS.includes(scope)) {
        debugScopes[scopeKey] = scope
      }
    } catch (suppressedError) {
      log.debug(`Suppressed error fetching ${scopeKey} from local storage. Setting ${scopeKey} to default value, ${DEFAULT_LOG_LEVEL}.\n${suppressedError}`)
    }
  }

  return debugScopes
}

function setDebugScope(scopeKey, scopeLevel) {
  if (scopeKey && !scopeKey.startsWith(ROOT_KEY)) {
    scopeKey = `${ROOT_KEY}:${scopeKey}`
  }

  if (!scopeLevel) {
    scopeLevel = 'DEBUG'
  }

  if (ALLOWED_SCOPES.includes(scopeKey) && ALLOWED_LEVELS.includes(scopeLevel)) {
    localStorage.setItem(scopeKey, scopeLevel)
  }
}

function setAllDebugScopes(scopeLevel='DEBUG') {
  if (!ALLOWED_LEVELS.includes(scopeLevel)) {
    console.log(`Scope level ${scopeLevel} is not supported.  Supported levels are ${JSON.stringify(ALLOWED_LEVELS, 0, 2)}.`)
    return
  }

  const debugScopes = getIFrameDebugScopes()
  for (const scopeKey in debugScopes) {
    localStorage.setItem(scopeKey, scopeLevel)
  }

  return
}


// Workaround for queck and easy debug from browser console
//
// TODO:
//       - Analyze as exposure of security problem.
//
if (window) {
  window.sid = {
    debugScope: function(aScope, aLevel=undefined) {
      setDebugScope(aScope, aLevel)
    },
    debugAll: function() {
      "use strict";
      setAllDebugScopes();
    },
    debugOff: function() {
      "use strict";
      setAllDebugScopes('INFO');
    }
  }
}
