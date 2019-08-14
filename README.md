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

**SimpleID's Trust Model**  
There are plenty of trustless solutions in the Web 3.0 space, but SimpleID takes a more custodial approach. End users and app developers need to trust SimpleID, but end users, in turn, do not need to trust each of the apps they use that has SimpleID implemented. 

Because SimpleID is a custodial solution, the user's keychain is created on a server and encrypted before being stored in a database for later use. This is a conscious decision to help accelerate the adoption of blockchain-based and decentralization-focused applications and technologies. Much like Coinbase is the custodial on-ramp for cryptocurrency exchange, SimpleID is the custodial onramp to decentralized identity and storage.

**User Benefits**  

So what does the user get out of this exactly? They get the simple login flow they're used to, but they get the added benefits of encryption, protection against snooping, and security. The user account is also portable, which is not something traditional Web 3.0 auth providers can say.

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
    apiKey: "YourKey", //Provided when you create a project
    devId: "YourDevId" //Provided when you create a project
}
```

Some definitions and notes on the `credObj` and `appObj` parameters: 

`password` - Your users will need to be notified that this password cannot be reset. If they lose it, they lose access to their data.  
`hubUrl` - Should you choose to provide your own storage hub for users, you can supply the hub url here or you can allow users to type in their own hub url. However, if neither of those exists, it's important to send the default hub url: "https://hub.blockstack.org"  
`appOrigin` - When you register your app and receive your API key, your app origin is also registered. This must match what is sent in the `appObj` parameters. 

When logging in, you'll need to supply a little more info. Therefore, you'll send a single object with the `login()` function.

Here's a breakdown of what should be included in that object: 

```
//If user does not need to go through recovery flow
const params = {
    credObj,
    appObj,
    userPayload: {} //This can be left empty
}
```

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
    apiKey: "YourKey", 
    devId: "YourDevId" 
}

const params = {
    credObj,
    appObj,
    userPayload: {}
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

//Note: if you are using Blockstack, you'll need to manually store the results of the user's login
// to localStorage. You can do that like so: 

const authentication = await login(params);
localStorage.setItem('blockstack-session', JSON.stringify(authentication.body.store.sessionData));

//Or on account creations: 
const newAccount = await createUserAccount(credObj, appObj);
localStorage.setItem('blockstack-session', JSON.stringify(newAccount.body.store.sessionData));

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

### Important Notes   
Because this is a custodial solution, it is important that developers educate their users as much as possible. 

If a user loses their password they lose access to their account. Account recovery, as of now, is not possible without exposing too much private information. While this is a custodial solution, it is still very much focused on protecting as much data as possible, even from us.  

An email is sent on account creation with the user's encrypted seed phrase. That item is password-encrypted. So the user can decrypt it with their password using any number of tools that support AES decryption. Additionally, that item can be used when restoring an account on the Blockstack Browser. 