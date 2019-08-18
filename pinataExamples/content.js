const pinataSDK = require('@pinata/sdk');
const pinata = pinataSDK('spiKey', 'apiSecretKey');
const rp = require('request-promise');

//This function will be one endpoint
function pinContent(contentToPin, devId, username, devSuppliedIdentifier) {
  const options = {
      pinataMetadata: {
        name: "SimpleID Pinata Content",
        keyvalues: {
            developer: devId,
            user: username, 
            devSuppliedIdentifier
        }
      },
      pinataOptions: {
        cidVersion: 0
      }
  };
  return pinata.pinJSONToIPFS(contentToPin, options).then((result) => {
    return result;
  }).catch((err) => {
    return err;
  });
}
//End pin endpoint

//These functions will be another endpoint -- the fetch endpoint
async function fetchContent(devId, username, devSuppliedIdentifier) {
  const pinnedContent = await fetchPins(devId, username, devSuppliedIdentifier);
  const content = await fetchFromGateway(pinnedContent.ipfs_pin_hash);
  return content;
} 

function fetchPins(devId, username, id) {
  const metadataFilter = {
    keyvalues: {
      developer: {
        value: devId,
        op: 'eq'
      }
    }
  };

  const filters = {
      status : 'pinned',
      pageLimit: 10,
      pageOffset: 0,
      metadata: metadataFilter
  };

  let userResults = [];

  return pinata.pinList(filters).then((result) => {
      const results = result.rows;
      for(const res of results) {
        if(res.metadata.keyvalues.user === username) {
          userResults.push(res);
        }
      }
  }).then(() => {
    for(const res of userResults) {
      if(res.metadata.keyvalues.devSuppliedIdentifier === id) {
        return res;
      }
    }
  }).catch((err) => {
      return err;
  });
}

function fetchFromGateway(hash) {
  return rp(`https://gateway.pinata.cloud/ipfs/${hash}`)
    .then(function (res) {
        return res;
    })
    .catch(function (err) {
        return err;
    });
}

//End fetch endpoint