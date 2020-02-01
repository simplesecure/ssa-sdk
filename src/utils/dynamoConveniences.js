import { tableGet,
         tableBatchGet,
         tablePut,
         tableQuerySpecificItem,
         tableGetBySecondaryIndex,
         tableUpdateListAppend,
         tableUpdateAppendNestedObjectProperty } from './dynamoBasics.js'

// TODO: This func will go away and go into our EC2/Lambda Mail service machine
//
export async function userDataTableGetEmailsFromUuid(uuid) {
  if (!uuid) {
    throw new Error(`DB access method userDataTableGetEmailsFromUuid requires a value for uuid.  uuid="${uuid}".`)
  }

  return tableGetBySecondaryIndex(
    process.env.REACT_APP_UD_TABLE,
    process.env.REACT_APP_UD_TABLE_INDEX,
    process.env.REACT_APP_UD_TABLE_SK,
    uuid
  )
}

export async function walletAnalyticsDataTableGet(anAppId) {
  if (!anAppId) {
    throw new Error(`DB access method walletAnalyticsDataTableGet requires a value for anAppId.  anAppId="${anAppId}".`)
  }

  return tableGet(
    process.env.REACT_APP_AD_TABLE,
    process.env.REACT_APP_AD_TABLE_PK,
    anAppId
  )
}

export async function walletAnalyticsDataTablePut(aWalletAnalyticsRowObj) {
  if (!aWalletAnalyticsRowObj) {
    throw new Error(`DB access method walletAnalyticsDataTablePut requires a value for aWalletAnalyticsRowObj.  aWalletAnalyticsRowObj=${aWalletAnalyticsRowObj}".`)
  }

  return tablePut(
    process.env.REACT_APP_AD_TABLE,
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
      process.env.REACT_APP_AD_TABLE,
      process.env.REACT_APP_AD_TABLE_PK,
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
    process.env.REACT_APP_UUID_TABLE,
    process.env.REACT_APP_UUID_TABLE_PK,
    aWalletAddress
  )
}

export async function walletToUuidMapTablePut(aWalletToUuidMapRowObj) {
  if (!aWalletToUuidMapRowObj) {
    throw new Error(`DB access method walletToUuidMapTablePut requires a value for aWalletToUuidMapRowObj.  aWalletToUuidMapRowObj=${aWalletToUuidMapRowObj}".`)
  }

  return tablePut(
    process.env.REACT_APP_UUID_TABLE,
    aWalletToUuidMapRowObj
  )
}

export async function organizationDataTableGet(anOrgId) {
  if (!anOrgId) {
    throw new Error(`DB access method organizationDataTableGet requires a value for anOrgId.  anOrgId="${anOrgId}".`)
  }

  return tableGet(
    process.env.REACT_APP_ORG_TABLE,
    process.env.REACT_APP_ORG_TABLE_PK,
    anOrgId
  )
}

export async function organizationDataTablePut(aOrganizationDataRowObj) {
  if (!aOrganizationDataRowObj) {
    throw new Error(`DB access method organizationDataTablePut requires a value for aOrganizationDataRowObj.  aOrganizationDataRowObj=${aOrganizationDataRowObj}".`)
  }

  return tablePut(
    process.env.REACT_APP_ORG_TABLE,
    aOrganizationDataRowObj
  )
}

export async function unauthenticatedUuidTableQueryByEmail(anEmail) {
  if (!anEmail) {
    throw new Error(`DB access method unauthenticatedUuidTableQueryByEmail requires a value for anEmail.  anEmail="${anEmail}".`)
  }

  return tableGetBySecondaryIndex(
    process.env.REACT_APP_UNAUTH_UUID_TABLE,
    process.env.REACT_APP_UNAUTH_UUID_TABLE_INDEX,
    process.env.REACT_APP_UNAUTH_UUID_TABLE_SK,
    anEmail
  )
}

export async function unauthenticatedUuidTableGetByUuid(aUuid) {
  if (!aUuid) {
    throw new Error(`DB access method unauthenticatedUuidTableGetByUuid requires a value for aUuid.  aUuid="${aUuid}".`)
  }

  return tableGet(
    process.env.REACT_APP_UNAUTH_UUID_TABLE,
    process.env.REACT_APP_UNAUTH_UUID_TABLE_PK,
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
    process.env.REACT_APP_UNAUTH_UUID_TABLE,
    anUnauthenticatedUuidRowObj
  )
}

export async function unauthenticatedUuidTableAppendAppId(aUuid, anAppId) {
  if (!aUuid || !anAppId) {
    throw new Error(`DB access method unauthenticatedUuidTableAppendAppId requires a value for aUuid and anAppId.  aUuid="${aUuid}", anAppId="${anAppId}".`)
  }

  return tableUpdateListAppend(
    process.env.REACT_APP_UNAUTH_UUID_TABLE,
    { [ process.env.REACT_APP_UNAUTH_UUID_TABLE_PK ] : aUuid },
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
    process.env.REACT_APP_UUID_TABLE,
    { [ process.env.REACT_APP_UUID_TABLE_PK ] : aWalletAddress },
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
    process.env.REACT_APP_AD_TABLE,
    { [ process.env.REACT_APP_AD_TABLE_PK] : anAppId },
    'analytics',
    aWalletAddress,
    {
      last_seen: Date.now()
    }
  )
}

export async function walletToUuidMapTableGetUuids(anArrayOfWalletAddrs) {
  if (!anArrayOfWalletAddrs) {
    throw new Error(`DB access method walletToUuidMapTableGetUuids requires a value for anArrayOfWalletAddrs.\nanArrayOfWalletAddrs=${anArrayOfWalletAddrs}`)
  }

  const arrOfKeyValuePairs = []
  for (const walletAddress of anArrayOfWalletAddrs) {
    arrOfKeyValuePairs.push({
      [ process.env.REACT_APP_UUID_TABLE_PK ] : walletAddress
    })
  }

  const rawDataResults =
    await tableBatchGet(process.env.REACT_APP_UUID_TABLE, arrOfKeyValuePairs)

  let walletToUuids = undefined
  try {
    walletToUuids = rawDataResults.Responses[process.env.REACT_APP_UUID_TABLE]
  } catch (error) {
    throw new Error(`Unable to access wallet to UUID maps in db response.\n${error}`);
  }
  return walletToUuids
}
