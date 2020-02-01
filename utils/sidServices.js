import { Auth } from 'aws-amplify'
import Amplify from 'aws-amplify';

import { walletAnalyticsDataTablePut,
         walletToUuidMapTablePut,
         organizationDataTableGet,
         organizationDataTablePut,
         unauthenticatedUuidTableQueryByEmail,
         unauthenticatedUuidTableGetByUuid,
         unauthenticatedUuidTablePut,
         unauthenticatedUuidTableAppendAppId,
         userDataTableGetEmailsFromUuid,       // TODO: get rid of me soon!
         walletToUuidMapTableGetUuids,
         walletToUuidMapTableAddCipherTextUuidForAppId,
         walletAnalyticsDataTableGetAppPublicKey,
         walletAnalyticsDataTableAddWalletForAnalytics,
         walletAnalyticsDataTableGet,
         walletToUuidMapTableGet } from './dynamoConveniences.js'

import { jsonParseToBuffer, getRandomString } from './misc.js'

import { getLog } from './debugScopes.js'
const log = getLog('sidServices')

const CONFIG = require('../config.json')

const AWS = require('aws-sdk')
const ethers = require('ethers')

// v4 = random. Might consider using v5 (namespace, in conjunction w/ app id)
// see: https://github.com/kelektiv/node-uuid
const uuidv4 = require('uuid/v4')

const SSS = require('shamirs-secret-sharing')
const Buffer = require('buffer/').Buffer  // note: the trailing slash is important!
                                          // (See: https://github.com/feross/buffer)

const eccrypto = require('eccrypto')

const USER_POOL_ID = CONFIG.PASSWORD_USER_POOL_ID

const USER_POOL_WEB_CLIENT_ID = CONFIG.PASSWORD_USER_POOL_WEB_CLIENT_ID

// TODO: clean up for security best practices
//       currently pulled from .env
//       see: https://create-react-app.dev/docs/adding-custom-environment-variables/
const amplifyAuthObj = {
  region: CONFIG.REGION,
  userPoolId: USER_POOL_ID,
  userPoolWebClientId: USER_POOL_WEB_CLIENT_ID,
  identityPoolId: CONFIG.IDENTITY_POOL_ID
}
// TODO: Prefer to use USER_SRP_AUTH but short on time.  Revisit this soon
//       so that password never leaves client.  Super important!
//   references:
//      - (here too) https://stackoverflow.com/questions/54430978/unable-to-verify-secret-hash-for-client-at-refresh-token-auth
//      - (way down in this) https://stackoverflow.com/questions/37438879/unable-to-verify-secret-hash-for-client-in-amazon-cognito-userpools
//      - https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_InitiateAuth.html
//        - https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CognitoIdentityServiceProvider.html#initiateAuth-property
//      - https://stackoverflow.com/questions/41526205/implementing-user-srp-auth-with-python-boto3-for-aws-cognito
//      - https://docs.amazonaws.cn/en_us/cognito/latest/developerguide/cognito-dg.pdf
//      - https://aws-amplify.github.io/docs/js/authentication  (section Switching Authentication Flow Type)
//      -
//      - https://stackoverflow.com/questions/49000676/aws-cognito-authentication-user-password-auth-flow-not-enabled-for-this-client
//
amplifyAuthObj['authenticationFlowType'] = 'USER_PASSWORD_AUTH'
//
// More TODO:
//      - https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_CreateUserPoolClient.html#CognitoUserPools-CreateUserPoolClient-request-PreventUserExistenceErrors
// Doesn't work:
// amplifyAuthObj['PreventUserExistenceErrors'] = 'LEGACY'
// Did this instead for the time being:
//      - https://github.com/aws-amplify/amplify-js/issues/4430

Amplify.configure({
  Auth: amplifyAuthObj
});

AWS.config.update({ region: CONFIG.REGION })


const NON_SID_WALLET_USER_INFO = "non-sid-user-info";
const SID_ANALYTICS_APP_ID = '00000000000000000000000000000000'

/*******************************************************************************
 * Configuration Switches
 ******************************************************************************/
const TEST_ASYMMETRIC_DECRYPT = true

/*******************************************************************************
 * Test Switches - Remove / Disable in Production
 ******************************************************************************/
const TEST_SIGN_USER_UP_TO_NEW_APP = false

// Local storage key for sid services data and static symmetric encryption
// key obfuscate locally stored data:
const SID_SVCS_LS_KEY = 'SID_SVCS'
//const SID_SVCS_LS_ENC_KEY = 'fsjl-239i-sjn3-wen3' TODO: AC code, do we need this? Wasn't being used
//                                                        Justin: - this is going to get used to obfuscate
//                                                                  our local store when everything's done.


// TODO: Remove this soon.  #Bicycle
function getKeyAssignments() {
  const keyIds = {
    1 : '2fe4d745-6685-4581-93ca-6fd7aff92426',
    8 : '5b70dc4d-a34a-4ff2-8c7e-56f772dbbea3',
    0 : '66d158b8-ecbd-4962-aedb-15d5dd4024ee',
    4 : '812f95c7-98d8-4eed-bd77-4b40356a90a7',
    5 : '836fb98e-3b5f-4694-925a-6ae49466af39',
    3 : '8a3fbf1d-4ad0-4dfb-bc95-daf1c2b5a840',
    7 : 'ab8e6e55-efff-4a8d-9b9c-c9e88a6fbf95',
    2 : 'ba920788-7c6a-4553-b804-958870279f53',
    6 : 'f2445d7c-2c60-4846-acf9-cc899cf3d4f1',
    9 : 'fa3e1b67-b62b-4455-a2f7-0190fb40c2c8'
  }

  const MAX_KEYS = Object.keys(keyIds).length

  // Ensure key selection isn't repeated (i.e. KFA1 !== KFA2)
  //
  const KFA1 = Math.floor(Math.random() * MAX_KEYS)
  let KFA2 = Math.floor(Math.random() * MAX_KEYS)
  if ( (KFA2 === KFA1) && (MAX_KEYS > 1) ) {
    // Choosing again to ensure different keys.
    //
    KFA2++
    if (KFA2 >= MAX_KEYS) {
      KFA2 = 0
    }
  }

  return {
    "custom:kfa1" : keyIds[KFA1],
    "custom:kfa2" : keyIds[KFA2]
  }
}


