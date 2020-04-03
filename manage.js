
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
    var maxItems = document.getElementById("newMaxItems").value;
    var order = document.getElementById("newOrder").value;
    var key = null;
    var maxOrder = 0;
    var itemOrder = 0;
    
    if(!IsValid(title, url, maxItems, order))
    {
        return;
    }
    
    AddRow(feeds.push(bgPage.CreateNewFeed(title, url, maxItems, order)) - 1);    
    
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
    
}

function IsValid(title, url, maxItems, order)
{

    if(title == "")
    {
        alert("A title is required.  Name it something useful like 'My Awesome Gaming News Feed'.");
        return false;        
    }
    
    if(url == "")
    {
        alert("A URL is required.  It's the full HTTP path to your feed.");
        return false;
    }
    
    if(maxItems == "")
    {
        alert("Max items is required.  It's the max number of items you want me to show you for this feed.");
        return false;
    }
    
    if(maxItems == "0")
    {
        alert("Ha ha funny person.  You need at least 1 max item in order to show you a feed.");
        return false;
    }   
    
    if(!/^\d+$/.test(maxItems))
    {
        alert("Very funny, you and I both know '" + maxItems + "' isn't a value max item number.");
        return false;
    }
    
    if(order == "")
    {
        alert("Order is required.  It's the order I'll display your feeds in the viewer.");
        return false;
    }
    
    if(!/^\d+$/.test(order))
    {
        alert("Very funny, you and I both know '" + order + "' isn't a value order.");
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
    input.setAttribute("class", "maxItems");
    input.setAttribute("value", feeds[feedKey].maxitems);
    
    row.insertCell(2).appendChild(input);
    
    input = document.createElement('input');
    input.setAttribute("type", "text");
    input.setAttribute("class", "order");
    input.setAttribute("value", feeds[feedKey].order);
    
    row.insertCell(3).appendChild(input);
    
    button = document.createElement("img");
    button.setAttribute("src", "x.gif");
    button.setAttribute("class", "delete");
    
    //var tmp = this.parentNode.parentNode;
    
    $(button).click({id:feedKey}, function(event)
    {	    		
    		MarkDelete($('#' + event.data.id).get(0));
    });
    //button.setAttribute("onclick", "MarkDelete(this.parentNode.parentNode);");
    button.setAttribute("title", "Delete feed");
    row.insertCell(4).appendChild(button);
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
    row.childNodes[2].childNodes[0].disabled = !marked; // max items
    row.childNodes[3].childNodes[0].disabled = !marked; // order

}

function Save()
{    
    var row = null;
    var title;
    var url;
    var maxItems;
    var order;
    
    if(lastBadRow != null && lastBadRow.className != "markDelete")
    {
        lastBadRow.className = "";
    }
    
    for(feedKey in feeds)
    {
        // skip read later feed
        if(feedKey == 0)
        {
            continue;
        }
        
        row = document.getElementById(feedKey);        
        
        title = row.childNodes[0].childNodes[0].value;
        url = row.childNodes[1].childNodes[0].value;
        maxItems = row.childNodes[2].childNodes[0].value;
        order = row.childNodes[3].childNodes[0].value;            
        
        if(row.className != "markDelete" && !IsValid(title, url, maxItems, order))
        {
            row.className = "badRow";
            lastBadRow = row;
            return;
        }
        
        feeds[feedKey].title = title;
        feeds[feedKey].url = url;
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
    
    localStorage["feeds"] = JSON.stringify(feeds);  
 
    bgPage.UpdateSniffer();
    bgPage.CleanUpUnreadOrphans();
    
    // get feeds to re-order the feeds
    bgPage.GetFeeds(function()
    {
        bgPage.CheckForUnreadStart();
        window.location = 'viewer.html';  
    });
}

function ShowFeeds()
{
    var maxOrder = 0;
    var itemOrder = 0;    
    
    for(feedKey in feeds)
    {
        // skip read later feed
        if(feedKey == 0)
        {
            continue;
        }
        
        AddRow(feedKey);
        itemOrder = parseInt(feeds[feedKey].order);
        
        if(itemOrder > maxOrder)
        {
            maxOrder = itemOrder;
        }
    }
    
    document.getElementById("newOrder").value = maxOrder + 1;
    document.getElementById("newMaxItems").value = options.maxitems;
}

