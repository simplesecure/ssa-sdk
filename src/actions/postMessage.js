// TODO:  re-think. This is likely a sub-optimal way to share state w/o rerender.\
// WARNING: Order is important for this require
import { getSidSvcs } from '../index.js'

import connectToParent from 'penpal/lib/connectToParent';
import { getGlobal, setGlobal } from 'reactn';

import { getLog } from './../utils/debugScopes'
const log = getLog('postMessage')

export function closeWidget(close) {
  // TODO: is this even necessary
  const connection = getEmptyParentConnection()
  connection.promise.then(parent => {
    parent.close(close).then(() => log.debug("Closed"));
  });
}

export async function signIn() {

  let signInFlow = undefined
  setGlobal({ auth: true, action: "loading" });

  log.debug('DBG: Attempting to log in to Cognito Using Password Flow')
  const { email, password } = await getGlobal()
  log.debug(`DBG:  e:${email},  p:<redacted>`)
  signInFlow = await getSidSvcs().signInOrUpWithPassword(email, password)

  const sid = getSidSvcs().getSID();

  if(signInFlow === 'already-logged-in') {
    //This means a cognito token was still available
    //TODO: If we decide to blow away cognito local storage on sign out, need to revisit this
    //TODO: There's a more efficient way of handling this

    // TODO: is this even necessary
    const connection = getEmptyParentConnection()
    connection.promise.then(parent => {
      const userData = {
        orgId: sid ? sid : null
      }

      parent.storeUserData(JSON.stringify(userData)).then((res) => {
        closeWidget(true);
      })
    });
  } else if (signInFlow === 'finish-verifying-email') {
    // TODO: refactor the code approveSignIn calls (this makes no sense and is
    //       quick appropriation of the routines in answerCustomChallenge).
    approveSignIn()
  } else {
    setGlobal({ auth: true, action: 'sign-in-approval' })
  }
}

export async function approveSignIn() {
  // WARNING:
  //  - Do not comment out the line below. For some reason, if you do
  //    the call to answerCustomChallenge will fail in the browser (the
  //    request gets cancelled). It's not clear why, but a starting point
  //    to understand this is browser optimizations within iFrames:
  //    https://stackoverflow.com/questions/12009423/what-does-status-canceled-for-a-resource-mean-in-chrome-developer-tools
  setGlobal({ auth: true, action: "loading" });
  const { token } = await getGlobal();

  let authenticatedUser = false
  let sid = {};
  try {
    const thisUserSignUp = await getSidSvcs().answerCustomChallenge(token)
    const { authenticated } = thisUserSignUp;
    authenticatedUser = authenticated;
    
    sid = getSidSvcs().getSID();
    setGlobal({ sid });
  } catch (error) {
    // TODO: Cognito gives 3 shots at this
    // throw `ERROR: Failed trying to submit or match the code.\n${error}`
    log.error(`ERROR: Failed trying to submit or match the code:\n`)
    log.error(error)
  }

  log.debug("AUTHENTICATED USER: ", authenticatedUser);
  //TODO: @AC needs to review because this might be a place where we are revealing too much to the parent
  if (authenticatedUser) {

    const connection = getEmptyParentConnection()
    connection.promise.then(parent => {
      const userData = {
        orgId: sid ? sid : null
      }

      parent.storeUserData(JSON.stringify(userData)).then((res) => {
        closeWidget(true);
      })
    });

  } else {
    // TODO: something more appropriate here (i.e. try to sign-in-approval again
    //       which I think this should be doing, but it's not).
    setGlobal({ auth: true, action: 'sign-in-approval' })
  }
}

export async function finishSignUp() {
  const { sid } = getGlobal();

  // TODO: is this even necessary
  const connection = getEmptyParentConnection()
  connection.promise.then(parent => {
    const userData = {
      orgId: sid ? sid : null
    }

    parent.storeUserData(JSON.stringify(userData)).then((res) => {
      closeWidget(true);
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