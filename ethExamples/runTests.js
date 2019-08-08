const { createWallet, restoreWallet } = require('./ethWallet');
const testMnemonic = "day laundry wet frog census letter verify toe try biology love decrease";
runTests();

async function runTests() {
    //Create wallet
    console.log("Creating wallet...");
    const wallet = await createWallet();
    console.log(wallet);

    //Restore wallet
    console.log("Restoring wallet...");
    const restoredWallet = await restoreWallet(testMnemonic);
    console.log(restoredWallet);
}