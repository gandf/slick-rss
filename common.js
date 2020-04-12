

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

    format = format.replace("[yyyy]", (isLocal) ? dt.getFullYear() : dt.getUTCFullYear());
    format = format.replace("[yy]", (isLocal) ? (dt.getFullYear() + "").substr(2,2) : (dt.getUTCFullYear() + "").substr(2,2));

    format = format.replace("[mm]", (isLocal) ? PadZero(dt.getMonth() + 1) : PadZero(dt.getUTCMonth() + 1));
    format = format.replace("[m]", (isLocal) ? dt.getMonth() + 1 : dt.getUTCMonth() + 1);

    format = format.replace("[ddd]", (isLocal) ? GetDaySuffix(dt.getDate()) : GetDaySuffix(dt.getUTCDate()));
    format = format.replace("[dd]", (isLocal) ? PadZero(dt.getDate()) : PadZero(dt.getUTCDate()));
    format = format.replace("[d]", (isLocal) ? dt.getDate() : dt.getUTCDate());

    format = format.replace("[hh]", (isLocal) ? PadZero(dt.getHours()) : PadZero(dt.getUTCHours()));
    format = format.replace("[h]", (isLocal) ? dt.getHours() : dt.getUTCHours());

    format = format.replace("[12hh]", (isLocal) ? PadZero(Get12Hour(dt.getHours())) : PadZero(Get12Hour(dt.getUTCHours())));
    format = format.replace("[12h]", (isLocal) ? Get12Hour(dt.getHours()) : Get12Hour(dt.getUTCHours()));

    format = format.replace("[nn]", (isLocal) ? PadZero(dt.getMinutes()) : PadZero(dt.getUTCMinutes()));
    format = format.replace("[n]", (isLocal) ? dt.getMinutes() : dt.getUTCMinutes());

    format = format.replace("[ss]", (isLocal) ? PadZero(dt.getSeconds()) : PadZero(dt.getUTCSeconds()));
    format = format.replace("[s]", (isLocal) ? dt.getSeconds() : dt.getUTCSeconds());

    format = format.replace("[mmmm]", (isLocal) ? GetMonthName(dt.getMonth()) : GetMonthName(dt.getUTCMonth()));
    format = format.replace("[mmm]", (isLocal) ? GetMonthName(dt.getMonth()).substr(0,3) : GetMonthName(dt.getUTCMonth()).substr(0,3));

    format = format.replace("[ww]", (isLocal) ? GetWeekdayName(dt.getDay()) : GetWeekdayName(dt.getUTCDay()));
    format = format.replace("[w]", (isLocal) ? GetWeekdayName(dt.getDay()).substr(0,3) : GetWeekdayName(dt.getUTCDay()).substr(0,3));

    format = format.replace("[a]", (isLocal) ? (dt.getHours() > 12 ? "PM" : "AM") : (dt.getUTCHours() > 12 ? "PM" : "AM"));

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
        case 0: return "January";
        case 1: return "February";
        case 2: return "March";
        case 3: return "April";
        case 4: return "May";
        case 5: return "June";
        case 6: return "July";
        case 7: return "August";
        case 8: return "September";
        case 9: return "October";
        case 10: return "November";
        case 11: return "December";
        default: return "";
    }
}

// gets a weekday name (0-6 = Sunday-Saturday)
function GetWeekdayName(dayOfWeek)
{
    switch(dayOfWeek)
    {
        case 0: return "Sunday";
        case 1: return "Monday";
        case 2: return "Tuesday";
        case 3: return "Wednesday";
        case 4: return "Thursday";
        case 5: return "Friday";
        case 6: return "Saturday";
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
        return number + "th";
    }

    number = number + "";

    switch(number.substr(number.length - 1, 1))
    {
        case "1" : return number + "st";
        case "2" : return number + "nd";
        case "3" : return number + "rd";
        case "4" : return number + "th";
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
