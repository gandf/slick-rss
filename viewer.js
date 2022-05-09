// to prevent XSS :(
$(document).ready(function () {
    $('#refreshAll').click(function () {
        chrome.runtime.sendMessage({"type": "checkForUnread"}).then(function(){ });
    });
    $('#markAllRead').click(function () {
        MarkAllFeedsRead();
    });
    $('#refreshButton').click(function () {
        chrome.runtime.sendMessage({"type": "checkForUnreadOnSelectedFeed", "selectedFeedKey": selectedFeedKey}).then(function(){ });
    });
    $('#markFeedReadButton').click(function () {
        MarkFeedRead((selectedFeedKeyIsFeed ? feeds[selectedFeedKey].id : groups[selectedFeedKey].id));
    });
    $('#openAllFeedButton').click(function () {
        OpenAllFeedButton((selectedFeedKeyIsFeed ? feeds[selectedFeedKey].id : groups[selectedFeedKey].id));
    });
});

var showFeedsWork = false;

waitOptionReady().then(function () {
    if (options.darkmode) {
        activeDarkMode();
    } else {
        disableDarkMode();
    }

    if (options.readlaterenabled) {
        loadReadlaterInfo();
    }
});

store.getItem('unreadinfo').then(function(data){
    if (data != null) {
        unreadInfo = data;
    }
});

var selectedFeedKey = null;
var selectedFeedKeyIsFeed = true;
var feedReadToID = null;
var sizeFeedHeader = null;
var sizeFeedsLoadingTxt = null;
var sizeProgressboxLoading = '50px';
var showingFeeds = false;
var readingFeeds = false;

var port = chrome.runtime.connect({name: "viewerPort"});

port.onMessage.addListener(function (msg) {
    if (msg.type == "feedschanged") {
        location = chrome.runtime.getURL("viewer.html");
    }

    if (msg.type == "refreshallstarted") {
        UpdateSizeProgress(false);
        document.getElementById("feedsLoadingProgress").style.width = "0%";
        document.getElementById("feedsLoading").style.display = "block";
        document.getElementById("feedsOptions").style.display = "none";
    }

    if (msg.type == "refreshallcomplete") {
        document.getElementById("feedsLoading").style.display = "none";
        document.getElementById("feedsOptions").style.display = "";
    }

    if (msg.type == "feedupdatecomplete") {
        UpdateDataFromWorker();
        UpdateFeedUnread(msg.id);

        // refresh page if you are on the one that changed
        if (selectedFeedKey != null) {
            if (selectedFeedKeyIsFeed) {
                if (msg.id == feeds[selectedFeedKey].id) {
                    document.getElementById("header").className = "";
                }
            } else {
                if (msg.id == groups[selectedFeedKey].id) {
                    document.getElementById("header").className = "";
                }
            }
        }
        if (!showFeedsWork && !showingFeeds) {
            ShowFeeds();
        }
    }

    if (msg.type == "unreadtotalchanged") {
        UpdateTitle();
    }

    if (msg.type == "playSound") {
        var audio = new Audio('Glisten.ogg');
        audio.addEventListener('ended', ReloadViewer);
        audio.play();
    }

    if (msg.type == "progressLoading") {
        UpdateLoadingProgress(msg.currentFeeds, msg.currentFeedsCount);
    }
});

function ReloadViewer() {
    chrome.tabs.reload();
}

UpdateDataFromWorker();

window.onload = ShowFeeds;
window.onresize = FixFeedList;

function UpdateDataFromWorker(){
    readingFeeds = true;
    chrome.runtime.sendMessage({"type": "getFeedsAndGroupsInfo"}).then(function(data){
        if (data != undefined) {
            var localData = JSON.parse(data);
            if (localData.feeds != undefined) {
                feeds = GetObjectFromStr(localData.feeds);
            }
            if (localData.feedInfo != undefined) {
                feedInfo = GetObjectFromStr(localData.feedInfo);
            }
            if (localData.groups != undefined) {
                groups = GetObjectFromStr(localData.groups);
            }
            if (localData.groupInfo != undefined) {
                groupInfo = GetObjectFromStr(localData.groupInfo);
            }
            if (localData.unreadInfo != undefined) {
                unreadInfo = GetObjectFromStr(localData.unreadInfo);
            }
            readingFeeds = false;
            if (showingFeeds) {
                showingFeeds = false;
                ShowFeeds();
            }
        }
    });
}

