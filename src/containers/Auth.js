import React, { setGlobal } from 'reactn';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import { signIn, approveSignIn } from '../actions/postMessage';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'

// eslint-disable-next-line
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})/g

export default class Auth extends React.Component {

  //
  // Event Handlers
  //////////////////////////////////////////////////////////////////////////////
  handleEmail = (e) => {
    setGlobal({ email: e.target.value });
  }

  handleCognitoPassword = (e) => {
    const password = e.target.value;
    const found = password.match(PASSWORD_REGEX);
    if (Array.isArray(found)) {
      setGlobal({ password: e.target.value, found: true });
    } else {
      setGlobal({ password: e.target.value, found: false });
    }
  }

  handleCode = (e) => {
    setGlobal({ token: e.target.value });
  }

  suppressDefaultSignIn = (e) => {
    console.log(`DBG: suppressDefaultSignIn`)
    e.preventDefault()
    signIn()
  }

  //
  // Renderers
  //////////////////////////////////////////////////////////////////////////////
  renderSignInApproval = () => {
    return (
      <div>
        <h5>Enter the code you received via email to continue</h5>
        <p>If you didn't receive a code, <span className="a-span" onClick={signIn}>try sending it again.</span></p>
        <Form onSubmit={approveSignIn}>
          <Form.Group controlId="formBasicEmail">
            <Form.Control onChange={this.handleCode} type="text" placeholder="123456" />
          </Form.Group>
          <Button variant="primary" type="submit">
            Approve Sign In
          </Button>
        </Form>
      </div>
    )
  }

  renderLoading = () => {
    return (
      <div>
        <div className="loader">
          <div className="loading-animation"></div>
        </div>
      </div>
    )
  }

  // Maps to unknown actions (i.e. default), which includes 'sign-in'
  renderEnterEmail = (theConfig) => {
    console.log("should not be rendering")
    return (
      <div>
        <h5>{theConfig.appName} is protecting you with <mark>SimpleID</mark></h5>
        {/*

        ////This can be used for eventual scopes an app may want to request. None to handle now, though////
        <p>The following information will be provided to the application if you log in: </p>
        <ul className="text-left">
          {
            theConfig.scopes ? theConfig.scopes.map(scope => {
              return (
                <li key={scope}>{scope.charAt(0).toUpperCase() + scope.slice(1)}</li>
              )
            }) :
            <li>No scopes requested</li>
          }
        </ul>
        */}
        <p>Get started with just an email.</p>
        <Form onSubmit={signIn}>
          <Form.Group controlId="formBasicEmail">
            <Form.Control onChange={this.handleEmail} type="email" placeholder="your.email@email.com" />
          </Form.Group>
          <Form.Text className="text-muted bottom-10">
            A one-time code will be emailed to you.
          </Form.Text>
          <Button variant="primary" type="submit">
            Continue
          </Button>
        </Form>
      </div>
    )
  }

  renderTooltip = () => {
    return (
      <Tooltip>Passwords must be 8 characters and include an uppercase, lowercase, number, and special character.</Tooltip>
    )

  }

  renderPasswordFlow = () => {
    const { found, email } = this.global
    return (
      <div>
        <h5>Sign Into Your SimpleID Wallet</h5>
        <p>All you need is an email and password.</p>
        <Form onSubmit={this.suppressDefaultSignIn}>
          <Form.Group controlId="formBasicEmail">
            <Form.Control onChange={this.handleEmail} type="email" placeholder="your.email@email.com" autoComplete="username" />
          </Form.Group>
          <Form.Group controlId="formPassword">
            <OverlayTrigger
              placement="top"
              delay={{ show: 250, hide: 400 }}
              overlay={this.renderTooltip()}
            >
              <Form.Control onChange={this.handleCognitoPassword} type="password" placeholder="Your password" autoComplete="current-password" />
            </OverlayTrigger>
            <Form.Text className="text-muted">
              If it's your first time using SimpleID, a verification code will be emailed to you.
            </Form.Text>
          </Form.Group>
          {(found && email) ? (
            <Button variant="primary" type="submit">
              Continue
            </Button>
          ) :(
            <Button disabled variant="primary">
              Continue
            </Button>
          )}
        </Form>
      </div>
    )

  }

  render = () => {
    const { action } = this.global;

    let containerElements = undefined
    switch (action) {
      case 'sign-in-approval':
        containerElements = this.renderSignInApproval()
        break
      case 'loading':
        containerElements = this.renderLoading()
        break
      case 'sign-in-hosted':
        containerElements = this.renderPasswordFlow()
        break;
      default: 
        containerElements = this.renderPasswordFlow()
    }

    return (
      <div className="container text-center">
        {containerElements}
      </div>
    )
  }
}
