var promiseUpgrade = null;
var promiseGetUnreadCounts = null;
var promiseGetReadLaterItems = null;
var promiseExternalRequest = null;
var checkingForUnread = false;
var checkForUnreadTimerID = null;
var checkForUnreadCounter = 0;
var allFeedsUnreadCounter = -1;
var getFeedsCallBack = null;
var refreshFeed = false;
var viewPortTabID = null;
var referenceDate = GetDate("Thu, 31 Dec 2019 23:59:59 +0000").getTime();
var viewerPortTabID = null;
var apiaddurlTabID = null;
var forceRefresh = false;
var spamProtect = [];
var listApiUrlToAdd = [];

chrome.action.onClicked.addListener(ButtonClicked);
chrome.runtime.onMessage.addListener(ExternalRequest);
chrome.runtime.onConnect.addListener(InternalConnection);
chrome.alarms.onAlarm.addListener(AlarmRing);
chrome.runtime.onMessageExternal.addListener(ApiRequest);

waitOptionReady().then(function () {
    promiseUpgrade = DoUpgrades();
    waitUpgrade().then(function () {
        promiseGetUnreadCounts = GetUnreadCounts();
        waitGetUnreadCounts().then(function () {
            GetFeeds(function () {
                var promiseCleanUpUnreadOrphans = CleanUpUnreadOrphans();
                promiseCleanUpUnreadOrphans.then(function(){
                    CheckForUnreadStart();
                });
            });
        });
    });
});

async function waitUpgrade() {
    return start = await Promise.allSettled([promiseUpgrade]);
}

async function waitGetUnreadCounts() {
    return start = await Promise.allSettled([promiseGetUnreadCounts]);
}

async function waitGetReadLaterItems() {
    return start = await Promise.allSettled([promiseGetReadLaterItems]);
}

async function waitPromise(listPromiseToWait) {
    return start = await Promise.allSettled([listPromiseToWait]);
}

async function waitExternalRequest() {
    return start = await Promise.allSettled([promiseExternalRequest]);
}

function AlarmRing(alarm){
    if (alarm.name == 'CheckForUnread') {
        try {
            CheckForUnreadStart();
        } catch(e){
            if (options.log) {
                console.log(e);
            }
        }
    }
}

// communicate with other pages
function InternalConnection(port) {
    if (port.name == "viewerPort") {
        viewerPort = port;
        port.onDisconnect.addListener(function (port) {
            viewerPort = null;
        });
    }
}

// tells viewer to reload, a feed changed
function ReloadViewer() {
    var promiseCleanUpUnreadOrphans = CleanUpUnreadOrphans();
    promiseCleanUpUnreadOrphans.then(function() {
        if (viewerPort != null) {
            viewerPort.postMessage({type: "feedschanged"});
        }
    });
}

// manage viewer spawning or focus
function ButtonClicked(tab) {
    if (viewerPort == null) {
        chrome.tabs.create({url: chrome.runtime.getURL("viewer.html")}, function (tab) {
            viewerPortTabID = tab.id;
        });
    } else {
        RefreshViewer();
    }
}

function RefreshViewer(){
    if (viewerPortTabID == null) {
        chrome.tabs.query({url: chrome.runtime.getURL("viewer.html")}, function (tab) {
            if (tab.length > 0) {
                viewerPortTabID = tab[0].id;
                chrome.tabs.reload(viewerPortTabID, {bypassCache: true});
            }
        });
    } else {
        chrome.tabs.reload(viewerPortTabID, {bypassCache: true});
    }
}

