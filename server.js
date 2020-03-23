
/*
    BUG: !!!!!: atm only check for read rights is done if thingrequest.
    for find() and handover_xxx() we have to do that on DBLevel as well as on instanceLevel!!!!!

    TODO: have to exclude all private things on find() unless in own DB !!!!!

    TODO: issue with instance Level if / is missing at end of url. (try it!)

    TODO: validate all docs on update/add etc via JSON SCHEMA
*/

const config = require("./server_config.json"); // location of config.json

const DBadminPW = config.DBadminPW; // couchDB password for the admin entry

const https = require("https");
const fs = require("fs");
const express = require('express')
const request = require('request');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const uuidv5 = require('uuid/v5'); // npm install uuid
const cors = require('cors')
const deepcopy = require('deepcopy');
const util = require('util');

// make request() return promise:
const requestPromise = util.promisify(request);

/*
the proxy is used for direct get requests to itemlevel only and everything below.
mainly intended to be used for querying complete infos of items and their attachments
e.g. https://dingsda.org:3000/api/v1/machinaex/52d3a7c3-0a66-5bbb-9ede-303dc0312284
or https://dingsda.org:3000/api/v1/machinaex/52d3a7c3-0a66-5bbb-9ede-303dc0312284/pic_small.jpg
*/
const httpProxy = require('http-proxy');
let proxy = httpProxy.createProxyServer({
  auth:'admin:'+DBadminPW, // it works also without for userDB but not for public
  ignorePath:true
});

/*
whitelist of domains for Cross-Origin-Requests (CORS)
*/
const whitelist = config.CORS_whitelist.concat(undefined);


const INSTANCEURL = config.instanceURL; // external url leading to this server lowest level (no ports)
const DATABASEURL = config.databaseURL; // url leading to couchDB including port! (probably localhost)
const API_PORT = config.API_PORT; // PORT for API
const API_BASE_URL = config.API_BASE_URL; // path to lowest API level (e.g. /api/v1/ )
const REQUESTURL = trimTrailingSlashes(INSTANCEURL)+":"+API_PORT+API_BASE_URL; // base url to talk to API
const MaxAge = 360000; // MaxAge for all Cookies from CouchDB (tbd: get this from Couch config instead)

/*
SSL Stuff
*/
const options = {
  key: fs.readFileSync(config.SSLkey),
  cert: fs.readFileSync(config.SSLcert)
};


/*
PUSH NOTIFICATION STUFF / WEB PUSH
*/

// WEB PUSH STUFF
const webpush = require('web-push');
const publicVapidKey = config.publicVapidKey;
const privateVapidKey = config.privateVapidkey;
// Replace with your email
webpush.setVapidDetails('mailto:'+config.emailAdmin, publicVapidKey, privateVapidKey);

// APPLE PUSH STUFF (APN)
const apn = require('apn'); // apple push notification 
// initialize apn server
var apnProvider = new apn.Provider(                     // TODO: into server_config.json!!!
  {
    token: {
      key: "./AuthKey_3LVJH5LZ3B.p8",
      keyId: "3LVJH5LZ3B",
      teamId: "W847RUDC73"
    },
    production: true
  }
);

// GOOGLE FIREBASE CLOUD MESSAGING (FCM)

const gcm = require('node-gcm'); // google firebase cloud messages

// Set up the sender with your GCM/FCM API key (declare this once for multiple messages)
var FCMsender = new gcm.Sender('AAAAwKzMWzw:APA91bGUSHcmQ4udWo5Apa6qlQ0J86bzSdV19-_zQMENQA7IQV8NtGZN6fwdgF_FNlQB29mHnNTxUOJ7G4-dshCUGb0dvFR8Gw4lWmP8fWWjM3g9fAv5-yYSlag-aO23FSRC_Xozmy2x');
// TODO: into server_config.json

/*
all nano operations are done by either NANO_ADMIN if requestLevel is instance (see README)
or several DBs or by a short term conncetion nanoUser if requestLevel is thing.
we will use another nano Object. This is not needed but human error, ya know...
*/
const NANO_ADMIN = require('nano')('http://admin:'+DBadminPW+'@'+DATABASEURL.split("://")[1]);



// STDIN STUFF
const readline = require('readline');


/*///////////////////////////////////////
vvvvvvvvvvvvvvvvvvvvvvvvvv
EXPRESS SERVER:
vvvvvvvvvvvvvvvvvvvvvvvvvv
///////////////////////////////////////*/

const app = express()

app.use(cors({origin: function (origin, callback) {
    console.log("inside EXPRESS CORS check");
    console.log(origin); 
    
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Origin '+origin+' not allowed by CORS'))
    }
  },credentials: true}))

app.use(bodyParser({limit: '1mb'})) // trying here

app.use(express.json()); // after this req.body should contain json

app.use(cookieParser());

app.use(verifyUserCredibility); // checks if Auth is ok

app.use(validateReadRights); // checks if request is ok to READ on doc level


/*
All incoming requests are forwarded to the three request handlers, depending
 on the url entry level of the request:
dingsCommander (thing level)
DBCommander (DB level)
instanceCommander ( instance level)

more about API entry levels: see README
*/
app.all(API_BASE_URL+"*", (req,  res) => {

  console.log("legal HTTP command");

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
  else {
    instanceCommander(req,res) // if requestDepth is "instance level"
  }

})


https.createServer(options, app)
.listen(API_PORT,()=>console.log('DINGSDA API listening on port '+ API_PORT));

/*///////////////////////////////////////
^^^^^^^^^^^^^^^^^^^^^^^^^^
EXPRESS SERVER END
^^^^^^^^^^^^^^^^^^^^^^^^^^
///////////////////////////////////////*/

/// STDIN BY LINE to send control stuff into running programm using readline module
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'COMMAND> '
});
 
rl.prompt(); // opens prompt

rl.on('line', (line) => {
  eval(`
  try{
    eval(${line})
  }
  catch(err){
    console.log(err)
  }
  `);
  rl.prompt();
}).on('close', () => {
  console.log('Have a great day!');
  process.exit(0);
});



/*///////////////////////////////////////
  vvvvvvvvvvvvvvvvvvvvvvvvvv
  API functions a.k.a. COMMANDERs
  (maybe in future outsourced on localhost to make more async ???)
  vvvvvvvvvvvvvvvvvvvvvvvvvv
///////////////////////////////////////*/

/**
request handler. manages all incoming requests on thing level.<br>
This means: all requests addressing only a single item/doc in the database<br>
<br>
checks for requests HTTP verb ( GET / POST ) as well as the requests JSON payload
and forwards request and response object to the different thinglevel document
functions.



@param {object} req - request object from express app
@param {object} res - response object from express app
*/
function dingsCommander(req,res)
{

  if (req.method == "GET") // atm only FETCH
  {
    fetch(req,res);
  }
  else if (req.method == "POST" && req.body.data !== undefined)
  {
    // does .data contain more than one query? if only array but one item put item into body.data
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
          case "handover_announce":
              handover_announce(req,res);
              break;
          case "deleteItems":
              deleteItems(req,res);
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
    console.log("+++++ IS THERE A BODY? +++++");
    console.log(req.body);
    console.log("++++++++");
    res.statusCode = 400;
    return res.send('"UNSUPPORTED HTTP VERB or empty request body"')
  }


}

/**
request handler. manages all incoming requests on database level.<br>
This means: all requests addressing a single database (most of the times a users DB)
<br><br>
checks for requests HTTP verb ( GET / POST ) as well as the requests JSON payload
and forwards request and response object to the different database level functions.

@param {object} req - request object from express app
@param {object} res - response object from express app
*/
function DBCommander(req,res)
{
  if (req.method == "GET") // only FETCH and Auth
  {
    console.log(`DBCommander getting infos about ${req.username}`);

    NANO_ADMIN.db.get("userdb-"+toHex(req.username)).then((body) => {
      res.send(body);
    })
  }
  else if (req.method == "POST" && req.body.data !== undefined)
  {
    // does .data contain more than one query? if only array but one item put item into body.data
    if (!Array.isArray(req.body.data) || (req.body.data.length == 1 && (req.body.data=req.body.data[0])))
    {
      console.log(req.body.data.type);
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
          case "getcarnet":
              getCarnet(req,res);
              break;
          case "borrow_request":
              borrow_request(req,res);
              break;
          case "handover":
              handover(req,res);
              break;
          case "handover_cancel":
              handover_cancel(req,res);
              break;
          case "handover_deny":
              handover_deny(req,res);
              break;
          case "getnotifications":
              getNotifications(req,res);
              break;
          case "deletenotification":
              deleteNotification(req,res);
              break;
          case "getinmypossession":
              getItemsInMyPossession(req,res);
              break;
          default:
              res.statusCode = 400;
              return res.send('"unkown command\n(missing or unknown data.type) DB"')
      }
    }
    else
    {
      res.statusCode = 400;
      return res.send('"API does not yet support multiple thing queries."')
    }
  }
  else
  {
    console.log("+++++ IS THERE A BODY? +++++");
    console.log(req.body);
    console.log("++++++++");
    res.statusCode = 400;
    return res.send('"UNSUPPORTED HTTP VERB\nor empty request body"')
  }
}

/**
request handler. manages all incoming requests on instance level.<br>
This means: all requests the complete server instance (e.g. https://dingsda.org:3000/api/v1/)
<br><br>
checks for requests HTTP verb ( GET / POST / DELETE ) as well as the requests JSON payload
and forwards request and response object to the different functions.

@param {object} req - request object from express app
@param {object} res - response object from express app
*/
function instanceCommander(req,res)
{

  console.log("INSTANCE COMMANDER!!!!", req.url);

  if (req.method == "GET") // only Auth (which happens in the express middleware) endpoint
  {
    /*
    if nothing went wrong on the way here: user must be successfully authenticated
     so server sends back the username:
    */
    return res.send({"username":req.username})
  }
  else if (req.method == "POST" && req.body.data !== undefined)
  {
    
    console.log(req.url);
    console.log(req.params);
    
    if (!Array.isArray(req.body.data) || (req.body.data.length == 1 && (req.body.data=req.body.data[0])))
    {
      switch(req.body.data.type.toLowerCase())
      {
          case "register":
              register(req,res);
              break;
          case "search":
              search(req,res);
              break;
          default:
              res.statusCode = 400;
              return res.send('"unkown command\n(missing or unknown data.type) instance"')
      }
    }
  }
  else if (req.method == "DELETE")
  {
    res.set("Set-Cookie","AuthSession=; Version=1; Path=/; HttpOnly");
    return res.send("bye");
  }
  else
  {
    res.send(`did not find an endpoint on INSTANCE level for:  ${res.url}`) // added for debugging. unclear if we should get rid of this
  }

}


/*/////////////////////////
^^^^^^^^^^^^^^^^^^^^^^^^^^
 API functions a.k.a. COMMANDERs
^^^^^^^^^^^^^^^^^^^^^^^^^^
//////////////////////////*/



////////////////////////////////
/// THING LEVEL FUNCTIONS //////


/**
thing level function.<br>
gets item requested by request url target ID (https:xxx/api/v1/xxxx/ID/xxxxx) from database
if an attachment is also requested via request url (https:xxx/api/v1/xxxxx/xxxx/ATTACHMENT)
the attachment is added to the response payload instead of document

@param {Object} req - request object from express app
@param {Object} res - response object from express app

@returns {Object} sends express response back to client with either requested doc or attachment
*/
function fetch(req,res)
{
   // testing with Admin Rights here, for should be already authenticated at this point:
   let nanoUser = NANO_ADMIN; let dbUser = nanoUser.db.use("userdb-"+toHex(req.targets[0]));

   dbUser.get(req.targets[1]).then(function(result) // uses nano to get doc
   {

       if (req.targets[2] != undefined){ // if request is for attachment
           // get attachment instead of item:
           console.log("ATTACHMENT REQUESTED:");
           if(result._attachments !== undefined){
             console.log(req.targets[2]);

              // this is a workaround because proxy does not overwrite req's auth:
              delete req.headers['cookie'];
              // make cacheable for 24h:
              res.set('Cache-Control', 'private, max-age=86400');
              //console.log('proxying to DB directly');

              /*
              uses proxy to get attachment ( so it can be cached
              which would not work if the attachment would come through nano as
              Base64 String ):
              */
              return proxy.web(req, res,{
                target: DATABASEURL+"userdb-"+toHex(req.targets[0])+
                "/"+req.targets[1]+"/"+req.targets[2],
                auth:'admin:'+DBadminPW
              },function(err){console.log("+++ PROXY ERROR +++:",err)});

             }
             else {
               res.statusCode = 404;
               return res.send("no attachment found")
             }


       } else {
         // otherwise: return the item!
          console.log("fetch success");
          return res.send(result); // all was good and we will send back the response

         }
       })
       .catch(function(err){
         res.statusCode = 400;
         console.log(err.reason);
         return res.send("error: fetch item from DB: " + err.reason)
       })
}

