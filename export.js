
$(document).ready(function()
{
	$('#close').click(function(){window.close();});

	ExportFeeds();
});

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
    var opml = "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?><opml version=\"2.0\">\n<head><title>" + GetMessageText("exportLinkTitle") + "</title></head>\n<body>";

		GetFeedsSimple(function(feeds)
		{
			for(var i = 0; i < feeds.length;i++)
	    {
	        if (feeds[i].id != readLaterFeedID)
	            opml += "<outline type=\"rss\" text=\"" + feeds[i].title.replaceAll("&", "&amp;") + "\" xmlUrl=\"" + feeds[i].url.replaceAll("&", "&amp;") + "\" group=\"" + feeds[i].group.replaceAll("&", "&amp;") + "\"/>\n";
	    }

	    opml += "</body>\n</opml>";

	    document.getElementById("opml").innerText = opml;
		});
}
