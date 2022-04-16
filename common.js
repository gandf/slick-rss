var localLang = "en"; //chrome.i18n.getUILanguage();
var manifest = chrome.runtime.getManifest();
var defaultOptions = GetDefaultOptions();
var options = defaultOptions;
var readLaterFeedID = 9999999999;
var allFeedsID = 9999999998;
var unreadInfo = { };
var newNotif = false;
var viewerPort = null;
var feedInfo = [];
var feeds = [];
var groupInfo = [];
var groups = [];
var unreadTotal = 0;

var promiseOptionBegin = GetOptions();
async function waitOptionReady() {
  return start = await Promise.allSettled([promiseOptionBegin]);
}

function GetStrFromObject(obj){
  var dataArray = Object.keys(obj).map((key) => [Number(key), obj[key]]);
  return JSON.stringify(dataArray);
}

function GetObjectFromStr(dataStr){
  var result = JSON.parse(dataStr);

  var keys = Object.keys(result);
  var removed;
  for (var i = 0 ; i < keys.length ; i++)
  {
    removed = false;
    if ((result[i][0] != undefined) && (result[i][1] != undefined)) {
      if (result[i][0] != i) {
        result[result[i][0]] = result[i][1];
        delete result[i];
        removed = true;
      }
    }
    if (!removed) {
      if (result[i][1] != undefined) {
        result[i] = result[i][1];
      }
    }
  }
  return result
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

//Manage i18n to translation

function SetLocalLang(value)
{
  localLang = value;
}

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

function GetMessageText(value, fromServiceWorker = false)
{
  if (fromServiceWorker)
    return GetMessageTextFromServiceWorker(value);
  return chrome.i18n.getMessage(value);
}

// converts the text date into a formatted one if possible
function GetFormattedDate(txtDate) {
    var myDate = GetDate(txtDate);

    if (myDate == null) {
        return txtDate;
    }

    return FormatDate(myDate, options.dateformat);
}

// takes a text date and tries to convert it to a date object
function GetDate(txtDate)
{
  var myDate = new Date(txtDate);

  if(isNaN(myDate.getTime()))
  {
    myDate = new Date(ConvertAtomDateString(txtDate));

    if(isNaN(myDate.getTime()))
    {
        return null;
    }
  }

  return myDate;
}

// formats dates using a custom format
function FormatDate(dt, format)
{
  var isLocal = true;

  if(format.lastIndexOf("[u]") != -1)
  {
      isLocal = false;
      format = format.replace("[u]", "");
  }

  if (format.includes("[yyyy]")) {
    format = format.replace("[yyyy]", (isLocal) ? dt.getFullYear() : dt.getUTCFullYear());
  }
  if (format.includes("[yy]")) {
    format = format.replace("[yy]", (isLocal) ? (dt.getFullYear() + "").substr(2,2) : (dt.getUTCFullYear() + "").substr(2,2));
  }

  if (format.includes("[mm]")) {
    format = format.replace("[mm]", (isLocal) ? PadZero(dt.getMonth() + 1) : PadZero(dt.getUTCMonth() + 1));
  }
  if (format.includes("[m]")) {
    format = format.replace("[m]", (isLocal) ? dt.getMonth() + 1 : dt.getUTCMonth() + 1);
  }

  if (format.includes("[ddd]")) {
    format = format.replace("[ddd]", (isLocal) ? GetDaySuffix(dt.getDate()) : GetDaySuffix(dt.getUTCDate()));
  }
  if (format.includes("[dd]")) {
    format = format.replace("[dd]", (isLocal) ? PadZero(dt.getDate()) : PadZero(dt.getUTCDate()));
  }
  if (format.includes("[d]")) {
    format = format.replace("[d]", (isLocal) ? dt.getDate() : dt.getUTCDate());
  }

  if (format.includes("[hh]")) {
    format = format.replace("[hh]", (isLocal) ? PadZero(dt.getHours()) : PadZero(dt.getUTCHours()));
  }
  if (format.includes("[h]")) {
    format = format.replace("[h]", (isLocal) ? dt.getHours() : dt.getUTCHours());
  }

  if (format.includes("[12hh]")) {
    format = format.replace("[12hh]", (isLocal) ? PadZero(Get12Hour(dt.getHours())) : PadZero(Get12Hour(dt.getUTCHours())));
  }
  if (format.includes("[12h]")) {
    format = format.replace("[12h]", (isLocal) ? Get12Hour(dt.getHours()) : Get12Hour(dt.getUTCHours()));
  }

  if (format.includes("[nn]")) {
    format = format.replace("[nn]", (isLocal) ? PadZero(dt.getMinutes()) : PadZero(dt.getUTCMinutes()));
  }
  if (format.includes("[n]")) {
    format = format.replace("[n]", (isLocal) ? dt.getMinutes() : dt.getUTCMinutes());
  }

  if (format.includes("[ss]")) {
    format = format.replace("[ss]", (isLocal) ? PadZero(dt.getSeconds()) : PadZero(dt.getUTCSeconds()));
  }
  if (format.includes("[s]")) {
    format = format.replace("[s]", (isLocal) ? dt.getSeconds() : dt.getUTCSeconds());
  }

  if (format.includes("[mmmm]")) {
    format = format.replace("[mmmm]", (isLocal) ? GetMonthName(dt.getMonth()) : GetMonthName(dt.getUTCMonth()));
  }
  if (format.includes("[mmm]")) {
    format = format.replace("[mmm]", (isLocal) ? GetMonthName(dt.getMonth()).substr(0,3) : GetMonthName(dt.getUTCMonth()).substr(0,3));
  }

  if (format.includes("[ww]")) {
    format = format.replace("[ww]", (isLocal) ? GetWeekdayName(dt.getDay()) : GetWeekdayName(dt.getUTCDay()));
  }
  if (format.includes("[w]")) {
    format = format.replace("[w]", (isLocal) ? GetWeekdayName(dt.getDay()).substr(0,3) : GetWeekdayName(dt.getUTCDay()).substr(0,3));
  }

  if (format.includes("[a]")) {
    format = format.replace("[a]", (isLocal) ? (dt.getHours() > 12 ? "PM" : "AM") : (dt.getUTCHours() > 12 ? "PM" : "AM"));
  }

  return format;
}

// adds 0 to a number if it's < 10
function PadZero(num)
{
  if(num < 10)
  {
      return "0" + num;
  }

  return num + "";
}

// converts 24 hour clock into 12
function Get12Hour(hour)
{
  if(hour > 12)
  {
      return hour - 12;
  }

  if(hour == 0)
  {
      return 12;
  }

  return hour;
}

// gets the name of a month (0-11)
function GetMonthName(month)
{
  switch(month)
  {
      case 0: return GetMessageText("monthJanuary", true);
      case 1: return GetMessageText("monthFebruary", true);
      case 2: return GetMessageText("monthMarch", true);
      case 3: return GetMessageText("monthApril", true);
      case 4: return GetMessageText("monthMay", true);
      case 5: return GetMessageText("monthJune", true);
      case 6: return GetMessageText("monthJuly", true);
      case 7: return GetMessageText("monthAugust", true);
      case 8: return GetMessageText("monthSeptember", true);
      case 9: return GetMessageText("monthOctober", true);
      case 10: return GetMessageText("monthNovember", true);
      case 11: return GetMessageText("monthDecember", true);
      default: return "";
  }
}

// gets a weekday name (0-6 = Sunday-Saturday)
function GetWeekdayName(dayOfWeek)
{
  switch(dayOfWeek)
  {
      case 0: return GetMessageText("daySunday", true);
      case 1: return GetMessageText("dayMonday", true);
      case 2: return GetMessageText("dayTuesday", true);
      case 3: return GetMessageText("dayWednesday", true);
      case 4: return GetMessageText("dayThursday", true);
      case 5: return GetMessageText("dayFriday", true);
      case 6: return GetMessageText("daySaturday", true);
      default: return "";
  }
}

// used to get defaults to help fill in missing pieces as I add more options
function GetDefaultOptions() {
    return {
        "lastversion": manifest.version,
        "maxitems": 50,
        "showdescriptions": true,
        "dateformat": "[ww] [dd]/[mm]/[yy] [hh]:[nn]",
        "showfeedimages": true,
        "showfeedobjects": true,
        "showfeediframes": false,
        "showfeedcontent": true,
        "checkinterval": 60,
        "markreadonclick": false,
        "markreadafter": 0,
        "readitemdisplay": 1,
        "unreaditemtotaldisplay": true,
        "unreadtotaldisplay": 3,
        "columns": 2,
        "readlaterenabled": true,
        "readlaterremovewhenviewed": true,
        "readlaterincludetotal": true,
        "loadlinksinbackground": true,
        "showallfeeds": false,
        "usethumbnail": false,
        "feedsmaxheight": 200,
        "playSoundNotif": false,
        "lang": "en",
        "darkmode": false
    };
}

// gets all or some options, filling in defaults when needed
function GetOptions() {
  var promiseGetOption = store.getItem('options').then(function(data) {
      if (data != null) {
          options = data;

          // fill in defaults for new options
          for (key in GetDefaultOptions()) {
              if (options[key] == undefined) {
                  options[key] = defaultOptions[key];
              }
          }
          if (options.lang != localLang)
          {
            SetLocalLang(options.lang);
          }
      }
    });
    if (options.lang == null)
    {
      options.lang = "en";
    }
    SetLocalLang(options.lang);
    return promiseGetOption;
}

//convert an Atom-formatted date string to a javascript-compatible date string
function ConvertAtomDateString(str)
{
  //YYYY-MM-DDThh:mm:ss[.f*](Z|-hh:mm|+hh:mm)
  var atomFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d*)?(Z|[+-]\d{2}:\d{2})$/i;
  if(!atomFormat.test(str)) return "";  //invalid format

  var months = new Array("","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec");

  var year, month, date, hour, minute, second, offset;
  year = str.slice(0,4);
  month = months[1*str.slice(5,7)];    //Jan-Dec
  date = str.slice(8,10);    //01-31
  hour = str.slice(11,13);  //00-23
  minute = str.slice(14,16);  //00-59
  second = str.slice(17,19);  //00-59
  offset = "GMT";
  if(str.indexOf("Z") == -1)  //time zone offset specified
  {
    var x = str.lastIndexOf(":");
    offset += str.slice(x-3,x) + str.slice(x+1);
  }

  //DD MMM YYYY hh:mm:ss GMT[(+|-)hhmm]
  return date+" "+month+" "+year+" "+hour+":"+minute+":"+second+" "+offset;
}

