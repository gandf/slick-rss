// to prevent XSS :(
$(document).ready(function () {
    $('#refreshAll').click(function () {
        bgPage.CheckForUnreadStart();
    });
    $('#markAllRead').click(function () {
        MarkAllFeedsRead();
    });
    $('#refreshButton').click(function () {
        bgPage.CheckForUnreadStart(selectedFeedKey);
    });
    $('#markFeedReadButton').click(function () {
        MarkFeedRead((selectedFeedKeyIsFeed ? feeds[selectedFeedKey].id : groups[selectedFeedKey].id));
    });
});

var bgPage = chrome.extension.getBackgroundPage();
var feeds = bgPage.feeds;
var groups = bgPage.groups;
var selectedFeedKey = null;
var selectedFeedKeyIsFeed = true;
var feedReadToID = null;
var sizeFeedHeader = null;
var sizeFeedsLoadingTxt = null;
var sizeProgressboxLoading = '50px';

var port = chrome.extension.connect({name: "viewerPort"});

port.onMessage.addListener(function (msg) {
    if (msg.type == "feedschanged") {
        location = chrome.extension.getURL("viewer.html");
    }

    if (msg.type == "refreshallstarted") {
        UpdateSizeProgress(false);
        document.getElementById("feedsLoadingProgress").style.width = "0%";
    }

    if (msg.type == "refreshallcomplete") {
        var element1 = document.getElementById("feedsLoading").style.display;
        var element2 = document.getElementById("feedsOptions").style.display;
        element1 = "none";
        element2 = "";
    }

    if (msg.type == "feedupdatestarted") {
        if (!bgPage.refreshFeed) {
            UpdateRefreshAllProgress();
        }
        if (selectedFeedKey != null) {
          if (selectedFeedKeyIsFeed) {
            if (msg.id == feeds[selectedFeedKey].id) {
                document.getElementById("header").className = "loading";
            }
          }
          else {
            if (msg.id == groups[selectedFeedKey].id) {
                document.getElementById("header").className = "loading";
            }
          }
        }
    }

    if (msg.type == "feedupdatecomplete") {
        UpdateFeedUnread(msg.id);

        // refresh page if you are on the one that changed
        if (selectedFeedKey != null) {
          if (selectedFeedKeyIsFeed) {
            if (msg.id == feeds[selectedFeedKey].id) {
                SelectFeed(selectedFeedKey);
                document.getElementById("header").className = "";
            }
          } else {
            if (msg.id == groups[selectedFeedKey].id) {
                SelectFeed(selectedFeedKey);
                document.getElementById("header").className = "";
            }
          }
        }
    }

    if (msg.type == "unreadtotalchanged") {
        UpdateTitle();
    }
});

window.onload = ShowFeeds;
window.onresize = FixFeedList;


function UpdateRefreshAllProgress() {
    if (bgPage.checkingForUnread) {
      var element1 = document.getElementById("feedsOptions").style.display;
      var element2 = document.getElementById("feedsLoading").style.display;
      element1 = "none";
      element2 = "block";
      UpdateSizeProgress(false);
      var ProgressWidth;
      ProgressWidth = (bgPage.refreshFeed) ? 100 : Math.round(((bgPage.checkForUnreadCounter + 1) / feeds.length) * 100);
      if (ProgressWidth > 100) {
        ProgressWidth = 100;
      }
      document.getElementById("feedsLoadingProgress").style.width = ProgressWidth + "%";
  }
}

function UpdateTitle() {
    var title = "Slick RSS" + (selectedFeedKeyIsFeed ? (feeds[selectedFeedKey] ? " [" + feeds[selectedFeedKey].title + "]" : "") : (groups[selectedFeedKey] ? " [" + groups[selectedFeedKey].title + "]" : ""));

    if ((bgPage.options.unreadtotaldisplay == 2 || bgPage.options.unreadtotaldisplay == 3) && bgPage.unreadTotal > 0) {
        title += " (" + bgPage.unreadTotal + ")";
    }

    document.title = title;
    document.getElementById("markAllRead").style.display = (bgPage.unreadTotal > 0) ? "" : "none";
}

