import { SIMPLEID_USER_SESSION,
         __fetchNotifications,
         __issueWebApiCmd,
         __getUserData,
         validUserData,
         __handle3BoxConnection,
         __connectToSpace,
         __accessThread,
         __getPosts,
         __getConsent
        } from './utils/helpers.js'

import { __createButton,
         __handleChatModal } from './utils/dom.js'

import { getLog,
         setDebugScope,
         setAllDebugScopes } from './utils/debugScopes.js'

import humanId from 'human-id'
const log = getLog()
const IdentityWallet = require('identity-wallet')
const ethers = require('ethers')

const SEED_KEY = '3box-key'



export default class SimpleID {
  /*****************************************************************************
   *
   * Public Methods
   *
   ****************************************************************************/

  constructor(params) {
    this.config = params
    this.appName = params.appName
    this.appId = params.appId
    this.appOrigin = params.appOrigin
    this.chatAddress = params.chatAddress
    this.renderNotifications = params.renderNotifications
    this.activeNotifications = []

    this.userEthAddr = ""
    this.box = {}
    this.space = {}
    this.profile = {}
    this.mainThread = {}
    this.thread = {}
    this.posts = []

    this.handleLiveChat = this.handleLiveChat()
    this.storeEventStatus = undefined
    this.passUserInfoStatus = undefined
  }

  /**
   *  passUserInfo:
   *
   *    Apps call this *** ONCE *** to register a user's information with
   *    simple ID.  They pass in a userInfo object which is:
   *
   *      userInfo = {
   *        email:   <an email address - optional>,
   *        address: <a wallet address - required>
   *      };
   *
   *    Calling this more than once in a session results in warnings being
   *    presented in the console unless the first call resulted in an error,
   *    in which case subsequent calls can be made until success.
   *
   *    @returns A string 'success' or an error string.
   */
  async passUserInfo(userInfo) {
    const { enableChat } = this.config
    const method = 'SimpleID::passUserInfo'

    // Inexpensive test to see if this has been called already:
    //
    if (this.passUserInfoStatus) {
      const msg = `${method}: This method is only intended to be called once per session. Ignoring this call. This warning occurs when this method is called in the wrong place (i.e. the render method).`
      log.warn(msg)
      return msg
    }

    // More expensive test to see if this has been called already:
    // (sign out will clear session data, we'll need to tell devs to tie
    //  their sign out process to ours to clear this key from local storage TODO)
    let sessiondata = undefined
    try {
      sessiondata = localStorage.getItem(SIMPLEID_USER_SESSION)
      log.debug('Checking session data:')
      log.debug(sessiondata)
      if (validUserData(sessiondata)) {
        const msg = `${method}: This method is only intended to be called once per session. Ignoring this call. This warning occurs when this method is called in the wrong place (i.e. the render method).`
        log.warn(msg)
        return msg
      }
    } catch (suppressedError) {}

    // Check to make sure that at least the wallet address has been specified
    //
    if (!userInfo.address) {
      const msg = `${method}: This method requires a valid address property passed in through userInfo.  userInfo.address=${userInfo.address}`
      log.error(msg)
      return msg
    }

    this.passUserInfoStatus = 'processing'

    let result = undefined
    let newUser = undefined
    try {
      const cmdObj = {
        command: 'registerUserV2',
        data: {
          appId: this.appId,
          email: userInfo.email,
          address: userInfo.address
        }
      }
      const webApiResult = await __issueWebApiCmd(cmdObj)
      log.debug(`passUserInfo: webApiResult is ${JSON.stringify(webApiResult, 0, 2)}`)
      if (webApiResult.error) {
        throw new Error(webApiResult.error)
      }
      newUser = webApiResult.data
    } catch (error) {
      this.passUserInfoStatus = undefined
      const msg = `${method}: Failed registering user data.\n${error}`
      log.error(msg)
      result = msg
    }

    try {
      if (validUserData(newUser)) {
        log.debug(`Writing local storage:\nkey:${SIMPLEID_USER_SESSION}\nvalue:${JSON.stringify(newUser)}\n`)
        localStorage.setItem(SIMPLEID_USER_SESSION, JSON.stringify(newUser))
        this.passUserInfoStatus = 'complete'
        result = 'success'
        log.info(`${method}: Succeeded.`)
      } else {
        throw new Error(`User data returned from passUserInfo is not valid.`)
      }
    } catch (error) {
      this.passUserInfoStatus = undefined
      const msg = `${method}: Failed writing session to local storage.\n${error}`
      log.error(msg)
      result = msg
    }

    if (result === 'success') {
      //TODO: need to make this happen without a refresh
      const delayMs = 2000
      setTimeout( () => { this.notifications() }, delayMs)
    }

    return result
  }

