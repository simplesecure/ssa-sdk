// TODO:  re-think. This is likely a sub-optimal way to share state w/o rerender.\
// WARNING: Order is important for this require
import * as simple from '../simple.js'
import { getLog } from './debugScopes.js'
import { getSidSvcs } from './sidServices.js';

const log = getLog('postMessage')

export async function signIn(email, password) {

  let signInFlow = undefined
  // setGlobal({ auth: true, action: "loading" });

  log.debug('DBG: Attempting to log in to Cognito Using Password Flow')
  log.debug(`DBG:  e:${email},  p:<redacted>`)
  signInFlow = await getSidSvcs().signInOrUpWithPassword(email, password)

  const sid = getSidSvcs().getSID();

  if(signInFlow === 'already-logged-in') {
    //This means a cognito token was still available
    //TODO: If we decide to blow away cognito local storage on sign out, need to revisit this
    //TODO: There's a more efficient way of handling this

    const userData = {
      orgId: sid ? sid : null
    }
    simple.storeUserData(JSON.stringify(userData))
  } else if (signInFlow === 'finish-verifying-email') {
    // TODO: refactor the code approveSignIn calls (this makes no sense and is
    //       quick appropriation of the routines in answerCustomChallenge).
    approveSignIn()
  } else {
    // setGlobal({ auth: true, action: 'sign-in-approval' })
  }
}

export async function approveSignIn(token) {
  let authenticatedUser = false
  let sid = {};
  try {
    const thisUserSignUp = await getSidSvcs().answerCustomChallenge(token)
    const { authenticated } = thisUserSignUp;
    authenticatedUser = authenticated;

    sid = getSidSvcs().getSID();
    // setGlobal({ sid });
  } catch (error) {
    // TODO: Cognito gives 3 shots at this
    // throw `ERROR: Failed trying to submit or match the code.\n${error}`
    log.error(`ERROR: Failed trying to submit or match the code:\n`)
    log.error(error)
  }

  log.debug("AUTHENTICATED USER: ", authenticatedUser);
  //TODO: @AC needs to review because this might be a place where we are revealing too much to the parent
  if (authenticatedUser) {
    const userData = {
      orgId: sid ? sid : null
    }
    simple.storeUserData(JSON.stringify(userData))
  } else {
    // TODO: something more appropriate here (i.e. try to sign-in-approval again
    //       which I think this should be doing, but it's not).
    // setGlobal({ auth: true, action: 'sign-in-approval' })
  }
}

export async function finishSignUp(sid) {
  const userData = {
    orgId: sid ? sid : null
  }

  simple.storeUserData(JSON.stringify(userData))
}
