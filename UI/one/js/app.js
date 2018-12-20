// FYI: this is terrible frankenstein codemix with stuff from years ago
//do it quick and then redo completely!

//console.log("index.js loading");

// ISSUE: clear makes visibility jump back to owners
// ISSUE: find with visibility problematic for it does not include DB owner as
//        READ permitted

// TO DO: how to target friends databases?

/*///////////////////////// CONFIG /////////////////////////////////////////////
should be an object in userDB with only access by user themselves.
should be then fetched at login to fill this object and init all parts of the UI
//////////////////////////////////////////////////////////////////////////////*/
let config = {
  searchIn:[], // DBs to search in for Items NOT YET SUPPORTED
  barcodeApp: "Quagga", // app:// uri to Scanner App OR (default) Quagga

  upcitemdb_com: "", // key for API of upcitemdb.com (best! works 100x a day w/o)
  upcdatabase_com: "",// key for API of upcdatabase.com
  upcdatabase_org: "", // key for API of upcdatabase.org

  includeVisiblityInSearch: false,
  clearFormsAfterAdd: false,
  clearFormsAfterUpdate: false,
  // Array of names of fields that should be cleared by clearForms():
  fieldsNotToClear:["owners","location"]
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

// stuff for config later
let lastFocus = "other\\.barcode";
//const API_BASE_URL = "http://192.168.178.128:3000/api/v1/";
const app_BASE_URL = "https://dingsda.org/UI/";
const API_BASE_URL = "https://dingsda.org:3000/api/v1/";

let glb_username = ""; // fill in first session!!!

//$('#id').prop("disabled", true); // uncomment if id should not be editable
//$('#id').val("456");$('#name').val("Arnold"); //< for testing only

$.event.special.tap.tapholdThreshold = 300;
/**
 * handles taphold (if tap is held for more than 300ms)
 * and triggers #popupMenu to show
 */
function tapholdHandler()
{
  console.log("taphold occured !!! <3<3<3");
  $('#popupMenu').popup("open");
};

/**
 * handles taphold if cancel/delete button is pressed and calls function btn_del()
 */
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
        document.addEventListener("barcodeScanned",barcodeListender);
        document.getElementById("scan_cancel").addEventListener("click",
        function(){
          stopBarcode();
          $("#barcodeviewport").hide();
        });
        document.getElementById("photo_upload").addEventListener("change",
        function(){
          resizeBase64image(document.getElementById("photo_upload"),
          function(base64img){
            document.getElementById("preview_photo").src = base64img;
          });
        });

        $("#btn_config").click(function(){
          window.location.href = app_BASE_URL+"config.html"
        })

        $("#photo_collapsible").click(function(){
          if(document.getElementById("preview_photo").src.endsWith(".jpg"))
          {
            console.log("picture in picture");
          }
          else {
            console.log("NO PICTURE, pulling small picture from database...");
            let id = $("#_id").val()
            if ( $("#hyperlink").html() !== undefined && $("#hyperlink").html() !== "" )
            { id = $("#hyperlink").html()+"/pic_small.jpg" }
            else
            { id = API_BASE_URL+glb_username+"/"+id+"/pic_small.jpg"}
            if ( id != undefined && id != "" && id != API_BASE_URL+glb_username+"//pic_small.jpg")
            {
              document.getElementById("preview_photo")
                .src = id;
              document.getElementById("preview_photo")
                .setAttribute("oldsource", id);
              /*getPicAttachment(id,function(res){
                console.log(res);
                document.getElementById("preview_photo")
                  .src = "data:image/jpeg;base64,"+res;
                document.getElementById("preview_photo")
                  .setAttribute("oldsource", "data:image/jpeg;base64,"+res);

              })*/
            }
            else {
              document.getElementById("preview_photo")
                .src = undefined;
              document.getElementById("preview_photo")
                .setAttribute("oldsource", undefined);
            }

          }
        })

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
              swal({html:"logged in as <br><b>"+ glb_username+"</b>",
              toast:true, timer:1200,showConfirmButton:false, position:"center",
              customClass:"whiteletters"})
              fetchConfig();
              // testing only:
              //openCarnetPDF(["1706c955-675d-5cba-bca0-75f1fb60f54d"]);
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

/**
 * handles click on scan button.
 * shows barcodeviewport and triggers function startBarcode()
 */

 /**
  * handles click on scanButton. Shows #barcodeviewport and
  * triggers startBarcode() function
  */
function scan(){
  //  to DO: read barcodeScanned Events detail.type
  // and check if EAN or UPC, if so, check EAN db and
  // propose autofill for user
  console.log("scan clicked");
  $("#barcodeviewport").show();
  startBarcode();
}


/**
 * testing function for checking activeElement
 */
function getFocus(){
 alert(document.activeElement.id);
};

/**
 * sets variable lastFocus to id of DOM element.
 * Should be DOM element that was focussed by user.
 * @param {Object} input DOM object
 */
function setLastFocus(input)
{
  lastFocus = input.id;
  if (lastFocus.includes(".")){lastFocus = lastFocus.replace(".","\\.")};
};

/**
 * function to show otherwise hidden Karma Options in UI (atm not implemented)
 * object passed as argument should normally be the DOM object of the borrowable
 * select menu.
 *
 * in case that sth is borrowable the Karma Options should be provided to explain
 * if an item can be borrowed for free or rented
 * @param {Object} input DOM object
 */
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

/**
 * function. handles click on #btn_find in UI
 *
 * checks for certain fields if modifications of data is needed in order to
 * make proper search query:
 * owners (make Array if String)
 *
 * @param {(Object|string)} searchIn An object of Fields in which should be
 * searched  or string with name of field to be searched in
 * @param {boolean} [includeVisiblityInSearch=false]
 */
function btn_find(searchIn,includeVisiblityInSearch = false,scope="user")
{
  swal.close();
  $('#popupMenu').popup('close');
  searchIn = searchIn !== undefined ? searchIn : getAllInputs();
  let searchTerm ={};
  if(typeof searchIn !== "object")
  {
    // when called by choosePop Up find
    if (searchIn.includes(".")){searchIn = searchIn.replace(".","\\\.")};
    let value = $('#'+searchIn).val();
    if (searchIn.includes("\\.")){searchIn = searchIn.replace("\\.",".")};
    if (searchIn == "owners"){ value = value.split(",") };
    if (searchIn == "other.tags"){ value = value.split(",") };
    searchTerm[searchIn] = value;

    // ausnahme TO DO: beseitigen! nur weil location.mustache ids ohne . hat
    if (searchIn == "address"){searchTerm = {location:{address:$('#address').val() }} }
    if (searchIn == "geodata"){searchTerm = {
        location:{
          latitude:$('#latitude').val(),
          longitude:$('#longitude').val(),
        }
      }
    }
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

          if (searchTerm.location !== undefined && searchTerm.location.latitude == "0" )
          {searchTerm.location.latitude=""}
          if (searchTerm.location !== undefined && searchTerm.location.longitude == "0" )
          {searchTerm.location.longitude=""}

          if (searchTerm[hyperlink] == undefined || searchTerm.hyperlink == "")
          { delete searchTerm.hyperlink }

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
        imageUrl: '../assets/images/ajax-loader.gif',
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
            console.log(inp);
            swal.close();
            console.log("found nothing")
            swal({text:"found nothing", toast:true, timer:1000,
            showConfirmButton:false, position:"center",customClass:"whiteletters"
          })

          }
        },
        function(r){
          console.log(r.responseText);
          swal({text:"Missing search parameters", toast:true,customClass:"whiteletters",
                timer:2000, showConfirmButton:false});
        },
      scope);

};


