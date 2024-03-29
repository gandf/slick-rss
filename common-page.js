function switchTheme(themesize) {
  let app = document.getElementById("app");
  if (app != null) {
      app.setAttribute('themesize', themesize);
  }
}

function activeDarkMode() {
    switchTheme('' + options.fontSize);
    let keys = Object.keys(document.getElementsByTagName("link"));
    for (let i = 0; i < keys.length; i++) {
        let oldlink = document.getElementsByTagName("link").item(keys[i]);
        oldlink.setAttribute("href", oldlink.getAttribute("href").replace(".", "_dark."));
    }
}

function disableDarkMode() {
    switchTheme('' + options.fontSize);
    let keys = Object.keys(document.getElementsByTagName("link"));
    for (let i = 0; i < keys.length; i++) {
        let oldlink = document.getElementsByTagName("link").item(keys[i]);
        oldlink.setAttribute("href", oldlink.getAttribute("href").replace("_dark.", "."));
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

// gets the feed array for everyone to use
function GetFeedsSimple(callBack) {
    feeds = [];
    getFeedsCallBack = callBack;

    store.getItem('feeds').then(function(datafeeds) {
        if (datafeeds != null) {
            datafeeds.forEach(datafeed => {
                if (datafeed.excludeUnreadCount == undefined) {
                    datafeed.excludeUnreadCount = 0;
                }
            });
            feeds = datafeeds.sort(function (a, b) {
                return a.order - b.order;
            });
        }
        getFeedsCallBack(feeds);
    });
}

function formatBytes(a,b=2){let textBytes=GetMessageText("Bytes");let textKB=GetMessageText("KB");let textMB=GetMessageText("MB");let textGB=GetMessageText("GB");let textTB=GetMessageText("TB");let textPB=GetMessageText("PB");let textEB=GetMessageText("EB");let textZB=GetMessageText("ZB");let textYB=GetMessageText("YB");if(0===a)return`0 ${textBytes}`;const c=0>b?0:b,d=Math.floor(Math.log(a)/Math.log(1024));return parseFloat((a/Math.pow(1024,d)).toFixed(c))+" "+[`${textBytes}`,`${textKB}`,`${textMB}`,`${textGB}`,`${textTB}`,`${textPB}`,`${textEB}`,`${textZB}`,`${textYB}`][d]}

function loadReadlaterInfo() {
    return store.getItem('readlaterinfo').then(function(data) {
        if (data != null) {
            if (data[readLaterFeedID].items.length > 0) {
                readlaterInfo = data;
            }
        }
    });
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
