// uploadAttachment to couchDB with nano testscript


const nanoAdmin = require('nano')('http://jan:apple@localhost:5984');
const fs = require('fs');

let db = nanoAdmin.use("userdb-6a616e");

let picdata = "";

picdata = picdata.replace(/^data:image\/\w+;base64,/, '');

let data = Buffer.from(picdata, 'base64');

/*
// WORKS (But no way to get base64 out here without temp saving stuff)
db.attachment.getAsStream('1706c955-675d-5cba-bca0-75f1fb60f54d', 'testpic.jpeg')
.pipe(fs.createWriteStream('output.jpeg'));
*/

// WORKS!
db.get('1706c955-675d-5cba-bca0-75f1fb60f54d',{attachments:true}).then((body) => {
  //console.log(body);
  console.log(body._attachments["testpic.jpeg"].data);
  let buffer = Buffer.from(body._attachments["testpic.jpeg"].data,"base64")
  fs.writeFileSync('output.jpeg', buffer,function(err){console.log(err)});
});


/* // returns blob or buffer, so unusable
db.attachment.get('1706c955-675d-5cba-bca0-75f1fb60f54d', 'testpic.jpeg').then((body) => {
  //let output = Buffer.from(body).toString('base64');
  console.log(body);
  //fs.writeFileSync('output.jpeg', body,function(err){console.log(err)});
});
*/