// gets a day suffix like st, th, nd
function GetDaySuffix(number)
{
  if((number > 3 && number < 21) || (number > 24 && number < 31))
  {
      return number + GetMessageText("daySuffix5", true);
  }

  number = number + "";

  switch(number.substr(number.length - 1, 1))
  {
      case "1" : return number + GetMessageText("daySuffix1", true);
      case "2" : return number + GetMessageText("daySuffix2", true);
      case "3" : return number + GetMessageText("daySuffix3", true);
      case "4" : return number + GetMessageText("daySuffix4", true);
  }
}

function findWithAttr(array, attr, value) {
  for(var i = 0; i < array.length; i += 1) {
      if(array[i][attr] === value) {
          return i;
      }
  }
  return -1;
}

function SortByDate(items) {
  if (items == null) {
    return items;
  }
  if (items.length == 0) {
    return items;
  }
  return items.sort(function(a, b) {
    return (parseInt(b["order"]) - parseInt(a["order"]));
    });
}

function formatBytes(a,b=2){var textBytes=GetMessageText("Bytes");var textKB=GetMessageText("KB");var textMB=GetMessageText("MB");var textGB=GetMessageText("GB");var textTB=GetMessageText("TB");var textPB=GetMessageText("PB");var textEB=GetMessageText("EB");var textZB=GetMessageText("ZB");var textYB=GetMessageText("YB");if(0===a)return`0 ${textBytes}`;const c=0>b?0:b,d=Math.floor(Math.log(a)/Math.log(1024));return parseFloat((a/Math.pow(1024,d)).toFixed(c))+" "+[`${textBytes}`,`${textKB}`,`${textMB}`,`${textGB}`,`${textTB}`,`${textPB}`,`${textEB}`,`${textZB}`,`${textYB}`][d]}

