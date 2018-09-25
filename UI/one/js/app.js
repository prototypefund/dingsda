// FYI: this is terrible frankenstein codemix with stuff from years ago
//do it quick and then redo completely!

//console.log("index.js loading");

// ISSUE: clear makes visibility jump back to owners
// ISSUE: find with visibility problematic for it does not include DB owner as
//        READ permitted


// TO DO: how to target friends databases?

// stuff for config later
var lastFocus = "name";
var inputs = ['name','location'];
var clearFormsAfterUpdate = true; // add also an option for
var clearFormsAfterAdd = false;
const API_BASE_URL = "http://localhost:3000/api/v1/";

let glb_username = ""; // fill in first session!!!1


//$('#id').prop("disabled", true); // uncomment if id should not be editable
//$('#id').val("456");$('#name').val("Arnold"); //< for testing only


$.event.special.tap.tapholdThreshold = 300;
function tapholdHandler()
{
  console.log("taphold occured !!! <3<3<3");
  $('#popupMenu').popup("open");
};

function CancelDeleteTapholdHandler()
{
  console.log("taphold CancelDelete occured");
  btn_del(true);
};

$("#btn_del").bind("taphold",CancelDeleteTapholdHandler);
$("#btn_find").bind("taphold",tapholdHandler);
/////////////////////////////////////////////
/////////////////////////////////////////////

function onLoad() {
        document.addEventListener("deviceready", onDeviceReady, false);

        //testing login only:
        //getAPI({ data:{name:"jan",password:"apple" }});

        // attempt login at start through cookie

        /*
         when starting: get Session via AuthCookie or show loginPopUp if that fails to
        get your cookie
        */

      //  check if already authenticated via cookie by sending empty data POST to API
      // it will respond with 200 "ok" if successful and 401 if not
      getAPI({
          data:{ },
          callback: function(res){
            console.log(res);
            if (res.username)
            {
              glb_username = res.username;
              console.log("you are logged in already as "+ glb_username);
            }
          },
          error: function(err){
            console.log(err);
            loginPopUp();

          }
      })

    }

function onDeviceReady() {
    // Now safe to use device APIs (if at some point in future cordova is used)
}

function scan(){
  //  to DO: read result.type and check if EAN or UPC, if so, check EAN db and
  // propose autofill for user
  console.log("scan clicked");
  // to Do: implement FOSS barcode camera system
 }

function getFocus(){
 alert(document.activeElement.id);
};

function getLastFocus(){
  scan();
  //console.log("here it should scan for barcodes and fill into " + lastFocus);
};
function setLastFocus(input)
{
  lastFocus = input.id;
  if (lastFocus.includes(".")){lastFocus = lastFocus.replace(".","\\.")};
};

function showKarma(input)
{
  if (input.value != "not")
    {
      $('#borrowbyhider').prop('style','display:block');
      $('#borrowbyhider').show();
    }
  else
    {
      $('#borrowbyhider').prop('style','display:none');
      $('#borrowbyhider').hide();
    }
};

function btn_find(searchIn,includeVisiblityInSearch = false)
{

  searchIn = searchIn !== undefined ? searchIn : getAllInputs();
  let searchTerm ={};
  if(typeof searchIn !== "object")
  {
    // when is that ever the case?????
    if (searchIn.includes(".")){searchIn = searchIn.replace(".","\\\.")};
    var value = $('#'+searchIn).val();
    if (searchIn.includes("\\.")){searchIn = searchIn.replace("\\.",".")};
    searchTerm[searchIn] = value;
  }
  else {
    searchTerm = searchIn;
  }

  // console.log( searchTerm );
  if ( searchTerm != "" && searchTerm != undefined)
        {
          if (!includeVisiblityInSearch && searchTerm.other != undefined)
          {
            delete(searchTerm.other.visibility)
          }
          console.log(searchTerm);
          console.log("searching for " + JSON.stringify(searchTerm))
        }
        else
        {
          console.log("nothing to search for");
          return;
        }

    swal({
        text: 'searching for dingsdas',
        showCloseButton: false,
        showConfirmButton: false,
        imageUrl: 'assets/images/ajax-loader.gif',
        background: 'rgba(10,10,10,0.3)'
      })

  read(searchTerm,
      function(inp)
        {
          //console.log(searchTerm);
          if (inp != "" && inp !== undefined && JSON.parse(inp).length != 0)
          {
            //console.log(inp);
            choosePopup(inp,fillForm);
            //fillForm(inp);
          }
          else
          {
            swal.close();
            console.log("found nothing")
          }
        },
      searchIn);

};


