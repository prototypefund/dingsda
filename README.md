# dingsda

dingsda - ze internez of dings

https://www.dingsda.org

test web UI (optimized for mobile): https://www.dingsda.org/two

at the moment: invite only. Feel welcome to contact philip(_ät_)machinaex(_dot_)de to get a test account.


## API v0.1 ##

HTTP API running from node script:

 *server.js*:


**known issues**
- not propper RESTful API because commands part of JSON payload instead of url endpoint. will be changed till v1.0.0, but atm not hightest priority (sorry, noob mistake)

**dependencies:**
- nano (^7.1.0)
- https (^1.0.0)
- express (^4.16.4)
- request (^2.88.0)
- cookie-parser (^1.4.3)
- body-parser (^1.18.3)
- uuid/v5 // npm install uuid (^3.3.2)
- cors (^2.8.4)
- http-proxy (^1.17.0)

- web-push (^2.88.0)

**configuration**

configuration for server.js and pushServer_test is to be found within the config_file server_config.json

configuration for the UIs is found inside of UI/<ui number>/config_UI.json

please provide all necessary information before you start the server.

**HTTP API**

the dingsda API knows **3 different entry levels:**

1. **Instance Level** (http requests to URL instanceUrl + API_BASE_URL will be considered Instance Level and handled within server.js by the function **instanceCommander()**)
  for example: https://dingsda.org:3000/api/v1
2. **Database Level** (http requests to URL instanceUrl + API_BASE_URL + <username> will be considered DB level and handled by function **DBCommander()**)
  for example: https://dingsda.org:3000/api/v1/machinaex
3. **Ding Level** (http requests to URL instanceURL + API_BASE_URL + <username> + <item _id> will be considered dinglevel and be handled by function **dingsCommander()**)
  for example: https://dingsda.org:3000/api/v1/machinaex/29e5cf8f-a99c-571c-93ab-e24fad18d2be

requests to API need AuthSessionToken within its cookies all times except for Authentication

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

### 1. Instance Level API ###

#### GET: ####

###### Authentication: ######

parameter     | description
------------- | -------------
name          | username to authenticate with
password      | password

examples:

curl:
```bash
$ curl -X GET 'https://dingsda.org:3000/api/v1?name=jan&password=demopassword'
```

client js/jquery:
```js
var settings = {
  "url": "https://dingsda.org:3000/api/v1?name=jan&password=demopassword",
  "method": "GET",
  "headers": {
    "Content-Type": "application/json",
    "cache-control": "no-cache",
  },
  "data": ""
}

$.ajax(settings).done(function (response) {
  console.log(response);
});
```

python:
```python
import requests

url = "https://dingsda.org:3000/api/v1"

querystring = {"name":"jan","password":"demopassword"}

payload = ""
headers = {
    'Content-Type': "application/json",
    'cache-control': "no-cache"
    }

response = requests.request("GET", url, data=payload, headers=headers, params=querystring)

print(response.text)
```
--------------------------------

#### POST: ####

###### SEARCH: ######
(CURRENTLY BROKEN AND NOT USED. SEE dingslevel/findItems)

```json
{
  "type":"search",
  "doc": {...}
}
```

examples:
(...)

--------------------------------

### 2. Database Level API ###

#### GET: ####

###### DB Infos: ######

*returns:*  CouchDB Infos about DB.

*note:* for testing. probably to be deprecated later.

--------------------------------

#### POST: ####
--------------------------------
###### ADD ITEMS ######

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

**behaviour:**

--------------------------------
###### UPDATE ITEMS ######

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

**behaviour:**

updates item handed over in doc. needs to provide the most recent

--------------------------------
###### DELETE ITEMS ######

*json*:

```json
"data":[
  {
    "type":"deleteItems",
    "doc": {<doc to be deleted>}
  }
]
```

parameter     | description
------------- | -------------
doc           | doc to be deleted, including recent _rev(!)

**behaviour:**

--------------------------------
###### FIND ITEMS ######

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

**behaviour:**
 Will search Database for documents matching the searchterm(s) specified in json-field data.doc

This API will only simplify all requests to use either "$regex":"(?i)" or "$in": in front of the searchValue. So: Search for searchValue will be successfull if searchValue is in any way included (within array or as substring) inside doc.

Also: in order to keep the API flat, it uses a dot notation (parent.child) for requests deeper down the object tree (e.g. parent.child:"hans" instead of parent:{child:"hans"}) (also: s.example below)

If you want to search more DBs at once and/or make real [mango queries] (https://github.com/cloudant/mango) to dingsda, use the search API endpoint on instance Level.

The query response result is limited to a maximum of 50 found items.
The **optional bookmark** field can be added to follow up query in order to get the next 50 items returned. (see [couchDBs find()](https://docs.couchdb.org/en/stable/api/database/find.html?highlight=bookmark) API for more details on bookmarks behaviour)

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
    "owner":["e8edb946-3df0-57fd-afd7-07b5a7ac4d0d","77827d81-b80d-543f-967d-c81be310c999"],
    "other":{}
}
```
