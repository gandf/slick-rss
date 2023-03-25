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

function DefaultText2(text) {
    return {0: {0: {"#text": text}}};
}

function GetElementByTagNameJS() {
    let node = arguments[0];
    let defaultValue = arguments[1];
    let multiplesElements = arguments[2];
    let tag = Array.from(arguments);
    tag.shift();
    tag.shift();
    tag.shift();

    for (let i = 0; i < tag.length; i++) {
        if (tag[i] != undefined)
            tag[i] = tag[i].toUpperCase();
    }

    try {
        if (!multiplesElements) {
            const parser = new XMLParser();
            let datajson = parser.parse(node);
            return SearchTag(datajson, defaultValue, tag, 0);
        }
        else {
            const optionsParser = {
                ignoreAttributes : false,
                attributeNamePrefix : "",
                allowBooleanAttributes: true,
                preserveOrder: true
                //attributesGroupName : "@_",
                //preserveOrder: true,
                //trimValues: false
            };
            const parser = new XMLParser(optionsParser);
            let datajson = parser.parse(node);
            return SearchTags(datajson, defaultValue, tag, 0);
        }
    }
    catch (e) {
        return defaultValue;
    }
}

function SearchTag(data, defaultValue, tag, level)
{
    if (level == options.levelSearchTag)
    {
        return defaultValue;
    }
    let keys = Object.keys(data);
    let val = Object.values(data);
    for (let i = 0 ; i < keys.length ; i++) {
        if (isNaN(parseInt(keys[i], 10))) { //Tag is not integer : speed up parse
            for (let e = 0; e < tag.length; e++) {
                if (keys[i].toUpperCase() == tag[e]) {
                    let attrib = [];
                    let attribFound = false;
                    for (let j = 0 ; j < keys.length ; j++) {
                        if (keys[j] == ":@")
                        {
                            attrib = val[j];
                            attribFound = true;
                        }
                    }
                    let result = [val[i]];
                    if (attribFound)
                    {
                        result.push(attrib);
                    }
                    return result;
                }
            }
        }
    }
    for (let i = 0 ; i < keys.length ; i++) {
        if (val[i] != "")
        {
            let ret = SearchTag(val[i], defaultValue, tag, level + 1);
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
    if ((typeof data != "object") && (data.constructor === Array))
    {
        return defaultValue;
    }
    let result = [];
    let keys = Object.keys(data);
    let val = Object.values(data);
    let resultExist = false;
    for (let i = 0 ; i < keys.length ; i++) {
        for (let e = 0; e < tag.length; e++) {
            if (keys[i].toUpperCase() == tag[e]) {
                let attrib = [];
                let attribFound = false;
                for (let j = 0 ; j < keys.length ; j++) {
                    if (keys[j] == ":@")
                    {
                        attrib = val[j];
                        attribFound = true;
                    }
                }
                let intermediateResult = [val[i]];
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
    for (let i = 0 ; i < keys.length ; i++) {
        if ((val[i] != "") && ((typeof val[i] == "object") || (val[i].constructor === Array)))
        {
            let ret = SearchTags(val[i], defaultValue, tag, level + 1);
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
    let node = arguments[0];
    let tag = Array.from(arguments);
    tag.shift();

    for (let i = 0; i < tag.length; i++) {
        if (tag[i] != undefined)
        tag[i] = tag[i].toUpperCase();
    }

    let keys = Object.keys(node);
    for (let i = 0 ; i < keys.length ; i++) {
        for (let e = 0; e < tag.length; e++) {
            if (keys[i].toUpperCase() == tag[e]) {
                delete node[keys[i]];
                return node;
            } else {
                let keysL2 = Object.keys(node[keys[i]]);
                for (let j = 0 ; j < keysL2.length ; j++) {
                    for (let f = 0; f < tag.length; f++) {
                        if (keysL2[j].toUpperCase() == tag[f]) {
                            delete node[keys[i]][keysL2[j]];
                            return node;
                        } else {
                            let keysL3 = Object.keys(node[keys[i]][keysL2[j]]);
                            for (let k = 0 ; k < keysL3.length ; k++) {
                                for (let g = 0; g < tag.length; g++) {
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
