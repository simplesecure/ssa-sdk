import React from 'reactn';
import { getSidSvcs } from '../index';
import Button from 'react-bootstrap/Button'
import { walletPDF } from '../actions/dataProcessing';
import { finishSignUp } from '../actions/postMessage';
const Web3 = require('web3');
const INFURA_KEY = process.env.REACT_APP_INFURA_KEY;
let web3;

export default class Wallet extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      balance: "", 
      showMnemonic: false, 
      processing: false,
      mnemonic: ""
    }
  }
  async componentDidMount() {
    const { network } = this.global;
    web3 = new Web3(new Web3.providers.HttpProvider(`https://${network}.infura.io/v3/${INFURA_KEY}`));
    const wallet = getSidSvcs().getWalletAddress();
    const weiBalance = await web3.eth.getBalance(wallet);
    const balance = parseFloat(web3.utils.fromWei(weiBalance)).toFixed(8);
    this.setState({ balance });
  }

  getMnemonic = async () => {
    this.setState({ processing: true });
    const wallet = await getSidSvcs().getWallet();
    this.setState({ processing: false, mnemonic: wallet.signingKey.mnemonic });
  }

  handleDone = () => {
    const { signUpMnemonicReveal } = this.global;
    if(signUpMnemonicReveal) {
      finishSignUp();
    } else {
      this.setState({ showMnemonic: false })
    }
  }

  renderWallet() {
    const { network } = this.global;
    const { balance } = this.state;
    const wallet = getSidSvcs().getWalletAddress();
    return (
      <div>
        <h5>Your Wallet</h5>
        <p>Address: <br/><span title={wallet}>{wallet.substring(0, 22)}...</span></p>
        <p>Balance: <span>{balance} eth</span></p>
        <a href={network === 'mainnet' ? `https://etherscan.io/address/${wallet}` : `https://${network}.etherscan.io/address/${wallet}`} target="_blank" rel="noreferrer noopener"><Button variant="primary">
          View On Etherscan
        </Button></a>
        <div className="mnemonic-div">
          <p><button onClick={() => this.setState({ showMnemonic: true })} className="a-el-fix">Export wallet</button></p>
        </div>
      </div>
    )
  }

  renderMnemonic() {
    const { processing, mnemonic } = this.state;
    const { signUpMnemonicReveal } = this.global;
    console.log("PROCESSING: ", processing);
    console.log("MNEMONIC: ", mnemonic);
    let pEl;
    if(!processing && !mnemonic && signUpMnemonicReveal) {
      pEl = "Since your wallet was just created, you should save the back-up phrase. You will only need this if you want to move your wallet to another provider."
    } else if(processing && !mnemonic) {
      pEl = "Decrypting..."
    } else if(!processing && mnemonic) {
      pEl = (<code>{mnemonic}</code>)
    } else {
      pEl = "By clicking the button below, your wallet seed phrase will be decrypted and show. Make sure you do this in private. You can export the seed phrase to a PDF after it's been revealed."
    }
    const seedEl = processing && !mnemonic ? "" : !processing && mnemonic ? "Seed Phrase: " : "";
    //const pEl = processing && !mnemonic ? "Decrypting..." : !processing && mnemonic ? (<code>{mnemonic}</code>) : "By clicking the button below, your wallet seed phrase will be decrypted and show. Make sure you do this in private. You can export the seed phrase to a PDF after it's been revealed."
    const buttonEl = processing && !mnemonic ? (<div />) : !processing && mnemonic ? (<Button className="no-print" onClick={() => walletPDF(mnemonic)} variant="primary">Download</Button>) : (<Button className="no-print" onClick={this.getMnemonic} variant='primary'>
      Reveal
    </Button>)
    return(
      <div>
        <h5 className="no-print">Export Wallet</h5>
        <p id='mnemonic-print'>{seedEl}{pEl}</p>
        {buttonEl}
        <Button className="no-print" onClick={this.handleDone} variant='secondary'>
          Done
        </Button>
      </div>
    )
  }
  render() {
    const { showMnemonic } = this.state;
    const { signUpMnemonicReveal } = this.global;

    const elementToShow = showMnemonic || signUpMnemonicReveal ? this.renderMnemonic() : this.renderWallet();
    return (
      <div>
        {elementToShow}
      </div>
    )
  }
}