function ExternalRequest(request, sender, sendResponse) {
    var now;
    if (options.log) {
        now = new Date();
        console.log(request.type);
    }

    if (request.type == undefined) {
        sendResponse({});
        return;
    }

    if (request.type == "deletefeed") {
        for (var i = 0; i < feeds.length; i++) {
            if (feeds[i].url == request.url) {
                feeds.splice(i, 1);
            }
        }
        resultPromise = store.setItem('feeds', feeds.filter(filterByID));
        resultPromise.then(function(){
            UpdateGroups();
            ReloadViewer();
        });
        sendResponse({});
        return;
    }
    if (request.type == "checkForUnread") {
        CheckForUnreadStart();
        sendResponse({});
        if (options.log) {
            console.log('|checkForUnread | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }
    if (request.type == "checkForUnreadOnSelectedFeed") {
        CheckForUnreadStart(request.selectedFeedKey);
        sendResponse({});
        if (options.log) {
            console.log('|checkForUnreadOnSelectedFeed | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

    if (request.type == "checkForUnreadOnSelectedFeedCompleted") {
        if ((feeds[request.selectedFeedKey].id != readLaterFeedID) && (feeds[request.selectedFeedKey].id != allFeedsID)) {
            if (feedInfo[feeds[request.selectedFeedKey].id] != undefined) {
                if (!feedInfo[feeds[request.selectedFeedKey].id].loading) {
                    if (viewerPort != null) {
                        viewerPort.postMessage({type: "feedupdatecomplete", id: feeds[request.selectedFeedKey].id});
                    }
                }
            }
        }
        else {
            if (viewerPort != null) {
                viewerPort.postMessage({type: "feedupdatecomplete", id: feeds[request.selectedFeedKey].id});
            }
        }
        sendResponse({});
        if (options.log) {
            console.log('|checkForUnreadOnSelectedFeedCompleted | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

    if (request.type == "setUnreadInfo") {
        var groupToCalc = [];
        if (request.data != undefined) {
            var listUnread = GetObjectFromStr(request.data);
            var keys = Object.keys(listUnread);
            var updated = false;
            var k;
            var currentFeed = {group: "", id: 0};
            for (var i = 0; i < keys.length; i++) {
                k = listUnread[keys[i]].id;
                if (unreadInfo[k] != undefined) {
                    unreadInfo[k].readitems[listUnread[keys[i]].key] = new Date().getTime() + 5184000000;
                    if (unreadInfo[k].unreadtotal > 0) {
                        unreadInfo[k].unreadtotal--;
                    }
                    updated = true;
                    if (currentFeed.id != k) {
                        currentFeed = feeds.find(function (el) {
                            return (el.id == k);
                        });
                    }
                    if (currentFeed.group != "") {
                        for (var i = 0; i < groups.length; i++) {
                            if (groups[i].group == currentFeed.group) {
                                if (!groupToCalc.includes(i)) {
                                    groupToCalc.push(i);
                                }
                                break;
                            }
                        }
                    }
                }
            }
            if (updated) {
                store.setItem('unreadinfo', unreadInfo);
            }
        }
        sendResponse(JSON.stringify(unreadInfo));
        if (groupToCalc.length > 0) {
            for (var i = 0; i < groupToCalc.length; i++) {
                CalcGroupCountUnread(groupToCalc[i]);
            }
        }

        if (options.log) {
            console.log('|setUnreadInfo | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }

        return;
    }

    if (request.type == "unsetUnreadInfo") {
        var groupToCalc = [];
        if (request.data != undefined) {
            var listUnread = GetObjectFromStr(request.data);
            var keys = Object.keys(listUnread);
            var updated = false;
            var k;
            var currentFeed = {group: "", id: 0};
            for (var i = 0; i < keys.length; i++) {
                k = listUnread[keys[i]].id;
                delete unreadInfo[listUnread[keys[i]].id].readitems[listUnread[keys[i]].key];
                unreadInfo[listUnread[keys[i]].id].unreadtotal++;
                updated = true;
                if (currentFeed.id != k) {
                    currentFeed = feeds.find(function (el) {
                        return (el.id == k);
                    });
                }
                if (currentFeed.group != "") {
                    for (var i = 0; i < groups.length; i++) {
                        if (groups[i].group == currentFeed.group) {
                            if (!groupToCalc.includes(i)) {
                                groupToCalc.push(i);
                            }
                            break;
                        }
                    }
                }
            }
            if (updated) {
                store.setItem('unreadinfo', unreadInfo);
            }
        }
        sendResponse(JSON.stringify(unreadInfo));
        if (groupToCalc.length > 0) {
            for (var i = 0; i < groupToCalc.length; i++) {
                CalcGroupCountUnread(groupToCalc[i]);
            }
        }

        if (options.log) {
            console.log('|unsetUnreadInfo | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }

        return;
    }

    if (request.type == "getFeeds") {
        sendResponse(GetStrFromObject(feeds));
        if (options.log) {
            console.log('|getFeeds | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

    if (request.type == "getFeedInfo") {
        sendResponse(GetStrFromObject(feedInfo));
        if (options.log) {
            console.log('|getFeedInfo | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

    if (request.type == "getGroups") {
        sendResponse(GetStrFromObject(groups));
        if (options.log) {
            console.log('|getGroups | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

    if (request.type == "getGroupInfo") {
        sendResponse(GetStrFromObject(groupInfo));
        if (options.log) {
            console.log('|getGroupInfo | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

    if (request.type == "getFeedsAndGroupsInfo") {
        sendResponse(JSON.stringify({"feeds": GetStrFromObject(feeds), "feedInfo": GetStrFromObject(feedInfo), "groups": GetStrFromObject(groups), "groupInfo": GetStrFromObject(groupInfo), "unreadInfo": GetStrFromObject(unreadInfo)}));
        if (options.log) {
            console.log('|getFeedsAndGroupsInfo | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

    if (request.type == "getGroupCountUnread") {
        sendResponse(groups[request.data].unreadCount);
        if (options.log) {
            console.log('|getGroupCountUnread | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

    if (request.type == "getUnreadTotal") {
        sendResponse(unreadTotal);
        if (options.log) {
            console.log('|getUnreadTotal | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

    if (request.type == "getRefreshFeed") {
        sendResponse(GetStrFromObject({"refreshFeed": refreshFeed, "checkForUnreadCounter": checkForUnreadCounter, "checkingForUnread": checkingForUnread}));
        if (options.log) {
            console.log('|getRefreshFeed | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

    if (request.type == "refreshFeeds") {
        GetFeeds(function () {
            CheckForUnreadStart();
        });
        sendResponse({});
        if (options.log) {
            console.log('|refreshFeeds | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

    if (request.type == "refreshOptionsAndRefreshFeeds") {
        GetOptions().then(function() {
            if (readlaterInfo[readLaterFeedID] != undefined) {
                readlaterInfo[readLaterFeedID].title = GetMessageText("backReadLater");
                readlaterInfo[readLaterFeedID].description = GetMessageText("backItemsMarkedReadLater");
            }
            if (groupInfo[allFeedsID] != undefined) {
                groupInfo[allFeedsID].title = GetMessageText("backAllFeeds");
            }
            forceRefresh = true;
            RefreshViewer();
            GetFeeds(function () {
                CheckForUnreadStart();
            });
        });
        sendResponse({});
        if (options.log) {
            console.log('|refreshOptionsAndRefreshFeeds | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

    if (request.type == "importFeeds") {
        if (request.data != undefined) {
            feeds = GetObjectFromStr(request.data);
            store.setItem('feeds', feeds.filter(filterByID)).then(function() {
                GetFeeds(function () {
                    CheckForUnreadStart();
                });
            });
        }
        sendResponse({});
        if (options.log) {
            console.log('|importFeeds | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

    if (request.type == "getApiUrlToAdd") {
        sendResponse(GetStrFromObject(listApiUrlToAdd));
        //listApiUrlToAdd = [];
        if (options.log) {
            console.log('|getApiUrlToAdd | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

    if (request.type == "addFeed") {
        sendResponse();

        if (request.feedData != undefined) {
            var maxOrderFeed = 1;
            var itemOrder;

            for(feedKey in feeds) {
                itemOrder = parseInt(feeds[feedKey].order, 10);

                if(itemOrder > maxOrderFeed) {
                    maxOrderFeed = itemOrder;
                }
            }
            maxOrderFeed++;
            feeds.push(CreateNewFeed(request.feedData.title, request.feedData.url, request.feedData.group, request.feedData.maxItems, maxOrderFeed, request.feedData.excludeUnreadCount, null));
            store.setItem('feeds', feeds.filter(filterByID)).then(function() {
                GetFeeds(function () {
                    CheckForUnreadStart();
                });
            });
        }
        if (options.log) {
            console.log('|addFeed | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

}

function ApiRequest(request, sender, sendResponse) {
    if (spamProtect[sender.id] == undefined) {
        spamProtect[sender.id] = new Date();
    } else {

        if ((new Date()) - spamProtect[sender.id] < 1000) {
            sendResponse({status: "refused"});
            return;
        }
    }

    if (request.feedUrl != undefined) {
        var existingFeed = feeds.find(function (el) {
            return (el.url == request.feedUrl);
        });
        if (existingFeed != undefined) {
            sendResponse({status: "already exists"});
            return;
        }

        var feedurl = request.feedUrl;
        var feedTitle = request.feedTitle;
        var feedGroup = request.feedGroup;
        if (typeof feedurl != "string") {
            sendResponse({status: "bad request"});
            return;
        }
        if ((typeof feedTitle != "string") && (feedTitle != undefined)) {
            sendResponse({status: "bad request"});
            return;
        }
        if ((typeof feedGroup != "string") && (feedTitle != undefined)) {
            sendResponse({status: "bad request"});
            return;
        }

        sendResponse({status: "ok"});

        listApiUrlToAdd.push({Url: feedUrl, Title: feedTitle, Group: feedGroup});

        if (apiaddurlTabID != null) {
            apiaddurlTabID = null;
            chrome.tabs.query({url: chrome.runtime.getURL("apiaddurl.html")}, function (tab) {
                if (tab.length > 0) {
                    apiaddurlTabID = tab[0].id;
                    chrome.tabs.reload(apiaddurlTabID, {bypassCache: true});
                } else {
                    chrome.tabs.create({url: chrome.runtime.getURL("apiaddurl.html")}, function (tab) {
                        apiaddurlTabID = tab.id;
                    });
                }
            });
        } else {
            chrome.tabs.create({url: chrome.runtime.getURL("apiaddurl.html")}, function (tab) {
                apiaddurlTabID = tab.id;
            });
        }
        return;
    }
    sendResponse({status: "nothing"});
}

// gets the feed array for everyone to use
function GetFeeds(callBack) {
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

        feeds.unshift(GetReadLaterFeed());
        UpdateGroups();
        getFeedsCallBack();
    });
}

// as this project gets larger there will be upgrades to storage items this will help
function DoUpgrades() {
    var lastVersion = parseFloat(options.lastversion);
    var listPromise = [];
    var resultPromise = null;

    // update the last version to now
    if (options.lastversion != manifest.version) {
        options.lastversion = manifest.version;
        listPromise.push(store.setItem('options', options));
    }

    resultPromise = Promise.allSettled(listPromise);

    chrome.tabs.query({url: chrome.runtime.getURL("apiaddurl.html")}, function (tab) {
        if (tab.length > 0) {
            apiaddurlTabID = tab[0].id;
        } else {
            apiaddurlTabID = null;
        }
    });

    return resultPromise;
}

// starts the checking for unread (and now loading of data)
// if key is filled in, then only that feed will be refreshed
function CheckForUnreadStart(key) {
    if (checkingForUnread || feeds.length == 0) {
        return;
    }

    checkForUnreadCounter = (key == null) ? 0 : key;
    allFeedsUnreadCounter = (key == null) ? -2 : -1; //-2 empty before
    checkingForUnread = true;

    if (key == null) {
        if (checkForUnreadCounter < feeds.length) {
            while ((checkForUnreadCounter < feeds.length) && (feeds[checkForUnreadCounter].id == allFeedsID)) {
                checkForUnreadCounter++;
            }
        }
    }

    // keep timer going on "refresh"
    if (key == null) {
        chrome.alarms.get('CheckForUnread', function(alarm) {
            if (typeof alarm === 'undefined' || alarm.name !== 'CheckForUnread') {
                if ((options.checkinterval == 0) || (options.checkinterval == null)) {
                    options.checkinterval = 60;
                }
                if (options.checkinterval < 3) {
                    options.checkinterval = 3;
                }
                chrome.alarms.create('CheckForUnread', {periodInMinutes: Number(options.checkinterval)});
            }
        });

        if (viewerPort != null) {
            viewerPort.postMessage({type: "refreshallstarted"});
        }
    } else {
        refreshFeed = true;
    }

    CheckForUnread();
}

// goes through each feed and gets how many you haven't read since last time you were there
function CheckForUnread() {
    var feedID = feeds[checkForUnreadCounter].id;
    var now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    var promiseCheckForUnread = [];
    var status;

    // initialize unread object if not setup yet
    if (unreadInfo == undefined) {
        unreadInfo = { };
    }
    if (unreadInfo[feedID] == undefined) {
        unreadInfo[feedID] = {unreadtotal: 0, readitems: {}};
    }

    unreadInfo[feedID].unreadtotal = 0;

    if (feedID == readLaterFeedID) {
        checkForUnreadCounter++;
        if (checkForUnreadCounter < feeds.length) {
            if (feeds[checkForUnreadCounter].id === allFeedsID) {
                checkForUnreadCounter++;
            }
        }

        if (checkForUnreadCounter >= feeds.length || refreshFeed) {
            CheckForUnreadComplete();
        } else {
            UpdateLoadingProgress(checkForUnreadCounter, feeds.length);
            CheckForUnread();
        }
    }
    else {
        var oldFeedInfoItems = [];
        if (feedInfo[feedID] != undefined) {
            if (feedInfo[feedID].items != undefined) {
                for (var i = 0; i < feedInfo[feedID].items.length; i++) {
                    oldFeedInfoItems.push(feedInfo[feedID].items[i].itemID);
                }
            }
        }

        feedInfo[feedID] = {title: "", description: "", group: "", loading: true, items: [], error: "", errorContent: "", guid:"", image:""};

        try {
            if (options.log) {
                //>>Profiler
                console.log('|Feeds | ' + feeds[checkForUnreadCounter].url);
                //<<Profiler
            }
            fetch(feeds[checkForUnreadCounter].url.replace(/feed:\/\//i, "http://"), {
                method: 'GET',
                headers: {
                    'Content-Type': 'text/xml',
                    'Accept-Charset': 'utf-8'
                },
            }).then(function(response) {
                if (options.log) {
                    //>>Profiler
                    var dtfetch = new Date(new Date() - offsetMs);
                    console.log('|FETCH | ' + dtfetch.toLocaleString() + ' ' + dtfetch.getMilliseconds() + 'ms');
                    //<<Profiler
                }

                if (!response.ok) {
                    feedInfo[feedID].loading = false;
                    feedInfo[feedID].error = 'Looks like there was a problem. Status Code: ' + response.status;

                    checkForUnreadCounter++;
                    if (checkForUnreadCounter < feeds.length) {
                        if (feeds[checkForUnreadCounter].id === allFeedsID) {
                            checkForUnreadCounter++;
                        }
                    }
                    if (checkForUnreadCounter >= feeds.length || refreshFeed) {
                        CheckForUnreadComplete();
                    } else {
                        UpdateLoadingProgress(checkForUnreadCounter, feeds.length);
                        setTimeout(function() {
                            CheckForUnread();
                        }, 20);
                    }
                    return;
                }
                if (response.redirected) {
                    feeds[checkForUnreadCounter].urlredirected = response.url;
                } else {
                    feeds[checkForUnreadCounter].urlredirected = undefined;
                }
                status = response.status;
                response.arrayBuffer().then(function(data) {
                    if (options.log) {
                        //>>Profiler
                        var dt = new Date(new Date() - offsetMs);
                        console.log('|Time FETCH | ' + FormatDTWithMs(dt - dtfetch));
                        console.log('|Time | ' + dt.toLocaleString() + ' ' + dt.getMilliseconds() + 'ms');
                        //<<Profiler
                    }
                    var decoder = new TextDecoder("UTF-8");
                    var doc = decoder.decode(data);
                    var encodeName = doc.substring(0, 100);
                    if (encodeName.indexOf("encoding=") >= 0) {
                        encodeName = encodeName.substring(encodeName.indexOf("encoding=") + ("encoding=").length, encodeName.indexOf("?>"));
                        encodeName = encodeName.replaceAll('\"', '');
                        encodeName = encodeName.replaceAll('"', '');
                        encodeName = encodeName.replaceAll("'", "");
                        if (encodeName.indexOf(" ") >= 0) {
                            encodeName = encodeName.substring(0, encodeName.indexOf(" "));
                        }
                        if (encodeName.replaceAll('-', '').toUpperCase() != "UTF8"){
                            decoder = new TextDecoder(encodeName);
                            doc = decoder.decode(data);
                        }
                    }

                    if (status == 200) {
                        if (doc) {
                            var readItemCount = 0;
                            var item = null;
                            var entryID = null;
                            var entryIDs = {};
                            var entries = GetElementsByTagNameJS(doc, [], "entry", "item");
                            var feedPresent = false;
                            var rootNode = GetElementByTagNameJS(doc, null, "rss", "rdf:RDF");
                            if (rootNode == null) {
                                rootNode = GetElementByTagNameJS(doc, null, "feed");
                                if (rootNode != null) {
                                    feedPresent = true;
                                }
                            }

                            if ((entries.length == 0) && (rootNode == null)) {
                                feedInfo[feedID].loading = false;
                                feedInfo[feedID].error = GetMessageText("backErrorMessage");
                                feedInfo[feedID].errorContent = doc.replace(/</g, "&lt;").replace(/>/g, "&gt;");

                                checkForUnreadCounter++;
                                if (checkForUnreadCounter < feeds.length) {
                                    if (feeds[checkForUnreadCounter].id === allFeedsID) {
                                        checkForUnreadCounter++;
                                    }
                                }
                                if (checkForUnreadCounter >= feeds.length || refreshFeed) {
                                    CheckForUnreadComplete();
                                } else {
                                    UpdateLoadingProgress(checkForUnreadCounter, feeds.length);
                                    setTimeout(function() {
                                        CheckForUnread();
                                    }, 20);
                                }
                                return;
                            }

                            var author = null;
                            var authorTemp = null;
                            var name = null;
                            var thumbnail = null;
                            var thumbnailurl = null;
                            var thumbnailtype = null;
                            var thumbnailNode = null;
                            var dummyDate = null;
                            var keys = null

                            if (rootNode != null) {
                                rootNode = RemoveTag(rootNode, "entry", "item");
                                if (feedPresent) {
                                    feedInfo[feedID].title = SearchTag(rootNode, null, ["TITLE"], 0);
                                    feedInfo[feedID].description = SearchTag(rootNode, '', ["SUBTITLE", "DESCRIPTION"], 0);
                                    feedInfo[feedID].image = SearchTag(rootNode, null, ["IMAGE"], 0);
                                } else {
                                    var channel = SearchTag(rootNode, null, ["CHANNEL"], 0);

                                    if (channel != null) {
                                        feedInfo[feedID].title = SearchTag(channel, null, ["TITLE"], 0);
                                        feedInfo[feedID].description = SearchTag(channel, '', ["DESCRIPTION", "SUBTITLE"], 0);
                                        feedInfo[feedID].image = SearchTag(rootNode, null, ["IMAGE"], 0);
                                    }
                                }
                            }

                            for (var e = 0; e < entries.length; e++) {
                                item = {};
                                item.title = CleanText2(SearchTag(entries[e], GetMessageText("backNoTitle"), ["TITLE"], 0));
                                if (typeof item.title == 'string') {
                                    item.title = item.title.replaceAll("U+20AC", '€').replaceAll("&apos;", "'");
                                }
                                item.date = CleanText2(SearchTag(entries[e], null, ["PUBDATE", "UPDATED", "DC:DATE", "DATE", "PUBLISHED"], 0)); // not sure if date is even needed anymore
                                item.content = "";
                                item.idOrigin = feedID;
                                item.guid = SearchTag(entries[e], "", ["GUID"], 0);
                                if (item.guid == "")
                                {
                                    item.guid = SearchTag(entries[e], "", ["ID"], 0);
                                }
                                if (item.guid == "")
                                {
                                    item.guid = null;
                                }
                                if (item.guid != undefined) {
                                    if (typeof item.guid == "object") {
                                        if (item.guid[0] != undefined) {
                                            if (item.guid[0][0] != undefined) {
                                                if (item.guid[0][0]["#text"] != undefined) {
                                                    item.guid = item.guid[0][0]["#text"];
                                                }
                                            }
                                        }
                                        if (typeof item.guid != "string") {
                                            item.guid = undefined;
                                        }
                                    }
                                }
                                if (item.guid == undefined) {
                                    item.itemID = sha256(item.title + item.date);
                                }
                                else {
                                    item.itemID = sha256(item.guid);
                                }
                                thumbnailurl = null;
                                thumbnailtype = null;

                                // don't bother storing extra stuff past max.. only title for Mark All Read
                                if (e <= feeds[checkForUnreadCounter].maxitems) {
                                    item.url = GetFeedLink(entries[e]);
                                    if (item.url == "") {
                                        item.url = GetFeedLink2(entries[e]);
                                    }

                                    if (options.showfeedcontent) {
                                        item.content = CleanText2(SearchTag(entries[e], null, ["CONTENT:ENCODED", "CONTENT", "DC:CONTENT", "ATOM:CONTENT"], 0)); // only guessing on just "content"
                                    }

                                    if ((item.content == "") || (item.content == null)) {
                                        item.content = CleanText2(SearchTag(entries[e], null, ["DESCRIPTION", "SUMMARY"], 0));
                                    }
                                    if (typeof item.content == 'string') {
                                        item.content = item.content.replaceAll("U+20AC", '€').replaceAll("&apos;", "'");
                                    }
                                    item.thumbnail = null;

                                    author = SearchTag(entries[e], null, ["AUTHOR", "DC:CREATOR", "CREATOR", "ATOM:CONTRIBUTOR"], 0);
                                    if (author != null) {
                                        authorTemp = CleanText2(author);
                                        if (typeof authorTemp != "string") {
                                            if (typeof author == "object") {
                                                author = SearchTag(author, null, ["NAME"], 0);
                                            }
                                        }
                                    }
                                    author = CleanText2(author);
                                    thumbnail = SearchTag(entries[e], null, ["ENCLOSURE", "MEDIA:GROUP"], 0);
                                    if (thumbnail != null) {
                                        keys = Object.keys(thumbnail);
                                        for (var k = 0; k < thumbnail.length; k++) {
                                            if (thumbnail[k].length > 0) {
                                                if (thumbnail[k].constructor === Array) {
                                                    thumbnail = thumbnail[k];
                                                    break;
                                                }
                                            } else {
                                                if (thumbnail[k]['url'] != undefined) {
                                                    if (typeof thumbnail[k]['url'] == "string") {
                                                        thumbnail = thumbnail;
                                                        break;
                                                    } else {
                                                        delete thumbnail[k];
                                                    }
                                                } else {
                                                    delete thumbnail[k];
                                                }
                                            }
                                        }

                                        keys = Object.keys(thumbnail);
                                        var thumbtemp = [];
                                        for (var k = 0; k < keys.length; k++) {
                                            thumbtemp[k] = thumbnail[keys[k]];
                                        }
                                        thumbnail = thumbtemp;

                                        for (var k = 0; k < thumbnail.length; k++) {
                                            keys = Object.keys(thumbnail[k]);
                                            var val = Object.values(thumbnail[k]);
                                            for (var j = 0; j < keys.length; j++) {
                                                if (keys[j].toUpperCase() == "MEDIA:CONTENT") {
                                                    for (var n1 = 0; n1 < val[j].length; n1++) {
                                                        var keys2 = Object.keys(val[j][n1]);
                                                        var val2 = Object.values(val[j][n1]);
                                                        for (var n2 = 0; n2 < keys2.length; n2++) {
                                                            if (keys2[n2].toUpperCase() == "MEDIA:DESCRIPTION") {
                                                                if (CleanText(val2[n2]).includes("thumbnail")) {
                                                                    if (thumbnail[k][":@"] != undefined) {
                                                                        thumbnailurl = thumbnail[k][":@"]["url"];
                                                                        thumbnailtype = thumbnail[k][":@"]["medium"];
                                                                        if (thumbnailtype == "image") {
                                                                            item.thumbnail = "<img src=\"" + thumbnailurl + "\">";
                                                                            break;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        if (thumbnailurl != null) {
                                                            break;
                                                        }
                                                    }
                                                    if (thumbnailurl == null) {
                                                        if (thumbnail[k][":@"] != undefined) {
                                                            if (thumbnail[k][":@"]["url"] != undefined) {
                                                                if (item.content == null) {
                                                                    if (thumbnail[k][":@"]["url"].includes("youtube")) {
                                                                        if (!thumbnail[k][":@"]["url"].includes("youtube-nocookie")) {
                                                                        thumbnail[k][":@"]["url"] = thumbnail[k][":@"]["url"].replaceAll('youtube', 'youtube-nocookie');
                                                                        }
                                                                        if (thumbnail[k][":@"]["url"].includes("/v/")) {
                                                                            thumbnail[k][":@"]["url"] = thumbnail[k][":@"]["url"].replaceAll('/v/', '/embed/');
                                                                        }
                                                                    }
                                                                    if (item.content != null) {
                                                                        item.content = item.content + '<iframe src="' + thumbnail[k][":@"]["url"] + '" title="Video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
                                                                    } else {
                                                                        item.content = '<iframe src="' + thumbnail[k][":@"]["url"] + '" title="Video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
                                                                    }
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    }
                                                } else {
                                                    if (keys[j].toUpperCase() == "URL") {
                                                        item.thumbnail = "<img src=\"" + val[j] + "\">";
                                                    }
                                                    if (keys[j].toUpperCase() == "MEDIA:DESCRIPTION") {
                                                        if (item.content != null) {
                                                            item.content = item.content + '<BR/>' + CleanText(thumbnail[k][keys[j]]);
                                                        } else {
                                                            item.content = CleanText(thumbnail[k][keys[j]]);
                                                        }
                                                    }
                                                    if (keys[j].toUpperCase() == "MEDIA:THUMBNAIL") {
                                                        if (thumbnail[k][":@"] != undefined) {
                                                            if (thumbnail[k][":@"]["url"] != undefined) {
                                                                thumbnailurl = thumbnail[k][":@"]["url"];
                                                                item.thumbnail = "<img src=\"" + thumbnailurl + "\">";
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                                if (thumbnailurl != null) {
                                                    break;
                                                }
                                            }
                                        }
                                    } else {
                                        thumbnail = SearchTag(entries[e], null, ["MEDIA:CONTENT"], 0);
                                        if (thumbnail != null) {
                                            for (var n1 = 0; n1 < thumbnail.length; n1++) {
                                                if (thumbnail[n1][0] != undefined) {
                                                    var keys2 = Object.keys(thumbnail[n1][0]);
                                                    var val2 = Object.values(thumbnail[n1][0]);
                                                    for (var n2 = 0; n2 < keys2.length; n2++) {
                                                        if (keys2[n2].toUpperCase() == "MEDIA:THUMBNAIL") {
                                                            if (thumbnail[n1][0][":@"] != undefined) {
                                                                if (thumbnail[n1][0][":@"]["url"] != undefined) {
                                                                    if (thumbnail[n1][0][":@"] != undefined) {
                                                                        thumbnailurl = thumbnail[n1][0][":@"]["url"];
                                                                        item.thumbnail = "<img src=\"" + thumbnailurl + "\">";
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                if (thumbnailurl != null) {
                                                    break;
                                                }
                                            }
                                            if (thumbnailurl == null) {
                                                for (var n1 = 0; n1 < thumbnail.length; n1++) {
                                                    if ((thumbnail[n1]["url"] != undefined) && (thumbnail[n1]["medium"] != undefined)) {
                                                        if (thumbnail[n1]["medium"] == "image") {
                                                            thumbnailurl = thumbnail[n1]["url"];
                                                            item.thumbnail = "<img src=\"" + thumbnailurl + "\">";
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        thumbnail = SearchTag(entries[e], null, ["MEDIA:THUMBNAIL"], 0);
                                        if (thumbnail != null) {
                                            if (thumbnail[1] != null) {
                                                if (thumbnail[1]["url"] != null) {
                                                    item.thumbnail = "<img src=\"" + thumbnail[1]["url"] + "\">";
                                                }
                                            }
                                        }
                                    }

                                    if (author != null) {
                                        item.author = author;
                                    } else {   // for some reason the author gets funky with floats if it's empty..  so whatever
                                        item.author = '\u00a0';
                                    }
                                }
                                dummyDate = GetDate(item.date);
                                if(dummyDate != null) {
                                    item.order = dummyDate.getTime() - referenceDate;
                                }
                                else {
                                    item.order = referenceDate;
                                }

                                feedInfo[feedID].items.push(item);
                                entryIDs[item.itemID] = 1;
                            }

                            // count read that are in current feed
                            if ((unreadInfo[feedID] == undefined) || (unreadInfo[feedID] == null)) {
                                unreadInfo[feedID] = {unreadtotal: 0, readitems: {}};
                            } else {
                                for (var key in unreadInfo[feedID].readitems) {
                                    if (entryIDs[key] == null) {
                                        // if the read item isn't in the current feed and it's past it's expiration date, nuke it
                                        if (now > new Date(unreadInfo[feedID].readitems[key])) {
                                            delete unreadInfo[feedID].readitems[key];
                                        }
                                    } else {
                                        readItemCount++;
                                    }
                                }
                            }
                            unreadInfo[feedID].unreadtotal = entries.length - readItemCount;
                        } else {
                            feedInfo[feedID].error = GetMessageText("backErrorXML");
                        }
                    } else {
                        feedInfo[feedID].error = GetMessageText("backError200Part1") + status + GetMessageText("backError200Part2") + response.statusText + GetMessageText("backError200Part3");
                    }
                    promiseCheckForUnread.push(store.setItem('unreadinfo', unreadInfo));

                    for (var i = 0; i < feedInfo[feedID].items.length; i++) {
                        if (!oldFeedInfoItems.includes(feedInfo[feedID].items[i].itemID)) {
                            newNotif = true;
                            break;
                        }
                    }

                    checkForUnreadCounter++;
                    if (checkForUnreadCounter < feeds.length) {
                        if (feeds[checkForUnreadCounter].id === allFeedsID) {
                            checkForUnreadCounter++;
                        }
                    }

                    doc = null;

                    feedInfo[feedID].loading = false;

                    if (options.log) {
                        //>>Profiler
                        var dt2 = new Date(new Date() - offsetMs);
                        console.log('|Time end | ', dt2.toLocaleString() + ' ' + dt2.getMilliseconds() + 'ms');
                        console.log('|Interval | ', FormatDTWithMs(dt2 - dt));
                        //<<Profiler
                    }

                    waitPromise(promiseCheckForUnread).then(function () {
                        if (viewerPort != null) {
                            viewerPort.postMessage({type: "feedupdatecomplete", id: feedID});
                        }

                        if (checkForUnreadCounter >= feeds.length || refreshFeed) {
                            CheckForUnreadComplete();
                        } else {
                            UpdateLoadingProgress(checkForUnreadCounter, feeds.length);
                            setTimeout(function() {
                                CheckForUnread();
                            }, 20);
                        }
                    });
                });
            })
            .catch(function(err) {
                feedInfo[feedID].loading = false;
                feedInfo[feedID].error = 'Fetch Error :';
                feedInfo[feedID].errorContent = `${err.message}`;

                checkForUnreadCounter++;
                if (checkForUnreadCounter < feeds.length) {
                    if (feeds[checkForUnreadCounter].id === allFeedsID) {
                        checkForUnreadCounter++;
                    }
                }
                if (checkForUnreadCounter >= feeds.length || refreshFeed) {
                    CheckForUnreadComplete();
                } else {
                    UpdateLoadingProgress(checkForUnreadCounter, feeds.length);
                    setTimeout(function() {
                        CheckForUnread();
                    }, 20);
                }
            });
        }
        catch (err) {
            feedInfo[feedID].loading = false;
            feedInfo[feedID].error = 'Error :';
            feedInfo[feedID].errorContent = `${err}`;

            checkForUnreadCounter++;
            if (checkForUnreadCounter < feeds.length) {
                if (feeds[checkForUnreadCounter].id === allFeedsID) {
                    checkForUnreadCounter++;
                }
            }
            if (checkForUnreadCounter >= feeds.length || refreshFeed) {
                CheckForUnreadComplete();
            } else {
                UpdateLoadingProgress(checkForUnreadCounter, feeds.length);
                setTimeout(function() {
                    CheckForUnread();
                }, 20);
            }
        }
    }
}

// ran after checking for unread is done
function CheckForUnreadComplete() {
    checkingForUnread = false;
    refreshFeed = false;

    for (var i = 0; i < feeds.length; i++) {
        if (feedInfo[feeds[i].id] != undefined)
        {
            SortByDate(feedInfo[feeds[i].id].items);
        }
    }

    UpdateGroups();
    for (var i = 0; i < groups.length; i++) {
        if (groups[i].id != allFeedsID) {
            CalcGroupCountUnread(i);
        }
    }

    UpdateUnreadBadge();

    if (forceRefresh) {
        forceRefresh = false;
        RefreshViewer();
    } else {
        if (viewerPort != null && !refreshFeed) {
            viewerPort.postMessage({type: "refreshallcomplete"});
        }
    }
}

// to help with master title & description getting
function GetNodeTextValue(node, defaultValue) {
    if (node == null || node.childNodes.length == 0) {
        return (defaultValue == null) ? "" : defaultValue;
    }

    var str = "";

    for (var i = 0; i < node.childNodes.length; i++) {
        if (node.childNodes[i].nodeValue != null) {
            str += node.childNodes[i].nodeValue;
        }
    }

    return str;
}

function GetFeedLink(node) {
    var links = SearchTags(node, "", ["LINK"], 0);
    var lien;
    var rel;

    for (var i = 0 ; i < links.length ; i++)
    {
        links[i][0] = CleanText(links[i][0]);
    }

    if (links.length == 0) {
        //<guid ispermalink="true(default)"></guid> is yet another way of saying link
        var guids = SearchTag(node, "", ["GUID"], 0);

        if (guids.length == 0) {
            return "";
        }
        guids[0] = CleanText(guids[0]);
        lien = guids[0];
        if ((guids.length > 1) && (lien.length > 0))
        {
            if ((guids[1]["isPermaLink"] == "false") && (lien.substring(0, 8) != "https://") && (lien.substring(0, 7) != "http://")) {
                return "";
            }
        }
        return lien;
    }

    for (var i = 0; i < links.length; i++) {
        // in atom feeds alternate is the default so if something else is there then skip
        lien = links[i];
        if (lien != null) {
            for (var j = 0; j < lien.length; j++) {
                if (lien[j] != null) {
                    var keys = Object.keys(lien[j]);
                    for (var k = 0; k < keys.length; k++) {
                        if (keys[k].toUpperCase() == "HREF") {
                            return lien[j][keys[k]];
                        }
                    }
                }
            }
            if (lien[0] != null) {
                if (lien[1] == undefined) {
                    return lien[0];
                }
                else {
                    if ((lien[1]["rel"] == "alternate") || (lien[1]["rel"] == undefined)) {
                        return lien[0];
                    }
                }
            }
        }
    }
    return ""; // has links, but I can't read them?!
}

function GetFeedLink2(node) {
    var links = SearchTags(node, "", ["LINK"], 0);
    var lien;
    var rel;

    for (var i = 0 ; i < links.length ; i++)
    {
        for (var j = 0 ; j < links[i].length ; j++)
        {
            if (typeof links[i][j] == "string") {
                links[i][j] = CleanText(links[i][j]);
            } else {
                rel = SearchTag(links[i][j], null, ["REL"], 0);
                if (rel == "alternate") {
                    lien = SearchTag(links[i][j], null, ["HREF"], 0);
                    if (typeof lien[0] == "string") {
                        return lien[0];
                    }
                }
            }
        }
    }
    return ""; // has links, but I can't read them?!
}

function GetAllFeedsGroup() {
    return CreateNewGroup(GetMessageText("backAllFeeds"), "", -8, allFeedsID, 0);
}

// helper function for creating new feeds
function CreateNewGroup(title, group, order, id, unreadCount) {
    // managed feed doesn't have an id yet
    if (id == null) {
        id = GetRandomID();
    }
    if (order == null) {
        if (groups.length == 0) {
            order = 1;
        } else {
            order = Math.max.apply(Math, groups.map(function(o) { return o.order; })) + 1;
        }
        if (order < 1) {
            order = 1;
        }
    }
    url = chrome.runtime.getURL("group.html");
    maxitems = 99999;

    return {title: title, url: url, group: group, maxitems: maxitems, order: order, id: id, unreadCount: unreadCount};
}

function UpdateGroups() {
    var oldgroups = groups;
    var oldgroupindex;
    groups = [];
    groupInfo = [];
    if (options.showallfeeds == true) {
        groups.push(GetAllFeedsGroup());
    }
    for (var i = 0; i < feeds.length; i++) {
        if ((feeds[i].id != readLaterFeedID) && (feeds[i].group != "")) {
            var filteredGroup = groups.find(function (el) {
                return el.group == feeds[i].group;
            });
            if (filteredGroup == null) {
                oldgroupindex = findWithAttr(oldgroups, 'group', feeds[i].group);
                if (oldgroupindex == -1) {
                    groups.push(CreateNewGroup(feeds[i].group, feeds[i].group, null, null, 0));
                } else {
                    groups.push(oldgroups[oldgroupindex]);
                }
            }
        }
    }
    for (var i = 0; i < groups.length; i++) {
        if (groups[i].id != allFeedsID) {
            GetGroupItems(i, groups[i].id, groups[i].title, groups[i].title);
        }
    }

    for (var i = 0; i < groups.length; i++) {
        groupInfo[groups[i].id].loading = false;
        SortByDate(groupInfo[groups[i].id].items);
    }
}

function GetGroupItems(groupIndex, id, title, description) {
    var info, item;
    var filteredFeeds = feeds.filter(function (el) {
        return (el.group == groups[groupIndex].group) && (el.id != readLaterFeedID);
    });
    if (filteredFeeds != null) {
        if (groupInfo[id] == null) {
            groupInfo[id] = {title: title, description: description, group: "", loading: true, items: [], error: ""};
        }
        if ((options.showallfeeds == true) && (id != allFeedsID)) {
            if (groupInfo[allFeedsID] == null) {
                groupInfo[allFeedsID] = {title: GetMessageText("backAllFeeds"), description: GetMessageText("backAllFeeds"), group: "", loading: true, items: [], error: ""};
            }
        }
        for (var i = 0; i < filteredFeeds.length; i++) {
            if (feedInfo[filteredFeeds[i].id] != null) {
                info = feedInfo[filteredFeeds[i].id].items;
                for (var j = 0; j < info.length; j++) {
                    item = GetNewItem(info[j].title, info[j].date, info[j].order, info[j].content, info[j].idOrigin, info[j].itemID, info[j].url, info[j].author, info[j].thumbnail);
                    groupInfo[id].items.push(item);
                    if ((options.showallfeeds == true) && (id != allFeedsID)) {
                        groupInfo[allFeedsID].items.push(item);
                    }
                }
            }
        }
    }
}

function GetNewItem(title, date, order, content, idOrigin, itemID, url, author, thumbnail) {
    return {title: title, date: date, order: order, content: content, idOrigin: idOrigin, itemID: itemID, url: url, author: author, thumbnail: thumbnail};
}

function CalcGroupCountUnread(key) {
    var filteredFeeds = GetFeedsFilterByGroup(key);
    var count = 0;
    for (var i = 0; i < filteredFeeds.length; i++) {
        if (unreadInfo[filteredFeeds[i].id] != null) {
            count += unreadInfo[filteredFeeds[i].id].unreadtotal;
        }
    }
    groups[key].unreadCount = count;
    return count;
}

function UpdateLoadingProgress(currentFeeds, currentFeedsCount) {
    if (viewerPort != null) {
        viewerPort.postMessage({type: "progressLoading", currentFeeds: currentFeeds, currentFeedsCount: currentFeedsCount});
    }
}
