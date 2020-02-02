import { getLog } from './debugScopes.js'
const log = getLog('dynamoBasics')

const AWS = require('aws-sdk')
const CONFIG = require('../config.json')

AWS.config.region = CONFIG.REGION
AWS.config.credentials = new AWS.CognitoIdentityCredentials(
  { IdentityPoolId: CONFIG.SDK_IDENTITY_POOL })

let _docClientIDP = undefined
const initDocClient = async () => {
  if (_docClientIDP) {
    // TODO:  how to refresh this token & creds (check and do)
    // https://docs.aws.amazon.com/cognito/latest/developerguide/getting-credentials.html
    return
  }

  try {
    // Get unauthenticated Cognito credentials ...
    // getPromise documented here:
    //    https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Credentials.html#get-property
    //
    await AWS.config.credentials.getPromise()
    _docClientIDP = new AWS.DynamoDB.DocumentClient()
  } catch (error) {
    log.error(`Unable to secure access to DB.\n${error}`)
    throw new Error(`Unable to secure access to DB.\n${error}`)
  }
}



export function dbRequestDebugLog(anOperation, params, error) {
  try {
    const indentSpaces = 4
    let dbgMsg = `${anOperation} operation failed.\n`
    dbgMsg += '========================================\n'
    dbgMsg += 'params:\n'
    dbgMsg += '--------------------\n'
    dbgMsg += JSON.stringify(params, 0, indentSpaces) + '\n'
    dbgMsg += '\n'
    dbgMsg += 'error:\n'
    dbgMsg += '--------------------\n'
    dbgMsg += '  ' + String(error) + '\n'
    dbgMsg += '\n'

    log.error(dbgMsg)
  } catch(suppressedError) {}
}


export async function tableGet(aTable, aKeyName, aKeyValue) {
  await initDocClient()

  const params = {
    TableName: aTable,
    Key: {
      [ aKeyName ] : aKeyValue
    }
  }

  return new Promise((resolve, reject) => {
    _docClientIDP.get(params, (err, data) => {
      if (err) {
        dbRequestDebugLog('tableGet', params, err)

        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

export async function tablePut(aTable, anObject) {
  await initDocClient()

  const params = {
    TableName: aTable,
    Item: anObject
  }

  return new Promise((resolve, reject) => {
    _docClientIDP.put(params, (err, data) => {
      if (err) {
        dbRequestDebugLog('tablePut', params, err)

        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

// ProjectionExpression example here: https://www.dynamodbguide.com/querying/
export async function tableQuerySpecificItem(aTable, aKeyName, aKeyValue, aSpecificKey) {
  await initDocClient()

  const params = {
    TableName: aTable,
    KeyConditionExpression: `#${aKeyName} = :${aKeyName}`,
    ExpressionAttributeNames: {
      [ `#${aKeyName}` ] : aKeyName
    },
    ExpressionAttributeValues: {
      [ `:${aKeyName}` ] : aKeyValue
    },
    ProjectionExpression: aSpecificKey
  }

  return new Promise((resolve, reject) => {
    _docClientIDP.query(params, (err, data) => {
      if (err) {
        dbRequestDebugLog('tableQuerySpecificItem', params, err)

        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

// Adapted from: https://stackoverflow.com/questions/51134296/dynamodb-how-to-query-a-global-secondary-index
//
export async function tableGetBySecondaryIndex(aTable, anIndexName, aKeyName, aKeyValue) {
  await initDocClient()

  log.debug("tableGetBySecondaryIndex")
  log.debug("table: ", aTable, "index: ", anIndexName, "keyname: ", aKeyName, "keyvalue: ", aKeyValue)
  const expressionAtrNameObj = {
    [ `#${aKeyName}` ] : aKeyName
  }

  var params = {
    TableName : aTable,
    IndexName : anIndexName,
    KeyConditionExpression: `#${aKeyName} = :value`,
    ExpressionAttributeNames: expressionAtrNameObj,
    ExpressionAttributeValues: {
        ':value': aKeyValue
    }
  }
  if(aKeyName) {
    return new Promise((resolve, reject) => {
      _docClientIDP.query(params, (err, data) => {
        if (err) {
          dbRequestDebugLog('tableGetBySecondaryIndex', params, err)
          reject(err)
        } else {
          log.debug("data = ", data)
          resolve(data)
        }
      })
    })
  } else {
    return {}
  }
}

// Reference this to make the list_append function work in update set eqn:
//   - https://stackoverflow.com/questions/44219664/inserting-a-nested-attributes-array-element-in-dynamodb-table-without-retrieving
//   - https://stackoverflow.com/questions/41400538/append-a-new-object-to-a-json-array-in-dynamodb-using-nodejs
//   -
export async function tableUpdateListAppend(aTable, aPrimKeyObj, anArrayKey, anArrayValue) {
  await initDocClient()

  const exprAttr = ':eleValue'
  const updateExpr = `set ${anArrayKey} = list_append(${anArrayKey}, ${exprAttr})`

  const params = {
    TableName: aTable,
    Key: aPrimKeyObj,
    UpdateExpression: updateExpr,
    ExpressionAttributeValues: {
      ':eleValue': [anArrayValue]
    },
    ReturnValues:"NONE"
  }

  return new Promise((resolve, reject) => {
    _docClientIDP.update(params, (err, data) => {
      if (err) {
        dbRequestDebugLog('tableUpdateListAppend', params, err)

        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

/* tableUpdateAppendNestedObjectProperty:
 *
 * Notes: Adds a new property to an object in a Dynamo Table row. Consider
 *        this example row:
 *        {
 *          <some primary key>: <some value>,
 *          'my_object_name': {
 *            'key1': 'value1',
 *            'key2': 'value2'
 *          }
 *        }
 *
 *        Calling this method with:
 *          aPrimKeyObj = {<some primary key>: <some value>}
 *          aNestedObjKey = 'my_object_name'
 *          aPropName = 'key3'
 *          aPropValue = 'value3'
 *
 *        Would result in Dynamo containing this row:
 *        {
 *          <some primary key>: <some value>,
 *          'my_object_name': {
 *            'key1': 'value1',
 *            'key2': 'value2',
 *            'key3': 'value3'
 *          }
 *        }
 *
 * Further Reading:
 *   - https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.UpdateExpressions.html
 *   - https://stackoverflow.com/questions/51911927/update-nested-map-dynamodb
 *       - This SO answer is decent as it mentions schema design complexity being a
 *         problem and limitations in Dynamo
 *
 * TODO:
 *   - Bolting a simple parse to this could result in extended nesting
 *     assignments, i.e. pass in something like this for aPropName
 *        'my_object_name.key1.value1'
 *     then separate on '.' and convert to arbitrary length prop names.
 *   - Consider adding existence test logic.
 */
export async function tableUpdateAppendNestedObjectProperty(
  aTable, aPrimKeyObj, aNestedObjKey, aPropName, aPropValue) {
  await initDocClient()

  const params = {
    TableName: aTable,
    Key: aPrimKeyObj,
    UpdateExpression: 'set #objName.#objPropName = :propValue',
    ExpressionAttributeNames: {
      '#objName': aNestedObjKey,
      '#objPropName': aPropName
    },
    ExpressionAttributeValues: {
      ':propValue': aPropValue
    },
    ReturnValues: 'UPDATED_NEW'
  }

  return new Promise((resolve, reject) => {
    _docClientIDP.update(params, (err, data) => {
      if (err) {
        dbRequestDebugLog('tableUpdateAppendNestedObjectProperty', params, err)

        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}