function ShowFeeds() {
    var feedArea = null;
    var selectKey = null;
    var lastSelectedID = localStorage["lastSelectedFeedID"];
    var lastSelectedType = localStorage["lastSelectedFeedType"];

    UpdateTitle();
    document.getElementById("manage").style.display = "";

    if (bgPage.options.readlaterenabled) {
      ShowFeed(0);
      if (selectKey == null) {
          selectKey = 0;
      }
    }

    for (key in groups) {
      ShowGroup(key);

      if ((groups[key].id == lastSelectedID) && (lastSelectedType == "Group")) {
          selectKey = key;
      }
    }

    for (key in feeds) {
        if (key == 0) {
            continue;
        }

        ShowFeed(key);

        if (selectKey == null) {
            selectKey = key;
        }

        if ((feeds[key].id == lastSelectedID) && (lastSelectedType == "Feed")) {
            selectKey = key;
        }
    }

    if ((lastSelectedType == "Group") && (groups[selectKey]) == null) {
        if (groups.length == 0) {
            lastSelectedType = "Feed";
        }
        selectKey = 0;
    }

    document.getElementById("headerMessage").innerText = GetMessageText("backViewerFeedMe");
    if (lastSelectedType != "Group") {
      if (feeds.length == 0 || (feeds.length == 1 && bgPage.feedInfo[bgPage.readLaterFeedID].items.length == 0)) {
          document.getElementById("feedHeader").style.display = "none";
          document.getElementById("feedArea").style.display = "none";
          document.getElementById("refresh").style.display = "none";
          document.getElementById("markFeedRead").style.display = "none";
          document.getElementById("noFeedsManaged").style.display = "";
      } else {
          SelectFeed(selectKey);
      }
    } else {
      SelectGroup(selectKey);
    }

    // in the middle of refresh all, show progress but wait a little so feed content pushes the feed list to the right size
    // this is only here to show progress on load when current loading feed is slow, otherwise the next feed will update the progress
    if (bgPage.checkingForUnread && !bgPage.refreshFeed) {
        setTimeout(UpdateRefreshAllProgress, 500);
    }

    focusFeed();
    UpdateSizeProgress(true);
}

function FixFeedList() {
    var feedScroller = document.getElementById("feedScroller");
    var feedPreviewScroller = document.getElementById("feedPreviewScroller");
    var header = document.getElementById("header");

    feedPreviewScroller.style.height = (document.body.offsetHeight - header.offsetHeight) + "px";
    feedPreviewScroller.style.width = (window.innerWidth - feedScroller.offsetWidth) + "px"; // some feeds don't wrap well so we must force a strict width

    feedScroller.style.height = document.body.offsetHeight - document.getElementById("feedHeader").offsetHeight + "px";
    feedScroller.style.overflowY = (feedScroller.offsetHeight < feedScroller.scrollHeight) ? "scroll" : "hidden";
    UpdateSizeProgress(true);
}

function ShowFeed(key) {
    var li = document.createElement("li");
    var span = document.createElement("span");

    li.innerText = feeds[key].title;
    li.setAttribute("id", "feedTitle" + feeds[key].id);
    li.setAttribute("feedType", "feed");
    span.setAttribute("id", "feedUnread" + feeds[key].id);

    $(li).click(function () {
        selectedFeedKeyIsFeed = true;
        SelectFeed(key);
        focusFeed();
        UpdateTitle();
        return false;
    });

    li.appendChild(span);

    document.getElementById("feedList").appendChild(li);

    UpdateFeedUnread(feeds[key].id);
}

function ShowGroup(key) {
    var li = document.createElement("li");
    var span = document.createElement("span");

    li.innerText = groups[key].title;
    li.setAttribute("id", "feedTitle" + groups[key].id);
    li.setAttribute("feedType", "group");
    span.setAttribute("id", "feedUnread" + groups[key].id);

    $(li).click(function () {
        selectedFeedKeyIsFeed = false;
        SelectGroup(key);
        focusFeed();
        UpdateTitle();
        return false;
    });

    li.appendChild(span);

    document.getElementById("feedList").appendChild(li);

    UpdateGroupUnread(key);
    FixFeedList();
}

function focusFeed() {
    var feedPreview = document.getElementById("feedPreview");
    feedPreview.focus();
}

// updates a feed item's unread count
function UpdateFeedUnread(id) {
    if (bgPage.unreadInfo[id] == null || !bgPage.options.unreaditemtotaldisplay) {
        return;
    }

    var count = bgPage.unreadInfo[id].unreadtotal;

    if (count > 0) {
        document.getElementById("feedTitle" + id).style.fontWeight = "bold";
        document.getElementById("feedUnread" + id).innerText = " (" + count + ")";
    } else {
        document.getElementById("feedTitle" + id).style.fontWeight = "normal";
        document.getElementById("feedUnread" + id).innerText = "";
    }
    if (bgPage.options.showallfeeds) {
      UpdateGroupUnread(0);
    }
    var currentFeed = bgPage.feeds.find(function (el) {
      return (el.id == id);
    });
    if (currentFeed != null) {
        if (currentFeed.group != "") {
          for (var i = 1; i < bgPage.groups.length; i++) {
            if (bgPage.groups[i].group == currentFeed.group) {
              UpdateGroupUnread(i);
              break;
            }
          }
        }
    }
    FixFeedList();
}

