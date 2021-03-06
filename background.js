var manifest = chrome.runtime.getManifest();
var defaultOptions = GetDefaultOptions();
var options = defaultOptions;
var promiseBegin = GetOptions();
var promiseUpgrade = null;
var promiseGetUnreadCounts = null;
var promiseGetReadLaterItems = null;
var promiseExternalRequest = null;
var unreadInfo = { };
var unreadTotal = 0;
var feedInfo = [];
var feeds = [];
var groupInfo = [];
var groups = [];
var viewerPort = null;
var checkingForUnread = false;
var checkForUnreadTimerID = null;
var checkForUnreadCounter = 0;
var allFeedsUnreadCounter = -1;
var getFeedsCallBack = null;
var refreshFeed = false;
var newNotif = false;
var readLaterFeedID = 9999999999;
var allFeedsID = 9999999998;
var viewPortTabID = null;
var referenceDate = GetDate("Thu, 31 Dec 2019 23:59:59 +0000").getTime();
var readlater = {
    title: GetMessageText("backReadLater"),
    description: GetMessageText("backItemsMarkedReadLater"),
    group: "",
    loading: false,
    items: [],
    error: ""
};

chrome.browserAction.onClicked.addListener(ButtonClicked);
chrome.runtime.onMessageExternal.addListener(ExternalRequest);
chrome.runtime.onConnect.addListener(InternalConnection);
chrome.alarms.onAlarm.addListener(AlarmRing);

waitOptionReady().then(function () {
    promiseUpgrade = DoUpgrades();
    waitUpgrade().then(function () {
      promiseGetUnreadCounts = GetUnreadCounts();
      waitGetUnreadCounts().then(function () {
        promiseGetReadLaterItems = GetReadLaterItems();
        waitGetReadLaterItems().then(function () {
          GetFeeds(function () {
              var promiseCleanUpUnreadOrphans = CleanUpUnreadOrphans();
              promiseCleanUpUnreadOrphans.then(function(){
                CheckForUnreadStart();
              });
          });
        });
      });
    });
  }
);

async function waitOptionReady() {
  return start = await Promise.allSettled([promiseBegin]);
}

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
          console.log(e);
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
        chrome.tabs.update(viewerPortTabID, {selected: true});
    }
}

function ExternalRequest(request, sender, sendResponse) {
    if (request.type == "addfeed") {
      var maxOrder = 0;
      var order = 0;
      var resultPromise = null;

      for (var i = 0; i < feeds.length; i++) {
          order = parseInt(feeds[i].order);

          if (order > maxOrder) {
              maxOrder = order;
          }
      }

      maxOrder++;

      feeds.push(CreateNewFeed(request.title, request.url, request.group, options.maxitems, maxOrder));
      resultPromise = store.setItem('feeds', feeds);
      resultPromise.then(function(){
        UpdateGroups();
        ReloadViewer();

        sendResponse({});
      });
    }

    if (request.type == "deletefeed") {
        for (var i = 0; i < feeds.length; i++) {
            if (feeds[i].url == request.url) {
              feeds.splice(i, 1);
            }
        }
        resultPromise = store.setItem('feeds', feeds);
        resultPromise.then(function(){
          UpdateGroups();
          ReloadViewer();
          sendResponse({});
      });
    }
}

// gets all or some options, filling in defaults when needed
function GetOptions() {
  var promiseGetOption = store.getItem('options').then(function(data) {
      if (data != null) {
          options = data;

          // fill in defaults for new options
          for (key in GetDefaultOptions()) {
              if (options[key] == undefined) {
                  options[key] = defaultOptions[key];
              }
          }
      }
    });
    return promiseGetOption;
}

// used to get defaults to help fill in missing pieces as I add more options
function GetDefaultOptions() {
    return {
        "lastversion": manifest.version,
        "maxitems": 50,
        "showdescriptions": true,
        "dateformat": "[ww] [dd]/[mm]/[yy] [hh]:[nn]",
        "showfeedimages": true,
        "showfeedobjects": true,
        "showfeediframes": false,
        "showfeedcontent": true,
        "checkinterval": 60,
        "markreadonclick": false,
        "markreadafter": 0,
        "readitemdisplay": 1,
        "unreaditemtotaldisplay": true,
        "unreadtotaldisplay": 3,
        "columns": 2,
        "readlaterenabled": true,
        "readlaterremovewhenviewed": true,
        "readlaterincludetotal": true,
        "loadlinksinbackground": true,
        "showallfeeds": false,
        "usethumbnail": false,
        "feedsmaxheight": 200,
        "playSoundNotif": false
    };
}

