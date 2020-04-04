
var bgPage = chrome.extension.getBackgroundPage();

$(document).ready(function()
{
	$('#import').click(function(){Import();});
	$('#cancel').click(function(){window.close();});
});

// starts import
function Import()
{
    if(document.getElementById("opml").value == "")
    {
        alert("Nothing to import");
        return;
    }

    if(bgPage.options.feedsource == 1)
    {
        chrome.bookmarks.get(bgPage.options.feedfolderid, ImportBookmarks);
    }
    else
    {
        ImportFeeds();
    }
}

// imports opml -> bookmarks
function ImportBookmarks(startNode)
{
    var nodes = null;
    var importCount = 0;
    var opml = new DOMParser().parseFromString(document.getElementById("opml").value, 'text/xml');

    if(!startNode || startNode.length == 0)
    {
        alert("Could not import because your bookmark folder is not found.");
        return;
    }

    nodes = opml.getElementsByTagName("outline");

    for(var i = 0;i < nodes.length;i++)
    {
        if(nodes[i].getAttribute("type") == "rss")
        {
            chrome.bookmarks.create({parentId: startNode[0].id, "title" : nodes[i].getAttribute("text"), "url" : nodes[i].getAttribute("xmlUrl")}, null);
            importCount ++;
        }
    }

    if(nodes.length == 0)
    {
        alert("No outline nodes of type 'rss' were found to import.");
        return;
    }

    alert("Imported " + importCount + " feeds.");

    window.close();
}

//remove ReadLater
function filterByID(obj) {
  if (obj.id != bgPage.readLaterFeedID) {
    return true;
  } else {
    return false;
  }
}

// imports opml -> feed list
function ImportFeeds()
{
    var nodes = null;
    var importCount = 0;
    var maxOrder = 0;
    var opml = new DOMParser().parseFromString(document.getElementById("opml").value, 'text/xml');

    nodes = opml.getElementsByTagName("outline");

    // get max order
    for(var i = 0;i < bgPage.feeds.length; i++)
    {
        if(bgPage.feeds[i].order > maxOrder)
        {
            maxOrder = bgPage.feeds[i].order;
        }
    }

    for(var i = 0;i < nodes.length; i++)
    {
        if(nodes[i].getAttribute("type") == "rss")
        {
            maxOrder ++;
            bgPage.feeds.push(bgPage.CreateNewFeed(nodes[i].getAttribute("text"), nodes[i].getAttribute("xmlUrl"), bgPage.options.maxitems, maxOrder));
            importCount ++;
        }
    }

    if(nodes.length == 0)
    {
        alert("No outline nodes of type 'rss' were found to import.");
        return;
    }

		//remove ReadLater
		localStorage["feeds"] = JSON.stringify(bgPage.feeds.filter(filterByID));
    alert("Imported " + importCount + " feeds.");

    bgPage.ReloadViewer();

    window.close();
}
