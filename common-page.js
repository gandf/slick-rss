var manifest = chrome.runtime.getManifest();
var defaultOptions = GetDefaultOptionsPage();
var options = defaultOptions;

if (options.darkmode) {
	activeDarkMode();
} else {
	disableDarkMode();
}

function GetSenderSql() {
    var url = window.location.href;
    var fileName = url.substring(url.lastIndexOf('/') + 1, url.includes('?') ? url.indexOf('?') : url.length);
    return fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
}

function CommWithSQL(request, sender, sendResponse) {

}

function switchTheme(themesize) {
  let app = document.getElementById("app");
  if (app != null) {
      app.setAttribute('themesize', themesize);
  }
}

function activeDarkMode() {
    switchTheme('' + options.fontSize);
    let listcss = document.getElementsByTagName("link");
    let keys = Object.keys(listcss);
    for (let i = 0; i < keys.length; i++) {
        let oldlink = listcss.item(keys[i]);
        let hrefValue = oldlink.getAttribute("href");
        if (!hrefValue.endsWith("_dark.css")) {
            oldlink.setAttribute("href", hrefValue.replace(".", "_dark."));
        }
    }
}

function disableDarkMode() {
    switchTheme('' + options.fontSize);
    let listcss = document.getElementsByTagName("link");
    let keys = Object.keys(listcss);
    for (let i = 0; i < keys.length; i++) {
        let oldlink = listcss.item(keys[i]);
        let hrefValue = oldlink.getAttribute("href");
        if (hrefValue.endsWith("_dark.css")) {
            oldlink.setAttribute("href", hrefValue.replace("_dark.", "."));
        }
    }
}

function GetGroupKeyByID(id) {
    if (groups == null) {
        return null;
    }
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].id == id) {
            return i;
        }
    }
}

function GetFeedInfoItem(feedID, itemIndex) {
    let feedGroupInfo = feedInfo[feedID];

    if (feedGroupInfo == null) {
        feedGroupInfo = feedInfo[groupInfo[feedID].items[itemIndex].idOrigin].items.find(function (el) {
            return (el.itemID == groupInfo[feedID].items[itemIndex].itemID);
        });
        return feedGroupInfo;
    }
    return feedGroupInfo.items[itemIndex];
}

function formatBytes(a,b=2){let textBytes=GetMessageText("Bytes");let textKB=GetMessageText("KB");let textMB=GetMessageText("MB");let textGB=GetMessageText("GB");let textTB=GetMessageText("TB");let textPB=GetMessageText("PB");let textEB=GetMessageText("EB");let textZB=GetMessageText("ZB");let textYB=GetMessageText("YB");if(0===a)return`0 ${textBytes}`;const c=0>b?0:b,d=Math.floor(Math.log(a)/Math.log(1024));return parseFloat((a/Math.pow(1024,d)).toFixed(c))+" "+[`${textBytes}`,`${textKB}`,`${textMB}`,`${textGB}`,`${textTB}`,`${textPB}`,`${textEB}`,`${textZB}`,`${textYB}`][d]}

function loadReadlaterInfo() {
    let resolveLoadReadlaterInfo;
    let waitLoadReadlaterInfo = new Promise((resolve) => {
        resolveLoadReadlaterInfo = resolve;
    });

    sendtoSQL('getReadlaterinfoItem', 'loadReadlaterInfo', true, null, 
        function (data) {
            if (data != null) {
                if (data[0] != undefined) {
                    if (data[0].value != undefined) {
                        if (data[0].value[0] != undefined) {
                            if (data[0].value[0].value != undefined) {
                                //TODO a revoir après
                                readlaterInfo.items = data[0].value[0].value;
                            }
                        }
                    }
                }
            }
            resolveLoadReadlaterInfo();
        }
    );
    
    return waitLoadReadlaterInfo;
}

function GetUnreadCount(feedID){
    let count = 0;
    if (unreadInfo[feedID] != undefined) {
        count = unreadInfo[feedID].unreadtotal;
    }

    if (count == 0) {
        if (unreadInfo[feedID] == undefined) {
            if (feedInfo[feedID] != undefined) {
                if (feedInfo[feedID].items.length > 0) {
                    count = feedInfo[feedID].items.length;
                }
            }
        } else {
            if (unreadInfo[feedID].readitems.length == 0) {
                if (feedInfo[feedID] != undefined) {
                    if (feedInfo[feedID].items.length > 0) {
                        count = feedInfo[feedID].items.length;
                    }
                }
            }
        }
    }
    return count;
}

function GetDefaultOptionsPage() {
    let darkmode = localStorage.getItem('darkmode');
    let fontSize = localStorage.getItem('fontSize');
    let forcelangen = localStorage.getItem('forcelangen');
    if ((darkmode == undefined) || (darkmode == null)) {
        darkmode = true;
    }
    if ((fontSize == undefined) || (fontSize == null)) {
        fontSize = 1;
    } else {
        fontSize = parseInt(fontSize);
        if (fontSize < 1) {
            fontSize = 1;
        }
    }
    if ((forcelangen == undefined) || (forcelangen == null)) {
        forcelangen = false;
    }
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
        "darkmode": darkmode,
        "fontSize": fontSize,
        "forcelangen": forcelangen,
        "levelSearchTag": 5,
        "levelSearchTags": 8,
        "log": false,
        "showGetRSSFeedUrl": true,
        "showsavethisfeed": true,
        "dontreadontitleclick": false,
        "useViewByCategory": false
    };
}
