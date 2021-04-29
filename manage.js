
var bgPage = chrome.extension.getBackgroundPage();
var options = bgPage.options;
var feeds = bgPage.feeds;
var lastBadRow = null;

$(document).ready(function()
{
	$('#save').click(function(){Save();});
	$('#add').click(function(){Add();});
});

window.onload = ShowFeeds;

function Add()
{
    var title = document.getElementById("newTitle").value;
    var url = document.getElementById("newUrl").value;
		var group = document.getElementById("newGroup").value;
    var maxItems = document.getElementById("newMaxItems").value;
    var order = document.getElementById("newOrder").value;
    var key = null;
    var maxOrder = 0;
    var itemOrder = 0;

    if(!IsValid(title, url, group, maxItems, order))
    {
        return;
    }

    AddRow(feeds.push(bgPage.CreateNewFeed(title, url, group, maxItems, order)) - 1);

    for(feedKey in feeds)
    {
        itemOrder = parseInt(feeds[feedKey].order);

        if(itemOrder > maxOrder)
        {
            maxOrder = itemOrder;
        }
    }

    document.getElementById("newOrder").value = maxOrder + 1;
    document.getElementById("newTitle").value = "";
    document.getElementById("newUrl").value = "";
		document.getElementById("newGroup").value = "";

}

function IsValid(title, url, group, maxItems, order)
{

    if(title == "")
    {
        alert(GetMessageText(manageAlertTitle));
        return false;
    }

    if(url == "")
    {
        alert(GetMessageText(manageAlertUrl));
        return false;
    }

    if(maxItems == "")
    {
        alert(GetMessageText(manageAlertMaxItemsEmpty));
        return false;
    }

    if(maxItems == "0")
    {
        alert(GetMessageText(manageAlertMaxItemsZero));
        return false;
    }

    if(!/^\d+$/.test(maxItems))
    {
        alert(GetMessageText(manageAlertMaxItemsNotItem1) + maxItems + GetMessageText(manageAlertMaxItemsNotItem2));
        return false;
    }

    if(order == "")
    {
        alert(GetMessageText(manageAlertOrder));
        return false;
    }

    if(!/^\d+$/.test(order))
    {
        alert(GetMessageText(manageAlertOrderNotItem1) + order + GetMessageText(manageAlertOrderNotItem2));
        return false;
    }

    return true;
}

function AddRow(feedKey)
{
    var grid = null;
    var row = null;
    var input = null;
    var button = null;

    grid = document.getElementById("feedGrid");
    row = grid.insertRow(grid.rows.length);
    row.setAttribute("id", feedKey);

    input = document.createElement('input');
    input.setAttribute("type", "text");
    input.setAttribute("class", "title");
    input.setAttribute("value", feeds[feedKey].title);

    row.insertCell(0).appendChild(input);

    input = document.createElement('input');
    input.setAttribute("type", "text");
    input.setAttribute("class", "url");
    input.setAttribute("value", feeds[feedKey].url);

    row.insertCell(1).appendChild(input);

		input = document.createElement('input');
    input.setAttribute("type", "text");
    input.setAttribute("class", "group");
    input.setAttribute("value", feeds[feedKey].group);

    row.insertCell(2).appendChild(input);

    input = document.createElement('input');
    input.setAttribute("type", "text");
    input.setAttribute("class", "maxItems");
    input.setAttribute("value", feeds[feedKey].maxitems);

    row.insertCell(3).appendChild(input);

    input = document.createElement('input');
    input.setAttribute("type", "text");
    input.setAttribute("class", "order");
    input.setAttribute("value", feeds[feedKey].order);

    row.insertCell(4).appendChild(input);

    button = document.createElement("img");
    button.setAttribute("src", "x_gray.gif");
    button.setAttribute("class", "delete");

    //var tmp = this.parentNode.parentNode;

    $(button).click({id:feedKey}, function(event)
    {
    		MarkDelete($('#' + event.data.id).get(0));
    });
    //button.setAttribute("onclick", "MarkDelete(this.parentNode.parentNode);");
    button.setAttribute("title", "Delete feed");
    row.insertCell(5).appendChild(button);
}

function MarkDelete(row)
{
    var marked = (row.className == "markDelete");

    if(!marked)
    {
        row.setAttribute("class", "markDelete");
    }
    else
    {
        if(row != lastBadRow)
        {
            row.setAttribute("class", "");
        }
        else
        {
            row.setAttribute("class", "badRow");
        }
    }

    row.childNodes[0].childNodes[0].disabled = !marked; // title
    row.childNodes[1].childNodes[0].disabled = !marked; // url
		row.childNodes[2].childNodes[0].disabled = !marked; // group
    row.childNodes[3].childNodes[0].disabled = !marked; // max items
    row.childNodes[4].childNodes[0].disabled = !marked; // order

}

function Save()
{
    var row = null;
    var title;
    var url;
		var group;
    var maxItems;
    var order;

    if(lastBadRow != null && lastBadRow.className != "markDelete")
    {
        lastBadRow.className = "";
    }

    for(feedKey in feeds)
    {
        // skip read later feed
        if (feedKey == 0)
        {
            continue;
        }

        row = document.getElementById(feedKey);

        title = row.childNodes[0].childNodes[0].value;
        url = row.childNodes[1].childNodes[0].value;
        group = row.childNodes[2].childNodes[0].value;
        maxItems = row.childNodes[3].childNodes[0].value;
        order = row.childNodes[4].childNodes[0].value;

        if(row.className != "markDelete" && !IsValid(title, url, group, maxItems, order))
        {
            row.className = "badRow";
            lastBadRow = row;
            return;
        }

        feeds[feedKey].title = title;
        feeds[feedKey].url = url;
				feeds[feedKey].group = group;
        feeds[feedKey].maxitems = maxItems;
        feeds[feedKey].order = order;
    }

    // delete feeds that are marked, start from end so indexes don't get screwed up
    for(i = feeds.length - 1;i > 0;i--)
    {
        row = document.getElementById(i);

        if(row.className == "markDelete")
        {
            feeds.splice(i, 1);
        }
    }

    // remove read later feed
    feeds.splice(0,1);

		var resultPromise = store.setItem('feeds', feeds).then(function(data){
			bgPage.CleanUpUnreadOrphans();
		});

		resultPromise.then(function(){
			// get feeds to re-order the feeds
	    bgPage.GetFeeds(function()
	    {
	        bgPage.CheckForUnreadStart();
	        window.location = chrome.extension.getURL("viewer.html");
	    });
		});
}

function ShowFeeds()
{
    var maxOrder = 0;
    var itemOrder = 0;

    for(feedKey in feeds)
    {
        // skip read later feed
				if (feeds[feedKey].id != bgPage.readLaterFeedID)
				{
					AddRow(feedKey);
	        itemOrder = parseInt(feeds[feedKey].order);

	        if(itemOrder > maxOrder)
	        {
	            maxOrder = itemOrder;
	        }
				}
    }

    document.getElementById("newOrder").value = maxOrder + 1;
    document.getElementById("newMaxItems").value = bgPage.options.maxitems;
}
