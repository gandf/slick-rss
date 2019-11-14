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
        MarkFeedRead(feeds[selectedFeedKey].id);
    });
    $('#showOptions').click(function () {
        chrome.tabs.create({url: 'options.html'});
    });
    $('#addFeeds').click(function () {
        window.location = 'manage.html';
    });
});

var bgPage = chrome.extension.getBackgroundPage();
var options = bgPage.options;
var feeds = bgPage.feeds;
var selectedFeedKey = null;
var feedReadToID = null;

var port = chrome.extension.connect({name: "viewerPort"});

port.onMessage.addListener(function (msg) {
    if (msg.type == "feedschanged") {
        location = 'viewer.html';
    }

    if (msg.type == "refreshallstarted") {
        document.getElementById("feedsLoadingProgress").style.width = "0%";
    }

    if (msg.type == "refreshallcomplete") {
        document.getElementById("feedsOptions").style.display = "";
        document.getElementById("feedsLoading").style.display = "none";
    }

    if (msg.type == "feedupdatestarted") {
        if (!bgPage.refreshFeed) {
            UpdateRefreshAllProgress();
        }

        if (msg.id == feeds[selectedFeedKey].id) {
            document.getElementById("header").className = "loading";
        }
    }

    if (msg.type == "feedupdatecomplete") {
        UpdateFeedUnread(msg.id);

        // refresh page if you are on the one that changed
        if (msg.id == feeds[selectedFeedKey].id) {
            SelectFeed(selectedFeedKey);
            document.getElementById("header").className = "";
        }
    }

    if (msg.type == "unreadtotalchanged") {
        UpdateTitle();
    }
});

window.onload = ShowFeeds;
window.onresize = FixFeedList;


function UpdateRefreshAllProgress() {
    document.getElementById("feedsOptions").style.display = "none";
    document.getElementById("feedsLoading").style.display = "block";

    document.getElementById("feedsLoadingProgress").style.width = Math.round(((bgPage.checkForUnreadCounter + 1) / feeds.length) * 100) + "%";
}

function UpdateTitle() {
    var title = "Slick RSS" + (feeds[selectedFeedKey] ? " [" + feeds[selectedFeedKey].title + "]" : "");

    if ((options.unreadtotaldisplay == 2 || options.unreadtotaldisplay == 3) && bgPage.unreadTotal > 0) {
        title += " (" + bgPage.unreadTotal + ")";
    }

    document.title = title;
    document.getElementById("markAllRead").style.display = (bgPage.unreadTotal > 0) ? "" : "none";
}

function ShowFeeds() {
    var feedArea = null;
    var selectKey = null;
    var lastSelectedID = localStorage["lastSelectedFeedID"];

    UpdateTitle();

    for (key in feeds) {
        if (key == 0 && !options.readlaterenabled) {
            continue;
        }

        ShowFeed(key);

        if (selectKey == null) {
            selectKey = key;
        }

        if (feeds[key].id == lastSelectedID) {
            selectKey = key;
        }
    }

    if (feeds.length == 0 || (feeds.length == 1 && bgPage.feedInfo[bgPage.readLaterFeedID].items.length == 0)) {
        if (options.feedsource == "0") {
            document.getElementById("noFeedsManaged").style.display = "";
        } else {
            document.getElementById("noFeedsBookmarks").style.display = "";
        }

        document.getElementById("headerMessage").innerText = "Feed Me";
        document.getElementById("feedHeader").style.display = "none";
        document.getElementById("feedArea").style.display = "none";
        document.getElementById("refresh").style.display = "none";
        document.getElementById("markFeedRead").style.display = "none";
    } else {
        SelectFeed(selectKey);
    }

    // in the middle of refresh all, show progress but wait a little so feed content pushes the feed list to the right size
    // this is only here to show progress on load when current loading feed is slow, otherwise the next feed will update the progress
    if (bgPage.checkingForUnread && !bgPage.refreshFeed) {
        setTimeout(UpdateRefreshAllProgress, 500);
    }

    document.getElementById("manage").style.display = (options.feedsource != 0) ? "none" : "";
    focusFeed();
}

