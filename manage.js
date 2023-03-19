var lastBadRow = null;

$(document).ready(function()
{
	$('#save').click(function(){Save();});
	$('#add').click(function(){Add();});
});

document.documentElement.setAttribute('lang', GetMessageText('lang'));

window.onload = ShowFeeds;

function Add()
{
	let title = document.getElementById("newTitle").value;
	let url = document.getElementById("newUrl").value;
	let group = document.getElementById("newGroup").value;
	let maxItems = document.getElementById("newMaxItems").value;
	let order = document.getElementById("newOrder").value;
	let excludeUnreadCount = document.getElementById("newExcludeUnreadCount").selectedIndex;
	let maxOrder = 0;
	let itemOrder = 0;

	if(!IsValid(title, url, group, maxItems, order)) {
		return;
	}

	AddRow(feeds.push(CreateNewFeed(title, url, group, maxItems, order, excludeUnreadCount)) - 1);

	for(let feedKey in feeds) {
		itemOrder = parseInt(feeds[feedKey].order, 10);

		if(itemOrder > maxOrder) {
			maxOrder = itemOrder;
		}
	}

	document.getElementById("newOrder").value = maxOrder + 1;
	document.getElementById("newTitle").value = "";
	document.getElementById("newUrl").value = "";
	document.getElementById("newGroup").value = "";
	document.getElementById("newMaxItems").value = options.maxitems;
	document.getElementById("newExcludeUnreadCount").selectedIndex = 0;

}

function IsValid(title, url, group, maxItems, order)
{
	if(title == "") {
		alert(GetMessageText("manageAlertTitle"));
		return false;
	}

	if(url == "") {
		alert(GetMessageText("manageAlertUrl"));
		return false;
	}

	if(maxItems == "") {
		alert(GetMessageText("manageAlertMaxItemsEmpty"));
		return false;
	}

	if(maxItems == "0") {
		alert(GetMessageText("manageAlertMaxItemsZero"));
		return false;
	}

	if(!/^\d+$/.test(maxItems)) {
		alert(GetMessageText("manageAlertMaxItemsNotItem1") + maxItems + GetMessageText("manageAlertMaxItemsNotItem2"));
		return false;
	}

	if (order == null) {
		return true;
	}

	if (order == "") {
		alert(GetMessageText("manageAlertOrder"));
		return false;
	}

	if(!/^\d+$/.test(order)) {
		alert(GetMessageText("manageAlertOrderNotItem1") + order + GetMessageText("manageAlertOrderNotItem2"));
		return false;
	}

	return true;
}

function AddRow(feedKey)
{
	let grid;
	let row;
	let input;
	let button;
	let optionon;
	let optionoff;

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

	optionoff = document.createElement("option");
	optionoff.value = 0;
	optionoff.text = GetMessageText("optionOff");

 	optionon = document.createElement("option");
	optionon.value = 1;
	optionon.text = GetMessageText("optionOn");

	select = document.createElement('select');
	select.setAttribute("id", "excludeUnreadCount");
	select.appendChild(optionoff);
	select.appendChild(optionon);
	select.selectedIndex = feeds[feedKey].excludeUnreadCount;

	row.insertCell(5).appendChild(select);

	button = document.createElement("img");
	button.setAttribute("src", "x_gray.png");
	button.setAttribute("class", "delete");

	$(button).click({id:feedKey}, function(event) {
		MarkDelete($('#' + event.data.id).get(0));
	});
	button.setAttribute("title", "Delete feed");
	row.insertCell(6).appendChild(button);
}

function MarkDelete(row)
{
	var marked = (row.className == "markDelete");

	if(!marked)	{
		row.setAttribute("class", "markDelete");
	} else {
		if(row != lastBadRow) {
			row.setAttribute("class", "");
		} else {
			row.setAttribute("class", "badRow");
		}
	}

	row.childNodes[0].childNodes[0].disabled = !marked; // title
	row.childNodes[1].childNodes[0].disabled = !marked; // url
	row.childNodes[2].childNodes[0].disabled = !marked; // group
	row.childNodes[3].childNodes[0].disabled = !marked; // max items
	row.childNodes[4].childNodes[0].disabled = !marked; // order
	row.childNodes[5].childNodes[0].disabled = !marked; // excludeUnreadCount

}

function Save()
{
	var row = null;
	var title;
	var url;
	var group;
	var maxItems;
	var order;
	var excludeUnreadCount;

	if (lastBadRow != null && lastBadRow.className != "markDelete") {
		lastBadRow.className = "";
	}

	for(feedKey in feeds) {
		if (feeds[feedKey].id != readLaterFeedID) {
			row = document.getElementById(feedKey);

			title = row.childNodes[0].childNodes[0].value;
			url = row.childNodes[1].childNodes[0].value;
			group = row.childNodes[2].childNodes[0].value;
			maxItems = row.childNodes[3].childNodes[0].value;
			order = row.childNodes[4].childNodes[0].value;
			excludeUnreadCount = row.childNodes[5].childNodes[0].selectedIndex;

			if(row.className != "markDelete" && !IsValid(title, url, group, maxItems, order)) {
				row.className = "badRow";
				lastBadRow = row;
				return;
			}

			feeds[feedKey].title = title;
			feeds[feedKey].url = url;
			feeds[feedKey].group = group;
			feeds[feedKey].maxitems = maxItems;
			feeds[feedKey].order = order;
			feeds[feedKey].excludeUnreadCount = excludeUnreadCount;
		}
	}

	// delete feeds that are marked, start from end so indexes don't get screwed up
	for(var i = feeds.length - 1; i >= 0; i--) {
		row = document.getElementById(i);
		if (row != undefined) {
			if(row.className == "markDelete") {
				feeds.splice(i, 1);
			}
		}
	}

	var resultPromise = store.setItem('feeds', feeds.filter(filterByID)).then(function(data){
		GetUnreadCounts();
		CleanUpUnreadOrphans();
	});

	resultPromise.then(function(){
		chrome.runtime.sendMessage({"type": "refreshFeeds" }).then(function(){
			window.location = chrome.runtime.getURL("viewer.html");
		});
	});
}

function ShowFeeds()
{
	var maxOrder = 0;
	var itemOrder = 0;

	GetFeedsSimple(function(feeds) {
		for(feedKey in feeds) {
			// skip read later feed
			if (feeds[feedKey].id != readLaterFeedID) {
				AddRow(feedKey);
				itemOrder = parseInt(feeds[feedKey].order, 10);

				if(itemOrder > maxOrder) {
					maxOrder = itemOrder;
				}
			}
		}

		document.getElementById("newOrder").value = maxOrder + 1;
		waitOptionReady().then(function () {
			if (options.darkmode) {
				activeDarkMode();
			} else {
				disableDarkMode();
			}
			document.getElementById("newMaxItems").value = options.maxitems;
		});
	});
}