function deleteNotification(req,res)
{
  let dbNotifications = NANO_ADMIN.db.use('userdb-'+toHex(req.targets[0])+"-notifications");
  return dbNotifications.get(req.body.data._id)
  .then((notifi)=>{
        return dbNotifications.destroy(req.body.data._id, notifi._rev)
  })
  .then((destroyRes)=>{
    console.log(destroyRes);
    res.send(destroyRes)
  })
  .catch((err)=>{
    console.log("ERROR deleting Notification via deleteNotification()");
    res.statusCode = 500;
    res.send("ERROR: deleting Notification")
  })
}

function getItemsInMyPossession(req,res){
  let dbAdmin = NANO_ADMIN.db.use("userdb-"+toHex(req.username)+"-inmypossession");
  let q = {"selector":{"_id":{"$regex":"(?i)"}}}
  q.limit = 1000; /* TODO: change to pagination in client */
  return dbAdmin.find(q).then((inMyPossession)=>{
    return res.send(inMyPossession.docs)
  })
  .catch((err)=>{
    console.log("error fetching inMyPossession:");
    console.log(err);
    return res.send("error fetching inMyPossession")
  })
}

function getNotifications(req,res)
{
  getNotificationsAsAdmin(req.username).then((notifications)=>{
    return res.send(notifications.docs)
  })
  .catch((err)=>{
    console.log("error fetching notifications:");
    console.log(err);
    return res.send("error fetching notifications")
  })
}

/**
helper: gets all docs from userDB-notifications and returns a promise of the
databases response
*/
function getNotificationsAsAdmin(username)
{
  let dbAdmin = NANO_ADMIN.db.use("userdb-"+toHex(username)+"-notifications");
  let q = {"selector":{"_id":{"$regex":"(?i)"}}}
  q.limit = 1000; /* TODO: change to pagination in client */
  return dbAdmin.find(q)
}

/**
thing level function.<br>
announces the handover of a phyisical thing from the user sending the request to
another user (defined in req payload .data.username).<br>
writes notifications into &notifications doc of user sending the request as well
as into &notifications doc of user that is allegedely receiving the item defined
by url path of request (target[1])

@TODO change after &notifications doc became &notifications database

@param {Object} req - request object from express app
@param {Object} res - response object from express app

@returns {Object} sends response to client with either couchDBs response after insert or error
*/
function handover_announce(req,res)
{

  if (req.body.data.username === undefined)
  {
    res.statusCode = 400;
    return res.send('"error: no username provided"')
  }

  let dbOwner = NANO_ADMIN.db.use('userdb-'+toHex(req.targets[0]));
  let dbLender = NANO_ADMIN.db.use('userdb-'+toHex(req.username));
  let dbLenderNotifications = NANO_ADMIN.db.use('userdb-'+toHex(req.username)+"-notifications");
  let dbBorrower = NANO_ADMIN.db.use('userdb-'+toHex(req.body.data.username));
  let dbBorrowerNotifications = NANO_ADMIN.db.use('userdb-'+toHex(req.body.data.username)+"-notifications");

  // check if handover would be a return: is Borrower also Owner?
  let isReturn = (req.body.data.username === req.targets[0]);

  /*
  check if dbOwner, dbLender and dbBorrower exist,
  if not send error, if so continue
  */
  NANO_ADMIN.db.get('userdb-'+toHex(req.targets[0])).then((body) => {
    console.log("vvvvvvvvvvvvvvvvvvvvvvvvv");
    console.log("checking if dbOwner exists");
    console.log(body);
    console.log("___________________________");
  }).then(function(){
    return NANO_ADMIN.db.get('userdb-'+toHex(req.username)).then((body2) =>{
      console.log("checking if dbLender exists");
      console.log(body2);
      console.log("___________________________");
    })
  }).then(function(){
    return NANO_ADMIN.db.get('userdb-'+toHex(req.body.data.username)).then((body3) =>{
      console.log("checking if dbBorrower exists");
      console.log(body3);
      console.log("^^^^^^^^^^^^^^^^^^^^^^^^^");

      console.log("all checks successful. initiating handover announcement...");
      /// ACTUAL HANDOVER:
      // now do all the operations needed to announce the handover:
      dbOwner.get(req.targets[1]).then((doc) => {
        // if handover is requested for a thing owned by the user themselves OR
        //  by somebody currently in Possession of the thing with goal of returning it to its owners:
        if (req.targets[0] === req.username || doc.owners.includes(req.username) ||
            (doc.inPossessionOf && doc.inPossessionOf.includes(req.username) &&
            doc.owners.includes(req.body.data.username))
           )
        {
    // TODO:  CHECK IF FRIENDS OR IF borrower/&notifications.requested includes id of item
    // TODO:  CHECK IF OPEN OTHER handover annoncments in my and others Notifications and if delete those before continueing
          console.log("legal handover announcement by owner");

          /*
          writeNewNotificationsIntoLenderDB:
          if Lender has no pending handovers for this item, add this item to pending:
          */
          return getNotificationsAsAdmin(req.username)
          .then((notifications)=>{
            notifications = notifications.docs;

            let handoverAwait = notifications.find(function(entry){
              return entry._id.startsWith("handover_await-")
                    && entry._id.split("handover_await-")[1] === req.targets[1];
            });

            if (handoverAwait !== undefined){
              console.log("ERROR updating Lenders notifications");
              throw({
                statusCode: 400,
                reason:"ERROR updating Lenders notifications."+
                " item is already awaiting handover confirmation"});
            }
            // add to Lender-notificationsDB:
            handoverAwait = {
              _id: "handover_await-"+req.targets[1],
              to: req.body.data.username,
              ref: req.targets[1],
              refname: doc.name,
              type: "handover_await",
              time:{ from: req.body.data.from, till: req.body.data.till}
            }
            return dbLenderNotifications.insert(handoverAwait)
          })
          /*
          END writeNewNotificationsIntoLenderDB
          */
          .then((insertRes) => {
            if (!insertRes.ok) {
              throw({statusCode:500,reason:"ERROR updating Lender Notifications"});
            }

            // add counter notification to Borrowers DB as well:
            let handoverConfirm = {
              _id: "handover_confirm-"+req.targets[1],
              from: req.username,
              ref: req.targets[1],
              refname: doc.name,
              type: "handover_confirm",
              isReturn: isReturn,
              time:{ from: req.body.data.from, till: req.body.data.till}
            };
            console.log("handover_announcne attempting to insert confirm into"+
                        "notificationsDB of borrower");
            return dbBorrowerNotifications.insert(handoverConfirm)
            .then((ok) => {
              res.send(ok);
              sendPushToUser(req.body.data.username,"handover of "+doc.name+" to "+req.username+" confirmed")
            })
          })

/*
          return dbLender.get("&notifications").then((notifications) => {
            console.log(notifications);
            if (notifications.pending["handover_await"] !== undefined &&
                notifications.pending["handover_await"][req.targets[1]] === undefined )
                {
                  console.log("handover_await exists and will be written");
                  notifications.pending.handover_await[req.targets[1]] =
                          {
                            to: req.body.data.username,
                            time:{ from: req.body.data.from, till: req.body.data.till}
                          };

                  // add to LenderDB:
                  return dbLender.insert(notifications).then(() => {

                      // add counter notification to Borrowers DB as well:

                      return dbBorrower.get("&notifications").then((notificationsBorrower) => {

                          notificationsBorrower.pending.handover_confirm[req.targets[1]] =
                                  {
                                    from: req.username,
                                    isReturn: req.body.data.isReturn,
                                    time:{ from: req.body.data.from, till: req.body.data.till}
                                  };

                          return dbBorrower.insert(notificationsBorrower).then((ok)=>
                            {
                              res.send(ok)
                            }
                          )

                      })

                  })

                }
                else {
                  console.log("ERROR updating Lenders notifications");
                  throw({
                    statusCode: 400,
                    reason:"ERROR updating Lenders notifications."+
                    " item is already awaiting handover confirmation"});
                }
          })
*/ //out for rebuild
        }
        else {
          res.statusCode = 400;
          return res.send('"error: you don\'t have this thing"')
        }
      })
      .catch((err)=>{
        console.log("ERROR inside handover_announce():");
        console.log(err);
        res.statusCode = err.statusCode;
        return res.send(""+err.reason)
      });
      // <<< HANDOVER SHOULD BE DONE HERE
    })
  }).catch(function(err){
    console.log("ERROR INSIDE HANDOVER ANNOUNCE:");
    console.log(err);
    res.statusCode = err.statusCode;
    return res.send(""+err.reason)
    console.log("^^^^^^^^^^^^^^^^^^^^^^^^^");
  })

}


/**
DB level function.<br>
cancels an announced handover set in {@link handover_announce}.<br>
deletes notification entries with item reference defined by request payload .data.ref
from &notifications doc of user sending as well as user defined by request payload .data.to

@param {Object} req - request object from express app
@param {Object} res - response object from express app

@TODO change after &notifications doc became &notifications database

@returns {Object} sends response to client with either couchDBs response after
notifications are deleted or error
*/
function handover_cancel(req,res)
{
  console.log("HANDOVER CANCEL");
  console.log(req.body.data);
  if (req.body.data.to === undefined || req.body.data.ref === undefined)
  {
    res.statusCode = 400;
    return res.send('"error: no username or from provided"')
  }

  let db = NANO_ADMIN.db.use('userdb-'+toHex(req.targets[0]));
  let dbNotifications = NANO_ADMIN.db.use('userdb-'+toHex(req.targets[0])+"-notifications");
  let dbBorrower = NANO_ADMIN.db.use('userdb-'+toHex(req.body.data.to));
  let dbBorrowerNotifications = NANO_ADMIN.db.use('userdb-'+toHex(req.body.data.to)+"-notifications");

// TODO: CHECK IF ALLOWED TO CANCEL FIRST!!!

  return getNotificationsAsAdmin(req.targets[0])
  .then((notifications)=>{
    notifications = notifications.docs;

    // check if already handover_await in notifications:
    let handoverAwait = notifications.find(function(entry){
      return entry._id.startsWith("handover_await-")
            && entry._id.split("handover_await-")[1] === req.body.data.ref;
    });
    // if so: stop and throw error
    if (handoverAwait === undefined){
      console.log("ERROR cancelling Lenders notifications");
      throw({
        statusCode: 400,
        reason:"ERROR cancelling Lenders notifications."+
        " requested notification not found"});
    }
    // else go on:
    // get notifications from Borrower:
    return getNotificationsAsAdmin(req.body.data.to)
    .then((notificationsBorrower)=>{
      notificationsBorrower = notificationsBorrower.docs;
      // get the notification in question:
      let handoverConfirm = notificationsBorrower.find(function(entry){
        return entry._id.startsWith("handover_confirm-")
              && entry._id.split("handover_confirm-")[1] === req.body.data.ref;
      });
      // delete handover_await from Lender's notifications:
      return dbNotifications.destroy('handover_await-'+req.body.data.ref, handoverAwait._rev)
      .then((destroyRes) => {
        if (!destroyRes.ok){throw({statusCode: 500,reason:"ERROR deleting handover_await"});}
        return destroyRes;
      })
      .then(()=> {
        // delete handover_confirm from Borrower's notifications:
        return dbBorrowerNotifications.destroy(
                      'handover_confirm-'+req.body.data.ref,handoverConfirm._rev)
      }).then((destroyRes2)=>{
        if (!destroyRes2.ok){throw({statusCode: 500,reason:"ERROR deleting handover_confirm"});}
        res.send(destroyRes2)
      })
      //res.send(notificationsBorrower)
    })

  })
/*
  return db.get("&notifications").then((notifications) => {
    console.log(notifications);
    let validHandover =
    (notifications.pending.handover_await[req.body.data.ref] !== undefined)

     if (validHandover)
     {
       delete notifications.pending.handover_await[req.body.data.ref];
       return db.insert(notifications).then(() =>{
         return dbBorrower.get("&notifications").then((notificationsBorrower) =>
         {
           delete notificationsBorrower.pending.handover_confirm[req.body.data.ref];
             return dbBorrower.insert(notificationsBorrower).then(()=>{
                return res.send("ok: handover successfully cancelled")
             })
         })
       })
     }
     else {
       console.log("not a valid Handover Cancel");
       res.statusCode = 400;
       return res.send('"error: there is no matching handover pending"')
     }
  })
  */
  .catch(function(err){
    res.statusCode = 500;
    return res.send(err)
  })

}

