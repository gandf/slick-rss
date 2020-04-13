
var bgPage = chrome.extension.getBackgroundPage();

$(document).ready(function()
{
	$('#close').click(function(){window.close();});

	if(bgPage.options.feedsource == 1)
	        chrome.bookmarks.get(bgPage.options.feedfolderid, ExportBookmarks);
	    else
    		ExportFeeds();
});

// exports opml -> bookmarks
function ExportBookmarks(startNode)
{
	chrome.bookmarks.getChildren(startNode[0].id, function(nodes)
	{
	    var opml = "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?><opml version=\"2.0\">\n<head><title>" + GetMessageText("exportLinkTitle") + "</title></head>\n<body>";

	    for(var i = 0; i < nodes.length;i++)
	        opml += "<outline type=\"rss\" text=\"" + nodes[i].title.replace("&", "&amp;") + "\" xmlUrl=\"" + nodes[i].url.replace("&", "&amp;") + "\" group=\"" + nodes[i].group.replace("&", "&amp;") + "\"/>\n";

	    opml += "</body>\n</opml>";

	    document.getElementById("opml").value = opml;
	});
}

// imports opml -> feed list
function ExportFeeds()
{
    var opml = "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?><opml version=\"2.0\">\n<head><title>" + GetMessageText("exportLinkTitle") + "</title></head>\n<body>";

	    for(var i = 0; i < bgPage.feeds.length;i++)
	    {
	        if ((bgPage.feeds[i].id != bgPage.readLaterFeedID) && (bgPage.feeds[i].id != bgPage.allFeedsID))
	            opml += "<outline type=\"rss\" text=\"" + bgPage.feeds[i].title.replace("&", "&amp;") + "\" xmlUrl=\"" + bgPage.feeds[i].url.replace("&", "&amp;") + "\"/>\n";
	    }

	    opml += "</body>\n</opml>";

	    document.getElementById("opml").innerText = opml;
}
