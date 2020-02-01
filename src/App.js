import React, { setGlobal } from 'reactn';
import 'bootstrap/dist/css/bootstrap.min.css';
import './assets/css/theme.css';
import './assets/css/loader-pulse.css';
import './assets/css/styles.css';
import Header from './components/Header';
import Footer from './components/Footer';
import Auth from './containers/Auth';
import Modal from 'react-bootstrap/Modal';

export default class App extends React.Component {
  componentWillUnmount() {
    setGlobal({
      action: "sign-in",
      approval: false,
      pendingToken: false,
      config: {},
      email: "",
      token: "",
      password: "",
      error: "",
      subaction: ""
    })
  }

  render() {

    return (
      <Modal show={true}>
        <Header />
        <Modal.Body>
          <Auth />
        </Modal.Body>
        <Modal.Footer>
          <Footer />
        </Modal.Footer>
      </Modal>
    )
  }
}
