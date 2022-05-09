function CleanText2(text)
{
    try {
        return text[0][0]["#text"];
    } catch(e){
        return text;
    }
}

function CleanText(text)
{
    try {
        return text[0]["#text"];
    } catch(e){
        return text;
    }
}

function GetElementByTagNameJS() {
    var node = arguments[0];
    var defaultValue = arguments[1];
    var tag = Array.from(arguments);
    tag.shift();
    tag.shift();

    for (var i = 0; i < tag.length; i++) {
        if (tag[i] != undefined)
        tag[i] = tag[i].toUpperCase();
    }

    const parser = new fxparser.XMLParser();
    var datajson = parser.parse(node);
    return SearchTag(datajson, defaultValue, tag, 0);
}

function GetElementsByTagNameJS() {
    var node = arguments[0];
    var defaultValue = arguments[1];
    var tag = Array.from(arguments);
    tag.shift();
    tag.shift();

    for (var i = 0; i < tag.length; i++) {
        if (tag[i] != undefined)
        tag[i] = tag[i].toUpperCase();
    }

    const optionsParser = {
        ignoreAttributes : false,
        attributeNamePrefix : "",
        allowBooleanAttributes: true,
        preserveOrder: true
        //attributesGroupName : "@_",
        //preserveOrder: true,
        //trimValues: false
    };
    const parser = new fxparser.XMLParser(optionsParser);
    var datajson = parser.parse(node);
    return SearchTags(datajson, defaultValue, tag, 0);
}

function SearchTag(data, defaultValue, tag, level)
{
    if (level == options.levelSearchTag)
    {
        return defaultValue;
    }
    var keys = Object.keys(data);
    var val = Object.values(data);
    for (var i = 0 ; i < keys.length ; i++) {
        if (isNaN(parseInt(keys[i], 10))) { //Tag is not integer : speed up parse
            for (var e = 0; e < tag.length; e++) {
                if (keys[i].toUpperCase() == tag[e]) {
                    var attrib = [];
                    var attribFound = false;
                    for (var j = 0 ; j < keys.length ; j++) {
                        if (keys[j] == ":@")
                        {
                            attrib = val[j];
                            attribFound = true;
                        }
                    }
                    var result = [val[i]];
                    if (attribFound)
                    {
                        result.push(attrib);
                    }
                    return result;
                }
            }
        }
    }
    for (var i = 0 ; i < keys.length ; i++) {
        if (val[i] != "")
        {
            var ret = SearchTag(val[i], defaultValue, tag, level + 1);
            if (ret != defaultValue)
            {
                //console.log('|SearchTag level | ', level + 1);
                return ret;
            }
        }
    }
    return defaultValue;
}

function SearchTags(data, defaultValue, tag, level)
{
    if (level == options.levelSearchTags)
    {
        return defaultValue;
    }
    if ((typeof data != "object") && (typeof data != "array"))
    {
        return defaultValue;
    }
    var result = [];
    var keys = Object.keys(data);
    var val = Object.values(data);
    var resultExist = false;
    for (var i = 0 ; i < keys.length ; i++) {
        for (var e = 0; e < tag.length; e++) {
            if (keys[i].toUpperCase() == tag[e]) {
                var attrib = [];
                var attribFound = false;
                for (var j = 0 ; j < keys.length ; j++) {
                    if (keys[j] == ":@")
                    {
                        attrib = val[j];
                        attribFound = true;
                    }
                }
                var intermediateResult = [val[i]];
                if (attribFound)
                {
                    intermediateResult.push(attrib);
                }
                result.push(intermediateResult);
                resultExist = true;
            }
        }
    }
    if (resultExist)
    {
        return result;
    }
    for (var i = 0 ; i < keys.length ; i++) {
        if ((val[i] != "") && ((typeof val[i] == "object") || (typeof val[i] == "array")))
        {
            var ret = SearchTags(val[i], defaultValue, tag, level + 1);
            if (ret != defaultValue)
            {
                //console.log('|SearchTags level | ', level + 1);
                result.push(ret);
                resultExist = true;
            }
        }
    }
    if (resultExist)
    {
        if (result.length == 1)
        {
            return result[0];
        }
        else {
            return result;
        }
    }
    return defaultValue;
}

function RemoveTag() {
    var node = arguments[0];
    var tag = Array.from(arguments);
    tag.shift();

    for (var i = 0; i < tag.length; i++) {
        if (tag[i] != undefined)
        tag[i] = tag[i].toUpperCase();
    }

    var keys = Object.keys(node);
    for (var i = 0 ; i < keys.length ; i++) {
        for (var e = 0; e < tag.length; e++) {
            if (keys[i].toUpperCase() == tag[e]) {
                delete node[keys[i]];
                return node;
            } else {
                var keysL2 = Object.keys(node[keys[i]]);
                for (var j = 0 ; j < keysL2.length ; j++) {
                    for (var f = 0; f < tag.length; f++) {
                        if (keysL2[j].toUpperCase() == tag[f]) {
                            delete node[keys[i]][keysL2[j]];
                            return node;
                        } else {
                            var keysL3 = Object.keys(node[keys[i]][keysL2[j]]);
                            for (var k = 0 ; k < keysL3.length ; k++) {
                                for (var g = 0; g < tag.length; g++) {
                                    if (keysL3[k].toUpperCase() == tag[g]) {
                                        delete node[keys[i]][keysL2[j]][keysL3[k]];
                                        return node;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return node;
}
