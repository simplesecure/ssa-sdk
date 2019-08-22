const Wallet = require('@textile/wallet').default;
const wallet = Wallet.fromWordCount(12)
wallet.recoveryPhrase = phrase //This will need to be the mnemonic we decrypt from the DB
return wallet.accountAt(0).keypair.secret();