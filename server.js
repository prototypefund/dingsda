
/*   Bug: !!!!!: atm only check for read rights is done if thingrequest.
    for find() we have to do that on DBLevel as well as on instanceLevel!!!!!

    ALSO: have to exclude all private things on find() unless in own DB !!!!!

    ALSO: issue with instance Level if / is missing at end of url. (try it!)
*/

const express = require('express')
const request = require('request');
const cookieParser = require('cookie-parser');
const uuidv5 = require('uuid/v5'); // npm install uuid
const cors = require('cors')

const whitelist = ["http://localhost:8080","http://192.168.178.128:8080","http://10.0.2.2:8080"]

const instanceUrl ="http://dingsda.org/";
const databaseUrl = "http://localhost:5984/";
const API_PORT = 3000;
const API_BASE_URL = "/api/v1/";
const MaxAge = 6000; // MaxAge for all Cookies from CouchDB (tbd: get this from Couch config instead)

/*
 all nano operations are done by either nanoAdmin if requestLevel is instance or
several DBs or by a short term conncetion nanoUser if requestLevel is thing.
we will use another nano Object. This is not needed but human error, ya know...
*/
const nanoAdmin = require('nano')('http://admin:demopassword@localhost:5984');
//let db = nano.db.use('userdb-6a616e') // user: jan

//const uuid = uuidv5(databaseUrl+'machinaex'+'/'+Date.now(), uuidv5.URL);
//console.log(uuid);

const app = express()

//  gotta find out how to make webapps work here later without breaking security
// credentials:true needed to allow AuthCookies
app.use(cors({origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },credentials: true}))

app.use(express.json()); // after this req.body should contain json

app.use(cookieParser());

app.use(verifyUserCredibility); // checks if Auth is ok

app.use(validateReadRights); // checks if request is ok to READ on doc level

app.all(API_BASE_URL+"*", (req,  res) => {

  console.log("legal HTTP command");
  //console.log(req.DBAuthToken);
  if (req.targets != undefined)
  {
    if (req.targets[1] != undefined) // if requestDepth is "thing level"
    {
        dingsCommander(req, res);
    }
    else if (req.targets[0] != undefined) // if requestDepth is "Database level"
    {
        DBCommander(req, res);
    }
    else
    {
      res.statusCode = 500// should never happen
      res.send('"internal Server error: line 50. buhu"')
    }

  }
  /* if requestDepth is "instance level" (aka undefined)
  (only relevant for user accounts and later complex searches) */
  else {
    instanceCommander(req,res)
    //res.send('"ok. I think you want to talk to the instance"') // only only Session no infos /
  }


})

app.listen(API_PORT,()=>console.log('DINGSDA API listening on port '+ API_PORT))



/*///////////////////////////////////////
  ACTUAL API functions a.k.a. COMMANDERs
  (maybe in future outsourced on localhost to make more async)
///////////////////////////////////////*/


function dingsCommander(req,res)
{

  if (req.method == "GET") // only FETCH and Auth
  {
    fetch(req,res);
  }
  else if (req.method == "POST" && req.body.data !== undefined)
  {
    //console.log(req.body.data);
    // does data contain more than one query? if only array but one item put item into body.data
    if (!Array.isArray(req.body.data) || (req.body.data.length == 1 && (req.body.data=req.body.data[0])))
    {
      switch(req.body.data.type) {
          case "fetch":
              fetch(req,res);
              break;
          case "move":
              move(req,res);
              break;
          case "update":
              update(req,res);
              break;
          default:
              res.statusCode = 400;
              return res.send('"unkown command\n(missing or unknown data.type) Ding"')
      }
    }
    else {
      res.statusCode = 400;
      return res.send('"API does not yet support multiple thing queries."')
    }
    //*/

  }
  else {
    res.statusCode = 400;
    return res.send('"UNSUPPORTED HTTP VERB\nor empty request body"')
  }


}

