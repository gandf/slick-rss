var manifest = chrome.runtime.getManifest();
var options = GetOptions();
var unreadInfo = GetUnreadCounts();
var unreadTotal = 0;
var feedInfo = [];
var feeds = [];
var snifferName = null;
var snifferVersion = null;
var snifferID = null;
var viewerPort = null;
var checkingForUnread = false;
var checkForUnreadTimerID = null;
var checkForUnreadCounter = 0;
var getFeedsCallBack = null;
var refreshFeed = false;
var readLaterFeedID = 9999999999;
var viewPortTabID = null;

chrome.browserAction.onClicked.addListener(ButtonClicked);
chrome.extension.onRequestExternal.addListener(ExternalRequest);
chrome.extension.onConnect.addListener(InternalConnection);
chrome.bookmarks.onChanged.addListener(BookmarkChanged);
chrome.bookmarks.onCreated.addListener(CheckFeedChange);
chrome.bookmarks.onMoved.addListener(CheckFeedChange);
chrome.bookmarks.onRemoved.addListener(CheckFeedChange);

DoUpgrades();
GetFeeds(function () {
    CleanUpUnreadOrphans();
    CheckForUnreadStart();
});

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
    CleanUpUnreadOrphans();

    if (viewerPort != null) {
        viewerPort.postMessage({type: "feedschanged"});
    }
}

// manage viewer spawning or focus
function ButtonClicked(tab) {
    if (viewerPort == null) {
        chrome.tabs.create({url: "viewer.html"}, function (tab) {
            viewerPortTabID = tab.id;
        });
    } else {
        chrome.tabs.update(viewerPortTabID, {selected: true});
    }
}

function ExternalRequest(request, sender, sendResponse) {
    if (request.type == "addfeed") {
        if (options.feedsource == 1) {
            chrome.bookmarks.create({parentId: options.feedfolderid, title: request.title, url: request.url}, null);
        } else {
            var maxOrder = 0;
            var order = 0;

            for (var i = 0; i < feeds.length; i++) {
                order = parseInt(feeds[i].order);

                if (order > maxOrder) {
                    maxOrder = order;
                }
            }

            maxOrder++;

            feeds.push(CreateNewFeed(request.title, request.url, options.maxitems, maxOrder));
            localStorage["feeds"] = JSON.stringify(feeds);
            UpdateSniffer();
            ReloadViewer();
        }

        sendResponse({});
    }

    if (request.type == "deletefeed") {
        for (var i = 0; i < feeds.length; i++) {
            if (feeds[i].url == request.url) {
                if (options.feedsource == 1) {
                    chrome.bookmarks.remove(feeds[i].id);
                } else {
                    feeds.splice(i, 1);
                    localStorage["feeds"] = JSON.stringify(feeds);
                    UpdateSniffer();
                    ReloadViewer();
                }
            }
        }

        sendResponse({});
    }

    if (request.type == "updateme") {
        sendResponse({confirmed: true, version: manifest.version, name: manifest.name});

        snifferID = sender.id;
        snifferName = request.name;
        snifferVersion = request.version;

        chrome.extension.sendRequest(snifferID, feeds);
    }
}

// gets all or some options, filling in defaults when needed
function GetOptions() {
    var options;
    var defaultOptions = GetDefaultOptions();

    if (localStorage["options"] == null) {
        options = GetDefaultOptions();
    } else {
        options = JSON.parse(localStorage["options"]);

        // fill in defaults for new options
        for (key in defaultOptions) {
            if (options[key] == undefined) {
                options[key] = defaultOptions[key];
            }
        }
    }

    return options;
}

// used to get defaults to help fill in missing pieces as I add more options
function GetDefaultOptions() {
    return {
        "lastversion": manifest.version,
        "feedsource": 0,
        "feedfolderid": "",
        "maxitems": 15,
        "showdescriptions": true,
        "dateformat": "[w], [mmmm] [ddd], [yyyy] [12h]:[nn] [a]",
        "showfeedimages": true,
        "showfeedobjects": true,
        "showfeediframes": false,
        "showfeedcontent": true,
        "checkinterval": 60,
        "markreadonclick": false,
        "markreadafter": 0,
        "readitemdisplay": 0,
        "unreaditemtotaldisplay": true,
        "unreadtotaldisplay": 3,
        "columns": 2,
        "readlaterenabled": true,
        "readlaterremovewhenviewed": true,
        "readlaterincludetotal": true,
        "loadlinksinbackground": false
    };
}

