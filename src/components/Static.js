import React from 'reactn';

export default class Static extends React.Component {
  render() {
    const { scopes } = this.global;
    return (
      <div>
        <div className="text-center">
          <h3>This application is using SimpleID for authentication. </h3>
          <p>The application is requesting the following information: </p>
          <ul>
            <li>{scopes}</li>
          </ul>
        </div>
      </div>
    )
  }
}