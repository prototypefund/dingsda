
var keys =
{
	"https://api.upcitemdb.com/prod/trial/lookup": undefined,
	"https://www.upcdatabase.com/xmlrpc":"3af1f7c10bc7f6a05d28faf2427a34f9edc1e2bf",
	"https://api.upcdatabase.org/json/":"dd2309e67e4fe32964f63fc55f920bd7",
	"https://opengtindb.org/":null,
	"https://openlibrary.org/api/books?bibkeys=ISBN:{{ean}}&format=json":undefined,
};


function jsonCallback(json){
  console.log(json);
}
/*
$.ajax({
  //url: "https://api.upcitemdb.com/prod/trial/lookup?upc=9781848315891",
	url: "https://api.upcitemdb.com/prod/trial/lookup",
	method: "POST",
	body: '{"upc":"9781848315891"}',
	crossDomain: true,
	beforeSend: function(xhr){
                xhr.withCredentials = true;
          },
	dataType: "json",
  dataType: "application/json"

});
*/

function httpGetAsync(theUrl, callback)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            callback(xmlHttp.responseText);
    }
    xmlHttp.open("GET", theUrl, true); // true for asynchronous
    xmlHttp.send(null);
}

function dispatchEvent(urlin, resp, idin=undefined)
{
	console.log("dispatching event");
	

	var event = new CustomEvent(
		"barcodeAPIresponseReceived",
		{
			detail: {
				url: urlin,
				message: resp,
				time: new Date(),
				id: idin,
			},
			bubbles: true,
			cancelable: true
		});
	document.dispatchEvent(event);
}
/* //this can be used outside of this script to listen to the events dispatched above
document.addEventListener("barcodeAPIresponseReceived", barcodeAPIresponseReceivedHandler, false);

function barcodeAPIresponseReceivedHandler(e)
{
	console.log(e.detail);
	if (e.detail.id != undefined)
	{
		document.getElementById(e.detail.id).innerHTML = e.detail.message;
	}

}
*/

function getOpenLibraryOrg(barcode)
{

	httpGetAsync(`https://openlibrary.org/api/books?bibkeys=ISBN:${barcode}&format=json&jscmd=details`,
		function(resp)
		{
			try{
				console.log(resp) 
				resp = JSON.parse(resp);
				resp = resp["ISBN:"+barcode]
				dispatchEvent(`https://openlibrary.org/api/books?bibkeys=ISBN:${barcode}&format=json&jscmd=details`,resp,"openlibrary"); 
			}
			catch(err){
				console.log("could not parse response:",err)
			} 
		}
	);
}

function getUpcitemdb_com(barcode)
{
	//alert("inside UPCitemDB_com")
	httpGetAsync("https://api.upcitemdb.com/prod/trial/lookup?upc="+barcode,
		function(resp)
		{
			//alert("got response!"+resp) 
			dispatchEvent("https://api.upcitemdb.com/prod/trial/lookup?upc=",resp,"upcitemdb"); 
		}
	);
}


function getUpcdatabase_org(key, barcode)
{
	httpGetAsync("https://api.upcdatabase.org/json/"+key+"/"+barcode,function(resp)
		{ dispatchEvent("https://api.upcdatabase.org/json/",resp,"org"); }
	);
}


function getUpcdatabase_com(key, barcode)
{
	$.xmlrpc({
		url: 'https://www.upcdatabase.com/xmlrpc',
		methodName: 'lookup',
		params: [{rpc_key: key, ean: barcode}],
		success: function(response, status, jqXHR)
		{
			dispatchEvent("https://www.upcdatabase.com/xmlrpc",JSON.stringify(response[0]),"com");
		},
		error: function(jqXHR, status, error)
		{ /* ... */ }
	});

}


///////// extras >



function getName(obj)
{
	obj = obj.detail;

	var name = undefined;

	if (obj.id == "upcitemdb")
	{
		name = JSON.parse(obj.message);
		if (name.items[0] != undefined)
		{name = (name.items[0].title);}
		else
		{name = undefined}

	}
	if (obj.id == "org")
	{
		name = JSON.parse(obj.message).itemname;
		//console.log(name);
	}
	if (obj.id == "com")
	{
		name = JSON.parse(obj.message).description;
	}

	return name;
}


function getPictures(obj)
{}

function getWeight(obj)
{}

function getPrice(obj)
{}


///////// < extras


//////////////////////////////////////////////////////////////
////////////////////// MAIN //////////////////////////////////

//getUpcitemdb_com("0041196891492");

//getUpcdatabase_org(keys["https://api.upcdatabase.org/json/"],"0041196891492");

//getUpcdatabase_com(keys["https://www.upcdatabase.com/xmlrpc"],"0041196891492");

///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
