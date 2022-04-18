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

chrome.action.onClicked.addListener(ButtonClicked);
chrome.runtime.onMessage.addListener(ExternalRequest);
chrome.runtime.onConnect.addListener(InternalConnection);
chrome.alarms.onAlarm.addListener(AlarmRing);

waitOptionReady().then(function () {
    promiseUpgrade = DoUpgrades();
    waitUpgrade().then(function () {
      promiseGetUnreadCounts = GetUnreadCounts();
      waitGetUnreadCounts().then(function () {
        promiseGetReadLaterItems = loadReadlaterInfo();
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
    if (request.type == "checkForUnread") {
      CheckForUnreadStart();
      sendResponse({});
    }
    if (request.type == "checkForUnreadOnSelectedFeed") {
      CheckForUnreadStart(request.selectedFeedKey);
      sendResponse({});
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
    }

    if (request.type == "setUnreadInfo") {
      store.setItem('unreadinfo', request.data);
      unreadInfo = request.data;
      sendResponse({});
    }

    if (request.type == "getFeeds") {
      sendResponse(GetStrFromObject(feeds));
    }

    if (request.type == "getFeedInfo") {
      sendResponse(GetStrFromObject(feedInfo));
    }

    if (request.type == "getGroups") {
      sendResponse(GetStrFromObject(groups));
    }

    if (request.type == "getGroupInfo") {
      sendResponse(GetStrFromObject(groupInfo));
    }

    if (request.type == "calcGroupCountUnread") {
      sendResponse(CalcGroupCountUnread(request.data));
    }

    if (request.type == "getUnreadTotal") {
      sendResponse(unreadTotal);
    }

    if (request.type == "getRefreshFeed") {
      sendResponse(GetStrFromObject({"refreshFeed": refreshFeed, "checkForUnreadCounter": checkForUnreadCounter, checkingForUnread: checkingForUnread}));
    }
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

// as this project gets larger there will be upgrades to storage items this will help
function DoUpgrades() {
    var lastVersion = parseFloat(options.lastversion);
    var listPromise = [];
    var resultPromise = null;

    // update the last version to now
    if (options.lastversion != manifest.version) {
      options.lastversion = manifest.version;
      listPromise.push(store.setItem('options', options));
      //remove old system for readlater
      store.removeItem('readlater').then(function() {}).catch(function(err) {});
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

    resultPromise = Promise.allSettled(listPromise);
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
    var promiseCheckForUnread = [];
    var status;

    // initialize unread object if not setup yet
    if (unreadInfo == null) {
      unreadInfo = { };
    }
    if (unreadInfo[feedID] == null) {
        unreadInfo[feedID] = {unreadtotal: 0, readitems: {}};
    }

    unreadInfo[feedID].unreadtotal = 0;

    if (feedID == readLaterFeedID) {
        loadReadlaterInfo().then(function(){
          unreadInfo[feedID].unreadtotal = readlaterInfo[feedID].items.length;

          checkForUnreadCounter++;
          if (checkForUnreadCounter < feeds.length) {
            if (feeds[checkForUnreadCounter].id === allFeedsID) {
              checkForUnreadCounter++;
            }
          }

          if (checkForUnreadCounter >= feeds.length || refreshFeed) {
              CheckForUnreadComplete();
          } else {
              CheckForUnread();
          }
        });
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

      feedInfo[feedID] = {title: "", description: "", group: "", loading: true, items: [], error: ""};

      if (viewerPort != null) {
          viewerPort.postMessage({type: "feedupdatestarted", id: feedID, refreshFeed: refreshFeed, checkForUnreadCounter: checkForUnreadCounter, checkingForUnread: checkingForUnread});
      }

      try {
        fetch(feeds[checkForUnreadCounter].url.replace(/feed:\/\//i, "http://"), {
          method: 'GET',
          headers: {
            'Content-Type': 'text/xml',
            'Accept-Charset': 'utf-8'
          },
        })
          .then(
            function(response) {
              if (!response.ok) {
                console.log('Looks like there was a problem. Status Code: ' + response.status);
                return;
              }
              status = response.status;
              response.arrayBuffer().then(function(data) {
                var decoder = new TextDecoder("UTF-8");
                var doc = decoder.decode(data);
                var encodeName = doc.substring(0, 100);
                encodeName = encodeName.substring(encodeName.indexOf("encoding=") + ("encoding=").length, encodeName.indexOf("?>"));
                encodeName = encodeName.replaceAll('\"', '');
                encodeName = encodeName.replaceAll('"', '');
                if (encodeName.replaceAll('-', '').toUpperCase() != "UTF8"){
                  decoder = new TextDecoder(encodeName);
                  doc = decoder.decode(data);
                }

                var previousUnreadtotal = unreadInfo[feedID].unreadtotal;

                if (status == 200) {
                    if (doc) {
                        var readItemCount = 0;
                        var item = null;
                        var entryID = null;
                        var entryIDs = {};
                        var entries = GetElementsByTagNameJS(doc, [], "entry", "item");
                        var rootNode = GetElementByTagNameJS(doc, null, "feed", "rss", "rdf:RDF");
                        var author = null;
                        var name = null;
                        var thumbnail = null;
                        var thumbnailurl = null;
                        var thumbnailtype = null;
                        var thumbnailNode = null;
                        var dummyDate = null;
                        var keys = null

                        if (rootNode != null) {
                            keys = Object.keys(rootNode);
                            if (keys[0].toUpperCase() == "FEED") {
                                feedInfo[feedID].title = SearchTag(rootNode, null, ["TITLE"], 0);
                                feedInfo[feedID].description = SearchTag(rootNode, null, ["SUBTITLE", "DESCRIPTION"], 0);
                            } else {
                                var channel = SearchTag(rootNode, null, ["CHANNEL"], 0);

                                if (channel != null) {
                                    feedInfo[feedID].title = SearchTag(channel, null, ["TITLE"], 0);
                                    feedInfo[feedID].description = SearchTag(channel, null, ["DESCRIPTION", "SUBTITLE"], 0);
                                }
                            }
                        }

                        for (var e = 0; e < entries.length; e++) {
                            item = {};
                            item.title = CleanText2(SearchTag(entries[e], GetMessageText("backNoTitle"), ["TITLE"], 0));
                            item.title = item.title.replaceAll("U+20AC", '€').replaceAll("&apos;", "'");
                            item.date = CleanText2(SearchTag(entries[e], null, ["PUBDATE", "UPDATED", "DC:DATE", "DATE", "PUBLISHED"], 0)); // not sure if date is even needed anymore
                            item.content = "";
                            item.idOrigin = feedID;
                            item.itemID = sha256(item.title + item.date);
                            thumbnailurl = null;
                            thumbnailtype = null;

                            // don't bother storing extra stuff past max.. only title for Mark All Read
                            if (e <= feeds[checkForUnreadCounter].maxitems) {
                                item.url = GetFeedLink(entries[e]);

                                if (options.showfeedcontent) {
                                    item.content = CleanText2(SearchTag(entries[e], null, ["CONTENT:ENCODED", "CONTENT"], 0)); // only guessing on just "content"
                                }

                                if ((item.content == "") || (item.content == null)) {
                                    item.content = CleanText2(SearchTag(entries[e], null, ["DESCRIPTION", "SUMMARY"], 0));
                                }
                                item.content = item.content.replaceAll("U+20AC", '€').replaceAll("&apos;", "'");
                                item.thumbnail = null;

                                author = CleanText2(SearchTag(entries[e], null, ["AUTHOR", "DC:CREATOR", "CREATOR"], 0));
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
                                      delete thumbnail[k];
                                    }
                                  }

                                  keys = Object.keys(thumbnail);
                                  var thumbtemp = [];
                                  for (var k = 0; k < keys.length; k++)
                                  {
                                    thumbtemp[k] = thumbnail[keys[k]];
                                  }
                                  thumbnail = thumbtemp;

                                  for (var k = 0; k < thumbnail.length; k++)
                                  {
                                    keys = Object.keys(thumbnail[k]);
                                    var val = Object.values(thumbnail[k]);
                                    for (var j = 0; j < keys.length; j++)
                                    {
                                      if (keys[j].toUpperCase() == "MEDIA:CONTENT") {
                                        for (var n1 = 0; n1 < val[j].length; n1++)
                                        {
                                          var keys2 = Object.keys(val[j][n1]);
                                          var val2 = Object.values(val[j][n1]);
                                          for (var n2 = 0; n2 < keys2.length; n2++)
                                          {
                                            if (keys2[n2].toUpperCase() == "MEDIA:DESCRIPTION") {
                                              if (CleanText(val2[n2]).includes("thumbnail"))
                                              {
                                                if (thumbnail[k][":@"] != undefined) {
                                                  thumbnailurl = thumbnail[k][":@"]["url"];
                                                  thumbnailtype = thumbnail[k][":@"]["medium"];
                                                  if (thumbnailtype == "image") {
                                                    item.thumbnail = "<img src=\"" + thumbnailurl + "\" class=\"thumbnail\">";
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
                                    if (thumbnailurl != null) {
                                      break;
                                    }
                                  }
                                  if (thumbnailurl != null) {
                                    break;
                                  }
                                }
                                }

                                if (author != null) {
                                    item.author = author;
                                    /*name = GetElementByTagNameJS(author, null, "name");

                                    if (name != null) {
                                        item.author = GetNodeTextValue(name);
                                    } else {
                                        item.author = GetNodeTextValue(author);
                                    }*/
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
                            entryIDs[item.itemID] = 1;
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
                    feedInfo[feedID].error = GetMessageText("backError200Part1") + status + GetMessageText("backError200Part2") + response.statusText + GetMessageText("backError200Part3");
                }
                promiseCheckForUnread.push(store.setItem('unreadinfo', unreadInfo));

                oldFeedInfoItems

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
              });
            }
          )
          .catch(function(err) {
            console.log('Fetch Error :-S', err);
          });
      } catch (err) {
          console.log('Error :-S', err);
      }
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
    return ""; // has links, but I can't read them?!
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
    url = chrome.runtime.getURL("group.html");
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