/**
thing level function.<br>
denies an announced handover set in {@link handover_announce}.<br>
deletes notification entries with item reference defined by request payload .data.ref
from &notifications doc of user sending as well as user defined by request payload .data.from

@param {Object} req - request object from express app
@param {Object} res - response object from express app

@TODO change after &notifications doc became &notifications database

@returns {Object} sends response to client with either couchDBs response after
notifications are deleted and a notification about the denial is inserted into
database of the owner of the announcment or error
*/
function handover_deny(req,res)
{
  console.log("HANDOVER DENY");
  console.log(req.body.data);
  if (req.body.data.from === undefined || req.body.data.ref === undefined)
  {
    res.statusCode = 400;
    return res.send('"error: no username or from provided"')
  }

  let dbBorrower = NANO_ADMIN.db.use('userdb-'+toHex(req.targets[0]));
  let db = NANO_ADMIN.db.use('userdb-'+toHex(req.body.data.from));
  let dbBorrowerNotifications = NANO_ADMIN.db.use('userdb-'+toHex(req.targets[0])+"-notifications");
  let dbNotifications = NANO_ADMIN.db.use('userdb-'+toHex(req.body.data.from)+"-notifications");
// TODO: CHECK IF ALLOWED TO CANCEL FIRST!!!
  return getNotificationsAsAdmin(req.body.data.from)
  .then((notifications)=>{
    notifications = notifications.docs;

    // check if already handover_await in notifications:
    let handoverAwait = notifications.find(function(entry){
      return entry._id.startsWith("handover_await-")
            && entry._id.split("handover_await-")[1] === req.body.data.ref;
    });
    // if so: stop and throw error
    if (handoverAwait === undefined){
      console.log("ERROR cancelling Lenders notifications");
      throw({
        statusCode: 400,
        reason:"ERROR denying Lenders notifications. requested notification not found"});
    }
    return dbNotifications.destroy(handoverAwait._id,handoverAwait._rev)
  })
  .then((destroyRes) => {
    if (!destroyRes.ok){throw({statusCode: 500,reason:"ERROR deleting handover_await"});}
    return destroyRes
  })
  .then(()=>{
    return dbBorrowerNotifications.get("handover_confirm-"+req.body.data.ref)
  })
  .then((handoverConfirm)=>{
    return dbBorrowerNotifications.destroy(handoverConfirm._id,handoverConfirm._rev)
  })
  .then((destroyRes2)=>{
    if (!destroyRes2.ok){throw({statusCode: 500,reason:"ERROR deleting handover_confirm"});}
    return destroyRes2
  })
  .then(()=>{
    // TODO: use req.body.data.ref to get name of item to include into message!
    return dbNotifications.insert({
      type: "info",
      text: `user ${req.targets[0]} denied the handover of your item ${req.body.data.ref}`,
      ref: req.body.data.ref
    })
  })
  .then((insertRes)=>{
    sendPushToUser(req.body.data.from,"handover denied by "+ req.targets[0]);
    return res.send("ok: handover successfully cancelled");
  })
/*
  return db.get("&notifications").then((notifications) => {
    console.log(notifications);
    let validHandover =
    (notifications.pending.handover_await[req.body.data.ref] !== undefined)

     if (validHandover)
     {
       delete notifications.pending.handover_await[req.body.data.ref];
       let newNoti = { ref: req.body.data.ref,
         text:`user ${req.targets[0]} denied the handover of your item ${req.body.data.ref}`}
      if (notifications.pending.info === undefined){ notifications.pending.info = {} }
       notifications.pending.info[req.body.data.ref] = newNoti;
       return db.insert(notifications).then(() =>{
         return dbBorrower.get("&notifications").then((notificationsBorrower) =>
         {
           delete notificationsBorrower.pending.handover_confirm[req.body.data.ref];
             return dbBorrower.insert(notificationsBorrower).then(()=>{
                return res.send("ok: handover successfully cancelled")
             })
         })
       })
     }
     else {
       console.log("not a valid Handover Cancel");
       res.statusCode = 400;
       return res.send('"error: there is no matching handover pending"')
     }
  })
*/
  .catch(function(err){
    res.statusCode = 500;
    return res.send(err)
  })

}


/**
thing level function.<br>
confirms an announced handover set in {@link handover_announce}.<br>
deletes notification entries with item reference defined by request payload .data.ref
from &notifications doc of user sending as well as user defined by request payload
.data.from<br>
writes into &inMyPossession doc of user sending request<br>
writes username of new possessor into doc in questions field .inPossessionOf

@param {Object} req - request object from express app
@param {Object} res - response object from express app

@TODO change after &notifications and &inMyPossession docs became databases

@returns {Object|string} sends response to client with either "ok: handover success"
or error
*/
function handover(req,res)
{
  console.log("HANDOVER ATTEMPT");
  console.log("handover to "+req.username);

  if (/*req.body.data.from*/req.username === undefined || req.body.data.ref === undefined)
  {
    res.statusCode = 400;
    return res.send('"error: no username or from provided"')
  }

  // to do: change db connections depending on return or normal handovers
  // for that: LOG body.data.from and check what it would be incoming from UI
  console.log("handover request data:");
  console.log(req.body.data);

  let db = NANO_ADMIN.db.use('userdb-'+toHex(req.targets[0]));
  let dbNotifications = NANO_ADMIN.db.use('userdb-'+toHex(req.targets[0])+"-notifications");
  let dbInMyPossession = NANO_ADMIN.db.use('userdb-'+toHex(req.targets[0])+"-inmypossession");
  let dbLender; let dbLenderNotifications;

  let promConfirm = dbNotifications.get("handover_confirm-"+req.body.data.ref);

  promConfirm.then((handoverConfirm)=>{
    dbLender = NANO_ADMIN.db.use('userdb-'+toHex(handoverConfirm.from)); // CHANGED HERE
    dbLenderNotifications = NANO_ADMIN.db.use('userdb-'+toHex(handoverConfirm.from)+"-notifications");
  }).then(()=>{

    // check if alleged lender has notification of pending handover in DB:
    let promAwait = dbLenderNotifications.get("handover_await-"+req.body.data.ref);

    Promise.all([promAwait,promConfirm])
    .then((results)=>{
      let handoverAwait = results[0];
      let handoverConfirm = results[1];

      if(!handoverAwait._id){throw({statusCode:500,reason:"ERROR no handoverAwait found"});}
      if(!handoverConfirm._id){throw({statusCode:500,reason:"ERROR no handoverConfirm found"});}

      let isReturn = handoverConfirm.isReturn;
      // delete notifications
      // first: inside lenders notifications:
      dbLenderNotifications.destroy(handoverAwait._id,handoverAwait._rev)
      .catch((err)=>{console.log("ERROR on deleting dbLenderNotifications");})
      // second: inside borrowers notifications:
      dbNotifications.destroy(handoverConfirm._id,handoverConfirm._rev)
      .catch((err)=>{console.log("ERROR on deleting dbNotifications");})

      console.log("handover notification delete was initiated");

      // next: do the ACTUAL HANDOVER:
      // assign correct db for ThingOwner depending on if handover is Return or not:
      let dbThingOwner = dbLender;
      let dbThingOwnerNotifications = dbLenderNotifications;
      if (isReturn){
        console.log("IS RETURN. will therefore fetch doc from owners DB");
        dbThingOwner = db;
        dbThingOwnerNotifications = dbNotifications;
      }
      return dbThingOwner.get(req.body.data.ref)

      .then((item)=>{
        console.log("handover item fetched from db:");
        console.log(item);
        // to do: check if Lender is allowed to do that operation again (for the kicks)
        // set owner of db of thing as default if no inPossessionOf field found:
        let oldPossessor =
        (item.inPossessionOf === undefined) ? getTargetsFromUrl(item.hyperlink)[0] : item.inPossessionOf;
        let dbOldPossessor = NANO_ADMIN.db.use('userdb-'+toHex(oldPossessor));
        let dbOldPossessorNotifications = NANO_ADMIN.db.use('userdb-'+toHex(oldPossessor)+"-notifications");
        let dbOldPossessorInMyPossession = NANO_ADMIN.db.use('userdb-'+toHex(oldPossessor)+"-inmypossession");

        item.inPossessionOf = req.username;
        console.log("(((((((((((((((((((((new item:)))))))))))))))))))))");
        console.log(item);
        console.log("(((((((((((((((((((((         )))))))))))))))))))))");
        // this should be API not DB directly:
        // get AuthCookie as admin:
        return requestPromise({
            method: 'GET',
            url: REQUESTURL,
            json: {
                "username":"admin",
                "password":DBadminPW
              }
          })
          .then((r)=>{
            console.log(">>>> handover got admin Cookie:");
            console.log(r.headers["set-cookie"][0]);

            let targetDBname = /*req.body.data.from*/handoverConfirm.from; // changed HERE
            if (isReturn)
            {
              targetDBname = req.targets[0];
              console.log("targetDB is "+ targetDBname);
            }
            console.log("sending update for item to inPossessionOf: " + item.inPossessionOf);
            console.log("sending to: " + REQUESTURL+targetDBname+"/"+req.body.data.ref);
            return requestPromise({
                method: 'POST',
                url: REQUESTURL+targetDBname+"/"+req.body.data.ref,
                //url: "https://dingsda.org:3000/api/v1/"+targetDBname+"/"+req.body.data.ref,
                json: {
                    "data":[{
                      "type":"update",
                      "doc":item
                    }]
                },
                headers: {'Cookie':r.headers["set-cookie"][0]}
              })
            // <<<<< HANDOVER OF ITEM ENDS HERE. following are inMyPossession operations
            .then((updateRes)=>{
              console.log("----> handover got answer after update of item:");
              console.log(updateRes.body); // should have ok:true, i think
              if (!item.owners.includes(req.username))
              {
                console.log("not owner of handover item. therefore new entry in inMyPossession");
                  return addToInMyPossession(dbInMyPossession,item.hyperlink).then(function(){
                    if (item.inPossessionOf !== undefined)
                    {
                      return deleteFromInMyPossession(dbOldPossessorInMyPossession, item.hyperlink)
                      .then(function(){
                        console.log("HANDOVER COMPLETE");
                        sendPushToUser(req.targets[0],"handover with your involvement was announced!");
                        sendPushToUser(oldPossessor,"handover with your involvement was announced!");
                        return res.send("ok: handover success")
                      })
                    }
                    else {
                      console.log("NO item.inPossessionOf");
                      console.log(item.inPossessionOf);
                      console.log("HANDOVER COMPLETE");
                      return res.send("ok: handover success")
                    }
                  })
              }
              else
              {
                return deleteFromInMyPossession(dbOldPossessorInMyPossession, item.hyperlink)
                .then(function(){
                  console.log("HANDOVER RETURN COMPLETE");
                  return res.send("ok: handover return success")
                })
              }
            })

          })
        })
      })

  })


/*
  dbLender.get("&notifications").then((notifications) => {

    console.log(notifications);
    let validHandover =
    (notifications.pending.handover_await[req.body.data.ref] !== undefined &&
     notifications.pending.handover_await[req.body.data.ref].to === req.username)

     if (validHandover)
     {
        console.log(req.body.data);
        console.log("valid handover");
        // delete notifications
        // first: inside lenders notifications:
        delete notifications.pending.handover_await[req.body.data.ref];
        return dbLender.insert(notifications).then((DBres_L) =>{
          console.log("deleted handover Notification from Lenders DB");
          return db.get("&notifications").then((notifications_borrower)=>{
            console.log("got borrowers notifications:");
            console.log(notifications_borrower.pending.handover_confirm);
            let isReturn = notifications_borrower.pending.handover_confirm[req.body.data.ref].isReturn;
            delete notifications_borrower.pending.handover_confirm[req.body.data.ref];
            return db.insert(notifications_borrower).then((DBres_B) =>{
              console.log("handover notification delete was successful");

              // next: do the ACTUAL HANDOVER:
              let dbThingOwner = dbLender;
              if (isReturn){
                console.log("IS RETURN. will therefore fetch doc from owners DB");
                dbThingOwner = db;
              }
              return dbThingOwner.get(req.body.data.ref).then((item)=>{
                console.log("handover item fetched from db:");
                console.log(item);
                // to do: check if Lender is allowed to do that operation again (for the kicks)
                //let oldPossessor = item.inPossessionOf;
                let oldPossessor =
                (item.inPossessionOf === undefined) ? getTargetsFromUrl(item.hyperlink)[0] : item.inPossessionOf; // set owner of db of thing as default if no inPossessionOf field found
                let dbOldPossessor = NANO_ADMIN.db.use('userdb-'+toHex(oldPossessor));
                delete notifications.pending.handover_await[req.body.data.ref];
                item.inPossessionOf = req.username;
                console.log("(((((((((((((((((((((new item:)))))))))))))))))))))");
                console.log(item);
                console.log("(((((((((((((((((((((         )))))))))))))))))))))");
                // this should be API not DB directly:
                // get AuthCookie as admin:

                request({
                    method: 'GET',
                    url: REQUESTURL,
                    json: {
                        "username":"admin",
                        "password":DBadminPW
                      }
                  },function(err,r,body){
                    if(!err)
                    {
                      console.log(">>>> handover got admin Cookie:");
                      console.log(r.headers["set-cookie"][0]);

                      let targetDBname = req.body.data.from;
                      if (isReturn)
                      {
                        targetDBname = req.targets[0];
                        console.log("targetDB is "+ targetDBname);
                      }
                      console.log("sending update for item to inPossessionOf: " + item.inPossessionOf);
                      console.log("sending to: " + REQUESTURL+targetDBname+"/"+req.body.data.ref);
                      request({
                          method: 'POST',
                          url: REQUESTURL+targetDBname+"/"+req.body.data.ref,
                          //url: "https://dingsda.org:3000/api/v1/"+targetDBname+"/"+req.body.data.ref,
                          json: {
                              "data":[{
                                "type":"update",
                                "doc":item
                              }]
                            },
                          headers: {'Cookie':r.headers["set-cookie"][0]}
                        },function(err,r,body){
                          if (!err){
                            console.log("----> handover got answer after update of item:");
                            console.log(body); // should have ok:true, i think
                            if (!item.owners.includes(req.username))
                            {
                              console.log("not owner of handover item. therefore new entry in inMyPossession");
                                return addToInMyPossession(db,item.hyperlink).then(function(){
                                  if (item.inPossessionOf !== undefined)
                                  {
                                    return deleteFromInMyPossession(dbOldPossessor, item.hyperlink)
                                    .then(function(){
                                      console.log("HANDOVER COMPLETE");
                                      return res.send("ok: handover success")
                                    })
                                  }
                                  else {
                                    console.log("NO item.inPossessionOf");
                                    console.log(item.inPossessionOf);
                                    console.log("HANDOVER COMPLETE");
                                    return res.send("ok: handover success")
                                  }
                                })
                            }
                            else {
                              return deleteFromInMyPossession(dbOldPossessor, item.hyperlink)
                              .then(function(){
                                console.log("HANDOVER RETURN COMPLETE");
                                return res.send("ok: handover return success")
                              })
                            }
                          }
                          else {
                            console.log("HANDOVER ERROR");
                            res.statusCode = 500;
                            return res.send("error: while finishing handover")
                          }
                        })
                    }
                    else {
                      console.log("HANDOVER ERROR");
                      res.statusCode = 500;
                      return res.send("error: while fetching item for handover")
                    }
                  })
              })
            })
          })
        })
     }
     else {
       console.log("not a valid Handover");
       res.statusCode = 400;
       return res.send('"error: there is no matching handover pending"')
     }

  })
  */
  .catch((err)=>{
    console.log(err);
    res.statusCode = err.statusCode;
    return res.send(""+err.reason)
  });

}

