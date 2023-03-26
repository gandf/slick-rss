var manifest = chrome.runtime.getManifest();
var defaultOptions = GetDefaultOptions();
var options = defaultOptions;
var readLaterFeedID = 9999999999;
var allFeedsID = 9999999998;
var unreadInfo = {};
var newNotif = false;
var viewerPort = null;
var feedInfo = [];
var feeds = [];
var groupInfo = [];
var groups = [];
var unreadTotal = 0;
var listCategoriesRegistered = [];
var readlaterInfo = [];
readlaterInfo[readLaterFeedID] = {
    title: GetMessageText("backReadLater"),
    description: GetMessageText("backItemsMarkedReadLater"),
    group: "",
    loading: false,
    items: [],
    error: "",
    category: ""
};

var promiseOptionBegin = GetOptions();

async function waitOptionReady() {
    return await Promise.allSettled([promiseOptionBegin]);
}

function GetCategoriesRegistered() {
    return store.getItem('categories').then(function (data) {
        if (data != null) {
            listCategoriesRegistered = data;
        } else {
            listCategoriesRegistered = [];
        }
    });
}

function GetStrFromObject(obj) {
    let dataArray = Object.keys(obj).map((key) => [Number(key), obj[key]]);
    return JSON.stringify(dataArray);
}

function GetObjectFromStr(dataStr) {
    let result = JSON.parse(dataStr);

    let keys = Object.keys(result);
    let removed, j, k0, k1, keys2;
    for (let i = 0; i < keys.length; i++) {
        j = keys[i];
        removed = false;
        keys2 = Object.keys(result[j]);
        k0 = keys2[0];
        k1 = keys2[1];
        if ((result[j][k0] != undefined) && (result[j][k1] != undefined)) {
            if (result[j][k0] != i) {
                result[result[j][k0]] = result[j][k1];
                delete result[j];
                removed = true;
            }
        }
        if (!removed) {
            if (result[j][k1] != undefined) {
                result[j] = result[j][k1];
            }
        }
    }
    return result
}

function GetMessageText(value) {
    if (options.forcelangen) {
        return chrome.i18n.getMessage('en' + value);
    } else {
        return chrome.i18n.getMessage(value);
    }
}

// converts the text date into a formatted one if possible
function GetFormattedDate(txtDate) {
    let myDate = GetDate(txtDate);

    if (myDate == null) {
        return txtDate;
    }

    return FormatDate(myDate, options.dateformat);
}

// takes a text date and tries to convert it to a date object
function GetDate(txtDate) {
    let myDate = new Date(txtDate);

    if (isNaN(myDate.getTime())) {
        myDate = new Date(ConvertAtomDateString(txtDate));

        if (isNaN(myDate.getTime())) {
            return null;
        }
    }

    return myDate;
}

// formats dates using a custom format
function FormatDate(dt, format) {
    let isLocal = true;

    if (format.lastIndexOf("[u]") != -1) {
        isLocal = false;
        format = format.replace("[u]", "");
    }

    if (format.includes("[yyyy]")) {
        format = format.replace("[yyyy]", (isLocal) ? dt.getFullYear() : dt.getUTCFullYear());
    }
    if (format.includes("[yy]")) {
        format = format.replace("[yy]", (isLocal) ? (dt.getFullYear() + "").substring(2, 4) : (dt.getUTCFullYear() + "").substring(2, 4));
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
        format = format.replace("[mmm]", (isLocal) ? GetMonthName(dt.getMonth()).substring(0, 3) : GetMonthName(dt.getUTCMonth()).substring(0, 3));
    }

    if (format.includes("[ww]")) {
        format = format.replace("[ww]", (isLocal) ? GetWeekdayName(dt.getDay()) : GetWeekdayName(dt.getUTCDay()));
    }
    if (format.includes("[w]")) {
        format = format.replace("[w]", (isLocal) ? GetWeekdayName(dt.getDay()).substring(0, 3) : GetWeekdayName(dt.getUTCDay()).substring(0, 3));
    }

    if (format.includes("[a]")) {
        format = format.replace("[a]", (isLocal) ? (dt.getHours() > 12 ? "PM" : "AM") : (dt.getUTCHours() > 12 ? "PM" : "AM"));
    }

    return format;
}

