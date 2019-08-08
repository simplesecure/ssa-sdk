const { Wallet } = require('ethers');

//Creates a wallet with a bip39 mnemonic
module.exports = {
    createWallet: function() {
        const wallet = Wallet.createRandom();
        return wallet;
    }, 
    restoreWallet(mnemonic) {
        const wallet = Wallet.fromMnemonic(mnemonic);
        return wallet;
    }
}