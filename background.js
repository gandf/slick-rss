const referenceDate = GetDate("Thu, 31 Dec 2019 23:59:59 +0000").getTime();
const charToDel = ['/','\\', ' '];
var checkingForUnread;
var checkForUnreadCounter;
var allFeedsUnreadCounter;
var checkForUnreadFeeds;
var refreshFeed;
var apiaddurlPort;
var apiaddurlTabID;
var forceRefresh;
var spamProtect;
var listApiUrlToAdd;
var eventRegistered;
var dtCache;

var datainitialized;
if (datainitialized !== true) {
    checkingForUnread = false;
    checkForUnreadCounter = 0;
    allFeedsUnreadCounter = -1;
    checkForUnreadFeeds = [];
    refreshFeed = false;
    apiaddurlPort = null;
    apiaddurlTabID = null;
    forceRefresh = false;
    spamProtect = [];
    listApiUrlToAdd = [];
    senderSql = GetSenderSql();

    datainitialized = true;
    dtCache = null;
}

if (eventRegistered == undefined) {
    chrome.action.onClicked.addListener(ButtonClicked);
    chrome.runtime.onMessage.addListener(OnMessageRequest);
    chrome.runtime.onConnect.addListener(InternalConnection);
    chrome.alarms.onAlarm.addListener(AlarmRing);
    chrome.runtime.onMessageExternal.addListener(ApiRequest);
    eventRegistered = true;
}

waitOptionReady().then(function () {
    DoUpgrades().then(function() {
        GetCategoriesRegistered().then(function () {
            GetUnreadCounts().then(function () {
                GetFeeds(function () {
                    CleanUpUnreadOrphans().then(function () {
                        GetCache().then(function () {
                            if ((options.checkinterval == 0) || (options.checkinterval == null)) {
                                options.checkinterval = 60;
                            }
                            if (options.checkinterval < 1) {
                                options.checkinterval = 1;
                            }
                            let currentDate = new Date();
                            let CheckDT = new Date(currentDate.getTime() - options.checkinterval * 60000);
                            if (dtCache <= CheckDT) {
                                chrome.alarms.get('CheckForUnread', function (alarm) {
                                    if (typeof alarm === 'undefined' || alarm.name !== 'CheckForUnread') {
                                        CheckForUnreadStart();
                                    }
                                });
                            } else {
                                chrome.alarms.get('CheckForUnread', function (alarm) {
                                    if (typeof alarm === 'undefined' || alarm.name !== 'CheckForUnread') {
                                        chrome.alarms.create('CheckForUnread', {delayInMinutes: Number(Number(dtCache - CheckDT) / 60000), periodInMinutes: Number(options.checkinterval)});
                                    }
                                });
                            }
                        });
                    });
                });
            });
        });
    });
});

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
        chrome.tabs.query({url: chrome.runtime.getURL("viewer.html")}, function(tabs) {
            if (tabs.length > 0) {
                viewerPort = chrome.tabs.connect(tabs[0].id);
                chrome.tabs.update(tabs[0].id, {active: true});
            } else {
                chrome.tabs.create({url: chrome.runtime.getURL("viewer.html")});
            }
        });
    } else {
        chrome.tabs.query({url: chrome.runtime.getURL("viewer.html")}, function(tabs) {
            if (tabs.length > 0) {
                chrome.tabs.update(tabs[0].id, {active: true});
            }
        });
    }
}

function RefreshViewer() {
    chrome.tabs.query({url: chrome.runtime.getURL("viewer.html")}, function(tabs) {
        if (tabs.length > 0) {
            chrome.tabs.reload(tabs[0].id, {bypassCache: true});
        }
    });
}