// gets the feed array for everyone to use
function GetFeeds(callBack) {
  feeds = [];
  getFeedsCallBack = callBack;

  store.getItem('feeds').then(function(datafeeds) {
    if (datafeeds != null) {
        feeds = datafeeds.sort(function (a, b) {
            return a.order - b.order;
        });
    }

    feeds.unshift(GetReadLaterFeed());
    UpdateGroups();
    getFeedsCallBack();
  });
}

function GetReadLaterFeed() {
    return CreateNewFeed(GetMessageText("backReadLater"), chrome.extension.getURL("readlater.html"), "", 99999, -9, readLaterFeedID);
}

function GetReadLaterItems() {
  var resultPromise = store.getItem('readlater').then(function(data) {
    if (data != null) {
      readlater = JSON.parse(data);
    } else {
      store.setItem('readlater', {
          title: GetMessageText("backReadLater"),
          description: GetMessageText("backItemsMarkedReadLater"),
          group: "",
          loading: false,
          items: [],
          error: ""
      });
      }
  });

  return resultPromise;
}

// helper function for creating new feeds
function CreateNewFeed(title, url, group, maxitems, order, id) {
    // managed feed doesn't have an id yet
    if (id == null) {
        id = GetRandomID();
    }

    return {title: title, url: url, group: group, maxitems: maxitems, order: order, id: id};
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
    var listPromise = [];
    var resultPromise = null;

    // update the last version to now
    if (options.lastversion != manifest.version) {
      options.lastversion = manifest.version;
      listPromise.push(store.setItem('options', options));
    }

    listPromise.push(store.getItem('feeds').then(function(data){
        if (data != null) {
            feeds = data;
        }
      }));
    listPromise.push(store.getItem('unreadinfo').then(function(data){
        if (data != null) {
            unreadInfo = data;
        }
      }));
    listPromise.push(store.getItem('readlater').then(function(data){
        if (data != null) {
            readlater = data;
        }
      }));
    resultPromise = Promise.allSettled(listPromise);
    return resultPromise;
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

    if (newNotif) {
      PlayNotificationSound();
      newNotif = false;
    }

    unreadTotal = total;

    // update badge
    chrome.browserAction.setBadgeText({text: str});
    //chrome.action.setBadgeText({text: str});

    // update title
    if (viewerPort != null) {
        viewerPort.postMessage({type: "unreadtotalchanged"});
    }
}

