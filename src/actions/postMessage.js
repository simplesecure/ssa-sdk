// TODO:  re-think. This is likely a sub-optimal way to share state w/o rerender.\
// WARNING: Order is important for this require
import { getSidSvcs } from '../index.js'

import connectToParent from 'penpal/lib/connectToParent';
import { getGlobal, setGlobal } from 'reactn';

import { getLog } from './../utils/debugScopes'
const log = getLog('postMessage')

const CryptoJS = require("crypto-js");
const WIDGET_KEYCHAIN = "widget-keychain";
const ethers = require('ethers');

export function closeWidget(close) {
  // TODO: is this even necessary
  const connection = getEmptyParentConnection()
  connection.promise.then(parent => {
    parent.close(close).then(() => log.debug("Closed"));
  });
}

export async function signIn() {
  const { nonSignInEvent, action } = getGlobal();
  log.debug("COGNITO FLOW: ", process.env.REACT_APP_COGNITO_FLOW);
  log.debug("COGNITO PASSWORD FLOW:", process.env.REACT_APP_COGNITO_W_PASSWORD)

  let signInFlow = undefined
  if (process.env.REACT_APP_COGNITO_W_PASSWORD === "true") {
    setGlobal({ auth: nonSignInEvent ? false : true, action: "loading" });

    log.debug('DBG: Attempting to log in to Cognito Using Password Flow')
    const { email, password } = await getGlobal()
    log.debug(`DBG:  e:${email},  p:<redacted>`)
    signInFlow = await getSidSvcs().signInOrUpWithPassword(email, password)
  } else {
    // LOL: Old-New AC Flow (Passwordless)
    setGlobal({ auth: nonSignInEvent ? false : true, action: "loading" });
    const { email } = await getGlobal();
    signInFlow = await getSidSvcs().signInOrUp(email)
  }

  // const sidSvcWalletAddr = getSidSvcs().getWalletAddress()
  // const walletAddr = sidSvcWalletAddr ? sidSvcWalletAddr : "";
  const sid = getSidSvcs().getSID();

  if(signInFlow === 'already-logged-in') {
    //This means a cognito token was still available
    //TODO: If we decide to blow away cognito local storage on sign out, need to revisit this
    //TODO: There's a more efficient way of handling this

    // TODO: is this even necessary
    const connection = getEmptyParentConnection()
    connection.promise.then(parent => {
      const userData = {
        wallet: {
          ethAddr: "walletAddr - COMING SOON" //walletAddr
        },
        orgId: sid ? sid : null
      }

      parent.storeWallet(JSON.stringify(userData)).then((res) => {
        closeWidget(true);
      })
    });
  } else if ( (process.env.REACT_APP_COGNITO_W_PASSWORD === "true") &&
              (signInFlow === 'finish-passwordless-login') ) {
    // TODO: refactor the code approveSignIn calls (this makes no sense and is
    //       quick appropriation of the routines in answerCustomChallenge).
    approveSignIn()
  } else {
    setGlobal({ auth: nonSignInEvent ? false : true, action: nonSignInEvent ? action : 'sign-in-approval' })
  }
}

export async function handlePassword(e, actionType) {
  setGlobal({ auth: actionType === "auth" ? true : false, action: "loading" });
  const { password, keychain, email } = getGlobal();
  if(actionType === "new-auth") {
    //we are encrypting the keychain and storing on the db
    const encryptedKeychain = CryptoJS.AES.encrypt(JSON.stringify(keychain), password);
    localStorage.setItem(WIDGET_KEYCHAIN, encryptedKeychain.toString());
    const payload = {
      email,
      encryptedKeychain: encryptedKeychain.toString()
    }
    //now we fire this off to the db

    // TODO: is this even necessary
    const connection = getEmptyParentConnection()
    connection.promise.then(parent => {
      parent.storeKeychain(JSON.stringify(payload)).then((res) => {
        if(res.success) {
          //Keychain has been saved.
          //Store wallet address for retreival client-side
          const userData = {
            email,
            wallet: {
              ethAddr: "walletAddr - COMING SOON" //keychain.address
            }
          }
          parent.storeWallet(JSON.stringify(userData)).then(() => {
            closeWidget(true);
          })
        } else {
          log.error('Failed to store keychain. Result:')
          log.error(res.body);
        }
      });
    });
  } else {
    const encryptedKeychain = localStorage.getItem(WIDGET_KEYCHAIN);
    //we have fetched the encrypted keychain and need to decrypt
    let eKcp = undefined
    try {
      eKcp = JSON.parse(encryptedKeychain)
    } catch (error) {
      log.error(error);
    }
    const decryptedKeychain = CryptoJS.AES.decrypt(eKcp, password);
    const parsedDecKeyChain = JSON.parse(decryptedKeychain.toString(CryptoJS.enc.Utf8));
    setGlobal({ keychain: parsedDecKeyChain });
    if(actionType === "auth") {

      // TODO: is this even necessary
      const connection = getEmptyParentConnection()
      connection.promise.then(parent => {
        const userData = {
          email,
          wallet: {
            ethAddr: "walletAddr - COMING SOON"//parsedDecKeyChain.signingKey.address
          }
        }

        parent.storeWallet(JSON.stringify(userData)).then((res) => {
          closeWidget(true);
        })
      });
    } else if(actionType === "tx") {
      return decryptedKeychain
    }
  }
}

