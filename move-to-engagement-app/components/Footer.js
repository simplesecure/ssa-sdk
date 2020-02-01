import React from 'reactn';

export default class Footer extends React.Component {
  renderPasswordMessage = () => {
    return (
      <div className="no-print">
        <p className="footer-text text-muted">Having trouble with your password? We can help! Contact us at <a href="mailto:support@simpleid.xyz">support@simpleid.xyz</a>.</p>
      </div>
    )
  }

  renderRegularFlow = () => {
    return (
      <div className="no-print">
        <p className="footer-text text-muted"><a href="https://simpleid.xyz">SimpleID</a> provides secure, non-custodial access to blockchain apps.</p>
      </div>
    )
  }
  render() {
    const { config } = this.global;
    let containerEl = this.renderRegularFlow()
    if(config.appId === '00000000000000000000000000000000') {
      containerEl = this.renderPasswordMessage()
    }
    return (
      <div>
        {containerEl}
      </div>
    )
  }
}