import React, { setGlobal, getGlobal } from 'reactn';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';
import connectToParent from 'penpal/lib/connectToParent';
import { handleData } from './actions/dataProcessing';
import { signIn } from './actions/postMessage';
import { configureDebugScopes,
         localStorageClearPreserveDebugScopes } from './utils/debugScopes'

// Global for interfacing to SID Services
// TODO: clean up
// WARNING: cant mix import and export, hence use of require here (webpack issue
//          see https://github.com/webpack/webpack/issues/4039)
// TODO: ensure scope is window local (i.e. doesn't leak out of iframe)
const sidServices = require('./utils/sidServices')

// See this site for usage and logger configuration:
//   - https://github.com/pimterry/loglevel
//
const log = require('loglevel')
configureDebugScopes()            // Configure default settings for log scopes

const connection = connectToParent({
  // Methods child is exposing to parent
  methods: {
    setDebugScopes(theDebugScopes) {
      log.info('Configuring debug scope overrides ...')
      const PERSIST_DEBUG_SCOPES=false
      configureDebugScopes(theDebugScopes, PERSIST_DEBUG_SCOPES)
    }
  }
});


connection.promise.then(parent => {
  parent.getConfig().then((config) => {
    console.log("CONFIG: ", config)
    setGlobal({ config });
  });

  parent.checkAction().then(async (action) => {
    console.log("ACTION: ", action);
    //First check if this is a sign out request
    if(Object.keys(action) && Object.keys(action)[0] === 'thisAction') {
      const { email, thisAction } = action;
      if(thisAction === 'sign-in-email-provided') {
        //This is the only case where the action comes in as an object
        //Here the developer has passed us an email address
        //This is likely from an OAuth flow
        setGlobal({ email })
        await signIn()
        return;
      }
    } else if(action === 'sign-out') {
      localStorageClearPreserveDebugScopes('index.js')
      //window.location.reload();
      parent.completeSignOut();
      return;
    } else if(action === 'sign-in-no-sid') {
      // parent.dataToProcess().then(async (userInfo) => {
      parent.userDataToProcess().then(async (userInfo) => {
        const dataToReturn = await getSidSvcs().persistNonSIDUserInfo(userInfo);
        parent.returnProcessedData(dataToReturn);
        parent.close()
      })
    } else if(action === 'process-data') {
      parent.dataToProcess().then(async (data) => {
        console.log("DATA to Process: ")
        console.log(data);
        if(data) {
          const dataToReturn = await handleData(data);
          parent.returnProcessedData(dataToReturn);
          //TODO: Fix this. Hacky solution to keep the iframe open if the data to be processed is segment data
          //If we aren't persisting the iframe, it doesn't get closed in time for the next request
          //And if it's not closed in time, the next request gets cut off when the iframe does come in
          //Here's what it looks like
          //1. Segment Data to be processed comes in
          //2. Data is processed
          //3. Data is returned
          //4. Close widget function called
          //5. Next piece of Segment Data to be processed comes in
          //6. Iframe finally closes
          //7. Segment Data to be processed is lost

          //This is a temporary solution
          if(data.type === 'update-segments') {
            data = undefined
            return
          } else {
            parent.close();
            return;
          }

        }
      })
    } else if(action === 'hosted-app') {
      //Need to check if the user is already logged into the iframe
      const wallet = getSidSvcs().getWalletAddress();
      console.log("WALLET: ", wallet);
      if(wallet) {
        //Show a blance screen with other functionality
        setGlobal({ showWallet: true });
      } else {
        setGlobal({ action: "sign-in-hosted" });
      }
      setGlobal({ hostedApp: true, action, auth: action === "transaction" || action === "message" || wallet ? false : true });
    } else  {
      //If not a sign out request, set the action appropriately
      setGlobal({ action, auth: action === "transaction" || action === "message" ? false : true });

      parent.checkType().then((type) => {
        setGlobal({ type });
      })
    }
  });
});


let sidSvcs = undefined

console.log('Created global instance of SidServices')
console.log('/////////////////////////////////////////////////////////////////')

// TODO: cleanup this workaround for initialization order errors:
export const getSidSvcs = () => {
  const { config } = getGlobal();
  const { appId } = config;

  const SID_ANALYTICS_APP_ID = appId//'00000000000000000000000000000000'

  if (!sidSvcs) {
    sidSvcs = new sidServices.SidServices(SID_ANALYTICS_APP_ID)
  }

  return sidSvcs
}

setGlobal({
  auth: true,
  action: "sign-in",
  approval: false,
  pendingToken: false,
  config: {},
  email: "",
  token: "",
  password: "",
  keychain: {},
  encrypt: false,
  txDetails: {},
  error: "",
  subaction: "",
  type: "",
  nonSignInEvent: false,
  hostedApp: false,
  showWallet: false,
  network: 'mainnet',
  signUpMnemonicReveal: false,
  walletAddr: "",
  sid: {},
  found: false
})

ReactDOM.render(<App />, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