// gets the feed array for everyone to use
function GetFeeds(callBack) {
    feeds = [];
    getFeedsCallBack = callBack;

    if (options.feedsource == "0") {
        if (localStorage["feeds"] != null) {
            feeds = JSON.parse(localStorage["feeds"]).sort(function (a, b) {
                return a.order - b.order;
            });
            UpdateSniffer();
        }

        feeds.unshift(GetReadLaterFeed());
        getFeedsCallBack();
    } else {
        chrome.bookmarks.getChildren(options.feedfolderid, GetFeedFolderChildren);
    }
}

function GetReadLaterFeed() {
    return CreateNewFeed("Read Later", "about:blank", 99999, -9, readLaterFeedID);
}

// fills feeds with bookmark items, for now it's not recursive
function GetFeedFolderChildren(nodeChildren) {
    feeds = [];  // if via sniffer you remove a link and that link is in your bookmarks more than once, you get double the list because of multi-threading
    feeds.push(GetReadLaterFeed());

    for (var i = 0; i < nodeChildren.length; i++) {
        if (nodeChildren[i].url != "") {
            feeds.push(CreateNewFeed(nodeChildren[i].title, nodeChildren[i].url, options.maxitems, i, nodeChildren[i].id));
        }
    }

    UpdateSniffer();
    getFeedsCallBack();
}

function GetReadLaterItems() {
    if (localStorage["readlater"] == null) {
        localStorage["readlater"] = JSON.stringify({
            title: "Read Later",
            description: "Items you marked to read later",
            loading: false,
            items: [],
            error: ""
        });
    }

    return JSON.parse(localStorage["readlater"]);
}

// send new feeds to sniffer
function UpdateSniffer() {
    if (snifferID != null) {
        chrome.extension.sendRequest(snifferID, feeds, function (response) {
            snifferName = response.name;
            snifferVersion = response.version;
        });
    }
}

// if a bookmark changes and it's one of our feeds then refresh
function BookmarkChanged(id, changeInfo) {
    if (options.feedsource == 1) {
        chrome.bookmarks.get(id, function (node) {
            for (var i = 0; i < feeds.length; i++) {
                if (node[0].url == feeds[i].url) {
                    GetFeeds(ReloadViewer);
                    return;
                }
            }
        });
    }
}

// checks for a bookmark change and reloads viewer if needed
function CheckFeedChange(id, notUsed) {
    if (options.feedsource == 1) {
        var oldCount = feeds.length;
        GetFeeds(function () {
            if (oldCount != feeds.length) {
                ReloadViewer();
            }
        });
    }
}

// helper function for creating new feeds
function CreateNewFeed(title, url, maxitems, order, id) {
    // managed feed doesn't have an id yet
    if (id == null) {
        id = GetRandomID();
    }

    return {title: title, url: url, maxitems: maxitems, order: order, id: id};

}

// converts the text date into a formatted one if possible
function GetFormattedDate(txtDate) {
    var myDate = GetDate(txtDate);

    if (myDate == null) {
        return txtDate;
    }

    return FormatDate(myDate, options.dateformat);
}

// gets random numbers for managed feed ids
function GetRandomID() {
    var chars = "0123456789";
    var str = "";
    var rnum;

    for (var i = 0; i < 10; i++) {
        rnum = Math.floor(Math.random() * chars.length);
        str += chars.charAt(rnum);
    }

    return str;
}

// as this project gets larger there will be upgrades to storage items this will help
function DoUpgrades() {
    var lastVersion = parseFloat(options.lastversion);

    // since 2.0 requires ids for feeds, lets make sure they have them
    if (localStorage["feeds"] != null && lastVersion < 2.0) {
        var feeds = JSON.parse(localStorage["feeds"]).sort(function (a, b) {
            return a.order - b.order;
        });

        for (var key in feeds) {
            if (feeds[key].id == null) {
                feeds[key].id = GetRandomID();
            }
        }

        localStorage["feeds"] = JSON.stringify(feeds);
    }

    // 2.6 makes unread key MD5(title + date)
    if (lastVersion < 2.6) {
        alert("Sorry, I have to nuke your unread information for this upgrade.  Trust me, it's for the best.");
        delete localStorage["unreadinfo"];
        unreadInfo = GetUnreadCounts();
    }

    if (lastVersion == 2.97) {
        var result = confirm("Ok, last time I'll bug you.\n\nSlick RSS now has a Google Group for news and support.  Help shape Slick 3.0!  Do you want to check it out now?\n\nhttps://groups.google.com/d/forum/slick-rss");

        localStorage["alerted_group"] = 1;

        if (result) {
            chrome.tabs.create({url: "https://groups.google.com/d/forum/slick-rss"});
        }
    }

    // update the last version to now
    options.lastversion = manifest.version;
    localStorage["options"] = JSON.stringify(options);
}

