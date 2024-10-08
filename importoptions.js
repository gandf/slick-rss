document.addEventListener('DOMContentLoaded', function()
{
	document.getElementById('import').addEventListener('click', function(){
		if(document.getElementById("opml").value == "")
		{
			alert(GetMessageText("importAlertNothing"));
			return;
		}
		let value = document.getElementById("opml").value;

		if (value === null) {
			alert(GetMessageText("importAlertNothing"));
			return;
		}
		if (value === undefined) {
			alert(GetMessageText("importAlertNothing"));
			return "undefined";
		}

		try {
			let optionsToImport = JSON.parse(value);

			if (optionsToImport.playSoundNotif) {
				if (Notification.permission != "granted") {
					chrome.permissions.request({permissions: ['notifications']}, (granted) => {});
				}
			} else  {
				if (Notification.permission == "granted") {
					chrome.permissions.remove({permissions: ['notifications']}, (removed) => {});
				}
			}

			ImportOptions(optionsToImport);
		}
		catch (e) {
			alert(GetMessageText("importAlertError") + e);
		}
	});
	document.getElementById('cancel').addEventListener('click', function() {
		window.close();
	});
});

document.documentElement.setAttribute('lang', GetMessageText('lang'));

waitOptionReady().then(function () {
	if (options.darkmode) {
		activeDarkMode();
	} else {
		disableDarkMode();
	}
});

function ImportOptions(optionsToImport)
{
	GetOptions().then(function() {
		if (optionsToImport.lastversion != undefined) {
			options.lastversion = optionsToImport.lastversion;
		}
		if (optionsToImport.maxitems != undefined) {
			options.maxitems = optionsToImport.maxitems;
		}
		if (optionsToImport.showdescriptions != undefined) {
			options.showdescriptions = optionsToImport.showdescriptions;
		}
		if (optionsToImport.dateformat != undefined) {
			options.dateformat = optionsToImport.dateformat;
		}
		if (optionsToImport.showfeedimages != undefined) {
			options.showfeedimages = optionsToImport.showfeedimages;
		}
		if (optionsToImport.showfeedobjects != undefined) {
			options.showfeedobjects = optionsToImport.showfeedobjects;
		}
		if (optionsToImport.showfeediframes != undefined) {
			options.showfeediframes = optionsToImport.showfeediframes;
		}
		if (optionsToImport.showfeedcontent != undefined) {
			options.showfeedcontent = optionsToImport.showfeedcontent;
		}
		if (optionsToImport.showfeedcontentsummary != undefined) {
			options.showfeedcontentsummary = optionsToImport.showfeedcontentsummary;
		}
		if (optionsToImport.checkinterval != undefined) {
			options.checkinterval = optionsToImport.checkinterval;
		}
		if (optionsToImport.markreadonclick != undefined) {
			options.markreadonclick = optionsToImport.markreadonclick;
		}
		if (optionsToImport.markreadafter != undefined) {
			options.markreadafter = optionsToImport.markreadafter;
		}
		if (optionsToImport.readitemdisplay != undefined) {
			options.readitemdisplay = optionsToImport.readitemdisplay;
		}
		if (optionsToImport.unreaditemtotaldisplay != undefined) {
			options.unreaditemtotaldisplay = optionsToImport.unreaditemtotaldisplay;
		}
		if (optionsToImport.unreadtotaldisplay != undefined) {
			options.unreadtotaldisplay = optionsToImport.unreadtotaldisplay;
		}
		if (optionsToImport.columns != undefined) {
			options.columns = optionsToImport.columns;
		}
		if (optionsToImport.readlaterenabled != undefined) {
			options.readlaterenabled = optionsToImport.readlaterenabled;
		}
		if (optionsToImport.readlaterremovewhenviewed != undefined) {
			options.readlaterremovewhenviewed = optionsToImport.readlaterremovewhenviewed;
		}
		if (optionsToImport.loadlinksinbackground != undefined) {
			options.loadlinksinbackground = optionsToImport.loadlinksinbackground;
		}
		if (optionsToImport.showallfeeds != undefined) {
			options.showallfeeds = optionsToImport.showallfeeds;
		}
		if (optionsToImport.usethumbnail != undefined) {
			options.usethumbnail = optionsToImport.usethumbnail;
		}
		if (optionsToImport.feedsmaxheight != undefined) {
			options.feedsmaxheight = optionsToImport.feedsmaxheight;
		}
		if (optionsToImport.playSoundNotif != undefined) {
			options.playSoundNotif = optionsToImport.playSoundNotif;
		}
		if (optionsToImport.darkmode != undefined) {
			options.darkmode = optionsToImport.darkmode;
		}
		if (optionsToImport.fontSize != undefined) {
			options.fontSize = optionsToImport.fontSize;
		}
		if (optionsToImport.forcelangen != undefined) {
			options.forcelangen = optionsToImport.forcelangen;
		}
		if (optionsToImport.levelSearchTag != undefined) {
			options.levelSearchTag = optionsToImport.levelSearchTag;
		}
		if (optionsToImport.levelSearchTags != undefined) {
			options.levelSearchTags = optionsToImport.levelSearchTags;
		}
		if (optionsToImport.log != undefined) {
			options.log = optionsToImport.log;
		}
		if (optionsToImport.showGetRSSFeedUrl != undefined) {
			options.showGetRSSFeedUrl = optionsToImport.showGetRSSFeedUrl;
		}
		if (optionsToImport.dontreadontitleclick != undefined) {
			options.dontreadontitleclick = optionsToImport.dontreadontitleclick;
		}

		requests = [];
		requests.push({type: 'setOptions', tableName: 'Options', waitResponse: false, subtype: 'Options', data: options });
		requests.push({type: 'export', responsetype: 'responseExport', tableName: 'Options', waitResponse: true, subtype: 'Options' });
		sendtoSQL('requests', 'ImportOptions', true, { requests: requests }, function(){
			chrome.runtime.sendMessage({ type: 'refreshOptionsAndRefreshFeeds', target: 'background' }).then(function(){
				refreshViewerTab();
			});
		});
	});
}
