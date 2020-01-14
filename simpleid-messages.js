const ACTIVE_SID_MESSAGE = "active-sid-message"
const head = document.head || document.getElementsByTagName('head')[0]
const linkEl = document.createElement('link');
linkEl.rel = 'stylesheet';
linkEl.href = 'https://use.fontawesome.com/releases/v5.0.6/css/all.css';

const bellIcon = document.createElement('i');
bellIcon.setAttribute('class', 'far fa-bell');
bellIcon.style.color = "#fff";
bellIcon.style.fontSize = "20px";

const buttonEl = document.createElement('button');
buttonEl.appendChild(bellIcon);
buttonEl.style.width = "60px";
buttonEl.style.height = "60px";
buttonEl.style.background = "#2568EF";
buttonEl.style.border = "none";
buttonEl.style.borderRadius = "50%";
buttonEl.style.cursor = "pointer";
buttonEl.style.boxShadow = "0 3px 7px rgba(0,0,0,0.12)"
buttonEl.style.position = "fixed";
buttonEl.style.zIndex = "1024";
buttonEl.style.bottom = "15px";
buttonEl.style.right = "15px";
buttonEl.setAttribute('id', 'appMessageButton');
buttonEl.onclick = function() {
  loadMessages();
}

const alertDiv = document.createElement('div');
alertDiv.style.background = "red";
alertDiv.style.width = "8px";
alertDiv.style.height = "8px";
alertDiv.style.borderRadius = "50%";
alertDiv.style.position = "absolute";
alertDiv.style.bottom = "32px";
alertDiv.style.right = "22px";

buttonEl.appendChild(alertDiv);

const messageEl = document.createElement('div');
messageEl.style.width = "300px";
messageEl.style.height = "85vh";
messageEl.style.position = "fixed";
messageEl.style.zIndex = "1024";
messageEl.style.right = "15px";
messageEl.style.bottom = "15px";
messageEl.style.background = "#fff";
messageEl.style.borderRadius = "5px";
messageEl.style.boxShadow = "0 3px 7px rgba(0,0,0,0.12)"
messageEl.style.paddingTop = "15px";

const closeButton = document.createElement('button');
closeButton.setAttribute('id', 'messagesClose');
closeButton.style.border = "none";
closeButton.style.position = "absolute";
closeButton.style.right = "10px";
closeButton.style.top = "10px";
closeButton.style.background = "#fff";
closeButton.style.cursor = "pointer";

closeButton.innerText = "Dismiss";
closeButton.onclick = function() {
  dismissMessages();
}

messageEl.appendChild(closeButton);

// window.onload = function() {
//   head.appendChild(linkEl);
//   loadButton();
// };

export function loadButton() {
  head.appendChild(linkEl);
  document.body.appendChild(buttonEl);
}

export function loadMessages() {
  const messageData = JSON.parse(localStorage.getItem(ACTIVE_SID_MESSAGE))
  console.log(messageData)
  buttonEl.style.display = "none";

  let mainDiv = document.createElement('div');
  mainDiv.style.width = '100%';
  mainDiv.style.height = '100%';
  mainDiv.style.zIndex = '1024';
  mainDiv.style.border = "none";
  
  let secondDiv = document.createElement('div')
  mainDiv.appendChild(secondDiv)
  secondDiv.setAttribute('class', 'message-body')
  let thirdDiv = document.createElement('div');
  thirdDiv.innerHTML = messageData.notification.content
  secondDiv.appendChild(thirdDiv)

  mainDiv.style.width ="100%"
  secondDiv.style.padding = "15px"

  thirdDiv.style.fontSize = "16px"
  thirdDiv.style.marginBottom = "10px"

  
  messageEl.appendChild(mainDiv);
  document.body.appendChild(messageEl);
}

export function dismissMessages() {
  messageEl.style.display = "none";
}