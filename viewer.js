$(document).ready(function () {
    $('#refreshAll').click(function () {
        chrome.runtime.sendMessage({type: "checkForUnread"}).then(function () {
        });
    });
    $('#markAllRead').click(function () {
        MarkAllFeedsRead();
    });
    $('#refreshButton').click(function () {
        chrome.runtime.sendMessage({
            type: "checkForUnreadOnSelectedFeed",
            selectedFeedKey: selectedFeedKey
        }).then(function () {
        });
    });
    $('#markFeedReadButton').click(function () {
        MarkFeedRead((selectedFeedKeyIsFeed ? feeds[selectedFeedKey].id : groups[selectedFeedKey].id));
    });
    $('#openAllFeedButton').click(function () {
        OpenAllFeedButton((selectedFeedKeyIsFeed ? feeds[selectedFeedKey].id : groups[selectedFeedKey].id));
    });
    $('#categoryFilter').on('input', function() {
        let enteredValue = document.getElementById("catFilterValue").value.toUpperCase();
        if (enteredValue == "") {
            categoryFilterUpper = "";
            ShowFeeds();
            return;
        }
        let options = document.getElementById("categoryList").options;
        for (let i = 0; i < options.length; i++) {
            if (options[i].value.toUpperCase() === enteredValue) {
                categoryFilterUpper = enteredValue;
                ShowFeeds();
                return;
            }
        }
    });
    $('#addAuthNotif').click(function () {
        if (options.playSoundNotif && (Notification.permission != "granted")) {
            chrome.permissions.request({permissions: ['notifications']}, (granted) => {});
        }
    });
});

document.documentElement.setAttribute('lang', GetMessageText('lang'));

var showFeedsWork = false;
var listCategoriesRegisteredUpper;
var categoryFilterUpper = '';

waitOptionReady().then(function () {
    if (options.darkmode) {
        activeDarkMode();
    } else {
        disableDarkMode();
    }

    GetCategoriesRegistered().then(function () {
        if (listCategoriesRegistered != undefined) {
            listCategoriesRegisteredUpper = [];
            for(let key in listCategoriesRegistered) {
                if ((listCategoriesRegistered[key].name != undefined) && (listCategoriesRegistered[key].name != "")) {
                    listCategoriesRegisteredUpper.push({category: listCategoriesRegistered[key].name.toUpperCase(), color: listCategoriesRegistered[key].color});
                }
            }
        }

        if (options.readlaterenabled) {
            loadReadlaterInfo();
        }
        if (options.showGetRSSFeedUrl) {
            document.getElementById("getToolFindFeed").style.display = "";
        } else {
            document.getElementById("getToolFindFeed").style.display = "none";
        }
    
        if (options.playSoundNotif && (Notification.permission != "granted")) {
            document.getElementById("addAuthNotif").style.display = "";
        } else {
            document.getElementById("addAuthNotif").style.display = "none";
        }
    });
    localStorage.setItem('darkmode', options.darkmode);
    localStorage.setItem('fontSize', options.fontSize);
    localStorage.setItem('forcelangen', options.forcelangen);
});

function openPageWithParams(pageurl, newpage) {
    var form = document.createElement("form");
    form.setAttribute("method", "post");
    form.setAttribute("action", pageurl);
    if (newpage) {
        form.setAttribute("target", "_blank");
    }

    var input1 = document.createElement("input");
    input1.setAttribute("type", "hidden");
    input1.setAttribute("name", "darkmode");
    input1.setAttribute("value", options.darkmode);
    form.appendChild(input1);

    var input2 = document.createElement("input");
    input2.setAttribute("type", "hidden");
    input2.setAttribute("name", "font");
    input2.setAttribute("value", options.fontSize);
    form.appendChild(input2);

    document.body.appendChild(form);
    form.submit();

    document.body.removeChild(form);
}

sendtoSQL('getUnreadinfoFull', 'Viewer', true, undefined, function(data){
    if (data != null) {
        unreadInfo = data;
    }
});

GetFeedsSimple();

sendtoSQL('getColors', 'Viewer', true, undefined, function(data){
    if (data != null) {
        category = data;
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
var listonefeed = {};

var port = chrome.runtime.connect({name: "viewerPort"});

chrome.runtime.onConnect.addListener(InternalConnection);

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
        if (options.log) {
            console.log('refreshallcomplete');
        }

        document.getElementById("feedsLoading").style.display = "none";
        document.getElementById("feedsOptions").style.display = "";

        UpdateDataFromWorker(undefined);
        for (let key in feeds) {
            if (key != 0) {
                UpdateFeedUnread(feeds[key].id);
            }
        }
    }

    if (msg.type == "feedupdatecomplete") {
        if (options.log) {
            console.log('feedupdatecomplete');
        }

        UpdateDataFromWorker(msg.id);
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

    if (msg.type == "progressLoading") {
        UpdateLoadingProgress(msg.currentFeeds, msg.currentFeedsCount);
    }

    if (msg.type == "unreadInfo") {
        sendtoSQL('getLastSelectedFeed', 'ViewerOnMessage', true, undefined, function(data){
            if (data != null) {
                unreadInfo = data;
                if (options.log) {
                    console.log('unreadinfo');
                }
                for (let key in feeds) {
                    if (key != 0) {
                        UpdateFeedUnread(feeds[key].id);
                    }
                }
                UpdateReadAllIcon((selectedFeedKeyIsFeed) ? "Feed" : "Group");
            }
        });
    }
});

chrome.tabs.getCurrent(function(tab) {
    if (tab) {
        const currentTabId = tab.id;
        chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
            if (tabId === currentTabId) {
                //Refresh data TODO *******
            }
        });
    }
});

function ReloadViewer() {
    chrome.tabs.reload();
}

UpdateDataFromWorker(undefined);

window.onload = ShowFeeds;
window.onresize = FixFeedList;

function UpdateDataFromWorker(id) {
    readingFeeds = true;

    let listPromise = [];
    let resolveGetGroups;
    let waitGetGroups = new Promise((resolve) => {
        resolveGetGroups = resolve;
    });
    listPromise.push(waitGetGroups);

    sendtoSQL('getGroups', 'Viewer', true, undefined, function(data){
        if (data != undefined) {
            if (data != undefined) {
                groups = [];
                groups = data;
                if (options.showallfeeds == true) {
                    groups.unshift(GetAllFeedsGroup());
                }
            }
            resolveGetGroups();
        }
    });

    let resolveGetCacheFeedInfo;
    let waitGetCacheFeedInfo = new Promise((resolve) => {
        resolveGetCacheFeedInfo = resolve;
    });
    listPromise.push(waitGetCacheFeedInfo);

    sendtoSQL('getCacheFeedInfo', 'Viewer', true, id == undefined ? undefined : { feed_id: id }, function(data){
        if (data != undefined) {
            //format feedinfo
            feedInfo = {};
            for (let i = 0; i < data.length; i++) {
                feedInfo[data[i].feed_id] = data[i];
            }
        }
        resolveGetCacheFeedInfo();
    });

    let resolveGetGroupInfo;
    let waitGetGroupInfo = new Promise((resolve) => {
        resolveGetGroupInfo = resolve;
    });
    listPromise.push(waitGetGroupInfo);

    sendtoSQL('getGroupInfo', 'Viewer', true, id == undefined ? undefined : { group_id: id }, function(data){
        if (data != undefined) {
            //format feedinfo
            groupInfo = {};
            if (options.showallfeeds == true) {
                groupInfo[allFeedsID] = {
                    title: GetMessageText("backAllFeeds"),
                    description: GetMessageText("backAllFeeds"),
                    group: "",
                    loading: true,
                    items: [],
                    error: "",
                    category: ""
                };
            }
            for (let i = 0; i < data.length; i++) {
                groupInfo[data[i].feed_id] = data[i];
            }
        }
        resolveGetGroupInfo();
    });

    Promise.allSettled(listPromise).then(function () {
        if (options.useViewByCategory) {
            if (selectedFeedKeyIsFeed && (selectedFeedKey != undefined)) {
                if (feeds[selectedFeedKey].id == id) {
                    RefreshCategoryList();
                }
            }
            if (!selectedFeedKeyIsFeed) {
                if (id == undefined) {
                    RefreshCategoryList();
                }
            }
        }
        readingFeeds = false;
        if (showingFeeds) {
            showingFeeds = false;
            ShowFeeds();
        }
    });
}

