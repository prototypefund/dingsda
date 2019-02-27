// Convert complex js object to dot notation js object
// url: https://github.com/vardars/dotize
// author: vardars license: MIT

// edited by dingsda to exclude Arrays from dotizing.
var dotize = dotize || {};

dotize.convert = function(obj, prefix) {
    var newObj = {};

    if ((!obj || typeof obj != "object") && !Array.isArray(obj)) {
        if (prefix) {
            newObj[prefix] = obj;
            return newObj;
        } else {
            return obj;
        }
    }

    function isNumber(f) {
        return !isNaN(parseInt(f));
    }

    function isEmptyObj(obj) {
        for (var prop in obj) {
            if (Object.hasOwnProperty.call(obj, prop))
                return false;
        }
    }

    function getFieldName(field, prefix, isRoot, isArrayItem, isArray) {
        if (isArray)
// EDIT by dingsda to exclude arrays
          //return (prefix ? prefix : "");
            return (prefix ? prefix : "") + (isNumber(field) ? "[" + field + "]" : (isRoot ? "" : ".") + field);
// EDIT by dingsda to exclude arrays
        else if (isArrayItem)
// EDIT by dingsda to exclude arrays
            return (prefix ? prefix : "")
          //  return (prefix ? prefix : "") + "[" + field + "]";
// EDIT by dingsda to exclude arrays
        else
            return (prefix ? prefix + "." : "") + field;
    }

    return function recurse(o, p, isRoot) {
        var isArrayItem = Array.isArray(o);
        for (var f in o) {
            var currentProp = o[f];
            if (currentProp && typeof currentProp === "object") {
                if (Array.isArray(currentProp)) {
// EDIT by dingsda to exclude arrays
                  //  console.log(currentProp);
                    newObj = recurse(currentProp, getFieldName(f, p, isRoot, false, true), isArrayItem); // array
                    //newObj = o;
// EDIT by dingsda to exclude arrays
                } else {
                    if (isArrayItem && isEmptyObj(currentProp) == false) {
                        newObj = recurse(currentProp, getFieldName(f, p, isRoot, true)); // array item object
                    } else if (isEmptyObj(currentProp) == false) {
                        newObj = recurse(currentProp, getFieldName(f, p, isRoot)); // object
                    } else {
                        //
                    }
                }
            } else {
                if (isArrayItem || isNumber(f)) {
// EDIT by dingsda to exclude arrays
                  newObj[getFieldName(f, p, isRoot, true)] = o; // array item primitive
                  //newObj[getFieldName(f, p, isRoot, true)] = currentProp; // array item primitive
// EDIT by dingsda to exclude arrays
                } else {
                    newObj[getFieldName(f, p, isRoot)] = currentProp; // primitive
                }
            }
        }

        return newObj;
    }(obj, prefix, true);
};

if (typeof module != "undefined") {
    module.exports = dotize;
}