function DBCommander(req,res)
{
  if (req.method == "GET") // only FETCH and Auth
  {
    res.statusCode = 400;
    return res.send('"cannot (yet?) GET on DB level"')
  }
  else if (req.method == "POST" && req.body.data !== undefined)
  {
    if (!Array.isArray(req.body.data) || (req.body.data.length == 1 && (req.body.data=req.body.data[0])))
    {
      switch(req.body.data.type.toLowerCase()) {
          case "finditems":
              findItems(req,res);
              break;
          case "deleteitems":
              deleteItems(req,res);
              break;
          case "additems":
              addItem(req,res);
              break;
          case "additem":
              addItem(req,res);
              break;
          case "requestitems":
              requestItems(req,res);
              break;
          case "requestitem":
              requestItems(req,res);
              break;
          default:
              res.statusCode = 400;
              return res.send('"unkown command\n(missing or unknown data.type) DB"')
      }
    }
    else {
      res.statusCode = 400;
      return res.send('"API does not yet support multiple thing queries."')
    }
  }
  else {
    res.statusCode = 400;
    return res.send('"UNSUPPORTED HTTP VERB\nor empty request body"')
  }
}

function instanceCommander(req,res){

  console.log("INSTANCE COMMANDER!!!!");
  console.log(req.body);

  if (req.method == "GET") // only FETCH and Auth
  {
    console.log("GET!!!");
    return res.send({"username":req.username})
    //res.statusCode = 400;
    //return res.send('"cannot (yet?) GET on instance level"')
  }
  else if (req.method == "POST" && req.body.data !== undefined)
  {
    if (!Array.isArray(req.body.data) || (req.body.data.length == 1 && (req.body.data=req.body.data[0])))
    {
      switch(req.body.data.type.toLowerCase()) {
          case "register":
              register(req,res);
              break;
          default:
              res.statusCode = 400;
              return res.send('"unkown command\n(missing or unknown data.type) instance"')
      }
    }
  }

}



/// CouchDB HELPER ////

function couch_getUserDB(req)
{
  let nanoUser = require('nano')({
    url:databaseUrl,
    cookie:req.DBAuthToken
  })
  let dbUser = nanoUser.db.use("userdb-"+toHex(req.targets[0]))
  return [nanoUser,dbUser]
}

function fetch(req,res)
{
   let db = couch_getUserDB(req);
   let nanoUser = db[0]; let dbUser = db[1];
   dbUser.get(req.targets[1])
   .then(function(result){

       res.send(result); // all was good and we will send back the response

   })
   .catch(function(err){
     console.log(err.reason);
     res.send(err.reason)
   })
}

///////////////////////
/// THING HELPER //////

function move(req,res)
{
// validateMoveBody
if (req.body.data.location == undefined)
{
  console.log(req.body);
  res.statusCode = 400;
  return res.send('"error: no location provided"'+req.body.data.location)
}
// validateMoveRights (couch via doc_validate_update?)
  // TBD!!!
  let db = couch_getUserDB(req);
  let nanoUser = db[0]; let dbUser = db[1];
  dbUser.get(req.targets[1]).then((doc) => {
    console.log(doc);
    //res.send(doc._rev)
    let newdoc = doc;
    newdoc.location = req.body.data.location;
    return dbUser.insert(newdoc).then((DBres) => {
      return res.send(DBres)
    })
  }).catch((err)=>{
    console.log(err);
    res.statusCode = err.statusCode;
    return res.send(""+err.reason)
  });
}


//  Works. NICE TO HAVE: check if fields in old doc are deleted by Update
// and presever them unless otherwise specified (atm a client might not care
// about certain fields and therefore just send update requests not including them)
function update(req,res)
{
  //console.log(req.targets);
  if (req.body.data.doc == undefined || req.body.data.doc._id !== req.targets[1])
  {
    res.statusCode = 400;
    return res.send('"error: no or wrong doc provided. id in url is queen"')
  }
  // validation of Edit Rights are atm done by CouchDB server via doc_validate_update)
    let db = couch_getUserDB(req);
    let nanoUser = db[0]; let dbUser = db[1];
    req.body.data.doc.lastedited = Date.now();
    req.body.data.doc.lasteditedBy = req.username;
    //console.log(req.body.data.doc);
    return dbUser.insert(req.body.data.doc).then((DBres) => {
        return res.send(DBres)
      })
    .catch((err)=>{
      console.log(err);
      res.statusCode = err.statusCode;
      res.send(err.reason)
    })
}

//////////////////////
//// DB HELPER ///////