/**
helper function.<br>
adds doc ID into db Owners &inMyPossession doc (this is where all items not owned
by possesed by a user a referenced)<br>
sister function of {@link deleteFromInMyPossession}

@param {Object} db - nano database instance
@param {string} itemHyperlink - .hyperlink field from item/doc to be written
into inMyPossession

@TODO change after &inMyPossession doc became databases

@returns {Promise} returns nano promise to insert updated doc
*/
function addToInMyPossession(db,itemHyperlink,time={})
{
  console.log("adding to inMyPossession");
  return db.insert({_id:itemHyperlink,timeBorrowed:time})
  /*
  return db.get("&inMyPossession").then((inMyPossession) => {
    inMyPossession.things = addToArrayIfNotExist(inMyPossession.things,itemHyperlink);
    return db.insert(inMyPossession)
  })
  */
}

/**
helper function.<br>
removes doc ID from db Owners &inMyPossession doc<br>
sister function of {@link addToInMyPossession}

@param {Object} db - nano database instance
@param {string} itemHyperlink - .hyperlink field from item/doc to be written
into inMyPossession

@TODO change after &inMyPossession doc became databases

@returns {Promise} returns nano promise to insert updated doc
*/
function deleteFromInMyPossession(db,itemHyperlink)
{
  console.log("DELETING ITEM "+itemHyperlink+" FROM POSSESION OF OLD POSS ");
  db.get(itemHyperlink).then((item)=>{
    return db.destroy(itemHyperlink,item._rev)
  }).catch((err)=>{
    console.log("deleteFromInMyPossession() could not delete item:");
    console.log(err.reason)
  })
  return new Promise((resolve,reject)=>{{resolve({ok:true,comment:"nothing to delete"});}})

/*
  return db.get("&inMyPossession").then((inMyPossession) => {
    if (inMyPossession.things.includes(itemHyperlink))
    {
      console.log("index "+inMyPossession.things.indexOf(itemHyperlink));
        inMyPossession.things.splice([inMyPossession.things.indexOf(itemHyperlink)],1);
    }
    return db.insert(inMyPossession)
  })
  */
}


/**
thing level function.<br>
updates doc.location in DB (both defined by request url) to new location defined
in requests payload .data.location.

@param {Object} req - request object from express app
@param {Object} res - response object from express app

@returns {Object|string} sends response to client with either couchDB response
or error
*/
function move(req,res)
{
/*
validate move commands body:
*/
if (req.body.data.location == undefined)
{
  //console.log(req.body);
  res.statusCode = 400;
  return res.send('"error: no location provided"'+req.body.data.location)
}
// TODO: validateMoveRights (couch via doc_validate_update?)
  let db = NANO_ADMIN.db.use('userdb-'+toHex(req.targets[0]));

  db.get(req.targets[1]).then((doc) => {
    if (doc.inPossessionOf && doc.inPossessionOf.includes(req.username))
    {
      console.log("moving via inPossessionOf!!!");

      console.log(doc);
      //res.send(doc._rev)
      let newdoc = deepcopy(doc);
      newdoc.location = req.body.data.location;
      return db.insert(newdoc).then((DBres) => {
          if (DBres.ok)
          {
            updatePublicDBIfPublic(req,newdoc);
            // if insideOf provided in new location: update it's container:
            /*
            if (newdoc.location && newdoc.location.insideOf && newdoc.location.insideOf !== "" )
            {
              updateContainerOf(req,newdoc.location.insideOf,newdoc._id,req.DBAuthToken,false,
                function(updateRes){
                  console.log("move: result updateContainerOf:");
                  console.log(updateRes);
                }
              );
            }*/
            checkIfContainerOfUpdate(req, newdoc, doc) // is doc really olddoc like needed?
          }
          return res.send(DBres)
      })

    }
    else
    {
        console.log("moving but NOT via inPossessionOf.");
        let db2 = couch_getUserDB(req);
        let nanoUser = db2[0]; let dbUser = db2[1];
        console.log(doc);
        //res.send(doc._rev)
        let newdoc = doc;
        newdoc.location = req.body.data.location;
        return dbUser.insert(newdoc).then((DBres) => {
          if (DBres.ok)
          {
            updatePublicDBIfPublic(req,newdoc);
          }
          return res.send(DBres)
        })
    }
  }).catch((err)=>{
    console.log(err);
    res.statusCode = err.statusCode;
    return res.send(""+err.reason)
  });
}

/**
helper function prechecking if update of containerOf is necessary.
if the case: updates via [@link updateContainerOf]
*/
function checkIfContainerOfUpdate(req,newDoc,oldDoc) // modified from parts within update() TODO: implement to update()
{

  // CONTAINER / INSIDEOF UPDATES:
  // if item is inside of other item: update the other items conainerOf:
  // function UpdateContainerOfIfUpdateNeeded(req, oldDoc, newDoc,target)
  if (oldDoc.location !== undefined &&
      oldDoc.location.insideOf !== undefined &&
      oldDoc.location.insideOf != newDoc.location.insideOf)
  {
    console.log("insideOf changed");
    let targetDel = oldDoc.location.insideOf;
    let targetUpd = newDoc.location.insideOf;
    if (!targetDel.startsWith("https"))
    {
      targetDel = INSTANCEURL.slice(0,-1)+":" + //INSTANCEURL minus slash
                API_PORT+API_BASE_URL+req.username+"/"+targetDel;
    }
    // delete target from req Target (a.k.a. the item we are updating)
    console.log( "deleting items id from " + targetDel );

    updateContainerOf(req,targetDel,req.targets[1],req.DBAuthToken,true,function(){

      console.log("CONTAINER SHOULD BE UPDATED NOW");
          // update new container item
          if (targetUpd !== undefined && targetUpd !== ""){
            if (!targetUpd.startsWith("https"))
            {
              targetUpd = INSTANCEURL.slice(0,-1)+":" + //INSTANCEURL minus slash
                        API_PORT+API_BASE_URL+req.username+"/"+targetUpd;
            }
            console.log("adding items id to "+targetUpd._id);
            updateContainerOf(req,targetUpd,req.targets[1],req.DBAuthToken);
          }else{console.log("no new container. thing is free now");}

    });

  }
  else if (newDoc.location && newDoc.location.insideOf !== undefined
            && newDoc.location.insideOf !== "")
  {
        console.log("insideOf did not change but exists in new doc");

        let target = newDoc.location.insideOf;
        if (!target.startsWith("https"))
        {
          target = INSTANCEURL.slice(0,-1)+":" + //INSTANCEURL minus slash
                    API_PORT+API_BASE_URL+req.username+"/"+target;
        }
        // update new container item
        updateContainerOf(req,target,req.targets[1],req.DBAuthToken);
  }
  else {
    console.log("insideOf does not exist nor did it change");
    console.log(newDoc.location);
  }

}


// NICE TO HAVE: delete fields if they contain _delete or null ?

