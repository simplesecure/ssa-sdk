const auth = require('./index');
const creds = {id: "justin.id", pass: "thisisasecurepassword123!"}
const invalidCreds = {id: "justin.id", pass: "thisisasecurepassword123!"}

const create = auth.createUserAccount(creds);
console.log(create);
const login = auth.login(invalidCreds);
console.log(login);