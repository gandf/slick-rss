
// wire stuff to prevent XSS :(
$(document).ready(function()
{
	$('#save').click(function(){Save();});
	$('#cancel').click(function(){window.close();});
	$('#importFeeds').click(function(){window.open(chrome.extension.getURL("import.html"), 'height=250,width=550');});
	$('#exportFeeds').click(function(){window.open(chrome.extension.getURL("export.html"), 'height=250,width=550');});
	$('#dateDone').click(function(){ShowDateSample(true);});
	$('#dateFormat').focus(function(){EditDateFormat();});

});

var bgPage = chrome.extension.getBackgroundPage();

window.onload = SetupScreen;

function SetupScreen()
{
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
		document.getElementById("enablePlaySound").selectedIndex = bgPage.options.playSoundNotif;
    document.getElementById("columns").selectedIndex = bgPage.options.columns - 1;
    document.getElementById("readLaterEnabled").selectedIndex = bgPage.options.readlaterenabled;
    document.getElementById("readLaterRemoveWhenViewed").selectedIndex = bgPage.options.readlaterremovewhenviewed;
    document.getElementById("readLaterIncludeTotal").selectedIndex = bgPage.options.readlaterincludetotal;
    document.getElementById("loadLinksInBackground").selectedIndex = bgPage.options.loadlinksinbackground;
		document.getElementById("showAllFeeds").selectedIndex = bgPage.options.showallfeeds;
		document.getElementById("useThumbnail").selectedIndex = bgPage.options.usethumbnail;
		document.getElementById("feedsMaxHeight").value = bgPage.options.feedsmaxheight;

		navigator.storage.estimate().then(({usage, quota}) => {
			document.getElementById("StorageUsageValue").innerHTML = chrome.i18n.getMessage("optionStorageUsageValue1") + formatBytes(usage) + chrome.i18n.getMessage("optionStorageUsageValue2") + formatBytes(quota) + chrome.i18n.getMessage("optionStorageUsageValue3");
	  });

    ShowDateSample(false);
}

function Save()
{
    var maxItems = document.getElementById("maxItems").value;
		var feedsMaxHeight = document.getElementById("feedsMaxHeight").value;

    if(!/^\d+$/.test(maxItems) || maxItems == "0")
    {
        alert(GetMessageText("optionAlertMaxItemsInvalid"));
        return;
    }

    if(!/^\d+$/.test(document.getElementById("checkInterval").value))
    {
        alert(GetMessageText("optionAlertUpdateIntervalInvalid"));
        return;
    }

    if(document.getElementById("checkInterval").value == 0)
    {
        alert(GetMessageText("optionAlertUpdateIntervalSup0"));
        return;
    }

    if(!/^\d+$/.test(document.getElementById("markReadAfter").value))
    {
        alert(GetMessageText("optionAlertMarkFeedReadInvalid"));
        return;
    }

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
		bgPage.options.playSoundNotif = (document.getElementById("enablePlaySound").selectedIndex == 1);
    bgPage.options.columns = document.getElementById("columns")[document.getElementById("columns").selectedIndex].value;
    bgPage.options.readlaterenabled = (document.getElementById("readLaterEnabled").selectedIndex == 1);
    bgPage.options.readlaterremovewhenviewed = (document.getElementById("readLaterRemoveWhenViewed").selectedIndex == 1);
    bgPage.options.readlaterincludetotal = (document.getElementById("readLaterIncludeTotal").selectedIndex == 1);
    bgPage.options.loadlinksinbackground = (document.getElementById("loadLinksInBackground").selectedIndex == 1);
		bgPage.options.showallfeeds = (document.getElementById("showAllFeeds").selectedIndex == 1);
		bgPage.options.usethumbnail = (document.getElementById("useThumbnail").selectedIndex == 1);
		bgPage.options.feedsmaxheight = parseInt(feedsMaxHeight);

		store.setItem('options', bgPage.options);

    if(!bgPage.options.readlaterenabled)
    {
			store.setItem('readlater', {}); //delete readlater
    }

    bgPage.GetFeeds(function()
    {
        bgPage.ReloadViewer();
        bgPage.CheckForUnreadStart();

    });

    window.close();
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
