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

### Documentation

We have moved all of our documentation to https://docs.simpleid.xyz

### Important Notes   
Because this is a custodial solution, it is important that developers educate their users as much as possible. 

If a user loses their password they lose access to their account. Account recovery, as of now, is not possible without exposing too much private information. While this is a custodial solution, it is still very much focused on protecting as much data as possible, even from us.  

An email is sent on account creation with the user's encrypted seed phrase. That item is password-encrypted. So the user can decrypt it with their password using any number of tools that support AES decryption. Additionally, that item can be used when restoring an account on the Blockstack Browser. 