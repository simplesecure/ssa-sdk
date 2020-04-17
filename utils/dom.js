export function __createButton(configOptions) {
  const head = document.head || document.getElementsByTagName('head')[0]
  const linkEl = document.createElement('link')
  linkEl.rel = 'stylesheet'
  linkEl.href = 'https://use.fontawesome.com/releases/v5.0.6/css/all.css'

  head.appendChild(linkEl)

  const buttonEl = document.createElement('button')
  buttonEl.setAttribute('id', 'sid-chat-button');
  const backgroundColor = configOptions && configOptions.backgroundColor ? configOptions.backgroundColor : "#2568EF";
  const buttonStyles = {
    borderRadius: "50px",
    cursor: "pointer",
    position: "fixed",
    zIndex: "2000",
    bottom: "15px",
    right: "15px",
    color: "#fff",
    outline: "none",
    borderColor: "#00b8d8",
    backgroundColor,
    boxShadow: "none",
    fontWeight: "300",
    fontFamily: "Poppins,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
    border: "1px solid transparent",
    padding: "1rem 1rem",
    fontSize: ".875rem",
    lineHeight: "1.125",
    transition: "all 250ms cubic-bezier(.27,.01,.38,1.06)",
    textAlign: "center",
    verticalAlign: "middle"
  }

  Object.assign(buttonEl.style, buttonStyles)

  return buttonEl
}

