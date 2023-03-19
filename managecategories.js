var lastBadRow = null;
var listCategories = [];

$(document).ready(function()
{
	$('#save').click(function(){Save();});
	$('#add').click(function(){Add();});
});

document.documentElement.setAttribute('lang', GetMessageText('lang'));

window.onload = GetCategoriesListFromWorker;

waitOptionReady().then(function () {
	if (options.darkmode) {
		activeDarkMode();
	} else {
		disableDarkMode();
	}
});

function GetCategoriesListFromWorker() {
	chrome.runtime.sendMessage({"type": "listAllCategories"}).then(function (data) {
		if (data != undefined) {
			listCategories = GetObjectFromStr(data);

			for(let key in listCategories) {
				AddRow(key);
			}
		}
	});
}

function Add()
{
	let category = document.getElementById("newCategory").value;
	let color = document.getElementById("newColor").value;

	if(!IsValid(category, color)) {
		return;
	}

	AddRow(listCategories.push(CreateNewCat(category, color)));

	document.getElementById("newCategory").value = "";
	document.getElementById("newColor").value = "";
}

function CreateNewCat(category, color) {
	return {
		category: category,
		color: color,
		id: GetRandomID()
	};
}

function IsValid(category, color)
{
	if(category == "") {
		alert(GetMessageText("manageAlertCategory"));
		return false;
	}

	if(color == "") {
		alert(GetMessageText("manageColor"));
		return false;
	}
	return true;
}

function AddRow(key)
{
	let grid;
	let row;
	let input;
	let button;

	grid = document.getElementById("feedGrid");
	row = grid.insertRow(grid.rows.length);
	row.setAttribute("id", key);

	input = document.createElement('input');
	input.setAttribute("type", "text");
	input.setAttribute("class", "category");
	input.setAttribute("value", listCategories[key].category);

	row.insertCell(0).appendChild(input);

	input = document.createElement('input');
	input.setAttribute("type", "text");
	input.setAttribute("class", "color");
	input.setAttribute("value", listCategories[key].color);

	row.insertCell(1).appendChild(input);

	button = document.createElement("img");
	button.setAttribute("src", "x_gray.png");
	button.setAttribute("class", "delete");

	$(button).click({id:key}, function(event) {
		MarkDelete($('#' + event.data.id).get(0));
	});
	button.setAttribute("category", "Delete category");
	row.insertCell(2).appendChild(button);
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

	row.childNodes[0].childNodes[0].disabled = !marked; // category
	row.childNodes[1].childNodes[0].disabled = !marked; // color
}

function Save()
{
	let row = null;
	let category;
	let color;

	if (lastBadRow != null && lastBadRow.className != "markDelete") {
		lastBadRow.className = "";
	}

	for(let key in listCategories) {
		row = document.getElementById(key);

		category = row.childNodes[0].childNodes[0].value;
		color = row.childNodes[1].childNodes[0].value;

		if(row.className != "markDelete" && !IsValid(category, color)) {
			row.className = "badRow";
			lastBadRow = row;
			return;
		}

		listCategories[key].category = category;
		listCategories[key].color = color;
	}

	// delete feeds that are marked, start from end so indexes don't get screwed up
	for(let i = listCategories.length - 1; i >= 0; i--) {
		row = document.getElementById(i);
		if (row != undefined) {
			if(row.className == "markDelete") {
				feeds.splice(i, 1);
			}
		}
	}
/*
	var resultPromise = store.setItem('feeds', feeds.filter(filterByID)).then(function(data){
		GetUnreadCounts();
		CleanUpUnreadOrphans();
	});*/
/*
	resultPromise.then(function(){
		chrome.runtime.sendMessage({"type": "refreshFeeds" }).then(function(){
			window.location = chrome.runtime.getURL("viewer.html");
		});
	});*/
}
