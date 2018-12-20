

/*
this is a designdoc for CouchDB. At the moment it is in the form required by
the npm package "couchapp" that helps uploading them with more ease to a CouchDB
if you want to use it normally, you only need the function validate_doc_update
and parse it as a JSON. That can be then uploaded to couchDB directly.
so var couchapp; path, ddoc and the module exports are not needed for that. nor
the packaging of validate_doc_update into the ddoc
*/

var couchapp = require('couchapp')
    , path = require('path');

  ddoc = {
      _id: '_design/app'
    , views: {}
    , lists: {}
    , shows: {}
  }

  module.exports = ddoc;


ddoc.validate_doc_update = function (newDoc, oldDoc, userCtx, secObj) {
  // to be part of EVERY dingsder user DB!!!
  // controls updates via _security doc .friends in DB

    // can i control the edits of _security also?

    var isAdmin = userCtx.roles.indexOf('_admin') > -1;
    var isDBadmin = secObj.admins.names.indexOf(userCtx.name) > -1;


    if (oldDoc && oldDoc.owners)
    {
        var isOwner = oldDoc.owners.indexOf(userCtx.name) > -1;
    }

    function isMover()
    {
        if (secObj.friends)
        {
            return secObj.friends[userCtx.name].indexOf("movers") > -1;
        }
        else
        {
            return false
        }
    }

      function isEditor()
    {
        if (secObj.friends)
        {
            return secObj.friends[userCtx.name].indexOf("editors") > -1;
        }
        else
        {
            return false
        }
    }

    function deepEqual(a, b) {
      if (a === b) return true;

      if (a == null || typeof a != "object" ||
          b == null || typeof b != "object")
        return false;

      var propsInA = 0, propsInB = 0;

      for (var prop in a)
        propsInA += 1;

      for (var prop in b) {
        propsInB += 1;
        if (!(prop in a) || !deepEqual(a[prop], b[prop]))
          return false;
      }

      return propsInA == propsInB;
    }

    function isEmpty(o){
        for(var i in o){
            if(o.hasOwnProperty(i)){
                return false;
            }
        }
        return true;
    }


// forbidden: owner,id,name,permissions,id,name,price

    // security roles
    var roles = {
        "editors":{"allowed":["*"],"forbidden":["owners","id","name","permissions"]},
        "movers":{"allowed":["location"],"forbidden":["*"]}
    };

    function checkIfUserisAllowed(key)
    {
        /*
        if more than one group is listed inside friends[userCtx.name]
        we have to check how the permissions merge and before checking if user
        is permitted to do what they intend.
        see branch "moreThan2securityRoles" for a half baked version of that.
        Here now: handcoded only for editors and movers.
        */

        var permission = undefined;

        /* only one of two roles is relevant! if more than 1 role in
        friends.username, choose between movers or editors: */
        if (isEditor())
        {permission = roles.editors}
        else if (isMover())
        {
          permission = roles.movers;
        }
        else {
          permission = undefined;
        }

        //throw({forbidden: userRoles.toString()});

        if ( permission !== undefined)
        {

            if (permission.forbidden.indexOf(key) !== -1) // if listed as forbidden
            {
              // HERE MISSING: Way to or allow subparameters inside of .other
                throw({forbidden: 'you are explicitly forbidden to change '+ key + " : "+permission.forbidden});
            }
            else if (permission.allowed.indexOf(key) !== -1 || permission.allowed.indexOf("*") !== -1)
            {
                //throw({forbidden: 'you are explicitly allowed '+ permission.allowed + " and forbidden "+permission.forbidden+ " AND tried to change "+key});
            }
            else
            {
                throw({forbidden: 'you are forbidden '+ permission.forbidden +" and not explicitly allowed "+ key + " but only "+ permission.allowed});
            }

        }
        else
        {
            throw({forbidden: 'you don\'t exist'});
        }

        //throw({forbidden: 'just testing '+ secObj.friends[userCtx.name] + ": forbidden: " + permission.forbidden +" allowed: "+permission.allowed});
    }

    ///// MAIN //////////////
    if (!isAdmin && !isDBadmin)
    {
        // check all things that are for everybody who is not the admin:

        if (!newDoc.name) {
            throw({forbidden: 'doc.name is required'});
        }

        if (!newDoc.location) {
            throw({forbidden: 'doc.location is required'});
        }

        if (!newDoc.owners) {
            throw({forbidden: 'doc.owners is required '});
        }

        if (!newDoc.other) {
            throw({forbidden: 'doc.other is  required and needs to be an object'});
        }

        ////////////////////////////////////////////////////////////////

        if (!isOwner)
        {
            //throw({forbidden: "is not Owner"});
            // check stuff that is the case if not the Owner
            // var changes = [];
            for (var key in oldDoc)
            {
                // skip loop if the property is from prototype
                if (!oldDoc.hasOwnProperty(key)) continue;

                var obj = oldDoc[key];

                for (var prop in obj) {
                    // skip loop if the property is from prototype
                    if(!obj.hasOwnProperty(prop)) continue;

                    var equal;

                    if (typeof(oldDoc[key]) === "object")
                    {
                        equal = deepEqual(newDoc[key],oldDoc[key]);
                    }
                    else
                    {
                        equal = newDoc[key] === oldDoc[key]
                    }

                    if (!equal && key != "_revisions")
                    {
                        //throw({forbidden: key + " has changed from " + oldDoc[key] + " to "+ newDoc[key] + " deepequal: "+ equal});
                        //changes.push(key)
                        // check if USER is allowed to update these fields:
                        checkIfUserisAllowed(key);
                    }
                    else {

                    }
                }
            }

            //throw({forbidden:changes})
            /////////////////////////////////////////////////
        }
        else
        {
            //throw({forbidden: "is Owner"});
            // do whatever only the Owner but not the Admin does
        }

    }
    else
    {
      //throw({forbidden: "is admin"});
      //else do whatever only the admin can do
    }


}