// gets random numbers for managed feed ids
function GetRandomID() {
    var chars = "0123456789";
    var str = "";
    var rnum;

    for (var i = 0; i < 10; i++) {
        rnum = Math.floor(Math.random() * chars.length);
        str += chars.charAt(rnum);
    }

    return str;
}

// helper function for creating new feeds
function CreateNewFeed(title, url, group, maxitems, order, id) {
    // managed feed doesn't have an id yet
    if (id == null) {
        id = GetRandomID();
    }

    return {title: title, url: url, group: group, maxitems: maxitems, order: order, id: id};
}

function GetReadLaterFeed() {
    return CreateNewFeed(GetMessageText("backReadLater", true), chrome.runtime.getURL("readlater.html"), "", 99999, -9, readLaterFeedID);
}

// gets the feed array for everyone to use
function GetFeedsSimple(callBack) {
  feeds = [];
  getFeedsCallBack = callBack;

  store.getItem('feeds').then(function(datafeeds) {
    if (datafeeds != null) {
        feeds = datafeeds.sort(function (a, b) {
            return a.order - b.order;
        });
    }

    //feeds.unshift(GetReadLaterFeed());
    getFeedsCallBack(feeds);
  });
}

// updates, shows and hides the badge
function UpdateUnreadBadge() {
    if (unreadInfo == null) {
        return;
    }

    var total = 0;
    var str = "";

    for (var key in unreadInfo) {
        total = total + unreadInfo[key].unreadtotal;
    }

    if (!options.readlaterincludetotal && unreadInfo[readLaterFeedID] != null) {
        total = total - unreadInfo[readLaterFeedID].unreadtotal;
    }

    if (total > 0) {
        str = total + "";
    }

    // they don't want toolbar unread updates
    if (options.unreadtotaldisplay == 0 || options.unreadtotaldisplay == 2) {
        str = "";
    }

    if (newNotif) {
      PlayNotificationSound();
      newNotif = false;
    }

    unreadTotal = total;

    // update badge
    chrome.action.setBadgeText({text: str});
    //chrome.action.setBadgeText({text: str});

    // update title
    if (viewerPort != null) {
        viewerPort.postMessage({type: "unreadtotalchanged"});
    }
}