export class SidServices
{
  /**
   * constructor:
   *
   *         There is one required argument:
   *         @param anAppId is a string containing a uuid.
   *                        It is used to create and interact with user data. For
   *                        most apps this will control email preferences
   *                        from the developer and where analytics data is created
   *                        and stored. For the SimpleID analytics app this will
   *                        also result in the creation of additional data
   *                        (organization ids etc.)
   *
   * TODO (short-term, higher priority):
   *        1. Clean up / refactor the code fetching data from local storage.
   *
   */
  constructor(anAppId) {

    this.cognitoUser = undefined
    this.signUpUserOnConfirm = false
    this.keyId1 = undefined
    this.keyId2 = undefined

    this.appId = anAppId
    this.appIsSimpleId = (this.appId === SID_ANALYTICS_APP_ID )

    this.persist = {
      userUuid: undefined,
      email: undefined,
      address: undefined,
      secretCipherText1: undefined,
      secretCipherText2: undefined,
    }

    this.neverPersist = {
      wallet: undefined,
      priKey: undefined,
      password: undefined
    }


    try {
      // TODO: de-obfuscate using static symmetric encryption key SID_SVCS_LS_ENC_KEY
      const stringifiedData = localStorage.getItem(SID_SVCS_LS_KEY)
      const persistedData = jsonParseToBuffer(stringifiedData)
      if (persistedData.hasOwnProperty('email') &&
          persistedData.hasOwnProperty('address') &&
          persistedData.email && persistedData.address) {
        this.persist = persistedData
      }
    } catch (suppressedError) {
      log.info(`Unable to recover session data from local storage.\n${suppressedError}`)
    }
  }

  getEmail() {
    return this.persist.email
  }

  getAddress() {
    return this.persist.address
  }

  getSID() {
    return this.persist.sid;
  }

  getWalletAddress() {
    return this.persist.address
  }

 /**
  * signInOrUp:
  *
  * Notes:  Signing in or up is a two part process. A user enters their email
  *         which is passed to this function and then to Cognito where a
  *         challenge is generated and sent to the provided email.
  *         Our UI collects the challenge response and sends it to the method
  *         'answerCustomChallenge'.
  *
  *         In signInOrUp their are really two use cases the Cognito User already
  *         exists (signIn) or we must create them (signUp).  Either way the
  *         flow is the same, a challenge is generated and sent to the provided
  *         email. The only difference is that we do some extra work on sign up,
  *         specifically:
  *           - wallet creation
  *           - key assignment
  *           - user data creation and storage in our user data db
  *
  *         There is one required argument:
  *         @param anAppId is a string containing a uuid.
  *                        It is used to create and interact with user data. For
  *                        most apps this will control email preferences
  *                        from the developer and where analytics data is created
  *                        and stored. For the SimpleID analytics app this will
  *                        also result in the creation of additional data
  *                        (organization ids etc.)
  *         @param anEmail is string containing a user's email.
  *
  * TODO (short-term, higher priority):
  *         1. Improve error handling. See:
  *              - https:*aws-amplify.github.io/docs/js/authentication#lambda-triggers for more error handling etc.
  *
  * TODO (long-term, lower priority):
  *         1. Do we want to expand this to use phone numbers?
  *         2. Do we want to collect other information (name etc.)?
  *              - two storage options--Cognito User Pool or DB
  *
  */
  async signInOrUp(anEmail) {
    const authenticated = await this.isAuthenticated(anEmail)
    if (authenticated) {
      // If the user is already authenticated, then skip this function.
      return 'already-logged-in'
    }

    // Test to see if the user is already in our Cognito user pool. If they are
    // not in our user pool, a UserNotFoundException is thrown (we suppress that
    // error and continue to the signUp flow).
    try {
      // signIn flow:
      ///////////////
      this.cognitoUser = await Auth.signIn(anEmail)
      this.persist.email = anEmail
      return
    } catch (error) {
      if (error.code !== 'UserNotFoundException') {
        throw Error(`ERROR: Sign in attempt has failed.\n${error}`)
      }
    }

    // signUp flow:
    ///////////////
    try {
      const params = {
        username: anEmail,
        password: getRandomString(30)
      }
      await Auth.signUp(params)

      this.cognitoUser = await Auth.signIn(anEmail)

      // Local state store items for sign-up process after successfully answering
      // a challenge question:
      this.persist.email = anEmail

      this.signUpUserOnConfirm = true
    } catch (error) {
      log.error(error)
      throw Error(`ERROR: Sign up attempt has failed.\n${error}`)
    }
  }

  async signInOrUpWithPassword(anEmail, aPassword) {
    log.debug(`DBG: signInOrUpWithPassword e:${anEmail},  p:<redacted>`)

    // TODO: Can we do this here too:
    // const authenticated = await this.isAuthenticated(anEmail)
    // if (authenticated) {
    //   // If the user is already authenticated, then skip this function.
    //   return 'already-logged-in'
    // }


    // Most important doc yet:
    //   - https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-managing-errors.html
    //
    // TODO: this might be the wrong approach--might have to invert based on the end
    //       of this thread:
    //   - https://github.com/aws-amplify/amplify-js/issues/1067
    // Try to Sign In:
    //   reference: https://aws-amplify.github.io/docs/js/authentication#sign-in
    try {
      this.cognitoUser = await Auth.signIn(anEmail, aPassword)
      this.persist.email = anEmail
      return 'finish-verifying-email'
    } catch (err) {
      log.debug('DBG: signInOrUpWithPassword. Initial sign in attempt failed.')
      log.debug('Error code:', err.code)
      log.debug('Error:', JSON.stringify(err, 0, 2))

      if (err.code === 'UserNotConfirmedException') {
          // The error happens if the user didn't finish the confirmation step when signing up
          // In this case you need to resend the code and confirm the user
          // About how to resend the code and confirm the user, please check the signUp part
          try {
            await Auth.resendSignUp(anEmail)
            this.signUpUserOnConfirm = true
            this.persist.email = anEmail
            this.neverPersist.password = aPassword
            log.debug('code resent successfully');
            return 'sign-in-approval'
          } catch (ohFuck) {
            log.error(ohFuck);
            throw Error(`ERROR: Sign in attempt has failed.\n${ohFuck}`)
          }
      } else if (err.code === 'PasswordResetRequiredException') {
          // The error happens when the password is reset in the Cognito console
          // In this case you need to call forgotPassword to reset the password
          // Please check the Forgot Password part.
          // TODO:
          log.error(err);
          throw Error(`ERROR: Sign in attempt has failed.\n${err}`)
      } else if (err.code === 'NotAuthorizedException') {
          // The error happens when the incorrect password is provided
          // TODO:
          log.error(err);
          throw Error(`ERROR: Sign in attempt has failed.\n${err}`)
      } else if (err.code === 'UserNotFoundException') {
          // The error happens when the supplied username/email does not exist in the Cognito user pool
          // DO NOTHING HERE, proceed to try and sign the user up with the provided creds.
      } else {
          log.error(err);
          throw Error(`ERROR: Sign in attempt has failed.\n${err}`)
      }
    }

    // Try to Sign Up:
    //   reference:  https://aws-amplify.github.io/docs/js/authentication#sign-in
    //
    // Note:
    //        We're doing verified sign-up so this is a lot like the passwordless flow
    //        for sign-up (not sign-in). It's similar in that we collect a code from the
    //        user and pass that in to verify the email.
    try {
      // TODO: Move the key assignment to a lambda with admin priviledges on
      //       cognito UDP attributes to prevent users from mucking with the key
      //       ids.
      const keyAssignments = getKeyAssignments()

      const params = {
        username: anEmail,
        password: aPassword,
        attributes: {
          email: anEmail,
          ...keyAssignments
        },
        validationData: []
      }
      await Auth.signUp(params)

      // Unlike the other flow, we don't sign the user up yet--we wait on their
      // code and then sign them up.
      //    (TODO: it might make sense to do this differently here--i.e. make
      //           them click the verify link in the email at any time or something.)
      //
      this.persist.email = anEmail
      this.neverPersist.password = aPassword    // TODO: Look closer at this (it
                                                // might be a bad idea / way to
                                                // do this). (Doing it b/c I need
                                                // to get the password to the rest
                                                // of the signup flow in answerCustomChallenge).
      this.signUpUserOnConfirm = true
    } catch (error) {
      log.error(error)
      throw Error(`ERROR: Sign up attempt has failed.\n${error}`)
    }
  }