// updates a group item's unread count
function UpdateGroupUnread(key) {
    if (groups[key] == null) {
      return;
    }
    var id = groups[key].id;

    if (!bgPage.options.unreaditemtotaldisplay) {
        return;
    }

    var count = bgPage.CalcGroupCountUnread(key);

    if (document.getElementById("feedTitle" + id) != null) {
      if (count > 0) {
            document.getElementById("feedTitle" + id).style.fontWeight = "bold";
            document.getElementById("feedUnread" + id).innerText = " (" + count + ")";
      } else {
          document.getElementById("feedTitle" + id).style.fontWeight = "normal";
          document.getElementById("feedUnread" + id).innerText = "";
      }
    }
}

function UpdateReadAllIcon(type) {
    var count = 0;
    if (bgPage.unreadInfo != null) {
      if (type == "Feed") {
        if (bgPage.unreadInfo[feeds[selectedFeedKey].id] != null) {
            count = bgPage.unreadInfo[feeds[selectedFeedKey].id].unreadtotal;
        }
      } else {
        count = bgPage.CalcGroupCountUnread(selectedFeedKey);
      }
    }

    document.getElementById("markFeedRead").style.display = (count > 0) ? "" : "none";
}

// marks everything but ReadLater read
function MarkAllFeedsRead() {
    var id;

    for (var i = 0; i < feeds.length; i++) {
        id = feeds[i].id;

        if (id != bgPage.readLaterFeedID) {
            MarkFeedRead(id);
        }
    }

    // this helps the refresh all progress bar be the right width
    FixFeedList();
}