// returns a dictionary of unread counts {feedsid} = unreadtotal, readitems{}
// may need a way to clean this if they delete feeds
function GetUnreadCounts() {
  var resultPromise = store.getItem('unreadinfo').then(function(data) {
      if (data != null) {
          unreadinfo = data;
      } else {
        unreadinfo = { };
        store.setItem('unreadinfo', { });
      }
    },function(dataError) {
        unreadinfo = { };
        store.setItem('unreadinfo', { });
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
    var req = new XMLHttpRequest();
    var toID = setTimeout(function() {
        try {
            req.abort();
        } catch(e){
            console.log(e);
        }
      }, 60000);
    var now = new Date();
    var promiseCheckForUnread = [];

    feedInfo[feedID] = {title: "", description: "", group: "", loading: true, items: [], error: ""};

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
                var previousUnreadtotal;

                if (unreadInfo[feedID] == null) {
                  previousUnreadtotal = 0;
                } else {
                  previousUnreadtotal = unreadInfo[feedID].unreadtotal;
                }

                // initialize unread object if not setup yet
                if (unreadInfo == null) {
                  unreadInfo = { };
                }
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
                        var thumbnail = null;
                        var thumbnailurl = null;
                        var thumbnailtype = null;
                        var thumbnailNode = null;
                        var dummyDate = null;

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
                            item.title = GetNodeTextValue(GetElementByTagName(entries[e], null, "title"), GetMessageText("backNoTitle"));
                            item.date = GetNodeTextValue(GetElementByTagName(entries[e], null, "pubDate", "updated", "dc:date", "date", "published")); // not sure if date is even needed anymore
                            item.content = "";
                            item.idOrigin = feedID;
                            item.itemID = sha256(item.title + item.date);

                            // don't bother storing extra stuff past max.. only title for Mark All Read
                            if (e <= feeds[checkForUnreadCounter].maxitems) {
                                item.url = GetFeedLink(entries[e]);

                                if (options.showfeedcontent) {
                                    item.content = GetNodeTextValue(GetElementByTagName(entries[e], null, "content:encoded", "content")); // only guessing on just "content"
                                }

                                if (item.content == "") {
                                    item.content = GetNodeTextValue(GetElementByTagName(entries[e], null, "description", "summary"));
                                }
                                item.thumbnail = null;

                                author = GetElementByTagName(entries[e], null, "author", "dc:creator", "creator");
                                thumbnail = GetElementByTagName(entries[e], null, "enclosure", "media:group");
                                if (thumbnail != null) {
                                  if (thumbnail.nodeName == "media:group") {
                                    for (var i = 0; i < thumbnail.childNodes.length; i++) {
                                      thumbnailNode = GetElementByTagName(thumbnail.childNodes[i], null, "media:description");
                                      if (thumbnailNode != null) {
                                        if (thumbnailNode.textContent.includes("thumbnail")) {
                                          thumbnailurl = thumbnail.childNodes[i].getAttribute("url");
                                          thumbnailtype = thumbnail.childNodes[i].getAttribute("medium");
                                          if (thumbnailtype == "image") {
                                            item.thumbnail = "<img src=\"" + thumbnailurl + "\" class=\"thumbnail\">";
                                            break;
                                          }
                                        }
                                      }
                                    }
                                    if (item.thumbnail == null) {
                                      for (var i = 0; i < thumbnail.childNodes.length; i++) {
                                        thumbnailNode = GetElementByTagName(thumbnail.childNodes[i], null, "media:description");
                                        if (thumbnailNode != null) {
                                          thumbnailurl = thumbnail.childNodes[i].getAttribute("url");
                                          thumbnailtype = thumbnail.childNodes[i].getAttribute("medium");
                                          if (thumbnailtype == "image") {
                                            item.thumbnail = "<img src=\"" + thumbnailurl + "\" class=\"thumbnail\">";
                                            break;
                                          }
                                        }
                                      }
                                    }
                                  } else {
                                    if (thumbnail != null) {
                                      thumbnailurl = thumbnail.getAttribute("url");
                                      thumbnailtype = thumbnail.getAttribute("type");
                                      if (thumbnailurl != null) {
                                        if (thumbnailtype != null) {
                                          if (thumbnailtype.includes("image")) {
                                            item.thumbnail = "<img src=\"" + thumbnailurl + "\" class=\"thumbnail\">";
                                          }
                                        } else {
                                          item.thumbnail = "<img src=\"" + thumbnailurl + "\" class=\"thumbnail\">";
                                        }
                                      }
                                    }
                                  }
                                }

                                if (author != null) {
                                    name = GetElementByTagName(author, null, "name");

                                    if (name != null) {
                                        item.author = GetNodeTextValue(name);
                                    } else {
                                        item.author = GetNodeTextValue(author);
                                    }
                                } else {   // for some reason the author gets funky with floats if it's empty..  so whatever
                                    item.author = '\u00a0';
                                }
                            }
                            dummyDate = GetDate(item.date);
                            if(dummyDate != null)
                            {
                              item.order = dummyDate.getTime() - referenceDate;
                            }
                            else {
                              item.order = referenceDate;
                            }

                            feedInfo[feedID].items.push(item);
                            entryIDs[sha256(item.title + item.date)] = 1;
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
                        feedInfo[feedID].error = GetMessageText("backErrorXML");
                    }
                } else {
                    if (feedID != readLaterFeedID) {
                        feedInfo[feedID].error = GetMessageText("backError200Part1") + req.status + GetMessageText("backError200Part2") + req.statusText + GetMessageText("backError200Part3");
                    } else {
                        // cheat the system, fill in read later info
                        feedInfo[feedID] = readlater;
                        unreadInfo[feedID].unreadtotal = feedInfo[feedID].items.length;
                    }
                }
                if (feedID == readLaterFeedID) {
                  // cheat the system, fill in read later info
                  feedInfo[feedID] = readlater;

                if ((feedInfo[feedID] == null) || (feedInfo[feedID].items == null)) {
                  unreadInfo[feedID].unreadtotal = 0;
                } else {
                  unreadInfo[feedID].unreadtotal = feedInfo[feedID].items.length;
                }

                }
                promiseCheckForUnread.push(store.setItem('unreadinfo', unreadInfo));

                if (unreadInfo[feedID].unreadtotal > previousUnreadtotal) {
                  newNotif = true;
                }

                checkForUnreadCounter++;

                req = null;
                doc = null;

                feedInfo[feedID].loading = false;

                waitPromise(promiseCheckForUnread).then(function () {
                  if (viewerPort != null) {
                      viewerPort.postMessage({type: "feedupdatecomplete", id: feedID});
                  }

                  if (checkForUnreadCounter >= feeds.length || refreshFeed) {
                      CheckForUnreadComplete();
                  } else {
                      CheckForUnread();
                  }
                });
            }
        }

        req.send(null);
    } catch (err) {
        // onreadystate should already be called, so don't do anything!
    }
}

