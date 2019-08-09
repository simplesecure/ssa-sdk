//Need to consider the shape of user data entering the db both for registered apps and users

//For apps
const appModel = {
    "id": "String", 
    "appName": "String",
    "appOrigin": "String",
    "devContactName": "String",
    "devContactEmail": "String",
    "apiKey": "String",
    "providers": [
        {
            "providerName": "String", 
            "features": [
                "Auth", 
                "Storage"
            ]
        }
    ],
    "accountInfo": {
        "accountType": "String",
        "nextPaymentDue": "String",
        "history": [
            {
                "paymentId": "String", 
                "date": "String", 
                "amount": "String"
            }
        ]
    }
}

//For users
const userModel = {
    "id": "String", 
    "username": "String", 
    "email": "String",
    "identities": [
        {
            "type": "String", 
            "did": "String", 
            "encryptedWallet": "String || Object"
        }
    ]
}