function UpdateLoadingProgress(currentFeeds, currentFeedsCount) {
    let ProgressWidth = Math.round(((currentFeeds + 1) / currentFeedsCount) * 100);
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
    let title = "Slick RSS" + (selectedFeedKeyIsFeed ? (feeds[selectedFeedKey] ? " [" + feeds[selectedFeedKey].title + "]" : "") : (groups[selectedFeedKey] ? " [" + groups[selectedFeedKey].title + "]" : ""));

    sendtoSQL('getUnreadTotal', 'UpdateTitle', true, undefined, function(data){
        if (data != undefined)
            unreadTotal = data;
        if ((options.unreadtotaldisplay >= 2) && options.unreaditemtotaldisplay && unreadTotal > 0) {
            title += " (" + unreadTotal + ")";
        }

        document.title = title;
        document.getElementById("markAllRead").style.display = (unreadTotal > 0) ? "" : "none";
    });
}

function ShowFeeds() {
    /*if (readingFeeds) {
        showingFeeds = true;
        return;
    }*/

	sendtoSQL('getLastSelectedFeed', 'ShowFeeds', true, undefined, function(data){
        let selectKey = null;
        let lastSelectedID = null;
        let lastSelectedType = null;
        if (data != null) {
            if (data.length > 0) {
                lastSelectedID = data[0].lastSelectedFeedID;
                lastSelectedType = data[0].lastSelectedFeedType;
            }
        }

        UpdateTitle();
        document.getElementById("manage").style.display = "";

        if (options.readlaterenabled) {
            ShowFeed(0);
            if (selectKey == null) {
                selectKey = 0;
            }
        }

        for (let key in groups) {
            ShowGroup(key);

            if ((groups[key].id == lastSelectedID) && (lastSelectedType == "Group")) {
                selectKey = key;
            }
        }

        for (let key in feeds) {
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
        let showNoFeeds = false;
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
            if (document.getElementById("noFeedsManaged").style.display == "") {
                document.getElementById("feedHeader").style.display = "";
                document.getElementById("feedArea").style.display = "";
                document.getElementById("refresh").style.display = "";
                document.getElementById("markFeedRead").style.display = "";
                document.getElementById("openAllFeed").style.display = "";
                document.getElementById("noFeedsManaged").style.display = "none";
            }
        }

        focusFeed();
        UpdateSizeProgress(true);
    });
}

function FixFeedList() {
    let feedScroller = document.getElementById("feedScroller");
    let feedPreviewScroller = document.getElementById("feedPreviewScroller");
    let header = document.getElementById("header");

    if (feedPreviewScroller != undefined) {
        feedPreviewScroller.style.height = (document.body.offsetHeight - header.offsetHeight) + "px";
        feedPreviewScroller.style.width = (window.innerWidth - feedScroller.offsetWidth) + "px"; // some feeds don't wrap well so we must force a strict width
    }

    if (feedScroller != undefined) {
        feedScroller.style.height = document.body.offsetHeight - document.getElementById("feedHeader").offsetHeight + "px";
        feedScroller.style.overflowY = (feedScroller.offsetHeight < feedScroller.scrollHeight) ? "scroll" : "hidden";
    }
    UpdateSizeProgress(true);
}

function ShowFeed(key) {
    let li = document.createElement("li");
    let span = document.createElement("span");

    if (feeds[key] != undefined) {
        if (document.getElementById("feedTitleFeed" + feeds[key].id) == null) {
            li.innerText = feeds[key].title;
            li.setAttribute("id", "feedTitleFeed" + feeds[key].id);
            li.setAttribute("data-type", "feed");
            li.setAttribute("data-id", feeds[key].id);
            li.setAttribute("data-key", key);
            span.setAttribute("id", "feedUnreadFeed" + feeds[key].id);

            $(li).click(function (event) {
                selectedFeedKeyIsFeed = true;
                SelectFeed(event.target.getAttribute("data-key"));
                return false;
            });

            li.appendChild(span);

            document.getElementById("feedList").appendChild(li);
        }
        UpdateFeedUnread(feeds[key].id);
    }
}

function ShowGroup(key) {
    let li = document.createElement("li");
    let span = document.createElement("span");

    if (document.getElementById("feedTitleGroup" + groups[key].id) == null) {
        li.innerText = groups[key].title;
        li.setAttribute("id", "feedTitleGroup" + groups[key].id);
        li.setAttribute("data-type", "group");
        li.setAttribute("data-id", groups[key].id);
        li.setAttribute("data-key", key);
        span.setAttribute("id", "feedUnreadGroup" + groups[key].id);

        $(li).click(function () {
            selectedFeedKeyIsFeed = false;
            SelectGroup(event.target.getAttribute("data-key"));
            return false;
        });

        li.appendChild(span);

        document.getElementById("feedList").appendChild(li);
    }
    UpdateGroupUnread(key);
    FixFeedList();
}

function focusFeed() {
    document.getElementById("feedPreview").focus();
}

