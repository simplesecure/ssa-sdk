# SimpleID Javascript SDK

This is the JavaScript SDK for SimpleID, a framework for allowing users to authenticate into your app in a far more secure way than traditional usernames and passwords while still giving them the convenience of that same flow.

---
Under Construction. To test the basic premise with stubbed out data, do the following: 

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

Then, start using it!  

```
//Require statement if you prefer: const ssa = require('simpleid-js-sdk')  

import { createUserAccount, login } from 'simpleid-js-sdk'

const simpleExampleCreds = {
    id: "johnnycash",
    pass: "this is my super secure password"
}

//If creating an account for the first time: 
const create = await createUserAccount(simpleExampleCreds);
console.log(create);

//Or if logging a user in: 
const authenticate = await login(simpleExampleCreds);
console.log(authenticate);
```