/**
 * function. handles click on #btn_add_update in UI.
 * first triggers getAllInputs and uses return value to build an object to either
 * update (if object has id) or add new to DB (if object has no id).
 * passes document to be written to functions updateit() or addit()
 *
 */
function btn_add_update()
{
    var basicout = getAllInputs();

    //basicout = JSON.parse(basicout);
    //console.log(basicout);

    //check if ID provided:
    if (basicout._id != undefined && basicout._id != "")
    {
      console.log("ID provided.\nErgo: item will be updated if it exists");

      updateit(basicout,function(res){
        if (config.clearFormsAfterUpdate)
        {
          clearForm();
        }
        console.log(res);
        if(res.ok == true)
        {
          swal({text:"UPDATED SUCCESSFULLY", toast:true, timer:1200,
            showConfirmButton:false, position:"center",customClass:"whiteletters"
          })
        }
        else {
          swal({title:"UPDATE ERROR",text:res.statusText, toast:true,customClass:"whiteletters"});
          console.log(res);
        }
      })

    }
    else
    {
      // if not name in owners, put in user alone:
      if (!basicout.hasOwnProperty("owners")){
          $('#owners').val(glb_username);
          basicout.owners=[ glb_username ];
         }

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
            if (config.clearFormsAfterAdd)
            {
              clearForm();
            }
            //console.log(res);
            if(res.ok == true)
            {
              swal({
                text:"ADDED SUCCESSFULLY", toast:true,
                timer:1200,showConfirmButton:false,
                position:"center",customClass:"whiteletters"
              })
            }
            else {
              swal({text:"ADD ERROR", toast:true,customClass:"whiteletters"});
              console.log(res);
            }

          })

      }
      else
      {
        let missing = ["name","location"];
        console.log(basicout);
        if (basicout.hasOwnProperty("name")){ missing.splice(0, 1); }
        console.log(missing);
        if (basicout.hasOwnProperty("location")){ missing.splice(1, 1); }

        swal({
            html:"please provide at least <br><b>"+missing+"</b>"
            , toast:true, timer:2000,showConfirmButton:false, position:"center",
            customClass:"whiteletters"
        })
        console.log("The basic data requirements are not met. please provide at"
        +" least:...");
      }
    }

};