// marks a feed read.
function MarkFeedRead(feedID) {
    var container = null;
    var itemID = null;
    var className = (bgPage.options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";
    var expireMs = new Date().getTime() + 5184000000; // 2 months;
    var groupKey = null;

    if (selectedFeedKeyIsFeed) {
      if (bgPage.unreadInfo[feedID].unreadtotal == 0) {
          return;
      }

      bgPage.unreadInfo[feedID].unreadtotal = 0;

      // for read later feeds, nuke the items instead of mark read
      if (feedID == bgPage.readLaterFeedID) {
          bgPage.feedInfo[bgPage.readLaterFeedID].items = [];
          localStorage["readlater"] = JSON.stringify(bgPage.feedInfo[bgPage.readLaterFeedID]);
          SelectFeed(0);
      } else {
          for (var i = 0; i < bgPage.feedInfo[feedID].items.length; i++) {
              itemID = sha256(bgPage.feedInfo[feedID].items[i].title + bgPage.feedInfo[feedID].items[i].date);
              bgPage.unreadInfo[feedID].readitems[itemID] = expireMs;
              container = document.getElementById("item_" + feedID + "_" + itemID);

              if (container != null) {
                  container.className = container.className + className;
              }
          }
      }

      localStorage["unreadinfo"] = JSON.stringify(bgPage.unreadInfo);

      UpdateFeedUnread(feedID);
      UpdateReadAllIcon("Feed");
      bgPage.UpdateUnreadBadge();
    } else {
      groupKey = bgPage.GetGroupKeyByID(feedID);
      if (groupKey != null) {
        if (groups[groupKey] != null) {
          var feedFilteredList = [];
          if (groups[groupKey].id != bgPage.allFeedsID) {
            feedFilteredList = bgPage.GetFeedsFilterByGroup(groupKey);
          } else {
            feedFilteredList = feeds.filter(function (el) {
              return (el.id != bgPage.readLaterFeedID);
            });
          }
          if (feedFilteredList.length > 0) {
            feedFilteredList.forEach((item) => {
              MarkFeedReadFromGroup(item.id);
            });

            UpdateReadAllIcon("Group");
            bgPage.UpdateUnreadBadge();
          }
        }
      }
    }
}

// marks a feed read from group.
function MarkFeedReadFromGroup(feedID) {
    var container = null;
    var itemID = null;
    var className = (bgPage.options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";
    var expireMs = new Date().getTime() + 5184000000; // 2 months;
    var groupKey = null;

      if (bgPage.unreadInfo[feedID].unreadtotal == 0) {
          return;
      }

      bgPage.unreadInfo[feedID].unreadtotal = 0;

      for (var i = 0; i < bgPage.feedInfo[feedID].items.length; i++) {
          itemID = sha256(bgPage.feedInfo[feedID].items[i].title + bgPage.feedInfo[feedID].items[i].date);
          bgPage.unreadInfo[feedID].readitems[itemID] = expireMs;
          container = document.getElementById("item_" + feedID + "_" + itemID);

          if (container != null) {
              container.className = container.className + className;
          }
      }

      localStorage["unreadinfo"] = JSON.stringify(bgPage.unreadInfo);

      UpdateFeedUnread(feedID);
}

function MarkItemRead(itemID) {
    var feedID;
    if (selectedFeedKeyIsFeed) {
      feedID = feeds[selectedFeedKey].id;
    } else {
      var newitem = bgPage.groupInfo[groups[selectedFeedKey].id].items.find(function (el) {
        return el.itemID == itemID;
      });
      feedID = newitem.idOrigin;
    }
    var className = (bgPage.options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";
    var expireMs = new Date().getTime() + 5184000000; // 2 months;

    if (MarkItemRead_ReadItems(feedID, itemID, expireMs, className) == true) {
        localStorage["unreadinfo"] = JSON.stringify(bgPage.unreadInfo);

        UpdateFeedUnread(feedID);
        UpdateReadAllIcon((selectedFeedKeyIsFeed) ? "Feed" : "Group");
        bgPage.UpdateUnreadBadge();
    }
}

function MarkItemRead_ReadItems(feedID, itemID, expireMs, className){
  if (bgPage.unreadInfo[feedID].readitems[itemID] == null) {
      var element = document.getElementById("item_" + feedID + "_" + itemID);
      if (element != null) {
        element.className += className;
      }
      //group
      //Get feed to find group name
      var currentFeed = feeds.find(function (el) {
        return (el.id == feedID);
      });
      if (currentFeed != null) {
        //search group by name
        var currentGroup = groups.find(function (el) {
          return (el.title == currentFeed.group);
        });
        if (currentGroup != null) {
            element = document.getElementById("item_" + currentGroup.id + "_" + itemID);
            if (element != null) {
              element.className += className;
            }
        }
      }

      if (bgPage.options.showallfeeds == true) {
          element = document.getElementById("item_" + bgPage.allFeedsID + "_" + itemID);
          if (element != null) {
            element.className += className;
          }
      }

      bgPage.unreadInfo[feedID].unreadtotal--;
      bgPage.unreadInfo[feedID].readitems[itemID] = expireMs;
      return true;
  }
  return false;
}

function MarkItemUnread(itemID) {
    var feedID;
    var element;

    if (selectedFeedKeyIsFeed) {
      feedID = feeds[selectedFeedKey].id;
    } else {
      var newitem = bgPage.groupInfo[groups[selectedFeedKey].id].items.find(function (el) {
        return el.itemID == itemID;
      });
      feedID = newitem.idOrigin;
    }
    var className = (bgPage.options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";

    if (bgPage.unreadInfo[feedID].readitems[itemID] != null) {
        delete bgPage.unreadInfo[feedID].readitems[itemID];
        if (selectedFeedKeyIsFeed) {
          element = document.getElementById("item_" + feedID + "_" + itemID);
          if (element != null) {
              element.className = element.className.replace(className, "");
          }
        } else {
          //group
          //Get feed to find group name
          var currentFeed = feeds.find(function (el) {
            return (el.id == feedID);
          });
          if (currentFeed != null) {
            //search group by name
            var currentGroup = groups.find(function (el) {
              return (el.title == currentFeed.group);
            });
            if (currentGroup != null) {
                element = document.getElementById("item_" + currentGroup.id + "_" + itemID);
                if (element != null) {
                  element.className = element.className.replace(className, "");
                }
            }
          }
        }
        if (bgPage.options.showallfeeds == true) {
            element = document.getElementById("item_" + bgPage.allFeedsID + "_" + itemID);
            if (element != null) {
              element.className = element.className.replace(className, "");
            }
        }

        bgPage.unreadInfo[feedID].unreadtotal++;

        UnMarkItemReadLaterWithoutSelectFeed(findWithAttr(bgPage.feedInfo[bgPage.readLaterFeedID].items, 'itemID', itemID));

        localStorage["unreadinfo"] = JSON.stringify(bgPage.unreadInfo);

        UpdateFeedUnread(bgPage.readLaterFeedID);
        UpdateFeedUnread(feedID);
        UpdateReadAllIcon((selectedFeedKeyIsFeed) ? "Feed" : "Group");
        bgPage.UpdateUnreadBadge();
    }
}

function MarkItemReadLater(feedID, itemIndex) {
    var currentItem = bgPage.GetFeedInfoItem(feedID, itemIndex);
    var itemID = sha256(currentItem.title + currentItem.date);

    bgPage.feedInfo[bgPage.readLaterFeedID].items.push(currentItem);
    bgPage.unreadInfo[bgPage.readLaterFeedID].unreadtotal++;

    MarkItemRead(itemID);
    UpdateFeedUnread(bgPage.readLaterFeedID);

    localStorage["readlater"] = JSON.stringify(bgPage.feedInfo[bgPage.readLaterFeedID]);
}

function UnMarkItemReadLater(itemIndex) {
    if (itemIndex >= 0) {
        UnMarkItemReadLaterWithoutSelectFeed(itemIndex);
        SelectFeed(0);
    }
}

function UnMarkItemReadLaterWithoutSelectFeed(itemIndex) {
    if (itemIndex >= 0) {
        bgPage.unreadInfo[bgPage.readLaterFeedID].unreadtotal--;
        bgPage.feedInfo[bgPage.readLaterFeedID].items.splice(itemIndex, 1);
        bgPage.UpdateUnreadBadge();

        localStorage["readlater"] = JSON.stringify(bgPage.feedInfo[bgPage.readLaterFeedID]);

        UpdateFeedUnread(bgPage.readLaterFeedID);
    }
}

function SelectFeed(key) {
    SelectFeedOrGroup(key, "Feed");
}

function SelectGroup(key) {
    SelectFeedOrGroup(key, "Group");
}

function SelectFeedOrGroup(key, type) {
    var feedsOrGroups, feedsOrGroupsInfo, selectedFeedsOrGroups;
    var lastSelectedFeedID = localStorage["lastSelectedFeedID"];
    if (localStorage["lastSelectedFeedType"] == "Feed") {
      selectedFeedsOrGroups = feeds;
    } else {
      selectedFeedsOrGroups = groups;
    }

    if (type == "Feed") {
      feedsOrGroups = feeds;
      feedsOrGroupsInfo = bgPage.feedInfo;
    } else {
      feedsOrGroups = groups;
      feedsOrGroupsInfo = bgPage.groupInfo;
    }
    localStorage["lastSelectedFeedID"] = feedsOrGroups[key].id;
    localStorage["lastSelectedFeedType"] = type;

    document.getElementById("feedPreviewScroller").scrollTop = 0;

    clearTimeout(feedReadToID);

    if (selectedFeedKey != null) {
        document.getElementById("feedTitle" + selectedFeedsOrGroups[selectedFeedKey].id).setAttribute("class", "");
    }

    document.getElementById("feedTitle" + feedsOrGroups[key].id).setAttribute("class", "selectedFeed");

    selectedFeedKey = key;
    selectedFeedKeyIsFeed = (type == "Feed");
    UpdateTitle();

    // clear the slate
    var el = document.getElementById("feedPreview");

    while (el.childNodes.length >= 1) {
        el.removeChild(el.firstChild);
    }

    // clear the slate
    document.getElementById("markFeedRead").style.display = "none";
    document.getElementById("header").className = "";
    document.getElementById("feedError").style.display = "none";
    document.getElementById("noItems").style.display = "none";
    document.getElementById("refresh").style.display = (feedsOrGroups[key].id != bgPage.readLaterFeedID) ? "" : "none";

    // feed isn't ready yet
    if (feedsOrGroupsInfo[feedsOrGroups[key].id] == null || feedsOrGroupsInfo[feedsOrGroups[key].id].loading) {
      document.getElementById("refresh").style.display = "none";
        document.getElementById("headerMessage").innerText = GetMessageText("backViewerLoadingFeed");
        document.getElementById("header").className = "loading";

        if (type == "Feed") {
        // must be a new feed with no content yet
        if (feedsOrGroupsInfo[feedsOrGroups[key].id] == null && !bgPage.checkingForUnread) {
            bgPage.CheckForUnreadStart(key);
        }
        return;
    }
  }

    // feed loaded, but had an error
    if (feedsOrGroupsInfo[feedsOrGroups[key].id] != null) {
      if (feedsOrGroupsInfo[feedsOrGroups[key].id].error != "") {
          ShowFeedError(feedsOrGroupsInfo[feedsOrGroups[key].id].error);
          return;
      }
      document.getElementById("noItems").style.display = (feedsOrGroupsInfo[feedsOrGroups[key].id].items.length == 0) ? "" : "none";
    }

    RenderFeed(type);
    UpdateReadAllIcon(type);
    FixFeedList(); // in case header wraps

    if (bgPage.options.markreadafter > 0 && key != 0) {
        feedReadToID = setTimeout(function () {
            MarkFeedRead(feedsOrGroups[key].id)
        }, bgPage.options.markreadafter * 1000);
    }
}

function RenderFeed(type) {
    var masterSummary = null;
    var masterTitle = null;
    var itemID = null;
    var feedTitle = null;
    var feedLink = null;
    var feedReadLater = null;
    var feedContainer = null;
    var feedPublished = null;
    var feedMarkRead = null;
    var feedSummary = null;
    var feedAuthor = null;
    var dateTime = null;
    var link = null;
    var summaryLinks = null;
    var summaryImages = null;
    var summaryObjects = null;
    var item = null;
    var feedsOrGroups = (type == "Feed") ? feeds : groups;
    var feedsOrGroupsInfo = (type == "Feed") ? bgPage.feedInfo : bgPage.groupInfo;
    var feedID = feedsOrGroups[selectedFeedKey].id;
    var currentTr = null;
    var columnCount = 0;
    var colWidth = null;
    var feedTd = null;
    var href = "";

    if (feedsOrGroupsInfo[feedID] == null) {
      return;
    }

    document.getElementById("headerMessage").innerText = feedsOrGroupsInfo[feedID].title;

    if (feedsOrGroupsInfo[feedID].description != "" && bgPage.options.showdescriptions) {
        document.getElementById("headerMessage").innerHTML += "<span> : " + feedsOrGroupsInfo[feedID].description + "</span>";
    }

    switch (parseInt(bgPage.options.columns)) {
        case 1:
            colWidth = "100%";
            break;
        case 2:
            colWidth = "50%";
            break;
        case 3:
            colWidth = "33%";
            break;
        case 4:
            colWidth = "25%";
            break;
        default :
        colWidth = "100%";
    }
    var feedBaseUrl = (new URL(feedsOrGroups[selectedFeedKey].url)).origin;

    for (var i = 0; i < feedsOrGroupsInfo[feedID].items.length && i < feedsOrGroups[selectedFeedKey].maxitems; i++) {
        item = feedsOrGroupsInfo[feedID].items[i];
        itemID = sha256(item.title + item.date);

        feedMarkRead = null;
        feedMarkRead = document.createElement("img");
        feedMarkRead.setAttribute("src", "x.gif");
        feedMarkRead.setAttribute("onmouseover", "hover(this);");
        feedMarkRead.setAttribute("onmouseout", "unhover(this);");

        if (feedID == bgPage.readLaterFeedID) {
            $(feedMarkRead).click({i: i}, function (event) {
                UnMarkItemReadLater(event.data.i);
                return false;
            });
        } else {
            $(feedMarkRead).click({itemID: itemID}, function (event) {
                MarkItemRead(event.data.itemID);
                return false;
            });
        }

        feedMarkRead.title = GetMessageText("backViewerMarkRead");
        feedMarkRead.setAttribute("class", "feedPreviewMarkRead");

        feedLink = document.createElement("a");
        href = item.url;
        href.startsWith("/") && !href.startsWith("//") && (href = feedBaseUrl + href);
        feedLink.setAttribute("href", href);
        feedLink.innerText = (i + 1) + ". " + item.title;

        $(feedLink).click({url: href}, function (event) {
            LinkProxy(event.data.url);
            return false;
        });

        if (feedID == bgPage.readLaterFeedID) {
            if (bgPage.options.readlaterremovewhenviewed) {
                $(feedLink).click({i: i}, function (event) {
                    UnMarkItemReadLater(event.data.i);
                    return false;
                });
            }
        } else {
            $(feedLink).click({feedID: feedID, itemID: itemID}, function (event) {
                MarkItemRead(event.data.itemID);
                if (bgPage.options.markreadonclick) {
                    MarkFeedRead(event.data.feedID);
                }
                return false;
            });
        }

        feedTitle = document.createElement("h2");
        feedTitle.setAttribute("class", "feedPreviewTitle");
        feedTitle.appendChild(feedMarkRead);

        if (bgPage.options.readlaterenabled && feedID != bgPage.readLaterFeedID) {
            feedReadLater = document.createElement("img");
            feedReadLater.setAttribute("src", "star.gif");
            feedReadLater.setAttribute("onmouseover", "hover(this);");
            feedReadLater.setAttribute("onmouseout", "unhover(this);");
            feedReadLater.setAttribute("class", "feedPreviewReadLater");
            feedReadLater.setAttribute("title", GetMessageText("backReadLater"));
            $(feedReadLater).click({feedID: feedID, i: i}, function (event) {
                MarkItemReadLater(event.data.feedID, event.data.i);
                return false;
            });
            feedTitle.appendChild(feedReadLater);

            feedUnread = document.createElement("img");
            feedUnread.setAttribute("src", "revert.png");
            feedUnread.setAttribute("onmouseover", "hover(this);");
            feedUnread.setAttribute("onmouseout", "unhover(this);");
            feedUnread.setAttribute("class", "feedPreviewUnread");
            feedUnread.setAttribute("title", GetMessageText("backViewerMarkUnread"));
            feedUnread.setAttribute("display", "none");
            $(feedUnread).click({itemID: itemID}, function (event) {
                MarkItemUnread(event.data.itemID);
                return false;
            });

            feedTitle.appendChild(feedUnread);
        }

        feedTitle.appendChild(feedLink);

        feedPublished = document.createElement("div");
        feedPublished.setAttribute("class", "feedPreviewDate");
        feedPublished.appendChild(document.createTextNode(bgPage.GetFormattedDate(item.date)));

        feedAuthor = document.createElement("div");
        feedAuthor.setAttribute("class", "feedPreviewAuthor");
        feedAuthor.innerText = item.author;

        feedSummary = document.createElement("div");
        feedSummary.setAttribute("class", "feedPreviewSummary");
        if ((bgPage.options.feedsmaxheight != null) && (bgPage.options.feedsmaxheight != 0)) {
          feedSummary.style.maxHeight = bgPage.options.feedsmaxheight + "px";
        } else {
          feedSummary.style.maxHeight = "none";
        }
        if (bgPage.options.usethumbnail && (item.thumbnail != null)) {
          feedSummary.innerHTML = item.thumbnail + item.content.replace(/style/g, 'sty&#108;e').replace(/width/g, 'w&#105;dth');
        } else {
          feedSummary.innerHTML = item.content.replace(/style/g, 'sty&#108;e').replace(/width/g, 'w&#105;dth');
        }

        feedContainer = document.createElement("div");
        feedContainer.setAttribute("id", "item_" + feedID + "_" + itemID);

        if (bgPage.ItemIsRead((feedID != bgPage.readLaterFeedID) ? feedsOrGroupsInfo[feedID].items[i].idOrigin : bgPage.readLaterFeedID, itemID)) {
            if (bgPage.options.readitemdisplay == 0) {
                feedContainer.setAttribute("class", "feedPreviewContainer feedPreviewContainerRead");
            } else {
                feedContainer.setAttribute("class", "feedPreviewContainer feedPreviewContainerRead feedPreviewContainerCondensed");
            }
        } else {
            feedContainer.setAttribute("class", "feedPreviewContainer");
        }

        // make all summary links open a new tab
        summaryLinks = feedSummary.getElementsByTagName("a");
        for (var l = 0; l < summaryLinks.length; l++) {
            href = summaryLinks[l].getAttribute("href");

            $(summaryLinks[l]).click({href: href}, function (event) {
                LinkProxy(event.data.href);
                return false;
            });

            if (feedID == bgPage.readLaterFeedID) {
                if (bgPage.options.readlaterremovewhenviewed) {
                    $(summaryLinks[l]).click({i: i}, function (event) {
                        UnMarkItemReadLater(event.data.i);
                        return false;
                    });
                }
            } else {
                $(summaryLinks[l]).click({itemID: itemID}, function (event) {
                    MarkItemRead(event.data.itemID);
                    return false;
                });
            }
        }

        // show snug images, or nuke them
        summaryImages = feedSummary.getElementsByTagName("img");
        for (var q = summaryImages.length - 1; q >= 0; q--) {
            if (bgPage.options.showfeedimages) {
                summaryImages[q].style.maxWidth = "95%";
                summaryImages[q].style.width = "";
                summaryImages[q].style.height = "";
                summaryImages[q].removeAttribute("width");
                summaryImages[q].removeAttribute("height");
            } else {
                summaryImages[q].parentNode.removeChild(summaryImages[q]);
            }
        }

        // show snug objects, or nuke them
        summaryObjects = feedSummary.getElementsByTagName("object");
        for (var o = summaryObjects.length - 1; o >= 0; o--) {
            if (!bgPage.options.showfeedobjects) {
                summaryObjects[o].parentNode.removeChild(summaryObjects[o]);
            } else {
                summaryObjects[o].style.maxWidth = "95%";
                summaryObjects[o].style.width = "";
                summaryObjects[o].style.height = "";
                summaryObjects[o].removeAttribute("width");
                summaryObjects[o].removeAttribute("height");
            }
        }

        // show snug objects, or nuke them
        summaryObjects = feedSummary.getElementsByTagName("embed");
        for (var o = summaryObjects.length - 1; o >= 0; o--) {
            if (!bgPage.options.showfeedobjects) {
                summaryObjects[o].parentNode.removeChild(summaryObjects[o]);
            } else {
                summaryObjects[o].style.maxWidth = "95%";
                summaryObjects[o].style.width = "";
                summaryObjects[o].style.height = "";
                summaryObjects[o].removeAttribute("width");
                summaryObjects[o].removeAttribute("height");
            }
        }


        // show snug iframes, or nuke them
        summaryObjects = feedSummary.getElementsByTagName("iframe");
        for (var o = summaryObjects.length - 1; o >= 0; o--) {
            if (!bgPage.options.showfeediframes) {
                summaryObjects[o].parentNode.removeChild(summaryObjects[o]);
            } else {
                summaryObjects[o].style.maxWidth = "95%";
                summaryObjects[o].style.width = "";
                summaryObjects[o].style.height = "";
                summaryObjects[o].removeAttribute("width");
                summaryObjects[o].removeAttribute("height");
            }
        }

        if (columnCount == bgPage.options.columns) {
            columnCount = 0;
        }

        if (columnCount == 0) {
            currentTr = document.createElement("tr");
            document.getElementById("feedPreview").appendChild(currentTr);
        }


        feedContainer.appendChild(feedTitle);
        feedContainer.appendChild(feedSummary);
        feedContainer.appendChild(feedPublished);
        feedContainer.appendChild(feedAuthor);

        feedTd = document.createElement("td");
        feedTd.style.width = colWidth;
        feedTd.appendChild(feedContainer);

        currentTr.appendChild(feedTd);
        columnCount++;
    }
}

function ShowFeedError(message) {
    document.getElementById("feedError").style.display = "";
    document.getElementById("feedErrorMessage").innerText = message;
    document.getElementById("headerMessage").innerText = GetMessageText("backViewerFeedIssue");
}

// central function to control creation of tabs so we can put them in the background
function LinkProxy(uRL) {
    chrome.tabs.create({url: uRL, selected: !bgPage.options.loadlinksinbackground});
}

function hover(element) {
  if (!element.getAttribute('src').includes("_hover.")) {
    element.setAttribute('src', element.getAttribute('src').replace(".", "_hover."));
  }
}

function unhover(element) {
  if (element.getAttribute('src').includes("_hover.")) {
    element.setAttribute('src', element.getAttribute('src').replace("_hover.", "."));
  }
}

function UpdateSizeProgress(updateAll) {
    if ((sizeFeedHeader == null) || updateAll) {
      var localSizeFeedHeader = document.getElementById("feedHeader").offsetWidth;
      if ((localSizeFeedHeader != 0) && !isNaN(localSizeFeedHeader)) {
        sizeFeedHeader = localSizeFeedHeader;
      }
    }
    if ((sizeFeedsLoadingTxt == null) || updateAll) {
      var elFeedsLoadingTxt = document.getElementById("feedsLoadingTxt");
      var localSizeFeedsLoadingTxt = null;
      if (elFeedsLoadingTxt != null) {
        if (elFeedsLoadingTxt.offsetWidth > 0) {
          localSizeFeedsLoadingTxt = elFeedsLoadingTxt.offsetWidth + 42;
        }
      }
      if ((localSizeFeedsLoadingTxt != null) && (localSizeFeedsLoadingTxt >= 30) && !isNaN(localSizeFeedsLoadingTxt)) {
        sizeFeedsLoadingTxt = localSizeFeedsLoadingTxt;
      }
    }
    if ((sizeFeedHeader != null) && (sizeFeedsLoadingTxt != null)) {
      var computedSize = sizeFeedHeader - sizeFeedsLoadingTxt;
      if (computedSize < 30) {
        sizeProgressboxLoading = '100%';
      } else {
        sizeProgressboxLoading = computedSize + 'px';
      }
      if (document.getElementById("feedsLoadingProgressBox").style.width != sizeProgressboxLoading) {
        document.getElementById("feedsLoadingProgressBox").style.width = sizeProgressboxLoading;
      }
    }
}