function addItem(req,res)
{

  // MISSING HERE: validate _id to be dingsda-JSON formatted
  //console.log(req.targets);
  if (req.body.data.doc == undefined || req.body.data.doc._rev !== undefined)
  {
    res.statusCode = 400;
    return res.send('"error: no doc provided or you are trying to update'+
    ' instead of create an item. (use \"type\":\"update\" and '+
    'url/username/itemID instead)"')
  }
  // validation of Edit Rights are atm done by CouchDB server via doc_validate_update)
    let db = couch_getUserDB(req);
    let nanoUser = db[0]; let dbUser = db[1];
    //console.log(req.body.data.doc);
    // make id for thing even if it wants a specific one:
    //const uuid = uuidv5(databaseUrl+'machinaex'+'/'+Date.now(), uuidv5.URL);
    //console.log(uuid);
    req.body.data.doc.created = Date.now();
    req.body.data.doc._id = uuidv5(instanceUrl+db+"/"+req.body.data.doc.created, uuidv5.URL);
  //  console.log(req.body.data.doc._id);
    return dbUser.insert(req.body.data.doc).then((DBres) => {
        return res.send(DBres)
      })
    .catch((err)=>{
      console.log(err);
      res.statusCode = err.statusCode;
      res.send(err.reason)
    })
}

function findItems(req,res)
{
  console.log(req.body.data.doc);

  if (req.body.data.doc == undefined || Object.keys(req.body.data.doc).length === 0)
  {
    res.statusCode = 400;
    return res.send('"error: no doc provided or no search params inside of doc "')
  }

  let db = couch_getUserDB(req);
  let nanoUser = db[0]; let dbUser = db[1];
  let q = makeMango(req.body.data.doc);
  q.limit = 50;
  q.fields = ["_id","name","location","other","owners"];
  //q.execution_stats = true; // maybe relevant later for easy pagination
  if (req.body.data.bookmark)
  {
    q.bookmark = req.body.data.bookmark
  }
  dbUser.find(q).then((doc) => {
      console.log(doc);
      delete(doc.warning);
      return res.send(doc)
    }).catch(function(err){
      res.statusCode = 400;
      res.send(err)
    });


}

function deleteItems(req,res)
{
  res.statusCode = 400;
  return res.send('"deleteItems does not yet exist"')
}

function requestItems(req,res)
{
  res.statusCode = 400;
  return res.send('"requestItems does not yet exist"')
}


function makeMango(input)
{
      //console.log(input);
      // do a thing, possibly async, then…
      let query = {selector:{}}

      for (item in input)
      {
        if (!Array.isArray(input[item]))
        {
          console.log(item);
          let val = input[item]
          if ( val == undefined || val.toString().trim(" ") == "")
          {
            delete input[val];
          }
          else
          {
            // IF STRING
            //(?ì) for case insensitive
            query.selector[item] = {"$regex":"(?i)"+input[item]};

          }
        }
        else
        {
          // IF ARRAY
          query.selector[item] = {"$in":input[item]};
        }

      }
      console.log(query);
      return query
  }

/*///////////////////////////////////////
  PRE-API Auth and Validation
  (checking READ permissions and managing Auth before forwarding requests to
   API functions)
///////////////////////////////////////*/