  /**
   * signOut:
   *
   */
  async signOut() {
    try {
      await Auth.signOut()
    } catch (error) {
      throw Error(`ERROR: Signing out encounted an error.\n${error}`)
    }
  }

  /**
   * answerCustomChallenge:
   *
   * Notes:  This is phase two of the Sign Up and Sign In processes (collectively
   *         handled in signInOrUp for phase one).
   *         By this point Cognito has issued a challenge to a user via email
   *         and they have entered that received challenge in:
   *         @param anAnswer  a string containing the user's entry for a
   *                          Cognito issued 6 digit challenge.
   *
   *         There are two use case handled in this method:
   *         1. If the user already exists, their user data is fetched from the
   *            db (and possibly local storage) and we obtain a credentials from
   *            cognito to decrypt their wallet key for them.
   *         2. The user does not already exist in which case we create a wallet
   *            for them, split it using Shamir's Secret sharing and provide it
   *            to them as well as storing it encrypted in the user db.
   *
   *         Another consideration or special case is handled here for both new
   *         users and existing users when logging in from special appId
   *         corresponding to SimpleID. In this case we add additional user data
   *         (specifically the sid field) and also want to give credentialed
   *         access to additional db tables for mapping wallets to uuids,
   *         processing analytics data, and querying organization data.
   *
   * TODO:
   *        1. Make encrypt*IdpCredentials calls concurrent and wait for them (faster).
   *        2. Make access to certain tables below restricted or more restricted,
   *           for example:
   *             - could use cognito
   *             - could use a separate policy / user (wallet to uuid map is write only)
   *
   */
  async answerCustomChallenge(anAnswer) {
    let signUpMnemonicReveal = false

    log.debug(`DBG: answerCustomChallenge password flow.`)
    // TODO: refactor this whole method to make sense if we keep the password flow stuff.
    //       (i.e. split out the common code into names that make more sense etc.).
    //
    // We only need to do this stuff here if the user is signing up,
    // otherwise we just run the rest of the flow below this entire conditional
    // block.
    //
    log.debug(`DBG: signUpUserOnConfirm: ${this.signUpUserOnConfirm}`)
    if (this.signUpUserOnConfirm) {
      // Password Cognito Flow:
      //
      // First send the confirmation code for the email.
      try {
        log.debug(`DBG: calling confirmSignUp ... e:${this.persist.email}, a:${anAnswer}`)
        await Auth.confirmSignUp(this.persist.email, anAnswer)
        log.debug('  success!')
      } catch (err) {
        // Something went wrong--possibly the confirmation code. TODO: we might
        // need to get them to re-enter it.
        log.debug(`DBG: answerCustomChallenge(password flow) failed.\n${err}`)
        throw new Error(err)
      }
      // Now sign the user in and proceed with the rest of our flow:
      try {
        log.debug(`DBG: calling signIn ... e:${this.persist.email}, p:${this.neverPersist.password}`)
        this.cognitoUser = await Auth.signIn(this.persist.email, this.neverPersist.password)
        log.debug('  success!')
      } catch (err) {
        log.debug(`DBG: answerCustomChallenge. Sign in attempt failed.\nError code:${err.code}\nError:${err}`)
        if (err.code === 'UserNotConfirmedException') {
            // The error happens if the user didn't finish the confirmation step when signing up
            // In this case you need to resend the code and confirm the user
            // About how to resend the code and confirm the user, please check the signUp part
            // TODO:
            log.error(err)
            throw new Error(err)
        } else if (err.code === 'PasswordResetRequiredException') {
            // The error happens when the password is reset in the Cognito console
            // In this case you need to call forgotPassword to reset the password
            // Please check the Forgot Password part.
            // TODO:
            log.error(err)
            throw new Error(err)
        } else if (err.code === 'NotAuthorizedException') {
            // The error happens when the incorrect password is provided
            // TODO:
            log.error(err)
            throw new Error(err)
        } else if (err.code === 'UserNotFoundException') {
            // The error happens when the supplied username/email does not exist in the Cognito user pool
            // TODO:
            log.error(err)
            throw new Error(err)
        } else {
            log.error(err)
            throw Error(`ERROR: Sign in attempt has failed.\n${err}`)
        }
      }
    }

    // The user has entered a challenge answer and no error occured. Now test
    // to see if they are authenticated into Cognito (i.e. have a valid token):
    const authenticated = await this.isAuthenticated()

    if (authenticated && this.signUpUserOnConfirm) {
      // Phase 2 of signUp flow:
      //////////////////////////
      try {
        //  -1. Update the key IDs from the token to encrypt the user's wallet
        //      with Cognito IDP such that we can't see it ever.
        //
        const keyAssignments = await this.getKeyAssignmentFromTokenAttr()
        this.keyId1 = keyAssignments['kfa1']
        this.keyId2 = keyAssignments['kfa2']

        //  0. Generate uuid
        //
        this.persist.userUuid = uuidv4()

        //  1. Generate keychain
        //
        this.neverPersist.wallet = ethers.Wallet.createRandom()
        this.persist.address = this.neverPersist.wallet.address

        //  2. SSS
        //
        const secret = Buffer.from(this.neverPersist.wallet.mnemonic)
        const shares = SSS.split(secret, { shares: 3, threshold: 2 })

        //  3. Encrypt & store private / secret user data
        //
        log.debug('DBG: encryptWithKmsUsingIdpCredentials ...')
        this.persist.secretCipherText1 =
          await this.encryptWithKmsUsingIdpCredentials(this.keyId1, shares[0])
        this.persist.secretCipherText2 =
          await this.encryptWithKmsUsingIdpCredentials(this.keyId2, shares[1])

        //  4. a)  Create and store entry in Organization Data (simple_id_org_data_v001)
        //         the this.appIsSimpleId
        //
        //
        // Special case. User is signing into Simple ID analytics and needs to be
        // part of an organization (org_id) etc. Two scenarios (only #1 is
        // supported in Jan. 21 2020 release):
        //
        //    1. User is a new customer and we are assigning them a new
        //       organization id (org_id) which will be used to collect data
        //       for their apps (identified with app ids, app_id).
        //    2. User is an associate of an organization and has been invited
        //       to work with Simple ID analytics app.  (Not supported in
        //       Jan 21. release).
        //         - Justin idea: only make this possible with query string / link
        //         - AC idea: create org_id and allow it to be deleted / backgrounded
        //                    when they join anothe org through some mechanism.
        //
        // TODO:
        //       1. Should org_id be an array of org ids? (i.e. multiple orgs
        //          like AWS allows multiple accounts)
        //       2. Should we check for a uuid collision? (unlikely, but huge
        //          security fail if happens)
        //
        const sidObj = await this.createSidObject()

        //  4. b) Create and store User Data (simple_id_auth_user_data_v001)
        //
        //  IMPORTANT: Never put wallet address in user data (the whole point
        //             is to decouple the two with a cryptographic island).
        const userDataRow = {
          // sub: <cognito idp sub>  is implicitly added to this in call to tablePutWithIdpCredentials below.
          uuid: this.persist.userUuid,
          email: this.persist.email,
          secretCipherText1: this.persist.secretCipherText1,
          secretCipherText2: this.persist.secretCipherText2,
          apps: {
            [ this.appId ] : {}             // Empty Contact Prefs Etc.
          },
          sid: sidObj,
        }

        // Write this to the user data table:
        log.debug('DBG: tablePutWithIdpCredentials ...')
        await this.tablePutWithIdpCredentials( userDataRow )

        //  4. c)  Create and store entry in Wallet to UUID map for this app
        //         (simple_id_wallet_uuid_map_v001)
        //
        log.debug('DBG: walletAnalyticsDataTableGetAppPublicKey ...')
        const appPublicKey =
          await walletAnalyticsDataTableGetAppPublicKey(this.appId)
        const userUuidCipherText =
          await eccrypto.encrypt(appPublicKey, Buffer.from(this.persist.userUuid))
        const walletUuidMapRow = {
          wallet_address: this.persist.address,
          app_to_enc_uuid_map: {
            [ this.appId ] : userUuidCipherText
          }
        }
        //
        // TODO: Make this use Cognito to get write permission to the DB (for the
        //       time being we're using an AWS_SECRET):
        log.debug('DBG: walletToUuidMapTablePut ...')
        await walletToUuidMapTablePut(walletUuidMapRow)

        //  4. d)  Create and store Wallet Analytics Data
        //         (simple_id_cust_analytics_data_v001)
        //
        // TODO (Justin+AC): Events of some sort (i.e. sign-in, sign-up, date etc.)
        //
        log.debug('DBG: walletAnalyticsDataTableAddWalletForAnalytics ...')
        await walletAnalyticsDataTableAddWalletForAnalytics(
          this.persist.address, this.appId)

        //  5. Email / Save PDF secret
        //   Setting this as true so we can return it to the approveSignIn function from postMessage.js
        //   If we don't do this, we'll have to set state in the sidServices file, which I don't think
        //   we want to do.
        //   see line 609 for how this will be returned
        signUpMnemonicReveal = true;
      } catch (error) {
        throw Error(`ERROR: signing up user after successfully answering customer challenge failed.\n${error}`)
      } finally {
        // For now abort the operation.
        // TODO: future, robust recovery process
        this.signUpUserOnConfirm = false
      }
    } else if (authenticated) {
      // Phase 2 of signIn flow:
      //////////////////////////
      // 0. Update the key IDs from the token in case we need to encrypt
      //    a public key
      const keyAssignments = await this.getKeyAssignmentFromTokenAttr()
      this.keyId1 = keyAssignments['kfa1']
      this.keyId2 = keyAssignments['kfa2']

      // 1. Fetch the encrypted secrets from Dynamo
      //
      const userDataDbRow = await this.tableGetWithIdpCredentials()
      const userData = userDataDbRow.Item
      this.persist.secretCipherText1 = userData.secretCipherText1
      this.persist.secretCipherText2 = userData.secretCipherText2

      // 2. Decrypt the secrets on the appropriate HSM KMS CMKs
      //
      const secretPlainText1 =
        await this.decryptWithKmsUsingIdpCredentials(this.persist.secretCipherText1)
      const secretPlainText2 =
        await this.decryptWithKmsUsingIdpCredentials(this.persist.secretCipherText2)

      // 3. Merge the secrets to recover the keychain
      //
      const secretMnemonic = SSS.combine([secretPlainText1, secretPlainText2])

      // 4. Inflate the wallet and persist it to state.
      //
      const mnemonicStr = secretMnemonic.toString()
      this.neverPersist.wallet = new ethers.Wallet.fromMnemonic(mnemonicStr)
      this.persist.address = this.neverPersist.wallet.address

      this.persist.userUuid = userData.uuid

      // 5. If the user has never signed into this App before, we need to update
      //    the appropriate tables with the user's data unless this is happening on the hosted-wallet side of things:
      //
    }

    if (authenticated) {
      try {
        // TODO: obfuscate using static symmetric encryption key SID_SVCS_LS_ENC_KEY
        localStorage.setItem(SID_SVCS_LS_KEY, JSON.stringify(this.persist))
      } catch (suppressedError) {
        log.error(`ERROR persisting SID services data to local store.\n${suppressedError}`)
      }
    }

    // moving the authenticated = true into an object so that we include signUpMnemonicReveal
    // this needs to be sent so that in postMessage.js we know if we need to update state accordingly
    return { authenticated, signUpMnemonicReveal }
  }

