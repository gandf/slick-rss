
var bgPage = chrome.extension.getBackgroundPage();

$(document).ready(function()
{
	$('#close').click(function(){window.close();});

	ExportFeeds();
});

// imports opml -> feed list
function ExportFeeds()
{
    var opml = "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?><opml version=\"2.0\">\n<head><title>" + GetMessageText("exportLinkTitle") + "</title></head>\n<body>";

	    for(var i = 0; i < bgPage.feeds.length;i++)
	    {
	        if (bgPage.feeds[i].id != bgPage.readLaterFeedID)
	            opml += "<outline type=\"rss\" text=\"" + bgPage.feeds[i].title.replaceAll("&", "&amp;") + "\" xmlUrl=\"" + bgPage.feeds[i].url.replaceAll("&", "&amp;") + "\" group=\"" + bgPage.feeds[i].group.replaceAll("&", "&amp;") + "\"/>\n";
	    }

	    opml += "</body>\n</opml>";

	    document.getElementById("opml").innerText = opml;
}