function btn_del(taphold)
{
    if (taphold)
    {
      // confirm swal:
      swal({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        type: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
      }).then((result) => {
        if (result.value) {
          removeit(getItemId());
        }
      })
      //clear all forms
      //clearForm();
    }
    else
    {
      //console.log("now i should clear all fields");
      clearForm();
    }
}


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

  console.log(object);

  // if hyperlink in object: load the object from original Database if allowed and stop
  /*if(object.hyperlink !== undefined && object.hyperlink !== "")
  {
    return getSingleItem(object.hyperlink,function(res){clearForm();fillForm(res)});
  } */
  if(object.hyperlink !== undefined && object.hyperlink !== ""){
    $('#hyperlink').html(object.hyperlink);
  }
  // otherwise: start filling the form
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

    $('#other\\.price').val(object.other.price);
    $('#other\\.weight').val(object.other.weight);
    $('#other\\.madein').val(object.other.madein);
    $('#other\\.count').val(object.other.count);
    $('#other\\.tags').val( object.other.tags);

    if(object.other.containerOf !== undefined && object.other.containerOf.length > 0 )
    {
      $('#containerOf').show()
      $('#other\\.containerOf').html("");
      for (item in object.other.containerOf)
      {
        let links = "";
        links = links + '<a href=\'javascript:getSingleItem("'+
        object.other.containerOf[item]+'",function(res){fillForm(res)})\'>'+
        object.other.containerOf[item]+' </a><br>'
        getSingleItem(object.other.containerOf[item],function(res){
            links = res.name + " : <br>" + links;
            $('#other\\.containerOf').append(links);
        });
      }
    }else{
      $('#containerOf').hide()
      $('#other\\.containerOf').html("");
    }

    for (item in object.other.tags)
    {
        $('#other\\.tags').tagsinput('add', object.other.tags[item]);
    }
  }

  $('#_id').val(object._id);
  $('#name').val(object.name);
  $('#owners').val(object.owners);
  //$('#location').val(object.location); // old version from location always string

  //////////////////////////////////////
  // LOCATION OBJECT w/ map plugin:
  // TO DO: establish DOT NOTATION FOR LOCATION OBJECT!!!! (maybe include dotize???)

  if(typeof object.location === 'string')
  {
    console.log("location is a string");
    $('#description').val(object.location);
    $('.locationdescription').html(object.location);
  }
  else if (object.location !== null && typeof object.location === 'object')
  {
    console.log("location is an object");
    $('#description').val(object.location.description);
    $('.locationdescription').html(object.location.description);
    $('#address').val(object.location.address);
    $('#latitude').val(object.location.latitude);
    $('#longitude').val(object.location.longitude);
    $('#insideOf').val(object.location.insideOf);
      // fill also name of object in insideOf:
    if (object.location.insideOf !== undefined && object.location.insideOf !== "")
    {
      getSingleItem(object.location.insideOf,insideOfUpdated);
    }


  }

  ///////////////////////////////////////
  if(gmapsExists) // if the gmaps locationpicker module exists:
  {
    refreshMap();
  }

  // photo fetch if photo collapsible is open ////////////
  if ($( "#photo_collapsible_div" ).collapsible( "option", "collapsed" ) == false)
  {

    document.getElementById("preview_photo")
      .src = object.hyperlink+"/pic_small.jpg";
    document.getElementById("preview_photo")
      .setAttribute("oldsource", object.hyperlink+"/pic_small.jpg");

/*
    getPicAttachment(object._id,function(res){
      console.log(res);
      if (typeof res !== "object")
      {
        document.getElementById("preview_photo")
          .src = "data:image/jpeg;base64,"+res;
        document.getElementById("preview_photo")
          .setAttribute("oldsource", "data:image/jpeg;base64,"+res);
      }

    })*/
  }

};

