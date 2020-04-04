
// wire stuff to prevent XSS :(
$(document).ready(function()
{
	$('#save').click(function(){Save();});
	$('#cancel').click(function(){window.close();});
	$('#feedSource').change(function(){FeedSourceChanged();});
	$('#importFeeds').click(function(){window.open(chrome.extension.getURL("import.html"), 'height=250,width=550');});
	$('#exportFeeds').click(function(){window.open(chrome.extension.getURL("export.html"), 'height=250,width=550');});
	$('#dateDone').click(function(){ShowDateSample(true);});
	$('#dateFormat').focus(function(){EditDateFormat();});

});

var bgPage = chrome.extension.getBackgroundPage();

window.onload = SetupScreen;

function SetupScreen()
{
    document.getElementById("feedSource").selectedIndex = parseInt(bgPage.options.feedsource);
    FeedSourceChanged(); // changing index doesn't fire onchange :(
    document.getElementById("maxItems").value = bgPage.options.maxitems;
    document.getElementById("showDescriptions").selectedIndex = bgPage.options.showdescriptions;
    document.getElementById("showFeedImages").selectedIndex = bgPage.options.showfeedimages;
    document.getElementById("showFeedObjects").selectedIndex = bgPage.options.showfeedobjects;
    document.getElementById("showFeedIframes").selectedIndex = bgPage.options.showfeediframes;
    document.getElementById("showFeedContent").selectedIndex = bgPage.options.showfeedcontent;
    document.getElementById("checkInterval").value = bgPage.options.checkinterval;
    document.getElementById("markReadAfter").value = bgPage.options.markreadafter;
    document.getElementById("markReadOnClick").selectedIndex = bgPage.options.markreadonclick;
    document.getElementById("readItemDisplay").selectedIndex = bgPage.options.readitemdisplay;
    document.getElementById("unreadTotalDisplay").selectedIndex = bgPage.options.unreadtotaldisplay;
    document.getElementById("unreadItemTotalDisplay").selectedIndex = bgPage.options.unreaditemtotaldisplay;
    document.getElementById("columns").selectedIndex = bgPage.options.columns - 1;
    document.getElementById("readLaterEnabled").selectedIndex = bgPage.options.readlaterenabled;
    document.getElementById("readLaterRemoveWhenViewed").selectedIndex = bgPage.options.readlaterremovewhenviewed;
    document.getElementById("readLaterIncludeTotal").selectedIndex = bgPage.options.readlaterincludetotal;
    document.getElementById("loadLinksInBackground").selectedIndex = bgPage.options.loadlinksinbackground;

    chrome.bookmarks.getTree(FillFolderList);
    ShowDateSample(false);
}