  async isAuthenticated(anEmail=undefined) {
    try {
      const session = await Auth.currentSession();

      const tokenEmail = session.idToken.email
      if (anEmail && (anEmail !== tokenEmail)) {
        throw new Error('Stored token is for different user. Returning false for isAuthenticated.')
      }

      return true;
    } catch (suppressedError) {
      log.warn(`WARN: Suppressing error in isAuthenticated.\n${suppressedError}`)
      return false;
    }
  }

  async getUserDetails() {
    try {
      if (!this.cognitoUser) {
        this.cognitoUser = await Auth.currentAuthenticatedUser()
      }
      return await Auth.userAttributes(this.cognitoUser)
    } catch (suppressedError) {
      log.warn(`WARN: Unable to get user details from token.\n${suppressedError}`)
    }
    return undefined
  }

  async getKeyAssignmentFromTokenAttr() {
    const userAttributes = await this.getUserDetails()

    // TODO: Clean this up (i.e. see if we can do direct assignment instead of a loop)
    const keyAssignments = {}
    for (const userAttribute of userAttributes) {
      if (userAttribute.getName() === 'custom:kfa1') {
        log.debug(`returning kfa1: ${userAttribute.getValue()}`)
        keyAssignments['kfa1'] = userAttribute.getValue()
      } else if (userAttribute.getName() === 'custom:kfa2') {
        log.debug(`returning kfa2: ${userAttribute.getValue()}`)
        keyAssignments['kfa2'] = userAttribute.getValue()
      }
    }

    return keyAssignments
  }



/******************************************************************************
 *                                                                            *
 * SimpleID Analytics Tool Related Methods                                    *
 *                                                                            *
 ******************************************************************************/