// updates a feed item's unread count
function UpdateFeedUnread(id) {
    if (((unreadInfo[id] == null) && (id != readLaterFeedID)) || !options.unreaditemtotaldisplay || (options.unreadtotaldisplay < 2)) {
        return;
    }

    let count;
    if (id == readLaterFeedID) {
        count = readlaterInfo[readLaterFeedID].items.length;
    } else {
        count = unreadInfo[id].unreadtotal;
    }

    if (count > 0) {
        if (document.getElementById("feedTitleFeed" + id) != null) {
            document.getElementById("feedTitleFeed" + id).style.fontWeight = "bold";
        }
        if (document.getElementById("feedUnreadFeed" + id) != null) {
            document.getElementById("feedUnreadFeed" + id).innerText = " (" + count + ")";
        }
    } else {
        if (document.getElementById("feedTitleFeed" + id) != null) {
            document.getElementById("feedTitleFeed" + id).style.fontWeight = "normal";
        }
        if (document.getElementById("feedUnreadFeed" + id) != null) {
            document.getElementById("feedUnreadFeed" + id).innerText = "";
        }
    }
    if (options.showallfeeds) {
        UpdateGroupUnread(0);
    }
    let currentFeed = feeds.find(function (el) {
        return (el.id == id);
    });
    if (currentFeed != null) {
        if (currentFeed.group != "") {
            for (let i = 0; i < groups.length; i++) {
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
    let id = groups[key].id;

    if (!options.unreaditemtotaldisplay || (options.unreadtotaldisplay < 2)) {
        return;
    }

    chrome.runtime.sendMessage({"type": "getGroupCountUnread", "data": key}).then(function (data) { //***
        if (data != null) {
            let count = data;
            if (document.getElementById("feedTitleGroup" + id) != null) {
                if (count > 0) {
                    document.getElementById("feedTitleGroup" + id).style.fontWeight = "bold";
                    document.getElementById("feedUnreadGroup" + id).innerText = " (" + count + ")";
                } else {
                    document.getElementById("feedTitleGroup" + id).style.fontWeight = "normal";
                    document.getElementById("feedUnreadGroup" + id).innerText = "";
                }
            }
        }
    });
}

function UpdateReadAllIcon(type) {
    let count = 0;
    if (unreadInfo != null) {
        if (type == "Feed") {
            if (feeds[selectedFeedKey] != undefined) {
                if (unreadInfo[feeds[selectedFeedKey].id] != null) {
                    count = unreadInfo[feeds[selectedFeedKey].id].unreadtotal;
                    if (count == 0) {
                        count = GetUnreadCount(selectedFeedKey);
                    }
                    document.getElementById("markFeedRead").style.display = (count > 0) ? "" : "none";
                    document.getElementById("openAllFeed").style.display = (count > 0) ? "" : "none";
                }
            }
        } else {
            chrome.runtime.sendMessage({"type": "getGroupCountUnread", "data": selectedFeedKey}).then(function (data) { //***
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
    let refresh = false;
    for (let i = 0; i < feeds.length; i++) {
        if ((feeds[i].id != readLaterFeedID) && (feeds[i].id != allFeedsID)) {
            let feedID = feeds[i].id;
            var listUnread = [];

            for (let j = 0; j < feedInfo[feedID].items.length; j++) {
                let itemID = feedInfo[feedID].items[j].itemID;
                if (unreadInfo[feedID].readitems[itemID] == undefined) {
                    listUnread.push({id: feedID, key: itemID});
                }
            }
            if (listUnread.length > 0) {
                SaveUnreadInfo(listUnread, true);
                refresh = true;
            }
        }
    }
    if (refresh) {
        ReloadViewer();
    }
}

// marks a feed read.
function MarkFeedRead(feedID) {
    let container = null;
    let itemID = null;
    let className = (options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";
    let groupKey = null;
    let listUnread = [];

    if (selectedFeedKeyIsFeed) {
        // for read later feeds, nuke the items instead of mark read
        if (feedID == readLaterFeedID) {
            readlaterInfo[readLaterFeedID].items = [];
            saveReadlaterInfo();
            SelectFeed(0);
        } else {
            MarkFeedReadSub(feedID, itemID, listUnread, className, container);
        }

        SaveUnreadInfo(listUnread, true);
        UpdateFeedUnread(feedID);
        UpdateReadAllIcon("Feed");
    } else {
        groupKey = GetGroupKeyByID(feedID);
        if (groupKey != null) {
            if (groups[groupKey] != null) {
                let feedFilteredList;
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
    let container = null;
    let itemID = null;
    let className = (options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";
    let listUnread = [];

    if (unreadInfo[feedID] == undefined) {
        return;
    }

    if (unreadInfo[feedID].unreadtotal == 0) {
        return;
    }

    MarkFeedReadSub(feedID, itemID, listUnread, className, container);

    SaveUnreadInfo(listUnread, true);
    UpdateFeedUnread(feedID);
}

function MarkFeedReadSub(feedID, itemID, listUnread, className, container) {
    for (let i = 0; i < feedInfo[feedID].items.length; i++) {
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

function MarkItemRead(itemID) {
    let feedID;
    let listUnread = [];
    if (selectedFeedKeyIsFeed) {
        feedID = feeds[selectedFeedKey].id;
    } else {
        let newitem = groupInfo[groups[selectedFeedKey].id].items.find(function (el) {
            return el.itemID == itemID;
        });
        feedID = newitem.idOrigin;
    }
    let className = (options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";

    let element = document.getElementById("item_" + feedID + "_" + itemID);
    if (element != null) {
        element.className += className;
    }
    //group
    //Get feed to find group name
    let currentFeed = feeds.find(el => el.id == feedID);

    if (currentFeed != null) {
        //search group by name
        let currentGroup = groups.find(el => el.title == currentFeed.group);
        if (currentGroup != null) {
            element = document.getElementById("item_" + currentGroup.id + "_" + itemID);
            if (element != null) {
                element.className += className;
            }
        }
    }

    if (options.showallfeeds) {
        element = document.getElementById("item_" + allFeedsID + "_" + itemID);
        if (element != null) {
            element.className += className;
        }
    }

    listUnread.push({id: feedID, key: itemID});
    SaveUnreadInfo(listUnread, true);
    UpdateFeedUnread(feedID);
    UpdateReadAllIcon((selectedFeedKeyIsFeed) ? "Feed" : "Group");
}

function MarkItemUnread(itemID) {
    let feedID;
    let element;
    let listUnread = [];

    if (selectedFeedKeyIsFeed) {
        feedID = feeds[selectedFeedKey].id;
    } else {
        let newitem = groupInfo[groups[selectedFeedKey].id].items.find(function (el) {
            return el.itemID == itemID;
        });
        feedID = newitem.idOrigin;
    }
    let className = (options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";

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
            let currentFeed = feeds.find(function (el) {
                return (el.id == feedID);
            });
            if (currentFeed != null) {
                //search group by name
                let currentGroup = groups.find(function (el) {
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
        if (options.showallfeeds) {
            element = document.getElementById("item_" + allFeedsID + "_" + itemID);
            if (element != null) {
                element.className = element.className.replace(className, "");
            }
        }

        UnMarkItemReadLaterWithoutSelectFeed(findWithAttr(readlaterInfo[readLaterFeedID].items, 'itemID', itemID));

        SaveUnreadInfo(listUnread, false);
        UpdateFeedUnread(readLaterFeedID);
        UpdateFeedUnread(feedID);
        UpdateReadAllIcon((selectedFeedKeyIsFeed) ? "Feed" : "Group");
    }
}

function ShowContent(numImg, containerId, feedID, itemIndex, sens) {
    let container = document.getElementById(containerId);
    let currentImg = container.querySelector('.feedPreviewSummaryImg' + numImg);
    let otherImg = container.querySelector('.feedPreviewSummaryImg' + (numImg == "" ? "2" : ""));
    let feedPreviewSummaryContent = container.querySelector('.feedPreviewSummaryContent');
    let feedPreviewSummary = container.querySelector('.feedPreviewSummary');

    //currentImg.setAttribute("display", "none");
    //otherImg.setAttribute("display", "");
    currentImg.style.display = "none";
    otherImg.style.display = "";

    //var currentItem = GetFeedInfoItem(feedID, itemIndex);

    if (sens) {
        feedPreviewSummaryContent.style.display = "";
        feedPreviewSummary.style.display = "none";
    } else {
        feedPreviewSummaryContent.style.display = "none";
        feedPreviewSummary.style.display = "";
    }
}

function MarkItemReadLater(feedID, itemIndex) {
    let currentItem = GetFeedInfoItem(feedID, itemIndex);
    let itemID = currentItem.itemID;
    let itemExist = false;

    for (let i = 0; i < readlaterInfo[readLaterFeedID].items.length; i++) {
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
//TODO ***
    unreadInfo[readLaterFeedID].unreadtotal = readlaterInfo[readLaterFeedID].items.length;

    MarkItemRead(itemID);
    UpdateFeedUnread(readLaterFeedID);

    saveReadlaterInfo();
}

function UnMarkItemReadLater(itemIndex) {
    if (itemIndex >= 0) {
        UnMarkItemReadLaterWithoutSelectFeed(itemIndex).then(function () {
            SelectFeed(0);
        });
    }
}

function UnMarkItemReadLaterWithoutSelectFeed(itemIndex) {
    let promiseSaved = null;
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
    if (typeof key === 'string') {
        key = parseInt(key);
    }
    let feediframe = document.getElementById("contentNotFormated");
    if (feediframe != undefined) {
        document.getElementById("feedPreviewScroller").removeChild(feediframe);
    }

    let feedsOrGroups, feedsOrGroupsInfo, selectedFeedsOrGroups;
    var lastSelectedFeedID = null;
    var lastSelectedFeedType = null;
    let listPromise = [];

    let resolveGetLastSelectedFeed;
    let waitGetLastSelectedFeed = new Promise((resolve) => {
        resolveGetLastSelectedFeed = resolve;
    });

    listPromise.push(waitGetLastSelectedFeed);
	sendtoSQL('getLastSelectedFeed', 'ShowFeeds', true, undefined, function(data){
        if (data != null) {
            if (data.length > 0) {
                lastSelectedFeedID = data[0].lastSelectedFeedID;
                lastSelectedFeedType = data[0].lastSelectedFeedType;
            }
        }
        resolveGetLastSelectedFeed();
    });

    let resolveGetInfo;
    let waitGetInfo = new Promise((resolve) => {
        resolveGetInfo = resolve;
    });

    listPromise.push(waitGetInfo);
    if (type == "Feed") {
        sendtoSQL('getCacheFeedInfo', 'ViewerShowFeeds', true, { feed_id: feeds[key].id }, function(data){
            if (data != null) {
                if (data.length > 0) {
                    if (data[0].items != undefined) {
                        feedsOrGroupsInfo = data[0];
                        feedInfo[feeds[key].id].items = feedsOrGroupsInfo.items; //*******
                    }
                }
            }
            resolveGetInfo();
        });
        if (feeds[key].id == readLaterFeedID) {
            listPromise.push(loadReadlaterInfo());
        }
    } else {
        sendtoSQL('getGroupInfo', 'ViewerShowGroups', true, { group_id: groups[key].id }, function(data){
            if (data != null) {
                if (data.length > 0) {
                    if (data[0].items != undefined) {
                        feedsOrGroupsInfo = data[0];
                        groupInfo[feeds[key].id].items = feedsOrGroupsInfo.items; //***
                    }
                }
            }
            resolveGetInfo();
        });
    }

    Promise.allSettled(listPromise).then(function () {
        if (lastSelectedFeedType == "Feed") {
            selectedFeedsOrGroups = feeds;
        } else {
            selectedFeedsOrGroups = groups;
        }

        if (type == "Feed") {
            feedsOrGroups = feeds;
            if (feeds[key].id == readLaterFeedID) {
                feedsOrGroupsInfo = readlaterInfo;
            }
        } else {
            feedsOrGroups = groups;
        }

        let lastSelectedFeed = {};
        lastSelectedFeed.lastSelectedFeedID = feedsOrGroups[key].id;
        lastSelectedFeed.lastSelectedFeedType = type;

		requests = [];
		requests.push({type: 'setLastSelectedFeed', waitResponse: false, data: lastSelectedFeed });
		requests.push({type: 'export', responsetype: 'responseExport', tableName: 'LastSelectedFeed', waitResponse: true, subtype: 'LastSelectedFeed' });
		sendtoSQL('requests', 'SelectFeedOrGroup', false, { requests: requests });

        document.getElementById("feedPreviewScroller").scrollTop = 0;

        clearTimeout(feedReadToID);

        if ((selectedFeedKey != null) && (selectedFeedKey != undefined)) {
            document.getElementById("feedTitle" + lastSelectedFeedType + selectedFeedsOrGroups[selectedFeedKey].id).setAttribute("class", "");
        }

        document.getElementById("feedTitle" + type + feedsOrGroups[key].id).setAttribute("class", "selectedFeed");

        selectedFeedKey = key;
        selectedFeedKeyIsFeed = (type == "Feed");
        UpdateTitle();

        // clear the slate
        let el = document.getElementById("feedPreview");

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
        let feednotready;
        if (feedsOrGroups[key].id != readLaterFeedID) {
            if (feedsOrGroups[key].id == allFeedsID) {
                let keys = Object.keys(feedInfo);
                for (let i = 0; i < keys.length; i++) {
                    feednotready = feedInfo[keys[i]].loading;
                    if (feednotready) {
                        break;
                    }
                }
            } else {
                if (feedsOrGroupsInfo == undefined) {
                    feednotready = true;
                } else {
                    feednotready = !feedsOrGroupsInfo.loading ? false : true;
                }
            }
            if (feednotready) {
                document.getElementById("refresh").style.display = "none";
                document.getElementById("headerMessage").innerHTML = GetMessageText("backViewerLoadingFeed");
                document.getElementById("header").className = "loading";

                if (type == "Feed") {
                    // must be a new feed with no content yet
                    chrome.runtime.sendMessage({ //***
                        "type": "checkForUnreadOnSelectedFeedCompleted",
                        "selectedFeedKey": key
                    }).then(function () {
                        if (type == "Feed") {
                            sendtoSQL('getCacheFeedInfo', 'ViewerShowFeeds', true, { feed_id: feeds[key].id }, function(data){
                                if (data != null) {
                                    if (data.length > 0) {
                                        if (data[0].items != undefined) {
                                            feedsOrGroupsInfo = data[0];
                                        }
                                    }
                                }
                                RenderFeedFromSelect(type, key, feedsOrGroups, feedsOrGroupsInfo);
                            });
                        } else {
                            sendtoSQL('getGroupInfo', 'ViewerShowGroups', true, { group_id: groups[key].id }, function(data){
                                if (data != null) {
                                    if (data.length > 0) {
                                        if (data[0].items != undefined) {
                                            feedsOrGroupsInfo = data[0];
                                        }
                                    }
                                }
                                RenderFeedFromSelect(type, key, feedsOrGroups, feedsOrGroupsInfo);
                            });
                        }
                    });
                    return;
                }
            }
        }

        // feed loaded, but had an error
        if (feedsOrGroupsInfo != null) {
            if (feedsOrGroupsInfo.error != "") {
                ShowFeedError(feedsOrGroupsInfo.error, feedsOrGroupsInfo.errorContent, feedsOrGroupsInfo.showErrorContent, feedsOrGroups[key].url, feedsOrGroups[key].urlredirected);
                return;
            }
            document.getElementById("noItems").style.display = (feedsOrGroupsInfo.items.length == 0) ? "" : "none";
        }

        RenderFeedFromSelect(type, key, feedsOrGroups, feedsOrGroupsInfo);

        RefreshCategoryList();
        ShowCategory(true);
    });
}

function RenderFeedFromSelect(type, key, feedsOrGroups, feedsOrGroupsInfo) {
    RenderFeed(type, feedsOrGroupsInfo);
    UpdateReadAllIcon(type);
    FixFeedList(); // in case header wraps

    if (options.markreadafter > 0 && key != 0) {
        feedReadToID = setTimeout(function () {
            try {
                MarkFeedRead(feedsOrGroups[key].id)
            } catch (e) {
                if (options.log) {
                    console.log(e);
                }
            }
        }, options.markreadafter * 1000);
    }
    focusFeed();
}

function RenderFeed(type, feedsOrGroupsInfo) {
    let itemID = null;
    let feedTitle = null;
    let feedLink = null;
    let feedReadLater = null;
    let feedContainer = null;
    let feedPublished = null;
    let feedMarkRead = null;
    let feedSummaryContent = null;
    let feedSummary = null;
    let feedAuthor = null;
    let feedComments = null;
    let feedPreviewFoot = null;
    let feedUnread = null;
    let summaryLinks = null;
    let summaryImages = null;
    let summaryObjects = null;
    let item = null;
    let feedsOrGroups = (type == "Feed") ? feeds : groups;
    let feedID = feedsOrGroups[selectedFeedKey].id;
    let currentTr = null;
    let columnCount = 0;
    let colWidth = null;
    let feedTd = null;
    let href = "";
    let headerMessage = "";
    let showItem;

    if ((type == "Feed") && (feedsOrGroups[selectedFeedKey].id == readLaterFeedID)) {
        feedsOrGroupsInfo = readlaterInfo;
    }

    if (feedsOrGroupsInfo == null) {
        return;
    }

    headerMessage = feedsOrGroupsInfo.title;
    if (feedsOrGroupsInfo.description != "" && options.showdescriptions) {
        headerMessage += "<span> : " + feedsOrGroupsInfo.description + "</span>";
    }
    document.getElementById("headerMessage").innerHTML = headerMessage;

    let logoUsed = false;
    if (feedsOrGroupsInfo.image != undefined) {
        if (feedsOrGroupsInfo.image[0] != undefined) {
            if (feedsOrGroupsInfo.image[0]["url"] != undefined) {
                document.getElementById("headerLogo").style.backgroundImage = "url(" + feedsOrGroupsInfo.image[0]["url"] + ")";
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
    let feedBaseUrl = (new URL(feedsOrGroups[selectedFeedKey].url)).origin;

    if (feedsOrGroups[selectedFeedKey].urlredirected != undefined) {
        document.getElementById("urlRedirectedUrl").innerText = feedsOrGroups[selectedFeedKey].urlredirected;
        document.getElementById("urlRedirected").style.display = "";
    } else {
        document.getElementById("urlRedirected").style.display = "none";
    }

    let nbItem = Math.min(feedsOrGroupsInfo.items.length, feedsOrGroups[selectedFeedKey].maxitems);
    let itemNo = 0;
    for (let i = 0; i < nbItem; i++) {
        showItem = true;
        item = feedsOrGroupsInfo.items[i];

        if (options.useViewByCategory) {
            if ((categoryFilterUpper != '') && (categoryFilterUpper != undefined)) {
                showItem = false;
                if (item.category != undefined) {
                    if (item.category.constructor === Array) {
                        for (let cat of item.category) {
                            if (typeof cat == 'string') {
                                if (cat != "") {
                                    showItem = (categoryFilterUpper == cat.toUpperCase());
                                    if (showItem) {
                                        break;
                                    }
                                }
                            }
                        }
                    } else {
                        if (typeof item.category == 'string') {
                            if (item.category != "") {
                                showItem = (categoryFilterUpper == item.category.toUpperCase());
                            }
                        }
                    }
                }
            }
        }

        if (showItem) {
            itemNo++;
            itemID = item.itemID;

            let containerId = "item_" + feedID + "_" + itemID;

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
            if (item.title != undefined) {
                feedLink.innerHTML = itemNo + ". " + item.title;
            } else {
                feedLink.innerHTML = itemNo + ". " + item.description
            }

            if (feedID == readLaterFeedID) {
                if (options.readlaterremovewhenviewed) {
                    $(feedLink).click({url: href, i: i}, function (event) {
                        LinkProxy(event.data.url);
                        UnMarkItemReadLater(event.data.i);
                        return false;
                    });
                } else {
                    $(feedLink).click({url: href}, function (event) {
                        LinkProxy(event.data.url);
                        return false;
                    });
                }
            } else {
                $(feedLink).click({url: href, feedID: feedID, itemID: itemID}, function (event) {
                    LinkProxy(event.data.url);
                    if (!options.dontreadontitleclick) {
                        MarkItemRead(event.data.itemID);
                    }
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

            if (options.showfeedcontentsummary < 2) {
                let sens;
                let feedSummaryImg = document.createElement("img");
                let feedSummaryImg2 = document.createElement("img");

                if (options.showfeedcontentsummary == 0) {
                    feedSummaryImg.setAttribute("src", "up.png");
                    feedSummaryImg.setAttribute("title", GetMessageText("backSummaryHide"));
                    sens = false;
                } else {
                    feedSummaryImg.setAttribute("src", "down.png");
                    feedSummaryImg.setAttribute("title", GetMessageText("backSummaryShow"));
                    sens = true;
                }
                feedSummaryImg.setAttribute("class", "feedPreviewSummaryImg");
                feedSummaryImg.addEventListener("mouseover", onmouseover);
                feedSummaryImg.addEventListener("mouseout", onmouseout);
                if (sens) {
                    $(feedSummaryImg).click({containerId: containerId, feedID: feedID, i: i}, function (event) {
                        ShowContent("", event.data.containerId, event.data.feedID, event.data.i, true);
                        return false;
                    });
                } else {
                    $(feedSummaryImg).click({containerId: containerId, feedID: feedID, i: i}, function (event) {
                        ShowContent("", event.data.containerId, event.data.feedID, event.data.i, false);
                        return false;
                    });
                }
                feedTitle.appendChild(feedSummaryImg);

                if (options.showfeedcontentsummary == 0) {
                    feedSummaryImg2.setAttribute("src", "down.png");
                    feedSummaryImg2.setAttribute("title", GetMessageText("backSummaryShow"));
                    sens = true;
                } else {
                    feedSummaryImg2.setAttribute("src", "up.png");
                    feedSummaryImg2.setAttribute("title", GetMessageText("backSummaryHide"));
                    sens = false;
                }
                feedSummaryImg2.setAttribute("class", "feedPreviewSummaryImg2");
                feedSummaryImg2.addEventListener("mouseover", onmouseover);
                feedSummaryImg2.addEventListener("mouseout", onmouseout);
                feedSummaryImg2.style.display = "none";
                if (sens) {
                    $(feedSummaryImg2).click({containerId: containerId, feedID: feedID, i: i}, function (event) {
                        ShowContent("2", event.data.containerId, event.data.feedID, event.data.i, true);
                        return false;
                    });
                } else {
                    $(feedSummaryImg2).click({containerId: containerId, feedID: feedID, i: i}, function (event) {
                        ShowContent("2", event.data.containerId, event.data.feedID, event.data.i, false);
                        return false;
                    });
                }
                feedTitle.appendChild(feedSummaryImg2);
            }

            if (options.showsavethisfeed) {
                let onefeed = document.createElement("img");
                onefeed.setAttribute("src", "download.png");
                onefeed.setAttribute("class", "onefeed");
                $(onefeed).click({containerId: containerId}, function (event) {
                    let refdoc = document.getElementById(event.data.containerId);
                    let docTitle = refdoc.querySelector('.feedPreviewTitle');
                    let docContent = refdoc.querySelector('.feedPreviewSummaryContent');

                    listonefeed[event.data.containerId] = {title: docTitle.innerHTML, content: docContent.innerHTML};

                    chrome.tabs.create({url: "showonefeed.html#" + event.data.containerId});
                    return false;
                });
                onefeed.addEventListener("mouseover", onmouseover);
                onefeed.addEventListener("mouseout", onmouseout);
                feedTitle.appendChild(onefeed);
            }

            if (item.updated) {
                let feedreadUpdated = document.createElement("img");
                feedreadUpdated.setAttribute("src", "bell.png");
                feedreadUpdated.setAttribute("title", GetMessageText("bell"));
                feedreadUpdated.setAttribute("class", "feedreadUpdated");
                feedTitle.appendChild(feedreadUpdated);
            }

            feedTitle.appendChild(feedLink);

            feedPublished = document.createElement("div");
            feedPublished.setAttribute("class", "feedPreviewDate");
            let datePub = GetFormattedDate(item.date);
            if ((item.category != undefined) && (item.category != "")) {
                datePub += ' ' + item.category;
            }
            feedPublished.appendChild(document.createTextNode(datePub));

            feedAuthor = document.createElement("div");
            feedAuthor.setAttribute("class", "feedPreviewAuthor");
            feedAuthor.innerText = item.author;

            feedPreviewFoot = document.createElement("div");
            feedPreviewFoot.setAttribute("class", "feedPreviewFoot");

            feedComments = document.createElement("div");
            feedComments.setAttribute("class", "feedPreviewComments");

            if ((item.comments != undefined) || (item.comments == "") && (typeof item.comments == "string")) {
                let feedCommentsLink = document.createElement("a");
                feedCommentsLink.setAttribute("href", item.comments);
                feedCommentsLink.innerText = GetMessageText("commentsLink");
                $(feedCommentsLink).click({url: item.comments}, function (event) {
                    LinkProxy(event.data.url);
                    return false;
                });
                feedComments.appendChild(feedCommentsLink);
            } else {
                let feedEmpty = document.createElement("div");
                feedEmpty.innerHTML = "&nbsp;";
                feedComments.appendChild(feedEmpty);
            }

            feedSummaryContent = document.createElement("div");
            feedSummaryContent.setAttribute("class", "feedPreviewSummaryContent");
            if ((options.feedsmaxheight != null) && (options.feedsmaxheight != 0)) {
                feedSummaryContent.style.maxHeight = options.feedsmaxheight + "px";
            } else {
                feedSummaryContent.style.maxHeight = "none";
            }

            if (options.showfeedcontentsummary == 1) {
                feedSummaryContent.style.display = "none";
            } else {
                feedSummaryContent.style.display = "";
            }

            if (options.usethumbnail && (item.thumbnail != null)) {
                feedSummaryContent.innerHTML = '<div class="thumbnail">' + item.thumbnail + '</div>' + item.content; //***
            } else {
                feedSummaryContent.innerHTML = item.content;
            }

            feedContainer = document.createElement("div");
            feedContainer.setAttribute("id", containerId);

            if (ItemIsRead((feedID != readLaterFeedID) ? feedsOrGroupsInfo.items[i].idOrigin : readLaterFeedID, itemID)) {
                if (options.readitemdisplay == 0) {
                    feedContainer.setAttribute("class", "feedPreviewContainer feedPreviewContainerRead");
                } else {
                    feedContainer.setAttribute("class", "feedPreviewContainer feedPreviewContainerRead feedPreviewContainerCondensed");
                }
            } else {
                feedContainer.setAttribute("class", "feedPreviewContainer");
            }

            if (options.useViewByCategory) {
                let categoryColor = undefined;
                if ((listCategoriesRegisteredUpper != undefined) && (item.category != undefined)) {
                    if (item.category.constructor === Array) {
                        for (let cat of item.category) {
                            if (typeof cat == 'string') {
                                if (cat != "") {
                                    let catUpper = cat.toUpperCase();
                                    let catColor = listCategoriesRegisteredUpper.find(obj => obj.category == catUpper);
                                    if (catColor) {
                                        categoryColor = catColor.color;
                                        break;
                                    }
                                }
                            }
                        }
                    } else {
                        if (typeof item.category == 'string') {
                            if (item.category != "") {
                                let catUpper = item.category.toUpperCase();
                                let catColor = listCategoriesRegisteredUpper.find(obj => obj.category == catUpper);
                                if (catColor) {
                                    categoryColor = catColor.color;
                                }
                            }
                        }
                    }
                }
                if (categoryColor != undefined) {
                    feedContainer.style.borderColor = categoryColor;
                    feedTitle.style.backgroundColor = categoryColor;
                }
            }

            // make all summary links open a new tab
            summaryLinks = feedSummaryContent.getElementsByTagName("a");
            for (let l = 0; l < summaryLinks.length; l++) {
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
            summaryImages = feedSummaryContent.getElementsByTagName("img");
            for (let q = summaryImages.length - 1; q >= 0; q--) {
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
            for (let p = 0; p < 2; p++) {
                switch (p) {
                    case 0:
                        summaryObjects = feedSummaryContent.getElementsByTagName("object");
                        break;
                    case 1:
                        summaryObjects = feedSummaryContent.getElementsByTagName("embed");
                        break;
                    case 2:
                        summaryObjects = feedSummaryContent.getElementsByTagName("iframe");
                        break;
                }

                for (let o = summaryObjects.length - 1; o >= 0; o--) {
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
            }

            // Remove long space before or after img in style from feed
            summaryObjects = feedSummaryContent.querySelectorAll('[style]');
            for (let o = summaryObjects.length - 1; o >= 0; o--) {
                summaryObjects[o].style.paddingTop = "";
                summaryObjects[o].style.paddingBottom = "";
            }

            if (columnCount == options.columns) {
                columnCount = 0;
            }

            if (columnCount == 0) {
                currentTr = document.createElement("tr");
                document.getElementById("feedPreview").appendChild(currentTr);
            }

            feedSummary = document.createElement("div");
            feedSummary.setAttribute("class", "feedPreviewSummary");
            feedSummary.style.maxHeight = "none";
            if (options.usethumbnail && (item.thumbnail != null)) {
                feedSummary.innerHTML = '<div class="thumbnail">' + item.thumbnail + '</div>' + item.summary; //***
            } else {
                feedSummary.innerHTML = item.summary;
            }

            if (options.showfeedcontentsummary == 1) {
                feedSummary.style.display = "";
            } else {
                feedSummary.style.display = "none";
            }

            feedContainer.appendChild(feedTitle);
            feedContainer.appendChild(feedSummaryContent);
            feedContainer.appendChild(feedSummary);

            feedPreviewFoot.appendChild(feedPublished);
            feedPreviewFoot.appendChild(feedComments);
            feedPreviewFoot.appendChild(feedAuthor);
            feedContainer.appendChild(feedPreviewFoot);

            feedTd = document.createElement("td");
            feedTd.style.width = colWidth;
            feedTd.appendChild(feedContainer);

            currentTr.appendChild(feedTd);
            columnCount++;
        }
    }
}

function ShowFeedError(message, content, showErrorContent, url, urlredirected) {
    document.getElementById("feedErrorMessage").innerText = message;
    document.getElementById("headerMessage").innerHTML = GetMessageText("backViewerFeedIssue");
    document.getElementById("feedError").style.display = "";
    document.getElementById("headerLogo").style.backgroundImage = "url(rss.png)";

    ShowCategory(false);

    let showErrorNow = true;
    if (options.showfeediframes) {
        if ((typeof content == "string") && ((url != undefined) || (urlredirected != undefined))) {
            if (content.substring(0, 20).toUpperCase().includes("HTML")) {
                showErrorNow = false;

                let feedPrev = document.getElementById("feedPreviewScroller");
                let addiframe = false;
                let feediframe = document.getElementById("contentNotFormated");
                if (feediframe == undefined) {
                    feediframe = document.createElement("div");
                    feediframe.setAttribute("class", "contentNotFormated");
                    feediframe.setAttribute("id", "contentNotFormated");
                    addiframe = true;
                }

                let heightSize = Math.max(feedPrev.offsetHeight - document.getElementById("feedError").offsetHeight, 50);

                if (showErrorContent) {
                    feediframe.innerHTML = '<iframe id="ContentIFrame" srcdoc="" frameborder="0" style="border: 0" height="' + heightSize + '" width="' + feedPrev.style.width + '" sandbox="allow-same-origin"></iframe>';

                    feediframe.style.height = feedPrev.style.height;
                    feediframe.style.width = feedPrev.style.width;
                    if (addiframe) {
                        document.getElementById("feedPreviewScroller").appendChild(feediframe);
                    }
                    let contentfeediframe = document.getElementById("ContentIFrame");
                    contentfeediframe.srcdoc = content;
                } else {
                    let iframeurl;
                    if (urlredirected != undefined) {
                        iframeurl = urlredirected;
                    } else {
                        iframeurl = url;
                    }
                    feediframe.innerHTML = '<iframe id="ContentIFrame" src="' + iframeurl + '" frameborder="0" style="border: 0" height="' + heightSize + '" width="' + feedPrev.style.width + '"  sandbox="allow-same-origin"></iframe>';
                    feediframe.style.height = feedPrev.style.height;
                    feediframe.style.width = feedPrev.style.width;
                    if (addiframe) {
                        document.getElementById("feedPreviewScroller").appendChild(feediframe);
                    }
                }
            }
        }
    }

    if (showErrorNow) {
        let feediframe = document.getElementById("contentNotFormated");
        if (feediframe != undefined) {
            document.getElementById("feedPreviewScroller").removeChild(feediframe);
        }
    }

    document.getElementById("urlRedirected").style.display = "none";

    let feedErrorContentElement = document.getElementById("feedErrorContent");

    if (showErrorNow && (content != undefined) && (content != "")) {
        let feediframeerror = document.getElementById("iframefeedErrorContent");
        if (feediframeerror != undefined) {
            feedErrorContentElement.removeChild(feediframeerror);
        }
        feediframeerror = document.createElement("iframe");
        feediframeerror.setAttribute("class", "iframefeedErrorContent");
        feediframeerror.setAttribute("id", "iframefeedErrorContent");
        feediframeerror.setAttribute("width", "100%");
        let postitionTag = feedErrorContentElement.getBoundingClientRect();
        feediframeerror.setAttribute("height", (screen.availHeight * 0.92) - (postitionTag.bottom + window.scrollY + 2) + "px");
        feediframeerror.sandbox = 'allow-forms allow-same-origin';
        feediframeerror.srcdoc = cleanScriptFromHTML(content);
        feedErrorContentElement.appendChild(feediframeerror);
    } else {
        let feediframeerror = document.getElementById("iframefeedErrorContent");
        if (feediframeerror != undefined) {
            feedErrorContentElement.removeChild(feediframeerror);
        }
        feedErrorContentElement.innerHTML = "";
    }
}

// central function to control creation of tabs so we can put them in the background
function LinkProxy(uRL) {
    chrome.tabs.create({url: uRL, active: !options.loadlinksinbackground, selected: !options.loadlinksinbackground});
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
        if (document.getElementById("feedHeader") != undefined) {
            let localSizeFeedHeader = document.getElementById("feedHeader").offsetWidth;
            if ((localSizeFeedHeader != 0) && !isNaN(localSizeFeedHeader)) {
                sizeFeedHeader = localSizeFeedHeader;
            }
        }
    }
    if ((sizeFeedsLoadingTxt == null) || updateAll) {
        let elFeedsLoadingTxt = document.getElementById("feedsLoadingTxt");
        let localSizeFeedsLoadingTxt = null;
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
        let computedSize = sizeFeedHeader - sizeFeedsLoadingTxt;
        if (computedSize < 30) {
            sizeProgressboxLoading = '100%';
        } else {
            sizeProgressboxLoading = computedSize + 'px';
        }
        if (document.getElementById("feedsLoadingProgressBox") != undefined) {
            if (document.getElementById("feedsLoadingProgressBox").style.width != sizeProgressboxLoading) {
                document.getElementById("feedsLoadingProgressBox").style.width = sizeProgressboxLoading;
            }
        }
    }
}

function onmouseover() {
    hover(this);
}

function onmouseout() {
    unhover(this);
}

// marks a feed read.
function OpenAllFeedButton(feedID) {
    let container = null;
    let itemID = null;
    let className = (options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";
    let groupKey = null;
    var listUnread = [];

    if (selectedFeedKeyIsFeed) {
        if (unreadInfo[feedID].unreadtotal == 0) {
            return;
        }

        // for read later feeds, nuke the items instead of mark read
        if (feedID == readLaterFeedID) {
            for (let i = 0; i < readlaterInfo[readLaterFeedID].items.length; i++) {
                LinkProxy(readlaterInfo[readLaterFeedID].items[i].url);
            }

            readlaterInfo[readLaterFeedID].items = [];
            saveReadlaterInfo();
            SelectFeed(0);
        } else {
            OpenAllFeedFromButton(feedID, container, itemID, className, listUnread);
        }

        if (listUnread.length > 0) {
            SaveUnreadInfo(listUnread, true);
            UpdateFeedUnread(feedID);
            UpdateReadAllIcon("Feed");
        }
    } else {
        groupKey = GetGroupKeyByID(feedID);
        if (groupKey != null) {
            if (groups[groupKey] != null) {
                let feedFilteredList;
                if (groups[groupKey].id != allFeedsID) {
                    feedFilteredList = GetFeedsFilterByGroup(groupKey);
                } else {
                    feedFilteredList = feeds.filter(function (el) {
                        return (el.id != readLaterFeedID);
                    });
                }
                if (feedFilteredList.length > 0) {
                    feedFilteredList.forEach((item) => {
                        OpenAllFeedButtonFromGroup(item.id, listUnread);
                    });
                    if (listUnread.length > 0) {
                        SaveUnreadInfo(listUnread, true);
                        UpdateFeedUnread(feedID);
                        UpdateReadAllIcon("Group");
                        UpdateUnreadBadge();
                    }
                }
            }
        }
    }
}

function OpenAllFeedButtonFromGroup(feedID, listUnread) {
    let container = null;
    let itemID = null;
    let className = (options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";

    if (unreadInfo[feedID].unreadtotal == 0) {
        return;
    }
    OpenAllFeedFromButton(feedID, container, itemID, className, listUnread);
}

function OpenAllFeedFromButton(feedID, container, itemID, className, listUnread) {
    for (let i = 0; i < feedInfo[feedID].items.length; i++) {
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

function SaveUnreadInfo(listUnread, setunset) {
    let requests = [];
    if (setunset) {
        for (let i = 0; i < listUnread.length; i++) {
            requests.push({type: 'addUnreadinfoItem', waitResponse: false, data: { feed_id: listUnread[i].id, itemHash: listUnread[i].key, value: new Date().getTime() + 5184000000 } });
        }
    } else {
        for (let i = 0; i < listUnread.length; i++) {
            requests.push({type: 'deleteUnreadinfoItem', waitResponse: false, data: { feed_id: listUnread[i].id, itemHash: listUnread[i].key } });
        }
    }
    requests.push({type: 'export', responsetype: 'responseExport', tableName: 'UnreadinfoItem', waitResponse: true, subtype: 'UnreadinfoItem' });
    sendtoSQL('requests', 'SaveUnreadInfo', false, { requests: requests });
}

function InternalConnection(port) {
    if (port != null) {
        for (let key in listonefeed) {
            if (port.name == key) {
                port.postMessage(listonefeed[key]);
                //delete listonefeed[key];
            }
        }
    }
}
function RefreshCategoryList() {
    removeAllCategories();
    let categoryArray = ListAllCategories();

    let options;
    let selectBox = document.getElementById("categoryList");
    if (selectBox != undefined) {
        options = selectBox.innerHTML;
    }
    for (const cat of categoryArray) {
        options += AddCategoryToList(cat);
    }
    selectBox.innerHTML = options;
}
function AddCategoryToList(cat) {
    return '<option data-value="' + cat + '" value="' + cat + '"></option>';
}

function removeAllCategories() {
    let selectBox = document.getElementById("categoryList");
    if (selectBox != undefined) {
        while (selectBox.options.length > 0) {
            selectBox.children[0].remove();
        }
        selectBox.innerHTML = AddCategoryToList(' ');
    }
}

function ListAllCategories() {
    let categoryArray = [];
    let categoryArrayUpper = [];
    let resultCat;
    let info;
    let isAllFeed = false;
//TODO ***
    if (!selectedFeedKeyIsFeed) {
        if (groups[selectedFeedKey] != undefined) {
            isAllFeed = (groups[selectedFeedKey].id == allFeedsID);
        }
    }
    if ((selectedFeedKey != null) && !(isAllFeed)) {
        if ((selectedFeedKey == readLaterFeedID) || (selectedFeedKey == 0)) {
            info = readlaterInfo[readLaterFeedID];
        } else {
            if (selectedFeedKeyIsFeed) {
                info = feedInfo[feeds[selectedFeedKey].id];
            } else {
                info = groupInfo[groups[selectedFeedKey].id];
            }
        }

        if (info != undefined) {
            let nbItem = info.items.length;
            for (let j = 0; j < nbItem; j++) {
                let item = info.items[j];
                resultCat = SearchCat(categoryArray, categoryArrayUpper, item);
                categoryArray = resultCat.categoryArray;
                categoryArrayUpper = resultCat.categoryArrayUpper;
            }
        }
        return sortArrayStr(categoryArray);
    }

    let keys = Object.keys(feedInfo);
    let nbKeys = keys.length;
    for (let i = 0; i <nbKeys; i++) {
        if ((keys[i] != allFeedsID) && (keys[i] != readLaterFeedID)) {
            if (!feedInfo[keys[i]].loading) {
                let nbItem = feedInfo[keys[i]].items.length;
                for (let j = 0; j < nbItem; j++) {
                    let item = feedInfo[keys[i]].items[j];
                    resultCat = SearchCat(categoryArray, categoryArrayUpper, item);
                    categoryArray = resultCat.categoryArray;
                    categoryArrayUpper = resultCat.categoryArrayUpper;
                }
            }
        }
    }
    return sortArrayStr(categoryArray);
}

function SearchCat(categoryArray, categoryArrayUpper, item) {
    let catUpper;
    if (item.category != undefined) {
        if (item.category.constructor === Array) {
            for (let cat of item.category) {
                if (typeof cat == 'string') {
                    if (cat != "") {
                        catUpper = cat.toUpperCase();
                        if (categoryArrayUpper.indexOf(catUpper) == -1) {
                            categoryArray.push(cat);
                            categoryArrayUpper.push(catUpper);
                        }
                    }
                }
            }
        } else {
            if (typeof item.category == 'string') {
                if (item.category != "") {
                    catUpper = item.category.toUpperCase();
                    if (categoryArrayUpper.indexOf(catUpper) == -1) {
                        categoryArray.push(item.category);
                        categoryArrayUpper.push(catUpper);
                    }
                }
            }
        }
    }
    return {categoryArray: categoryArray, categoryArrayUpper: categoryArrayUpper};
}

function ShowCategory(showCat) {
    if (options.useViewByCategory && showCat) {
        let listOption = document.getElementById("categoryList").options;
        if (listOption.length > 1) {
            document.getElementById("categoryFilter").style.display = "";
        } else {
            document.getElementById("categoryFilter").style.display = "none";
        }
    } else {
        document.getElementById("categoryFilter").style.display = "none";
    }
}

function GetCurrentInfo() {
    let info = undefined;
    let isAllFeed = false;
    let id;
    if (!selectedFeedKeyIsFeed) {
        if (groups[selectedFeedKey] != undefined) {
            isAllFeed = (groups[selectedFeedKey].id == allFeedsID);
            id = groups[selectedFeedKey].id;
        }
    }
    if ((selectedFeedKey != null) && !(isAllFeed)) {
        if ((selectedFeedKey == readLaterFeedID) || (selectedFeedKey == 0)) {
            info = readlaterInfo[readLaterFeedID];
            id = readLaterFeedID;
        } else {
            if (selectedFeedKeyIsFeed) {
                info = feedInfo[feeds[selectedFeedKey].id];
                id = feeds[selectedFeedKey].id;
            } else {
                info = groupInfo[groups[selectedFeedKey].id];
                id = groups[selectedFeedKey].id;
            }
        }
    }
    return {info: info, id: id};
}