function validateReadRights(req, res, next){
    /*
      if request url and body (or request url and parambody "json") contains any
      READ outside of users own private DB: check if permissions are ok for READ
      at least before responding at all:
    */
    let urlAfterAPI = req.url.split(API_BASE_URL)[1].split("?")[0];

    if (urlAfterAPI !== "" && urlAfterAPI !== undefined)
    {
      console.log(urlAfterAPI);
      // targets[0]: targetDB or dingsda; targets[1]: targetItem or collection
      let targets = urlAfterAPI.split("/");
      targets = targets.filter(String); // should remove all empty Strings
      req.targets = targets;
      let requestDepth = targets.length;
      console.log("not just request to this INSTANCE");
      console.log("requestDepth: "+requestDepth);
      console.log("target instance level: "+targets[0]);
      console.log("target DB level: "+targets[1]);
      if (requestDepth > 1)
      {
        /*
          if requestDepth is 2 or higher this is a THINGREQUEST or on thinglevel
         So we have to check if authenticated CLIENT
         actually has READ permissions for the things they are asking for...
         We don't know anything about the user so far, so we gotta check
         the session that we hopefully got earlier...
        */
        /*
          #####################################
          READ PERMISSION CHECK DOCUMENT BASIS
          #####################################
          check if thing is readable for outside:
         a.k.a:
          1.) is req.username trying to read her own DB? --> READ GRANTED
          2.) is req.username in thing.owners? --> READ GRANTED
          3.) is thing.visibility === "public"? --> READ GRANTED
          4.) is thing.visibility !== "not" && userdb-<targetuser>._security.
          <thing.other.visibility> does contain req.username? --> READ GRANTED

          5.) (HARDEST maybe future science) (TO BE DONE):
          is thing.visibility === "friends2nd" && req.username is in friends
          of anybody who has <targetuser> in their userdb-<user>._security.friends
          list? --> READ GRANTED
          (unclear how to approach. So better first 1.-4. and this later)

          6.) ELSE: --> NO READ GRANTED --> no such object.
        */
        console.log("is "+req.username+" permitted to read "+targets[1]+
          " inside of "+targets[0]+"'s DB?");
        if (req.username == targets[0] && req.authenticated)
        {
          // 1.) is req.username trying to read her own DB?
          console.log("user tries to read own database. should be ok.");
          next();
          return
        }
        //  this is just an extra check against human error while coding!
        // the req should not even arrive here if not authenticated.
        // this shall be removed after testing
        else if (req.authenticated)
        {
          console.log("user tries to read s/o elses data. we gotta check that!");
          // DB check as admin to check for READ permissions:
          let db = nanoAdmin.db.use('userdb-'+toHex(targets[0]));
          console.log('userdb-'+toHex(targets[0]));
          if(targets[1] !== undefined) // REDUNDANT ????!!!!
          {
            db.get(targets[1],function(err,ding){
                console.log(ding);
                if(ding === undefined)
                {
                  res.statusCode = 404;
                  res.send('error: no such ding');
                  return
                }
          // 2.) is req.username in thing.owners?
                //console.log(ding.owners.indexOf(req.username));
                if ( ding.owners.indexOf(req.username) > -1)
                {
                  console.log("is not owner of DB BUT owner of thing");
                  next();
                  return
                }
          // 3.) is thing.visibility === "public"?
                if ( ding.other.visibility === "public")
                {
                  //console.log("thing is public therefore can be READ");
                  next();
                  return
                }
          // 4a) is thing private?
                if (  ding.other.visibility === "private" ||
                      ding.other.visibility === undefined   ){
                  //console.log("IT's PRIVATE, ASSHOLE!");
                  res.statusCode = 404;
                  res.send('error: no such ding');
                }
                else {
          // 4b) is userdb-<targetuser>._security in any of the groups listed?
                  db.get("_security",function (err, DBres) {
                    if (err) {
                      console.log(err)
                      res.statusCode = 501;
                      res.send();
                      // SEND ERROR RESPONSE HERE without any infos!!!
                    } else if (req.username in DBres.friends){
                      //console.log(DBres)
                      // HERE CHECK IF username in any of the DBres.friends
                      //console.log(Object.keys(DBres));
                      let groupsListingUser = [];
                      for (i in DBres.friends[req.username]) {
                        groupsListingUser.push(DBres.friends[req.username][i]);
                      }

                      if (groupsListingUser.length > 0) // redundant ???
                      {
                        console.log("is in groups");
          /*
            4c) <thing.other.visibility> does contain a group that
              req.username is part of?
          */
                        if(arrayItemfoundInArray(groupsListingUser,ding.other.visibility))
                        {
                          console.log("groups: "+groupsListingUser);
                          console.log("read allowed for: "+ding.other.visibility);
                          console.log("is in group listed in ding.visibility");
                          next();
                          return
                        }
                        else {
                          console.log("has no read rights in ding.visibility");
                          res.statusCode = 404;
                          res.send('error: no such ding');
                        }

                      }
                      else {
                        res.statusCode = 404;
                        res.send('error: no such ding');
                      }
                    }
                    else {
                      console.log("you AINT FRIENDS, DAH");
                      res.statusCode = 404;
                      res.send('error: no such ding');
                    }
                  })
                }
            }).catch(function(err){
              console.log(err);
              console.log("error in requests. should have been responded with HTTP ERR");
            });
          }
        }
        else
        {
          // only 2ndary security. this should NEVER be the only verification:
          req.authenticated = false;
          res.statusCode = 401;
          res.send('error: no valid auth');
        }
      }
      else {
        //  if requestDepth is only 0 or 1 the request handler will check anyhow
        // so we better don't do more work than we need to:
        next();
        return
      }
    }
    else {
      next();
      return
    }
}

function arrayItemfoundInArray(itemArray, array){
  for (let j in itemArray)
  {
    console.log(itemArray[j]);
    console.log(array);
    for (let i in array)
    {
      if (array.indexOf(itemArray[j]) > -1){

        return true
      }
    }
  }
  return false
}


