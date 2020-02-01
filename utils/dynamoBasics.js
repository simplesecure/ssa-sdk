const AWS = require('aws-sdk')

const CONFIG = require('../config.json')

// TODO TODO TODO TODO
// This is for quick dev, remove this and use Cognito to assign role based access
// through IDP (at least within the iFrame) lest we mess things up with
// confliting perms and excess access:
//
AWS.config.update({
  accessKeyId: CONFIG.AWS_ACCESS_KEY_ID,
  secretAccessKey: CONFIG.AWS_SECRET_ACCESS_KEY,
  region: CONFIG.REGION
})
//
// _docClientAK: AK --> AWS Access Key Credentialing (vs. Cognito Credentials).
//
const _docClientAK = new AWS.DynamoDB.DocumentClient()

const DEBUG_DYNAMO = ( CONFIG.DEBUG_DYNAMO ||
                       CONFIG.DEBUG_DYNAMO) ? true : false

export function dbRequestDebugLog(anOperation, params, error) {
  try {
    if (DEBUG_DYNAMO) {
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

      console.log(dbgMsg)
    }
  } catch(suppressedError) {}
}


export async function tableGet(aTable, aKeyName, aKeyValue) {
  const params = {
    TableName: aTable,
    Key: {
      [ aKeyName ] : aKeyValue
    }
  }

  return new Promise((resolve, reject) => {
    _docClientAK.get(params, (err, data) => {
      if (err) {
        dbRequestDebugLog('tableGet', params, err)

        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

// TODO:
//    - One day we'll bump up against the limitations of this (see:
//      https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html).
//      Specifically "A single operation can retrieve up to 16 MB of data, which can contain as many as 100 items."
//    - Add ProjectionExpression to limit data fetched
export async function tableBatchGet(aTable, anArrOfKeyValuePairs) {
  const numItems = anArrOfKeyValuePairs.length
  const maxItemsPerIteration = 100
  const numIterations = Math.ceil(numItems / maxItemsPerIteration)

  let iteration = 1
  let startIndex = 0
  let endIndex = maxItemsPerIteration

  const mergedResult = {
    Responses: {
      [ aTable ] : []
    }
  }

  while (iteration <= numIterations) {
    if (endIndex > numItems) {
      endIndex = numItems
    }

    const params = {
      RequestItems: {
        [ aTable ]: {
          Keys: anArrOfKeyValuePairs.slice(startIndex, endIndex)
        }
      }
    }

    try {
      const result = await new Promise(
        (resolve, reject) => {
          _docClientAK.batchGet(params, (err, data) => {
            if (err) {
              dbRequestDebugLog('tableBatchGet', params, err)

              reject(err)
            } else {
              resolve(data)
            }
          })
        })

      mergedResult.Responses[aTable] =
        mergedResult.Responses[aTable].concat(result.Responses[aTable])
    } catch (error) {
      dbRequestDebugLog('tableBatchGet', params, `${error}\nError Processing [${startIndex} : ${endIndex}) of ${numItems} elements.`)
    }

    iteration++
    startIndex += maxItemsPerIteration
    endIndex += maxItemsPerIteration
  }

  return mergedResult
}

export async function tablePut(aTable, anObject) {
  const params = {
    TableName: aTable,
    Item: anObject
  }

  return new Promise((resolve, reject) => {
    _docClientAK.put(params, (err, data) => {
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
    _docClientAK.query(params, (err, data) => {
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
  console.log("tableGetBySecondaryIndex")
  console.log("table: ", aTable, "index: ", anIndexName, "keyname: ", aKeyName, "keyvalue: ", aKeyValue)
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
      _docClientAK.query(params, (err, data) => {
        if (err) {
          dbRequestDebugLog('tableGetBySecondaryIndex', params, err)
          reject(err)
        } else {
          console.log("THE DATA: ", data)
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
    _docClientAK.update(params, (err, data) => {
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

  console.log("UPDATE PARAMS: ", params);

  return new Promise((resolve, reject) => {
    _docClientAK.update(params, (err, data) => {
      if (err) {
        dbRequestDebugLog('tableUpdateAppendNestedObjectProperty', params, err)

        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}
