var promiseUpgrade = null;
var promiseGetUnreadCounts = null;
var checkingForUnread = false;
var checkForUnreadCounter = 0;
var allFeedsUnreadCounter = -1;
var checkForUnreadFeeds = [];
var getFeedsCallBack = null;
var refreshFeed = false;
var referenceDate = GetDate("Thu, 31 Dec 2019 23:59:59 +0000").getTime();
var viewerPortTabID = null;
var apiaddurlPort = null;
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
    DoUpgrades().then(function() {
        promiseGetUnreadCounts = GetUnreadCounts();
        waitGetUnreadCounts().then(function () {
            GetFeeds(function () {
                CleanUpUnreadOrphans().then(function () {
                    CheckForUnreadStart();
                });
            });
        });
    });
});

async function waitGetUnreadCounts() {
    return await Promise.allSettled([promiseGetUnreadCounts]);
}

async function waitPromise(listPromiseToWait) {
    return await Promise.allSettled([listPromiseToWait]);
}

function AlarmRing(alarm) {
    if (alarm.name == 'CheckForUnread') {
        try {
            CheckForUnreadStart();
        } catch (e) {
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
    if (port.name == "apiaddurlPort") {
        apiaddurlPort = port;
        port.onDisconnect.addListener(function (port) {
            apiaddurlPort = null;
            listApiUrlToAdd = [];
            apiaddurlTabID = null;
        });
    }
}

// tells viewer to reload, a feed changed
function ReloadViewer() {
    CleanUpUnreadOrphans().then(function () {
        if (viewerPort != null) {
            viewerPort.postMessage({type: "feedschanged"});
        }
    });
}

// manage viewer spawning or focus
function ButtonClicked(tab) {
    if (viewerPort == null) {
        chrome.tabs.create({url: chrome.runtime.getURL("viewer.html")}, function (tab) {
            if (tab != null) {
                viewerPortTabID = tab.id;
            }
        });
    } else {
        RefreshViewer();
    }
}

function RefreshViewer() {
    chrome.tabs.query({url: chrome.runtime.getURL("viewer.html")}, function (tabs) {
        if (tabs != null) {
            if (tabs.length > 0) {
                if (viewerPortTabID != null) {
                    for (let tab in tabs) {
                        if (tabs[tab].id == viewerPortTabID) {
                            chrome.tabs.reload(viewerPortTabID, {bypassCache: true});
                            return;
                        }
                    }
                }
                viewerPortTabID = tabs[0].id;
                chrome.tabs.reload(viewerPortTabID, {bypassCache: true});
            }
        }
    });
}

function ExternalRequest(request, sender, sendResponse) {
    let now;
    if (options.log) {
        now = new Date();
        console.log(request.type);
    }

    if (request.type == undefined) {
        sendResponse({});
        return;
    }

    if (request.type == "deletefeed") {
        for (let i = 0; i < feeds.length; i++) {
            if (feeds[i].url == request.url) {
                feeds.splice(i, 1);
            }
        }
        store.setItem('feeds', feeds.filter(filterByID)).then(function () {
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
        } else {
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

    if ((request.type == "setUnreadInfo") || (request.type == "unsetUnreadInfo")) {
        let groupToCalc = [];
        let updated = false;
        if (request.data != undefined) {
            let listUnread = GetObjectFromStr(request.data);
            let keys = Object.keys(listUnread);
            let k;
            let typeReq = (request.type == "setUnreadInfo");
            let currentFeed = {group: "", id: 0};
            for (let i = 0; i < keys.length; i++) {
                k = listUnread[keys[i]].id;
                if (typeReq) {
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
                            for (let j = 0; j < groups.length; j++) {
                                if (groups[j].group == currentFeed.group) {
                                    if (!groupToCalc.includes(j)) {
                                        groupToCalc.push(j);
                                    }
                                    break;
                                }
                            }
                        }
                    }
                } else {
                    if (unreadInfo[listUnread[keys[i]].id].readitems != undefined) {
                        delete unreadInfo[listUnread[keys[i]].id].readitems[listUnread[keys[i]].key];
                    }
                    unreadInfo[listUnread[keys[i]].id].unreadtotal++;
                    updated = true;
                    if (currentFeed.id != k) {
                        currentFeed = feeds.find(function (el) {
                            return (el.id == k);
                        });
                    }
                    if (currentFeed.group != "") {
                        for (let j = 0; j < groups.length; j++) {
                            if (groups[j].group == currentFeed.group) {
                                if (!groupToCalc.includes(j)) {
                                    groupToCalc.push(j);
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (updated) {
            store.setItem('unreadinfo', unreadInfo).then(function(){
                if (groupToCalc.length > 0) {
                    for (let i = 0; i < groupToCalc.length; i++) {
                        CalcGroupCountUnread(groupToCalc[i]);
                    }
                }
                UpdateUnreadBadge();
                if (viewerPort != null) {
                    viewerPort.postMessage({type: "unreadInfo"});
                }
            });
        }

        sendResponse({"data": GetStrFromObject(unreadInfo)});

        if (options.log) {
            console.log('|' + request.type + ' | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
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
        sendResponse(JSON.stringify({
            "feeds": GetStrFromObject(feeds),
            "feedInfo": GetStrFromObject(feedInfo),
            "groups": GetStrFromObject(groups),
            "groupInfo": GetStrFromObject(groupInfo)
        }));
        if (options.log) {
            console.log('|getFeedsAndGroupsInfo | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        return;
    }

    if (request.type == "getGroupCountUnread") {
        let found = false;
        if (request.data != null) {
            if (groups[request.data] != undefined) {
                if (groups[request.data].unreadCount != undefined) {
                    sendResponse(groups[request.data].unreadCount);
                    found = true;
                }
            }
        }
        if (!found) {
            sendResponse(0);
        }
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
        GetOptions().then(function () {
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
            store.setItem('feeds', feeds.filter(filterByID)).then(function () {
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
        if (options.log) {
            console.log('|getApiUrlToAdd | ' + now.toLocaleString() + ' ' + now.getMilliseconds() + 'ms');
        }
        listApiUrlToAdd = [];
        return;
    }

    if (request.type == "addFeed") {
        sendResponse();

        if (request.feedData != undefined) {
            let maxOrderFeed = 1;
            let itemOrder;

            for (feedKey in feeds) {
                itemOrder = parseInt(feeds[feedKey].order, 10);

                if (itemOrder > maxOrderFeed) {
                    maxOrderFeed = itemOrder;
                }
            }
            maxOrderFeed++;
            feeds.push(CreateNewFeed(request.feedData.title, request.feedData.url, request.feedData.group, request.feedData.maxItems, maxOrderFeed, request.feedData.excludeUnreadCount, null));
            store.setItem('feeds', feeds.filter(filterByID)).then(function () {
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

    if (request.type == "cleanListApiUrlToAdd") {
        listApiUrlToAdd = [];
        sendResponse();
        return;
    }
}

function ApiRequest(request, sender, sendResponse) {
    if (request == undefined) {
        return;
    }

    if (request.recipient != "Slick RSS") {
        return;
    }

    if (spamProtect[sender.id] == undefined) {
        spamProtect[sender.id] = new Date();
    } else {

        if ((new Date()) - spamProtect[sender.id] < 1000) {
            sendResponse({status: "refused"});
            return;
        }
    }

    if (request.feedUrl != undefined) {
        sendResponse({status: addFeedFromApi(request.feedUrl, request.feedTitle, request.feedGroup)});
        openApiUrlPage();
        return;
    }

    if (request.feedList != undefined) {
        sendResponse({status: "ok:  Reading..."});
        let fdl = request.feedList;
        for (let i = 0; i < fdl.length; i++) {
            addFeedFromApi(fdl[i].url, fdl[i].tabTitle, fdl[i].feedGroup);
        }
        openApiUrlPage();
        return;
    }

    sendResponse({status: "nothing"});
}
function addFeedFromApi(feedUrl, feedTitle, feedGroup) {
    let existingFeed = feeds.find(function (el) {
        return (el.url == feedUrl);
    });

    if (!existingFeed) {
        existingFeed = listApiUrlToAdd.find(function (el) {
            return (el.Url == feedUrl);
        });
    }

    if (existingFeed != undefined) {
        return "already exists";
    }

    if (typeof feedUrl != "string") {
        return "bad request";
    }
    if ((typeof feedTitle != "string") && (feedTitle != undefined)) {
        return "bad request";
    }
    if ((typeof feedGroup != "string") && (feedTitle != undefined)) {
        return "bad request";
    }

    listApiUrlToAdd.push({Url: feedUrl, Title: feedTitle, Group: feedGroup});
    return "ok";
}

function openApiUrlPage() {
    if (apiaddurlPort != null) {
        apiaddurlPort.postMessage({type: "refresh"});
    } else {
        chrome.tabs.create({url: chrome.runtime.getURL("apiaddurl.html")}, function (tab) {
            apiaddurlTabID = tab.id;
        });
    }
}

// gets the feed array for everyone to use
function GetFeeds(callBack) {
    feeds = [];
    getFeedsCallBack = callBack;

    store.getItem('feeds').then(function (datafeeds) {
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
    let lastVersion = parseFloat(options.lastversion);
    let listPromise = [];

    // update the last version to now
    if (options.lastversion != manifest.version) {
        options.lastversion = manifest.version;
        listPromise.push(store.setItem('options', options));
    }

    let resultPromise = Promise.allSettled(listPromise);

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
        checkForUnreadFeeds = Array(feeds.length).fill(false);
        for (let i = 0; i < feeds.length; i++) {
            if ((feeds[i].id == readLaterFeedID) || (feeds[i].id == allFeedsID)) {
                checkForUnreadFeeds[i] = true;
            }
        }

        if (checkForUnreadCounter < feeds.length) {
            while ((checkForUnreadCounter < feeds.length) && (feeds[checkForUnreadCounter].id == allFeedsID)) {
                checkForUnreadCounter++;
            }
        }
    }

    // keep timer going on "refresh"
    if (key == null) {
        chrome.alarms.get('CheckForUnread', function (alarm) {
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

    CheckForUnread(checkForUnreadCounter);
}

// goes through each feed and gets how many you haven't read since last time you were there
function CheckForUnread(checkForUnreadCounterID) {
    if (feeds[checkForUnreadCounterID] == undefined) {
        CheckNextRead();
        return;
    }
    var feedID = feeds[checkForUnreadCounterID].id;
    var now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    var promiseCheckForUnread = [];
    var status;

    // initialize unread object if not setup yet
    if (unreadInfo == undefined) {
        unreadInfo = {};
    }
    if (unreadInfo[feedID] == undefined) {
        unreadInfo[feedID] = {unreadtotal: 0, readitems: {}};
    }

    unreadInfo[feedID].unreadtotal = 0;

    if (feedID == readLaterFeedID) {
        CheckNextRead();
    } else {
        let oldFeedInfoItems = [];
        if (feedInfo[feedID] != undefined) {
            if (feedInfo[feedID].items != undefined) {
                for (let i = 0; i < feedInfo[feedID].items.length; i++) {
                    oldFeedInfoItems.push(feedInfo[feedID].items[i].itemID);
                }
            }
        }

        feedInfo[feedID] = {
            title: "",
            description: "",
            group: "",
            loading: true,
            items: [],
            error: "",
            errorContent: "",
            showErrorContent: false,
            guid: "",
            image: ""
        };

        try {
            if (options.log) {
                //>>Profiler
                console.log('|Feeds | ' + feeds[checkForUnreadCounterID].url);
                //<<Profiler
            }
            fetch(feeds[checkForUnreadCounterID].url.replace(/feed:\/\//i, "http://"), {
                method: 'GET',
                headers: {
                    'Content-Type': 'text/xml',
                    'Accept-Charset': 'utf-8'
                },
            }).then(function (response) {
                let dtfetch;
                if (options.log) {
                    //>>Profiler
                    dtfetch = new Date();
                    console.log('| |FETCH | ' + dtfetch.toLocaleString() + ' ' + dtfetch.getMilliseconds() + 'ms');
                    console.log('|x|Time FETCH | ' + FormatDTWithMs(dtfetch.getTime() - now.getTime()));
                    //<<Profiler
                }

                if (!response.ok) {
                    response.arrayBuffer().then(function (data) {
                        feedInfo[feedID].loading = false;
                        feedInfo[feedID].error = 'Looks like there was a problem. Status Code: ' + response.status;
                        feedInfo[feedID].errorContent = DecodeText(data);
                        feedInfo[feedID].showErrorContent = true;
                        CheckReadFinish(checkForUnreadCounterID);
                    });
                    return;
                }
                if (response.redirected) {
                    feeds[checkForUnreadCounterID].urlredirected = response.url;
                } else {
                    feeds[checkForUnreadCounterID].urlredirected = undefined;
                }
                status = response.status;
                response.arrayBuffer().then(function (data) {
                    let dt;
                    if (options.log) {
                        //>>Profiler
                        dt = new Date();
                        console.log('|x|Response to buffer | ' + FormatDTWithMs(dt - dtfetch));
                        //<<Profiler
                    }

                    if ((status >= 200) && (status <= 299)) {
                        let doc = DecodeText(data);
                        if (doc) {
                            let readItemCount = 0;
                            var item = null;
                            var entryIDs = {};
                            var entries = GetElementByTagNameJS(doc, [], true, "entry", "item");
                            let feedPresent = false;
                            let rootNode = GetElementByTagNameJS(doc, null, false, "rss", "rdf:RDF");
                            if (rootNode == null) {
                                rootNode = GetElementByTagNameJS(doc, null, false, "feed");
                                if (rootNode != null) {
                                    feedPresent = true;
                                }
                            }

                            if ((entries.length == 0) && (rootNode == null)) {
                                feedInfo[feedID].loading = false;
                                feedInfo[feedID].error = GetMessageText("backErrorMessage");
                                feedInfo[feedID].errorContent = doc;
                                feedInfo[feedID].showErrorContent = true;
                                CheckReadFinish(checkForUnreadCounterID);
                                return;
                            }

                            let author = null;
                            let authorTemp = null;
                            let thumbnail = null;
                            let thumbnailurl = null;
                            let thumbnailtype = null;
                            let dummyDate = null;
                            var keys = null
                            let useDateInID = true;
                            let getDummyDate = true;
                            var previousToCheck = [];

                            if (rootNode != null) {
                                rootNode = RemoveTag(rootNode, "entry", "item");
                                if (feedPresent) {
                                    feedInfo[feedID].title = SearchTag(rootNode, null, ["TITLE"], 0);
                                    feedInfo[feedID].description = SearchTag(rootNode, '', ["SUBTITLE", "DESCRIPTION"], 0);
                                    feedInfo[feedID].image = SearchTag(rootNode, null, ["IMAGE"], 0);
                                    feedInfo[feedID].date = SearchTag(rootNode, null, ["PUBDATE", "UPDATED", "DC:DATE", "DATE", "PUBLISHED"], 0);
                                } else {
                                    let channel = SearchTag(rootNode, null, ["CHANNEL"], 0);

                                    if (channel != null) {
                                        feedInfo[feedID].title = SearchTag(channel, null, ["TITLE"], 0);
                                        feedInfo[feedID].description = SearchTag(channel, '', ["DESCRIPTION", "SUBTITLE"], 0);
                                        feedInfo[feedID].image = SearchTag(rootNode, null, ["IMAGE"], 0);
                                        feedInfo[feedID].date = SearchTag(rootNode, null, ["PUBDATE", "UPDATED", "DC:DATE", "DATE", "PUBLISHED"], 0);
                                    }
                                }
                                if (feedInfo[feedID].date != undefined) {
                                    if (typeof (feedInfo[feedID].date) != "string") {
                                        keys = Object.keys(feedInfo[feedID].date);
                                        for (let k = 0; k < keys.length; k++) {
                                            if (typeof (feedInfo[feedID].date[keys[k]]) == "string") {
                                                try {
                                                    feedInfo[feedID].date = new Date(feedInfo[feedID].date[keys[k]]);
                                                } catch {
                                                    feedInfo[feedID].date = feedInfo[feedID].date[keys[k]];
                                                }
                                                break;
                                            }
                                        }
                                    }
                                } else {
                                    feedInfo[feedID].date = Date.now();
                                }
                            }
                            
                            let nbItems = Math.min(entries.length, feeds[checkForUnreadCounterID].maxitems = 0 ? entries.length : feeds[checkForUnreadCounterID].maxitems);
                            for (let e = 0; e < nbItems; e++) {
                                useDateInID = true;
                                getDummyDate = true;
                                item = {};
                                item.title = CleanText2(SearchTag(entries[e], GetMessageText("backNoTitle"), ["TITLE"], 0));
                                if (typeof item.title == 'string') {
                                    item.title = item.title.replaceAll("U+20AC", '€').replaceAll("&apos;", "'");
                                }
                                item.date = CleanText2(SearchTag(entries[e], null, ["PUBDATE", "UPDATED", "DC:DATE", "DATE", "PUBLISHED"], 0));
                                if (item.date == undefined) {
                                    try {
                                        item.date = new Date(feedInfo[feedID].date - e);
                                        dummyDate = item.date;
                                        getDummyDate = false;
                                    } catch {
                                        item.date = undefined;
                                    }
                                    useDateInID = false;
                                }

                                item.content = "";
                                item.summary = "";
                                item.idOrigin = feedID;
                                item.updated = false;
                                item.guid = SearchTag(entries[e], "", ["GUID"], 0);
                                if (item.guid == "") {
                                    item.guid = SearchTag(entries[e], "", ["ID"], 0);
                                }
                                if (item.guid == "") {
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
                                    if (useDateInID) {
                                        item.itemID = sha256(item.title + item.date);
                                    } else {
                                        item.itemID = sha256(item.title);
                                    }
                                } else {
                                    item.itemID = sha256(item.guid);
                                }
                                thumbnailurl = null;
                                thumbnailtype = null;
                                //item.category = CleanText2(SearchTag(entries[e], null, ["CATEGORY"], 0));
                                item.category = CleanArrayCategory(SearchTags(entries[e], null, ["CATEGORY"], 0));
                                item.comments = CleanText2(SearchTag(entries[e], null, ["COMMENTS"], 0));

                                // don't bother storing extra stuff past max.. only title for Mark All Read
                                if (e <= feeds[checkForUnreadCounterID].maxitems) {
                                    item.url = GetFeedLink(entries[e]);
                                    if (item.url == "") {
                                        item.url = GetFeedLink2(entries[e]);
                                    }

                                    if (options.showfeedcontent) {
                                        item.content = CleanText2(SearchTag(entries[e], null, ["CONTENT:ENCODED", "CONTENT", "DC:CONTENT", "ATOM:CONTENT"], 0)); // only guessing on just "content"
                                        if (options.showfeedcontentsummary < 2) {
                                            item.summary = CleanText2(SearchTag(entries[e], null, ["DESCRIPTION", "SUMMARY"], 0));
                                            if (typeof item.summary == 'string') {
                                                item.summary = item.summary.replaceAll("U+20AC", '€').replaceAll("&apos;", "'");
                                            }
                                        }
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
                                        for (let k = 0; k < thumbnail.length; k++) {
                                            if (thumbnail[k].length > 0) {
                                                if (thumbnail[k].constructor === Array) {
                                                    thumbnail = thumbnail[k];
                                                    break;
                                                }
                                            } else {
                                                if (thumbnail[k]['url'] != undefined) {
                                                    if (typeof thumbnail[k]['url'] == "string") {
                                                        thumbnail = thumbnail[k]['url'];
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
                                        let thumbtemp = [];
                                        for (let k = 0; k < keys.length; k++) {
                                            thumbtemp[k] = thumbnail[keys[k]];
                                        }
                                        thumbnail = thumbtemp;

                                        for (let k = 0; k < thumbnail.length; k++) {
                                            keys = Object.keys(thumbnail[k]).sort();
                                            let soundFound = false;
                                            for (let j = 0; j < keys.length; j++) {
                                                let key = keys[j].toUpperCase();
                                                if (key == "MEDIA:CONTENT") {
                                                    for (let n1 = 0; n1 < thumbnail[k][keys[j]].length; n1++) {
                                                        let keys2 = Object.keys(thumbnail[k][keys[j]][n1]);
                                                        let val2 = Object.values(thumbnail[k][keys[j]][n1]);
                                                        for (let n2 = 0; n2 < keys2.length; n2++) {
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
                                                                    let iframeTag = '<iframe src="' + thumbnail[k][":@"]["url"] + '" title="Video player" frameborder="0" style="border: 0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen sandbox="allow-forms allow-orientation-lock allow-same-origin allow-scripts allow-storage-access-by-user-activation "></iframe>';
                                                                    if (item.content != null) {
                                                                        item.content = item.content + iframeTag;
                                                                    } else {
                                                                        item.content = iframeTag;
                                                                    }
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    }
                                                } else {
                                                    if (key == "TYPE") {
                                                        if (thumbnail[k][keys[j]].startsWith("audio/")) {
                                                            if (thumbnail[k]["url"] != undefined) {
                                                                soundFound = true;
                                                                let audioTag = '<audio controls><source src="' + thumbnail[k]["url"] + '" type="' + thumbnail[k][keys[j]] + '"></audio>';
                                                                if (item.content != null) {
                                                                    item.content = audioTag + item.content;
                                                                } else {
                                                                    item.content = audioTag;
                                                                }
                                                            }
                                                        }
                                                    }
                                                    if (!soundFound) {
                                                        if (key == "URL") {
                                                            item.thumbnail = "<img src=\"" + thumbnail[k][keys[j]] + "\">";
                                                        }
                                                        if (key == "MEDIA:DESCRIPTION") {
                                                            if (item.content != null) {
                                                                item.content = item.content + '<BR/>' + CleanText(thumbnail[k][keys[j]]);
                                                            } else {
                                                                item.content = CleanText(thumbnail[k][keys[j]]);
                                                            }
                                                        }
                                                        if (key == "MEDIA:THUMBNAIL") {
                                                            if (thumbnail[k][":@"] != undefined) {
                                                                if (thumbnail[k][":@"]["url"] != undefined) {
                                                                    thumbnailurl = thumbnail[k][":@"]["url"];
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
                                        }
                                    } else {
                                        thumbnail = SearchTag(entries[e], null, ["MEDIA:CONTENT"], 0);
                                        if (thumbnail != null) {
                                            for (let n1 = 0; n1 < thumbnail.length; n1++) {
                                                if (thumbnail[n1][0] != undefined) {
                                                    let keys2 = Object.keys(thumbnail[n1][0]);
                                                    for (let n2 = 0; n2 < keys2.length; n2++) {
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
                                                for (let n1 = 0; n1 < thumbnail.length; n1++) {
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

                                    if (!item.summary) {
                                        item.summary = item.content;
                                    }

                                    if (author != null) {
                                        item.author = author;
                                    } else {   // for some reason the author gets funky with floats if it's empty..  so whatever
                                        item.author = '\u00a0';
                                    }
                                }
                                if (getDummyDate) {
                                    dummyDate = GetDate(item.date);
                                }
                                if (dummyDate != null) {
                                    item.order = dummyDate.getTime() - referenceDate;
                                } else {
                                    item.order = referenceDate;
                                }

                                //check previous item unread
                                if ((unreadInfo[feedID] != undefined) || (unreadInfo[feedID] != null)) {
                                    if (unreadInfo[feedID].readitems[item.itemID]) {
                                        //Next to check
                                        previousToCheck.push(item.itemID);
                                    } else {
                                        for (let key in previousToCheck) {
                                            (function () {
                                                let keyp = key;
                                                let result = feedInfo[feedID].items.find(obj => {
                                                    return obj.itemID === previousToCheck[keyp]
                                                })
                                                if (result != undefined) {
                                                    result.updated = true;
                                                }
                                            })();
                                        }
                                        previousToCheck = [];
                                    }
                                }

                                feedInfo[feedID].items.push(item);
                                entryIDs[item.itemID] = 1;
                            }

                            // count read that are in current feed
                            if ((unreadInfo[feedID] == undefined) || (unreadInfo[feedID] == null)) {
                                unreadInfo[feedID] = {unreadtotal: 0, readitems: {}};
                            } else {
                                for (let key in unreadInfo[feedID].readitems) {
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

                    for (let i = 0; i < feedInfo[feedID].items.length; i++) {
                        if (!oldFeedInfoItems.includes(feedInfo[feedID].items[i].itemID)) {
                            newNotif = true;
                            break;
                        }
                    }

                    feedInfo[feedID].loading = false;

                    if (options.log) {
                        //>>Profiler
                        let dt2 = new Date();
                        console.log('|x|End | ', FormatDTWithMs(dt2 - dt));
                        //<<Profiler
                    }

                    waitPromise(promiseCheckForUnread).then(function () {
                        if (viewerPort != null) {
                            viewerPort.postMessage({type: "feedupdatecomplete", id: feedID});
                        }
                        CheckReadFinish(checkForUnreadCounterID);
                    });
                });
            })
                .catch(function (err) {
                    feedInfo[feedID].loading = false;
                    feedInfo[feedID].error = 'Fetch Error :';
                    feedInfo[feedID].errorContent = `${err.message}`;
                    CheckReadFinish(checkForUnreadCounterID);
                });
        } catch (err) {
            feedInfo[feedID].loading = false;
            feedInfo[feedID].error = 'Error :';
            feedInfo[feedID].errorContent = `${err}`;
            CheckReadFinish(checkForUnreadCounterID);
        }
        CheckNextRead();
    }
}

function CheckNextRead() {
    checkForUnreadCounter++;
    if (checkForUnreadCounter < feeds.length) {
        if (feeds[checkForUnreadCounter].id === allFeedsID) {
            checkForUnreadFeeds[checkForUnreadCounter] = true;
            checkForUnreadCounter++;
        }
    }
    if (checkForUnreadCounter < feeds.length && !refreshFeed) {
        setTimeout(function () {
            CheckForUnread(checkForUnreadCounter);
        }, 20);
    }
}

function CheckReadFinish(checkForUnreadCounterID) {
    checkForUnreadFeeds[checkForUnreadCounterID] = true;
    if (refreshFeed) {
        CheckForUnreadComplete();
    } else {
        if (checkForUnreadCounter >= feeds.length) {
            if (checkForUnreadFeeds.find(el => el == false) == undefined) {
                CheckForUnreadComplete();
            } else {
                UpdateLoadingProgress(checkForUnreadFeeds.filter(function (el) {
                    return el == true;
                }).length, feeds.length);
            }
        } else {
            UpdateLoadingProgress(checkForUnreadFeeds.filter(function (el) {
                return el == true;
            }).length, feeds.length);
        }
    }
}

// ran after checking for unread is done
function CheckForUnreadComplete() {
    checkingForUnread = false;
    refreshFeed = false;

    for (let i = 0; i < feeds.length; i++) {
        if (feedInfo[feeds[i].id] != undefined) {
            SortByDate(feedInfo[feeds[i].id].items);
        }
    }

    UpdateGroups();
    for (let i = 0; i < groups.length; i++) {
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

function GetFeedLink(node) {
    let links = SearchTags(node, "", ["LINK"], 0);
    let lien;

    for (let i = 0; i < links.length; i++) {
        links[i][0] = CleanText(links[i][0]);
    }

    if (links.length == 0) {
        //<guid ispermalink="true(default)"></guid> is yet another way of saying link
        let guids = SearchTag(node, "", ["GUID"], 0);

        if (guids.length == 0) {
            return "";
        }
        guids[0] = CleanText(guids[0]);
        lien = guids[0];
        if ((guids.length > 1) && (lien.length > 0)) {
            if ((guids[1]["isPermaLink"] == "false") && (lien.substring(0, 8) != "https://") && (lien.substring(0, 7) != "http://")) {
                return "";
            }
        }
        return lien;
    }

    for (let i = 0; i < links.length; i++) {
        // in atom feeds alternate is the default so if something else is there then skip
        lien = links[i];
        if (lien != null) {
            for (let j = 0; j < lien.length; j++) {
                if (lien[j] != null) {
                    let keys = Object.keys(lien[j]);
                    for (let k = 0; k < keys.length; k++) {
                        if (keys[k].toUpperCase() == "HREF") {
                            return lien[j][keys[k]];
                        }
                    }
                }
            }
            if (lien[0] != null) {
                if (lien[1] == undefined) {
                    return lien[0];
                } else {
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
    let links = SearchTags(node, "", ["LINK"], 0);
    let lien;
    let rel;

    for (let i = 0; i < links.length; i++) {
        for (let j = 0; j < links[i].length; j++) {
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
            order = Math.max.apply(Math, groups.map(function (o) {
                return o.order;
            })) + 1;
        }
        if (order < 1) {
            order = 1;
        }
    }

    return {title: title, url: chrome.runtime.getURL("group.html"), group: group, maxitems: 99999, order: order, id: id, unreadCount: unreadCount};
}

function UpdateGroups() {
    let oldgroups = groups;
    let oldgroupindex;
    groups = [];
    groupInfo = [];
    if (options.showallfeeds == true) {
        groups.push(GetAllFeedsGroup());
    }
    for (let i = 0; i < feeds.length; i++) {
        if ((feeds[i].id != readLaterFeedID) && (feeds[i].group != "")) {
            let filteredGroup = groups.find(function (el) {
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
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].id != allFeedsID) {
            GetGroupItems(i, groups[i].id, groups[i].title, groups[i].title);
        }
    }

    for (let i = 0; i < groups.length; i++) {
        if (groups[i].id != allFeedsID) {
            if (groupInfo[groups[i].id] != undefined) {
                groupInfo[groups[i].id].loading = false;
                SortByDate(groupInfo[groups[i].id].items);
            }
        }
    }
}

function GetGroupItems(groupIndex, id, title, description) {
    let info, item;
    let filteredFeeds = feeds.filter(function (el) {
        return (el.group == groups[groupIndex].group) && (el.id != readLaterFeedID);
    });
    if (filteredFeeds != null) {
        if (groupInfo[id] == null) {
            groupInfo[id] = {title: title, description: description, group: "", loading: true, items: [], error: ""};
        }
        if ((options.showallfeeds == true) && (id != allFeedsID)) {
            if (groupInfo[allFeedsID] == null) {
                groupInfo[allFeedsID] = {
                    title: GetMessageText("backAllFeeds"),
                    description: GetMessageText("backAllFeeds"),
                    group: "",
                    loading: true,
                    items: [],
                    error: ""
                };
            }
        }
        for (let i = 0; i < filteredFeeds.length; i++) {
            if (feedInfo[filteredFeeds[i].id] != null) {
                info = feedInfo[filteredFeeds[i].id].items;
                for (let j = 0; j < info.length; j++) {
                    item = GetNewItem(info[j].title, info[j].date, info[j].order, info[j].content, info[j].idOrigin, info[j].itemID, info[j].url, info[j].author, info[j].thumbnail, info[j].summary, info[j].updated);
                    groupInfo[id].items.push(item);
                    if ((options.showallfeeds == true) && (id != allFeedsID)) {
                        groupInfo[allFeedsID].items.push(item);
                    }
                }
            }
        }
    }
}

function GetNewItem(title, date, order, content, idOrigin, itemID, url, author, thumbnail, summary, updated) {
    return {
        title: title,
        date: date,
        order: order,
        content: content,
        idOrigin: idOrigin,
        itemID: itemID,
        url: url,
        author: author,
        thumbnail: thumbnail,
        summary: summary,
        updated: updated
    };
}

function CalcGroupCountUnread(key) {
    let filteredFeeds = GetFeedsFilterByGroup(key);
    let count = 0;
    for (let i = 0; i < filteredFeeds.length; i++) {
        if (unreadInfo[filteredFeeds[i].id] != null) {
            count += unreadInfo[filteredFeeds[i].id].unreadtotal;
        }
    }
    groups[key].unreadCount = count;
    return count;
}

function UpdateLoadingProgress(currentFeeds, currentFeedsCount) {
    if (viewerPort != null) {
        viewerPort.postMessage({
            type: "progressLoading",
            currentFeeds: currentFeeds,
            currentFeedsCount: currentFeedsCount
        });
    }
}

function DecodeText(data) {
    let decoder = new TextDecoder("UTF-8");
    let doc = decoder.decode(data);
    let encodeName = doc.substring(0, 400);
    let textEnc = "encoding=";
    let indexEnc = encodeName.indexOf(textEnc);

    if (indexEnc < 0) {
        textEnc = "charset=";
        indexEnc = encodeName.indexOf(textEnc);
        if (indexEnc < 0) {
            return doc;
        }
    }

    encodeName = encodeName.substring(indexEnc + (textEnc).length);
    encodeName = encodeName.substring(0, encodeName.indexOf(">"));
    encodeName = encodeName.replaceAll('?', '').replaceAll('\"', '').replaceAll('"', '').replaceAll("'", "");
    if (encodeName.indexOf(" ") >= 0) {
        encodeName = encodeName.substring(0, encodeName.indexOf(" "));
    }
    if (encodeName.replaceAll('-', '').toUpperCase() != "UTF8") {
        try {
            decoder = new TextDecoder(encodeName);
            doc = decoder.decode(data);
        } catch (_) {
            decoder = new TextDecoder("UTF-8");
            doc = decoder.decode(data);
        }
    }
    return doc;
}

function CleanArrayCategory(arrayCat) {
    if (arrayCat == undefined) {
        return [];
    }
    if (arrayCat.constructor === Array) {
        let categories = [];
        let value;
        let found = false;
        for (const cat of arrayCat) {
            try {
                value = cat[0][0][0]["#text"];
                if (typeof value === 'string' || value instanceof String) {
                    categories.push(value);
                    found = true;
                }
            } catch {
                for (const subcat of cat) {
                    if (typeof subcat === 'string' || subcat instanceof String) {
                        categories.push(subcat);
                        found = true;
                    } else {
                        if (subcat['term'] != undefined) {
                            if (typeof subcat['term'] === 'string' || subcat['term'] instanceof String) {
                                categories.push(subcat['term']);
                                found = true;
                            }
                        }
                    }
                }
            }
            if (!found) {
                try {
                    value = cat[0][0]["#text"];
                    if (typeof value === 'string' || value instanceof String) {
                        categories.push(value);
                        found = true;
                    }
                } catch {
                }
            }
        }
        if (!found) {
            return CleanText2(arrayCat);
        }
        return categories;
    } else {
        return CleanText2(arrayCat);
    }
}