  /**
   * getUuidsForWalletAddresses:
   *
   * Notes: Given a list of wallet addresses for an app ID, this method
   *        fetches the uuids corresponding to the wallet addresses.
   *
   *        This method only works if this user has access to the organization
   *        private key.
   */
  async getUuidsForWalletAddresses(data) {
    const { app_id, addresses } = data;
    let uuids = []

    // 1. Fetch the encrypted uuids for the given wallet addresses and appID:
    //
    const encryptedUuids = []
    //AC Hard-coded version:
    //const encryptedUuidMaps = await walletToUuidMapTableGetUuids(theWalletAddresses)
    //Justin dynamic version:
    const encryptedUuidMaps = await walletToUuidMapTableGetUuids(addresses)
    for (const encryptedUuidMap of encryptedUuidMaps) {
      try {
        //AC Hard-coded version:
        //const cipherObj = encryptedUuidMap.app_to_enc_uuid_map[anAppId]
        //Justin dynamic version:
        const cipherObj = encryptedUuidMap.app_to_enc_uuid_map[app_id]
        encryptedUuids.push(cipherObj)
      } catch (suppressedError) {
        continue
      }
    }

    // 2. Fetch the private key required to decrypt the uuids:
    //
    // TODO:
    //      - Make this efficient (this is awful)
    let orgEcPriKey = undefined
    try {
      const orgData = await organizationDataTableGet(this.persist.sid.org_id)
      const cipherObj = orgData.Item.cryptography.pri_key_ciphertexts[this.persist.userUuid]

      const userEcPriKeyCipherText = this.persist.sid.pri_key_cipher_text
      const userEcPriKey = await this.decryptWithKmsUsingIdpCredentials(userEcPriKeyCipherText)

      orgEcPriKey = await eccrypto.decrypt(userEcPriKey, cipherObj)
    } catch (error) {
      throw new Error(`Failed to fetch user EC private key.\n${error}`)
    }

    // 3. Decrypt the encrypted uuids and return them:
    //
    for (const encryptedUuidCipherText of encryptedUuids) {
      try {
        const uuid = await eccrypto.decrypt(orgEcPriKey, encryptedUuidCipherText)
        uuids.push(uuid.toString())
      } catch (suppressedError) {
        // TODO: some message or analytic to fix / track this
      }
    }

    return uuids
  }

  /**
   * getEmailsForUuids
   *
   * Notes:
   *
   * TODO:
   *        - Move this to a server / lambda (restrict access to User DB)
   *        - This is awful. Need to research if we can do a batch get on secondary
   *          indexes or make a second table mapping uuids to { sub: <sub>, email: <email> }
   *        - something better for unauthenticated users (probably a combined table)
   */
  async getEmailsForUuids(theUuids) {
    const emails = []
    for (const uuid of theUuids) {
      try {
        const emailResults = await userDataTableGetEmailsFromUuid(uuid)
        if (emailResults.Items.length > 0) {
          let email = emailResults.Items[0].email
          log.debug("THIS EMAIL: ", email)
          emails.push(email)
        } else {
          // Try the unauthenticated users table since we didn't find the uuid in
          // the auth'd users table
          const unauthEmailResults = await unauthenticatedUuidTableGetByUuid(uuid)
          let email = unauthEmailResults.Item.email
          emails.push(email)
        }
      } catch (suppressedError) {
        log.warn(`WARN: Failed to get email for uuid ${uuid}.\n${suppressedError}`)
      }
    }

    return emails
  }


  /**
   * createOrganizationId
   *
   * Notes:  This method generates an organization id and then populates the
   *         Organization Data Table with the newly created organization id.
   *
   *         @return orgId, the newly created organization id
   */
  async createOrganizationId(aUserUuid, aUserPubKey, aUserPriKey) {
    const orgId = uuidv4()

    let sub = undefined
    try {
      // Prob don't need to do this as it's done implicitly above for the
      // encrypt with keys.  TODO: something better when time.
      await this.requestIdpCredentials()
      sub = AWS.config.credentials.identityId
    } catch (error) {
      throw Error('ERROR: Failed to get id from Identity Pool.')
    }

    const orgPriKey = eccrypto.generatePrivate()
    const orgPubKey = eccrypto.getPublic(orgPriKey)
    let priKeyCipherText = undefined
    try {
      priKeyCipherText = await eccrypto.encrypt(aUserPubKey, orgPriKey)
    } catch (error) {
      throw new Error(`ERROR: Creating organization id. Failed to create private key cipher text.\n${error}`)
    }

    if (TEST_ASYMMETRIC_DECRYPT) {
      try {
        const recoveredPriKey =
          await eccrypto.decrypt(aUserPriKey, priKeyCipherText)

        if (recoveredPriKey.toString('hex') !== orgPriKey.toString('hex')) {
          throw new Error(`Recovered private key does not match private key:\nrecovered:${recoveredPriKey[0].toString('hex')}\noriginal:${orgPriKey.toString('hex')}\n`);
        }
      } catch (error) {
        throw new Error(`ERROR: testing asymmetric decryption.\n${error}`)
      }
    }

    const organizationDataRowObj = {
      org_id: orgId,
      cryptography: {
        pub_key: orgPubKey,
        pri_key_ciphertexts: {
          [ aUserUuid ] : priKeyCipherText,
        }
      },
      owner: {
        sub: sub,
        uuid: aUserUuid,
      },
      members: [],
      apps: {}
    }

    try {
      await organizationDataTablePut(organizationDataRowObj)
    } catch(error) {
      throw Error(`ERROR: Creating organization id.\n${error}`)
    }

    return orgId
  }