/**
thing level function.<br>
updates doc in DB (both defined by request url)<br>
<br>
fetched oldDoc, compares and merges oldDoc and .data.doc (from request payload),
calls {@link updateContainerOf} if locationInsideOf is present in .data.doc, updates
publicDB(s) if .data.other.visibility indicates public Read Rights (via
{@dlink eleteItemCopies} and {@link insertItemCopies}) and finally inserts new merged doc
into DB.

@TODO: pack checks and validations into their own functions for better readability

@param {Object} req - request object from express app
@param {Object} res - response object from express app

@returns {Object|string} sends response to client with either couchDB response
or error
*/
function update(req,res)
{
  console.log("user tries to update item:");
  console.log(req.targets);
  if (req.body.data.doc == undefined || req.body.data.doc._id !== req.targets[1])
  {
    console.log(req.body.data.doc);
    res.statusCode = 400;
    return res.send('"error: no or wrong doc provided. id in url is queen"')
  }
  // validation of Edit Rights are atm done by CouchDB server via doc_validate_update)
    let db = couch_getUserDB(req);
    let nanoUser = db[0]; let dbUser = db[1];
    req.body.data.doc.lastedited = Date.now();
    req.body.data.doc.lasteditedBy = req.username;
    //console.log(req.body.data.doc);

    // get oldDoc before update to compare later:
    dbUser.get(req.targets[1])
    .then(function(oldDoc){
      //console.log("got old Doc back from DB before update:");
      //console.log(oldDoc);

      checkIfContainerOfUpdate(req, req.body.data.doc, oldDoc) // new instead of uncommented stuff below
/*
      // CONTAINER / INSIDEOF UPDATES:
      // if item is inside of other item: update the other items conainerOf:
      // function UpdateContainerOfIfUpdateNeeded(req, oldDoc, newDoc,target)
      if (oldDoc.location !== undefined &&
          oldDoc.location.insideOf !== undefined &&
          oldDoc.location.insideOf != req.body.data.doc.location.insideOf)
      {
        console.log("insideOf changed");
        let targetDel = oldDoc.location.insideOf;
        let targetUpd = req.body.data.doc.location.insideOf;
        if (!targetDel.startsWith("https"))
        {
          targetDel = INSTANCEURL.slice(0,-1)+":" + //INSTANCEURL minus slash
                    API_PORT+API_BASE_URL+req.username+"/"+targetDel;
        }
        // delete target from req Target (a.k.a. the item we are updating)
        console.log( "deleting items id from " + targetDel );

        updateContainerOf(req,targetDel,req.targets[1],req.DBAuthToken,true,function(){

          console.log("CONTAINER SHOULD BE UPDATED NOW");
              // update new container item
              if (targetUpd !== undefined && targetUpd !== ""){
                if (!targetUpd.startsWith("https"))
                {
                  targetUpd = INSTANCEURL.slice(0,-1)+":" + //INSTANCEURL minus slash
                            API_PORT+API_BASE_URL+req.username+"/"+targetUpd;
                }
                console.log("adding items id to "+targetUpd._id);
                updateContainerOf(req,targetUpd,req.targets[1],req.DBAuthToken);
              }else{console.log("no new container. thing is free now");}

        });

      }
      else if (req.body.data.doc.location && req.body.data.doc.location.insideOf !== undefined
                && req.body.data.doc.location.insideOf !== "")
      {
            console.log("insideOf did not change but exists in new doc");
            let target = req.body.data.doc.location.insideOf;
            if (!target.startsWith("https"))
            {
              target = INSTANCEURL.slice(0,-1)+":" + //INSTANCEURL minus slash
                        API_PORT+API_BASE_URL+req.username+"/"+target;
            }
            // update new container item
            updateContainerOf(req,target,req.targets[1],req.DBAuthToken);
      }
      else {
        console.log("insideOf does not exist nor did it change");
        console.log(req.body.data.doc.location);
      }
*/
      // SHARING / VISIBILITY UPDATES:
      // if other.visibility changed from last update:
      if (oldDoc.other !== undefined &&
          oldDoc.other.visibility !== undefined &&
          req.body.data.doc.other.visibility !== undefined &&
          !compareArrays(oldDoc.other.visibility,req.body.data.doc.other.visibility))
      {
        console.log("VISIBILITY CHANGED!");
        deleteItemCopies(req, nanoUser,oldDoc)
        .then(function(){
          return insertItemCopies(req, nanoUser, oldDoc)
        }).catch(function(err)
        {
          console.log("error trying to delete "+req.body.data.doc._id+
          " from public DB. now trying to insert copies into public DB if visibility indicates that");
          insertItemCopies(req, nanoUser, oldDoc).catch(console.log);
        })
      } // In case visibility did not change (or: this is an ADD operation:)

      else if (req.body.data.doc.other !== undefined &&
              req.body.data.doc.other.visibility !== undefined)
      {
          if (req.body.data.doc.other.visibility.includes("public") )
          {
             // update item inside of public
             console.log("VISIBILITY DIDNT CHANGE BUT IS PUBLIC");
             deleteItemCopies(req, nanoUser,oldDoc)
             .then(function(){
               return insertItemCopies(req, nanoUser)
             }).catch(console.log)
          }
          else if (req.body.data.doc.other.visibility.includes("friends"))
          {
             // update item in friends

             // TODO: fill or send error for not yet in use
          }
          else if (req.body.data.doc.other.visibility.includes("friends2nd"))
          {
             // update item in friends
             // update item in friends2nd

             // TODO: fill or send error for not yet in use
          }
      }


      /// ACTUAL UPDATE /////////////////
      // merge oldDoc with new Doc, giving newDoc higher importance:

      // make sure latitude and longitude are floats
      if (req.body.data.doc.location &&
        req.body.data.doc.location.latitude && req.body.data.doc.location.longitude)
      {
        req.body.data.doc.location.latitude = parseFloat(req.body.data.doc.location.latitude);
        req.body.data.doc.location.longitude = parseFloat(req.body.data.doc.location.longitude);
      }


      let newOther = {}
      if (oldDoc.other || req.body.data.doc.other)
      {
       newOther = Object.assign(oldDoc.other,req.body.data.doc.other);
      }
      let newObj = Object.assign(oldDoc,req.body.data.doc);
      // TO DO: HERE we could also try to use oldDoc._rev instead of newdocs rev IF we want to overwrite without checking clients version !!!!!!!!
      newObj._rev = oldDoc._rev // this is the quick test for that.
      // TO DO: add option to update() to choose which rev is used!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      console.log("old rev: " + req.body.data.doc._rev+ " new rev:"+ oldDoc._rev + "make:"+newObj._rev);
      newObj.other = newOther;
      // add hyperlink to this instance as place where this things recides (happens NOT on MOVE)
      newObj = addHyperlink2Doc(req,newObj);
      // TO DO: delete all actively deleted Elements (those with value null):
      //        (...)


      /* FIXME: the next part might be better inside of getGeoDataFromContainer()
          making getGeoDataFromContainer() accept obj instead of string...???
      */
      if (!newObj.location) // mainly for &config and other possible docs w/o location
      {
         // if no location.make empty one:
         newObj.location = {};
      }
      /*
      check if geolocation needs to be fetched from container of item (if it has one)
      , then update:
      */
      return getGeoDataFromContainer(req,newObj.location.insideOf)
      .then((containerGeoLocation)=>{

        if(containerGeoLocation)
        {
          newObj.location = Object.assign(newObj.location,containerGeoLocation);
        }

        // insert new Doc:
        return dbUser.insert(newObj).then((DBres) => {
            //return res.send(DBres)

            // after all is done: update items inside THIS item:
            copyGeoDataFromContainerToAllItemsInside(req, newObj._id)

            /// and add pic attachment  to DB if provided >>>>>
            if (req.body.data.pic !== undefined && req.body.data.pic !== "")
            {
              console.log("\npicture UPDATE requested!");
              // add here: check filesize
              console.log("DBres:");
              //console.log(DBres);
              let picdata = req.body.data.pic.replace(/^data:image\/\w+;base64,/, '');
              let data = Buffer.from(picdata, 'base64')
              return dbUser.attachment.insert(req.targets[1], 'pic_small.jpg',
                data ,'image/jpeg',{ rev: DBres.rev }).then(function(){
                  console.log("picture updated successfully");
                  return DBres;
                })
                .catch((err)=>{
                  console.log("error while updating picture:");
                  console.log(err);
                  return err;
                })
                /// <<<<<<< pic attachment
            }
            else {
              return DBres
            }
          })


      })
      .then(function(DBres){

        // and of course send something back to the client:
        return res.send(DBres)
      })
    })
    .catch((err)=>{
      console.log(err);
      res.statusCode = err.statusCode;
      res.send(err.reason)
    })
}


/**
thing level helper function: gets container of thing (value of location.insideOf)
and returns it's geolocation or undefined via promise resolve
*/
function getGeoDataFromContainer(req, idContainer ){
  // TODO
  return new Promise(function(resolve, reject) {

    let db = couch_getUserDB(req);
    let nanoUser = db[0]; let dbUser = db[1];

    if(idContainer)
    {
      return dbUser.get(idContainer).then((dbRes)=>{
        if (!dbRes.location)
        {
          resolve(null)
        }
        if (dbRes.location.insideOf)
        { delete dbRes.location.insideOf; }
        /*
        console.log();
        console.log("========= CONTAINER LOCATION =========");
        console.log(dbRes.location);
        console.log("======================================");
        console.log();
        */
        resolve(dbRes.location)
      })
    }
    else {
      resolve(null)
    }

  });

}

/**
thing level helper function: takes geoData from container and copies it into all
docs listed in items -containerOf 's location field
*/
function copyGeoDataFromContainerToAllItemsInside(req, idContainer)
{
  // TODO
  let nanoUser = NANO_ADMIN; let dbUser = nanoUser.db.use("userdb-"+toHex(req.targets[0]));

  dbUser.get(idContainer+"-containerOf").then((DBres)=>{

    if (DBres.containerOf)
    {
      return getGeoDataFromContainer(req,idContainer)
      .then((containerGeoLocation)=>{


          if(containerGeoLocation)
          {

            for (id of DBres.containerOf)
            {
              dbUser.get(id).then((doc)=>{
                doc.location = Object.assign(doc.location,containerGeoLocation);
                return dbUser.insert(doc)
              })
              .catch((err)=>{console.log("ERROR updating geolocation of item:"+err);})
            }


          }

      })
    }

  })
  .catch((err)=>{console.log("ERROR inside copyGeoDataFromContainerToAllItemsInside");})

}

///////////////////////////////
/////// DB LEVEL HELPER ///////

/**
database level function.<br>
writes a borrow request notification into target user (defined by request
url) database's &notifications doc.<br>
includes infos from &config doc of user sending.

@TODO: change after &notifications doc became database

@param {Object} req - request object from express app
@param {Object} res - response object from express app

@returns {Object|string} sends response to client with either "ok" or error
*/ 
function borrow_request(req,res){
  console.log(req.username + " asks to borrow thing "+req.body.data.ref);

  let dbNotifications = NANO_ADMIN.db.use('userdb-'+toHex(req.targets[0])+"-notifications");

  // HERE LATER: check if already contacted about another thing. then just add to it
  // for now: add info to notifications.pending.info:
  // make new Notification:
  let email = req.body.data.contact_details.email;
  let tel = req.body.data.contact_details.telnumber;
  let other = req.body.data.contact_details.other;
  let contact = `
  <br> email: <b>${email}</b>
  <br> tel: <b>${tel}</b>
  <br> other: <b>${other}</b>`
  let newNoti = { ref: req.body.data.ref,type:"info",
      text:`user ${req.username} wants to borrow ${req.body.data.ref} from
      ${req.body.data.from} till ${req.body.data.till} you can contact them via:
      ${contact}`}
  return dbNotifications.insert(newNoti).then(() =>{
      
      sendPushToUser(req.targets[0],
      `user ${req.username} wants to borrow ${req.body.data.ref} from ${req.body.data.from} till ${req.body.data.till} you can contact them via: ${contact}`
      );
      return res.send("ok");

  }).catch(function(err){
    res.statusCode = 500;
    return res.send(err)
  })
}

/**
database level helper function.<br>
checks if .other.visibility of doc is public and if so deletes and inserts copies
of the doc into this instance's public database via {@link deleteItemCopies} and
{@link insertItemCopies}

@param {Object} req - request object from express app
@param {Object} doc - document object including the document to be updated inside
of public DB

*/
function updatePublicDBIfPublic(req,doc){
  if (doc.other && doc.other.visibility.includes("public") )
  {
    deleteItemCopies(req, NANO_ADMIN,doc)
    .then(function(){
      req.body.data.doc = doc;
      return insertItemCopies(req, NANO_ADMIN)
    }).catch(console.log) // TODO: check if should return promise
  }
}

