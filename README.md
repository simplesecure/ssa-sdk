# SimpleID Javascript SDK

This is the JavaScript SDK for SimpleID, a framework for allowing users to authenticate into your app in a far more secure way than traditional usernames and passwords while still giving them the convenience of that same flow.

---
To test:

1. Clone the repo  
2. `cd client-sdk`  
3. `npm install`  
4. `npm test` 
---

### How's it work?

The simple description is users provide a username like they would any other app. That username's availability is checked. If available, the user can create the account with a password. So far, this is exactly like every other traditional authentication method. But here's comes the difference. 

Behind the scenes, that user is creating a decentralized identity anchored to the bitcoin blockchain. They are also creating encryption keys that will be used to encrypt all of their data client-side before it ever leaves their computer. 

This is a zero-knowledge SDK, so developers implementing it will not be able to access user keys* and we, the utility providing this SDK, will not be able to access user keys**.

*It's important to note here that bad actors could develop an app that takes this client-side code and uses it in nefarious ways. We do not claim to prevent that, but we do provide the tools to avoid applications and developers having to store user data on their own servers and databases. 

**We really really can't access the keys. There's nothing in our power that would allow us to act in a nefarious way. That's by design.

So what does the user get out of this exactly? They get the simple login flow they're used to, but they get the added benefits of encryption, protection against snooping, and security. 

### Quick Start 

The first thing you'll want to do is install the package: 

`npm i simpleid-js-sdk`  

This SDK currently has just two simple functions, making life as easy as possible for you. The createUserAccount and the login functions take very specific parameters. When creating a user account, you will need to pass two objects in a specific order. Those objects are: `credObj` and `appObj` in that order. 

Here's a breakdown of the `credObj`: 

```
const credObj = {
    id: ${availableName}, //This is the name the user selects and will be checked against existing registered names automatically.
    password: ${userPassword}, //This should be a complex password supplied by the user 
    hubUrl: ${storageHubURL}, //This will likely be "http://hub.blockstack.org" but can be any storage hub you allow
    email: ${emailToUse} //Email address for the user, used during account recovery
}
```

And here's a breakdown of the `appObj`: 

```
const appObj = { 
    appOrigin: "https://yourappdomain.com", //This is the domain for your app
    scopes: ['store_write', 'publish_data', 'email'] //These are the scopes you are requesting to use
}
```

Some definitions and notes on the `credObj` and `appObj` parameters: 

`password` - Your users will need to be notified that this password cannot be reset. If they lose it, they lose access to their data.  
`hubUrl` - Should you choose to provide your own storage hub for users, you can supply the hub url here or you can allow users to type in their own hub url. However, if neither of those exists, it's important to send the default hub url: "https://hub.blockstack.org"  
`appOrigin` - When you register your app and receive your API key, your app origin is also registered. This must match what is sent in the `appObj` parameters. 

When logging in, you'll need to supply a little more info, and that info can vary. Therefore, you'll send a single object with the `login()` function.

Here's a breakdown of what should be included in that object: 

```
//If user does not need to go through recovery flow
const params = {
    login: true,
    credObj,
    appObj,
    userPayload: {}
}
//If user does need to go through recovery flow
const params = {
    login: true,
    credObj,
    appObj,
    userPayload: {}, 
    email
}
```

When your users first sign up, enough information is stored in an encrypted cookie to allow them to easily log in on that same device. Therefore, the user only needs to supply the correct username and password. 

However, if your user has cleared their browser history and cache or if they are using a new device, they will need to supply their email address along with the other parameters in the login function. If your user needs to supply an email and hasn't, you'll receive a response notifying you of such so you can take appropriate action. 

Now, here's how you use them all put together in a nice example: 

```
//Require statement if you prefer: const { createUserAccount, login } = require('simpleid-js-sdk')  

import { createUserAccount, login } from 'simpleid-js-sdk'

const credObj = {
    id: ${availableName}, //This is the name the user selects and will be checked against existing registered names automatically.
    password: ${userPassword}, //This should be a complex password supplied by the user 
    hubUrl: ${storageHubURL}, //This will likely be "http://hub.blockstack.org" but can be any storage hub you allow
    email: ${emailToUse} //Email address for the user, used during account recovery
}

const appObj = { 
    appOrigin: "https://yourappdomain.com", //This is the domain for your app
    scopes: ['store_write', 'publish_data', 'email'] //These are the scopes you are requesting to use
}

const params = {
    login: true,
    credObj,
    appObj,
    userPayload: {}, 
    email
}

//If creating an account for the first time: 
const create = await createUserAccount(credObj, appObj);
console.log(create);

//Or if logging a user in: 
const authenticate = await login(params);
console.log(authenticate);
```

Once you've signed in, you'll need to, of course, be able to check whether your user is signed in to render the proper pages. Additionally, once you've confirmed your user has been signed in, you can make use of all of the `blockstack.js` library functions (this is not necessary and non-blockstack developers can simply use whatever tools they'd like). First, here is a Blockstack specific example: 



```
import { UserSession, AppConfig } from 'blockstack';
import { login, createUserAccount } from 'simpleid-js-sdk';
const appObj = { appOrigin: window.location.origin, scopes: ['store_write', 'publish_data']}
const appConfig = new AppConfig(appObj.scopes);
const userSession = new UserSession({ appConfig });

//To check if user is signed in, simply use userSession.isUserSignedIn()
console.log(userSession.isUserSignedIn()) //prints true or false
```

From there, you can use all of the `blockstack.js` functions defined [here.](https://blockstack.github.io/blockstack.js/)

Now for non-Blockstack developers, you can check if your user is signed in by using the following code: 

```
import { login, createUserAccount } from 'simpleid-js-sdk';
//You would use the below variable in your createUserAccount or login functions, but it's not used for the purpose of this example.
const appObj = { appOrigin: window.location.origin, scopes: ['store_write', 'publish_data']}

//To check if user is signed in, you just need to check localStorage
const signedIn = localStorage.getItem('blockstack-session');
console.log(signedIn) //prints true or false
```

Now, you probably want to let your users sign out, so let's wire up a sign out button in vanilla JS (this can apply to Blockstack or non-Blockstack devs).

```
<body>
<!--Your HTML--->
<button onclick="signUserOut()" id="sign-out">Sign Out</button>
<script>
function signUserOut(e) {
    e.preventDefault();
    localStorage.removeItem('blockstack-session');
    window.location.reload();
}
</script>
</body>
```

If you're using Blockstack's library, you can also just call this function: 

```
import { signUserOut } from 'blockstack';

function signOut() {
    signUserOut();
}
```