function btn_add_update()
{
    var basicout = getAllInputs();

    //basicout = JSON.parse(basicout);
    //console.log(basicout);

    //check if ID provided:
    if (basicout._id != undefined && basicout._id != "")
    {
      console.log("ID provided.\nErgo: item will be updated if it exists");
      updateit(basicout)/*.then(function(){
        if (clearFormsAfterUpdate)
        {
          clearForm();
        }
      })*/

    }
    else
    {
      if (checkIfBasicDataProvided(basicout))
      {
          console.log("No ID provided.\nErgo: new item will be added")
          //console.log(createID(true));
          //basicout._id = createID(false);
          //fillForm(basicout);
          addit(basicout, function(res){
            basicout._id = res.id;

            fillForm(basicout);

            //  config will give option to clear forms after every add or keep
            // the new thing in form or (later) to keep certain fields and clear
            // others for quick succession in adding new things
            if (clearFormsAfterAdd)
            {
              clearForm();
            }
          })/*.then(function(){
            if (clearFormsAfterAdd)
            {
              clearForm();
            }
            // TBD: ELSE FILL FORM WITH DATA RECEIVED BACK FROM DINGSDA
          })*/

      }
      else
      {
        console.log("The basic data requirements are not met. please provide at"
        +" least:...");
      }
    }

};


function btn_del(taphold)
{
    if (taphold)
    {
      //removeit(getItemId());
      //clear all forms
      clearForm();
    }
    else
    {
      //console.log("now i should clear all fields");
      clearForm();
    }
};


function checkIfBasicDataProvided(jsonobject)
{
  if (jsonobject.hasOwnProperty("name")
    && jsonobject.hasOwnProperty("location")
    && jsonobject.other.hasOwnProperty("visibility")
    //&& jsonobject.other.hasOwnProperty("borrowable")
    && jsonobject.hasOwnProperty("location")
    && jsonobject.hasOwnProperty("owners"))
  {
    return true;
  }
  else
  {
    return false;
  }
}

function fillForm(object)
{

// TO DO:!!!!
//  jsonobject = JSON.parse(jsonobject);

  console.log(object);

  if(object.other !== undefined)
  {
    if (object.other.borrowable === undefined){object.other.borrowable = "not"};
    if (object.other.visibility === undefined){object.other.visibility = "not"};
    //if (object.other.borrowby === undefined){object.other.borrowby = "physical"};

    $('#other\\.barcode').val(object.other.barcode);
    //$('#other\\.forKarma').val(jsonobject.other.forKarma).change();
    $('#other\\.visibility').val(object.other.visibility).change();
    //$('#other\\.borrowable').val(object.other.borrowable).change();
    //$('#other\\.borrowby').val(object.other.borrowby).change();
  }

  $('#_id').val(object._id);
  $('#name').val(object.name);
  $('#location').val(object.location);
  $('#owners').val(object.owners);

};

function clearForm()
{
  $('#_id').val("");
  $('#name').val("");
  $('#location').val("");
  $('#other\\.barcode').val("");
  $('#other\\.visibility').val("not").change();
  //$('#other\\.borrowable').val("not").change();
  //$('#other\\.borrowby').val("physical").change();
  $('#owners').val("");
}

function getItemId()
{
    itemid = $('#_id').val();
    return itemid;
}

function setItemId(stringval)
{
    itemid = $('#_id').val(stringval);
    return itemid;
}

function createID(randomTrue, username, itemname, num) // TO DO!!!! dingsda uuid norm!
{
  if (num == undefined)
  {
    num = "";
  }

  if (randomTrue)
  {
    ID = createRandomID() + num;
    return ID;
  }
  else
  {
    ID = createSpecificID(username,itemname, num);
    return ID;
  }
}

function createRandomID()
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 8; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));
        text += Date.now();
    return text;
}

function createSpecificID(username, itemname, num)
{
  date = Date.now();
  ID = username+itemname+date;
  return ID;
}

