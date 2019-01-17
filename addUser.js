const config = require("./server_config.json");

const DBadminPW = config.DBadminPW;
//const DBadminPW = "demopassword";
const fs = require("fs");

const http = require("http");
const express = require('express')
const bodyParser = require('body-parser');

const instanceUrl = config.instanceURL;
const databaseUrl = config.databaseURL;
const PORT = 5000

//const requestUrl = trimTrailingSlashes(instanceUrl)+":"+API_PORT+API_BASE_URL;

const nanoAdmin = require('nano')('http://admin:'+DBadminPW+'@'+databaseUrl.split("://")[1]);

const app = express()

app.use(bodyParser({limit: '1mb'}));

http.createServer(app)
.listen(PORT,()=>console.log('DINGSDA API listening on port '+ PORT));

const basicDocs =[
  {
    "_id": "&config",
    "contact_details": {
      "email": "",
      "telnumber": "",
      "other": ""
    },
    "other": {},
  },
  {
    "_id": "&inMyPossession",
    "things": []
  },
  {
    "_id": "&notifications",
    "pending": {
      "handover_await": {},
      "handover_confirm": {},
      "info": {}
    },
    "other": {}
  }

]


app.post("*", (req,  res) => {

  makeUser(req,res)

})



function makeUser(req,res){

  console.log(req.body);
  let username = req.body.data[0].username
  let password = req.body.data[0].password
  // later HERE contact_details to be written into &config

  // make new User with username and password
  dbAdmin = nanoAdmin.use("_users");
  dbAdmin.insert(
    {"_id":"org.couchdb.user:"+username, "name": username, "password": password,
     "roles": [], "type": "user"})
  .then((body) => {
    if (body.ok)
    {
      setTimeout(function(){

        dbUser = nanoAdmin.use("userdb-"+toHex(username));
        // add basic documents and (later) other databases:
        return dbUser.insert(basicDocs[0])
        .then(() => { return dbUser.insert(basicDocs[1])} )
        .then(() => { return dbUser.insert(basicDocs[2])} )
        .then((result) => {
          console.log(result);
          res.send(result)
        })
        // now add databases (notifications and inMyPossession):
         // TO BE DONE !!!!!
      },100)

    }
    else {
      console.log("ERROR"); console.log(body);
      res.statusCode = 500; res.send(body)
    }
  })
  .catch((err) => {
    console.log(err);
    res.statusCode = 500;
    res.send(err)
  })

}



//// HELPER FUNCTIONS ////

function toHex(s) {
    // utf8 to latin1
    var s = unescape(encodeURIComponent(s))
    var h = ''
    for (let i = 0; i < s.length; i++) {
        h += s.charCodeAt(i).toString(16)
    }
    return h
}
