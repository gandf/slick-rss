
// wire stuff to prevent XSS :(
$(document).ready(function()
{
	$('#save').click(function(){Save();});
	$('#cancel').click(function(){window.close();});
	$('#importFeeds').click(function(){window.open(chrome.runtime.getURL("import.html"), 'height=250,width=550');});
	$('#exportFeeds').click(function(){window.open(chrome.runtime.getURL("export.html"), 'height=250,width=550');});
	$('#dateDone').click(function(){ShowDateSample(true);});
	$('#dateFormat').focus(function(){EditDateFormat();});

});

window.onload = SetupScreen;

function SetupScreen()
{
	waitOptionReady().then(function () {
		if (options.darkmode) {
			activeDarkMode();
		} else {
			disableDarkMode();
		}

		document.getElementById("maxItems").value = options.maxitems;
		document.getElementById("darkMode").selectedIndex = options.darkmode;
		document.getElementById("fontSize").selectedIndex = options.fontSize - 1;
		document.getElementById("showDescriptions").selectedIndex = options.showdescriptions;
		document.getElementById("showFeedImages").selectedIndex = options.showfeedimages;
		document.getElementById("showFeedObjects").selectedIndex = options.showfeedobjects;
		document.getElementById("showFeedIframes").selectedIndex = options.showfeediframes;
		document.getElementById("showFeedContent").selectedIndex = options.showfeedcontent;
		document.getElementById("checkInterval").value = options.checkinterval;
		document.getElementById("markReadAfter").value = options.markreadafter;
		document.getElementById("markReadOnClick").selectedIndex = options.markreadonclick;
		document.getElementById("readItemDisplay").selectedIndex = options.readitemdisplay;
		document.getElementById("unreadTotalDisplay").selectedIndex = options.unreadtotaldisplay;
		document.getElementById("unreadItemTotalDisplay").selectedIndex = options.unreaditemtotaldisplay;
		document.getElementById("enablePlaySound").selectedIndex = options.playSoundNotif;
		document.getElementById("columns").selectedIndex = options.columns - 1;
		document.getElementById("readLaterEnabled").selectedIndex = options.readlaterenabled;
		document.getElementById("readLaterRemoveWhenViewed").selectedIndex = options.readlaterremovewhenviewed;
		document.getElementById("loadLinksInBackground").selectedIndex = options.loadlinksinbackground;
		document.getElementById("showAllFeeds").selectedIndex = options.showallfeeds;
		document.getElementById("useThumbnail").selectedIndex = options.usethumbnail;
		document.getElementById("feedsMaxHeight").value = options.feedsmaxheight;
		document.getElementById("forceLangEn").selectedIndex = options.forcelangen;
		document.getElementById("levelSearchTag").value = options.levelSearchTag;
		document.getElementById("levelSearchTags").value = options.levelSearchTags;
		document.getElementById("notifyWindowType").selectedIndex = options.typeNotify;
		document.getElementById("optionLogInConsole").selectedIndex = options.log;

		var manifestData = chrome.runtime.getManifest();
		document.getElementById("NoVersion").innerHTML = manifestData.version + " " + manifestData.current_locale;
		document.getElementById("appName").innerHTML = manifestData.name;
		document.getElementById("appDescription").innerHTML = manifestData.description;

		navigator.storage.estimate().then(({usage, quota}) => {
			document.getElementById("StorageUsageValue").innerHTML = GetMessageText("optionStorageUsageValue1") + formatBytes(usage) + GetMessageText("optionStorageUsageValue2") + formatBytes(quota) + GetMessageText("optionStorageUsageValue3");
		});

		ShowDateSample(false);
	});
}

function Save()
{
	var maxItems = document.getElementById("maxItems").value;
	var feedsMaxHeight = document.getElementById("feedsMaxHeight").value;
	var levelSearchTag = document.getElementById("levelSearchTag").value;
	var levelSearchTags = document.getElementById("levelSearchTags").value;

	if (levelSearchTag < 4) {
		levelSearchTag = 4;
	}
	if (levelSearchTags < 6) {
		levelSearchTags = 6;
	}

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

	options.maxitems = parseInt(maxItems, 10);
	options.darkmode = (document.getElementById("darkMode").selectedIndex == 1);
	options.showdescriptions = (document.getElementById("showDescriptions").selectedIndex == 1);
	options.fontSize = document.getElementById("fontSize").selectedIndex + 1;
	options.showfeedimages = (document.getElementById("showFeedImages").selectedIndex == 1);
	options.showfeedobjects = (document.getElementById("showFeedObjects").selectedIndex == 1);
	options.showfeediframes = (document.getElementById("showFeedIframes").selectedIndex == 1);
	options.showfeedcontent = (document.getElementById("showFeedContent").selectedIndex == 1);
	options.checkinterval = document.getElementById("checkInterval").value;
	options.markreadonclick = (document.getElementById("markReadOnClick").selectedIndex == 1);
	options.markreadafter = document.getElementById("markReadAfter").value;
	options.readitemdisplay = document.getElementById("readItemDisplay")[document.getElementById("readItemDisplay").selectedIndex].value;
	options.unreadtotaldisplay = document.getElementById("unreadTotalDisplay")[document.getElementById("unreadTotalDisplay").selectedIndex].value;
	options.unreaditemtotaldisplay = (document.getElementById("unreadItemTotalDisplay").selectedIndex == 1);
	options.playSoundNotif = (document.getElementById("enablePlaySound").selectedIndex == 1);
	options.columns = document.getElementById("columns")[document.getElementById("columns").selectedIndex].value;
	options.readlaterenabled = (document.getElementById("readLaterEnabled").selectedIndex == 1);
	options.readlaterremovewhenviewed = (document.getElementById("readLaterRemoveWhenViewed").selectedIndex == 1);
	options.loadlinksinbackground = (document.getElementById("loadLinksInBackground").selectedIndex == 1);
	options.showallfeeds = (document.getElementById("showAllFeeds").selectedIndex == 1);
	options.usethumbnail = (document.getElementById("useThumbnail").selectedIndex == 1);
	options.feedsmaxheight = parseInt(feedsMaxHeight, 10);
	options.forcelangen = (document.getElementById("forceLangEn").selectedIndex == 1);
	options.levelSearchTag = parseInt(levelSearchTag, 10);
	options.levelSearchTags = parseInt(levelSearchTags, 10);
	options.typeNotify = document.getElementById("notifyWindowType").selectedIndex;
	options.log = (document.getElementById("optionLogInConsole").selectedIndex == 1);

	store.setItem('options', options);

	if(!options.readlaterenabled)
	{
		store.setItem('readlater', {}); //delete readlater
	}

	chrome.runtime.sendMessage({"type": "refreshOptionsAndRefreshFeeds"}).then(function(){
		window.close();
	});
}

function EditDateFormat()
{
	document.getElementById("dateFormat").value = options.dateformat;
	document.getElementById("dateHelp").style.display = "";
	document.getElementById("dateDone").style.display = "";
}

function ShowDateSample(saveDate)
{
	if(saveDate)
	{
		options.dateformat = document.getElementById("dateFormat").value;
	}

	document.getElementById("dateFormat").value = GetFormattedDate(new Date());
	document.getElementById("dateHelp").style.display = "none";
	document.getElementById("dateDone").style.display = "none";
}