export function __handleChatModal(modalConfig) {
  //  check if the chat modal exists before building it
  const existingModal = document.getElementById('sid-chat-modal')

  //  For now, we are just checking if the modal should be open or not,
  //  But we can pass through a lot of config options here to handle
  //  custom styling as the organization needs

  //***************************************************************//
  if(modalConfig.showModal) {
    //  Because we might just want to update the posts, we need to check
    //  if the modal exists yet. If it does, just feed posts
    //  bodyContainer is updated with new posts and needs to be available both
    //  insidethe if statement and out

    if(!existingModal) {
      //  Build up the entire chat widget
      //  First build the wrapper div
      const wrapperDiv = document.createElement('div')
      const wrapperDivStyles = {
        display: "block",
        height: "75vh",
        maxHeight: "600px",
        position: "fixed",
        zIndex: "2000",
        transition: "opacity .2s ease-in-out",
        top: "0",
        left: "0",
        overflow: "hidden",
        outline: "0",
        width: "100%"
      }
      Object.assign(wrapperDiv.style, wrapperDivStyles)

      //  Now we build up the dialog div
      const dialogDiv = document.createElement('div')
      const dialogDivStyle = {
        transition: "transform .3s ease-out",
        transform: "none",
        position: "fixed",
        top: "auto",
        left: "auto",
        bottom: "80px",
        right: "15px",
        width: "350px",
        height: "75vh",
        maxHeight: "600px",
        overflowY: "scroll",
        boxShadow: "0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)",
        borderRadius: "5px"
      }
      Object.assign(dialogDiv.style, dialogDivStyle)
      //  Attach the dialog div to the wrapper div
      wrapperDiv.appendChild(dialogDiv)

      //  Now we build up the content div
      const contentDiv = document.createElement('div')
      const contentDivStyles = {
        height: "75vh",
        maxHeight: "600px",
        overflowY: "scroll",
        boxShadow: "none",
        backgroundColor: "#fff",
        border: "none",
        borderRadius: ".5rem",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        pointerEvents: "auto"
      }
      Object.assign(contentDiv.style, contentDivStyles)
      //  Attach the content div to the dialog div
      dialogDiv.appendChild(contentDiv)

      //  Now we create the header div
      const headerDiv = document.createElement('div')
      const headerDivStyles = {
        position: "fixed",
        zIndex: "2000",
        width: "350px",
        background: "#fff",
        padding: ".9375rem 2.1875rem",
        borderBottom: "1px solid #dfe1e3",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        borderTopLeftRadius: "calc(.3rem - 1px)",
        borderTopRightRadius: "calc(.3rem - 1px)"
      }
      Object.assign(headerDiv.style, headerDivStyles)
      //  Attach the header div to the content div
      contentDiv.appendChild(headerDiv)

      //  Now create the text for the header
      const headerText = document.createElement('h5')
      const headerTextStyles = {
        lineHeight: "1.5",
        marginBottom: "0",
        fontSize: "1.25rem",
        fontFamily: "Poppins,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
        fontWeight: "400",
        color: "#212529",
        marginTop: "0"
      }
      Object.assign(headerText.style, headerTextStyles)
      const appName = modalConfig && modalConfig.config.appName ? `${modalConfig.config.appName} Chat 👋` : "Support Chat 👋"
      headerText.innerText = appName
      //  Attach the header text to the header div
      headerDiv.appendChild(headerText)

      //  Create p element that can link out to handling profile updates and linking
      // const headerP = document.createElement('p')
      // const headerPStyles = {
      //   textAling: "center",
      //   color: "#282828",
      //   fontSize: "10px",
      //   position: "absolute",
      //   right: "5px",
      //   bottom: "3px"
      // }
      // Object.assign(headerP.style, headerPStyles)
      // headerDiv.appendChild(headerP)

      // //  And now create the link
      // const anchorButton = document.createElement('button')
      // const anchorButtonStyles = {
      //   background: "none",
      //   border: "none",
      //   color: "#282828",
      //   fontSize: "10px"
      // }
      // Object.assign(anchorButton.style, anchorButtonStyles)
      // anchorButton.innerText = "See and control your data here"
      // headerP.appendChild(anchorButton)


      //  Now we build up the body container div
      const bodyContainerDiv = document.createElement('div')
      bodyContainerDiv.setAttribute('id', 'sid-chat-body')
      const bodyContainerDivStyles = {
        position: "relative",
        maxHeight: "600px",
        marginTop: "65px",
        marginBottom: "60px",
        overflow: "scroll",
        flex: "1 1 auto",
        padding: "1.875rem 2.1875rem"
      }
      Object.assign(bodyContainerDiv.style, bodyContainerDivStyles)
      //  Attach the header text to the header div
      contentDiv.appendChild(bodyContainerDiv)

      //  Now we build up the footer div
      const footerDiv = document.createElement('div')
      const footerDivStyles = {
        position: "fixed",
        width: "350px",
        zIndex: "2000",
        bottom: "80px",
        background: "#fff",
        padding: ".9375rem 2.1875rem",
        borderTop: "1px solid #dfe1e3",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "flex-end",
        textAlign: "center",
        borderBottomRightRadius: "calc(.3rem - 1px)",
        borderBottomLeftRadius: "calc(.3rem - 1px)"
      }
      Object.assign(footerDiv.style, footerDivStyles)
      //  Attach the header text to the header div
      contentDiv.appendChild(footerDiv)

      const poweredBy = document.createElement('p'); 
      poweredBy.style.width = "100%";     
      poweredBy.style.marginBottom = '-10px';
      const poweredByLink = document.createElement('a');
      poweredByLink.style.fontSize = '12px';
      poweredByLink.style.color = '#9a9a9a';
      poweredByLink.innerText = 'Powered By SimpleID';
      poweredByLink.setAttribute('href', 'https://simpleid.xyz');
      poweredByLink.setAttribute('target', '_blank');
      poweredBy.appendChild(poweredByLink);
      
      //  Create an input field for handling messages
      const inputEl = document.createElement('input')
      const inputElStyles = {
        height: "auto",
        padding: ".5rem 1rem",
        fontSize: ".95rem",
        lineHeight: "1.5",
        color: "#495057",
        backgroundColor: "#fff",
        border: "1px solid #becad6",
        fontWeight: "300",
        willChange: "border-color,box-shadow",
        borderRadius: ".375rem",
        boxShadow: "none",
        transition: "box-shadow 250ms cubic-bezier(.27,.01,.38,1.06),border 250ms cubic-bezier(.27,.01,.38,1.06)",
        display: "block",
        width: "100%"
      }
      Object.assign(inputEl.style, inputElStyles)
      inputEl.setAttribute('id', 'chat-input')
      inputEl.setAttribute('placeholder', 'Send a message...')
      //  Attach the header text to the header div
      footerDiv.appendChild(inputEl);

      //  Create send icon
      const sendIcon = document.createElement('i');
      sendIcon.setAttribute('class', 'far fa-paper-plane');
      sendIcon.setAttribute('id', 'send-button');
      sendIcon.style.cursor = 'pointer';
      sendIcon.style.position = 'absolute';
      sendIcon.style.color = 'rgb(154, 154, 154)';
      sendIcon.style.bottom = '40px';
      sendIcon.style.right = '45px'
      footerDiv.appendChild(sendIcon);

      footerDiv.appendChild(poweredBy);
      //  Apply an id for using on dom events
      wrapperDiv.setAttribute('id', 'sid-chat-modal')
      //  Now we apply the entire chat modal to document
      document.body.appendChild(wrapperDiv)
    }

    //  Here we loop through the posts and build up the actual body
    const bodyDiv = document.getElementById('sid-chat-body')
    try {
      for (const post of modalConfig.posts) {
        const thisPost = JSON.parse(post.message)
        const { message } = thisPost
        const postEl = document.createElement('div')
        const postElStyles = {
          float: modalConfig.box._3id._subDIDs[modalConfig.config.appId] === post.author ? "right" : "left",
          clear: "both",
          background: modalConfig.box._3id._subDIDs[modalConfig.config.appId] === post.author ? "#2568EF" : "#e1e5eb",
          padding: "10px",
          borderRadius: "30px",
          color: modalConfig.box._3id._subDIDs[modalConfig.config.appId] === post.author ? "#fff" : "#282828",
          marginBottom: "5px",
          fontSize: "12px"
        }
        postEl.innerHTML = message
        Object.assign(postEl.style, postElStyles)
        //  Attach to the body div
        if(bodyDiv) {
          bodyDiv.appendChild(postEl)
        }
      }
      bodyDiv.scrollTop = bodyDiv.scrollHeight
    } catch(e) {
      console.log(e)
    }
  } else {
    const chatModal = document.getElementById('sid-chat-modal')
    if(chatModal) {
      chatModal.parentNode.removeChild(chatModal)
    }
  }
}