function UpdateLoadingProgress(currentFeeds, currentFeedsCount) {
        var ProgressWidth = Math.round(((currentFeeds + 1) / currentFeedsCount) * 100);
        if (ProgressWidth > 100) {
            ProgressWidth = 100;
        }

        //Show progress bar if not already visible
        if (ProgressWidth <= 50) {
            if ((document.getElementById("feedsLoading").style.display != "") || (document.getElementById("feedsOptions").style.display != "none")) {
                UpdateSizeProgress(false);
                document.getElementById("feedsLoading").style.display = "block";
                document.getElementById("feedsOptions").style.display = "none";
            }
        } else {
            if (ProgressWidth == 100) {
                document.getElementById("feedsLoading").style.display = "none";
                document.getElementById("feedsOptions").style.display = "";
                UpdateSizeProgress(false);
            }
        }
        document.getElementById("feedsLoadingProgress").style.width = ProgressWidth + "%";
}

function UpdateTitle() {
    var title = "Slick RSS" + (selectedFeedKeyIsFeed ? (feeds[selectedFeedKey] ? " [" + feeds[selectedFeedKey].title + "]" : "") : (groups[selectedFeedKey] ? " [" + groups[selectedFeedKey].title + "]" : ""));

    chrome.runtime.sendMessage({"type": "getUnreadTotal"}).then(function(data){
        if (data != undefined)
        unreadTotal = data;
        if ((options.unreadtotaldisplay == 2 || options.unreadtotaldisplay == 3) && unreadTotal > 0) {
            title += " (" + unreadTotal + ")";
        }

        document.title = title;
        document.getElementById("markAllRead").style.display = (unreadTotal > 0) ? "" : "none";
    });
}