function verifyUserCredibility(req, res, next){

      //console.log(req.body);
      if (req.cookies.AuthSession !== undefined)
      {
        //console.log("Cookie or Session Token provided.\nlets try to verify this session");
        verifyAuthToken(req,res,next); // will reject req if not valid
      }
      else if (req.body.username !== undefined && req.body.password !== undefined)
      {
        //console.log("No cookie but pw and username!\nlets try to login as "+ req.body.username);
        verifyByJsonPW(req,res,next);
      }
      else if (req.method == "GET")
      {
        //console.log("its a GETTER");
        verifyByUrlPW(req,res,next);
      }
      else
      {
        //console.log("neither password nor AuthSessionToken / cookie provided. ");
        // only 2ndary security. this should NEVER be the only verification:
        req.authenticated = false;
        res.statusCode = 401;
        res.send('error: no valid auth');
      }

}


function verifyByJsonPW(req,res,next)
{
  getSessionAndAuthToken(req,res,next,req.body.username,req.body.password)
}

function verifyByUrlPW(req,res,next)
{
  console.log(req.query);
  if (req.query.json !== undefined)
  {
    let getbody = JSON.parse(req.query.json);

    getSessionAndAuthToken(req,res,next,getbody.username,getbody.password)
  }
  else if (req.query.name !== undefined && req.query.password !== undefined)
  {
    getSessionAndAuthToken(req,res,next,req.query.name,req.query.password)
  }
  else {
    console.log('"there was no json parameter, no cookie and no name and'+
    ' password parameter in your fuckin query"');
    // only 2ndary security. this should NEVER be the only verification:
    req.authenticated = false;
    res.statusCode = 401;
    res.send('error: no valid auth');
  }

}

function getSessionAndAuthToken(req,res,next, username, password)
{
  request({
        method: "POST",
        url: databaseUrl + "_session",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: "name=" + username + "&password=" + password
      }, function(err,resDB){

        if (!err)
        {
          console.log(resDB);
          let body = JSON.parse(resDB.body);

          if ( body.ok )
          {
              let cookie = resDB.toJSON().headers["set-cookie"];
              console.log("valid username and password combo!");
              // save username in req (for later processing of request):
              req.username = username;
              // only 2ndary security. this should NEVER be the only verification:
              req.authenticated = true;
              req.DBAuthToken = cookie;
              res.set("Set-Cookie",cookie+";"+"max-age="+MaxAge)
              next();
              return
          }
          else
          {
              // only 2ndary security. this should NEVER be the only verification:
              req.authenticated = false;
              res.statusCode = 401;
              res.send('error: no valid auth');
          }
        }
        else {
          console.log(err);
          req.authenticated = false;
          res.statusCode = 501;
          res.send('error: internal server error uiuiui');
        }

      });
}


function verifyAuthToken(req,res,next){
  //console.log(req.cookies);

  return request({
        method: "GET", // GET SESSION from CouchDB if valid Auth
        url: databaseUrl + "_session",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": "AuthSession="+req.cookies.AuthSession
          },
        body: "name=" + req.body.username
      }, function(err,resDB){

        let body = JSON.parse(resDB.body);
        //console.log(body.userCtx.name);
        //console.log(res.statusCode);
        if ( body.info.authenticated != undefined )
        {
            //let cookie = resDB.toJSON().headers["set-cookie"];
            //console.log(res);
            console.log("valid AuthSessionToken!");
            // only 2ndary security. this should NEVER be the only verification:
            req.authenticated = true;
            req.DBAuthToken = ["AuthSession="+req.cookies.AuthSession+
              "; Version=1; Path=/; HttpOnly"];
            req.username = body.userCtx.name;
            next();
            return
        }
        else
        {
          console.log("sth went wrong while trying to verifyAuthToken");
          res.statusCode = 401;
          // only 2ndary security. this should NEVER be the only verification:
          req.authenticated = false;
          res.send('error: no valid valid authtoken');
        }
      })
}


/*///////////////////////////////////////
  GENERAL HELPER FUNCTIONS / OTHER STUFF
///////////////////////////////////////*/

function toHex(s) {
    // utf8 to latin1
    var s = unescape(encodeURIComponent(s))
    var h = ''
    for (let i = 0; i < s.length; i++) {
        h += s.charCodeAt(i).toString(16)
    }
    return h
}

function fromHex(h) {
    var s = ''
    for (let i = 0; i < h.length; i+=2) {
        s += String.fromCharCode(parseInt(h.substr(i, 2), 16))
    }
    return decodeURIComponent(escape(s))
}
