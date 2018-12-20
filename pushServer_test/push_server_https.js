const webpush = require('web-push');
const express = require('express');
const https = require("https");
const fs = require('fs');

const config = require("./../server_config.json");

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

app.post('/subscribe', (req, res) => {
  const subscription = req.body;
  res.status(201).json({});
  const payload = JSON.stringify(
    {
      title: 'test',
      body: subscription.msgbody
    }
  );

  console.log(subscription);

    webpush.sendNotification(subscription, payload).catch(error => {
      console.error(error.stack);
    });

});

app.use(require('express-static')('./'));


https.createServer(options,app)
.listen(5000,()=>console.log('DINGSDA push API listening on port '+ 5000));