// soll: alle textinputfelder usw. in einer json zusammenfuegen und uebergeben:
function getAllInputs()
{
    var input = document.querySelectorAll("input[type=text]");
    var selects = document.querySelectorAll("select");
    var output = "";
    var other = "";


    for (i = 0; i < input.length; i++)
    {
      // renaming stuff to dot
      if (input[i].value != "")
      {
        if (input[i].id.startsWith("other."))
        {
          var thing = input[i].id.split("other.")[1];
          other = other +'"'+ thing+'":"'+ input[i].value +'",';
        }
        else
        {
          output = output +'"'+ input[i].id +'":"'+input[i].value +'",';
        }

      }

    }

    for (i = 0; i < selects.length; i++)
    {
      if (selects[i].value != "")
      {
        if (selects[i].id.startsWith("other."))
        {
          var thing = selects[i].id.split("other.")[1];
          other = other +'"'+ thing +'":"'+ selects[i].value +'",';
        }
        else
        {
          output = output +'"'+ selects[i].id +'":"'+ selects[i].value +'",';
        }
      }
    }
    //console.log(other);

    if (other != "")
    {
      other = other.substring(0,other.length-1);
      output = output + '"other":{'+ other+"}";
    }
    if (output != "")
    {
      if (output.endsWith(","))
      {
        output=output.substring(0, output.length - 1);
      }
      output='{'+output+'}';
      output= JSON.parse(output);
    }
    //console.log(output);

    //  SPECIAL CASES FOR ARRAYs and OBJECTS. TO DO: GENERALIZE by actually
    // making users save arrays into form to begin with

    // if owners and/or visibility: make Array:
    if (output.owners){
      let newArray = output.owners.replace(/ /g,'').split(",");
      output.owners = [];
      output.owners = newArray;
    }
    if (output.other.visibility){
      let newArray = output.other.visibility.replace(/ /g,'').split(",");
      output.other.visibility = [];
      output.other.visibility = newArray;
    }
    console.log(output);
    return output;

};




// register pop up

function registerPopUp(param={extra:""})
{
  swal.close();

  let {value: formValues} = swal({
  title: 'register',
  html:
    '<input id="swal-input1" class="swal2-input" placeholder="username">' +
    '<input id="swal-input2" class="swal2-input" placeholder="password" type="password">'+
    '<input id="swal-input3" class="swal2-input" placeholder="password" type="password">'+
    param.extra + '<br><span class="tologin">back to login</span>',
  focusConfirm: true,
  allowEscapeKey: false,
  allowOutsideClick: false,
  animation: false,
  showLoaderOnConfirm: true,
  preConfirm: () => {

    let username = document.getElementById('swal-input1').value;
    let pw = document.getElementById('swal-input2').value;
    let pw2 = document.getElementById('swal-input3').value;

    // here build in password minimum helper

    if(pw == pw2)
      {

      console.log("ok. ready to register");

      swal.close();
      let signUpreq =  $.ajax(
        {
          url: API_BASE_URL,
          type:'post',
          success:function(data){
            console.log("success network");
            console.log(data);

      // data = "ok"  // FOR TESTING ONLY!!!!

            if(data == "ok")
            {
              console.log("all is good");
              swal("you are registered!")
              .then(function(){
                loginPopUp(
                {extra:"you are registered!<br>", customClass:"animated tada"});
                });
            }
            else {
              console.log("got error back");
              registerPopUp({extra:"<br><span class='err'>you can't have"+
              " that username. choose again!</span><br>"})
            }

          },
          error:function(w,t,f){
            console.log(w+' '+t+' '+f);
            console.log("network err!");

          }
        });

// BIG TO DO!!!!! send request new user to server.js at server and await response
//   then return response with ok: true or err:"xxx" or forward to login pop up if success
    }
    else {
      return {err:"pwnonmatch"}
    }

  }
}).then(function(formValues){

  //console.log(formValues);
  if (formValues.value.ok == true)
  {
    swal("you are registered!").then(function(){loginPopUp({extra:"you are registered!<br>",
        customClass:"animated tada"});});
  }
  else if (formValues.value.err == "pwnonmatch")
  {
    registerPopUp({extra:"<br><span class='err'>your passwords don't match</span><br>"})
  }
  else {
    swal({
        text: 'trying to create account',
        showCloseButton: false,
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        imageUrl: 'assets/images/ajax-loader.gif',
        background: 'rgba(10,10,10,0.3)',
      })
    //  registerPopUp({extra:"<br><span class='err'>you can't have that username.
    // choose again!</span><br>"})
  }
}).catch(function(err){console.log(err);})


$(".tologin").click(function(){
  swal.close();
  loginPopUp();
})

}

// login pop up

function loginPopUp(param={customClass:'animated jello', extra:""})
{
  let {value: formValues} = swal({
  title: 'login',
  html:
    'log into your dingsder account<br>'+
    '<input id="swal-input1" class="swal2-input" placeholder="username">' +
    '<input id="swal-input2" class="swal2-input" placeholder="password" type="password">'+
    param.extra +
    '<br>don\'t have an account yet? <span class="registerlink">REGISTER!</span>',
  focusConfirm: true,
  allowEscapeKey: false,
  allowOutsideClick: false,
  animation: true,
  showLoaderOnConfirm: true,
  customClass: 'animated shake',
  preConfirm: () => {

    let username = document.getElementById('swal-input1').value;
    let pw = document.getElementById('swal-input2').value;

    console.log(username + " " + pw);
    getAPI({
      data:{ "name":username,"password":pw },
      callback: function(res)
        {
          console.log("successfully logged in as "+username);
          glb_username = username;
        },
      error: function(err){
        console.log(err);
        loginPopUp({extra:"<br><span class='err'>you don't exist! Try again</span><br>"});
      }
      })

  }
})

$(".registerlink").click(function(){
  console.log("register!");
  registerPopUp()
});

}