// adds 0 to a number if it's < 10
function PadZero(num) {
    if (num < 10) {
        return "0" + num;
    }

    return num + "";
}

// converts 24 hours clock into 12
function Get12Hour(hour) {
    if (hour > 12) {
        return hour - 12;
    }

    if (hour == 0) {
        return 12;
    }

    return hour;
}

// gets the name of a month (0-11)
function GetMonthName(month) {
    switch (month) {
        case 0:
            return GetMessageText("monthJanuary");
        case 1:
            return GetMessageText("monthFebruary");
        case 2:
            return GetMessageText("monthMarch");
        case 3:
            return GetMessageText("monthApril");
        case 4:
            return GetMessageText("monthMay");
        case 5:
            return GetMessageText("monthJune");
        case 6:
            return GetMessageText("monthJuly");
        case 7:
            return GetMessageText("monthAugust");
        case 8:
            return GetMessageText("monthSeptember");
        case 9:
            return GetMessageText("monthOctober");
        case 10:
            return GetMessageText("monthNovember");
        case 11:
            return GetMessageText("monthDecember");
        default:
            return "";
    }
}

// gets a weekday name (0-6 = Sunday-Saturday)
function GetWeekdayName(dayOfWeek) {
    switch (dayOfWeek) {
        case 0:
            return GetMessageText("daySunday");
        case 1:
            return GetMessageText("dayMonday");
        case 2:
            return GetMessageText("dayTuesday");
        case 3:
            return GetMessageText("dayWednesday");
        case 4:
            return GetMessageText("dayThursday");
        case 5:
            return GetMessageText("dayFriday");
        case 6:
            return GetMessageText("daySaturday");
        default:
            return "";
    }
}

// used to get defaults to help fill in missing pieces as I add more options
function GetDefaultOptions() {
    return {
        "lastversion": manifest.version,
        "maxitems": 100,
        "showdescriptions": true,
        "dateformat": "[ww] [dd]/[mm]/[yy] [hh]:[nn]",
        "showfeedimages": true,
        "showfeedobjects": true,
        "showfeediframes": true,
        "showfeedcontent": true,
        "showfeedcontentsummary": 0,
        "checkinterval": 60,
        "markreadonclick": false,
        "markreadafter": 0,
        "readitemdisplay": 1,
        "unreaditemtotaldisplay": true,
        "unreadtotaldisplay": 3,
        "columns": 2,
        "readlaterenabled": true,
        "readlaterremovewhenviewed": true,
        "loadlinksinbackground": true,
        "showallfeeds": false,
        "usethumbnail": true,
        "feedsmaxheight": 0,
        "playSoundNotif": false,
        "darkmode": true,
        "fontSize": 1,
        "forcelangen": false,
        "levelSearchTag": 5,
        "levelSearchTags": 8,
        "log": false,
        "showGetRSSFeedUrl": true,
        "showsavethisfeed": true,
        "dontreadontitleclick": false,
        "useViewByCategory": false
    };
}

// gets all or some options, filling in defaults when needed
function GetOptions() {
    return store.getItem('options').then(function (data) {
        if (data != null) {
            options = data;

            // fill in defaults for new options
            for (let key in GetDefaultOptions()) {
                if (options[key] == undefined) {
                    options[key] = defaultOptions[key];
                }
            }
        }
    });
}

//convert an Atom-formatted date string to a javascript-compatible date string
function ConvertAtomDateString(str) {
    //YYYY-MM-DDThh:mm:ss[.f*](Z|-hh:mm|+hh:mm)
    let atomFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d*)?(Z|[+-]\d{2}:\d{2})$/i;
    if (!atomFormat.test(str)) return "";  //invalid format

    let months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    let year, month, date, hour, minute, second, offset;
    year = str.slice(0, 4);
    month = months[1 * str.slice(5, 7)];    //Jan-Dec
    date = str.slice(8, 10);    //01-31
    hour = str.slice(11, 13);  //00-23
    minute = str.slice(14, 16);  //00-59
    second = str.slice(17, 19);  //00-59
    offset = "GMT";
    if (str.indexOf("Z") == -1)  //time zone offset specified
    {
        let x = str.lastIndexOf(":");
        offset += str.slice(x - 3, x) + str.slice(x + 1);
    }

    //DD MMM YYYY hh:mm:ss GMT[(+|-)hhmm]
    return date + " " + month + " " + year + " " + hour + ":" + minute + ":" + second + " " + offset;
}