function ShowFeeds() {
    if (readingFeeds) {
        showingFeeds = true;
        return;
    }
    var feedArea = null;
    var selectKey = null;
    var lastSelectedID = null;
    var lastSelectedType = null;
    var listPromise = [];

    var promiselastSelectedFeed = store.getItem('lastSelectedFeed').then(function(data) {
        if (data != null) {
            lastSelectedID = data.lastSelectedFeedID;
            lastSelectedType = data.lastSelectedFeedType;
        }
    });
    listPromise.push(promiselastSelectedFeed);

    Promise.allSettled(listPromise).then(function(){
        UpdateTitle();
        document.getElementById("manage").style.display = "";

        if (options.readlaterenabled) {
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

        document.getElementById("headerMessage").innerHTML = GetMessageText("backViewerFeedMe");
        var showNoFeeds = false;
        showFeedsWork = true;
        if (lastSelectedType != "Group") {
            if ((feeds.length == 0) || ((feeds.length == 1) && (feedInfo[readLaterFeedID] == undefined))) {
                showNoFeeds = true;
            }
            if (!showNoFeeds && (feedInfo[readLaterFeedID] != undefined)) {
                showNoFeeds = (feeds.length == 1) && (feedInfo[readLaterFeedID].items.length == 0);
            }
            if (showNoFeeds) {
                document.getElementById("feedHeader").style.display = "none";
                document.getElementById("feedArea").style.display = "none";
                document.getElementById("refresh").style.display = "none";
                document.getElementById("markFeedRead").style.display = "none";
                document.getElementById("openAllFeed").style.display = "none";
                document.getElementById("noFeedsManaged").style.display = "";
                showNoFeeds = true;
                showFeedsWork = false;
            } else {
                SelectFeed(selectKey);
            }
        } else {
            SelectGroup(selectKey);
        }

        if (!showNoFeeds) {
            if (document.getElementById("noFeedsManaged").style.display == "")
            {
                document.getElementById("feedHeader").style.display = "";
                document.getElementById("feedArea").style.display = "";
                document.getElementById("refresh").style.display = "";
                document.getElementById("markFeedRead").style.display = "";
                document.getElementById("openAllFeed").style.display = "";
                document.getElementById("noFeedsManaged").style.display = "none";
            }
        }

        // in the middle of refresh all, show progress but wait a little so feed content pushes the feed list to the right size
        // this is only here to show progress on load when current loading feed is slow, otherwise the next feed will update the progress
        chrome.runtime.sendMessage({"type": "getRefreshFeed"}).then(function(bgdata){
            if (bgdata != undefined){
                var info = GetObjectFromStr(bgdata);
                if (info.checkingForUnread && !info.refreshFeed) {
                    setTimeout(function() {
                        chrome.runtime.sendMessage({"type": "getRefreshFeed"}).then(function(data){
                            if (data != undefined){
                                info = GetObjectFromStr(data);
                            }
                        });
                    }, 500);
                }
            }
        });

        focusFeed();
        UpdateSizeProgress(true);
    });
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

    if (feeds[key] != undefined) {
        li.innerText = feeds[key].title;
        li.setAttribute("id", "feedTitle" + feeds[key].id);
        li.setAttribute("feedType", "feed");
        span.setAttribute("id", "feedUnread" + feeds[key].id);

        $(li).click(function () {
            selectedFeedKeyIsFeed = true;
            SelectFeed(key);
            return false;
        });

        li.appendChild(span);

        document.getElementById("feedList").appendChild(li);

        UpdateFeedUnread(feeds[key].id);
    }
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
    if (((unreadInfo[id] == null) && (id != readLaterFeedID)) || !options.unreaditemtotaldisplay) {
        return;
    }

    var count;
    if (id == readLaterFeedID) {
        count = readlaterInfo[readLaterFeedID].items.length;
    } else {
        count = unreadInfo[id].unreadtotal;
    }

    if (count > 0) {
        if (document.getElementById("feedTitle" + id) != null) {
            document.getElementById("feedTitle" + id).style.fontWeight = "bold";
        }
        if (document.getElementById("feedUnread" + id) != null) {
            document.getElementById("feedUnread" + id).innerText = " (" + count + ")";
        }
    } else {
        if (document.getElementById("feedTitle" + id) != null) {
            document.getElementById("feedTitle" + id).style.fontWeight = "normal";
        }
        if (document.getElementById("feedUnread" + id) != null) {
            document.getElementById("feedUnread" + id).innerText = "";
        }
    }
    if (options.showallfeeds) {
        UpdateGroupUnread(0);
    }
    var currentFeed = feeds.find(function (el) {
        return (el.id == id);
    });
    if (currentFeed != null) {
        if (currentFeed.group != "") {
            for (var i = 0; i < groups.length; i++) {
                if (groups[i].group == currentFeed.group) {
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

    if (!options.unreaditemtotaldisplay) {
        return;
    }

    chrome.runtime.sendMessage({"type": "calcGroupCountUnread", "data": key}).then(function(data){
        if (data != null) {
            var count = data;
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
    });
}

function UpdateReadAllIcon(type) {
    var count = 0;
    if (unreadInfo != null) {
        if (type == "Feed") {
            if (unreadInfo[feeds[selectedFeedKey].id] != null) {
                count = unreadInfo[feeds[selectedFeedKey].id].unreadtotal;
                if (count == 0) {
                    GetUnreadCount(selectedFeedKey);
                }
                document.getElementById("markFeedRead").style.display = (count > 0) ? "" : "none";
                document.getElementById("openAllFeed").style.display = (count > 0) ? "" : "none";
            }
        } else {
            chrome.runtime.sendMessage({"type": "calcGroupCountUnread", "data": selectedFeedKey}).then(function(data){
                if (data != null) {
                    count = data;
                    document.getElementById("markFeedRead").style.display = (count > 0) ? "" : "none";
                    document.getElementById("openAllFeed").style.display = (count > 0) ? "" : "none";
                }
            });
        }
    }
}

// marks everything but ReadLater read
function MarkAllFeedsRead() {
    var listpromise = [];
    for (var i = 0; i < feeds.length; i++) {
        if ((feeds[i].id != readLaterFeedID) && (feeds[i].id != allFeedsID)) {
            var feedID = feeds[i].id;
            var listUnread = [];

            for (var j = 0; j < feedInfo[feedID].items.length; j++) {
                var itemID = feedInfo[feedID].items[j].itemID;
                if (unreadInfo[feedID].readitems[itemID] == undefined) {
                    listUnread.push({id: feedID, key: itemID});
                }
            }
            if (listUnread.length > 0) {
                listpromise.push(SendUnreadInfoToWorker(listUnread, true).then(function(){ }));
            }
        }
    }
    if (listpromise.length > 0) {
        Promise.allSettled(listpromise).then(function(){
            UpdateUnreadBadge();
            chrome.tabs.reload();
        });
    }
}

// marks a feed read.
function MarkFeedRead(feedID) {
    var container = null;
    var itemID = null;
    var className = (options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";
    var groupKey = null;
    var listUnread = [];

    if (selectedFeedKeyIsFeed) {
        // for read later feeds, nuke the items instead of mark read
        if (feedID == readLaterFeedID) {
            readlaterInfo[readLaterFeedID].items = [];
            saveReadlaterInfo();
            SelectFeed(0);
        } else {
            for (var i = 0; i < feedInfo[feedID].items.length; i++) {
                itemID = feedInfo[feedID].items[i].itemID;
                if (unreadInfo[feedID].readitems[itemID] == undefined) {
                    listUnread.push({id: feedID, key: itemID});

                    container = document.getElementById("item_" + feedID + "_" + itemID);

                    if (container != null) {
                        container.className = container.className + className;
                    }
                }
            }
        }

        SendUnreadInfoToWorker(listUnread, true).then(function(){
            UpdateFeedUnread(feedID);
            UpdateReadAllIcon("Feed");
            UpdateUnreadBadge();
        });
    } else {
        groupKey = GetGroupKeyByID(feedID);
        if (groupKey != null) {
            if (groups[groupKey] != null) {
                var feedFilteredList = [];
                if (groups[groupKey].id != allFeedsID) {
                    feedFilteredList = GetFeedsFilterByGroup(groupKey);
                } else {
                    feedFilteredList = feeds.filter(function (el) {
                        return (el.id != readLaterFeedID);
                    });
                }
                if (feedFilteredList.length > 0) {
                    feedFilteredList.forEach((item) => {
                        MarkFeedReadFromGroup(item.id);
                    });

                    UpdateReadAllIcon("Group");
                    UpdateUnreadBadge();
                }
            }
        }
    }
}

// marks a feed read from group.
function MarkFeedReadFromGroup(feedID) {
    var container = null;
    var itemID = null;
    var className = (options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";
    var groupKey = null;
    var listUnread = [];

    if (unreadInfo[feedID] == undefined) {
        return;
    }

    if (unreadInfo[feedID].unreadtotal == 0) {
        return;
    }

    for (var i = 0; i < feedInfo[feedID].items.length; i++) {
        itemID = feedInfo[feedID].items[i].itemID;
        if (unreadInfo[feedID].readitems[itemID] == undefined) {
            listUnread.push({id: feedID, key: itemID});

            container = document.getElementById("item_" + feedID + "_" + itemID);

            if (container != null) {
                container.className = container.className + className;
            }
        }
    }

    SendUnreadInfoToWorker(listUnread, true).then(function(){
        UpdateFeedUnread(feedID);
    });
}

function MarkItemRead(itemID) {
    var feedID;
    var listUnread = [];
    if (selectedFeedKeyIsFeed) {
        feedID = feeds[selectedFeedKey].id;
    } else {
        var newitem = groupInfo[groups[selectedFeedKey].id].items.find(function (el) {
            return el.itemID == itemID;
        });
        feedID = newitem.idOrigin;
    }
    var className = (options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";

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

    if (options.showallfeeds == true) {
        element = document.getElementById("item_" + allFeedsID + "_" + itemID);
        if (element != null) {
            element.className += className;
        }
    }

    listUnread.push({id: feedID, key: itemID});
    SendUnreadInfoToWorker(listUnread, true).then(function(){
        UpdateFeedUnread(feedID);
        UpdateReadAllIcon((selectedFeedKeyIsFeed) ? "Feed" : "Group");
        UpdateUnreadBadge();
    });
}

function MarkItemUnread(itemID) {
    var feedID;
    var element;
    var listUnread = [];

    if (selectedFeedKeyIsFeed) {
        feedID = feeds[selectedFeedKey].id;
    } else {
        var newitem = groupInfo[groups[selectedFeedKey].id].items.find(function (el) {
            return el.itemID == itemID;
        });
        feedID = newitem.idOrigin;
    }
    var className = (options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";

    if (unreadInfo[feedID].readitems[itemID] != null) {
        listUnread.push({id: feedID, key: itemID});

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
        if (options.showallfeeds == true) {
            element = document.getElementById("item_" + allFeedsID + "_" + itemID);
            if (element != null) {
                element.className = element.className.replace(className, "");
            }
        }

        UnMarkItemReadLaterWithoutSelectFeed(findWithAttr(readlaterInfo[readLaterFeedID].items, 'itemID', itemID));

        SendUnreadInfoToWorker(listUnread, false).then(function(){
            UpdateFeedUnread(readLaterFeedID);
            UpdateFeedUnread(feedID);
            UpdateReadAllIcon((selectedFeedKeyIsFeed) ? "Feed" : "Group");
            UpdateUnreadBadge();
        });
    }
}

function MarkItemReadLater(feedID, itemIndex) {
    var currentItem = GetFeedInfoItem(feedID, itemIndex);
    var itemID = currentItem.itemID;
    var itemExist = false;

    for (var i = 0; i < readlaterInfo[readLaterFeedID].items.length; i++) {
        if (readlaterInfo[readLaterFeedID].items[i].itemID == itemID) {
            itemExist = true;
            //update items
            readlaterInfo[readLaterFeedID].items[i] = currentItem;
            break;
        }
    }
    if (!itemExist) {
        readlaterInfo[readLaterFeedID].items.push(currentItem);
    }

    unreadInfo[readLaterFeedID].unreadtotal = readlaterInfo[readLaterFeedID].items.length;

    MarkItemRead(itemID);
    UpdateFeedUnread(readLaterFeedID);

    saveReadlaterInfo();
}

function UnMarkItemReadLater(itemIndex) {
    if (itemIndex >= 0) {
        UnMarkItemReadLaterWithoutSelectFeed(itemIndex).then(function(){
            SelectFeed(0);
        });
    }
}

function UnMarkItemReadLaterWithoutSelectFeed(itemIndex) {
    var promiseSaved = null;
    if (itemIndex >= 0) {
        if (readlaterInfo[readLaterFeedID].items[itemIndex] != undefined) {
            readlaterInfo[readLaterFeedID].items.splice(itemIndex, 1);
            unreadInfo[readLaterFeedID].unreadtotal = readlaterInfo[readLaterFeedID].items.length;
            promiseSaved = saveReadlaterInfo();
            UpdateUnreadBadge();

            UpdateFeedUnread(readLaterFeedID);
        }
    }
    return promiseSaved;
}

function SelectFeed(key) {
    SelectFeedOrGroup(key, "Feed");
}

function SelectGroup(key) {
    SelectFeedOrGroup(key, "Group");
}

function SelectFeedOrGroup(key, type) {
    var feedsOrGroups, feedsOrGroupsInfo, selectedFeedsOrGroups;
    var lastSelectedFeedID = null;
    var lastSelectedFeedType = null;
    var listPromise = [];

    if (lastSelectedFeedID == null) {
        var promiselastSelectedFeed = store.getItem('lastSelectedFeed').then(function(data) {
            if (data != null) {
                lastSelectedFeedID = data.lastSelectedFeedID;
                lastSelectedFeedType = data.lastSelectedFeedType;
            }
        });
        listPromise.push(promiselastSelectedFeed);
    }

    if (type == "Feed") {
        if (feeds[key].id == readLaterFeedID) {
            listPromise.push(loadReadlaterInfo());
        }
    }

    Promise.allSettled(listPromise).then(function(){
        if (lastSelectedFeedType == "Feed") {
            selectedFeedsOrGroups = feeds;
        } else {
            selectedFeedsOrGroups = groups;
        }

        if (type == "Feed") {
            feedsOrGroups = feeds;
            if (feeds[key].id == readLaterFeedID) {
                feedsOrGroupsInfo = readlaterInfo;
            } else {
                feedsOrGroupsInfo = feedInfo;
            }
        } else {
            feedsOrGroups = groups;
            feedsOrGroupsInfo = groupInfo;
        }

        var lastSelectedFeed = {};
        lastSelectedFeed.lastSelectedFeedID = feedsOrGroups[key].id;
        lastSelectedFeed.lastSelectedFeedType = type;
        store.setItem('lastSelectedFeed', lastSelectedFeed);

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
        document.getElementById("refresh").style.display = (feedsOrGroups[key].id != readLaterFeedID) ? "" : "none";

        // feed isn't ready yet
        var feednotready = feedsOrGroupsInfo[feedsOrGroups[key].id] == null;
        if (!feednotready) {
            feednotready = feedsOrGroupsInfo[feedsOrGroups[key].id].loading;
        }
        if (feednotready) {
            document.getElementById("refresh").style.display = "none";
            document.getElementById("headerMessage").innerHTML = GetMessageText("backViewerLoadingFeed");
            document.getElementById("header").className = "loading";

            if (type == "Feed") {
                // must be a new feed with no content yet
                chrome.runtime.sendMessage({"type": "checkForUnreadOnSelectedFeedCompleted", "selectedFeedKey": key}).then(function(){
                    RenderFeed(type);
                    UpdateReadAllIcon(type);
                    FixFeedList(); // in case header wraps

                    if (options.markreadafter > 0 && key != 0) {
                        feedReadToID = setTimeout(function () {
                            try {
                                MarkFeedRead(feedsOrGroups[key].id)
                            } catch(e){
                                console.log(e);
                            }
                        }, options.markreadafter * 1000);
                    }
                    focusFeed();
                });
                return;
            }
        }

        // feed loaded, but had an error
        if (feedsOrGroupsInfo[feedsOrGroups[key].id] != null) {
            if (feedsOrGroupsInfo[feedsOrGroups[key].id].error != "") {
                ShowFeedError(feedsOrGroupsInfo[feedsOrGroups[key].id].error, feedsOrGroupsInfo[feedsOrGroups[key].id].errorContent);
                return;
            }
            document.getElementById("noItems").style.display = (feedsOrGroupsInfo[feedsOrGroups[key].id].items.length == 0) ? "" : "none";
        }

        RenderFeed(type);
        UpdateReadAllIcon(type);
        FixFeedList(); // in case header wraps

        if (options.markreadafter > 0 && key != 0) {
            feedReadToID = setTimeout(function () {
                try {
                    MarkFeedRead(feedsOrGroups[key].id)
                } catch(e){
                    console.log(e);
                }
            }, options.markreadafter * 1000);
        }
        focusFeed();
    });
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
    var feedsOrGroupsInfo = (type == "Feed") ? ((feedsOrGroups[selectedFeedKey].id == readLaterFeedID) ? readlaterInfo : feedInfo) : groupInfo;
    var feedID = feedsOrGroups[selectedFeedKey].id;
    var currentTr = null;
    var columnCount = 0;
    var colWidth = null;
    var feedTd = null;
    var href = "";
    var headerMessage = "";

    if (feedsOrGroupsInfo[feedID] == null) {
        return;
    }

    headerMessage = feedsOrGroupsInfo[feedID].title;
    if (feedsOrGroupsInfo[feedID].description != "" && options.showdescriptions) {
        headerMessage += "<span> : " + feedsOrGroupsInfo[feedID].description + "</span>";
    }
    document.getElementById("headerMessage").innerHTML = headerMessage;

    var logoUsed = false;
    if (feedsOrGroupsInfo[feedID].image != undefined) {
        if (feedsOrGroupsInfo[feedID].image[0] != undefined) {
            if (feedsOrGroupsInfo[feedID].image[0]["url"] != undefined) {
                document.getElementById("headerLogo").style.backgroundImage = "url(" + feedsOrGroupsInfo[feedID].image[0]["url"] + ")";
                logoUsed = true;
            }
        }
    }
    if (!logoUsed) {
        document.getElementById("headerLogo").style.backgroundImage = "url(rss.png)";
    }

    switch (parseInt(options.columns, 10)) {
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

    if (feedsOrGroups[selectedFeedKey].urlredirected != undefined) {
        document.getElementById("urlRedirectedUrl").innerText = feedsOrGroups[selectedFeedKey].urlredirected;
        document.getElementById("urlRedirected").style.display = "";
    } else {
        document.getElementById("urlRedirected").style.display = "none";
    }

    for (var i = 0; i < feedsOrGroupsInfo[feedID].items.length && i < feedsOrGroups[selectedFeedKey].maxitems; i++) {
        item = feedsOrGroupsInfo[feedID].items[i];
        itemID = item.itemID;

        feedMarkRead = null;
        feedMarkRead = document.createElement("img");
        feedMarkRead.setAttribute("src", "x.png");
        feedMarkRead.addEventListener("mouseover", onmouseover);
        feedMarkRead.addEventListener("mouseout", onmouseout);

        if (feedID == readLaterFeedID) {
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
        if ((href != null) && (typeof href == "string")) {
            href.startsWith("/") && !href.startsWith("//") && (href = feedBaseUrl + href);
        }
        feedLink.setAttribute("href", href);
        feedLink.innerHTML = (i + 1) + ". " + item.title;

        $(feedLink).click({url: href}, function (event) {
            LinkProxy(event.data.url);
            return false;
        });

        if (feedID == readLaterFeedID) {
            if (options.readlaterremovewhenviewed) {
                $(feedLink).click({i: i}, function (event) {
                    UnMarkItemReadLater(event.data.i);
                    return false;
                });
            }
        } else {
            $(feedLink).click({feedID: feedID, itemID: itemID}, function (event) {
                MarkItemRead(event.data.itemID);
                if (options.markreadonclick) {
                    MarkFeedRead(event.data.feedID);
                }
                return false;
            });
        }

        feedTitle = document.createElement("div");
        feedTitle.setAttribute("class", "feedPreviewTitle");
        feedTitle.appendChild(feedMarkRead);

        if (options.readlaterenabled && (feedID != readLaterFeedID)) {
            feedReadLater = document.createElement("img");
            feedReadLater.setAttribute("src", "star.png");
            feedReadLater.setAttribute("class", "feedPreviewReadLater");
            feedReadLater.setAttribute("title", GetMessageText("backReadLater"));
            feedReadLater.addEventListener("mouseover", onmouseover);
            feedReadLater.addEventListener("mouseout", onmouseout);
            $(feedReadLater).click({feedID: feedID, i: i}, function (event) {
                MarkItemReadLater(event.data.feedID, event.data.i);
                return false;
            });
            feedTitle.appendChild(feedReadLater);

            feedUnread = document.createElement("img");
            feedUnread.setAttribute("src", "revert.png");
            feedUnread.addEventListener("mouseover", onmouseover);
            feedUnread.addEventListener("mouseout", onmouseout);
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
        feedPublished.appendChild(document.createTextNode(GetFormattedDate(item.date)));

        feedAuthor = document.createElement("div");
        feedAuthor.setAttribute("class", "feedPreviewAuthor");
        feedAuthor.innerText = item.author;

        feedSummary = document.createElement("div");
        feedSummary.setAttribute("class", "feedPreviewSummary");
        if ((options.feedsmaxheight != null) && (options.feedsmaxheight != 0)) {
            feedSummary.style.maxHeight = options.feedsmaxheight + "px";
        } else {
            feedSummary.style.maxHeight = "none";
        }
        if (options.usethumbnail && (item.thumbnail != null)) {
            feedSummary.innerHTML = '<div class="thumbnail">' + item.thumbnail + '</div>' + item.content;
        } else {
            feedSummary.innerHTML = item.content;
        }

        feedContainer = document.createElement("div");
        feedContainer.setAttribute("id", "item_" + feedID + "_" + itemID);

        if (ItemIsRead((feedID != readLaterFeedID) ? feedsOrGroupsInfo[feedID].items[i].idOrigin : readLaterFeedID, itemID)) {
            if (options.readitemdisplay == 0) {
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

            if (feedID == readLaterFeedID) {
                if (options.readlaterremovewhenviewed) {
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
            if (options.showfeedimages) {
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
            if (!options.showfeedobjects) {
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
            if (!options.showfeedobjects) {
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
            if (!options.showfeediframes) {
                summaryObjects[o].parentNode.removeChild(summaryObjects[o]);
            } else {
                summaryObjects[o].style.maxWidth = "95%";
                summaryObjects[o].style.width = "";
                summaryObjects[o].style.height = "";
                summaryObjects[o].removeAttribute("width");
                summaryObjects[o].removeAttribute("height");
            }
        }

        if (columnCount == options.columns) {
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

function ShowFeedError(message, content) {
    document.getElementById("feedErrorMessage").innerText = message;
    document.getElementById("headerMessage").innerHTML = GetMessageText("backViewerFeedIssue");
    document.getElementById("feedError").style.display = "";

    if ((content != undefined) && (content != "")) {
        document.getElementById("feedErrorContent").innerHTML = content;
    } else {
        document.getElementById("feedErrorContent").innerHTML = "";
    }
    document.getElementById("headerLogo").style.backgroundImage = "url(rss.png)";
}

// central function to control creation of tabs so we can put them in the background
function LinkProxy(uRL) {
    chrome.tabs.create({url: uRL, selected: !options.loadlinksinbackground});
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

function onmouseover(){
    hover(this);
}

function onmouseout(){
    unhover(this);
}

// marks a feed read.
function OpenAllFeedButton(feedID) {
    var container = null;
    var itemID = null;
    var className = (options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";
    var groupKey = null;
    var listUnread = [];

    if (selectedFeedKeyIsFeed) {
        if (unreadInfo[feedID].unreadtotal == 0) {
            return;
        }

        // for read later feeds, nuke the items instead of mark read
        if (feedID == readLaterFeedID) {
            for (var i = 0; i < readlaterInfo[readLaterFeedID].items.length; i++) {
                LinkProxy(readlaterInfo[readLaterFeedID].items[i].url);
            }

            readlaterInfo[readLaterFeedID].items = [];
            saveReadlaterInfo();
            SelectFeed(0);
        } else {
            for (var i = 0; i < feedInfo[feedID].items.length; i++) {
                itemID = feedInfo[feedID].items[i].itemID;

                if (unreadInfo[feedID].readitems[itemID] == undefined) {
                    LinkProxy(feedInfo[feedID].items[i].url);

                    listUnread.push({id: feedID, key: itemID});
                    container = document.getElementById("item_" + feedID + "_" + itemID);

                    if (container != null) {
                        container.className = container.className + className;
                    }
                }
            }
        }

        if (listUnread.length > 0) {
            SendUnreadInfoToWorker(listUnread, true).then(function(){
                UpdateFeedUnread(feedID);
                UpdateReadAllIcon("Feed");
                UpdateUnreadBadge();
            });
        }

    } else {
        groupKey = GetGroupKeyByID(feedID);
        if (groupKey != null) {
            if (groups[groupKey] != null) {
                var feedFilteredList = [];
                if (groups[groupKey].id != allFeedsID) {
                    feedFilteredList = GetFeedsFilterByGroup(groupKey);
                } else {
                    feedFilteredList = feeds.filter(function (el) {
                        return (el.id != readLaterFeedID);
                    });
                }
                if (feedFilteredList.length > 0) {
                    feedFilteredList.forEach((item) => {
                        OpenAllFeedButtonFromGroup(item.id);
                    });

                    UpdateReadAllIcon("Group");
                    UpdateUnreadBadge();
                }
            }
        }
    }
}

function OpenAllFeedButtonFromGroup(feedID) {
    var container = null;
    var itemID = null;
    var className = (options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";
    var groupKey = null;

    if (unreadInfo[feedID].unreadtotal == 0) {
        return;
    }

    var listUnread = [];

    for (var i = 0; i < feedInfo[feedID].items.length; i++) {
        itemID = feedInfo[feedID].items[i].itemID;

        if (unreadInfo[feedID].readitems[itemID] == undefined) {
            LinkProxy(feedInfo[feedID].items[i].url);

            listUnread.push({id: feedID, key: itemID});

            container = document.getElementById("item_" + feedID + "_" + itemID);

            if (container != null) {
                container.className = container.className + className;
            }
        }
    }

    if (listUnread.length > 0) {
        SendUnreadInfoToWorker(listUnread, true).then(function(){
            UpdateFeedUnread(feedID);
        });
    }
}

function SendUnreadInfoToWorker(listUnread, setunset) {
    if (setunset) {
        return chrome.runtime.sendMessage({"type": "setUnreadInfo", "data": GetStrFromObject(listUnread)}).then(function(data){
            if (data != undefined) {
                unreadInfo = JSON.parse(data);
            }
        });
    } else {
        return chrome.runtime.sendMessage({"type": "unsetUnreadInfo", "data": GetStrFromObject(listUnread)}).then(function(data){
            if (data != undefined) {
                unreadInfo = JSON.parse(data);
            }
        });
    }
}
