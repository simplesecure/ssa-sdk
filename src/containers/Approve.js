// Copyright (c) 2019 Stealthy Inc., All Rights Reserved


// TODO:  re-think. This is likely a sub-optimal way to share state w/o rerender.
// WARNING: Order is important for this require
import { getSidSvcs } from '../index.js'

import React, { setGlobal } from 'reactn';
import { getTxDetails } from '../actions/postMessage';
import Button from 'react-bootstrap/Button';
import { handleHash, returnSignedMessage, closeWidget, approveSignIn } from '../actions/postMessage';
const Tx = require('ethereumjs-tx').Transaction;
const ethers = require('ethers');
const Web3 = require('web3');
const keys = require('../utils/keys.json');
const INFURA_KEY = keys.INFURA_KEY;
let web3;

export default class Approve extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      gasFee: "0",
      web3Connected: false
    }
  }

  async componentDidMount() {
    await getTxDetails();
  }

  estimateGas = async () => {
    //FOR DEBUGGING AND TESTING:
    const { txDetails } = this.global;
    const gasFee = await web3.eth.estimateGas(txDetails.tx);
    this.setState({ gasFee });
    //console.log("THE FEE: ", ethers.utils.formatEther(gasFee));
  }

  //TODO: change this to a proper descriptive name
  submitPassword = async (e) => {
    e.preventDefault();
    const { txDetails, config, subaction, type } = this.global;
    const { gasFee } = this.state;
    const approval = await approveSignIn();
    console.log(approval);

    const address = approval.signingKey.address;
    console.log("ADDRESS: ", address);
    const provider = ethers.getDefaultProvider(config.network);

    if(subaction === "approve-msg") {
      if(approval.signingKey) {
        // const message = web3.utils.toUtf8(txDetails.tx.data);
        // console.log(message);
        const wallet = ethers.Wallet.fromMnemonic(approval.signingKey.mnemonic).connect(provider);
        const binaryData = ethers.utils.arrayify(txDetails.tx.data);

        const signPromise = await wallet.signMessage(binaryData)

        returnSignedMessage(signPromise);
      } else {
        setGlobal({ error: "Please verify your password is correct", password: "" });
      }
    } else {
      try {
        //console.log(keychain.toString(CryptoJS.enc.Utf8));
        if(approval.signingKey) {
          //Let's broadcast this transaction!
          setGlobal({ action: "loading" });
          txDetails.tx["nonce"] = await provider.getTransactionCount(address);
          console.log("TXDETAILS: ", txDetails.tx)
          //Now sign the tx
          let txx = new Tx(txDetails.tx, {chain: config.network })
          const privateKey = Buffer.from(approval.signingKey.keyPair.privateKey.substring(2), 'hex');
          console.log("PRIVATE KEY: ", privateKey);
          txx.sign(privateKey);
          const sTx = txx.serialize();
          console.log("STX: ", sTx);
          //Send the transaction
          const balance = await provider.getBalance(address);
          const etherBalance = ethers.utils.formatEther(balance);
          const fee = txDetails && txDetails.tx && txDetails.tx.value ? ethers.utils.formatEther(ethers.utils.bigNumberify(txDetails.tx.value).toString()) : "0";
          if(fee > etherBalance) {
            setGlobal({ action: "subaction", error: "Insufficient funds. Please make sure you have enough ether for this action.", password: "" })
          } else {
            const formattedGasFee = ethers.utils.formatEther(gasFee);
            const totalFee = parseFloat(formattedGasFee) + parseFloat(fee);
            if(totalFee > etherBalance) {
              setGlobal({ subaction: "", error: "Insufficient funds. Please make sure you have enough ether for this action.", password: "" })
            } else {
              try {
                if(type === "eth_signTransaction") {
                  handleHash('0x' + sTx.toString('hex'));
                } else {
                  //handleHash('0x' + sTx.toString('hex'));
                  web3.eth.sendSignedTransaction('0x' + sTx.toString('hex'))
                  .on('transactionHash', (hash) => {
                    console.log("Yo yo yo: ", hash);
                    handleHash(hash);
                  })
                }
              } catch(e) {
                console.log("TX ERROR: ", e);
              }
            }
          }
        } else {
          //something went wrong
          console.log("Error")
          setGlobal({ error: "Please verify your password is correct", password: "" });
        }
      } catch(err) {
        console.log("ERROR ", err);
        setGlobal({ subaction: "", error: "Please verify your password is correct", password: "" });
      }
    }
  }

  handlePassword = (e) => {
    setGlobal({ password: e.target.value });
  }

  connectWebThree = () => {
    const { config } = this.global;
    web3 = new Web3(new Web3.providers.HttpProvider(`https://${config.network}.infura.io/v3/${INFURA_KEY}`));
    this.setState({ web3Connected: true });
  }

  approveTransaction = async (actionType) => {
    console.log("ACTION TYPE: ", actionType);
    const { txDetails, config, type } = this.global;
    const { gasFee } = this.state;
    console.log("APPROVE IT!")
    //TODO: Update this to fetch from iframe local storage
    // const email = "justin@simpleid.xyz";
    const email = getSidSvcs().getEmail()
    console.log('*************************************************************')
    console.log(`DBG: Email from SID Services = ${email}`)

    //Updating state to reflect the approval screen
    await setGlobal({ subaction: actionType, error: "", email, nonSignInEvent: true })
    //Here we are firing off an approval token to the user's email

    // signIn();
    if (getSidSvcs().isAuthenticated()) {
      setGlobal({ action: "loading" });
      const address = getSidSvcs().getWalletAddress()
      console.log(`DBG: Wallet address from SID Services = ${address}`)

      const wallet = await getSidSvcs().getWallet()
      console.log('DBG: After rebuilding user\'s wallet with existing tokens.')
      console.log('DBG: DELETE this comment after debugging / system ready')
      console.log('*******************************************************')
      console.log('Eth Wallet:')
      console.log(wallet);
      //const address = wallet.signingKey.address;
      console.log("ADDRESS: ", address);
      const provider = ethers.getDefaultProvider(config.network);

      if(actionType === "approve-msg") {
        if(wallet.signingKey) {
          // const message = web3.utils.toUtf8(txDetails.tx.data);
          // console.log(message);
          await ethers.Wallet.fromMnemonic(wallet.signingKey.mnemonic).connect(provider);
          const binaryData = ethers.utils.arrayify(txDetails.tx.data);

          const signPromise = await wallet.signMessage(binaryData)

          returnSignedMessage(signPromise);
        } else {
          setGlobal({ error: "Please verify your password is correct", password: "" });
        }
      } else {
        try {
          //console.log(keychain.toString(CryptoJS.enc.Utf8));
          if(wallet.signingKey) {
            //Let's broadcast this transaction!
            txDetails.tx["nonce"] = await provider.getTransactionCount(address);
            console.log("TXDETAILS: ", txDetails.tx)
            //Now sign the tx
            let txx = new Tx(txDetails.tx, {chain: config.network })
            const privateKey = Buffer.from(wallet.signingKey.keyPair.privateKey.substring(2), 'hex');
            console.log("PRIVATE KEY: ", privateKey);
            txx.sign(privateKey);
            const sTx = txx.serialize();
            console.log("STX: ", sTx);
            //Send the transaction
            const balance = await provider.getBalance(address);
            const etherBalance = ethers.utils.formatEther(balance);
            const fee = txDetails && txDetails.tx && txDetails.tx.value ? ethers.utils.formatEther(ethers.utils.bigNumberify(txDetails.tx.value).toString()) : "0";
            if(fee > etherBalance) {
              setGlobal({ action: "subaction", error: "Insufficient funds. Please make sure you have enough ether for this action.", password: "" })
            } else {
              const formattedGasFee = ethers.utils.formatEther(gasFee);
              const totalFee = parseFloat(formattedGasFee) + parseFloat(fee);
              if(totalFee > etherBalance) {
                setGlobal({ subaction: "", error: "Insufficient funds. Please make sure you have enough ether for this action.", password: "" })
              } else {
                try {
                  console.log("TYPE: ", type);
                  if(type === "eth_signTransaction") {
                    handleHash('0x' + sTx.toString('hex'));
                  } else {
                    //handleHash('0x' + sTx.toString('hex'));
                    console.log("Sending transaction...")
                    web3.eth.sendSignedTransaction('0x' + sTx.toString('hex'))
                    .on('transactionHash', (hash) => {
                      console.log("Yo yo yo: ", hash);
                      handleHash(hash);
                    })
                  }
                } catch(e) {
                  console.log("TX ERROR: ", e);
                }
              }
            }
          } else {
            //something went wrong
            console.log("Error")
            setGlobal({ error: "Please verify your password is correct", password: "" });
          }
        } catch(err) {
          console.log("ERROR ", err);
          setGlobal({ subaction: "", error: "Please verify your password is correct", password: "" });
        }
      }
    } else {
      // TODO: we'll need to sign the user in again (may need to sign in)
    }
  }

  render() {
    const { txDetails, config, action, error, subaction } = this.global;
    const { gasFee, web3Connected } = this.state;
    //console.log("CONFIG: ", config);
    if(!web3Connected && config.network) {
      this.connectWebThree();
    }
    //console.log(txDetails && txDetails.tx ? await web3.eth.estimateGas(txDetails.tx) : "Not ready yet")
    if(txDetails && txDetails.tx) {
      this.estimateGas();
    }
    //console.log(txDetails && txDetails.tx ? ethers.utils.formatEther(ethers.utils.bigNumberify(txDetails.tx.value).toString()) : "Blamo");
    return (
      <div>
        <div className="container text-center">
          {
            action === "loading" ?
            <div>
              <h5>Processing...</h5>
              <div className="loader">
                <div className="loading-animation"></div>
              </div>
            </div> :
            action === "transaction" ?
            <div>
              <h5>Approve Action?</h5>
              {
                subaction !== 'approve-tx' ?
                <div>
                  <div className="text-left">
                    <p>App: <mark>{txDetails.appName}</mark></p>
                    {
                      txDetails && txDetails.tx && txDetails.tx.value ?
                      <p>Amount (in eth): <mark>{txDetails && txDetails.tx ? ethers.utils.formatEther(ethers.utils.bigNumberify(txDetails.tx.value).toString()) : ""}</mark></p>:
                      <p></p>
                    }
                    <p>Est. Fee (in eth): <mark>{ethers.utils.formatEther(gasFee)}</mark></p>
                  </div>
                </div> :
                <div />
              }
              {/*
                subaction === "approve-tx" ?
                <div>
                  <h5>Enter the code you received via email to continue</h5>
                  <p>If you didn't receive a code, <span className="a-span" onClick={() => setGlobal({ auth: true, action: "sign-in"})}>try sending it again.</span></p>
                  <Form onSubmit={this.submitPassword}>
                    <Form.Group controlId="formBasicEmail">
                      <Form.Control onChange={(e) => setGlobal({ token: e.target.value})} type="text" placeholder="123456" />
                    </Form.Group>
                    <Button variant="primary" type="submit">
                      Approve
                    </Button>
                  </Form>
                </div>
                :
                <Button variant="primary" onClick={() => this.approveTransaction("approve-tx")}>
                  Approve
                </Button>
              */}
              <Button variant="primary" onClick={() => this.approveTransaction("approve-tx")}>
                  Approve
              </Button>
              <Button onClick={() => closeWidget(false)} variant="seconday" type="">
                Reject
              </Button>
              <p className="text-danger error-message">{error}</p>

            </div> :
            <div>
              <h5>Approve Action</h5>
              <div className="text-left">
              <p>App: <mark>{txDetails.appName}</mark></p>
              <p>Message To Sign: <mark>{txDetails && txDetails.tx && web3Connected ? web3.utils.toUtf8(txDetails.tx.data) : ""}</mark></p>
              {/*
                subaction === "approve-msg" ?
                <div>
                  <Form onSubmit={this.submitPassword}>
                    <Form.Group controlId="formBasicEmail">
                      <Form.Control onChange={(e) => setGlobal({ token: e.target.value})} type="text" placeholder="123456" />
                    </Form.Group>
                    <Button variant="primary" type="submit">
                      Approve
                    </Button>
                  </Form>
                </div> :
                <Button variant="primary" onClick={() => this.approveTransaction("approve-msg")}>
                  Approve
                </Button>
              */}
              <Button onClick={() => closeWidget(false)} variant="seconday" type="">
                Reject
              </Button>
              <Button variant="primary" onClick={() => this.approveTransaction("approve-msg")}>
                Approve
              </Button>
              <p className="text-danger error-message">{error}</p>
            </div>
          </div>
          }
        </div>
      </div>
    )
  }
}