  async createSidObject() {
    if (!this.appIsSimpleId) {
      return {}
    }

    const priKey = eccrypto.generatePrivate()
    const pubKey = eccrypto.getPublic(priKey)
    const priKeyCipherText =
      await this.encryptWithKmsUsingIdpCredentials(this.keyId1, priKey)

    const orgId = await this.createOrganizationId(this.persist.userUuid, pubKey, priKey)

    let sidObj = {
      org_id: orgId,
      pub_key: pubKey,
      pri_key_cipher_text: priKeyCipherText,
      apps: {}
    }

    this.persist.sid = sidObj
    this.neverPersist.priKey = priKey

    return sidObj
  }

  /**
   * createAppId
   *
   * Notes:  This method generates an app id and then populates the
   *         Organization Data Table and Wallet Analytics Tables with the
   *         newly created organization id.
   */
  async createAppId(anOrgId, anAppObject) {
    // await this.getUuidsForWalletAddresses()
    // return
    // TODO: 1. Might want to check if the user has the org_id in their sid
    //       user data property.
    //       2. Might want to check if the user is listed as a member in the
    //       org data table.
    //       3. Use update to do the assignment (right now we're doing the
    //       horrible read--modify--clobber-write)
    //       4. Def check to make sure the same app id doesn't exist / collide
    //       in the wallet analytics table

    const appId = uuidv4()

    // 1. Update the Organization Data table:
    //
    let orgData = undefined
    try {
      // TODO: See TODO.3 above!
      orgData = await organizationDataTableGet(anOrgId)
      orgData.Item.apps[appId] = anAppObject
      await organizationDataTablePut(orgData.Item)
    } catch (error) {
      throw new Error(`ERROR: Failed to update apps in Organization Data table.\n${error}`)
    }

    // 1.5 Get the public key
    //
    let publicKey = undefined
    try {
      publicKey = orgData.Item.cryptography.pub_key
    } catch (error) {
      throw new Error(`Error: Failed to fetch public key from Org Data.\n${error}`)
    }

    // 2. Update the Wallet Analytics Data table
    //
    try {
      const walletAnalyticsRowObj = {
        app_id: appId,
        org_id: anOrgId,
        public_key: publicKey,
        analytics: {}
      }
      await walletAnalyticsDataTablePut(walletAnalyticsRowObj)
    } catch (error) {
      throw new Error(`ERROR: Failed to add row Wallet Analytics Data table.\n${error}`)
    }

    // AC: Not sure if this is needed.
    // // 3. TODO: Update the user data using Cognito IDP (the 'sid' property)
    // //
    // await this.tableUpdateWithIdpCredentials('sid', 'apps', appId, {})

    return appId
  }

  /**
   * deleteAppId
   *
   * Notes:  This method removes an app id from the
   *         Organization Data Table and Wallet Analytics Tables with the
   *         newly created organization id.
   *
   *         It does not remove the app id from the User Data table, the
   *         Unauthenticated UUID table, or the Wallet to UUID Map table.
   */
  async deleteAppId() {
    // TODO deleteAppId
  }

  /**
   * signUserUpToNewApp
   *
   * Notes:  If a user has or has not joined Simple ID Cognito's user pool, there
   *         is still the matter of creating their data pertaining to the app
   *         they signed in from.
   *
   *         This method inserts the appId related data into the User Data table
   *         or Unauthenticated UUID table (depending on if they're using us for
   *         auth), and the Wallet Analytics Data table and Wallet to UUID Map
   *         table.
   *
   * TODO:
   *       - Failure resistant db write methods.
   *       - Concurrency and an await Promise.all () with handled
   *         catch statements on individual promises.
   */
  async signUserUpToNewApp(isAuthenticatedUser) {

    if (isAuthenticatedUser) {
      // 1.a) Update the User Data Table if the user is authenticated.
      //
      // We do this in the 2nd part of the sign in flow when the user
      // answers a challenge but still need to do the other operations
      // below.
    } else {
      // 1.b) Otherwise update the Unauthenticated UUID Table if the user is an
      //      unauthenticated user.
      //
      await unauthenticatedUuidTableAppendAppId(this.persist.userUuid, this.appId)
    }

    // 2. Update the Wallet Analytics Data table:
    //
    await walletAnalyticsDataTableAddWalletForAnalytics(this.persist.address, this.appId)

    // 3. Update the Wallet to UUID Map table:
    //
    const appPublicKey = await walletAnalyticsDataTableGetAppPublicKey(this.appId)
    const userUuidCipherText =
      await eccrypto.encrypt(appPublicKey, Buffer.from(this.persist.userUuid))

    await walletToUuidMapTableAddCipherTextUuidForAppId(
      this.persist.address, userUuidCipherText, this.appId)
  }

/******************************************************************************
 *                                                                            *
 * Non-SimpleID Wallet User Methods                                           *
 *                                                                            *
 ******************************************************************************/