function Save()
{
    var maxItems = document.getElementById("maxItems").value;

    if(!/^\d+$/.test(maxItems) || maxItems == "0")
    {
        alert("'Max Items' seems invalid.  It's the max number of items in a feed preview and should be > 0");
        return;
    }

    if(!/^\d+$/.test(document.getElementById("checkInterval").value))
    {
        alert("'Update Interval' seems invalid.  It's the number of minutes between fetching unread counts.");
        return;
    }

    if(document.getElementById("checkInterval").value == 0)
    {
        alert("'Update Interval' must be > 0.");
        return;
    }

    if(!/^\d+$/.test(document.getElementById("markReadAfter").value))
    {
        alert("'Mark feed read after' seems invalid.  It's the number of seconds after you've viewed a feed before it's marked read.");
        return;
    }

    bgPage.options.feedsource = document.getElementById("feedSource")[document.getElementById("feedSource").selectedIndex].value;
    bgPage.options.feedfolderid = document.getElementById("feedFolderID")[document.getElementById("feedFolderID").selectedIndex].value;
    bgPage.options.maxitems = parseInt(maxItems);
    bgPage.options.showdescriptions = (document.getElementById("showDescriptions").selectedIndex == 1);
    bgPage.options.showfeedimages = (document.getElementById("showFeedImages").selectedIndex == 1);
    bgPage.options.showfeedobjects = (document.getElementById("showFeedObjects").selectedIndex == 1);
    bgPage.options.showfeediframes = (document.getElementById("showFeedIframes").selectedIndex == 1);
    bgPage.options.showfeedcontent = (document.getElementById("showFeedContent").selectedIndex == 1);
    bgPage.options.checkinterval = document.getElementById("checkInterval").value;
    bgPage.options.markreadonclick = (document.getElementById("markReadOnClick").selectedIndex == 1);
    bgPage.options.markreadafter = document.getElementById("markReadAfter").value;
    bgPage.options.readitemdisplay = document.getElementById("readItemDisplay")[document.getElementById("readItemDisplay").selectedIndex].value;
    bgPage.options.unreadtotaldisplay = document.getElementById("unreadTotalDisplay")[document.getElementById("unreadTotalDisplay").selectedIndex].value;
    bgPage.options.unreaditemtotaldisplay = (document.getElementById("unreadItemTotalDisplay").selectedIndex == 1);
    bgPage.options.columns = document.getElementById("columns")[document.getElementById("columns").selectedIndex].value;
    bgPage.options.readlaterenabled = (document.getElementById("readLaterEnabled").selectedIndex == 1);
    bgPage.options.readlaterremovewhenviewed = (document.getElementById("readLaterRemoveWhenViewed").selectedIndex == 1);
    bgPage.options.readlaterincludetotal = (document.getElementById("readLaterIncludeTotal").selectedIndex == 1);
    bgPage.options.loadlinksinbackground = (document.getElementById("loadLinksInBackground").selectedIndex == 1)

    localStorage["options"] = JSON.stringify(bgPage.options);

    if(!bgPage.options.readlaterenabled)
    {
       delete localStorage["readlater"];
    }

    bgPage.GetFeeds(function()
    {
        bgPage.ReloadViewer();
        bgPage.CheckForUnreadStart();

    });

    window.close();
}

// fills the folder dropdown
function FillFolderList(nodes)
{
    var folderList = document.getElementById("feedFolderID");
    var arr = [];
    var option = null;

    GetBookmarkNodes(nodes[0], arr, "");

    for(var i = 0;i < arr.length; i++)
    {
        option = document.createElement("option");
        option.setAttribute("value", arr[i][0]);
        option.innerHTML = arr[i][1];

        if(arr[i][0] == bgPage.options.feedfolderid)
        {
            option.setAttribute("selected", "selected");
        }

        folderList.appendChild(option);
    }
}

// recursively fills array with ids and titles of folders in the bookmark tree
function GetBookmarkNodes(node, arr, depth)
{
    for(var i = 0; i < node.children.length; i++)
    {
        if(node.children[i].url == null)
        {
            var detail = new Array(2);
            detail[0] = node.children[i].id;
            detail[1] = depth + node.children[i].title;
            arr.push(detail);

            GetBookmarkNodes(node.children[i], arr, depth + "&nbsp;&nbsp;&nbsp;");
        }
    }
}

function FeedSourceChanged()
{
    document.getElementById("feedFolder").style.display = (document.getElementById("feedSource").selectedIndex == 0) ? "none" : "";
}

function EditDateFormat()
{
   document.getElementById("dateFormat").value = bgPage.options.dateformat;
   document.getElementById("dateHelp").style.display = "";
   document.getElementById("dateDone").style.display = "";
}

function ShowDateSample(saveDate)
{
    if(saveDate)
    {
        bgPage.options.dateformat = document.getElementById("dateFormat").value;
    }

    document.getElementById("dateFormat").value = bgPage.GetFormattedDate(new Date());
    document.getElementById("dateHelp").style.display = "none";
    document.getElementById("dateDone").style.display = "none";
}
