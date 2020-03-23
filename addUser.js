// TODO: upload designdocs as well

const config = require("./server_config.json");

const DBadminPW = config.DBadminPW;
//const DBadminPW = "demopassword";
const fs = require("fs");

const http = require("http");
const https = require("https");
const express = require('express')
const bodyParser = require('body-parser');
const request = require('request');
const util = require('util');
const cors = require('cors')

// make request() return promise:
const requestPromise = util.promisify(request);

const instanceUrl = config.instanceURL;
const databaseUrl = config.databaseURL;
const PORT = 5000

/*
SSL Stuff
*/
const options = {
  key: fs.readFileSync(config.SSLkey),
  cert: fs.readFileSync(config.SSLcert)
};


//const requestUrl = trimTrailingSlashes(instanceUrl)+":"+API_PORT+API_BASE_URL;

const nanoAdmin = require('nano')('http://admin:'+DBadminPW+'@'+databaseUrl.split("://")[1]);

const adminURL = 'http://admin:'+DBadminPW+'@'+databaseUrl.split("://")[1];

const whitelist = ["file://","http://dingsda.org","http://www.dingsda.org",
"http://localhost:8080","http://127.0.0.1:8080","http://localhost:9090",
"http://127.0.0.1:9090","http://192.168.178.128:8080","http://10.0.2.2:8080",
"https://dingsda.org","https://www.dingsda.org"]

const app = express()

app.use(cors({origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      console.log("whitelisted origin");
      console.log(origin);
      callback(null, true)
    } else {
      console.log("blacklisted origin");
      console.log(origin);
      callback(new Error('Origin '+origin+' not allowed by CORS'))
    }
  },credentials: true}))

app.use(bodyParser({limit: '1mb'}));

/*
http.createServer(app)
.listen(PORT,()=>console.log('DINGSDA API listening on port '+ PORT));
*/
https.createServer(options, app)
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
  },
  {
    "_id": "_design/app",
    "views": {
      "carnetATA": {
        "map": "var count = 0;\nfunction (doc) {\n  count++;\n  emit(doc._id, ['', doc.name,doc.other.count || '1',doc.other.weight || '',doc.other.value || '',doc.other.madein || '']);\n}"
      },
      "carnetATAjson": {
        "map": "var count = 0;\nfunction (doc) {\n  count++;\n emit(doc._id, { description:doc.name,count:(doc.other.count || '1'),weight:(doc.other.weight || ''),price:(doc.other.value || ''),origin:(doc.other.madein || '')});\n}"
      }
    },
    "lists": {
      "list": "function(head,req){start({'headers':{'Content-Type':'text/html'}});send('<html><body><table>');send('<tr><th>ID</th><th>Key</th><th>Value</th></tr>')while(row=getRow()){send(''.concat('<tr>','<td>'+toJSON(row.id)+'</td>','<td>'+toJSON(row.key)+'</td>','<td>'+toJSON(row.value)+'</td>','</tr>'))}send('</table></body></html>')}",
      "csv": "function(head, req){ start({'headers': {'Content-Type': 'text/csv'} }); send('\\n'); while(row = getRow()) { send(row.value +'\\n') } }"
    },
    "shows": {},
    "validate_doc_update": "function (newDoc, oldDoc, userCtx, secObj) {\n  // to be part of EVERY dingsder user DB!!!\n  // controls updates via _security doc .friends in DB\n\n    // can i control the edits of _security also?\n\n    var isAdmin = userCtx.roles.indexOf('_admin') > -1;\n    var isDBadmin = secObj.admins.names.indexOf(userCtx.name) > -1;\n\n\n    if (oldDoc && oldDoc.owners)\n    {\n        var isOwner = oldDoc.owners.indexOf(userCtx.name) > -1;\n    }\n\n    function isMover()\n    {\n        if (secObj.friends)\n        {\n            return secObj.friends[userCtx.name].indexOf(\"movers\") > -1;\n        }\n        else\n        {\n            return false\n        }\n    }\n\n      function isEditor()\n    {\n        if (secObj.friends)\n        {\n            return secObj.friends[userCtx.name].indexOf(\"editors\") > -1;\n        }\n        else\n        {\n            return false\n        }\n    }\n\n    function deepEqual(a, b) {\n      if (a === b) return true;\n\n      if (a == null || typeof a != \"object\" ||\n          b == null || typeof b != \"object\")\n        return false;\n\n      var propsInA = 0, propsInB = 0;\n\n      for (var prop in a)\n        propsInA += 1;\n\n      for (var prop in b) {\n        propsInB += 1;\n        if (!(prop in a) || !deepEqual(a[prop], b[prop]))\n          return false;\n      }\n\n      return propsInA == propsInB;\n    }\n\n    function isEmpty(o){\n        for(var i in o){\n            if(o.hasOwnProperty(i)){\n                return false;\n            }\n        }\n        return true;\n    }\n\n\n// forbidden: owner,id,name,permissions,id,name,price\n\n    // security roles\n    var roles = {\n        \"editors\":{\"allowed\":[\"*\"],\"forbidden\":[\"owners\",\"id\",\"name\",\"permissions\"]},\n        \"movers\":{\"allowed\":[\"location\"],\"forbidden\":[\"*\"]}\n    };\n\n    function checkIfUserisAllowed(key)\n    {\n        /*\n        if more than one group is listed inside friends[userCtx.name]\n        we have to check how the permissions merge and before checking if user\n        is permitted to do what they intend.\n        see branch \"moreThan2securityRoles\" for a half baked version of that.\n        Here now: handcoded only for editors and movers.\n        */\n\n        var permission = undefined;\n\n        /* only one of two roles is relevant! if more than 1 role in\n        friends.username, choose between movers or editors: */\n        if (isEditor())\n        {permission = roles.editors}\n        else if (isMover())\n        {\n          permission = roles.movers;\n        }\n        else {\n          permission = undefined;\n        }\n\n        //throw({forbidden: userRoles.toString()});\n\n        if ( permission !== undefined)\n        {\n\n            if (permission.forbidden.indexOf(key) !== -1) // if listed as forbidden\n            {\n              // HERE MISSING: Way to or allow subparameters inside of .other\n                throw({forbidden: 'you are explicitly forbidden to change '+ key + \" : \"+permission.forbidden});\n            }\n            else if (permission.allowed.indexOf(key) !== -1 || permission.allowed.indexOf(\"*\") !== -1)\n            {\n                //throw({forbidden: 'you are explicitly allowed '+ permission.allowed + \" and forbidden \"+permission.forbidden+ \" AND tried to change \"+key});\n            }\n            else\n            {\n                throw({forbidden: 'you are forbidden '+ permission.forbidden +\" and not explicitly allowed \"+ key + \" but only \"+ permission.allowed});\n            }\n\n        }\n        else\n        {\n            throw({forbidden: 'you don\\'t exist'});\n        }\n\n        //throw({forbidden: 'just testing '+ secObj.friends[userCtx.name] + \": forbidden: \" + permission.forbidden +\" allowed: \"+permission.allowed});\n    }\n\n    ///// MAIN //////////////\n    if (!isAdmin && !isDBadmin)\n    {\n        // check all things that are for everybody who is not the admin:\n\n        if (!newDoc.name) {\n            throw({forbidden: 'doc.name is required'});\n        }\n\n        if (!newDoc.location) {\n            throw({forbidden: 'doc.location is required'});\n        }\n\n        if (!newDoc.owners) {\n            throw({forbidden: 'doc.owners is required '});\n        }\n\n        if (!newDoc.other) {\n            throw({forbidden: 'doc.other is  required and needs to be an object'});\n        }\n\n        ////////////////////////////////////////////////////////////////\n\n        if (!isOwner)\n        {\n            //throw({forbidden: \"is not Owner\"});\n            // check stuff that is the case if not the Owner\n            // var changes = [];\n            for (var key in oldDoc)\n            {\n                // skip loop if the property is from prototype\n                if (!oldDoc.hasOwnProperty(key)) continue;\n\n                var obj = oldDoc[key];\n\n                for (var prop in obj) {\n                    // skip loop if the property is from prototype\n                    if(!obj.hasOwnProperty(prop)) continue;\n\n                    var equal;\n\n                    if (typeof(oldDoc[key]) === \"object\")\n                    {\n                        equal = deepEqual(newDoc[key],oldDoc[key]);\n                    }\n                    else\n                    {\n                        equal = newDoc[key] === oldDoc[key]\n                    }\n\n                    if (!equal && key != \"_revisions\")\n                    {\n                        //throw({forbidden: key + \" has changed from \" + oldDoc[key] + \" to \"+ newDoc[key] + \" deepequal: \"+ equal});\n                        //changes.push(key)\n                        // check if USER is allowed to update these fields:\n                        checkIfUserisAllowed(key);\n                    }\n                    else {\n\n                    }\n                }\n            }\n\n            //throw({forbidden:changes})\n            /////////////////////////////////////////////////\n        }\n        else\n        {\n            //throw({forbidden: \"is Owner\"});\n            // do whatever only the Owner but not the Admin does\n        }\n\n    }\n    else\n    {\n      //throw({forbidden: \"is admin\"});\n      //else do whatever only the admin can do\n    }\n\n\n}",
    "attachments_md5": {}
  }

]