/**
database level helper function.<br>
deletes all copies of doc defined in requests url from this instance's public DB
<br><br>
sister function of {@link insertItemCopies}

@param {Object} req - request object from express app
@param {Object} nanoUser - nano instance for the user for whom we called this function
@param {Object} [oldDoc={other:{visibility:[]}}] - oldDoc PROBABLY NOT NEEDED

@returns {Object|string} sends response to client with either DBResponse or error
*/
function deleteItemCopies(req,nanoUser, oldDoc={other:{visibility:[]}})
{
                                      // TODO: check if oldDOc needed
  //check if we have to delete sth from publicDBs:

  // FIRST tidy up:
  // delete id from DB public
  // delete id from DB friends
  // delete if from DB friends2nd
  let publicDB = nanoUser.use("public");

  return publicDB.head(req.targets[1]).then(function(head){
    if (head.etag !== undefined)
    {
        return publicDB.destroy(req.targets[1],head.etag.replace(/"/g,""))
    }
    else {
      return head
    }
  }).catch(function(headRes){
    console.log("could not get head of item. Does not exist");
    console.log(headRes);
    return headRes
  })
}

/**
database level helper function.<br>
inserts a copy of doc defined in requests url from this instance's public DB
<br><br>
sister function of {@link deleteItemCopies}

@param {Object} req - request object from express app
@param {Object} nanoUser - nano instance for the user for whom we called this function
@param {Object} [oldDoc={other:{visibility:[]}}] - oldDoc doc to compare changes with

@TODO: implement or get rid of possible other public/semi public DBs (friends, friends2nd)
for those are not yet implemented

@returns {Object|string} sends response to client with either DBResponse or error
*/
function insertItemCopies(req, nanoUser, oldDoc={other:{visibility:[]}})
{
        console.log("inside insertItemCopies");
        let publicDB = nanoUser.use("public");

        if (/*!oldDoc.other.visibility.includes("public") &&*/
            req.body.data.doc.other.visibility.includes("public"))
        {
          // copy item into public
          console.log("trying to copy item into public DB");
          let copy = Object.assign({}, req.body.data.doc); delete copy._rev;
          delete copy._attachments;
          /*copy.hyperlink = INSTANCEURL.slice(0, -1)+":" + //INSTANCEURL minus slash
                    API_PORT + API_BASE_URL + req.username + "/" + req.targets[1];*/
          //console.log(copy);
          return publicDB.insert(copy).catch(console.log)
        }
        else {
          console.log("insertItemCopies: "+req.body.data.doc._id+" : NOT PUBLIC ");
        }
        if (!oldDoc.other.visibility.includes("friends") &&
            req.body.data.doc.other.visibility.includes("friends"))
        {
          // copy item into friends
          // TODO: fill or throw error for not yet implemented
        }
        if (!oldDoc.other.visibility.includes("friends2nd") &&
            req.body.data.doc.other.visibility.includes("friends2nd"))
        {
          // copy id from DB friends2nd
          // copy item into friends
          // TODO: fill or throw error for not yet implemented
        }
}


/**
database level function.<br>
adds item defined in requests payload to users Database.<br>
<br>
assigns uuid as _id, adds timestamp .created and other default fields to doc<br>
adds a second sister document named <id>-containerOf to DB<br>
adds itemCopies of new doc into public DBs if .other.visibility field of doc
requires that.

@param {Object} req - request object from express app
@param {Object} res - response object from express app

@returns {Object|string} sends response to client with either DBResponse or error
*/
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

// TO DO: HERE (instead): VALIDATION !!!!!!!!!!!
    // default visibility in case client did not specify:
    if (req.body.data.doc.other.visibility === undefined)
    {
      req.body.data.doc.other.visibility = "friends"
    }

    // make sure latitude and longitude are floats
    if (req.body.data.doc.location.latitude && req.body.data.doc.location.longitude)
    {
      req.body.data.doc.location.latitude = parseFloat(req.body.data.doc.location.latitude);
      req.body.data.doc.location.longitude = parseFloat(req.body.data.doc.location.longitude);
    }

    req.body.data.doc.created = Date.now();
    req.body.data.doc._id = uuidv5(INSTANCEURL+req.targets[0]+"/"+req.body.data.doc.created, uuidv5.URL);
    req.body.data.doc = addHyperlink2Doc(req,req.body.data.doc);

    return dbUser.insert(req.body.data.doc).then((DBres) => {

      /*
      add extra doc to keep list of items insideOf this item inside of it's own
      document.
      this was necessary because through updateContainerOf() there
      were several conflicts when doing batch updates. hopefully this will solve
      this issue:
      */
      dbUser.insert({
        _id: req.body.data.doc._id+"-containerOf",
        containerOf: [],
        owners:[req.body.data.doc.owners]
      })

      /*
      if picture is provided, also upload picture as attachment to doc:
      */
      if (req.body.data.pic != undefined)
      {
        //console.log("PICTURE PROVIDED!!!");
        let picdata = req.body.data.pic.replace(/^data:image\/\w+;base64,/, '');
        let data = Buffer.from(picdata, 'base64')
        dbUser.attachment.insert(DBres.id, 'pic_small.jpg',
          data ,'image/jpeg',{ rev: DBres.rev }).then(
          //  console.log
          )
        //console.log(req.body.data.pic);

      }
        // all is done, so let's also make a copy if item is visible for non-owners:
        insertItemCopies(req, nanoUser);
        // then update the thing this thing is in if it is inside of sth:
        console.log(req.body.data.doc);
        if (req.body.data.doc.location !== undefined &&
           req.body.data.doc.location.insideOf !== undefined && req.body.data.doc.location.insideOf !== "")
        {
          updateContainerOf(req,req.body.data.doc.location.insideOf,req.body.data.doc._id,req.DBAuthToken)
        }
        // and send the response
        return res.send(DBres)
      })
    .catch((err)=>{
      console.log(err);
      res.statusCode = err.statusCode;
      res.send(err.reason)
    })
}

/**
database level function.<br>
searches for items in Database defined by request url and returns list of items
with most relevant fields of found docs/items.<br>
uses {@link makeMango} to build a mango style search query to couchDBs find API<br>
expects a payload .data.doc with all fields that should be included in the search.

@TODO: find good size for query limit for find API (q.limit)

@param {Object} req - request object from express app
@param {Object} res - response object from express app

@returns {Object|string} sends response to client with either DBResponse or error
*/
function findItems(req,res)
{
  //console.log(req.body.data.doc);

  if (req.body.data.doc == undefined || Object.keys(req.body.data.doc).length === 0)
  {
    res.statusCode = 400;
    return res.send('"error: no doc provided or no search params inside of doc "')
  }

  if (req.body.data.doc["location.latitude"] !== undefined &&
      req.body.data.doc["location.latitude"] !== "0" &&
      req.body.data.doc["location.latitude"] !== "" ){
    // get latitude down to only 3 decimal places.
    req.body.data.doc["location.latitude"] = parseFloat(
      trimFloatStringToNDecimalPlaces(req.body.data.doc["location.latitude"]));
  }
  if (req.body.data.doc["location.longitude"] !== undefined &&
      req.body.data.doc["location.longitude"] !== "0" &&
      req.body.data.doc["location.longitude"] !== "" ){
    // get longitude down to only 3 decimal places.
    req.body.data.doc["location.longitude"] = parseFloat(
      trimFloatStringToNDecimalPlaces(req.body.data.doc["location.longitude"]));
      console.log(req.body.data.doc["location.longitude"]);
      console.log(typeof req.body.data.doc["location.longitude"] == "string");
      console.log(req.body.data.doc["location.latitude"]);
      console.log(typeof req.body.data.doc["location.latitude"] == "string");
  }

  let db = couch_getUserDB(req);
  let nanoUser = db[0]; let dbUser = db[1];
  let q = makeMango(req.body.data.doc);
  console.log(q);
  q.limit = 50;
  q.fields = ["_id","name","location","other","owners","hyperlink","inPossessionOf","_rev","_attachments"];
  //q.execution_stats = true; // maybe relevant later for easy pagination
  if (req.body.data.bookmark)
  {
    q.bookmark = req.body.data.bookmark
  }
  dbUser.find(q).then((doc) => {
      //console.log(doc);
      delete(doc.warning); // whats that?
      return res.send(doc)
    }).catch(function(err){
      res.statusCode = 400;
      res.send(err)
    });
}

/**
database level function.<br>
deletes single item in Database defined by request url<br>
<br>
after deletion of target doc, also attempts to delete all copies of this doc within
publicDBs as well as docs sister doc <id>-containerOf

@TODO: either change name to deleteItem or add possiblity to make batch deletes

@param {Object} req - request object from express app
@param {Object} res - response object from express app

@returns {Object|string} sends response to client with either DBResponse or error
*/
function deleteItems(req,res)
{
  if (req.body.data.doc == undefined || req.body.data.doc._id !== req.targets[1])
  {
    res.statusCode = 400;
    return res.send('"error: no or wrong doc provided. id in url is queen"')
  }

  console.log("deleting: ");
  console.log(req.body.data.doc);

  let db = couch_getUserDB(req);
  let nanoUser = db[0]; let dbUser = db[1];
  return dbUser.destroy(req.body.data.doc._id,req.body.data.doc._rev)
   .then((DBres) => {
       console.log(DBres);
       console.log("deleted item");
       //return res.send(DBres);
       // now also delete all copies in public and shared DBs:
       deleteItemCopies(req,nanoUser);
       // now delete xxx-containerOf belonging to deleted item doc:
       deleteContainerOf(req,req.body.data.doc._id);
       // now get also rid of all entries in items container if inside one:
       if(req.body.data.doc.insideOf !== undefined && req.body.data.doc.insideOf !== "")
       {
         updateContainerOf(req,req.body.data.doc.location.insideOf,req.body.data.doc._id,req.DBAuthToken,true)
       }
       return res.send(DBres)
    }).catch((err)=>{
      console.log("ERROR deleting item:");
      console.log(err);
      res.statusCode = err.statusCode;
      res.send(err.reason)
    })
}

/**
database level helper function.<br>
deletes -containerOf sister document of targetID

@param {Object} req - request object from express app
@param {Object} targetID - _id of doc whose -containerOf sister doc to be deleted
*/
function deleteContainerOf(req, targetID)
{
  let db = couch_getUserDB(req);
  let nanoUser = db[0]; let dbUser = db[1];

  console.log("deleting "+targetID+"-containerOf:");
  // first: get the original doc (for correct _rev number):
  dbUser.get(targetID+"-containerOf")
  .then((oldDoc) => {
    return dbUser.destroy(oldDoc._id,oldDoc._rev)
  })
  .catch( (err) => {
    console.log("deleteContainerOf: ERROR:");
    console.log(err);
  } )
}

/**
helper function.<br>
uses request and doc to create valid .hyperlink field and add it to doc provided

@param {Object} req - request object from express app
@param {Object} doc - doc to add .hyperlink to

@returns {Object} doc including new .hyperlink field
*/
function addHyperlink2Doc(req,doc)
{
  let urlAfterAPI = req.url.split(API_BASE_URL)[1].split("?")[0];
  let targets = urlAfterAPI.split("/");
  targets = targets.filter(String);
  console.log("adding hyperlink with username "+targets[0]+" to doc");

  doc.hyperlink = INSTANCEURL.slice(0, -1)+":" + //INSTANCEURL minus slash
            API_PORT + API_BASE_URL + targets[0] + "/" + doc._id; // NEEDS TO COME FROM URL NOT USERNAME BUGGGGGGGGGGGG
  return doc
}


/**
database level helper function.<br>
updates -containerOf sister doc of target by adding thingInside to its
.containerOf field via {@link addContainerOfDoc}<br>
If delete_it flag is set true, will delete item instead of adding it.

@param {Object} req - request object from express app
@param {string} target - _id of doc whose -containerOf sister doc to be updated
@param {string} thingInside - _id of doc which should be deleted or added to
target-containerOf
@param {string} authCookie - AuthSessionToken to be used as Auth in communication
with DB
@param {boolean} delete_it - flag. if true thingInside will be removed from
<target>-containerOf
@param {callback} callback - callback. will get true or false depending on success or not
*/
function updateContainerOf(req,target,thingInside,authCookie,delete_it=false,callback=console.log)
{
  console.log("updateContainerOf:");
  if (delete_it) {console.log("FOR DELETION");}
  else { console.log("TO ADD");}
  console.log("target: "+target);

  if (!target.startsWith("https"))
  {
    target = INSTANCEURL.slice(0,-1)+":" + //INSTANCEURL minus slash
              API_PORT+API_BASE_URL+req.username+"/"+target;
  }
  target = target.trim(" ")

        request({
            method: 'GET',
            url: target+"-containerOf", // now it's own document to avoid collisions
            headers:
            {
              'Cookie':authCookie
            }
          },
          function (error, response, body) {
            if (error) throw new Error(error);

            try
            {
              body = JSON.parse(body);
            }
            catch(e)
            {
              console.log(`\n############## ERROR inside of updateContainerOf\n
                body of ${target}-containerOf not a json!!!`);
                console.log(body);
              addContainerOfDoc(req,target,thingInside);
              return callback(false)
            }

            //console.log(body);
            console.log("updateContainerOf: fetched document "+body._id+
                        ". will now add or delete "+thingInside+
                        " to/from doc -containerOf containerOf:");
            if(Array.isArray(body.containerOf))
            {
              if (body.containerOf.indexOf(thingInside) === -1)
              {
                console.log("updateContainerOf: item not yet in. adding: "+ thingInside);
                body.containerOf.push(thingInside);
              } else {
                console.log("already exists inside");
                if(delete_it)
                {
                  console.log("deleting "+thingInside+" from "+body._id);
                  let index = body.containerOf.indexOf(thingInside)

                  if (index !== -1)
                  {
                    body.containerOf.splice(index,1);
                    console.log("updateContainerOf: item exists already. DELETING:");
                    console.log(body.containerOf);
                  }
                  else {
                    console.log("updateInsideOfContainer: ");
                  }
                }
              }
            }
            else if (!delete_it){
              console.log("updateContainerOf: weird: containerOf field missing"+
              " inside of -containerOf doc");
              body.containerOf = [thingInside];
            }
            else {
              console.log("updateContainerOf: ERR: containerOf is NOT AN ARRAY!!!");
            }

            let thingDB = getTargetsFromUrl(target)[0];
            let db = NANO_ADMIN.db.use('userdb-'+toHex(thingDB));
            db.insert(body).then((res) =>{
              console.log("- updateContainerOf success");
              callback(true);
            })
            .catch((err)=>{
              console.log("\n############### ERROR inside updateContainerOf");
              console.log(err);
              callback(true);
            })

          });

}


/**
database level helper function.<br>
creates new -containerOf sister doc to target doc.<br><br>
only for compability:<br>
tries to add an empty and fresh -containerOf doc to already existing doc
needed in case of problems while add and (main reason:) in case a doc was
added to dingsda before -containerOf became it's own doc on creation of every doc
could also be solved instead by a one time recursion over all docs in all userdbs
but this way seemed less intrusive and hard to code

@TODO: check if we can utilize this inside of {@link addItems()} as well

@param {Object} req - request object from express app
@param {string} target - _id of doc whose -containerOf sister doc to be created
@param {string} [thingInside=[]] - array of ids of docs which should be added into
<target>-containerOf
*/
function addContainerOfDoc(req,target,thingInside=[]){

  if (thingInside){thingInside = [thingInside]}
  else {thingInside = []}

  console.log("vvvvvvvvvvvvvvvvvvvvvvvvv");
  console.log("adding ContainerOf Doc to " + target);

  let db = couch_getUserDB(req);
  let dbUser = db[1];

  target = target.split("/").slice(-1)[0]; // cut ID out of hyperlink
  console.log("addContainerOf: fetching owner of item:");
  dbUser.get(target).then((res2) =>{
    console.log(res2);
   dbUser.insert({
      _id: target+"-containerOf",
      containerOf: thingInside,
      owners:res2.owners
      }).then((body) => {
      console.log(body);
      console.log("success");
      console.log("^^^^^^^^^^^^^^^^^^^^^^^^^");
    }).catch((err) => {
      console.log("addContainerOf: ERROR inside INSERT");
      console.log(err);
      console.log("^^^^^^^^^^^^^^^^^^^^^^^^^");
    })
  })
  .catch((err) => {
    console.log("addContainerOf: ERROR INSIDE FETCH");
    console.log(err);
    console.log("^^^^^^^^^^^^^^^^^^^^^^^^^");
  })

}

/**
helper function.<br>
splits a request url into an array of "targets" defined by the url.<br>
this is helpful to later quickly find out which database and/or thing and/or attachment
is addressed by a request.<br>
the order of the returned Array defines which level the target addresses:<br>
<li>targets[0] is database level
<li>targets[1] is thing level
<li>targets[2] is attachment level (atm handled in thinglevel as well)

@param {string} target - url to be split into targets of request

@returns {Array} targets - Array of strings (names of targets in order of target)
*/
function getTargetsFromUrl(target){
  let urlAfterAPI = target.split(API_BASE_URL)[1].split("?")[0];
  let targets = urlAfterAPI.split("/");
  targets = targets.filter(String);
  return targets
}

/**
database level function.<br>
gets userDBs carnetATA view from couchDB which should return a csv formatted for
the international customs form Carnet A.T.A and sends response including the csv
string or an json prepared for client side conversion to pdf into responses payload.

@TODO: check if the clients are using only carnetATA, carnetATAjson or both and
in case of only one being used, get rid of the other in function as well as
couchDBs design/docs

@param {Object} req - request object from express app
@param {Object} res - response object from express app

@returns {string|Object} couchDB carnetATA or couchDB carnetATAjson view response or error
*/
function getCarnet(req,res)
{
  let db = couch_getUserDB(req);
  let nanoUser = db[0]; let dbUser = db[1];
  let params = {};
  let viewname = "carnetATAjson"

  if (req.body.data != undefined){

    if (req.body.data.ids != undefined)
    {
      params.keys = req.body.data.ids;
    }
    if (req.body.data.filetype == undefined)
    {req.body.data.filetype = "json"}

    if (req.body.data.filetype == "csv"){
          viewname = "carnetATA";

          dbUser.view("app",viewname,params,function(err,body){
            if (!err) {
              //console.log("CSV!!!!");
              //console.log(body);
              let output = "";
              body.rows.forEach(function(doc,ind) {
                output = output + doc.value+"\n";
              });
              return res.send(output)
            }
            else {
              return res.send(err)
            }
          })
    }
    else if (req.body.data.filetype == "pdf")
    {
      //viewname = "carnetATA";
      // first get array
      dbUser.view("app",viewname,params,function(err, body) {
        if (!err) {
          let output = [];
          body.rows.forEach(function(doc,ind) {
            output.push(doc.value);
          });
          //  then ADD HERE!!! build HTML with jspdf and include
          // json as databasis to render pdf from


          return res.send(output)
        }
        else {
          return res.send(err)
        }
      });
    }
    else {
      console.log("request for json output");
      dbUser.view("app",viewname,params,function(err, body) {
        if (!err) {
          let output = [];
          body.rows.forEach(function(doc,ind) {
            output.push(doc.value);
          });
          return res.send(output)
        }
        else {
          return res.send(err)
        }
      });
    }
  }
}

/**
helper function.<br>
creates a mango styled find request for couchDB (see {@link
https://github.com/cloudant/mango}) from input and ids2ignore<br>
<br>
will make Mango using regex caseinsensitive for all provided input fields that
are strings and search with mango "$in" operator for all provided input fields
that are Arrays<br><br>
for more complex searches please check {@link search}

@param {Object} input - object including all fields and values to be included in
search.
@param {Array} ids2ignore - array of strings of doc ids to be added as to be ignored
to the mango query

@returns {Object} query object in style of couchDBs mango js queries
*/
function makeMango(input,ids2ignore=["config_one","&config","&notifications","&inMyPossession"])
{
      //console.log(input);
      // do a thing, possibly async, then…
      let query = {selector:{}}

      for (item in input)
      {
        if (!Array.isArray(input[item]))
        {
          //console.log(item);
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
        // add ids to ignore in search:
        if (ids2ignore.length > 0 && Array.isArray(ids2ignore)){
          query.selector["$and"] = [{"_id": {"$nor": ids2ignore}}]
        }
        // also exclude every item containing -containerOf in id
        query.selector["$and"].push( {"_id": {"$not":{"$regex": "(?i)"+"-containerOf"}}} );
      }
      //console.log(query);
      return query
}



/////////////////////////////////////
///// INSTANCE LEVEL HELPER ////////


/**
instance level function<br>
not yet implemented. <br>
should become function to make more complex (completely client made?) search queries
to database. either using map-reduce (meh) or mango queries<br>
<br>
for an already working and easier way to find items take a look at {@link findItems}
*/
function search(req,res)
{
  console.log("inside search");
  console.log(req.body.data);
  //console.log(req.body.data.doc);
  console.log( JSON.stringify(req.body.data.doc, null, 4));
  //res.send("search API is not working yet.")

  if (!req.body.data.db){res.statusCode=400;return res.send("provide .db in payload!")}

  let db = couch_getUserDBFromUsername(req);
  let nanoUser = db[0];
  let dbUser = nanoUser.db.use("userdb-"+toHex(req.body.data.db));
  if (req.body.data.db === "public"){ dbUser = nanoUser.db.use("public") }

  let q = {selector: req.body.data.doc};
  q.limit = 50;
  q.fields = ["_id","name","location","other","owners","hyperlink","inPossessionOf","_rev","_attachments"];
  q.execution_stats = true; // maybe relevant later for easy pagination
  if (req.body.data.bookmark)
  {
    q.bookmark = req.body.data.bookmark
  }
  dbUser.find(q).then((doc) => {
      //console.log(doc);
      delete(doc.warning); // whats that?
      return res.send(doc)
    }).catch(function(err){
      res.statusCode = 400;
      return res.send(err)
    });

}



/*///////////////////////////////////////
  PRE-API Auth and Validation
  (checking READ permissions and managing Auth before forwarding requests to
   API functions)
///////////////////////////////////////*/

/**
express middleware function.<br>
<br>
validates read permissions of a request.<br>
checks first how deep the request goes (meaning: if it is targeting the instance,
userDatabase or a specific document/thing/item inside of the database) by checking
the targets in request url.<br>
for requests to thinglevel or deeper it checks by going through the following steps:
<br>
<li>1.) is req.username trying to read her own DB? --> READ GRANTED
<li>2.) is req.username in thing.owners? --> READ GRANTED
<li>3.) is thing.visibility === "public"? --> READ GRANTED

<li>4.) is req.username in thing.inPossessionOf (because owner borrowed it
out)? --> READ GRANTED

<li>5.) is thing.visibility !== "private" && userdb-<targetuser>._security.
<thing.other.visibility> does contain req.username? --> READ GRANTED

<li>6.) (HARDEST maybe future science) (TO BE DONE):
is thing.visibility === "friends2nd" && req.username is in friends
of anybody who has <targetuser> in their userdb-<user>._security.friends
list? --> READ GRANTED
(unclear how to approach. So better first 1.-4. and this later)

<li>7.) ELSE: --> NO READ GRANTED --> no such object.

@TODO: implement step 6)
@TODO: doublecheck all steps and check if all besides TODOs are actually performed

@param {Object} req - request object from express app
@param {Object} res - response object from express app
@param {function} next - callback for express middleware functions

*/
function validateReadRights(req, res, next){
    /*
      if request url and body (or request url and parambody "json") contains any
      READ outside of users own private DB: check if permissions are ok for READ
      at least before responding at all:
    */
    let urlAfterAPI = "";
    console.log()
    if (req.url.split(API_BASE_URL).length > 1)
    {
      if (req.url.includes("?"))
      {
        urlAfterAPI = req.url.split(API_BASE_URL)[1].split("?")[0];
      }
      else
      {
        urlAfterAPI = req.url.split(API_BASE_URL)[1];
      }
    }
    
    

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

          4.) is req.username in thing.inPossessionOf (because owner borrowed it
          out)? --> READ GRANTED

          5.) is thing.visibility !== "private" && userdb-<targetuser>._security.
          <thing.other.visibility> does contain req.username? --> READ GRANTED

          6.) (HARDEST maybe future science) (TO BE DONE):
          is thing.visibility === "friends2nd" && req.username is in friends
          of anybody who has <targetuser> in their userdb-<user>._security.friends
          list? --> READ GRANTED
          (unclear how to approach. So better first 1.-4. and this later)

          7.) ELSE: --> NO READ GRANTED --> no such object.
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
        // if user is admin and authenticated as admin: READ permission!
        else if (req.username === "admin" && req.authenticated)
        {
          console.log("ADMIN tries to read database. therefore OKAY");
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
          let db = NANO_ADMIN.db.use('userdb-'+toHex(targets[0]));
          console.log('userdb-'+toHex(targets[0]));
          if(targets[1] !== undefined) // REDUNDANT ????!!!!
          {
            db.get(targets[1],function(err,ding){
                console.log(ding);
                console.log(err);
                if(ding === undefined)
                {
                  console.log("ding unknown");
                  res.statusCode = 404;
                  res.send('error: no such ding');
                  return
                }
          // 2.) is req.username in thing.owners?
                //console.log(ding.owners.indexOf(req.username));
                if (ding.owners && ding.owners.indexOf(req.username) > -1)
                {
                  console.log("is not owner of DB BUT owner of thing");
                  next();
                  return
                }
          // 3.) is thing.visibility === "public"?
                if (ding.other !== undefined && ding.other.visibility !== undefined
                   && ding.other.visibility.includes("public"))
                {
                  console.log("thing is public therefore can be READ");
                  next();
                  return
                }
          // 4) is req.username in thing.inPossessionOf?
                if( ding.inPossessionOf !== undefined &&
                    ding.inPossessionOf.includes(req.username) )
                {
                  console.log(`${req.username} in ding.inPossessionOf therefore READ!`);
                  next();
                  return
                }
          // 5a) is thing private?
                if ( ding.other && ding.other.visibility && (
                    ding.other.visibility.includes("private") ||
                    ding.other.visibility.includes("not") ||
                      ding.other.visibility === undefined  ) ){
                  console.log("IT's PRIVATE, ASSHOLE!");
                  res.statusCode = 404;
                  res.send('error: no such ding');
                }
                else {
          // 5b) is userdb-<targetuser>._security in any of the groups listed?
                  db.get("_security",function (err, DBres) {
                    if (err) {
                      console.log(err)
                      res.statusCode = 501;
                      res.send();
                      // SEND ERROR RESPONSE HERE without any infos!!!
                    } else if (DBres.friends !== undefined &&
                              req.username in DBres.friends)
                    {
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
            5c) <thing.other.visibility> does contain a group that
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
                          return res.send('error: no such ding');
                        }

                      }
                      else {
                        console.log("not in groups");
                        res.statusCode = 404;
                        return res.send('error: no such ding');
                      }
                    }
                    else {
                      console.log("you AINT FRIENDS, DAH");
                      res.statusCode = 404;
                      return res.send('error: no such ding');
                    }
                  })
                }
            })
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


