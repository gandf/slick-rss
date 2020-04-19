//Manage i18n to translation
function GetMessageText(value)
{
  return chrome.i18n.getMessage(value);
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
        case 0: return GetMessageText("monthJanuary");
        case 1: return GetMessageText("monthFebruary");
        case 2: return GetMessageText("monthMarch");
        case 3: return GetMessageText("monthApril");
        case 4: return GetMessageText("monthMay");
        case 5: return GetMessageText("monthJune");
        case 6: return GetMessageText("monthJuly");
        case 7: return GetMessageText("monthAugust");
        case 8: return GetMessageText("monthSeptember");
        case 9: return GetMessageText("monthOctober");
        case 10: return GetMessageText("monthNovember");
        case 11: return GetMessageText("monthDecember");
        default: return "";
    }
}

// gets a weekday name (0-6 = Sunday-Saturday)
function GetWeekdayName(dayOfWeek)
{
    switch(dayOfWeek)
    {
        case 0: return GetMessageText("daySunday");
        case 1: return GetMessageText("dayMonday");
        case 2: return GetMessageText("dayTuesday");
        case 3: return GetMessageText("dayWednesday");
        case 4: return GetMessageText("dayThursday");
        case 5: return GetMessageText("dayFriday");
        case 6: return GetMessageText("daySaturday");
        default: return "";
    }
}

//convert an Atom-formatted date string to a javascript-compatible date string
function ConvertAtomDateString(str)
{
	//YYYY-MM-DDThh:mm:ss[.f*](Z|-hh:mm|+hh:mm)
	var atomFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d*)?(Z|[+-]\d{2}:\d{2})$/i;
	if(!atomFormat.test(str)) return "";	//invalid format

	var months = new Array("","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec");

	var year, month, date, hour, minute, second, offset;
	year = str.slice(0,4);
	month = months[1*str.slice(5,7)];		//Jan-Dec
	date = str.slice(8,10);		//01-31
	hour = str.slice(11,13);	//00-23
	minute = str.slice(14,16);	//00-59
	second = str.slice(17,19);	//00-59
	offset = "GMT";
	if(str.indexOf("Z") == -1)	//time zone offset specified
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
        return number + GetMessageText("daySuffix5");
    }

    number = number + "";

    switch(number.substr(number.length - 1, 1))
    {
        case "1" : return number + GetMessageText("daySuffix1");
        case "2" : return number + GetMessageText("daySuffix2");
        case "3" : return number + GetMessageText("daySuffix3");
        case "4" : return number + GetMessageText("daySuffix4");
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
