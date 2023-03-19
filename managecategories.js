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

	AddRow(listCategories.push(CreateNewCat(category, color)) - 1);

	document.getElementById("newCategory").value = "";
	document.getElementById("newColor").value = "#659DD8";
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
	input.setAttribute("type", "color");
	input.setAttribute("class", "color");
	if (listCategories[key].color == "") {
		input.setAttribute("value", "#659DD8");
	} else {
		input.setAttribute("value", listCategories[key].color);
	}

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
	let catList = [];

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
		}
		if(row.className != "markDelete") {
			if (color.toUpperCase() != "#659DD8") {
				catList.push({category: category, color: color});
			}
		}
	}
	chrome.runtime.sendMessage({"type": "saveCategories", "data": GetStrFromObject(catList)}).then(function(){
		window.location = chrome.runtime.getURL("viewer.html");
	});
}
