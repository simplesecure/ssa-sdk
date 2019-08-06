# SimpleID Technical Documentation  

Index:  
* [Summary](#summary)    
* [Public Functions](#public-functions)  
* [Additional Info](#additional-info)

## Summary

SimpleID is a developer toolkit built on top of the groundwork laid by existing decentralized application protocols. SimpleID provides a familiar user experience to end-users while giving developers felxibility in implementation. The toolkit can be used by any type of application, decentralized or not. 

At its base layer, SimpleID offers user authentication via username/password—as users expect—without compromising on privacy and security. Users are always in control of their private keys and no private information is ever exposed to SimpleID or the app developers using SimpleID. 

In addition to authentication, SimpleID also offer decentralized storage replication, multi-factor authentication options, basic developer analytics, and more. 

**Is it decentralized?**  

Yes, in the most basic sense of decentralization—no one party controls the user data and access. No, in the sense that app developers relying on SimpleID are trusting our process and our server. That said, the actual content being stored via SimpleID is available p2p via IPFS. A content hash is returned to the user profile so app developers can easily expose that hash to users and the hash is emailed to users upon account creation. 

With that information and the password the user chose when signing up, they can use their authentication information outside of SimpleID. For example, a user can easily migrate their identity from SimpleID to the Blockstack Browser. This will be true of all future protocols supported as well. 

**Why is there a server?**

In our experience building decentralized applications, we've notice a troubling trend. Most developer tools focus on the web only. Solutions are built that exclude entirely or largely other platforms (including mobile). But executing many of SimpleID's functions on a server, we can build a cross-platform solution, thus opening up decentralized app development to a whole new world of developers. 

While there will be language-specific SDKs (like the JavaScript SDK), any developer using any language can make simple HTTP requests via our API and expose the entire tool chest. 

## Documentation 

Let's start with a high-level overview of what's going on in terms of authentication: 

![](https://i.imgur.com/6zu0xzV.png) 

### Public Functions  

**Creating an Account**  

`createUserAccount(credObj, appObj)`

This function is called when a user is first signing up. It takes the following parameters: 

*Credentials Object* and a *App Object*  

The Credentials Object is an object that consists of:  
* id (this is the name the user would like to register)  
* password (supplied by the user and not sent anywhere)  
* hubUrl (if user is supplying a custom storage hub, enter that url, otherwise enter "https://hub.blockstack.org")  
* email (user's email address)  

You might build up that object like this: 
```
const credObj = {
    id: ${availableName}, //This is the name the user selects and will be checked against existing registered names automatically.
    password: ${userPassword}, //This should be a complex password supplied by the user 
    hubUrl: ${storageHubURL}, //This will likely be "http://hub.blockstack.org" but can be any storage hub you allow
    email: ${emailToUse} //Email address for the user, used during account recovery
}
```  

The App Object is simply parameters used to verify the app identity and create proper app-specific encryption keys. It consists of: 

* appOrigin (the domain of the application - this will be checked against registered apps for security)  
* scopes (these are the scopes you plan to request from the user and are definied by Blockstack)  

This object might be built up like this: 

```
const appObj = { 
    appOrigin: "https://yourappdomain.com", //This is the domain for your app
    scopes: ['store_write', 'publish_data', 'email'] //These are the scopes you are requesting to use
}
```  

When creating a user account, you only need to call the `createUserAccount` function. The `login` function will be called automatically. 

**Logging In** 

`login(params)` 

When a user logs in, you have two options:  
1. You can always display an email field. This will send the system through a full client/server flow and will take slightly longer.  
2. You can display username and password fields only and wait to see if the encrypted mnemonic is available in cookie storage. If it's not, you can then reveal the email field.  

It's important to note here that the parameters you send through the login function are very specific. If you include in your params object the email key, the user will be taken through the full new device/recovery flow, which may not be necessary. Also, you should always send through `login: true` in the params object. More advanced use cases will be able to send false or leave it null, but those use cases will be documented at a later time. 

Here are all of the keys to be includes in the parameters object:  

* login (should always be true for now)  
* credObj (as built up in the docs above)  
* appObj (as built up in the docs above)  
* userPayload (optional)  
* email (optional)  

You might built the parameters object up like this: 

```
const params = {
    login: true,
    credObj,
    appObj,
    userPayload: {}, 
    email
}
```

**Identity Portability**  
When a user signs up for an account, they will receive an email with the content hash of their encrypted seed phrase as well as the encrypted seed phrase itself. These are encrypted with the user's password. The user can take this encrypted seed phrase and enter it into the Blockstack Browser's recovery flow and immediately have access to their ID there as well. 

Additionally, a developer can reveal to the user their seed phrase at anytime by calling the following function: 

`revealMnemonic(password)`  

As you can see, that function takes a single parameter: the user's password.

**Responses**  
All server responses are passed back to the client in the form of an object. You should look for the response success key in the object. If there is an error, it will be in the response message body. 

## Additional Info

**Server Knowledge**

Because of the nature of generating keychains for an identity and keypairs, the server will have momentary knowledge of your mnemonic seed phrase. However, as soon as the server takes the action that requires the mnemonic, the response from that action as well as the mnemonic is encrypted with a public key supplied by the client. 

**New Device/Recovery Flow**  
While there is no password recovery for security reasons, a user may want to use a new device with an ID registered through SimpleID's tool kit. We've made it simple for app developers to accommodate that. 

When logging in, a developer will simply need to prompt their user to include their email, username, and password. This allows matching of the username and email address in order to return the encrypted mnemonic seed phrase. The password is never sent anywhere. It is used client-side only to decrypt the mnemonic seed phrase. 

If a user has logged in before, they may not need to include their email address. The encrypted mnemonic is stored in cookie storage in the browser. The app developer can pass in a cookie expiration parameter to set how long that cookie will be available. If it's available, the user just needs username and password. If the cookie is not available, SimpleID's SDK will return a helpful message that the developer can use to trigger an update to show the email field. 

**Passwords** 
User passwords never leave the device (browser, in the case of the web). They are not stored anywhere. They are simply used to decrypt data necessary for authentication. 

If a user loses their password, it's the equivalent of losing their seed phrase or private key. It is important for developers to make this clear to their users, but SimpleID leaves that communication up to the developer. 

**blockstack.js**  
When a user has been authenticated, a user session is created. This user session exposes all of the [blockstack.js](https://github.com/blockstack/blockstack.js) functions to the developer. While storage is not a requirement, developers can make use of Blockstack's [Gaia storage](https://github.com/blockstack/gaia) for their users.  