function PlayNotificationSound() {
  if (options.playSoundNotif) {
    var audio = new Audio('Glisten.ogg');
    audio.play();
  }
}

// since the key for unread is the feed id, it's possible that you removed some, as such we should update and clean house
function CleanUpUnreadOrphans() {
    var feedIDs = {};

    for (var key in feeds) {
        feedIDs[feeds[key].id] = 1;
    }

    for (var key in unreadInfo) {
        if (feedIDs[key] == null) {
            delete unreadInfo[key];
        }
    }
    var promiseCleanUpUnreadOrphans = store.setItem('unreadinfo', unreadInfo);

    UpdateUnreadBadge();

    return promiseCleanUpUnreadOrphans;
}

// returns a dictionary of unread counts {feedsid} = unreadtotal, readitems{}
// may need a way to clean this if they delete feeds
function GetUnreadCounts() {
  var resultPromise = store.getItem('unreadinfo').then(function(data) {
      if (data != null) {
          unreadinfo = data;
      } else {
        unreadinfo = { };
        store.setItem('unreadinfo', { });
      }
    },function(dataError) {
        unreadinfo = { };
        store.setItem('unreadinfo', { });
    });

    return resultPromise;
}

function GetFeedInfoItem(feedID, itemIndex) {
    var feedGroupInfo = feedInfo[feedID];
    if (feedGroupInfo == null) {
      feedGroupInfo = feedInfo[groupInfo[feedID].items[itemIndex].idOrigin].items.find(function (el) {
        return (el.itemID == groupInfo[feedID].items[itemIndex].itemID);
      });
      return feedGroupInfo;
    }
    return feedGroupInfo.items[itemIndex];
}

function GetFeedsFilterByGroup(key) {
    var filteredFeeds = [];
    if (groups[key].id == allFeedsID) {
      filteredFeeds = feeds.filter(function (el) {
        return (el.id != readLaterFeedID);
      });
    } else {
      filteredFeeds = feeds.filter(function (el) {
        return (el.group == groups[key].group) && (el.id != readLaterFeedID);
      });
    }

    return filteredFeeds;
}

function GetGroupKeyByID(id) {
    if (groups == null) {
      return null;
    }
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].id == id) {
        return i;
      }
    }
}

function ItemIsRead(feedID, itemID) {
  var currentFeed = feeds.find(function (el) {
    return (el.id == feedID);
  });
  if (currentFeed != null) {
      return (unreadInfo[currentFeed.id].readitems[itemID] != null);
  }
  return false;
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

function activeDarkMode() {
  var keys = Object.keys(document.getElementsByTagName("link"));
  for (var i = 0; i < keys.length; i++) {
    var oldlink = document.getElementsByTagName("link").item(keys[i]);
    oldlink.setAttribute("href", oldlink.getAttribute("href").replace(".", "_dark."));
  }
}

function disableDarkMode() {
  var keys = Object.keys(document.getElementsByTagName("link"));
  for (var i = 0; i < keys.length; i++) {
    var oldlink = document.getElementsByTagName("link").item(keys[i]);
    oldlink.setAttribute("href", oldlink.getAttribute("href").replace("_dark.", "."));
  }
}