  async notifications() {
    try {
      return await __fetchNotifications(
        this.appId, this.renderNotifications, this.config)
    } catch (error) {
      log.warn(`Failed to fetch notifications.\n${error}`)
      return []
    }
  }

  async storeEvent(data) {
    let result = undefined
    const method = 'SimpleID::storeEventData'
    if (!this.userEthAddr ||
        !this.appId ||
        !this.appName ||
        !this.appOrigin
    ) {
      const msg = `${method}: invalid parameters.\n`
      log.error(msg)
      result = msg
    } else {
      try {
        const cmdObj = {
          command: 'storeEventData',
          data: JSON.stringify({
          	"userId": this.userEthAddr,
          	"event": data.type,
          	"eventProperties": data.properties,
          	"groupId": this.appId,
            "appId": this.appId,
          	"groupName": this.appName,
          	"page": "demoAppHome",
          	"url": this.appOrigin
          })
        }
        const webApiResult = await __issueWebApiCmd(cmdObj)
        log.debug(`storeEventData: webApiResult is ${JSON.stringify(webApiResult, 0, 2)}`)
        if (webApiResult.error) {
          throw new Error(webApiResult.error)
        }
        result = webApiResult
      } catch (error) {
        this.storeEventStatus = undefined
        const msg = `${method}: Failed storing event data.\n${error}`
        log.error(msg)
        result = msg
      }
    }
    return result
  }

  signOut() {
    try {
      localStorage.removeItem(SIMPLEID_USER_SESSION)
    } catch (suppressedError) {}
    window.location.reload();
  }

  // TODO: talk w/ Justin about whether not including this in the public api is
  //       an oversight.
  getUserData() {
    return __getUserData()
  }

  /*
 *
 *
    // This is how we will build up the support or sales live chat widget
    // Ideally, we would create a react component here, but for non-react
    // apps, that would not be a good idea.
 *
 *
*/

