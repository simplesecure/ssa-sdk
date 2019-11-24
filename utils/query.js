export class Query {
  constructor(provider) {}

  getBlockByNumber(blockNumber, fullTransaction) {
    return this.sendAsync('eth_getBlockByNumber', blockNumber, fullTransaction);
  }

  getCode(address, blockNumber) {
    return this.sendAsync('eth_getCode', address, blockNumber);
  }

  estimateGas(txParams) {
    return this.sendAsync('eth_estimateGas', txParams);
  }

  sendAsync(methodName, ...args) {
    return new Promise((resolve, reject) => {
      this.provider.sendAsync(
        {
          id: 42,
          jsonrpc: '2.0',
          method: methodName,
          params: args,
        },
        (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response.result);
          }
        },
      );
    });
  }
}