// gets a day suffix like st, th, nd
function GetDaySuffix(number) {
    if ((number > 3 && number < 21) || (number > 24 && number < 31)) {
        return number + GetMessageText("daySuffix5");
    }

    number = number + "";

    switch (number.substring(number.length - 1, 1)) {
        case "1" :
            return number + GetMessageText("daySuffix1");
        case "2" :
            return number + GetMessageText("daySuffix2");
        case "3" :
            return number + GetMessageText("daySuffix3");
        case "4" :
            return number + GetMessageText("daySuffix4");
    }
}

function findWithAttr(array, attr, value) {
    for (let i = 0; i < array.length; i += 1) {
        if (array[i][attr] === value) {
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
    return items.sort(function (a, b) {
        return (parseInt(b["order"], 10) - parseInt(a["order"], 10));
    });
}

// gets random numbers for managed feed ids
function GetRandomID() {
    let chars = "0123456789";
    let str = "";
    let rnum;

    for (let i = 0; i < 10; i++) {
        rnum = Math.floor(Math.random() * chars.length);
        if ((i == 0) && (rnum == 0)) {
            while (rnum == 0) {
                rnum = Math.floor(Math.random() * chars.length);
            }
        }
        str += chars.charAt(rnum);
    }

    return str;
}

// helper function for creating new feeds
function CreateNewFeed(title, url, group, maxitems, order, excludeUnreadCount, id) {
    // managed feed doesn't have an id yet
    if (id == null) {
        id = GetRandomID();
    }

    return {
        title: title,
        url: url,
        group: group,
        maxitems: maxitems,
        order: order,
        excludeUnreadCount: excludeUnreadCount,
        id: id
    };
}

function GetReadLaterFeed() {
    return CreateNewFeed(GetMessageText("backReadLater"), chrome.runtime.getURL("readlater.html"), "", 99999, -9, 1, readLaterFeedID);
}

// updates, shows and hides the badge
function UpdateUnreadBadge() {
    if (unreadInfo == null) {
        return;
    }

    let total = 0;
    let str = "";

    for (let key in unreadInfo) {
        if ((key != readLaterFeedID) && (key != allFeedsID)) {
            let filteredfeeds = feeds.find(function (el) {
                return (el.id == key) && (el.excludeUnreadCount == 1);
            });
            if (filteredfeeds == undefined) {
                total = total + unreadInfo[key].unreadtotal;
            }
        }
    }

    if (total > 0) {
        str = total + "";
    }

    // they don't want toolbar unread updates
    if (options.unreadtotaldisplay == 0 || options.unreadtotaldisplay == 2) {
        str = "";
    }

    if (newNotif) {
        NotifyNew();
        newNotif = false;
    }

    unreadTotal = total;

    // update badge
    chrome.action.setBadgeText({text: str});

    // update title
    if (viewerPort != null) {
        viewerPort.postMessage({type: "unreadtotalchanged"});
    }
}

// since the key for unread is the feed id, it's possible that you removed some, as such we should update and clean house
function CleanUpUnreadOrphans() {
    let feedIDs = {};

    for (let key in feeds) {
        feedIDs[feeds[key].id] = 1;
    }

    for (let key in unreadInfo) {
        if (feedIDs[key] == null) {
            delete unreadInfo[key];
        }
    }
    let promiseCleanUpUnreadOrphans = store.setItem('unreadinfo', unreadInfo);

    UpdateUnreadBadge();

    return promiseCleanUpUnreadOrphans;
}

// returns a dictionary of unread counts {feedsid} = unreadtotal, readitems{}
// may need a way to clean this if they delete feeds
function GetUnreadCounts() {
    return store.getItem('unreadinfo').then(function (data) {
        if (data != null) {
            unreadInfo = data;
        } else {
            unreadInfo = {};
            store.setItem('unreadinfo', {});
        }
    }, function (dataError) {
        unreadInfo = {};
        store.setItem('unreadinfo', {});
    });
}

function GetFeedsFilterByGroup(key) {
    let filteredFeeds;
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

function saveReadlaterInfo() {
    return store.setItem('readlaterinfo', readlaterInfo);
}

function FormatDTWithMs(mseconds) {
    let seconds = Math.floor(mseconds / 1000);
    mseconds = mseconds - (seconds * 1000);
    let levels = [
        [Math.floor(seconds / 31536000), 'years'],
        [Math.floor((seconds % 31536000) / 86400), 'days'],
        [Math.floor(((seconds % 31536000) % 86400) / 3600), 'hours'],
        [Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), 'minutes'],
        [(((seconds % 31536000) % 86400) % 3600) % 60, 'seconds'],
    ];
    let returntext = '';

    for (let i = 0, max = levels.length; i < max; i++) {
        if (levels[i][0] === 0) continue;
        returntext += ' ' + levels[i][0] + ' ' + (levels[i][0] === 1 ? levels[i][1].substring(0, levels[i][1].length - 1) : levels[i][1]);
    }
    return (returntext + ' ' + mseconds + 'ms').trim();
}

//remove ReadLater
function filterByID(obj) {
    return ((obj.id != readLaterFeedID) && (obj.id != allFeedsID));
}

function cleanScriptFromHTML(htmlcontent) {
    return DOMPurify.sanitize(htmlcontent);
}

function sortArrayStr(listStr) {
    listStr.sort(function(a, b) {
        let categoryA = a.toUpperCase();
        let categoryB = b.toUpperCase();
        if (categoryA < categoryB) {
            return -1;
        }
        if (categoryA > categoryB) {
            return 1;
        }
        return 0;
    });
    return listStr;
}

function ItemIsRead(feedID, itemID) {
    let currentFeed = feeds.find(function (el) {
        return (el.id == feedID);
    });
    if (currentFeed == readLaterFeedID) {
        return false;
    }
    if (currentFeed != null) {
        if (unreadInfo[currentFeed.id] != undefined) {
            if (unreadInfo[currentFeed.id].readitems != undefined) {
                return (unreadInfo[currentFeed.id].readitems[itemID] != null);
            }
        }
    }
    return false;
}

function NotifyNew() {
    if (options.playSoundNotif) {
        if (Notification.permission == "granted") {
            let NewItems = [];
            let NewItemsCount = 0;

            let keys = Object.keys(feeds);
            for (let i = 0 ; i < keys.length ; i++) {
                let feedTmp = feeds[keys[i]];
                if (feedTmp.id != readLaterFeedID) {
                    let keysInfo = Object.keys(feedInfo[feedTmp.id].items);
                    for (let j = 0; j < keysInfo.length; j++) {
                        let feedInfoTmp = feedInfo[feedTmp.id].items[keysInfo[j]];

                        if (!ItemIsRead(feedTmp.id, feedInfoTmp.itemID)) {
                            if (feedInfoTmp.title != undefined) {
                                NewItemsCount++;
                                NewItems.push({title: feedInfoTmp.title.substring(0,40) + '...', message: ""});
                            } else {
                                if (feedInfoTmp.description != undefined) {
                                    NewItemsCount++;
                                    NewItems.push({title: feedInfoTmp.description.substring(0,30) + '...', message: ""});
                                }
                            }
                            if (NewItemsCount == 4) {
                                break;
                            }
                        }
                    }
                }
                if (NewItemsCount == 4) {
                    break;
                }
            }

            if (NewItemsCount > 0) {
                let NotOpt = {
                    type: "list",
                    title: GetMessageText("NotifyTitle"),
                    message: GetMessageText("NotifyTitle"),
                    iconUrl: manifest.icons[128],
                    items: NewItems
                }
                chrome.notifications.create("SlickRssNewFeeds" + Date().toLocaleString(), NotOpt, function () {
                });
            }
        }
    }
}