 async persistNonSIDUserInfo(userInfo) {

   if (this.appIsSimpleId) {
     // We don't do this in Simple ID.
     return
   }
   const { email, address } = userInfo
   this.persist.email = email
   this.persist.address = address

   // Check to see if this user exists in Unauthenticated UUID table (email key
   // is also indexed):
   let userExists = false
   let uuidResults = undefined
   //Not all providers will send through the email
   if(email) {
    log.debug(`Calling unauthenticatedUuidTableQueryByEmail with ${email}`)
    uuidResults = await unauthenticatedUuidTableQueryByEmail(email)
    userExists = (uuidResults.Items.length === 1)
    if (uuidResults.Items.length !== 0 && uuidResults.Items.length !== 1) {
     throw new Error('ERROR: collision with user in Simple ID unauth\'d user table.')
    }
   } else {
    //   TODO: Need AC to review this
    //   Querying the wallet to uuid map because we only have a wallet address here
    const walletResults = await walletToUuidMapTableGet(address)
    log.debug("WALLET RESULTS ", walletResults)

    userExists = (walletResults.Items && walletResults.Items.length === 1)
    if (walletResults.Items && walletResults.Items.length !== 0 && walletResults.Items.length !== 1) {
     throw new Error('ERROR: collision with user in Simple ID unauth\'d user table.')
    }
   }

   if (!userExists) {
     // The unauthenticated user does not exist in our data model. Initialize and
     // create DB entries for them:
     //
     // 1. Create a uuid for this user and insert them into the
     //    Unauthenticated UUID table:
     //
     // TODO:
     //       - think about obfusicating the email due to the openness of this table.
     //       - Refactor to createUnauthenticatedUser
     //
     this.persist.userUuid = uuidv4()
     const unauthenticatedUuidRowObj = {
       uuid: this.persist.userUuid,
       email,
       apps: [ this.appId ]
     }
     await unauthenticatedUuidTablePut(unauthenticatedUuidRowObj)

     // 2. Create an entry for them in the Wallet Analytics Data Table
     //
     await walletAnalyticsDataTableAddWalletForAnalytics(this.persist.address, this.appId)

     // 3. Create an entry for them in the Wallet to UUID Map
     //
     // TODO: Fetch the public key for the row corresponding to this app_id
     //       from the simple_id_cust_analytics_data_v001 table and use it
     //       to asymmetricly encrypt the user uuid. For now we just pop in
     //       the plain text uuid.
     //
     const appPublicKey = await walletAnalyticsDataTableGetAppPublicKey(this.appId)
     const userUuidCipherText = await eccrypto.encrypt(
       appPublicKey, Buffer.from(this.persist.userUuid))

     const walletUuidMapRowObj = {
       wallet_address: address,
       app_to_enc_uuid_map: {
         [ this.appId ] : userUuidCipherText
       }
     }
     //
     // TODO: Make this use Cognito to get write permission to the DB (for the
     //       time being we're using an AWS_SECRET):
     // TODO: Make this update / append when needed too (here it's new data so it's okay)
     await walletToUuidMapTablePut(walletUuidMapRowObj)
   } else {
     // TODO Refactor to persistUnauthenticatedUser
     //
     this.persist.userUuid = uuidResults.Items[0].uuid

     // 1. Fetch the email & apps from the Unauthenticated UUID table and ensure
     //    this app is listed.
     //
     const unauthdUuidRowObj = await unauthenticatedUuidTableGetByUuid(this.persist.userUuid)
     // BEGIN REMOVE
     const oldAppId = this.appId
     if (TEST_SIGN_USER_UP_TO_NEW_APP) {
       log.warn('************************ REMOVE WHEN WORKING ***************')
       log.warn('* Faking a new AppId to build signUserUpToNewApp           *')
       log.warn('************************************************************')
       this.appId = `new-app-id-random-${Date.now()}`
     }
     // See also: BEGIN REMOVE ~10 lines down
     // END REMOVE

     if ( !unauthdUuidRowObj.Item.apps.includes(this.appId) ) {
       // The App doesn't exist in the user's profile (this is the first time
       // the user is using it). Update the Unauthenticated UUID table,
       // Wallet Analytics Data table, and Wallet to UUID tables.
       const authenticatedUser = false
       await this.signUserUpToNewApp(authenticatedUser)
     }

     // BEGIN REMOVE
     // restore appId
     this.appId = oldAppId
     // END REMOVE

     //Need to update date stamp
     await this.updateDateStamp()
   }

   // TODO: this needs to be obfuscated. It should also use a common method with
   //       our other flow persistence. The data should also be stored in this.persist
   //
   // TODO: Justin, why not use SID_SVCS_LS_KEY and add a boolean to the object
   //       indicating unauthenticatedUser (i.e. non wallet)?
   //
   //TODO: AC review. This feels super hacky, but might be the right way to handle it
   localStorage.setItem(NON_SID_WALLET_USER_INFO, JSON.stringify(userInfo));

   const returnableUserData = {
     wallet: {
       ethAddr: address
     }
   }
   return returnableUserData
 }

 getNonSIDUserInfo() {
   const userInfo = localStorage.getItem(NON_SID_WALLET_USER_INFO);
   return JSON.parse(userInfo);
 }

 async updateDateStamp() {
  try {
    //Fetch from DB
    const appData = await walletAnalyticsDataTableGet(this.appId)

    //    TODO: need to examine if we will run into address casing issues
    //    Some address results have capital letters in them and some have
    //    lower case. Need consistency to do look ups like this

    const dataRowToUpdate = appData.Item
    const users = dataRowToUpdate.analytics
    const thisUser = users[this.persist.address]
    thisUser['last_seen'] = Date.now()
    //now we put it back into the DB
    await walletAnalyticsDataTablePut(dataRowToUpdate)
  } catch (e) {
    log.error("Error updating date stamp: ", e)
  }
 }

/******************************************************************************
 *                                                                            *
 * Cognito Related Methods                                                    *
 *                                                                            *
 ******************************************************************************/

  // TODO:
  //      - need a way to shortcut this if we already have the credentials
  //      - might make sense to store these in a hash and pass them to the
  //        appropriate method now that we have multiple IDP.
  //
  async requestIdpCredentials(
      aRegion=CONFIG.REGION,
      aUserPoolId=USER_POOL_ID,
      anIdentityPoolId=CONFIG.IDENTITY_POOL_ID ) {

    const session = await Auth.currentSession()

    AWS.config.region = aRegion
    const data = { UserPoolId: aUserPoolId }
    const cognitoLogin = `cognito-idp.${AWS.config.region}.amazonaws.com/${data.UserPoolId}`
    const logins = {}
    logins[cognitoLogin] = session.getIdToken().getJwtToken()

    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
      IdentityPoolId: anIdentityPoolId,
      Logins: logins
    })

    // Modified to use getPromise from:
    //    https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Credentials.html#get-property
    //
    await AWS.config.credentials.getPromise()
  }



/******************************************************************************
 *                                                                            *
 * HSM / KMS Related Methods                                                  *
 *                                                                            *
 ******************************************************************************/

  async encryptWithKmsUsingIdpCredentials(keyId, plainText) {
    await this.requestIdpCredentials(
      CONFIG.REGION,
      USER_POOL_ID,
      CONFIG.CRYPTO_IDENTITY_POOL_ID )

    // IMPORTANT AF:
    //
    // Never store this sub. It prevents us from being a money transmitter as
    // the only person who knows this value and can thus decrypt these cipher
    // texts is the Cognito user (as opposed to staff who can assume the
    // Cognito crypto role, but still don't have the Encryption context
    // required to decrypt the cipher text.)
    let NEVER_STORE_sub = undefined
    try {
      NEVER_STORE_sub = AWS.config.credentials.identityId
      log.debug(`DBG:  DB IDP NEVER_STORE_sub = ${NEVER_STORE_sub}`)
    } catch (error) {
      throw Error(`ERROR: getting credential identityId.\n${error}`)
    }

    // Now that the AWS creds are configured with the cognito login above, we
    // should be able to access the KMS key if we got the IAMs users/roles/grants
    // correct.
    const kms = new AWS.KMS( { region : CONFIG.REGION } )

    const cipherText = await new Promise((resolve, reject) => {
      const params = {
        KeyId: keyId,
        Plaintext: plainText,
        EncryptionContext: {
          sub: NEVER_STORE_sub
        }
      }

      kms.encrypt(params, (err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data.CiphertextBlob)
        }
      })
    })

    return cipherText
  }


  async decryptWithKmsUsingIdpCredentials(cipherText) {
    await this.requestIdpCredentials(
      CONFIG.REGION,
      USER_POOL_ID,
      CONFIG.CRYPTO_IDENTITY_POOL_ID )

    // IMPORTANT AF:
    //
    // Never store this sub. It prevents us from being a money transmitter as
    // the only person who knows this value and can thus decrypt these cipher
    // texts is the Cognito user (as opposed to staff who can assume the
    // Cognito crypto role, but still don't have the Encryption context
    // required to decrypt the cipher text.)
    let NEVER_STORE_sub = undefined
    try {
      NEVER_STORE_sub = AWS.config.credentials.identityId
      log.debug(`DBG:  DB IDP NEVER_STORE_sub = ${NEVER_STORE_sub}`)
    } catch (error) {
      throw Error(`ERROR: getting credential identityId.\n${error}`)
    }

    // Now that the AWS creds are configured with the cognito login above, we
    // should be able to access the KMS key if we got the IAMs users/roles/grants
    // correct.
    const kms = new AWS.KMS( { region: CONFIG.REGION } )

    const plainText = await new Promise((resolve, reject) => {
      const params = {
        // KeyId: <Not needed--built into cipher text>,
        CiphertextBlob: cipherText,
        EncryptionContext: {
          sub: NEVER_STORE_sub
        }
      }

      kms.decrypt(params, (err, data) => {
        if (err) {
          reject(err)
        } else {
          // TODO: probably stop string encoding this
          // resolve(data.Plaintext.toString('utf-8'))
          resolve(data.Plaintext)
        }
      })
    })

    return plainText
  }