function insideOfUpdated(res)
{
  if (res._id !== undefined)
  {
    $('#insideOf_name').html(res.name);
    $('#insideOf_name').attr("href", 'javascript:getSingleItem("'+res._id+
    '",function(res){clearForm();fillForm(res)});')
  }

}


function clearForm(checkconfig = true)
{
  if (!checkconfig)
  {
    console.log("should now clear ALL fields");
  }
  if ( !checkconfig || !config.fieldsNotToClear.includes("id")) $('#_id').val("");
  if ( !checkconfig || !config.fieldsNotToClear.includes("name")) $('#name').val("");
  if ( !checkconfig || !config.fieldsNotToClear.includes("location")) $('#location').val("");
  if ( !checkconfig || !config.fieldsNotToClear.includes("barcode")) $('#other\\.barcode').val("");
  if ( !checkconfig || !config.fieldsNotToClear.includes("visibility"))
  {$('#other\\.visibility').val("not").change();}
  //$('#other\\.borrowable').val("not").change();
  //$('#other\\.borrowby').val("physical").change();
  if ( !checkconfig || !config.fieldsNotToClear.includes("owners")) $('#owners').val("");

  if ( !checkconfig || !config.fieldsNotToClear.includes("price")) $('#other\\.value').val("");
  if ( !checkconfig || !config.fieldsNotToClear.includes("weight")) $('#other\\.weight').val("");
  if ( !checkconfig || !config.fieldsNotToClear.includes("country")) $('#other\\.madein').val("");
  if ( !checkconfig || !config.fieldsNotToClear.includes("count")) $('#other\\.count').val("");
  if ( !checkconfig || !config.fieldsNotToClear.includes("tags"))
  {
    $('#other\\.tags').val("");
    $('#other\\.tags').tagsinput('removeAll'); //special for tag visuals only
  }
  if ( !checkconfig || !config.fieldsNotToClear.includes("location"))
  {
    $('#description').val("");
    $('#address').val("");
    $('#latitude').val("");
    $('#longitude').val("");
    $('#insideOf').val("");
    $('.locationdescription').html("");
  }

  if ( !checkconfig || !config.fieldsNotToClear.includes("picture"))
  {
    document.getElementById("preview_photo").setAttribute("src","");
    document.getElementById("preview_photo").setAttribute("oldsource","");
  }

  $('#insideOf_name').html("");
  $('#insideOf_name').attr("href", '')

  $('#containerOf').hide()
  $('#other\\.containerOf').html("");

  $('#hyperlink').html("");
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
    var location = "";
    var hyperlink = $("#hyperlink").html();


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
        // else if input is part of location (has class map_value):
        else if (input[i].classList.contains("map_value"))
        {
          location = location +'"'+ input[i].id +'":"'+ input[i].value +'",';
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
      output = output + '"other":{'+ other+"},";
    }
    if (location != "")
    {
      location = location.substring(0,location.length-1);
      output = output + '"location":{'+ location+"},";
    }
    if (output != "")
    {
      if (output.endsWith(","))
      {
        output=output.substring(0, output.length - 1);
      }
      console.log(output);
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
    if (output.other.tags){
      let newArray = output.other.tags.replace(/ /g,'').split(",");
      output.other.tags = [];
      output.other.tags = newArray;
    }
    output.hyperlink = hyperlink;
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
          swal({html:"logged in as <br><b>"+ glb_username+"</b>",
          toast:true, timer:1200,showConfirmButton:false, position:"center",
          customClass:"whiteletters"})
          fetchConfig();
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

  let listOfItems = '';
  for (item in inputlist)
  {
    let thing = inputlist[item];
    if (thing.location == undefined){thing.location = ""}
    listOfItems = listOfItems +
     "<button class='itemfromlist' listnumber='"+item+"'><b>"+thing.name +
     "</b> in <i>"+thing.location.description+"</i></button><br>"
  }
  listOfItems = '<span style="color:white">dingsda found '+inputlist.length+
  ' dingsdas</span><br>'+
  `
  <style>
      /* style collapsible content */
    .collapsible {
      background-color: rgba(50,150,200,0);
      color: #545454;
      text-decoration: underline;
      cursor: pointer;
      padding: 2px;
      width: 100%;
      border: none;
      border-radius: 20vw;
      text-align: center;
      outline: none;
      font-size: 12px;
    }
    .active, .collapsible:hover {
      background-color: rgba(50,150,200,0.1);
    }
    .content {
      padding: 0 10px;
      display: none;
      overflow: hidden;
    }
  </style>
  <button id="collapsible_find" class="collapsible">extra: download all for custom form</button>
  <div class="content">
  <b>Carnet A.T.A.:<b/><br>
   <button id="ToCarnetPDF" class="listbutton">download PDF</button>
   <button id="ToCSV" class="listbutton">download CSV</button>
  </div>
  <br><br> <span style="color:white"> click to examine item: </span><br>
  `+
  listOfItems;

  swal({
    title: '',
    html: listOfItems,
    showCloseButton: true,
    focusConfirm: true,
    background: 'rgba(10,0,10,0.6)',
    showConfirmButton: false,
    confirmButtonText:
      'damn. let me try again!'
  })

  // show downloadbuttons on click on collasible button
  $("#collapsible_find").click( function() {
    console.log("clicked");
      this.classList.toggle("active");
      var content = this.nextElementSibling;
      if (content.style.display === "block") {
        content.style.display = "none";
      } else {
        content.style.display = "block";
      }
  })

  document.getElementById("ToCarnetPDF").addEventListener("click",function(){
    downloadCarnetClicked(inputlist,true);
  });
  document.getElementById("ToCSV").addEventListener("click",function(){
    downloadCarnetClicked(inputlist,false);
  });

  $(".itemfromlist").click(function()
  {
    //console.log(this.innerText);
    let result = inputlist[this.getAttribute("listnumber")];
    swal.close();
    callback(result)
  })

}

/**
 * function triggered after picking of specific searchterm. Triggers btn_find()
 * by passing the string searchFieldName into btn_find()
 *
 * in case that sth is borrowable the Karma Options should be provided to explain
 * if an item can be borrowed for free or rented
 * @param {Object} input DOM object
 */
function choosen(searchFieldName){
  btn_find(searchFieldName, config.includeVisiblityInSearch);
  $('#popupMenu').popup('close');
}

/// adapterfunction to couchsearch: read()

function read(searchTerm,callback,error, scope="user")
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
  console.log(searchTerm);

  let searchDB = glb_username; // default: userDB
  if (scope == "public") searchDB = "public";
  if (scope == "friends") searchDB = "friends";
  if (scope == "friends2nd") searchDB = "friends2nd";

  postAPI({
      path: searchDB, // here username if private search or public if public search
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
      },
      error:error

  });

}

