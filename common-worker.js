var isServiceWorker = true;

function CleanText2(text)
{
  if ((text == undefined) || (text == null))
  {
    return text;
  }
  else {
    if (text[0] != undefined)
    {
      if (text[0][0] != undefined)
      {
        if (text[0][0]["#text"] != undefined)
        {
          return text[0][0]["#text"];
        }
      }
    }
  }
  return text;
}

function CleanText(text)
{
  if ((text == undefined) || (text == null))
  {
    return text;
  }
  else {
    if (text[0] != undefined)
    {
      if (text[0]["#text"] != undefined)
      {
        return text[0]["#text"];
      }
    }
  }
  return text;
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
  if (level == 30)
  {
    return defaultValue;
  }
  var keys = Object.keys(data);
  var val = Object.values(data);
  for (var i = 0 ; i < keys.length ; i++)
  {
    for (var e = 0; e < tag.length; e++) {
      if (keys[i].toUpperCase() == tag[e]) {
        var attrib = [];
        var attribFound = false;
        for (var j = 0 ; j < keys.length ; j++)
        {
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
  for (var i = 0 ; i < keys.length ; i++)
  {
    if (val[i] != "")
    {
      var ret = SearchTag(val[i], defaultValue, tag, level + 1);
      if (ret != defaultValue)
      {
        return ret;
      }
    }
  }
  return defaultValue;
}

function SearchTags(data, defaultValue, tag, level)
{
  if (level == 30)
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
  for (var i = 0 ; i < keys.length ; i++)
  {
    for (var e = 0; e < tag.length; e++) {
      if (keys[i].toUpperCase() == tag[e]) {
          var attrib = [];
          var attribFound = false;
          for (var j = 0 ; j < keys.length ; j++)
          {
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
  for (var i = 0 ; i < keys.length ; i++)
  {
    if ((val[i] != "") && ((typeof val[i] == "object") || (typeof val[i] == "array")))
    {
      var ret = SearchTags(val[i], defaultValue, tag, level + 1);
      if (ret != defaultValue)
      {
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