/**
helper function<br>
returns true if any of the items in itemArray are found in array

@param {Array} itemArray - array of objects of which every item should be checked
@param {Array} array - array to be checked for matches with itemArray

@returns {boolean} at least one match found
*/
function arrayItemfoundInArray(itemArray, array){
  for (let j in itemArray)
  {
    //console.log(itemArray[j]);
    //console.log(array);
    for (let i in array)
    {
      if (array.indexOf(itemArray[j]) > -1){

        return true
      }
    }
  }
  return false
}

/**
express middleware function.<br>
<br>
decides how to verify user Auth<br>
<br>
calls {@link verifyAuthToken}, {@link verifyByJsonPW} or {@link verifyByUrlPW}
depending on request cookies, payload and/or HTTP method.

sends error response in case none of possible verification methods are provided
with request.

@param {Object} req - request object from express app
@param {Object} res - response object from express app
@param {function} next - callback for express middleware functions
*/
function verifyUserCredibility(req, res, next){

      console.log("\nINSIDE verifyUserCredibility \n",req.url);

      //console.log(req.body);
      if (req.cookies.AuthSession !== undefined && req.cookies.AuthSession!=="")
      {
        //console.log("Cookie or Session Token provided.\nlets try to verify this session");
        verifyAuthToken(req,res,next); // will reject req if not valid
        //console.log(req);
        console.log("cookie req!","forwarding to verifyAuthToken!",req.url);
      }
      else if (req.body.username !== undefined && req.body.password !== undefined)
      {
        console.log("No cookie but pw and username!\nlets try to login as "+ req.body.username);
        verifyByJsonPW(req,res,next);
      }
      else if (req.method == "GET")
      {
        //console.log("its a GETTER");
        verifyByUrlPW(req,res,next);
      }
      else
      {
        console.log(req.url, "verifyUserCred leads to check if /subscribe")
          // REGISTER PUSH OR DENY ACCESS
          if (req.url.includes("/subscribe"))
          {
            console.log("\n!!! /SUBSCRIBE !!!!\n")
            return pushRegister(req,res)
          }
        //console.log("neither password nor AuthSessionToken / cookie provided. ");
        // only 2ndary security. this should NEVER be the only verification:
        req.authenticated = false;
        res.statusCode = 401;
        res.send('error: no valid auth');
      }

}

/**
express middleware helper function.<br>
<br>
verifies user Auth by testing for username and password inside of request payload.<br>
<br>
calls {@link getSessionAndAuthToken}

@param {Object} req - request object from express app
@param {Object} res - response object from express app
@param {function} next - callback for express middleware functions
*/
function verifyByJsonPW(req,res,next)
{
  getSessionAndAuthToken(req,res,next,req.body.username,req.body.password)
}