export async function approveSignIn() {
  const { nonSignInEvent, hostedApp, config } = getGlobal();
  log.debug(nonSignInEvent);
  // WARNING:
  //  - Do not comment out the line below. For some reason, if you do
  //    the call to answerCustomChallenge will fail in the browser (the
  //    request gets cancelled). It's not clear why, but a starting point
  //    to understand this is browser optimizations within iFrames:
  //    https://stackoverflow.com/questions/12009423/what-does-status-canceled-for-a-resource-mean-in-chrome-developer-tools
  setGlobal({ auth: true, action: "loading" });
  const { token } = await getGlobal();

  let authenticatedUser = false
  let walletAddr = "";
  let wallet = {};
  let sid = {};
  let revealMnemonic = undefined;
  try {
    const thisUserSignUp = await getSidSvcs().answerCustomChallenge(token, nonSignInEvent)
    const { signUpMnemonicReveal, authenticated } = thisUserSignUp;
    authenticatedUser = authenticated;
    revealMnemonic = signUpMnemonicReveal;
    const sidSvcWalletAddr = getSidSvcs().getWalletAddress()
    walletAddr = sidSvcWalletAddr ? sidSvcWalletAddr : ""
    const sidSvcWallet = getSidSvcs().getWallet()
    wallet = sidSvcWallet ? sidSvcWallet : {}
    sid = getSidSvcs().getSID();
    setGlobal({ walletAddr, sid });
  } catch (error) {
    // TODO: Cognito gives 3 shots at this
    // throw `ERROR: Failed trying to submit or match the code.\n${error}`
    log.error(`ERROR: Failed trying to submit or match the code:\n`)
    log.error(error)
  }

  log.debug("AUTHENTICATED USER: ", authenticatedUser);
  log.debug("NON SIGN IN EVENT: ", nonSignInEvent);
  //TODO: @AC needs to review because this might be a place where we are revealing too much to the parent
  if (authenticatedUser && !nonSignInEvent) {
    let isSimpleIdApp = false
    if(config.appId === "00000000000000000000000000000000") {
      isSimpleIdApp = true
    }

    if(hostedApp === true) {
      setGlobal({ showWallet: true, loading: false });
    } else if(revealMnemonic === true && !isSimpleIdApp) {
      setGlobal({ signUpMnemonicReveal: true, loading: false, showWallet: true });
    } else if(!revealMnemonic || isSimpleIdApp) {

      // TODO: is this even necessary
      const connection = getEmptyParentConnection()
      connection.promise.then(parent => {
        const userData = {
          email: "", //TODO: remove this
          wallet: {
            ethAddr: "Wallet Addr Coming Soon"//walletAddr
          },
          orgId: sid ? sid : null
        }

        parent.storeWallet(JSON.stringify(userData)).then((res) => {
          closeWidget(true);
        })
      });
    }
  } else if(nonSignInEvent) {
    //This is where we should return the keychain for transaction handling and messaging signing events
    return wallet;
    //return authenticatedUser;
  } else {
    // TODO: something more appropriate here (i.e. try to sign-in-approval again
    //       which I think this should be doing, but it's not).
    setGlobal({ auth: true, action: 'sign-in-approval' })
  }
}

export async function finishSignUp() {
  // const { walletAddr, sid } = getGlobal();
  const { sid } = getGlobal();

  // TODO: is this even necessary
  const connection = getEmptyParentConnection()
  connection.promise.then(parent => {
    const userData = {
      email: "", //TODO: remove this
      wallet: {
        ethAddr: "walletAddr - COMING SOON" //walletAddr ? walletAddr : "ERROR WITH WALLET"
      },
      orgId: sid ? sid : null
    }

    parent.storeWallet(JSON.stringify(userData)).then((res) => {
      closeWidget(true);
    })
  });
}

export async function getTxDetails() {

  // TODO: is this even necessary
  const connection = getEmptyParentConnection()
  connection.promise.then(parent => {
    parent.getPopUpInfo().then((res) => {
      setGlobal({ txDetails: res });
    });
  });
}

export function handleHash(hash) {

  // TODO: is this even necessary
  const connection = getEmptyParentConnection()
  connection.promise.then(parent => {
    parent.displayHash(hash).then(() => {
      closeWidget(false);
    })
  });
}

export function returnSignedMessage(signedMsg) {
  log.debug("SIGNED MESSAGE FROM IFRAME");

  // TODO: is this even necessary
  const connection = getEmptyParentConnection()
  connection.promise.then(parent => {
    parent.signedMessage(signedMsg).then(() => {
      closeWidget(false);
    })
  });
}

function getEmptyParentConnection() {
  const connection = connectToParent({
    // Methods child is exposing to parent
    methods: {
      //
    }
  });

  return connection
}