function FixFeedList() {
    var feedScroller = document.getElementById("feedScroller");
    var feedPreviewScroller = document.getElementById("feedPreviewScroller");
    var header = document.getElementById("header");

    feedPreviewScroller.style.height = (document.body.offsetHeight - header.offsetHeight) + "px";
    feedPreviewScroller.style.width = (window.innerWidth - feedScroller.offsetWidth) + "px"; // some feeds don't wrap well so we must force a strict width

    feedScroller.style.height = document.body.offsetHeight - document.getElementById("feedHeader").offsetHeight + "px";
    feedScroller.style.overflowY = (feedScroller.offsetHeight < feedScroller.scrollHeight) ? "scroll" : "hidden";
}

function ShowFeed(key) {
    var li = document.createElement("li");
    var span = document.createElement("span");

    li.innerText = feeds[key].title;
    li.setAttribute("id", "feedTitle" + feeds[key].id);
    span.setAttribute("id", "feedUnread" + feeds[key].id);

    $(li).click(function () {
        SelectFeed(key);
        focusFeed();
        UpdateTitle();
        return false;
    });
    //ClickBuilder(li, "SelectFeed('" + key + "')");

    li.appendChild(span);

    document.getElementById("feedList").appendChild(li);

    UpdateFeedUnread(feeds[key].id);
}

function focusFeed() {
    var feedPreview = document.getElementById("feedPreview");
    feedPreview.focus();
}

