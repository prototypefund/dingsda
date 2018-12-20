
/*   Bug: !!!!!: atm only check for read rights is done if thingrequest.
    for find() we have to do that on DBLevel as well as on instanceLevel!!!!!

    ALSO: have to exclude all private things on find() unless in own DB !!!!!

    ALSO: issue with instance Level if / is missing at end of url. (try it!)

    - to do: api/access to design/view Carnet
    - to do: validate id on add (number of letters AND correct username)
*/
const config = require("./server_config.json");

const DBadminPW = config.DBadminPW;

const https = require("https");
const fs = require("fs");
const express = require('express')
const request = require('request');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const uuidv5 = require('uuid/v5'); // npm install uuid
const cors = require('cors')

const httpProxy = require('http-proxy');
let proxy = httpProxy.createProxyServer({
  auth:'admin:'+DBadminPW, // it works also without for userDB but not for public
  ignorePath:true
});

const whitelist = config.CORS_whitelist.concat(undefined);

const instanceUrl = config.instanceURL;
const databaseUrl = config.databaseURL;
const API_PORT = config.API_PORT;
const API_BASE_URL = config.API_BASE_URL;
const requestUrl = trimTrailingSlashes(instanceUrl)+":"+API_PORT+API_BASE_URL;
const MaxAge = 360000; // MaxAge for all Cookies from CouchDB (tbd: get this from Couch config instead)

// SSL Stuff
const options = {
  key: fs.readFileSync(config.SSLkey),
  cert: fs.readFileSync(config.SSLcert)
};



/*
 all nano operations are done by either nanoAdmin if requestLevel is instance or
several DBs or by a short term conncetion nanoUser if requestLevel is thing.
we will use another nano Object. This is not needed but human error, ya know...
*/
const nanoAdmin = require('nano')('http://admin:'+DBadminPW+'@'+databaseUrl.split("://")[1]);
//let db = nano.db.use('userdb-6a616e') // user: jan

//const uuid = uuidv5(databaseUrl+'machinaex'+'/'+Date.now(), uuidv5.URL);
//console.log(uuid);

const app = express()

//app.use(cors());
//  gotta find out how to make webapps work here later without breaking security
// credentials:true needed to allow AuthCookies
///*
app.use(cors({origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Origin '+origin+' not allowed by CORS'))
    }
  },credentials: true}))
//*/
app.use(bodyParser({limit: '1mb'})) // trying here

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


https.createServer(options, app)
.listen(API_PORT,()=>console.log('DINGSDA API listening on port '+ API_PORT));
//app.listen(API_PORT,()=>console.log('DINGSDA API listening on port '+ API_PORT))



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
          case "handover_announce":
              handover_announce(req,res);
              break;
          case "deleteItems":
              console.log("******DELETE ATTEMPT!!!!!!!");
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
    res.statusCode = 400;
    return res.send('"UNSUPPORTED HTTP VERB\nor empty request body"')
  }


}

function DBCommander(req,res)
{
  if (req.method == "GET") // only FETCH and Auth
  {
    console.log(`DBCommander getting infos about ${req.username}`);
    nanoAdmin.db.get("userdb-"+toHex(req.username)).then((body) => {
      res.send(body);
    })
    /*res.statusCode = 400;
    return res.send('"cannot (yet?) GET on DB level"')*/
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
  //console.log(req.body);

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
          case "search":
              search(req,res);
              break;
          default:
              res.statusCode = 400;
              return res.send('"unkown command\n(missing or unknown data.type) instance"')
      }
    }
  }
  else if (req.method == "DELETE"){
    res.set("Set-Cookie","AuthSession=; Version=1; Path=/; HttpOnly");
    return res.send("bye");
  }

}



/// CouchDB HELPER ////

