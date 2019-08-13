const { getDefaultProvider, Wallet, ContractFactory, Contract } = require('ethers');

module.exports = {
  createContract: async function(testMnemonic, abi, bytecode) {
    // Connect to the network
    let provider = getDefaultProvider('ropsten');

    // Load the wallet to deploy the contract with
    let initwallet = new Wallet.fromMnemonic(testMnemonic);
    const privateKey = initwallet.signingKey.keyPair.privateKey;
    console.log(privateKey);
    let wallet = new Wallet(privateKey, provider);
    // Deployment is asynchronous, so we use an async IIFE

    // Create an instance of a Contract Factory
    let factory = new ContractFactory(abi, bytecode, wallet);

    // Notice we pass in "Hello World" as the parameter to the constructor
    let contract = await factory.deploy("Hello World");

    // The address the Contract WILL have once mined
    console.log(contract.address);

    // The transaction that was sent to the network to deploy the Contract
    console.log(contract.deployTransaction.hash);
    // "0x159b76843662a15bd67e482dcfbee55e8e44efad26c5a614245e12a00d4b1a51"

    // The contract is NOT deployed yet; we must wait until it is mined
    await contract.deployed()

    // Done! The contract is deployed.
  }, 
  fetchContract: async function(contractAddress, abi) {
    // Connect to the network
    let provider = getDefaultProvider('ropsten');

    // We connect to the Contract using a Provider, so we will only
    // have read-only access to the Contract
    let contract = new Contract(contractAddress, abi, provider);
    let currentValue = await contract.getValue();

    return currentValue;
  }
}