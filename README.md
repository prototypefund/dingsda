# dingsda #

dingsda - ze internez of dings

https://www.dingsda.org

test web UI (optimized for mobile): https://www.dingsda.org/two

at the moment: invite only. Feel welcome to contact philip(_ät_)machinaex(_dot_)de to get a test account.

## documentation ##

function documentation (so far only of server.js not yet from the clients) can
be found at https://dingsda.org/docs/

visual schematic documentation of the client - server - database flows and (later)
the livecycle of an HTTP request against the dingsda API can be found further down at [schemata](#markdown-header-schemata)

## API v0.1 (server.js) ##

HTTP API running from node script:

 *server.js*:

the list of API endpoints and functions is found below at: [HTTP API REFERENCE](#markdown-header-http-api-reference)

**known issues**
- not proper RESTful API because commands part of JSON payload instead of url endpoint. will be changed till v1.0.0, but atm not hightest priority (sorry, noob mistake)

**dependencies:**
- [nano (^7.1.0)](https://github.com/apache/couchdb-nano)
- [https (^1.0.0)](https://www.npmjs.com/package/https)
- [express (^4.16.4)](https://github.com/expressjs/express)
- [request (^2.88.0)](https://github.com/request/request)
- [cookie-parser (^1.4.3)](https://github.com/expressjs/cookie-parser)
- [body-parser (^1.18.3)](https://github.com/expressjs/body-parser)
- [uuid/v5 (^3.3.2)](https://github.com/kelektiv/node-uuid)
- [cors (^2.8.4)](https://github.com/expressjs/cors)
- [http-proxy (^1.17.0)](https://github.com/nodejitsu/node-http-proxy)
- [deepcopy ^1.0.0](https://github.com/sasaplus1/deepcopy.js)

- [web-push (^2.88.0)](https://github.com/web-push-libs/web-push) (not yet implemented but used in pushServer_test)

**configuration**

configuration for server.js and pushServer_test is to be found within the config_file server_config.json

configuration for the UIs is found inside of UI/<ui number>/config_UI.json

make sure to provide all necessary information before you start the server.

**HTTP API GENERAL STRUCTURE**

the dingsda API knows **3 different entry levels / URL endpoints:**

1. **Instance Level** (http requests to URL instanceUrl + API_BASE_URL will be considered Instance Level and handled within server.js by the function **[instanceCommander()](https://dingsda.org/docs/global.html#instanceCommander)**)

  for example: https://dingsda.org:3000/api/v1
This level is mainly to manage user Authentication, login, subscriptions etc

2. **Database Level** (http requests to URL instanceUrl + API_BASE_URL + *username* will be considered DB level and handled by function **[DBCommander()](https://dingsda.org/docs/global.html#DBCommander)**)

  for example: https://dingsda.org:3000/api/v1/machinaex
This level is the server endpoint users will interact the most with, as it represents the user's
database and handles all requests that do concern more than one item. This also means: It will only be
relevant for the user owning the DB addressed

3. **Ding Level** (http requests to URL instanceURL + API_BASE_URL + <username> + <item _id> will be considered dinglevel and be handled by function **[dingsCommander()](https://dingsda.org/docs/global.html#dingsCommander)**)

  for example: https://dingsda.org:3000/api/v1/machinaex/29e5cf8f-a99c-571c-93ab-e24fad18d2be
This level is only handling requests that aim for single items in a database. It usually concerns owners
of the item and people who the item is shared with or anyone who is allowed to read the items info (e.g.
if it is set to be publicly visible)

requests to API need AuthSessionToken within its cookies all times except for Authentication.

Important: **All POST API endpoints** MUST be **JSON formatted** and follow this
basic form:

```json
{
  "data":[
    {
  	"type":"<name of command type>",
  	"<other fields>": {}
    }
  ]
}
```

**HTTP API REFERENCE**
<div id="markdown-header-http-api-reference">

#### Authentication: ####

*endpoint:*
`/api/v1/`

*GET:*

parameter     | description
------------- | -------------
name          | username to authenticate with
password      | password

see: [verifyUserCredibility()](https://dingsda.org/docs/global.html#verifyUserCredibility)

**behavior:**

verifies user Auth by testing for username and password inside of request query parameter.

username and password can be query parameters or in json format inside of a query parameter calles json.

e.g.:

`https://xxx.xxx/yyy?username=aaa&password=bbb` or

`https://xxx.xxx/yyy?json='{"username":"aaa","password":"bbb"}'`

response: AuthSessionCookie that can and will be saved by the browser

examples:

curl:
```bash
$ curl -X GET 'https://dingsda.org:3000/api/v1?name=jan&password=demopassword'
```

--------------------------------

###### ADD ITEMS ######

*endpoint:*
`/api/v1/< databasename >`

*POST:*

*json*:

```json
"data":[
  {
    "type":"addItems",
    "doc": {<doc to be added>}
  }
]
```

parameter     | description
------------- | -------------
doc           | doc to be added.


see: [addItem()](https://dingsda.org/docs/global.html#addItem)


**behavior:**

adds item described fully in .doc to database defined by url endpoint

--------------------------------
###### UPDATE ITEMS ######

*endpoint:*
`/api/v1/< databasename >`

*POST:*

*json*:

```json
"data":[
  {
    "type":"updateItems",
    "doc": {<doc to be updated>}
  }
]
```

parameter     | description
------------- | -------------
doc           | doc to be updated, including recent _rev(!)

see: [update()](https://dingsda.org/docs/global.html#update)

**behavior:**

updates item handed over in doc. needs to provide the most recent

--------------------------------
###### DELETE ITEMS ######

*endpoint:*
`/api/v1/< databasename >`

*POST:*

*json*:

```json
"data":[
  {
    "type":"deleteItems",
    "doc": {<doc to be deleted; needs at least fields _id and _rev>}
  }
]
```

parameter     | description
------------- | -------------
doc           | doc to be deleted, including recent _rev(!)

see: [deleteItems()](https://dingsda.org/docs/global.html#deleteItems)

**behavior:**

deletes the item specified in json from the database specified in url if user has write permissions for database

--------------------------------

###### GET SINGLE ITEM / GET THING ######

*endpoint:*
`/api/v1/< databasename >/< thing _id >`

*GET*


see: [getSingleItem()](https://dingsda.org/docs/global.html#getSingleItem)


**behavior:**

returns complete JSON of a single thing including all fields and a reference to possible. This is the most important API endpoint to get a single things from dingsda. Usually used after a search or find request

--------------------------------

###### ANNOUNCE HANDOVER OF ITEM TO ANOTHER USER ( LENT OUT / RETURN) ######

*endpoint:*
`/api/v1/< databasename >/< thing _id >`

*POST*

**json**:

```json
{
	"data":
	[{
		"type":"handover_announce",
		"username":<username>
	}]
}
```

parameter     | description
------------- | -------------
username      | name of user the thing should be handed over to

see: [handover_announce()](https://dingsda.org/docs/global.html#handover_announce)


**behavior:**
Sends a handover announcement to the server. this will write a notification to
the user the item was handed over to as well as a notification into the users own database.

Both notifications contain the references to this transaction that can be used to
either accept the handover or deny the handover (only user receiving the item can do that)
or to cancel the transaction (only the user lending out the item can do that).

To accept the handover, the alleged borrower needs to send a "handover_confirm" to their own
the server endpoint.

To deny the handover, the alleged borrower needs to send a "handover_deny" to their own
server endpoint.

To cancel the handover, the user lending out the item needs to send a "handover_cancel"
to their own server endpoint.

--------------------------------

###### CONFIRM HANDOVER ######

*endpoint:*
`/api/v1/< databasename >`

*POST*

**json**:

```json
{
  "data":
        [{
          "type":"handover",
          "ref":< notification.ref from handover await notification >,
          "from":< username of user lending out the item >
        }]
}
```

parameter     | description
------------- | -------------
username      | name of user the thing should be handed over to
ref           | _id of the item handed over
from          | name of user lending out the item to user sending this request

see: [handover()](https://dingsda.org/docs/global.html#handover)


**behavior:**

confirms a pending handover of thing with _id specified in .ref. the lender,
identified by .from, must have already announced an items handover via handover_announce API (see above).

After this action will grant the user confirming limited write permission and full read permissions for the item (they will be able to change the items location only) (unless the owner of the item cancelled the handover in between).

The user borrowing the item will be noted inside of the items document .inPossessionOf field and a reference to the item will be placed into the users -inMyPossession database.

The pending handover notifications will be deleted from both participants -notifications DBs.

--------------------------------

###### DENY HANDOVER ######

*endpoint:*
`/api/v1/< databasename >`

*POST*

**json**:

```json
{
  "data":
        [{
          "type":"handover_deny",
          "ref":< notification.ref from handover await notification >,
          "from":< username of user lending out the item >
        }]
}
```

parameter     | description
------------- | -------------
username      | name of user the thing should be handed over to
ref           | _id of the item handed over
from          | name of user lending out the item to user sending this request

see: [handover_deny()](https://dingsda.org/docs/global.html#handover_deny)


**behavior:**

denies a pending handover of thing with _id specified in .ref. the lender,
identified by .from, must have already announced an items handover via handover_announce API (see above).

After this an info notification about the denial will be placed in the things owner db and the pending handover notifications will be deleted from both participants -notifications DBs

--------------------------------

###### CANCEL HANDOVER ######

*endpoint:*
`/api/v1/< databasename >`

*POST*

**json**:

```json
{
  "data":
        [{
          "type":"handover_cancel",
          "ref":< notification.ref from handover await notification >,
          "from":< username of user lending out the item >
        }]
}
```

parameter     | description
------------- | -------------
username      | name of user the thing should be handed over to
ref           | _id of the item handed over
from          | name of user lending out the item to user sending this request

see: [handover_deny()](https://dingsda.org/docs/global.html#handover_deny)


**behavior:**

cancels a pending handover of thing with _id specified in .ref.

the lender,identified by .from, must have already announced an items handover via handover_announce API (see above). cancelling can only be done by the borrower of a pending handover.

The pending handover notifications will be deleted from both participants -notifications DBs

--------------------------------

###### SEARCH: ######

*endpoint:*
`/api/v1/`

*POST:*

parameter     | description
------------- | -------------
db            | name of database to perform search in
doc           | couchDB mango query (see: [mango queries] (https://github.com/cloudant/mango) )
bookmark      | (OPTIONAL) bookmark string from last result.

**behavior:**

performs a search against db using real [mango queries] (https://github.com/cloudant/mango).

The query response result is limited to a maximum of 50 found items.
The **optional bookmark** field can be added to follow up query in order to get the next 50 items returned. (see [couchDBs find()](https://docs.couchdb.org/en/stable/api/database/find.html?highlight=bookmark) API for more details on bookmarks behavior)

**returns:** JSON with array .docs containing all items found:

JSON formatted list of objects matching the searchQuery, but only contains the following fields:

"_id","name","location","other","owners","hyperlink","inPossessionOf".

For more Information about the objects, a FETCH against dings level endpoint (/api/v1/<db>/) is recommended

and .bookmark containing reference
to next 50 items found by this search.

**note:** planned but not yet implemented: db parameter optional array of strings or string (atm only possiblity)

in order to search several databases at once and get a combined response.

if you need to do a more simplistic search you can also use [search()](https://dingsda.org/docs/global.html#find)


*json*:

```json
{
	"data":[{
		"type":"search",
		"db":"public",
		"doc": { < couchDB Mango Search Query > },
    "bookmark": <bookmark string (OPTIONAL)>
	}]
}
```

see: [search()](https://dingsda.org/docs/global.html#search)

examples:

curl:
```bash
curl -X POST \
  https://dingsda.org:3000/api/v1/ \
  -H 'Content-Type: application/json' \
  -d '{
	"data":[{
		"type":"search",
		"db":"machinaex",
		"doc": {
        "_id": {
           "$not": {
              "$regex": "-containerOf"
           }
        },
        "$and": [
           {
              "_id":{
                  "$not": {
                     "$regex": "&|config_one"
                  }
                }
           },
           {
           	"name":{
           		"$regex":"studio monitor"

           	}
           }
        ]
     }
	}]
}'
```
--------------------------------

###### GET DB Infos: ######

*endpoint:*
`/api/v1/< databasename >`

*GET:*

**returns:**  CouchDB Infos about DB.

**note:** for testing. probably to be deprecated later.

--------------------------------

###### FIND ITEMS ######

*endpoint:*
`/api/v1/< databasename >`

*POST:*

*json*:

```json
"data":[
  {
    "type":"findItems",
    "doc":<mango style searchTerm>
  }
]
```

parameter     | description
------------- | -------------
doc           | searchQuery: object w/ ```{ key : searchvalue }```
bookmark      | (OPTIONAL) bookmark string from last result.

see: [findItems()](https://dingsda.org/docs/global.html#findItems)

**behavior:**
 Will search Database for documents matching the searchterm(s) specified in json-field data.doc

This API will only simplify all requests to use either "$regex":"(?i)" or "$in": in front of the searchValue. So: Search for searchValue will be successfull if searchValue is in any way included (within array or as substring) inside doc.

Note: in order to keep the API flat, it uses a dot notation (parent.child) for requests deeper down the object tree (e.g. parent.child:"hans" instead of parent:{child:"hans"}) (also: s.example below)

If you want to search more DBs at once and/or make real [mango queries] (https://github.com/cloudant/mango) to dingsda, use the search API endpoint on instance Level.

The query response result is limited to a maximum of 50 found items.
The **optional bookmark** field can be added to follow up query in order to get the next 50 items returned. (see [couchDBs find()](https://docs.couchdb.org/en/stable/api/database/find.html?highlight=bookmark) API for more details on bookmarks behavior)

**returns:**
JSON formatted list of objects matching the searchQuery, but only contains the following fields: "_id","name","location","other","owners","hyperlink","inPossessionOf". For more Information about the objects, a FETCH on Dings level is recommended

examples:

client js/jquery:
```js
var data =
{
	"data":
	[{
		"type":"findItems",
		"doc":{
				 "location.address": "India"
			}
	}]
}

var settings = {
  "url": "https://dingsda.org:3000/api/v1/jan",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "data": JSON.stringify(data)
}

$.ajax(settings).done(function (response) {
  console.log(response);
});
```
--->
```json
{
    "docs": [
        {
            "_id": "1e862072-b279-5b84-b0ed-98eca77e21db",
            "name": "Samsonite Rollkoffer carry-on",
            "location": {
                "address": "jogishvari, Jogeshwari Road, Chamunda Colony, Amraiwadi, Ahmedabad, Gujarat 380026, India",
                "latitude": "22.258652",
                "longitude": "71.19238050000001"
            },
            "other": {
                "tags": [
                    "Tools",
                    "Travel",
                    "Reise"
                ],
                "visibility": [
                    "public"
                ],
                "description": "2 compartments",
                "borrowable": "not"
            },
            "owners": [
                "jan"
            ],
            "hyperlink": "https://dingsda.org:3000/api/v1/jan/1e862072-b279-5b84-b0ed-98eca77e21db"
        }
    ],
    "bookmark": "g1AAAAB4eJzLYWBgYMpgSmHgKy5JLCrJTq2MT8lPzkzJBYqrGKZamBkZmBvpJhmZW-qaJlmY6CYZpKboWlqkJieam6caGaYkgfRywPQSrSsLAGuGH_M"
}

```

--------------------------------

--------------------------------


## UI v0.2 (UI/two) ##

the UI uses jquerymobile as it's main framework and has several dependencies.

the UI is a webpage, optimized for mobile use, designed to work as well as a fullscreen WebApp/PWA.

it also provides a (not finished but sorta working) table/spreadsheet view that is intended to be used mainly on a desktop computer, but works partially as well mobile.

an active demo UI can be found at https://www.dingsda.org/two

screenshots and usage videos can be found at https://www.dingsda.org


the complete UI code can be found within
- UI/two/index.html

using the folders
- UI/two/assets
- UI/two/css
- UI/two/icons (partially used from the https://thenounproject.com please check licence note)
- UI/two/manifest.json (if used as ProgressiveWebApp)


in case you want to modify/contribute:

index.html is rendered with mustache (https://github.com/janl/mustache.js/) using the following files

- UI/two/base.html
- UI/two/partials/*
- UI/two/config_UI.json

if you work on macOS, you can install fswatch (https://github.com/emcrisostomo/fswatch) and then use the helper bash script UI/two/renderOnChange.sh to render everytime a change happens within any of the partials.

otherwise just install mustache.js and render from commandline with command:
```bash
mustache config_UI.json base.html index.html
```

#### dependencies: ####
(atm all found within assets, but after refactoring will need install via npm or manual download)

basic dependencies for the UI webapp:

- jquery ^2.2.4 (https://jquery.com/)
- jquery mobile 1.4.5 (https://jquerymobile.com/)
- bootstrap-tagsinput (https://github.com/bootstrap-tagsinput/bootstrap-tagsinput)
- dotize.js (https://github.com/vardars/dotize) (atm only version from UI/two/assets/dotize.js for it needed modification for dingsda. but dotizes author is already working on compatible version. see: https://github.com/vardars/dotize/issues/12 wishlist number 3.))
- easy-autocomplete (https://github.com/pawelczak/EasyAutocomplete)
- sweetalert2 (https://github.com/sweetalert2/sweetalert2/)
- lazyload jquery 2.0.0 (https://github.com/tuupola/jquery_lazyload)

for spreadsheet view with editable table:

- handsontable community edition (https://github.com/handsontable/handsontable)

for barcode/QRcode reader in browser:

- quaggaJS (https://github.com/serratus/quaggaJS)
- webrtc-adapter (https://github.com/webrtc/adapter)
- zxing-js (https://github.com/zxing-js/library)

for carnet A.T.A. custom form export functions:

- carnet.js (UI/two/assets/carnet.js)
- SheetJS (https://github.com/SheetJS/js-xlsx)
- jsPDF(https://github.com/MrRio/jsPDF)

for the google maps plugin:

- jquery locationpicker (https://github.com/Logicify/jquery-locationpicker-plugin)
- a googlemapsAPIkey (how to get one, see: https://developers.google.com/maps/documentation/javascript/get-api-key)

--------------------------------

--------------------------------


<div id="markdown-header-schemata">
## schemata ##

you find different visual documentations of the data flow and the client - server / database
architecture of dingsda inside of /img

chema client-server-db:
[schema client-server-db](https://drive.google.com/file/d/1pW1QeY8gtDGYSdhEBgnbmq6uOhYu_GGk/view?usp=sharing)

templating flow and dependencies of client two:
[templating flow and dependencies of client two](https://drive.google.com/file/d/1Hj3rqdFng-oMDaZI2GvwObD1AM_WW8K2/view?usp=sharing)


--------------------------------

--------------------------------

### json schema (work in progress NOT UP TO DATE!!!) ###

explanation needed for:
  - location either string (then: constraint free because only for humans anyhow)
   or object (than one of two constraints) are valid and force longitude and latitude via pattern
   or the field "inside_id" to mark in which other item it can be found
  - other contains everything that is not absolutely needed for the simplest bare bone item (that includes: barcodes, prices, sizes, availablity etc.)

```json
{
  "$id": "https://dingsda.org/api/v1/item.json",
  "description": "Schema for an item within dingsda.org DB. Describes a thing in as minimal terms as possible",
  "definitions": {
    "location": {
      "type": "object",
      "description": "minimal requirements for a location object.",
      "properties": {
        "name": {
          "type": "string"
        },
        "address": {
          "type": "string"
        },
        "longitude": {
          "type": "string",
          "pattern": "^(\\+|-)?(?:180(?:(?:\\.0{1,6})?)|(?:[0-9]|[1-9][0-9]|1[0-7][0-9])(?:(?:\\.[0-9]{1,6})?))$"
        },
        "latitude": {
          "type": "string",
          "pattern": "^(\\+|-)?(?:90(?:(?:\\.0{1,6})?)|(?:[0-9]|[1-8][0-9])(?:(?:\\.[0-9]{1,6})?))$"
        },
        "insideOf": {
          "type": "string"
        },
      },
      "required": [
        "name",
        "longitude",
        "latitude"
      ]
    }
  },
  "type": "object",
  "properties": {
    "_id": {
      "type": "string",
      "description": "unique ID to identify item."
    },
    "name": {
      "type": "string",
      "description": "human readable name"
    },
    "location": {
      "type": [
        "string",
        "object"
      ],
      "oneOf": [
        {
          "$ref": "#/definitions/location"
        },
        {
          "$ref": "#/definitions/obj_in_obj"
        },
        {
          "type": "string"
        }
      ],
      "description": "physical location of the object at the moment. either string describing location or object following location definition."
    },
    "owners": {
      "type": [
        "string",
        "array"
      ]
    },
    "other": {
      "$id": "/properties/other",
      "type": "object",
      "properties": {
        "price": {
          "$id": "/properties/other/properties/price",
          "type": "string",
          "title": "The Price Schema "
        },
        "visibility": {
          "$id": "/properties/other/properties/visibility",
          "type": [
            "string",
            "array"
          ]
          "title": "Read Rights for this item",
          "description": "needs to be either keywords 'private', 'public' or an Array of groups listed in _security of owners DB"
        }
      }
    }
  },
  "required": [
    "_id",
    "name",
    "location",
    "owners"
  ]
}
```

this simple example would pass validation:

```json
{
	"_id":"1",
    "name":"eins",
	"location":{"name":"berlin","longitude":"52.51704","latitude":"13.38792"},
    "owner":["machinaex"],
    "other":{}
}
```