  async handleLiveChat() {
    if(this.chatAddress) {
      //Check local storage for the 3box key
      const localKey = localStorage.getItem(SEED_KEY)
      let seed
      if(localKey) {
        //If the key exists set it and move on
        seed = localKey
        let wallet = new ethers.Wallet(seed)
        const { signingKey } = wallet
        const { address } = signingKey
        this.userEthAddr = address
      } else {
        //If no key exists, create a new one
        let randomWallet = ethers.Wallet.createRandom()
        const { signingKey } = randomWallet
        const { privateKey, address } = signingKey
        this.userEthAddr = address
        seed = privateKey
        localStorage.setItem(SEED_KEY, seed)
      }

      const idWallet = new IdentityWallet(__getConsent, { seed })
      this.idWallet = idWallet
      this.box = await __handle3BoxConnection(idWallet)
      // Check if the 3box profile has a name already
      try {
        let profile = await this.box.public.all()
        if(!profile.name) {
          //  If no name, let's create a human readbale name
          //  This can be updated later by the user
          const readableName = humanId()
          await this.box.public.set('name', readableName)
          //  It's set, now fetch it back
          this.profile = await this.box.public.all()
        } else {
          this.profile = profile
        }
      } catch(e) {
        console.log(e)
      }
      this.space = await __connectToSpace(this.box, this.appId)
      const fullAddress = `/orbitdb/${this.chatAddress}/3box.thread.${this.appId}.${this.appId}`
      console.log(fullAddress)
      this.mainThread = await __accessThread(this.space, this.appId, fullAddress)
      console.log("Getting main thread posts...")
      let posts = await __getPosts(this.mainThread)
      this.mainThread.onUpdate(async() => {
        console.log("Getting main thread posts...")
        posts = await __getPosts(this.mainThread)
      })
      this.thread = await __accessThread(this.space, this.appId)
      this.thread.onUpdate(async() => {
        console.log("Gettings new posts...")
        const buttonEl = document.getElementById('sid-chat-button')
        this.posts = await __getPosts(this.thread)
        const lastPost = this.posts[this.posts.length - 1]
        if(this.box._3id._subDIDs[this.appId] !== lastPost.author) {
          const notificationEl = document.createElement('span')
          notificationEl.innerText = "!"
          notificationEl.setAttribute('id', 'sid-chat-notification')
          const notificationElStyles = {
            position: "absolute",
            top: "-5px",
            right: "-3px",
            borderRadius: "50px",
            width: "15px",
            height: "15px",
            fontSize: "8px",
            background: "red",
            padding: "3px"
          }
          Object.assign(notificationEl.style, notificationElStyles)
          buttonEl.appendChild(notificationEl)
        }

        const bodyDiv = document.getElementById('sid-chat-body')
        if(bodyDiv) {
          bodyDiv.innerHTML = null
          try {
            for (const post of this.posts) {
              const thisPost = JSON.parse(post.message)
              const { message } = thisPost
              const postEl = document.createElement('div')
              const postElStyles = {
                float: this.box._3id._subDIDs[this.appId] === post.author ? "right" : "left",
                clear: "both",
                background: this.box._3id._subDIDs[this.appId] === post.author ? "#2568EF" : "#e1e5eb",
                padding: "10px",
                borderRadius: "30px",
                color: this.box._3id._subDIDs[this.appId] === post.author ? "#fff" : "#282828",
                marginBottom: "5px",
                fontSize: "12px"
              }
              postEl.innerText = message
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
        }
      })
      this.posts = await __getPosts(this.thread)
      if(posts) {
        //Need to see if our thread is in the list of posts
        try {
          const filteredPosts = posts.filter(a => JSON.parse(a.message).message === this.thread.address)
          if(filteredPosts < 1 || !filteredPosts) {
            const { name } = this.profile
            const post = {
              name,
              message: this.thread.address
            }
            await this.mainThread.post(JSON.stringify(post))
          }
        } catch(e) {
          console.log(e)
        }
      } else {
        const { name } = this.profile
        const post = {
          name,
          message: this.thread.address
        }
        await this.mainThread.post(JSON.stringify(post))
      }

      this.__buildChatWidget()
    }
  }

  __buildChatWidget() {
    //  First we need to create the button
    const button = __createButton()
    let chatModal = document.getElementById('sid-chat-modal')
    if(chatModal) {
      button.innerText = "X"
    } else {
      button.innerText = "?"
    }

    button.onclick = () => {
      chatModal = document.getElementById('sid-chat-modal')
      if(chatModal) {
        const config = {
          showModal: false,
          posts: this.posts,
          config: this.config,
          box: this.box
        }
        __handleChatModal(config)
        button.innerText = "?"
      } else {
        const config = {
          showModal: true,
          posts: this.posts,
          config: this.config,
          box: this.box
        }
        __handleChatModal(config)
        button.innerText = "X"
        const inputEl = document.getElementById('chat-input')
        if(inputEl) {
          inputEl.onfocus = () => {
            const notificationEl = document.getElementById('sid-chat-notification')
            if(notificationEl) {
              notificationEl.parentNode.removeChild(notificationEl)
            }
          }
        }
          inputEl.onkeypress = async (e) => {
            if(e.key === 'Enter'){
              const message = inputEl.value
              try {
                const { name } = this.profile
                const post = {
                  name,
                  message
                }
                await this.thread.post(JSON.stringify(post))
                inputEl.value = ""
              } catch(e) {
                console.log(e)
              }
            }
        }
      }
    }
    document.body.appendChild(button)
    const config = {
      showModal: chatModal ? true : false,
      posts: this.posts,
      config: this.config,
      box: this.box
    }
    __handleChatModal(config)
  }
}



// Workaround for queck and easy debug from browser console
//
// TODO:
//       - Analyze as exposure of security problem.
//
if (window) {
  window.sid = {
    debugScope: function(aScope, aLevel=undefined) {
      setDebugScope(aScope, aLevel)
    },
    debugAll: function() {
      "use strict";
      setAllDebugScopes();
    },
    debugOff: function() {
      "use strict";
      setAllDebugScopes('INFO');
    }
  }
}