// updates a feed item's unread count
function UpdateFeedUnread(id) {
    if (bgPage.unreadInfo[id] == null || !options.unreaditemtotaldisplay) {
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

    FixFeedList();
}

function UpdateReadAllIcon() {
    var count = 0;

    if (bgPage.unreadInfo != null && bgPage.unreadInfo[feeds[selectedFeedKey].id] != null) {
        count = bgPage.unreadInfo[feeds[selectedFeedKey].id].unreadtotal;
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
    var className = (options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";
    var expireMs = new Date().getTime() + 5184000000; // 2 months;

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
            itemID = MD5(bgPage.feedInfo[feedID].items[i].title + bgPage.feedInfo[feedID].items[i].date);
            bgPage.unreadInfo[feedID].readitems[itemID] = expireMs;
            container = document.getElementById("item_" + feedID + "_" + itemID);

            if (container != null) {
                container.className = container.className + className;
            }
        }
    }

    localStorage["unreadinfo"] = JSON.stringify(bgPage.unreadInfo);

    UpdateFeedUnread(feedID);
    UpdateReadAllIcon();
    bgPage.UpdateUnreadBadge();
}

function MarkItemRead(itemID) {
    var feedID = feeds[selectedFeedKey].id;
    var className = (options.readitemdisplay == 0) ? " feedPreviewContainerRead" : " feedPreviewContainerRead feedPreviewContainerCondensed";
    var expireMs = new Date().getTime() + 5184000000; // 2 months;

    if (bgPage.unreadInfo[feedID].readitems[itemID] == null) {
        document.getElementById("item_" + feedID + "_" + itemID).className += className;

        bgPage.unreadInfo[feedID].unreadtotal--;
        bgPage.unreadInfo[feedID].readitems[itemID] = expireMs;

        localStorage["unreadinfo"] = JSON.stringify(bgPage.unreadInfo);

        UpdateFeedUnread(feedID);
        UpdateReadAllIcon();
        bgPage.UpdateUnreadBadge();
    }
}

function MarkItemReadLater(feedID, itemIndex) {
    var itemID = MD5(bgPage.feedInfo[feedID].items[itemIndex].title + bgPage.feedInfo[feedID].items[itemIndex].date);

    bgPage.feedInfo[bgPage.readLaterFeedID].items.push(bgPage.feedInfo[feedID].items[itemIndex]);
    bgPage.unreadInfo[bgPage.readLaterFeedID].unreadtotal++;

    MarkItemRead(itemID);
    UpdateFeedUnread(bgPage.readLaterFeedID);

    localStorage["readlater"] = JSON.stringify(bgPage.feedInfo[bgPage.readLaterFeedID]);
}

function UnMarkItemReadLater(itemIndex) {
    bgPage.unreadInfo[bgPage.readLaterFeedID].unreadtotal--;
    bgPage.feedInfo[bgPage.readLaterFeedID].items.splice(itemIndex, 1);
    bgPage.UpdateUnreadBadge();

    localStorage["readlater"] = JSON.stringify(bgPage.feedInfo[bgPage.readLaterFeedID]);

    UpdateFeedUnread(bgPage.readLaterFeedID);
    SelectFeed(0);
}

function SelectFeed(key) {
    localStorage["lastSelectedFeedID"] = bgPage.feeds[key].id;

    document.getElementById("feedPreviewScroller").scrollTop = 0;

    clearTimeout(feedReadToID);

    if (selectedFeedKey != null) {
        document.getElementById("feedTitle" + feeds[selectedFeedKey].id).setAttribute("class", "");
    }

    document.getElementById("feedTitle" + feeds[key].id).setAttribute("class", "selectedFeed");

    selectedFeedKey = key;
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
    document.getElementById("refresh").style.display = (feeds[selectedFeedKey].id != bgPage.readLaterFeedID) ? "" : "none";
    document.getElementById("noItems").style.display = "none";

    // feed isn't ready yet
    if (bgPage.feedInfo[feeds[key].id] == null || bgPage.feedInfo[feeds[key].id].loading) {
        document.getElementById("headerMessage").innerText = "Loading Feed ...";
        document.getElementById("header").className = "loading";
        document.getElementById("refresh").style.display = "none";

        // must be a new feed with no content yet
        if (bgPage.feedInfo[feeds[key].id] == null && !bgPage.checkingForUnread) {
            bgPage.CheckForUnreadStart(key);
        }

        return;
    }

    // feed loaded, but had an error
    if (bgPage.feedInfo[feeds[key].id].error != "") {
        ShowFeedError(bgPage.feedInfo[feeds[key].id].error);
        return;
    }

    document.getElementById("noItems").style.display = (bgPage.feedInfo[feeds[key].id].items.length == 0) ? "" : "none";

    RenderFeed();
    UpdateReadAllIcon();
    FixFeedList(); // in case header wraps

    if (options.markreadafter > 0 && key != 0) {
        feedReadToID = setTimeout(function () {
            MarkFeedRead(feeds[key].id)
        }, options.markreadafter * 1000);
    }

}

function RenderFeed() {
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
    var feedID = feeds[selectedFeedKey].id;
    var currentTr = null;
    var columnCount = 0;
    var colWidth = null;
    var feedTd = null;
    var href = "";

    document.getElementById("headerMessage").innerText = bgPage.feedInfo[feedID].title;

    if (bgPage.feedInfo[feedID].description != "" && options.showdescriptions) {
        document.getElementById("headerMessage").innerHTML += "<span> - " + bgPage.feedInfo[feedID].description + "</span>";
    }

    switch (options.columns) {
        case "1":
            colWidth = "100%";
            break;
        case "2":
            colWidth = "50%";
            break;
        case "3":
            colWidth = "33%";
            break;
        case "4":
            colWidth = "25%";
            break;
    }
    var feedBaseUrl = (new URL(feeds[selectedFeedKey].url)).origin;

    for (var i = 0; i < bgPage.feedInfo[feedID].items.length && i < feeds[selectedFeedKey].maxitems; i++) {
        item = bgPage.feedInfo[feedID].items[i];
        itemID = MD5(item.title + item.date);

        feedMarkRead = null;
        feedMarkRead = document.createElement("img");
        feedMarkRead.setAttribute("src", "x_blue.gif");
        //feedMarkRead.setAttribute("id", 'markItemRead' + itemID);

        if (feedID == bgPage.readLaterFeedID) {
            $(feedMarkRead).click({i: i}, function (event) {
                UnMarkItemReadLater(event.data.i);
                return false;
            });
            //ClickBuilder(feedMarkRead, "UnMarkItemReadLater(" + i + ");");
        } else {
            $(feedMarkRead).click({itemID: itemID}, function (event) {
                MarkItemRead(event.data.itemID);
                return false;
            });
            //ClickBuilder(feedMarkRead, "MarkItemRead(\"" + itemID + "\");");
        }

        feedMarkRead.title = "Mark read";
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
        //ClickBuilder(feedLink, "LinkProxy('" + item.url + "');return false;");

        if (feedID == bgPage.readLaterFeedID) {
            if (options.readlaterremovewhenviewed) {
                $(feedLink).click({i: i}, function (event) {
                    UnMarkItemReadLater(event.data.i);
                    return false;
                });
                //ClickBuilder(feedLink, "UnMarkItemReadLater(" + i + ");");
            }
        } else {
            $(feedLink).click({feedID: feedID, itemID: itemID}, function (event) {
                MarkItemRead(event.data.itemID);
                if (options.markreadonclick) {
                    MarkFeedRead(event.data.feedID);
                }
                return false;
            });
            //ClickBuilder(feedLink, "MarkItemRead(\"" + itemID + "\");if(options.markreadonclick){MarkFeedRead(" + feedID + ");}");
        }

        feedTitle = document.createElement("h2");
        feedTitle.setAttribute("class", "feedPreviewTitle");
        feedTitle.appendChild(feedMarkRead);

        if (options.readlaterenabled && feedID != bgPage.readLaterFeedID) {
            feedReadLater = document.createElement("img");
            feedReadLater.setAttribute("src", "star.gif");
            feedReadLater.setAttribute("class", "feedPreviewReadLater");
            feedReadLater.setAttribute("title", "Read later");
            $(feedReadLater).click({feedID: feedID, i: i}, function (event) {
                MarkItemReadLater(event.data.feedID, event.data.i);
                return false;
            });
            //ClickBuilder(feedReadLater, "MarkItemReadLater(\"" + feedID + "\", " + i + ");");      
            feedTitle.appendChild(feedReadLater);
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
        feedSummary.innerHTML = item.content.replace(/style/g, 'sty&#108;e').replace(/width/g, 'w&#105;dth');

        feedContainer = document.createElement("div");
        feedContainer.setAttribute("id", "item_" + feedID + "_" + itemID);


        if (bgPage.unreadInfo[feeds[selectedFeedKey].id] != null && bgPage.unreadInfo[feeds[selectedFeedKey].id].readitems != null && bgPage.unreadInfo[feeds[selectedFeedKey].id].readitems[itemID] != null) {
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
            //ClickBuilder(summaryLinks[l], "LinkProxy('" + href + "');return false;");

            if (feedID == bgPage.readLaterFeedID) {
                if (options.readlaterremovewhenviewed) {
                    $(summaryLinks[l]).click({i: i}, function (event) {
                        UnMarkItemReadLater(event.data.i);
                        return false;
                    });
                    //ClickBuilder(summaryLinks[l], "UnMarkItemReadLater(" + i + ");");
                }
            } else {
                $(summaryLinks[l]).click({itemID: itemID}, function (event) {
                    MarkItemRead(event.data.itemID);
                    return false;
                });
                //ClickBuilder(summaryLinks[l], "MarkItemRead(\"" + itemID + "\");");
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

function ShowFeedError(message) {
    document.getElementById("feedError").style.display = "";
    document.getElementById("feedErrorMessage").innerText = message;
    document.getElementById("headerMessage").innerText = "Feed Problems";
}

// since we have multiple click events, this should allow us
// to build them easily
function ClickBuilder(el, newFunction) {
    var obj = $(el);
    var clickEvents = obj.data("clickEvents");

    if (clickEvents == undefined) {
        clickEvents = "";
    }

    clickEvents = clickEvents + newFunction;

    if (/return false/i.test(clickEvents)) {
        clickEvents = clickEvents.replace(/return false;/i, "") + "return false;";
    }

    // hack  
    obj
        .data('clickEvents', clickEvents)
        .unbind('click')
        .bind('click', function () {
            $.globalEval($(this).data('clickEvents'));
        });

    return;
}

// central function to control creation of tabs so we can put them in the background
function LinkProxy(uRL) {
    chrome.tabs.create({url: uRL, selected: !bgPage.options.loadlinksinbackground});
}






