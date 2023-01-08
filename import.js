
$(document).ready(function()
{
	$('#import').click(function(){Import();});
	$('#cancel').click(function(){window.close();});
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

				feeds.push(CreateNewFeed(nodes[i].getAttribute("text"), nodes[i].getAttribute("xmlUrl"), group, options.maxitems, maxOrder, excludeUnreadCount));
				importCount ++;
			}
		}

		if(nodes.length == 0)
		{
			alert(GetMessageText("importAlertNoOutlineRss"));
			return;
		}

		//remove ReadLater
		if (feeds.filter(filterByID).length > 0) {
			let resultPromise = store.setItem('feeds', feeds.filter(filterByID)).then(function(data){
				alert(GetMessageText("importAlertImportedFeeds1") + importCount + GetMessageText("importAlertImportedFeeds2"));
			});
			resultPromise.then(function(){
				chrome.runtime.sendMessage({"type": "checkForUnread"}).then(function(){
					window.close();
			 	});
			});
		}
	});
}