/**
express middleware helper function.<br>
<br>
verifies user Auth by testing for username and password inside of request query parameter.<br>
<br>
username and password can be query parameters or in json format inside of a query parameter
calles json. e.g.: https://xxx.xxx/yyy?username=aaa&password=bbb or
https://xxx.xxx/yyy?json='{"username":"aaa","password":"bbb"}'
<br>
calls {@link getSessionAndAuthToken}

@param {Object} req - request object from express app
@param {Object} res - response object from express app
@param {function} next - callback for express middleware functions
*/
function verifyByUrlPW(req,res,next)
{
  //console.log(req.query);
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

/**
express middleware helper function.<br>
<br>
requests _session from couchDB using username and password and adds AuthSession
cookie from couchDB response to the response object so user will be able to
authenticate with cookie next time.

@param {Object} req - request object from express app
@param {Object} res - response object from express app
@param {function} next - callback for express middleware functions
@param {string} username - username
@param {string} password - password
*/
function getSessionAndAuthToken(req,res,next, username, password)
{
  request({
        method: "POST",
        url: DATABASEURL + "_session",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: "name=" + username + "&password=" + password
      }, function(err,resDB){

        if (!err)
        {
          console.log("getSessionAndAuthToken:");
          //console.log(resDB);
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
          console.log("##### ERROR. getSessionAndAuthToken() ##### ");
          console.log(err);
          req.authenticated = false;
          res.statusCode = 501;
          res.send('error: internal server error uiuiui');
        }

      });
}

/**
express middleware function.<br>
<br>
verifies user Auth by using Cookie AuthSession provided in request.<br>
<br>
calls {@link getSessionAndAuthToken}

@param {Object} req - request object from express app
@param {Object} res - response object from express app
@param {function} next - callback for express middleware functions
*/
function verifyAuthToken(req,res,next){
  //console.log(req.cookies);

  return request({
        method: "GET", // GET SESSION from CouchDB if valid Auth
        url: DATABASEURL + "_session",
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
            console.log("valid AuthSessionToken!",req.url);
            // only 2ndary security. this should NEVER be the only verification:
            req.authenticated = true;
            req.DBAuthToken = ["AuthSession="+req.cookies.AuthSession+
              "; Version=1; Path=/; HttpOnly"];
            req.username = body.userCtx.name;
            
            // REGISTER PUSH OR DENY ACCESS    // FIXME : TODO : this is also to be found in verifyUserCred (if no Auth Token). Should be one place only
            if (req.url.includes("/subscribe"))
            {
              console.log("\n!!! /SUBSCRIBE !!!!\n")
              return pushRegister(req,res)
            }

            next();
            return
        }
        else
        {
          console.log("sth went wrong while trying to verifyAuthToken");
          res.statusCode = 401;
          // only 2ndary security. this should NEVER be the only verification:
          req.authenticated = false;
          // delete cookie in case there was one:
          res.set("Set-Cookie","AuthSession=; Version=1; Path=/; HttpOnly");
          res.send('error: no valid valid authtoken');
        }
      })
}

/*////////////////////////
vvvvvvvvvvvvvvvvvvvvvvvvvv
CouchDB HELPER
vvvvvvvvvvvvvvvvvvvvvvvvvv
/////////////////////////*/

/**
helper to extract Auth cookie from request and return couchDB nano instance and
a nano db instance of the same user<br>
<br>
couchdb-nano: https://github.com/apache/couchdb-nano

@param {Object} req - request object from express app

@returns {Array} array [nanoUser, dbUser] containing nano User and UserDB instances
*/
function couch_getUserDB(req)
{
  let nanoUser = require('nano')({
    url:DATABASEURL,
    cookie:req.DBAuthToken
  })
  let dbUser;
  // filter out for "public or other shared DBs and change targetDB accordingly:"
  if (req.targets[0].includes("-friends1st")){}
  else if (req.targets[0].includes("-friends2nd")){}
  else if (req.targets[0] == "public"){
    dbUser = nanoUser.db.use("public");
  }
  else {
    dbUser = nanoUser.db.use("userdb-"+toHex(req.targets[0]))
  }

  return [nanoUser,dbUser]
}

function couch_getUserDBFromUsername(req)
{
  let nanoUser = require('nano')({
    url:DATABASEURL,
    cookie:req.DBAuthToken
  })
  let dbUser;

  dbUser = nanoUser.db.use("userdb-"+toHex(req.username))

  return [nanoUser,dbUser]
}

/*////////////////////////
^^^^^^^^^^^^^^^^^^^^^^^^^^
CouchDB HELPER
^^^^^^^^^^^^^^^^^^^^^^^^^^
/////////////////////////*/

/*/////////////////////////
vvvvvvvvvvvvvvvvvvvvvvvvvv
GENERAL HELPER FUNCTIONS
vvvvvvvvvvvvvvvvvvvvvvvvvv
//////////////////////////*/

/**
helper function<br>
<br>
turns string to Hex value

@param {string} s - string to be transformed
*/
function toHex(s) {
    // utf8 to latin1
    var s = unescape(encodeURIComponent(s))
    var h = ''
    for (let i = 0; i < s.length; i++) {
        h += s.charCodeAt(i).toString(16)
    }
    return h
}

/**
helper function<br>
<br>
turns Hex value to string

@param {string} h - hex value to be turned to string
*/
function fromHex(h) {
    var s = ''
    for (let i = 0; i < h.length; i+=2) {
        s += String.fromCharCode(parseInt(h.substr(i, 2), 16))
    }
    return decodeURIComponent(escape(s))
}

/**
helper function<br>
<br>
compares two arrays and returns if identical
@param {Array} array1 - array to be tested
@param {Array} array2 - array to be tested
@returns {boolean} arrays are identical
*/
function compareArrays(array1,array2)
{
  if ( Array.isArray(array1) )
  {
    return array1.length === array2.length && array1.sort()
    .every(function(val,ind){return val === array2.sort()[ind]});
  }
  else {
    return false
  }

}

/**
helper function
@param {Array} array - array to add item to
@param {Array} item - item to be added to array
@returns {Array} array after operation
*/
function addToArrayIfNotExist(array,item){
  array.indexOf(item) === -1 ? array.push(item) : console.log("item already exists");
  return array;
}

/**
helper function
@param {string} num - float as string to be trimmed
@param {number} decimals - number of decimals to cut num to.
@returns {string} trimmed float as string
*/
function trimFloatStringToNDecimalPlaces(num,decimals=3){
  return num.slice(0, (num.indexOf("."))+(decimals+1));
}

/**
helper function
@param {string} input - string to trim slashes from
@returns {string} trimmed string
*/
function trimTrailingSlashes(input)
{
    return input.replace(/\/$/, "");
}


function isNumber(n) {
  return (!isNaN( parseFloat(n) )  && isFinite(n) );
}


/*////////////////////////
^^^^^^^^^^^^^^^^^^^^^^^^^^
GENERAL HELPER FUNCTIONS
^^^^^^^^^^^^^^^^^^^^^^^^^^
/////////////////////////*/






/*////////////////////////
vvvvvvvvvvvvvvvvvvvvvvvvvv
PUSH NOTIFICATIONS / WEB PUSH
vvvvvvvvvvvvvvvvvvvvvvvvvv
/////////////////////////*/


/**
 * the subscribe endpoint manages the first interaction/subscription of a user
 * it gets the subscription parameters from the push service of the users browser
 * and it takes the username send as url parameter to associate both and save them
 * to the Database (TODO)
 */
function pushRegister(req,res){
  const subscription = req.body;
  console.log("inside pushRegister",JSON.stringify(req.body));
  res.status(201).json({result:"trying to register push"});

  //console.log(subscription);
  //console.log(Object.keys(req));
  //console.log(req.query);
  if (req.query.user){
    console.log(req.query.user); // username to register push with
    console.log(subscription) // subscription object containing endpoint and keys
    savePushSubscription(req.query.user,subscription) // write user creds into DB
  }
  else
  {
    console.log("req has no user")
  }

}

/** 
 * push endpoint for remote send of push.
 * TODO: only ADMIN should be able to use this!!!
 * this endpoint does the same as the webpush standalone module would do. it is not strictly needed,
 * but we might be happy about it later if we want to trigger push notifications from http and not
 * cli only
*/
function pushSend(req,res){

  let pushmsg = req.body;
  res.status(201).json({});
  let msg = JSON.stringify(
    {
      title: pushmsg.title,
      body: pushmsg.msgbody
    }
  );

  console.log(pushmsg);

  webpush.sendNotification(pushmsg, msg).catch(error => {
      console.error(error.stack);
  });

}


function sendPushWithCreds(creds,msg){
  webpush.sendNotification(creds, JSON.stringify({title:"news from dingsda!",body:msg})).catch(error => {
    console.error(error.stack);
});
}

/**
 * sends a push message to a single user defined by their username in DB "webpush"
 * fetches Data from DB and uses data to address 
 */
function sendPushToUser(username,msg){

// NATIVE PUSH ONLY:

let adminDBNative = NANO_ADMIN.use('nativepush');

let nativepushPromise = adminDBNative.get(username)
  .then((res)=>{
    console.log(res);
    // APPLE PUSH NOTIFICATIONS (APN)
    if (res.apn){ 
      subscriptionDataAPN = res.apn; // get subscription data from userDoc for iOS apple push notification (APN)
      console.log(`
      sending APN: ${msg} to ${username} using: ${JSON.stringify(subscriptionDataAPN)}     
      `);
      
      // sending APN to device 
      let deviceToken = res.apn.token//"a7615952c399844e731e871b880ebc6b68edce4d1c9788beced9567a62d39e73";  // Philips iPhone dingsdaUI
      // get this token from DB res
      var note = new apn.Notification();

      note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
      note.badge = 1; // TODO: get number of notifications and set them here
      note.sound = "ping.aiff";
      note.alert = ""+msg;
      note.payload = {'messageFrom': '💚 dingsdaUI 🔨'}; // TODO: check what payloads make sense
      note.topic = "de.philipsteimel.dingsdaui"; // TODO: get from server_config.json

      apnProvider.send(note, deviceToken).then( (result) => {
          // see documentation for an explanation of result
          console.log(JSON.stringify(result));
        });


    }

    // FIREBASE CLOUS MESSAGES (FCM)
    if (res.fcm){
      subscriptionDataFCM = res.fcm; // get subscription data from userDoc for iOS apple push notification (APN)
      console.log(`
      sending FCM: ${msg} to ${username} using: ${JSON.stringify(subscriptionDataFCM)}     
      `);
      // actually sending the notification

      // Prepare a message to be sent
      let message = new gcm.Message({
        data: { 
            message: ''+msg, // TODO: get this from params
            title: '💚 dingsda request 🔨',
            count: 1, // TODO: get number of notifications and set them here
        }
      });

      // Specify which registration IDs to deliver the message to
      // TODO: get this from DB
      let regTokens = res.fcm.token;

      // Actually send the message
      FCMsender.send(message, { registrationTokens: regTokens }, function (err, response) {
      if (err) console.error(err);
      else console.log(response);
      });
    }
   
  })
  .catch((err)=>{
  
    if (err.reason && err.reason === "missing")
    {
      console.log("error. no such user subscribed with NATIVE PUSH NOTIFICATIONS (GOOGLES FCMs OR APPLES APNs");
    }
    else{
      console.log("error fetching user subscription from DB Native Push:");
      console.log(err);
    }
  })


// WEBPUSH ONLY

  let adminDB = NANO_ADMIN.use('webpush')
  
  return adminDB.get(username)
  .then((res)=>{
    console.log(res);
    subscriptionData = res.webpush; // get subscription data from userDoc
    console.log(`
    sending: ${msg} to ${username} using: ${JSON.stringify(subscriptionData)}     
    `);
    sendPushWithCreds(subscriptionData,msg)
  })
  .catch((err)=>{
  
    if (err.reason && err.reason === "missing")
    {
      console.log("error. no such user subscribed");
    }
    else{
      console.log("error fetching user subscription from DB:");
      console.log(err);
    } 
  })

}


function savePushSubscription(username, subscription){

  console.log("+++ PUSH SUBSCRIPTION +++")

  let adminDB;
  let target = "";

  if (subscription.apn ) // IF pushtype is APN
  {
    console.log("push type: APN");
    adminDB = NANO_ADMIN.use('nativepush');
    target = 'apn';
    subscription = subscription.apn;
  }
  else if (subscription.fcm) // IF pushtype is FCM:
  {
    console.log("push type: FCM");
    adminDB = NANO_ADMIN.use('nativepush');
    target = 'fcm';
    subscription = subscription.fcm;
  }
  else // IF pushtype is WEBPUSH:
  {
    console.log("push type: WEBPUSH");
    adminDB = NANO_ADMIN.use('webpush');
    target = 'webpush';
  }
    return adminDB.get(username)
    .then((res)=>{
      console.log(res);
      res[target] = subscription; // add subscription to config // TODO: add device token to list of tokens instead of overwriting
      return adminDB.insert(res); // insert config again
    })
    .catch((err)=>{
    
      if (err.reason && err.reason === "missing" || err.reason === "deleted" )
      {
        console.log("no doc yet. will add, then redo...");
        let doc = subscription; // FIXME: this should be empty object, shouldnt it?
        doc._id = username;
        adminDB.insert(doc).then(()=>{        
          savePushSubscription(username,subscription);
        })

      }
      else{
        console.log("error saving push subscription:");
        console.log(err);
      }
    })
  
}

/*////////////////////////
^^^^^^^^^^^^^^^^^^^^^^^^^^
PUSH NOTIFICATIONS / WEB PUSH
^^^^^^^^^^^^^^^^^^^^^^^^^^
/////////////////////////*/

