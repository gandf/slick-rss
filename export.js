document.addEventListener('DOMContentLoaded', function()
{
	document.getElementById('close').addEventListener('click', function() {
		window.close();
	});

	ExportFeeds();
});

document.documentElement.setAttribute('lang', GetMessageText('lang'));

waitOptionReady().then(function () {
	if (options.darkmode) {
		activeDarkMode();
	} else {
		disableDarkMode();
	}
});

// imports opml -> feed list
function ExportFeeds()
{
	let opml = "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?><opml version=\"2.0\">\n<head><title>" + GetMessageText("exportLinkTitle") + "</title></head>\n<body>";

	GetFeedsSimple(function(feeds)
	{
		for(let i = 0; i < feeds.length;i++)
		{
			if (feeds[i].id != readLaterFeedID)
				opml += "<outline type=\"rss\" text=\"" + feeds[i].title.replaceAll("&", "&amp;") + "\" xmlUrl=\"" + feeds[i].url.replaceAll("&", "&amp;") + "\" group=\"" + feeds[i].group.replaceAll("&", "&amp;") + "\" excludeUnreadCount=\"" + feeds[i].excludeUnreadCount + "\"/>\n";
		}

		opml += "</body>\n</opml>";

		document.getElementById("opml").innerText = opml;
	});
}