// ran after checking for unread is done
function CheckForUnreadComplete() {
  checkingForUnread = false;
  refreshFeed = false;
    if (viewerPort != null && !refreshFeed) {
        viewerPort.postMessage({type: "refreshallcomplete"});
    }

    for (var i = 0; i < feeds.length; i++) {
      if (feedInfo[feeds[i].id] != undefined)
      {
        SortByDate(feedInfo[feeds[i].id].items);
      }
    }

    UpdateGroups();
    UpdateUnreadBadge();
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
    var promiseCleanUpUnreadOrphans = store.setItem('unreadinfo', unreadInfo);

    UpdateUnreadBadge();

    return promiseCleanUpUnreadOrphans;
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

function GetAllFeedsGroup() {
  return CreateNewGroup(GetMessageText("backAllFeeds"), "", -8, allFeedsID);
}

// helper function for creating new feeds
function CreateNewGroup(title, group, order, id) {
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
    url = chrome.extension.getURL("group.html");
    maxitems = 99999;

    return {title: title, url: url, group: group, maxitems: maxitems, order: order, id: id, items: []};
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
            groups.push(CreateNewGroup(feeds[i].group, feeds[i].group, null, null));
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
  GetGroupAllFeedsItems();

  for (var i = 0; i < groups.length; i++) {
    groupInfo[groups[i].id].loading = false;
    SortByDate(groupInfo[groups[i].id].items);
  }
}

function GetGroupAllFeedsItems() {
  if (options.showallfeeds == true) {
    GetGroupItems(0, allFeedsID, GetMessageText("backAllFeeds"), GetMessageText("backAllFeeds"));
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

function CalcGroupCountUnread(key) {
    var filteredFeeds = GetFeedsFilterByGroup(key);
    var count = 0;
    for (var i = 0; i < filteredFeeds.length; i++) {
      if (unreadInfo[filteredFeeds[i].id] != null) {
        count += unreadInfo[filteredFeeds[i].id].unreadtotal;
      }
    }
    return count;
}

function GetFeedsFilterByGroup(key) {
    var filteredFeeds = [];
    if (groups[key].id == allFeedsID) {
      filteredFeeds = feeds.filter(function (el) {
        return (el.id != readLaterFeedID);
      });
    } else {
      filteredFeeds = feeds.filter(function (el) {
        return (el.group == groups[key].group) && (el.id != readLaterFeedID);
      });
    }

    return filteredFeeds;
}

function ItemIsRead(feedID, itemID) {
  var currentFeed = feeds.find(function (el) {
    return (el.id == feedID);
  });
  if (currentFeed != null) {
      return (unreadInfo[currentFeed.id].readitems[itemID] != null);
  }
  return false;
}

function GetFeedInfoItem(feedID, itemIndex) {
    var feedGroupInfo = feedInfo[feedID];
    if (feedGroupInfo == null) {
      feedGroupInfo = feedInfo[groupInfo[feedID].items[itemIndex].idOrigin].items.find(function (el) {
        return (el.itemID == groupInfo[feedID].items[itemIndex].itemID);
      });
      return feedGroupInfo;
    }
    return feedGroupInfo.items[itemIndex];
}

function PlayNotificationSound() {
  if (options.playSoundNotif) {
    var audio = new Audio('Glisten.ogg');
    audio.play();
  }
}
