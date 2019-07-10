var assert = require('assert');
var auth = require('../index');
const creds = {id: "jehunter5811.id", pass: "thisisasecurepassword123!"}

//Account Creation
describe('CreateAccount', function() {
  describe('AccountSuccess', function() {
    it('should return account created message', async function() {
        const create = await auth.createUserAccount(creds);
        assert.equal(create.message,"account created")
    });
  });
  describe('NameTaken', function() {
      it('should not allow account to be created', async function() {
        const creds = {id: "nametaken.id", pass: "thisisasecurepassword123!"}
        const create = await auth.createUserAccount(creds);
        assert.equal(create.message,"name already taken")
      });
  })
});


//Log In
describe('LogIn', function() {
    describe('user session returned', function() {
        it('should return a valid user session', async function() {
            const appPrivKey = '8681e1cdaa96c5caf0c5da4e3a49c587b6b468fce89f71bef0525d28ce5450fc';
            const hubUrl = 'https://hub.blockstack.org';
            const scopes = ['store_write'];
            const appOrigin = 'helloblockstack.com'
            const userData = {
                appPrivKey,
                hubUrl, 
                scopes,
                appOrigin, 
                id: creds.id
            }
            const userSession = await auth.makeUserSession(userData);
            
            assert(userSession.message, "user session created");
        })
    });
    describe('full login', function() {
      it('should use supplied username and password to log in', async function() {
        const credObj = creds;
        const appObj = {
          hubUrl: 'https://hub.blockstack.org',
          scopes: ['store_write'],
          appOrigin: 'helloblockstack.com'
        }
        const loggedIn = await auth.login(credObj, appObj);

        assert(loggedIn.message, "user session created");
      })
    })
});

//BlockstackJS Operations
