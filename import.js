document.addEventListener('DOMContentLoaded', function()
{
	document.getElementById('import').addEventListener('click', function() {
		Import();
	});
	document.getElementById('close').addEventListener('click', function() {
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

// starts import
function Import()
{
	if(document.getElementById("opml").value == "")
	{
		alert(GetMessageText("importAlertNothing"));
		return;
	}

	ImportFeeds();
}

// imports opml -> feed list
function ImportFeeds()
{
	let nodes = null;
	let importCount = 0;
	let maxOrder = 0;
	let xmldata = document.getElementById("opml").value;
	let opml = JXON.stringToXml(xmldata);

	nodes = opml.getElementsByTagName("outline");

	GetFeedsSimple(function(feeds)
	{
		// get max order
		for(let i = 0;i < feeds.length; i++)
		{
			if(feeds[i].order > maxOrder)
			{
				maxOrder = feeds[i].order;
			}
		}

		let feedsToImport = [];
		for(let i = 0;i < nodes.length; i++)
		{
			if(nodes[i].getAttribute("type") == "rss")
			{
				maxOrder ++;
				let group = nodes[i].getAttribute("group");
				if (group == null)
				{
					group = "";
				}

				let excludeUnreadCount = nodes[i].getAttribute("excludeUnreadCount");
				if (excludeUnreadCount == null)
				{
					excludeUnreadCount = 0;
				}
				else {
					excludeUnreadCount = parseInt(excludeUnreadCount, 10);
					if (isNaN(excludeUnreadCount)) {
						excludeUnreadCount = 0;
					}
				}

				let url = nodes[i].getAttribute("xmlUrl");
				if ((url != undefined) && (url != "") && (url != null))
				{
					if (!feeds.some(feed => feed.url === url)) {
						if (!feedsToImport.some(feed => feed.url === url)) {
							feedsToImport.push(CreateNewFeed(nodes[i].getAttribute("text"), url, group, options.maxitems, maxOrder, excludeUnreadCount));
							importCount++;
						}
					}
				}
			}
		}

		if(nodes.length == 0)
		{
			alert(GetMessageText("importAlertNoOutlineRss"));
			return;
		}

		let requests = [];
		let feedids = [];
		let feedfiltered = feedsToImport.filter(filterByID);
		
		for (let i = 0; i < feedfiltered.length; i++) {
			let feed = feedfiltered[i];
			let feedid = parseInt(feed.id, 10);
			if (!feedids.includes(feedid)) {
				requests.push({type: 'addFeed', waitResponse: false, data: feed });
				feedids.push(feedid);
			}
		}
		if (requests.length > 0) {
			requests.push({type: 'export', responsetype: 'responseExport', tableName: 'Group', waitResponse: true, subtype: 'Group' });
			requests.push({type: 'export', responsetype: 'responseExport', tableName: 'Feeds', waitResponse: true, subtype: 'Feeds' });
			sendtoSQL('requests', 'Import', true, { requests: requests }, function(){
				alert(GetMessageText("importAlertImportedFeeds1") + importCount + GetMessageText("importAlertImportedFeeds2"));
				chrome.runtime.sendMessage({"type": "checkForUnread"}).then(function(){
					window.close();
			 	});
			});
		} else {
			alert(GetMessageText("importAlertNothing"));
		}
	});
}