app.post("*", (req,  res) => {

  console.log(req);

  makeUser(req,res)

})



function makeUser(req,res){

  console.log(req.body);
  let username = req.body.data[0].username
  let password = req.body.data[0].password
  // later HERE contact_details to be written into &config

  notificationsDBname = "userdb-"+toHex(username)+"-notifications";
  inMyPossessionDBname = "userdb-"+toHex(username)+"-inmypossession";
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
        .then(() => { return dbUser.insert(basicDocs[3])} ) // designdoc
        .then(() => { return requestPromise({
                    method: "PUT",
                    url: adminURL+"/"+"userdb-"+toHex(username)+'/_security',
                    headers: {"Content-Type": "application/x-www-form-urlencoded"},
                    json: {"_id":"_security","admins":{"names":[username,"admin"]},
                            "members": {"names": [username,"admin"],"roles":[]}},
                    })})
        // now add databases (notifications and inMyPossession):
        // create database -notifications
        .then(() => {
          return nanoAdmin.db.create(notificationsDBname)
        } )
        // modify the _security doc of new DB
        .then((sec) => {
          dbUserNotifications = nanoAdmin.use(notificationsDBname);
          return requestPromise({
            method: "PUT",
            url: adminURL+"/"+notificationsDBname+'/_security',
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            json: {"_id":"_security","admins":{"names":[username,"admin"]},
                    "members": {"names": [username,"admin"],"roles":[]}},
            })
          })
          // create database -inmypossession
          .then(() => {
            return nanoAdmin.db.create(inMyPossessionDBname)
          } )
          // modify the _security doc of new DB
          .then((sec) => {
            dbInMyPossession = nanoAdmin.use(inMyPossessionDBname);
            return requestPromise({
              method: "PUT",
              url: adminURL+"/"+inMyPossessionDBname+'/_security',
              headers: {"Content-Type": "application/x-www-form-urlencoded"},
              json: {"_id":"_security","admins":{"names":[username,"admin"]},
                      "members": {"names": [username,"admin"],"roles":[]}},
              })
            })
          .then((result) => {
            console.log(result.body);
            return res.send(result.body)
          })

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
