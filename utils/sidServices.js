import { walletAnalyticsDataTablePut,
         walletToUuidMapTablePut,
         unauthenticatedUuidTableQueryByEmail,
         unauthenticatedUuidTableGetByUuid,
         unauthenticatedUuidTablePut,
         unauthenticatedUuidTableAppendAppId,
         walletToUuidMapTableAddCipherTextUuidForAppId,
         walletAnalyticsDataTableGetAppPublicKey,
         walletAnalyticsDataTableAddWalletForAnalytics,
         walletAnalyticsDataTableGet,
         walletToUuidMapTableGet } from './dynamoConveniences.js'
import { getLog } from './debugScopes.js'
const log = getLog('sidServices')

// v4 = random. Might consider using v5 (namespace, in conjunction w/ app id)
// see: https://github.com/kelektiv/node-uuid
const uuidv4 = require('uuid/v4')
const Buffer = require('buffer/').Buffer  // note: the trailing slash is important!
                                          // (See: https://github.com/feross/buffer)
const eccrypto = require('eccrypto')


const NON_SID_WALLET_USER_INFO = "non-sid-user-info";
const SID_ANALYTICS_APP_ID = '00000000000000000000000000000000'


/*******************************************************************************
 * Configuration Switches
 ******************************************************************************/
const TEST_ASYMMETRIC_DECRYPT = true


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
    this.appId = anAppId
    this.appIsSimpleId = (this.appId === SID_ANALYTICS_APP_ID )

    this.persist = {
      userUuid: undefined,
      email: undefined,
      address: undefined
    }
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
  async signUserUpToNewApp() {

    // 1. Update the Unauthenticated UUID Table if the user is an
    //    unauthenticated user.
    //
    await unauthenticatedUuidTableAppendAppId(this.persist.userUuid, this.appId)

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

     if ( !unauthdUuidRowObj.Item.apps.includes(this.appId) ) {
       // The App doesn't exist in the user's profile (this is the first time
       // the user is using it). Update the Unauthenticated UUID table,
       // Wallet Analytics Data table, and Wallet to UUID tables.
       await this.signUserUpToNewApp()
     }

     //Need to update date stamp
     await this.updateDateStamp()
   }

   // TODO: this needs to be obfuscated. It should also use a common method with
   //       our other flow persistence. The data should also be stored in this.persist
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
}

// Start of more mess
////////////////////////////////////////////////////////////////////////////////
let sidSvcs = undefined

export function createSidSvcs(config) {
  const { appId } = config;

  if (!sidSvcs) {
    sidSvcs = new SidServices(appId)
  } else {
    log.warn('Sid Services already exists.')
  }
}

// TODO: cleanup this workaround for initialization order errors:
export function getSidSvcs(config) {
  if (!sidSvcs) {
    throw new Error('createSidSvcs must be called before getSidSvcs.')
  }

  return sidSvcs
}
