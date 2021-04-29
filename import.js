
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
        alert(GetMessageText("importAlertNothing"));
        return;
    }

    ImportFeeds();
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
    var xmldata = document.getElementById("opml").value;
    var opml = JXON.stringToXml(xmldata);

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
						var group = nodes[i].getAttribute("group");
						if (group == null)
						{
							group = "";
						}
            bgPage.feeds.push(bgPage.CreateNewFeed(nodes[i].getAttribute("text"), nodes[i].getAttribute("xmlUrl"), group, bgPage.options.maxitems, maxOrder));
            importCount ++;
        }
    }

    if(nodes.length == 0)
    {
        alert(GetMessageText("importAlertNoOutlineRss"));
        return;
    }

		//remove ReadLater
		var resultPromise = store.setItem('feeds', bgPage.feeds.filter(filterByID)).then(function(data){
			alert(GetMessageText("importAlertImportedFeeds1") + importCount + GetMessageText("importAlertImportedFeeds2"));
		});
		resultPromise.then(function(){
			bgPage.ReloadViewer();
		});

		window.close();
}
