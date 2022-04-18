var localLang = "en";

function GetMessageTextFromServiceWorker(value)
{
  switch(value)
  {
    case 'backReadLater':
      switch(localLang)
      {
          case 'de': return "Read Later";
          case 'en': return "Read Later";
          case 'en_GB': return "Read Later";
          case 'en_US': return "Read Later";
          case 'es': return "Read Later";
          case 'fr': return "Lire plus tard";
          case 'it': return "Read Later";
          case 'nl': return "Read Later";
          default: return "Read Later";
      };
    case 'backItemsMarkedReadLater':
      switch(localLang)
      {
          case 'de': return "Items you marked to read later";
          case 'en': return "Items you marked to read later";
          case 'en_GB': return "Items you marked to read later";
          case 'en_US': return "Items you marked to read later";
          case 'es': return "Items you marked to read later";
          case 'fr': return "Sujets que vous avez marqués pour lire plus tard";
          case 'it': return "Items you marked to read later";
          case 'nl': return "Items you marked to read later";
          default: return "Items you marked to read later";
      };
    case 'backNoTitle':
      switch(localLang)
      {
          case 'de': return "No Title";
          case 'en': return "No Title";
          case 'en_GB': return "No Title";
          case 'en_US': return "No Title";
          case 'es': return "No Title";
          case 'fr': return "Sans titre";
          case 'it': return "No Title";
          case 'nl': return "No Title";
          default: return "No Title";
      };
    case 'backErrorXML':
      switch(localLang)
      {
          case 'de': return "The response didn't have a valid responseXML property.";
          case 'en': return "The response didn't have a valid responseXML property.";
          case 'en_GB': return "The response didn't have a valid responseXML property.";
          case 'en_US': return "The response didn't have a valid responseXML property.";
          case 'es': return "The response didn't have a valid responseXML property.";
          case 'fr': return "La réponse n'avait pas de propriété responseXML valide.";
          case 'it': return "The response didn't have a valid responseXML property.";
          case 'nl': return "The response didn't have a valid responseXML property.";
          default: return "The response didn't have a valid responseXML property.";
      };
    case 'backError200Part1':
      switch(localLang)
      {
          case 'de': return "Status wasn't 200.  It was ";
          case 'en': return "Status wasn't 200.  It was ";
          case 'en_GB': return "Status wasn't 200.  It was ";
          case 'en_US': return "Status wasn't 200.  It was ";
          case 'es': return "Status wasn't 200.  It was ";
          case 'fr': return "Le statut n'était pas 200. C'était ";
          case 'it': return "Status wasn't 200.  It was ";
          case 'nl': return "Status wasn't 200.  It was ";
          default: return "Status wasn't 200.  It was ";
      };
    case 'backError200Part2':
      switch(localLang)
      {
          case 'de': return " and frankly I don't know how to handle that.  If it helps, the status text was '";
          case 'en': return " and frankly I don't know how to handle that.  If it helps, the status text was '";
          case 'en_GB': return " and frankly I don't know how to handle that.  If it helps, the status text was '";
          case 'en_US': return " and frankly I don't know how to handle that.  If it helps, the status text was '";
          case 'es': return " and frankly I don't know how to handle that.  If it helps, the status text was '";
          case 'fr': return " et franchement, je ne sais pas comment gérer ça. Si cela peut aider, le texte d'état était ";
          case 'it': return " and frankly I don't know how to handle that.  If it helps, the status text was '";
          case 'nl': return " and frankly I don't know how to handle that.  If it helps, the status text was '";
          default: return " and frankly I don't know how to handle that.  If it helps, the status text was '";
      };
    case 'backError200Part3':
      switch(localLang)
      {
          case 'de': return "'.";
          case 'en': return "'.";
          case 'en_GB': return "'.";
          case 'en_US': return "'.";
          case 'es': return "'.";
          case 'fr': return "'.";
          case 'it': return "'.";
          case 'nl': return "'.";
          default: return "'.";
      };
    case 'backAllFeeds':
      switch(localLang)
      {
          case 'de': return "All Feeds";
          case 'en': return "All Feeds";
          case 'en_GB': return "All Feeds";
          case 'en_US': return "All Feeds";
          case 'es': return "All Feeds";
          case 'fr': return "Tous les flux";
          case 'it': return "All Feeds";
          case 'nl': return "All Feeds";
          default: return "All Feeds";
      };
    case 'monthJanuary':
      switch(localLang)
      {
          case 'de': return "January";
          case 'en': return "January";
          case 'en_GB': return "January";
          case 'en_US': return "January";
          case 'es': return "January";
          case 'fr': return "Janvier";
          case 'it': return "January";
          case 'nl': return "January";
          default: return "January";
      };
    case 'monthFebruary':
      switch(localLang)
      {
          case 'de': return "February";
          case 'en': return "February";
          case 'en_GB': return "February";
          case 'en_US': return "February";
          case 'es': return "February";
          case 'fr': return "Février";
          case 'it': return "February";
          case 'nl': return "February";
          default: return "February";
      };
    case 'monthMarch':
      switch(localLang)
      {
          case 'de': return "March";
          case 'en': return "March";
          case 'en_GB': return "March";
          case 'en_US': return "March";
          case 'es': return "March";
          case 'fr': return "Mars";
          case 'it': return "March";
          case 'nl': return "March";
          default: return "March";
      };
    case 'monthApril':
      switch(localLang)
      {
          case 'de': return "April";
          case 'en': return "April";
          case 'en_GB': return "April";
          case 'en_US': return "April";
          case 'es': return "April";
          case 'fr': return "Avril";
          case 'it': return "April";
          case 'nl': return "April";
          default: return "April";
      };
    case 'monthMay':
      switch(localLang)
      {
          case 'de': return "May";
          case 'en': return "May";
          case 'en_GB': return "May";
          case 'en_US': return "May";
          case 'es': return "May";
          case 'fr': return "Mai";
          case 'it': return "May";
          case 'nl': return "May";
          default: return "May";
      };
    case 'monthJune':
      switch(localLang)
      {
          case 'de': return "June";
          case 'en': return "June";
          case 'en_GB': return "June";
          case 'en_US': return "June";
          case 'es': return "June";
          case 'fr': return "Juin";
          case 'it': return "June";
          case 'nl': return "June";
          default: return "June";
      };
    case 'monthJuly':
      switch(localLang)
      {
          case 'de': return "July";
          case 'en': return "July";
          case 'en_GB': return "July";
          case 'en_US': return "July";
          case 'es': return "July";
          case 'fr': return "Juillet";
          case 'it': return "July";
          case 'nl': return "July";
          default: return "July";
      };
    case 'monthAugust':
      switch(localLang)
      {
          case 'de': return "August";
          case 'en': return "August";
          case 'en_GB': return "August";
          case 'en_US': return "August";
          case 'es': return "August";
          case 'fr': return "Août";
          case 'it': return "August";
          case 'nl': return "August";
          default: return "August";
      };
    case 'monthSeptember':
      switch(localLang)
      {
          case 'de': return "September";
          case 'en': return "September";
          case 'en_GB': return "September";
          case 'en_US': return "September";
          case 'es': return "September";
          case 'fr': return "Septembre";
          case 'it': return "September";
          case 'nl': return "September";
          default: return "September";
      };
    case 'monthOctober':
      switch(localLang)
      {
          case 'de': return "October";
          case 'en': return "October";
          case 'en_GB': return "October";
          case 'en_US': return "October";
          case 'es': return "October";
          case 'fr': return "Octobre";
          case 'it': return "October";
          case 'nl': return "October";
          default: return "October";
      };
    case 'monthNovember':
      switch(localLang)
      {
          case 'de': return "November";
          case 'en': return "November";
          case 'en_GB': return "November";
          case 'en_US': return "November";
          case 'es': return "November";
          case 'fr': return "Novembre";
          case 'it': return "November";
          case 'nl': return "November";
          default: return "November";
      };
    case 'monthDecember':
      switch(localLang)
      {
          case 'de': return "December";
          case 'en': return "December";
          case 'en_GB': return "December";
          case 'en_US': return "December";
          case 'es': return "December";
          case 'fr': return "Décembre";
          case 'it': return "December";
          case 'nl': return "December";
          default: return "December";
      };
    case 'daySunday':
      switch(localLang)
      {
          case 'de': return "Sunday";
          case 'en': return "Sunday";
          case 'en_GB': return "Sunday";
          case 'en_US': return "Sunday";
          case 'es': return "Sunday";
          case 'fr': return "Dimanche";
          case 'it': return "Sunday";
          case 'nl': return "Sunday";
          default: return "Sunday";
      };
    case 'dayMonday':
      switch(localLang)
      {
          case 'de': return "Monday";
          case 'en': return "Monday";
          case 'en_GB': return "Monday";
          case 'en_US': return "Monday";
          case 'es': return "Monday";
          case 'fr': return "Lundi";
          case 'it': return "Monday";
          case 'nl': return "Monday";
          default: return "Monday";
      };
    case 'dayTuesday':
      switch(localLang)
      {
          case 'de': return "Tuesday";
          case 'en': return "Tuesday";
          case 'en_GB': return "Tuesday";
          case 'en_US': return "Tuesday";
          case 'es': return "Tuesday";
          case 'fr': return "Mardi";
          case 'it': return "Tuesday";
          case 'nl': return "Tuesday";
          default: return "Tuesday";
      };
    case 'dayWednesday':
      switch(localLang)
      {
          case 'de': return "Wednesday";
          case 'en': return "Wednesday";
          case 'en_GB': return "Wednesday";
          case 'en_US': return "Wednesday";
          case 'es': return "Wednesday";
          case 'fr': return "Mercredi";
          case 'it': return "Wednesday";
          case 'nl': return "Wednesday";
          default: return "Wednesday";
      };
    case 'dayThursday':
      switch(localLang)
      {
          case 'de': return "Thursday";
          case 'en': return "Thursday";
          case 'en_GB': return "Thursday";
          case 'en_US': return "Thursday";
          case 'es': return "Thursday";
          case 'fr': return "Jeudi";
          case 'it': return "Thursday";
          case 'nl': return "Thursday";
          default: return "Thursday";
      };
    case 'dayFriday':
      switch(localLang)
      {
          case 'de': return "Friday";
          case 'en': return "Friday";
          case 'en_GB': return "Friday";
          case 'en_US': return "Friday";
          case 'es': return "Friday";
          case 'fr': return "Vendredi";
          case 'it': return "Friday";
          case 'nl': return "Friday";
          default: return "Friday";
      };
    case 'daySaturday':
      switch(localLang)
      {
          case 'de': return "Saturday";
          case 'en': return "Saturday";
          case 'en_GB': return "Saturday";
          case 'en_US': return "Saturday";
          case 'es': return "Saturday";
          case 'fr': return "Samedi";
          case 'it': return "Saturday";
          case 'nl': return "Saturday";
          default: return "Saturday";
      };
    case 'daySuffix1':
      switch(localLang)
      {
          case 'de': return "st";
          case 'en': return "st";
          case 'en_GB': return "st";
          case 'en_US': return "st";
          case 'es': return "st";
          case 'fr': return "er";
          case 'it': return "st";
          case 'nl': return "st";
          default: return "st";
      };
    case 'daySuffix2':
      switch(localLang)
      {
          case 'de': return "nd";
          case 'en': return "nd";
          case 'en_GB': return "nd";
          case 'en_US': return "nd";
          case 'es': return "nd";
          case 'fr': return "ème";
          case 'it': return "nd";
          case 'nl': return "nd";
          default: return "nd";
      };
    case 'daySuffix3':
      switch(localLang)
      {
          case 'de': return "rd";
          case 'en': return "rd";
          case 'en_GB': return "rd";
          case 'en_US': return "rd";
          case 'es': return "rd";
          case 'fr': return "ème";
          case 'it': return "rd";
          case 'nl': return "rd";
          default: return "rd";
      };
    case 'daySuffix4':
      switch(localLang)
      {
          case 'de': return "th";
          case 'en': return "th";
          case 'en_GB': return "th";
          case 'en_US': return "th";
          case 'es': return "th";
          case 'fr': return "ème";
          case 'it': return "th";
          case 'nl': return "th";
          default: return "th";
      };
      case 'daySuffix5':
        switch(localLang)
        {
            case 'de': return "th";
            case 'en': return "th";
            case 'en_GB': return "th";
            case 'en_US': return "th";
            case 'es': return "th";
            case 'fr': return "ème";
            case 'it': return "th";
            case 'nl': return "th";
            default: return "th";
        };  }
  return "";
}

function GetMessageText(value)
{
  return GetMessageTextFromServiceWorker(value);
}

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