//choosePopup(["item1","item2sdfdf","item3"]);
/// make popup listing items to choose from:

function choosePopup(inputlist, callback)
{
  if (typeof inputlist != "object"){inputlist = JSON.parse(inputlist)}

  let listOfItems = 'dingsder found '+inputlist.length+' dingsdas<br><br>';
  for (item in inputlist)
  {
    let thing = inputlist[item];
    listOfItems = listOfItems +
     "<button class='itemfromlist' listnumber='"+item+"'><b>"+thing.name+
     "</b> in <i>"+thing.location+"</i></button><br>"
  }

  swal({
    title: '',
    html: listOfItems,
    showCloseButton: true,
    focusConfirm: true,
    background: 'rgba(10,0,10,0.6)',
    confirmButtonText:
      'damn. let me try again!'
  })

  $(".itemfromlist").click(function()
  {
    //console.log(this.innerText);
    let result = inputlist[this.getAttribute("listnumber")];
    swal.close();
    callback(result)
  })

}

/// adapterfunction to couchsearch: read()

function read(searchTerm,callback)
{
  //console.log("searchterm");
  //console.log(searchTerm);
  if (searchTerm == undefined){return false}

  //  prefilter if contains array or object: (only RELEVANT FOR other.visibility,
  // other.borrowable and friends FIND)

  //  nice library from https://github.com/vardars/dotize producing a
  // . notated obj from a nested one. Careful tho with deep objects
  // (performance) had to mod to exclude arrays had to modify slightly
  searchTerm = dotize.convert(searchTerm);
//  console.log(searchTerm);

  postAPI({
      path:glb_username, // HERE USERNAME!!!!!
      data:{
            	"data":[{
            		"type":"findItems",
            		"doc":searchTerm
                //"doc":{_id:"33","other.visibility":["friends"]}
            	}]
            },
       callback: function(result){
        console.log("show results:");
        console.log(result);
        console.log(result.docs);
        callback(JSON.stringify(result.docs))
      }

  });

}

/////////////////////////////////////////////
////// COUCHDB SEARCH ///////////////////////
//// see also pouch_search_form_demo.html ///



//// ADD / update

function addit(obj,callback=console.log)
{
  console.log("attempting to add item to dingsda");
  postAPI({
      path:glb_username,
      data:{
            	"data":[{
            		"type":"addItems",
            		"doc":obj
                //"doc":{_id:"33","other.visibility":["friends"]}
            	}]
            },
       callback: function(result){
        //console.log("show results:");
        //console.log(result);
        callback(result)
      }

  });

}


function updateit(obj,callback=console.log)
{
  console.log("trying to fetch originalObject from DB");

  getAPI({
    path:glb_username+"/"+obj._id,
    data:{
      "data":[{
        "type":"fetch"
      }]
    },
    callback: function(res){

      console.log(res);
      console.log("merging oldObj and formContents");
      let newObj = Object.assign({}, res, obj);
      console.log(newObj);
      console.log("attempting update of object");

      postAPI({
          path:glb_username+"/"+obj._id,
          data:{
              "data":[{
                "type":"update",
                "doc":newObj
                //"doc":{_id:"33","other.visibility":["friends"]}
              }]
            },
            callback: function(result){
            callback(result)
            console.log("updated successfully");
            console.log(result);
          }

      });
    }
  })

}


function postAPI({path="", data =null, callback=console.log, error=function(err)
                  {swal({text:err.responseText});console.log(err.responseText)}})
{

  $.ajax({
    type: "POST",
    url: API_BASE_URL+path,
    data: JSON.stringify(data),
    success: callback,
    xhrFields: { withCredentials: true }, // to make AuthCookie ok
    error: error
    ,contentType:"application/json"
  });

}

function getAPI({path="", data=null, callback=console.log, error=function(err)
                  {console.log(err.responseText)}})
{

  $.ajax({
    type: "GET",
    url: API_BASE_URL+path,
    data: data,
    success: callback,
    xhrFields: { withCredentials: true }, // to make AuthCookie ok
    error: error
    //,dataType: "application/json"
    ,contentType:"application/json"
  });

}


function getObjectDepth({ parts })
{
  let result = (parts ? Math.max(...children.map(getDepth)) : 0) + 1
  return result
}

//// notifications


$("#notifications_div").click(function(){
  $("#notifications_div").removeClass("blink");
  // SHOW NOTIFICATIONS
})
