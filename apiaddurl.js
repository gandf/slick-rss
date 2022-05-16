$(document).ready(function()
{
	$('#close').click(function(){window.close();});
});

window.onload = ShowFeeds;

function IsValid(title, url, group, maxItems)
{
	if(title == "")	{
		alert(GetMessageText("manageAlertTitle"));
		return false;
	}

	if(url == "")	{
		alert(GetMessageText("manageAlertUrl"));
		return false;
	}

	if(maxItems == "")	{
		alert(GetMessageText("manageAlertMaxItemsEmpty"));
		return false;
	}

	if(maxItems == "0")	{
		alert(GetMessageText("manageAlertMaxItemsZero"));
		return false;
	}

	if(!/^\d+$/.test(maxItems))	{
		alert(GetMessageText("manageAlertMaxItemsNotItem1") + maxItems + GetMessageText("manageAlertMaxItemsNotItem2"));
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
	var optionon = null;
	var optionoff = null;

	grid = document.getElementById("feedGrid");
	row = grid.insertRow(grid.rows.length);
	row.setAttribute("id", feedKey);
	row.setAttribute("feedid" + feedKey, feedKey);
	row.setAttribute("rowid", feedKey);

	input = document.createElement('input');
	input.setAttribute("type", "text");
	input.setAttribute("class", "title");
	input.setAttribute("id", "title" + feedKey);
	input.setAttribute("value", feeds[feedKey].title);

	row.insertCell(0).appendChild(input);

	input = document.createElement('input');
	input.setAttribute("type", "text");
	input.setAttribute("class", "url");
	input.setAttribute("id", "url" + feedKey);
	input.setAttribute("value", feeds[feedKey].url);

	row.insertCell(1).appendChild(input);

	input = document.createElement('input');
	input.setAttribute("type", "text");
	input.setAttribute("class", "group");
	input.setAttribute("id", "group" + feedKey);
	input.setAttribute("value", feeds[feedKey].group);

	row.insertCell(2).appendChild(input);

	input = document.createElement('input');
	input.setAttribute("type", "text");
	input.setAttribute("class", "maxItems");
	input.setAttribute("id", "maxItems" + feedKey);
	input.setAttribute("value", feeds[feedKey].maxitems);

	row.insertCell(3).appendChild(input);

	optionoff = document.createElement("option");
	optionoff.value = 0;
	optionoff.text = GetMessageText("optionOff");

 	optionon = document.createElement("option");
	optionon.value = 1;
	optionon.text = GetMessageText("optionOn");

	select = document.createElement('select');
	select.setAttribute("id", "excludeUnreadCount" + feedKey);
	select.appendChild(optionoff);
	select.appendChild(optionon);
	select.selectedIndex = feeds[feedKey].excludeUnreadCount;

	row.insertCell(4).appendChild(select);

	button = document.createElement("button");
	button.setAttribute("id", "add");
	button.setAttribute("data-locale", "add");
	button.innerText = GetMessageText("add");

	$(button).click({id:feedKey}, function(event)
	{
		this.style.display = "none";
		var rowData = document.getElementById("title" + feedKey);
		feeds[feedKey].title = rowData.value;
		rowData = document.getElementById("url" + feedKey);
		feeds[feedKey].url = rowData.value;
		rowData = document.getElementById("group" + feedKey);
		feeds[feedKey].group = rowData.value;
		rowData = document.getElementById("maxItems" + feedKey);
		feeds[feedKey].maxitems = rowData.value;
		rowData = document.getElementById("excludeUnreadCount" + feedKey);
		feeds[feedKey].excludeUnreadCount = rowData.selectedIndex;

		if (IsValid(feeds[feedKey].title, feeds[feedKey].url, feeds[feedKey].group, feeds[feedKey].maxitems)) {
			chrome.runtime.sendMessage({type: "addFeed",  feedData: {title: feeds[feedKey].title, url: feeds[feedKey].url, group: feeds[feedKey].group, maxItems: feeds[feedKey].maxitems, excludeUnreadCount: feeds[feedKey].excludeUnreadCount}}).then(function(){

			});
		}
	});
	row.insertCell(5).appendChild(button);
}

function ShowFeeds()
{
	waitOptionReady().then(function () {
		if (options.darkmode) {
			activeDarkMode();
		} else {
			disableDarkMode();
		}
		var idCount = 0;
		chrome.runtime.sendMessage({"type": "getApiUrlToAdd" }).then(function(data){
			if (data != undefined) {
				var feedsToLoad = GetObjectFromStr(data);
				feedsToLoad.forEach(feedToLoad => {
					feeds.push(CreateNewFeed((feedToLoad.Title == undefined) ? "" : feedToLoad.Title, feedToLoad.Url, (feedToLoad.Group == undefined) ? "" : feedToLoad.Group, options.maxitems, 0, 0, idCount));
					idCount++;
				});
				for(feedKey in feeds)
				{
					AddRow(feedKey);
				}
			}
		});
	});
}
