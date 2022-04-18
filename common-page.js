var isServiceWorker = false;

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

function GetFeedInfoItem(feedID, itemIndex) {
    var feedGroupInfo = feedInfo[feedID];

    if (feedGroupInfo == null) {
      feedGroupInfo = feedInfo[parseInt(groupInfo[feedID].items[itemIndex].idOrigin, 10)].items.find(function (el) {
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
        feeds = datafeeds.sort(function (a, b) {
            return a.order - b.order;
        });
    }
    getFeedsCallBack(feeds);
  });
}

function formatBytes(a,b=2){var textBytes=GetMessageText("Bytes");var textKB=GetMessageText("KB");var textMB=GetMessageText("MB");var textGB=GetMessageText("GB");var textTB=GetMessageText("TB");var textPB=GetMessageText("PB");var textEB=GetMessageText("EB");var textZB=GetMessageText("ZB");var textYB=GetMessageText("YB");if(0===a)return`0 ${textBytes}`;const c=0>b?0:b,d=Math.floor(Math.log(a)/Math.log(1024));return parseFloat((a/Math.pow(1024,d)).toFixed(c))+" "+[`${textBytes}`,`${textKB}`,`${textMB}`,`${textGB}`,`${textTB}`,`${textPB}`,`${textEB}`,`${textZB}`,`${textYB}`][d]}