function couch_getUserDB(req)
{
  let nanoUser = require('nano')({
    url:databaseUrl,
    cookie:req.DBAuthToken
  })
  let dbUser;
  //filter out for "public or other shared DBs and change targetDB accordingly:"
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


function fetch(req,res)
{
   //let db = couch_getUserDB(req);
   //let nanoUser = db[0]; let dbUser = db[1];
   // testing with Admin Rights here, for should be already authenticated at this point:
   let nanoUser = nanoAdmin; let dbUser = nanoUser.db.use("userdb-"+toHex(req.targets[0]));

   dbUser.get(req.targets[1]).then(function(result){

       if (req.targets[2] != undefined){ // if request is for attachment
           // get attachment instead of item:
           console.log("ATTACHMENT REQUESTED:");
           if(result._attachments !== undefined){
             console.log(req.targets[2]);
             /*dbUser.attachment.get(req.targets[1], req.targets[2]).then((output) => {
               res.setHeader('Content-Type','image/jpeg');
               return res.send(output);
             })*/

             // TO DO!!!: try to not get attachment into here but just throw it out as res
             /*dbUser.get(req.targets[1],{attachments:true}).then((body) => {

               //console.log(body);
               if(body !== undefined && body._attachments !== undefined
                  && body._attachments[req.targets[2]] !== undefined)
                  {
                    let output = body._attachments[req.targets[2]].data;
                    //res.setHeader('Content-Type','image/jpeg');
                    return res.send(output);
                  }
                  else {
                    res.statusCode = 404;
                    return res.send("item but no attachment, asshole")
                  }
              */
              // this is a workaround because proxy does not overwrite req's auth:
              delete req.headers['cookie'];
              // make cacheable for 24h:
              res.set('Cache-Control', 'private, max-age=86400');
              console.log('proxying to DB directly');
              return proxy.web(req, res,{
                target: databaseUrl+"userdb-"+toHex(req.targets[0])+
                "/"+req.targets[1]+"/"+req.targets[2],
                auth:'admin:'+DBadminPW
              });

             }
             else {
               res.statusCode = 404;
               return res.send("no attachment, asshole")
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



///////////////////////
/// THING HELPER //////

function handover_announce(req,res)
{

  if (req.body.data.username === undefined)
  {
    res.statusCode = 400;
    return res.send('"error: no username provided"')
  }

  let dbOwner = nanoAdmin.db.use('userdb-'+toHex(req.targets[0]));
  let dbLender = nanoAdmin.db.use('userdb-'+toHex(req.username));
  let dbBorrower = nanoAdmin.db.use('userdb-'+toHex(req.body.data.username));

  dbOwner.get(req.targets[1]).then((doc) => {
    // if handover is requested for a thing owned by the user themselves OR
    //  by somebody currently in Possession of the thing with goal of returning it to its owners:
    if (req.targets[0] === req.username || doc.owners.includes(req.username) ||
        (doc.inPossessionOf && doc.inPossessionOf.includes(req.username) &&
        doc.owners.includes(req.body.data.username))
       )
    {
// LATER HERE: CHECK IF FRIENDS OR IF borrower/&notifications.requested includes id of item
// LATER HERE: CHECK IF OPEN OTHER handover annoncments in my and others Notifications and if delete those before continueing
      console.log("legal handover announcement by owner");

      // if Lender has no pending handovers for this item, add this item to pending:
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

    }
    else {
      res.statusCode = 400;
      return res.send('"error: you dont have this thing"')
    }
  })
  .catch((err)=>{
    console.log(err);
    res.statusCode = err.statusCode;
    return res.send(""+err.reason)
  });
}

function handover_cancel(req,res)
{
  console.log("HANDOVER CANCEL");
  console.log(req.body.data);
  if (req.body.data.to === undefined || req.body.data.ref === undefined)
  {
    res.statusCode = 400;
    return res.send('"error: no username or from provided"')
  }

  let db = nanoAdmin.db.use('userdb-'+toHex(req.targets[0]));
  let dbBorrower = nanoAdmin.db.use('userdb-'+toHex(req.body.data.to));

// HERE LATER: CHECK IF ALLOWED TO CANCEL FIRST!!!

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
  .catch(function(err){
    res.statusCode = 500;
    return res.send(err)
  })

}

function handover_deny(req,res)
{
  console.log("HANDOVER DENY");
  console.log(req.body.data);
  if (req.body.data.from === undefined || req.body.data.ref === undefined)
  {
    res.statusCode = 400;
    return res.send('"error: no username or from provided"')
  }

  let dbBorrower = nanoAdmin.db.use('userdb-'+toHex(req.targets[0]));
  let db = nanoAdmin.db.use('userdb-'+toHex(req.body.data.from));

// HERE LATER: CHECK IF ALLOWED TO CANCEL FIRST!!!

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
  .catch(function(err){
    res.statusCode = 500;
    return res.send(err)
  })

}


// handover confirm (happens only after owner made handover announcement):
function handover(req,res)  // not correct anymore!!!
{
  console.log("HANDOVER ATTEMPT");
  console.log("handover to "+req.username);

  if (req.body.data.from === undefined || req.body.data.ref === undefined)
  {
    res.statusCode = 400;
    return res.send('"error: no username or from provided"')
  }

  // to do: change db connections depending on return or normal handovers
  // for that: LOG body.data.from and check what it would be incoming from UI
  console.log("handover request data:");
  console.log(req.body.data);

  let db = nanoAdmin.db.use('userdb-'+toHex(req.targets[0]));
  let dbLender = nanoAdmin.db.use('userdb-'+toHex(req.body.data.from));

  // check if alleged lender has notification of pending handover in DB:
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

              // next: do the actual handover!!!!
              let dbThingOwner = dbLender;
              if (isReturn){
                console.log("IS RETURN. will therefore fetch doc from owners DB");
                dbThingOwner = db;
              }
              return dbThingOwner.get(req.body.data.ref).then((item)=>{
                console.log("handover item fetched from db:");
                console.log(item);
                // to do: check if Lender is allowed to do that operation again (for the kicks)
                let oldPossessor = item.inPossessionOf;
                let dbOldPossessor = nanoAdmin.db.use('userdb-'+toHex(oldPossessor));
                delete notifications.pending.handover_await[req.body.data.ref];
                item.inPossessionOf = req.username;
                // this should be API not DB directly:
                // get AuthCookie as admin:

                request({
                    method: 'GET',
                    url: requestUrl,
                    //url: "https://dingsda.org:3000"+API_BASE_URL,
                    json: {
                        "username":"admin",
                        "password":DBadminPW
                      }
                  },function(err,r,body){
                    if(!err)
                    {
                    console.log(r.headers["set-cookie"][0]);

                    let targetDBname = req.body.data.from;
                    if (isReturn)
                    {
                      targetDBname = req.targets[0];
                      console.log("targetDB is "+ targetDBname);
                    }

                    request({
                        method: 'POST',
                        url: requestUrl+targetDBname+"/"+req.body.data.ref,
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
                          console.log(body);
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
  .catch((err)=>{
    console.log(err);
    res.statusCode = err.statusCode;
    return res.send(""+err.reason)
  });

}


function addToInMyPossession(db,itemHyperlink)
{
  console.log("adding to inMyPossession");
  return db.get("&inMyPossession").then((inMyPossession) => {
    inMyPossession.things = addToArrayIfNotExist(inMyPossession.things,itemHyperlink);
    return db.insert(inMyPossession)
  })
}

function deleteFromInMyPossession(db,itemHyperlink)
{
  console.log("DELETING ITEM "+itemHyperlink+" FROM POSSESION OF OLD POSS ");
  return db.get("&inMyPossession").then((inMyPossession) => {
    if (inMyPossession.things.includes(itemHyperlink))
    {
      console.log("index "+inMyPossession.things.indexOf(itemHyperlink));
        inMyPossession.things.splice([inMyPossession.things.indexOf(itemHyperlink)],1);
    }
    return db.insert(inMyPossession)
  })
}

function move(req,res)
{
// validateMoveBody
if (req.body.data.location == undefined)
{
  //console.log(req.body);
  res.statusCode = 400;
  return res.send('"error: no location provided"'+req.body.data.location)
}
// validateMoveRights (couch via doc_validate_update?)
  // TBD!!!
  let db = nanoAdmin.db.use('userdb-'+toHex(req.targets[0]));

  db.get(req.targets[1]).then((doc) => {
    if (doc.inPossessionOf && doc.inPossessionOf.includes(req.username))
    {
      console.log("moving via inPossessionOf!!!");

      console.log(doc);
      //res.send(doc._rev)
      let newdoc = doc;
      newdoc.location = req.body.data.location;
      return db.insert(newdoc).then((DBres) => {
          if (DBres.ok)
          {
            updatePublicDBIfPublic(req,newdoc);
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


//  Works. NICE TO HAVE: delete fields if they contain _delete or null ?
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
      console.log("got old Doc back from DB before update:");
      //console.log(oldDoc);

      // CONTAINER / INSIDEOF UPDATES:
      // if item is inside of other item: update the other items conainerOf:

      if (oldDoc.location !== undefined &&
          oldDoc.location.insideOf !== undefined &&
          oldDoc.location.insideOf != req.body.data.doc.location.insideOf)
      {
        console.log("insideOf changed");
        let targetDel = oldDoc.location.insideOf;
        let targetUpd = req.body.data.doc.location.insideOf;
        if (!targetDel.startsWith("https"))
        {
          targetDel = instanceUrl.slice(0,-1)+":" + //instanceUrl minus slash
                    API_PORT+API_BASE_URL+req.username+"/"+targetDel;
        }
        // delete target from req Target (a.k.a. the item we are updating)
        console.log("deleting items id from "+targetDel._id);

        updateContainerOf(req,targetDel,req.targets[1].hyperlink,req.DBAuthToken,true,function(){ //// .hyperlink does not make any sense, does it????

          console.log("CONTAINER SHOULD BE UPDATED NOW");
              // update new container item
              if (targetUpd !== undefined && targetUpd !== ""){
                if (!targetUpd.startsWith("https"))
                {
                  targetUpd = instanceUrl.slice(0,-1)+":" + //instanceUrl minus slash
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
              target = instanceUrl.slice(0,-1)+":" + //instanceUrl minus slash
                        API_PORT+API_BASE_URL+req.username+"/"+target;
            }
            // update new container item
            updateContainerOf(req,target,req.targets[1],req.DBAuthToken);
      }
      else {
        console.log("insideOf does not exist nor did it change");
        console.log(req.body.data.doc.location);
      }

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
          }
          else if (req.body.data.doc.other.visibility.includes("friends2nd"))
          {
             // update item in friends
             // update item in friends2nd
          }
      }


      /// ACTUAL UPDATE /////////////////
      // merge oldDoc with new Doc, giving newDoc higher importance:

      let newOther = {}
      if (oldDoc.other || req.body.data.doc.other)
      {
       newOther = Object.assign(oldDoc.other,req.body.data.doc.other);
      }
      let newObj = Object.assign(oldDoc,req.body.data.doc);
      newObj.other = newOther;
      // add hyperlink to this instance as place where this things recides (happens NOT on MOVE)
      newObj = addHyperlink2Doc(req,newObj);
      // TO DO: delete all actively deleted Elements (those with value null):
      //        (...)
      // insert new Doc:
      return dbUser.insert(newObj).then((DBres) => {
          //return res.send(DBres)

          /// pic attachment >>>>>
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
      .then(function(DBres){ // pic attachment
        return res.send(DBres)
      })
    })
    .catch((err)=>{
      console.log(err);
      res.statusCode = err.statusCode;
      res.send(err.reason)
    })
}

//////////////////////
//// DB HELPER ///////

function borrow_request(req,res){
  console.log(req.username + " asks to borrow thing "+req.body.data.ref);


  let db = nanoAdmin.db.use('userdb-'+toHex(req.targets[0]));

  return db.get("&notifications").then((notifications) => {
    console.log(notifications);
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
    let newNoti = { ref: req.body.data.ref,
        text:`user ${req.username} wants to borrow ${req.body.data.ref} from
        ${req.body.data.from} till ${req.body.data.till} you can contact them via:
        ${contact}`}
    if (notifications.pending.info === undefined){ notifications.pending.info = {} }
        notifications.pending.info[req.username] = newNoti;
    return db.insert(notifications).then(() =>{

      return res.send("working on it");
    })
  }).catch(function(err){
    res.statusCode = 500;
    return res.send(err)
  })
}


function updatePublicDBIfPublic(req,doc){
  if (doc.other && doc.other.visibility.includes("public") )
  {
    deleteItemCopies(req, nanoAdmin,doc)
    .then(function(){
      req.body.data.doc = doc;
      return insertItemCopies(req, nanoAdmin)
    }).catch(console.log)
  }
}


function deleteItemCopies(req,nanoUser, oldDoc={other:{visibility:[]}})
{
  //console.log(oldDoc.other.visibility);
  //console.log(req.body.data.doc.other.visibility);
  //therefore we gotta check if we have to delete sth from publicDBs:

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
          /*copy.hyperlink = instanceUrl.slice(0, -1)+":" + //instanceUrl minus slash
                    API_PORT + API_BASE_URL + req.username + "/" + req.targets[1];*/
          console.log(copy);
          return publicDB.insert(copy).catch(console.log)
        }
        else {
          console.log("insertItemCopies: "+req.body.data.doc._id+" : NOT PUBLIC ");
        }
        if (!oldDoc.other.visibility.includes("friends") &&
            req.body.data.doc.other.visibility.includes("friends"))
        {
          // copy item into friends
        }
        if (!oldDoc.other.visibility.includes("friends2nd") &&
            req.body.data.doc.other.visibility.includes("friends2nd"))
        {
          // copy id from DB friends2nd
          // copy item into friends
        }
}

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

    // TO DO HERE (instead): VALIDATION !!!!!!!!!!!
    if (req.body.data.doc.other.visibility === undefined)
    {
      req.body.data.doc.other.visibility = "private" //????
    }

    req.body.data.doc.created = Date.now();
    req.body.data.doc._id = uuidv5(instanceUrl+req.targets[0]+"/"+req.body.data.doc.created, uuidv5.URL);
    req.body.data.doc = addHyperlink2Doc(req,req.body.data.doc);
  //  console.log(req.body.data.doc._id);
    return dbUser.insert(req.body.data.doc).then((DBres) => {

      if (req.body.data.pic != undefined)
      {
        console.log("PICTURE PROVIDED!!!");
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
  q.fields = ["_id","name","location","other","owners","hyperlink","inPossessionOf"];
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


function addHyperlink2Doc(req,doc)
{
  let urlAfterAPI = req.url.split(API_BASE_URL)[1].split("?")[0];
  let targets = urlAfterAPI.split("/");
  targets = targets.filter(String);
  console.log("adding hyperlink with username "+targets[0]+" to doc");

  doc.hyperlink = instanceUrl.slice(0, -1)+":" + //instanceUrl minus slash
            API_PORT + API_BASE_URL + targets[0] + "/" + doc._id; // NEEDS TO COME FROM URL NOT USERNAME BUGGGGGGGGGGGG
  return doc
}


function updateContainerOf(req,target,thingInside,authCookie,delete_it=false,callback=console.log)
{
  console.log("inside updateContainerOf");
  console.log("target: "+target);

  if (!target.startsWith("https"))
  {
    target = instanceUrl.slice(0,-1)+":" + //instanceUrl minus slash
              API_PORT+API_BASE_URL+req.username+"/"+target;
  }

  // TO DO: before doing the update request below: check if any of the containers
  //  are linking back or are the itemInside and if so: deny and throw error

  recursionInContainerChain(req,target, thingInside,authCookie, function(isTrue){
    if (isTrue == true)
    {
      console.log("ERROR: RECURSIVE THING-CONTAINER-CHAIN !!!!");
      return callback("ERROR: RECURSIVE THING-CONTAINER-CHAIN !!!!");
    }
    else
    {

        request({
            method: 'GET',
            url: target,
            headers:
            {
              'Cookie':authCookie
            }
          },
          function (error, response, body) {
            if (error) throw new Error(error);

            body = JSON.parse(body);
            console.log(body);
            console.log("fetched document "+body._id+". will now add or delete "+
                        thingInside+" to other.containerOf:");
            if(Array.isArray(body.other.containerOf))
            {
              if (body.other.containerOf.indexOf(thingInside) === -1)
              {
                body.other.containerOf.push(thingInside);
                console.log("adding:");
              } else {
                console.log("already exists inside");
                if(delete_it)
                {
                  let index = body.other.containerOf.indexOf(thingInside)
                  if (index !== -1)
                  {
                    body.other.containerOf.splice(body.other.containerOf.indexOf(thingInside),1);
                    console.log("DELETING:");
                    console.log(body.other.containerOf);
                  }
                }
              }
            }
            else if (!delete_it){
              body.other.containerOf = [thingInside];
            }

            request({
                method: 'POST',
                url: target,
                json: {
                    "data":[{
                      "type":"update",
                      "doc":body
                    }]
                  },
                headers:
                {
                  'Cookie':authCookie
                }
              },function(err,res,body){
                console.log(err);
                //console.log(res);
                console.log(body);
                callback();
              })

          });
    }
  })

}

function recursionInContainerChain(req,containerID, thingID, authCookie, callback)
{

  if (!(containerID.includes(thingID)))
  {
    request({
        method: 'GET',
        url: containerID,
        headers:
        {
          'Cookie':authCookie
        }
      },
      function (error, response, body) {
        console.log("recursion checking the fetched body:");
        console.log(body);
        if (error){
          console.log("error inside RECURSIONCHECK:");
          console.log(error);
          return callback(true)
        }
        if (body)
        body = JSON.parse(body);
        if (body != undefined){
          if(body._id == thingID){
            console.log("direct RECURSION");
            return callback(true)
          }
          else if(body.location.insideOf == undefined || body.location.insideOf == "")
          {
            console.log("no recursion. test ended at :"+ body._id);
            return callback(false)
          }
          else if(body.location.insideOf.includes(thingID))
          {
            console.log("RECURSION: "+body._id+" is inside of "+ thingID);
            return callback(true)
          }
          else {
            console.log("no recursion, but sth insideOf "+body._id+ " so: next thing to test...");
            if (!body.location.insideOf.startsWith("https")){
              body.location.insideOf = instanceUrl.slice(0,-1)+":" + //instanceUrl minus slash
                        API_PORT+API_BASE_URL+req.username+"/"+body.location.insideOf;
            }
            recursionInContainerChain(req,body.location.insideOf,thingID,authCookie,callback)
          }
        }
      })
  }
  else {
    console.log("RECURSION: thingID is containerID: "+containerID +" - "+ thingID);
    callback(true)
  }
}


function requestItems(req,res)
{
  res.statusCode = 400;
  return res.send('"requestItems does not yet exist"')
}

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
      }
      //console.log(query);
      return query
}


///////////////////////////
// INSTANCE HELPER ////////


function search(req,res) // CURRENTLY BROKEN AND ALSO NOT DIFFERENT ATM TO findItems()!!!!!!
{
  //console.log(req.body.data.doc);
  res.send("search API is not working yet.")

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
                if ( ding.owners.indexOf(req.username) > -1)
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
                if ( ding.other !== undefined &&
                    ding.other.visibility.includes("private") ||
                    ding.other.visibility.includes("not") ||
                      ding.other.visibility === undefined   ){
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


function verifyUserCredibility(req, res, next){

      //console.log(req.body);
      if (req.cookies.AuthSession !== undefined && req.cookies.AuthSession!=="")
      {
        //console.log("Cookie or Session Token provided.\nlets try to verify this session");
        verifyAuthToken(req,res,next); // will reject req if not valid
        //console.log(req);
        console.log("cookie req!");
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

function addToArrayIfNotExist(array,item){
  array.indexOf(item) === -1 ? array.push(item) : console.log("item already exists");
  return array;
}

function trimFloatStringToNDecimalPlaces(num,decimals=3){
  return num.slice(0, (num.indexOf("."))+(decimals+1));
}

function trimTrailingSlashes(input)
{
    return input.replace(/\/$/, "");
}
