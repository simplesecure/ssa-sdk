import { tableGet,
         tablePut,
         tableQuerySpecificItem,
         tableGetBySecondaryIndex,
         tableUpdateListAppend,
         tableUpdateAppendNestedObjectProperty } from './dynamoBasics.js'

const CONFIG = require('../config.json')

export async function walletAnalyticsDataTableGet(anAppId) {
  if (!anAppId) {
    throw new Error(`DB access method walletAnalyticsDataTableGet requires a value for anAppId.  anAppId="${anAppId}".`)
  }

  return tableGet(
    CONFIG.AD_TABLE,
    CONFIG.AD_TABLE_PK,
    anAppId
  )
}

export async function walletAnalyticsDataTablePut(aWalletAnalyticsRowObj) {
  if (!aWalletAnalyticsRowObj) {
    throw new Error(`DB access method walletAnalyticsDataTablePut requires a value for aWalletAnalyticsRowObj.  aWalletAnalyticsRowObj=${aWalletAnalyticsRowObj}".`)
  }

  return tablePut(
    CONFIG.AD_TABLE,
    aWalletAnalyticsRowObj
  )
}

export async function walletAnalyticsDataTableGetAppPublicKey(anAppId) {
  if (!anAppId) {
    throw new Error(`DB access method walletAnalyticsDataTableGetAppPublicKey requires a value for anAppId.  anAppId="${anAppId}".`)
  }

  let walletAnalyticsRowObjs = undefined
  try {
    walletAnalyticsRowObjs = await tableQuerySpecificItem(
      CONFIG.AD_TABLE,
      CONFIG.AD_TABLE_PK,
      anAppId,
      'public_key'
    )

    const appPublicKey = walletAnalyticsRowObjs.Items[0].public_key
    return appPublicKey
  } catch (suppressedError) {
    console.log(`ERROR(Suppressed): Failed to fetch public key for app ${anAppId}.\n${suppressedError}`)
  }

  return undefined
}

export async function walletToUuidMapTableGet(aWalletAddress) {
  if (!aWalletAddress) {
    throw new Error(`DB access method walletToUuidMapTableGet requires a value for aWalletAddress.  aWalletAddress="${aWalletAddress}".`)
  }

  return tableGet(
    CONFIG.UUID_TABLE,
    CONFIG.UUID_TABLE_PK,
    aWalletAddress
  )
}

export async function walletToUuidMapTablePut(aWalletToUuidMapRowObj) {
  if (!aWalletToUuidMapRowObj) {
    throw new Error(`DB access method walletToUuidMapTablePut requires a value for aWalletToUuidMapRowObj.  aWalletToUuidMapRowObj=${aWalletToUuidMapRowObj}".`)
  }

  return tablePut(
    CONFIG.UUID_TABLE,
    aWalletToUuidMapRowObj
  )
}

export async function organizationDataTableGet(anOrgId) {
  if (!anOrgId) {
    throw new Error(`DB access method organizationDataTableGet requires a value for anOrgId.  anOrgId="${anOrgId}".`)
  }

  return tableGet(
    CONFIG.ORG_TABLE,
    CONFIG.ORG_TABLE_PK,
    anOrgId
  )
}

export async function organizationDataTablePut(aOrganizationDataRowObj) {
  if (!aOrganizationDataRowObj) {
    throw new Error(`DB access method organizationDataTablePut requires a value for aOrganizationDataRowObj.  aOrganizationDataRowObj=${aOrganizationDataRowObj}".`)
  }

  return tablePut(
    CONFIG.ORG_TABLE,
    aOrganizationDataRowObj
  )
}

export async function unauthenticatedUuidTableQueryByEmail(anEmail) {
  if (!anEmail) {
    throw new Error(`DB access method unauthenticatedUuidTableQueryByEmail requires a value for anEmail.  anEmail="${anEmail}".`)
  }

  return tableGetBySecondaryIndex(
    CONFIG.UNAUTH_UUID_TABLE,
    CONFIG.UNAUTH_UUID_TABLE_INDEX,
    CONFIG.UNAUTH_UUID_TABLE_SK,
    anEmail
  )
}

export async function unauthenticatedUuidTableGetByUuid(aUuid) {
  if (!aUuid) {
    throw new Error(`DB access method unauthenticatedUuidTableGetByUuid requires a value for aUuid.  aUuid="${aUuid}".`)
  }

  return tableGet(
    CONFIG.UNAUTH_UUID_TABLE,
    CONFIG.UNAUTH_UUID_TABLE_PK,
    aUuid
  )
}

// TODO: change this to use the Cognito unauthenticated role perhaps.
//       - look into ramifications / sensibility of that move
export async function unauthenticatedUuidTablePut(anUnauthenticatedUuidRowObj) {
  if (!anUnauthenticatedUuidRowObj) {
    throw new Error(`DB access method unauthenticatedUuidTablePut requires a value for anUnauthenticatedUuidRowObj.  anUnauthenticatedUuidRowObj=${anUnauthenticatedUuidRowObj}".`)
  }

  return tablePut(
    CONFIG.UNAUTH_UUID_TABLE,
    anUnauthenticatedUuidRowObj
  )
}

export async function unauthenticatedUuidTableAppendAppId(aUuid, anAppId) {
  if (!aUuid || !anAppId) {
    throw new Error(`DB access method unauthenticatedUuidTableAppendAppId requires a value for aUuid and anAppId.  aUuid="${aUuid}", anAppId="${anAppId}".`)
  }

  return tableUpdateListAppend(
    CONFIG.UNAUTH_UUID_TABLE,
    { [ CONFIG.UNAUTH_UUID_TABLE_PK ] : aUuid },
    'apps',
    anAppId
  )
}

export async function walletToUuidMapTableAddCipherTextUuidForAppId(
  aWalletAddress, aCipherTextUuid, anAppId) {

  if (!aWalletAddress || !aCipherTextUuid || !anAppId) {
    throw new Error(`DB access method walletToUuidMapTableAddCipherTextUuidForAppId requires a value for aWalletAddress, aCipherTextUuid and anAppId.\naWalletAddress="${aWalletAddress}"\naCipherTextUuid="${aCipherTextUuid}"\nanAppId="${anAppId}".`)
  }

  return tableUpdateAppendNestedObjectProperty(
    CONFIG.UUID_TABLE,
    { [ CONFIG.UUID_TABLE_PK ] : aWalletAddress },
    'app_to_enc_uuid_map',
    anAppId,
    aCipherTextUuid
  )
}

export async function walletAnalyticsDataTableAddWalletForAnalytics(
  aWalletAddress, anAppId) {

  if (!aWalletAddress || !anAppId) {
    throw new Error(`DB access method walletAnalyticsDataTableAddWalletForAnalytics requires a value for aWalletAddress and anAppId.\naWalletAddress="${aWalletAddress}"\nanAppId="${anAppId}".`)
  }

  return tableUpdateAppendNestedObjectProperty(
    CONFIG.AD_TABLE,
    { [ CONFIG.AD_TABLE_PK] : anAppId },
    'analytics',
    aWalletAddress,
    {
      last_seen: Date.now()
    }
  )
}