// updates, shows and hides the badge
function UpdateUnreadBadge() {
    if (unreadInfo == null) {
        return;
    }

    var total = 0;
    var str = "";

    for (var key in unreadInfo) {
        total = total + unreadInfo[key].unreadtotal;
    }

    if (!options.readlaterincludetotal && unreadInfo[readLaterFeedID] != null) {
        total = total - unreadInfo[readLaterFeedID].unreadtotal;
    }

    if (total > 0) {
        str = total + "";
    }

    // they don't want toolbar unread updates
    if (options.unreadtotaldisplay == 0 || options.unreadtotaldisplay == 2) {
        str = "";
    }

    unreadTotal = total;

    // update badge
    chrome.browserAction.setBadgeText({text: str});

    // update title
    if (viewerPort != null) {
        viewerPort.postMessage({type: "unreadtotalchanged"});
    }
}

// returns a dictionary of unread counts {bookmarkid} = unreadtotal, readitems{}
// may need a way to clean this if they delete feeds
function GetUnreadCounts() {
    if (localStorage["unreadinfo"] == null) {
        localStorage["unreadinfo"] = JSON.stringify({});
    }

    return JSON.parse(localStorage["unreadinfo"]);
}

// starts the checking for unread (and now loading of data)
// if key is filled in, then only that feed will be refreshed
function CheckForUnreadStart(key) {
    if (checkingForUnread || feeds.length == 0) {
        return;
    }

    checkForUnreadCounter = (key == null) ? 0 : key;
    checkingForUnread = true;

    // keep timer going on "refresh"
    if (key == null) {
        clearTimeout(checkForUnreadTimerID);
        checkForUnreadTimerID = setTimeout(CheckForUnreadStart, options.checkinterval * 1000 * 60);

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
    var req = new XMLHttpRequest();
    var toID = setTimeout(req.abort, 60000);
    var feedID = feeds[checkForUnreadCounter].id;
    var now = new Date();

    feedInfo[feedID] = {title: "", description: "", loading: true, items: [], error: ""};

    if (viewerPort != null) {
        viewerPort.postMessage({type: "feedupdatestarted", id: feedID});
    }
    try {
        // get data and be nice to mac rss feeds
        req.open("get", feeds[checkForUnreadCounter].url.replace(/feed:\/\//i, "http://"), true);
        req.overrideMimeType('text/xml');
        req.onreadystatechange = function () {
            if (req.readyState == 4) {
                clearTimeout(toID);
                var doc = req.responseXML;

                // initialize unread object if not setup yet
                if (unreadInfo[feedID] == null) {
                    unreadInfo[feedID] = {unreadtotal: 0, readitems: {}};
                }

                unreadInfo[feedID].unreadtotal = 0;

                if (req.status == 200) {
                    if (doc) {
                        var readItemCount = 0;
                        var item = null;
                        var entryID = null;
                        var entryIDs = {};
                        var entries = GetElementsByTagName(doc, [], "entry", "item");
                        var rootNode = GetElementByTagName(doc, null, "feed", "rss", "rdf:RDF");
                        var author = null;
                        var name = null;

                        if (rootNode != null) {
                            if (rootNode.nodeName == "feed") {
                                feedInfo[feedID].title = GetNodeTextValue(GetElementByTagName(rootNode, null, "title"));
                                feedInfo[feedID].description = GetNodeTextValue(GetElementByTagName(rootNode, null, "subTitle", "description"));
                            } else {
                                var channel = GetElementByTagName(rootNode, null, "channel");

                                if (channel != null) {
                                    feedInfo[feedID].title = GetNodeTextValue(GetElementByTagName(channel, null, "title"));
                                    feedInfo[feedID].description = GetNodeTextValue(GetElementByTagName(channel, null, "description", "subTitle"));
                                }
                            }
                        }

                        for (var e = 0; e < entries.length; e++) {
                            item = {};
                            item.title = GetNodeTextValue(GetElementByTagName(entries[e], null, "title"), "No Title");
                            item.date = GetNodeTextValue(GetElementByTagName(entries[e], null, "pubDate", "updated", "dc:date", "date", "published")); // not sure if date is even needed anymore
                            item.content = "";

                            // don't bother storing extra stuff past max.. only title for Mark All Read
                            if (e <= feeds[checkForUnreadCounter].maxitems) {
                                item.url = GetFeedLink(entries[e]);

                                if (options.showfeedcontent) {
                                    item.content = GetNodeTextValue(GetElementByTagName(entries[e], null, "content:encoded", "content")); // only guessing on just "content"
                                }

                                if (item.content == "") {
                                    item.content = GetNodeTextValue(GetElementByTagName(entries[e], null, "description", "summary"));
                                }

                                author = GetElementByTagName(entries[e], null, "author", "dc:creator");

                                if (author != null) {
                                    name = GetElementByTagName(author, null, "name");

                                    if (name != null) {
                                        item.author = GetNodeTextValue(name);
                                    } else {
                                        item.author = GetNodeTextValue(author);
                                    }
                                } else {   // for some reason the author gets funky with floats if it's empty..  so whatever
                                    item.author = "&nbsp;";
                                }
                            }

                            feedInfo[feedID].items.push(item);
                            entryIDs[MD5(item.title + item.date)] = 1;
                        }

                        // count read that are in current feed
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

                        unreadInfo[feedID].unreadtotal = entries.length - readItemCount;
                    } else {
                        feedInfo[feedID].error = "The response didn't have a valid responseXML property.";
                    }
                } else {
                    if (feedID != readLaterFeedID) {
                        feedInfo[feedID].error = "Status wasn't 200.  It was " + req.status + " and frankly I don't know how to handle that.  If it helps, the status text was '" + req.statusText + "'.";
                    } else {
                        // cheat the system, fill in read later info
                        feedInfo[feedID] = GetReadLaterItems();
                        unreadInfo[feedID].unreadtotal = feedInfo[feedID].items.length;
                    }
                }

                localStorage["unreadinfo"] = JSON.stringify(unreadInfo);

                if (viewerPort != null) {
                    viewerPort.postMessage({type: "feedupdatecomplete", id: feedID});
                }

                checkForUnreadCounter++;

                req = null;
                doc = null;

                feedInfo[feedID].loading = false;

                if (checkForUnreadCounter >= feeds.length || refreshFeed) {
                    CheckForUnreadComplete();
                } else {
                    CheckForUnread();
                }
            }
        }

        req.send(null);
    } catch (err) {
        // onreadystate should already be called, so don't do anything!
    }
}


// ran after checking for unread is done
function CheckForUnreadComplete() {
    if (viewerPort != null && !refreshFeed) {
        viewerPort.postMessage({type: "refreshallcomplete"});
    }

    UpdateUnreadBadge();
    checkingForUnread = false;
    refreshFeed = false;
}

// since the key for unread is the feed id, it's possible that you removed some, as such we should update and clean house
function CleanUpUnreadOrphans() {
    var feedIDs = {};

    for (var key in feeds) {
        feedIDs[feeds[key].id] = 1;
    }

    for (var key in unreadInfo) {
        if (feedIDs[key] == null) {
            delete unreadInfo[key];
        }
    }

    localStorage["unreadinfo"] = JSON.stringify(unreadInfo);
    UpdateUnreadBadge();
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
    var links = node.getElementsByTagName("link");

    if (links.length == 0) {
        //<guid ispermalink="true(default)"></guid> is yet another way of saying link
        var guids = node.getElementsByTagName("guid");

        if (guids.length == 0 || guids[0].getAttribute("ispermalink") == "false") {
            return "";
        }

        return GetNodeTextValue(guids[0], "");

    }

    for (var i = 0; i < links.length; i++) {
        // in atom feeds alternate is the default so if something else is there then skip
        if (links[i].getAttribute("href") != null && (links[i].getAttribute("rel") == "alternate" || links[i].getAttribute("rel") == null)) {
            return links[i].getAttribute("href");
        }

        // text node or CDATA node
        if (links[i].childNodes.length == 1 && (links[i].childNodes[0].nodeType == 3 || links[i].childNodes[0].nodeType == 4)) {
            return links[i].childNodes[0].nodeValue;
        }
    }

    return ""; // has links, but I can't read them?!
}

// since node.getElementsByTag name is recursive and sometimes we don't want that
// GetElementByTagName(node, defaultValue, target1, target2)
function GetElementByTagName() {
    var node = arguments[0];

    for (var i = 0; i < node.childNodes.length; i++) {
        for (e = 2; e < arguments.length; e++) {
            if (node.childNodes[i].nodeName.toUpperCase() == arguments[e].toUpperCase()) {
                return node.childNodes[i];
            }
        }
    }

    return arguments[1];
}

// node, defaultValue, list of tags
function GetElementsByTagName() {
    var node = arguments[0];
    var defaultValue = arguments[1];
    var item;

    for (var i = 2; i < arguments.length; i++) {
        item = node.getElementsByTagName(arguments[i]);

        if (item.length > 0) {
            return item;
        }
    }

    return defaultValue;
}