/////////////////////////////////////////////
////// COUCHDB SEARCH ///////////////////////
//// see also pouch_search_form_demo.html ///

function fetchConfig(){
  console.log(glb_username);
  getAPI({
    path:glb_username+"/"+"config_one",
    data:{
      "data":[{
        "type":"fetch"
      }]
    },
    callback: function(res){
      console.log("new config received");
      console.log(res);
      if(typeof res === "object")
      {
        config = res;
      }
      else {
        alert("config file weird. please check!")
      }
      clearForm();
    },
    error: function(res){
      alert("error while fetching config. Please reload")
    }

  })

}

//// ADD / update

function addit(obj,callback=console.log)
{
  let data = {
            "data":[{
              "type":"addItems",
              "doc":obj,
              //"doc":{_id:"33","other.visibility":["friends"]}
            }]
          };

  // photo upload:
  if ($( "#photo_collapsible_div" ).collapsible( "option", "collapsed" ) == false
      && document.getElementById("preview_photo").src !=
       document.getElementById("preview_photo").getAttribute("oldsource")  )
  {
    data.data[0].pic = document.getElementById("preview_photo").src;
  }
  /*
  let img = document.getElementById("preview_photo");
  if (img.oldsource != img.src) // check if the source changed after the last load from DB
  {
    data.pic_small = img.src // if so: add the base64file to pic_small
  }
  */
  console.log("attempting to add item to dingsda");
  postAPI({
      path:glb_username,
      data:data,
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
  console.log(obj);

  let path = API_BASE_URL+glb_username+"/"+obj._id;
  if (obj.hyperlink !== undefined && obj.hyperlink != "")
  { path = obj.hyperlink }

  getSingleItem(path, function(res){

      console.log(res);
      console.log("merging oldObj and formContents");
      let newObj = Object.assign({}, res, obj);
      console.log(newObj);
      console.log("attempting update of object");

      let newdata = {
          "data":[{
            "type":"update",
            "doc":newObj,
            //pic:document.getElementById("preview_photo").src
            //"doc":{_id:"33","other.visibility":["friends"]}
          }]
        }

        // photo upload:
        if ($( "#photo_collapsible_div" ).collapsible( "option", "collapsed" ) == false
            && document.getElementById("preview_photo").src !=
             document.getElementById("preview_photo").getAttribute("oldsource")  )
        {
          console.log("PIC added to newdata!!!");
          newdata.data[0].pic = document.getElementById("preview_photo").src;
        }
        //console.log(newdata);
        // write into DB
        $.ajax({
          type: "POST",
          url: path,
          data: JSON.stringify(newdata),
          success: callback,
          xhrFields: { withCredentials: true }, // to make AuthCookie ok
          error: callback,
          contentType:"application/json"
        });
    },
    function(err){callback(err)}
  )


}

function removeit(id, callbackdel=console.log)
{
  console.log("removeit function triggered!!!");
  if (id == "" || id == undefined)
  {
    return
  }

  console.log("trying to fetch originalObject from DB");

  getAPI({
    path:glb_username+"/"+id,
    data:{
      "data":[{
        "type":"fetch"
      }]
    },
    callback: function(res){

      console.log(res);
      console.log("attempting DELETE of object");

      let deletedata = {
          "data":[{
            "type":"deleteItems",
            "doc":res,
          }]
        }

      postAPI({
          path:glb_username+"/"+id,
          data:deletedata,
            callback: function(result){
            callbackdel(result)
            console.log("DELETED "+id+" successfully");
            console.log(result);
            swal({html:"DELETED "+id+ "successfully",
              toast:true, timer:1200,showConfirmButton:false, position:"center",
              customClass:"whiteletters"})
            clearForm(false);
          },
          error: function(err){
            console.log("error in deleteit delete");
            callbackdel(err)
          }

      });
    },
    error: function(err){
      console.log("error in deleteit prefetch");
      callbackdel(err)
    }
  })

}


function getSingleItem(id,callback,error=console.log)
{
    // transform id into hyperlink in case no hyperlink was passed:
    if (!id.startsWith("https")){
      id = API_BASE_URL+glb_username+"/"+id;
    }
    console.log("fetching single Item: "+id);
    // get item json from DB
    $.ajax({
      type: "GET",
      url: id,
      success: callback,
      xhrFields: { withCredentials: true }, // to make AuthCookie ok
      error: error,
      contentType:"application/json"
    });

}


function postAPI({path="", data =null, callback=console.log,
                  error=function(err)
                  {/*swal({text:err.responseText})*/;
                  console.log(err.responseText);
                  callback(err)
                }})
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

$("#fullscreenToggle").click(function(){
  toggleFullscreen();
})

$(".notifications_img").click(function(){
  $("#notifications_div").removeClass("blink");
  // SHOW NOTIFICATIONS
})

// Barcode Scanner Eventlistener (happens if barcodescanner has detected barcode)

function barcodeListender(event)
{
  console.log(event.detail.barcode);
  swal({html:"scan successful",
    toast:true, timer:1000,showConfirmButton:false, position:"center",
    customClass:"whiteletters"})
  console.log(lastFocus);
  $("#"+lastFocus).val(event.detail.barcode)
  stopBarcode();
  $("#barcodeviewport").hide();

  /*
   MAYBE: here if form empty:
  check for EAN/UPC on the web
  OR SEARCH dingdaDBs for things with that barcode
  ?????
  */
}



function downloadCarnetClicked(items, pdf=false){
  console.log(items);
  let carnetArray = [];
  for (i in items){
    carnetArray.push(items[i]._id);
  }
  console.log(carnetArray);
  if (pdf){
      openCarnetPDF(carnetArray)
      //renderCarnetATApdf(carnetArray);
  }
  else {
    postAPI({
        path:glb_username,
        data:{
                "data":[{
                  "type":"getCarnet",
                  "filetype":"csv",
                  "ids":carnetArray
                }]
              },
         callback: function(result){
          //console.log(result[0]);
          let myblob = new Blob([result],{type:'text/csv;charset=utf-8;'});
          if (navigator.msSaveBlob) { //IE10
              navigator.msSaveBlob(myblob, "carnetATA.csv");
          } else {
              let l = document.createElement("a");
              if (l.download !== undefined) {
                  let uri = URL.createObjectURL(myblob);
                  l.setAttribute("href", uri);
                  l.setAttribute("download", "carnetATA.csv");
                  l.style.visibility = 'hidden';
                  document.body.appendChild(l);
                  l.click(); // does not work in ios because ajax request before
                  document.body.removeChild(l);
              }
          }

        }

    });
  }

}


function openCarnetPDF(ids=undefined)
{
  //let win = window.open();
  postAPI({
      path:glb_username,
      data:{
            	"data":[{
            		"type":"getCarnet",
            		"filetype":"json",
                "ids":ids

            	}]
            },
       callback: function(result){
        console.log("show results of getCarnet:");
        console.log(result);
/*
        let pdfviewStart = '<html><head><style>*{font-family: Ubuntu, Futura,
        Helvetica;}#containerleft{float:left; width: 100%; margin-left: 0%;}
        #dlbutton{height:10%;width:50%,background-color:green}#containerright
        {float:right; width: 100%;}</style></head><body><button onclick="download()">
        DOWNLOAD THE PDF</button> <br><br><iframe id="iframe" width="100%" height="90%">
        </iframe>';
        let pdfviewEnd = '<script src="https://ajax.googleapis.com/ajax/libs
        /jquery/3.2.1/jquery.js"></script><script src="https://cdnjs.cloudflare.com
        /ajax/libs/jspdf/1.4.0/jspdf.debug.js"></script><script
        src="https://rawgit.com/sphilee/jsPDF-CustomFonts-support/master
        /dist/jspdf.customfonts.debug.js"></script>
        <script src="https://rawgit.com/sphilee/jsPDF-CustomFonts-support
        /master/dist/default_vfs.js"></script><script src="'+app_BASE_URL+
        'js/carnet.js"></script></body></html>';

        let pdfviewDyn = '<script>let carnetArray = '+JSON.stringify(result)+'</script>';

        document.write(pdfviewStart+pdfviewDyn+pdfviewEnd);
*/
        renderCarnetATApdf(result);
      }

  });
}


/// Photo Upload

function getPicAttachment(thingid,callback=console.log)
{
  if (!thingid.startsWith("http")){
      thingid = API_BASE_URL+glb_username+"/"+thingid;
    }


  console.log("fetching single item attachment: "+thingid);
  // get item json from DB
  $.ajax({
    type: "GET",
    url: thingid+"/pic_small.jpg",
    success: callback,
    xhrFields: { withCredentials: true }, // to make AuthCookie ok
    error: console.log
    ,contentType:"application/json"
  });
/*
  // get Attachment and return it via callback
  getAPI({path:glb_username+"/"+thingid+"/pic_small.jpg", callback:function(res){
    //console.log(res);
    callback(res);
  }})
*/
}


function resizeBase64image(input, callback = console.log){

  //console.log("resizing");
  //let input = document.getElementById("cameraInput");

  // TO DO: update preview_photo.oldsource after upload!!!

  let canvas = document.createElement("canvas");
  let file = input.files[0];

  if (file){
    let reader = new FileReader();
    reader.onload = function(e) {
      console.log("loaded");
      //let img = document.getElementById("camera_img");
      let img = document.createElement("img");
      img.src = e.target.result;

      img.addEventListener('load', function(){
        let ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        let MAX_WIDTH = 500;
        let MAX_HEIGHT = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;canvas.height = height;
        ctx = canvas.getContext("2d");
        ctx.drawImage(img,0,0,width,height);
        let dataurl = canvas.toDataURL("image/jpeg");
        // Now post the dataurl to a server:
        //console.log(dataurl);
        callback(dataurl)
      })
    }

    reader.readAsDataURL(file);
  }


}

function toggleFullscreen()
{
  console.log(isInFullscreenMode());
  if(isInFullscreenMode())
  {
    fullscreenOFF();
  }
  else {
    fullscreenON();
  }

}

function fullscreenON() {
  let e = document.documentElement;
  if (e.requestFullscreen) {
    e.requestFullscreen();
  } else if (e.mozRequestFullScreen) { /* Firefox */
    e.mozRequestFullScreen();
  } else if (e.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
    e.webkitRequestFullscreen();
  } else if (e.msRequestFullscreen) { /* IE/Edge */
    e.msRequestFullscreen();
  }
}

function fullscreenOFF() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
}

function isInFullscreenMode()
{
  if ( window.innerHeight == screen.height )
  {
    return true
  }
  else {
    return false
  }
}