function OnMessageRequest(request, sender, sendResponse) {
    let now;
    if (options.log) {
        now = new Date();
        console.log(request.type);
    }

    if (request.type == undefined) {
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
        if (request.IsFeed) {
            CheckForUnreadStart(request.FeedID);
        } else {
            let idgroup = groups.findIndex(function (el) {
                return (el.id == request.selectedFeedKey);
            });
            let listfeeds = feeds.find(function (el) {
                return (el.group == groups[idgroup].title);
            });
            listfeeds.forEach(function (feed) {
                CheckForUnreadStart(feed.id);
            });
        }
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
            let newfeed = CreateNewFeed(request.feedData.title, request.feedData.url, request.feedData.group, request.feedData.maxItems, maxOrderFeed, request.feedData.excludeUnreadCount, null);
            feeds.push(newfeed);
            sendtoSQL('addFeed', 'BackgroundAddFeed', true, newfeed, function () {
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
    let getFeedsCallBack = callBack;
    GetFeedsSimple(function () {
        feeds.unshift(GetReadLaterFeed());
        UpdateGroups();

        if (getFeedsCallBack != undefined) {
            getFeedsCallBack();
        }
    });
}

// as this project gets larger there will be upgrades to storage items this will help
async function DoUpgrades() {
    let listPromise = [];
    let resultPromise;

    // update the last version to now
    if ((options.lastversion != manifest.version) || (optionFrom == 'direct')) {
        
        options.lastversion = manifest.version;
        var feedsUpgrade = [];
        var readlaterInfoUpgrade = [];
        var lastSelectedFeedUpgrade = {};
        listPromise.push(store.getItem('categories').then(function (data) { //DoUpgrades;
            if (data != null) {
                listCategoriesRegistered = data;
            }
        }));
        listPromise.push(store.getItem('unreadinfo').then(function (data) { //DoUpgrades
            if (data != null) {
                unreadInfo = data;
            }
        }));
        
        listPromise.push(store.getItem('feeds').then(function (datafeeds) { //DoUpgrades
            if (datafeeds != null) {
                datafeeds.forEach(datafeed => {
                    if (datafeed.excludeUnreadCount == undefined) {
                        datafeed.excludeUnreadCount = 0;
                    }
                });
    
                feedsUpgrade = datafeeds.sort(function (a, b) {
                    return a.order - b.order;
                });
            }
        }));
        listPromise.push(store.getItem('readlaterinfo').then(function(data) { //DoUpgrades
            if (data != null) {
                if (data[readLaterFeedID].items.length > 0) {
                    readlaterInfoUpgrade = data;
                }
            }
        }));
        listPromise.push(store.getItem('lastSelectedFeed').then(function (data) { //DoUpgrades
            if (data != null) {
                lastSelectedFeedUpgrade = data;
            }
        }));

        resultPromise = Promise.allSettled(listPromise).then(function () {
            let requests = [];
            //categories
            requests.push({type: 'deleteColor', waitResponse: false });
            let keys = Object.keys(listCategoriesRegistered);
            for (let i = 0 ; i < keys.length ; i++) {
                let order = keys[i];
                if (isNaN(order)) {
                    order = parseInt(order, 10);
                }
                order++;
                requests.push({type: 'addColor', waitResponse: false, data: { id: GetRandomID(), name: listCategoriesRegistered[keys[i]].category, color: listCategoriesRegistered[keys[i]].color, fontColor: options.darkmode ? "#4D5460" : "#0000EE", order: order }});
            }
            //lastSelectedFeed
            requests.push({type: 'setLastSelectedFeed', waitResponse: false, data: lastSelectedFeedUpgrade});

            //feeds
            feedsUpgrade.forEach(function (feed) {
                requests.push({type: 'addFeed', waitResponse: false, data: feed});
            });

            //readlaterinfo
            keys = Object.keys(readlaterInfoUpgrade);
            for (let i = 0 ; i < keys.length ; i++) {
                readlaterInfoUpgrade[keys[i]].items.forEach(function (item) {
                    requests.push({type: 'setReadlaterinfoItem', waitResponse: false, data: item });
                });
            }

            //unreadinfo
            requests.push({type: 'clearUnreadinfo', tableName: 'Unreadinfo', waitResponse: false });
            keys = Object.keys(unreadInfo);
            for (let i = 0; i <  keys.length; i++) {
                requests.push({type: 'setUnreadinfo', waitResponse: false, data: { feed_id: keys[i], unreadtotal: unreadInfo[keys[i]].unreadtotal } });
                let items = unreadInfo[keys[i]].readitems;
                if (items != undefined) {
                    let keysitem = Object.keys(items);
                    for (let j = 0; j < keysitem.length; j++) {
                        requests.push({type: 'addUnreadinfoItem', waitResponse: false, data: { feed_id: keys[i], itemHash: keysitem[j], value: items[keysitem[j]] } });
                    }
                }               
            }

            //options & save all
            options.isOption = true;
            requests.push({type: 'saveAll', waitResponse: false, data: options });
            sendtoSQL('requests', 'DoUpgrades', false, { requests: requests });
        });
    } else {
        resultPromise = Promise.allSettled(listPromise);
    }
    return resultPromise;
}

// starts the checking for unread (and now loading of data)
// if key is filled in, then only that feed will be refreshed
function CheckForUnreadStart(key) {
    if (checkingForUnread || feeds.length == 0) {
        return;
    }
    
    itemToNotif = [];

    checkForUnreadCounter = (key == null) ? 0 : key;
    allFeedsUnreadCounter = (key == null) ? -2 : -1; //-2 empty before
    checkingForUnread = true;

    if (key == undefined) {
        sendtoSQL('clearCacheFeedInfo', 'CheckForUnreadStartClear', false);
        feedInfo = [];
        GetFeeds(function () {
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

            chrome.alarms.get('CheckForUnread', function (alarm) {
                if (typeof alarm === 'undefined' || alarm.name !== 'CheckForUnread') {
                    if ((options.checkinterval == 0) || (options.checkinterval == null)) {
                        options.checkinterval = 60;
                    }
                    if (options.checkinterval < 1) {
                        options.checkinterval = 1;
                    }
                }
                chrome.alarms.create('CheckForUnread', {delayInMinutes: Number(options.checkinterval), periodInMinutes: Number(options.checkinterval)});
                    
                if (viewerPort != null) {
                    viewerPort.postMessage({type: "refreshallstarted"});
                }

                sendtoSQL('setCache', 'CheckForUnreadStartSetCache', false, { time: new Date() });

                CheckForUnread(checkForUnreadCounter);
            });
        });
    }

    // keep timer going on "refresh"
    if (key != null) {
        refreshFeed = true;
        let checkForUnreadCounter = feeds.findIndex(function (el) {
            return (el.id == key);
        });
        if (checkForUnreadCounter !== -1) {
            CheckForUnread(checkForUnreadCounter);
        }
    }
}

// goes through each feed and gets how many you haven't read since last time you were there
function CheckForUnread(checkForUnreadCounterID) {
    if (feeds[checkForUnreadCounterID] == undefined) {
        CheckNextRead();
        return;
    }
    var feedID = feeds[checkForUnreadCounterID].id;
    var now = new Date();
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
            feed_id: feedID,
            title: "",
            description: "",
            group: "",
            loading: true,
            items: [],
            error: "",
            errorContent: "",
            showErrorContent: false,
            guid: "",
            image: "",
            category: ""
        };
        updateFeedInfo(feedInfo[feedID], false);

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

                        updateFeedInfo(feedInfo[feedID], true);
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

                    let requests = [];
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
                            }
                            if (rootNode != null) {
                                feedPresent = true;
                            }

                            if ((entries.length == 0) && (rootNode == null)) {
                                feedInfo[feedID].loading = false;
                                feedInfo[feedID].error = GetMessageText("backErrorMessage");
                                feedInfo[feedID].errorContent = doc;
                                feedInfo[feedID].showErrorContent = true;

                                updateFeedInfo(feedInfo[feedID], true);
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
                            updateFeedInfo(feedInfo[feedID], true);

                            let nbItems = Math.min(entries.length, feeds[checkForUnreadCounterID].maxitems = 0 ? entries.length : feeds[checkForUnreadCounterID].maxitems);
                            for (let e = 0; e < nbItems; e++) {
                                useDateInID = true;
                                getDummyDate = true;
                                item = {};
                                item.title = CleanText2(SearchTag(entries[e], DefaultText2(GetMessageText("backNoTitle")), ["TITLE"], 0));
                                if (typeof item.title == 'string') {
                                    item.title = item.title.replaceAll("U+20AC", '€').replaceAll("&apos;", "'");
                                }
                                item.description = CleanText2(SearchTag(entries[e], DefaultText2(GetMessageText("backNoTitle")), ["DESCRIPTION"], 0));
                                if (typeof item.description == 'string') {
                                    item.description = item.description.replaceAll("U+20AC", '€').replaceAll("&apos;", "'");
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
                                if (!item.guid) {
                                    item.guid = SearchTag(entries[e], "", ["ID"], 0);
                                }
                                if (!item.guid) {
                                    item.guid = null;
                                }
                                if (item.guid) {
                                    if (typeof item.guid == "object") {
                                        if (item.guid[0] != undefined) {
                                            if (item.guid[0][0] != undefined) {
                                                if (item.guid[0][0]["#text"] != undefined) {
                                                    item.guid = item.guid[0][0]["#text"];
                                                }
                                            }
                                        }
                                        if (item.guid) {
                                            if (typeof item.guid != "string") {
                                                item.guid = String(item.guid);
                                            }
                                        } else {
                                            item.guid = undefined;
                                        }
                                    }
                                }
                                if (!item.guid) {
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
                                item.category = CleanArrayCategory(SearchTags(entries[e], null, ["CATEGORY"], 0));

                                if (item.category != undefined) {
                                    if (item.category.constructor === Array) {
                                        let newCatArray = [];
                                        for (let cat of item.category) {
                                            if (typeof cat == 'string') {
                                                if (cat != "") {
                                                    newCatArray.push(cleanCatStr(cat));
                                                }
                                            }
                                        }
                                        if (newCatArray.length > 0) {
                                            item.category = newCatArray;
                                        }
                                    } else {
                                        if (typeof item.category == 'string') {
                                            if (item.category != "") {
                                                item.category = cleanCatStr(item.category);
                                            }
                                        }
                                    }
                                }

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
                                                                    let iframeTag = '<iframe src="' + thumbnail[k][":@"]["url"] + '" title="Video player" frameborder="0" style="border: 0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen sandbox="allow-forms allow-orientation-lock allow-same-origin allow-scripts "></iframe>';
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
                                updateFeedInfoItem(item);
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
                                            requests.push({type: 'deleteUnreadinfoItem', waitResponse: false, data: { feed_id: feedID, itemHash: key } });
                                        }
                                    } else {
                                        readItemCount++;
                                    }
                                }
                            }
                            unreadInfo[feedID].unreadtotal = entries.length - readItemCount;
                            requests.push({type: 'setUnreadinfo', waitResponse: false, data: { feed_id: feedID, unreadtotal: unreadInfo[feedID].unreadtotal } });
                            requests.push({type: 'export', responsetype: 'responseExport', tableName: 'Unreadinfo', waitResponse: true, subtype: 'Unreadinfo' });
                        } else {
                            feedInfo[feedID].error = GetMessageText("backErrorXML");
                            updateFeedInfo(feedInfo[feedID], true);
                        }
                    } else {
                        feedInfo[feedID].error = GetMessageText("backError200Part1") + status + GetMessageText("backError200Part2") + response.statusText + GetMessageText("backError200Part3");
                        updateFeedInfo(feedInfo[feedID], true);
                    }

                    let resolveCheckForUnreadUnreadInfo;
                    let waitCheckForUnreadUnreadInfo = new Promise((resolve) => {
                        resolveCheckForUnreadUnreadInfo = resolve;
                    });
                    
                    promiseCheckForUnread.push(waitCheckForUnreadUnreadInfo);
                    sendtoSQL('requests', 'CheckForUnreadUnreadInfo', true, { requests: requests }, function(){
                        resolveCheckForUnreadUnreadInfo();
                    });

                    let tmpItems = feedInfo[feedID].items;
                    if (itemToNotif.length < 4) {
                        for (let i = 0; i < tmpItems.length; i++) {
                            if (!oldFeedInfoItems.includes(tmpItems[i].itemID)) {
                                if (!ItemIsRead(feedID, tmpItems[i].itemID)) {
                                    newNotif = true;
                                    itemToNotif.push(tmpItems[i]);
                                    if (itemToNotif.length == 4) {
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    feedInfo[feedID].loading = false;
                    updateFeedInfoLoading(feedID, false);

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
                    updateFeedInfo(feedInfo[feedID], true);
                    CheckReadFinish(checkForUnreadCounterID);
                });
        } catch (err) {
            feedInfo[feedID].loading = false;
            feedInfo[feedID].error = 'Error :';
            feedInfo[feedID].errorContent = `${err}`;
            updateFeedInfo(feedInfo[feedID], true);
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
    updateFeedInfoLoading(undefined, false);

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

    let requests = [];
    requests.push({type: 'export', responsetype: 'responseExport', tableName: 'UnreadinfoItem', waitResponse: true, subtype: 'UnreadinfoItem' });
    requests.push({type: 'export', responsetype: 'responseExport', tableName: 'Unreadinfo', waitResponse: true, subtype: 'Unreadinfo' });
    requests.push({type: 'export', responsetype: 'responseExport', tableName: 'CacheFeedInfo', waitResponse: true, subtype: 'CacheFeedInfo' });
    requests.push({type: 'export', responsetype: 'responseExport', tableName: 'CacheFeedInfoItem', waitResponse: true, subtype: 'CacheFeedInfoItem' });
    requests.push({type: 'export', responsetype: 'responseExport', tableName: 'Cache', waitResponse: true, subtype: 'Cache' });
    sendtoSQL('requests', 'SetUnreadInfo', true, { requests: requests });

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

function UpdateGroups() {
    let oldgroups = groups;
    let oldgroupindex;
    groups = [];
    groupInfo = [];
    if (options.showallfeeds == true) {
        groups.push(GetAllFeedsGroup());

        groupInfo[allFeedsID] = {
            title: GetMessageText("backAllFeeds"),
            description: GetMessageText("backAllFeeds"),
            group: "",
            loading: true,
            items: [],
            error: "",
            category: ""
        };

        //***
        let keys = Object.keys(feedInfo);
        let info;
        for (let i = 0; i < keys.length; i++) {
            if (feedInfo[keys[i]] != null) {
                info = feedInfo[keys[i]].items;
                for (let j = 0; j < info.length; j++) {
                    item = GetNewItem(info[j].title, info[j].date, info[j].order, info[j].content, info[j].idOrigin, info[j].itemID, info[j].url, info[j].author, info[j].thumbnail, info[j].summary, info[j].updated, info[j].category);
                    groupInfo[allFeedsID].items.push(item);
                }
            }
        }
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
            groupInfo[id] = {title: title, description: description, group: "", loading: true, items: [], error: "", category: ""};
        }
        for (let i = 0; i < filteredFeeds.length; i++) {
            if (feedInfo[filteredFeeds[i].id] != null) {
                info = feedInfo[filteredFeeds[i].id].items;
                for (let j = 0; j < info.length; j++) {
                    item = GetNewItem(info[j].title, info[j].date, info[j].order, info[j].content, info[j].idOrigin, info[j].itemID, info[j].url, info[j].author, info[j].thumbnail, info[j].summary, info[j].updated, info[j].category);
                    groupInfo[id].items.push(item);
                    if ((options.showallfeeds == true) && (id != allFeedsID)) {
                        groupInfo[allFeedsID].items.push(item);
                    }
                }
            }
        }
    }
}

function GetNewItem(title, date, order, content, idOrigin, itemID, url, author, thumbnail, summary, updated, category) {
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
        updated: updated,
        category: category
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

function GetCache() {
    let resolveGetCache;
    let waitGetCache = new Promise((resolve) => {
        resolveGetCache = resolve;
    });

    if (dtCache != null) {
        return new Promise(resolve => setTimeout(resolve, 5));
    }

    sendtoSQL('getCache', 'GetCache', true, null, 
        function (data) {
            if (data != null) {
                if (data.length > 0) {
                    dtCache = data;
                }
            }
            resolveGetCache();
        }
    );
    
    return waitGetCache;
}

function cleanCatStr(catTxt) {
    while (charToDel.includes(catTxt.charAt(0))) {
        catTxt = catTxt.slice(1);
    }
    while (charToDel.includes(catTxt.charAt(catTxt.length - 1))) {
        catTxt = catTxt.slice(0, -1);
    }
    return catTxt;
}

function updateFeedInfo(info, update) {
    if (!update) {
        sendtoSQL('addCacheFeedInfo', 'updateFeedInfo', false, info);
    } else {
        sendtoSQL('updateCacheFeedInfo', 'updateFeedInfo', false, info);
    }
}

function updateFeedInfoLoading(id, loading) {
    sendtoSQL('updateCacheFeedInfoLoading', 'updateFeedInfoLoading', false, { feed_id: id, loading: loading });
}

function updateFeedInfoItem(item) {
    sendtoSQL('addCacheFeedInfoItem', 'updateFeedInfoItem', false, item);
}