/******************************************************************************
 *                                                                            *
 * DynamoDB Methods                                                           *
 *                                                                            *
 ******************************************************************************/

  // TODO:  For the table* methods below:
  //  - clean up, refactor, sensible accessors to commonly used tables
  //  - better separation and re-use with cognito

  // TODO: abstract the restricted sub out of this code so it's more generic and
  //       not just for restricted row access dynamos.
  async tableGetWithIdpCredentials() {
    await this.requestIdpCredentials()

    let sub = undefined
    try {
      sub = AWS.config.credentials.identityId
      log.debug(`DBG:  DB IDP sub = ${sub}`)
    } catch (error) {
      throw Error(`ERROR: getting credential identityId.\n${error}`)
    }

    const docClient = new AWS.DynamoDB.DocumentClient({
      region: CONFIG.REGION })

    const dbParams = {
      Key: {
        sub: sub
      },
      TableName: CONFIG.UD_TABLE,
    }
    const awsDynDbRequest = await new Promise(
      (resolve, reject) => {
        docClient.get(dbParams, (err, data) => {
          if (err) {
            reject(err)
          } else {
            resolve(data)
          }
        })
      }
    )

    return awsDynDbRequest
  }

  async tablePutWithIdpCredentials(keyValueData) {
    // Adapted from the JS on:
    //    https://aws.amazon.com/blogs/mobile/building-fine-grained-authorization-using-amazon-cognito-user-pools-groups/
    //
    await this.requestIdpCredentials()

    // Modified to use getPromise from:
    //    https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Credentials.html#get-property
    //
    let sub = undefined
    try {
      sub = AWS.config.credentials.identityId
      log.debug(`DBG:  DB IDP sub = ${sub}`)
    } catch (error) {
      throw Error(`ERROR: getting credential identityId.\n${error}`)
    }

    const docClient = new AWS.DynamoDB.DocumentClient(
      { region: CONFIG.REGION })

    const item = {
      sub: sub
    }
    for (const k in keyValueData) {
      item[k] = keyValueData[k]
    }

    const dbParams = {
      Item: item,
      TableName: CONFIG.UD_TABLE,
    }

    const awsDynDbRequest = await new Promise(
      (resolve, reject) => {
        docClient.put(dbParams, (err, data) => {
          if (err) {
            reject(err)
          } else {
            resolve(data)
          }
        })
      }
    )

    return awsDynDbRequest
  }

  // TODO: might not be needed (Read Modify Write might be sufficient)
  //       hold on to this for the time being:
  //
  // // Rename: adapeted from dynamoBasics method tableUpdateAppendNestedObjectProperty
  // tableUpdateWithIdpCredentials = async (aNestedObjKey, a2ndNestedObjKey, aPropName, aPropValue) => {
  //   // Adapted from the JS on:
  //   //    https://aws.amazon.com/blogs/mobile/building-fine-grained-authorization-using-amazon-cognito-user-pools-groups/
  //   //
  //   await this.requestIdpCredentials()
  //
  //   // Modified to use getPromise from:
  //   //    https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Credentials.html#get-property
  //   //
  //   let sub = undefined
  //   try {
  //     sub = AWS.config.credentials.identityId
  //   } catch (error) {
  //     throw Error(`ERROR: getting credential identityId.\n${error}`)
  //   }
  //
  //   const docClient = new AWS.DynamoDB.DocumentClient(
  //     { region: CONFIG.REGION })
  //
  //
  //   // Taken from dynamoBasics method tableUpdateAppendNestedObjectProperty
  //   const dbParams = {
  //     TableName: CONFIG.UD_TABLE,
  //     Key: {
  //       sub: sub
  //     },
  //     UpdateExpression: 'set #objName.#objName2.#objPropName = :propValue',
  //     ExpressionAttributeNames: {
  //       '#objName': aNestedObjKey,
  //       '#objName2': a2ndNestedObjKey,
  //       '#objPropName': aPropName
  //     },
  //     ExpressionAttributeValues: {
  //       ':propValue': aPropValue
  //     },
  //     ReturnValues: 'NONE'
  //   }
  //
  //   const awsDynDbRequest = await new Promise(
  //     (resolve, reject) => {
  //       docClient.update(dbParams, (err, data) => {
  //         if (err) {
  //           dbRequestDebugLog('tableUpdateWithIdpCredentials', dbParams, err)
  //
  //           reject(err)
  //         } else {
  //           resolve(data)
  //         }
  //       })
  //     }
  //   )
  //
  //   return awsDynDbRequest
  // }
}


// Start of more mess
////////////////////////////////////////////////////////////////////////////////
let sidSvcs = undefined

console.log('Created global instance of SidServices')
console.log('/////////////////////////////////////////////////////////////////')

export function createSidSvcs(config) {
  const { appId } = config;

  if (!sidSvcs) {
    sidSvcs = new SidServices(appId)
  } else {
    log.warn('Sid Services already exists.')
  }
}

// TODO: cleanup this workaround for initialization order errors:
export function getSidSvcs() {
  if (!sidSvcs) {
    throw new Error('createSidSvcs must be called before getSidSvcs.')
  }

  return sidSvcs
}
