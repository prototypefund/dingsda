/*
 this script assembles a webpage from mustache templates for the dingda UI one
and serves it via express server OR if given --file parameter, renders it
to a index.html file

ATTENTION: UI/two can be served directly! this is only for UI/one!
*/


const fs = require('fs');
const express = require('express');
const mustacheExpress = require('mustache-express');
const mustache = require('mustache');

const config = require("./one/config_UI.json");

const app = express()


// CONFIG
// should later be found config and templates:
const googleAPIkey = config.googlemapsAPIkey;

/////// INIT //////////////////


// Register '.html' extension with The Mustache Express
app.engine('mustache', mustacheExpress());
app.use(express.static(__dirname+'/one'));

app.set('view engine', 'mustache');
app.set('views',__dirname+'/one');


////// EXEC /////////////////////

//////////////////////////////////////////////////////////////////////////////////
// if 1st commandline argument is "--file", render to index.html file for testing:
let args = process.argv.slice(2);
if (args.indexOf("--file") > -1)
{
  console.log("RENDERING TO FILE");
  let mainTemplate = fs.readFileSync("one/"+"index.mustache").toString();
  getPartialsFromDir("/one",".mustache",function(dictOfPartials){
    let warning = `
    <!-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    WARNING: DO NOT USE THIS FILE IN PRODUCTION NOR UPLOAD IT TO A PUBLIC GIT!
      it might contain API keys that you do not want to expose... -->
    `
    let output = mustache.render(
        mainTemplate,

        {warning:warning , googleAPIkey:googleAPIkey}, // // include API Key for googleAPI

        dictOfPartials
    );
    //console.log(output);
    fs.writeFileSync("index.html",output);
    console.log("File written to index.html");
    console.log(warning);
    console.log("EXITING");
    process.exit()
  }
  )
}


// else: ////////////////////////////////////////////////////////////////////////
///////// SERVE >>> /////////////////////////////////////////////////////////////

app.get('/', function (req, res) {

      //  this could be anything that the client knows when it needs to
      // (e.g. a sessionToken that needs to be checked etc.):
    // if client provides the right parameter, server the page with full view
    if (req.query.map == "true")
    {
        //let html = mustache.render("addTemplStringhere",{googleAPIkey:googleAPIkey}, {"mapscript":"OINK!"});
        //res.end(html);
        res.render('index.mustache',{googleAPIkey:googleAPIkey}); // include API Key for googleAPI

    }
    else
    {
      res.render("index.mustache",{}) // before successful login
    }

});

app.listen(8080)




///// FUNCTIONS //////


function getPartialsFromDir(path="", fileextension=".mustache",callback=console.log)
{
  output = {}
  // search directory for all files with fileextension:
  fs.readdir(process.cwd()+path, function (err, files) {
  if (err) {
    console.log(err);
    return;
  }
    for (i in files)
    {
      if (files[i].endsWith(fileextension))
      {
          // add to output object
          output[files[i].replace(fileextension,"")] = fs.readFileSync(path.slice(1)+"/"+files[i]).toString();
          //console.log(files[i]);
      }

    }
    callback(output)
  });

}
