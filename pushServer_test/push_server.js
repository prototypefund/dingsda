const webpush = require('web-push');
const express = require('express');
const http = require("http");
const config = require("./../server_config.json")

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
      body: 'this is a html thing'
    }
  );

  console.log(subscription);

  setInterval(function(){
    webpush.sendNotification(subscription, payload).catch(error => {
      console.error(error.stack);
    });
  },8000)

});

app.use(require('express-static')('./'));


http.createServer(app)
.listen(3001,()=>console.log('DINGSDA push API listening on port '+ 3001));
