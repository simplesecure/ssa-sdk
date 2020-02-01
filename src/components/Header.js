import React from 'reactn';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Image from 'react-bootstrap/Image';
import { closeWidget } from '../actions/postMessage';
import { getSidSvcs } from '../index';

export default class Header extends React.Component {
  render() {
    const { showWallet } = this.global;
    const signOutEl = showWallet === true ? (<Nav onClick={() => getSidSvcs().signOut()} className="header-sign-out">Sign Out</Nav>) : <Nav className="header-sign-out"/>
    return (
      <Navbar className="header-nav no-print" bg="dark" expand="lg">
        <Navbar.Brand className="brand-div"><Image className="sid-logo" src={require('../assets/img/full_logo.png')} alt="SimpleID favicon" /></Navbar.Brand>        
        {signOutEl}
        <Nav>
          <span onClick={() => closeWidget()} className="close-icon">X</span>
        </Nav>
      </Navbar>
    )
  }
}