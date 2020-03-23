const config = require("./../server_config.json");

// STDIN STUFF
const readline = require('readline');

// DATABASE STUFF

const DBadminPW = config.DBadminPW;

const request = require('request');
const util = require('util');

// make request() return promise:
const requestPromise = util.promisify(request);

const instanceUrl = config.instanceURL;
const databaseUrl = config.databaseURL;
console.log(databaseUrl);


const nanoAdmin = require('nano')('http://admin:'+DBadminPW+'@'+databaseUrl.split("://")[1]);

// WEB PUSH STUFF
const webpush = require('web-push');
const express = require('express');
const https = require("https");
const fs = require('fs');

// SSL Stuff
const options = {
  key: fs.readFileSync(config.SSLkey),
  cert: fs.readFileSync(config.SSLcert)
};

const publicVapidKey = config.publicVapidKey;

const privateVapidKey = config.privateVapidkey;

// Replace with your email
webpush.setVapidDetails('mailto:'+config.emailAdmin, publicVapidKey, privateVapidKey);


const app = express();

app.use(require('body-parser').json());

/**
 * the subscribe endpoint manages the first interaction/subscription of a user
 * it gets the subscription parameters from the push service of the users browser
 * and it takes the username send as url parameter to associate both and save them
 * to the Database (TODO)
 */
app.post('/subscribe', (req, res) => {
  const subscription = req.body;
  res.status(201).json({});

  //console.log(subscription);
  //console.log(Object.keys(req));
  //console.log(req.query);
  if (req.query.user){
    console.log(req.query.user); // username to register push with
    console.log(subscription) // subscription object containing endpoint and keys
    savePushSubscription(req.query.user,subscription) // write user creds into DB
  }
/*
  const payload = JSON.stringify(
    {
      title: 'Welcome to Dingsda!',
      //body: subscription.msgbody
      body: 'We will let you know when something\'s going on in your Dingsda account. <3'
    }
  );

    webpush.sendNotification(subscription, payload).catch(error => {
      console.error(error.stack);
    });
*/
});

/** 
 * this endpoint does the same as the webpush standalone module would do. it is not strictly needed,
 * but we might be happy about it later if we want to trigger push notifications from http and not
 * cli only
*/
app.post('/push',(req,res)=>{

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
})


app.use(require('express-static')('./'));


https.createServer(options,app)
.listen(5001,()=>console.log('DINGSDA push API listening on port '+ 5001));


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

  let adminDB = nanoAdmin.use('webpush')
  
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
  
  let adminDB = nanoAdmin.use('webpush')
  
  return adminDB.get(username)
  .then((res)=>{
    console.log(res);
    res.webpush = subscription; // add subscription to config
    return adminDB.insert(res); // insert config again
  })
  .catch((err)=>{
  
    if (err.reason && err.reason === "missing")
    {
      console.log("no doc yet. will add, then redo...");
      let doc = subscription;
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
  
  //return dbAdmin.insert(newObj).then((DBres) => {
}


/*
turns string to Hex value also found in server.js
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
