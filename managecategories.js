var lastBadRow = null;
var listCategories = [];

$(document).ready(function()
{
	$('#save').click(function(){Save();});
	$('#add').click(function(){Add();});
});

document.documentElement.setAttribute('lang', GetMessageText('lang'));

waitOptionReady().then(function () {
	if (options.darkmode) {
		activeDarkMode();
	} else {
		disableDarkMode();
	}
});

GetCategoriesListFromWorker();

function GetCategoriesListFromWorker() {
	sendtoSQL('getColors', 'GetCategoriesListFromWorker', true, null, function(data){
		if (data != undefined) {
			listCategories = data;

			for(let key in listCategories) {
				AddRow(key);
			}
		}
	});
}

function Add()
{
	let name = document.getElementById("newCategory").value;
	let color = document.getElementById("newColor").value;

	if(!IsValid(name, color)) {
		return;
	}

	AddRow(listCategories.push(CreateNewCat(name, color)) - 1);

	document.getElementById("newCategory").value = "";
	document.getElementById("newColor").value = "#659DD8";
}

function CreateNewCat(name, color) {
	return {
		name: name,
		color: color,
		id: GetRandomID()
	};
}

function IsValid(name, color)
{
	if(name == "") {
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
	input.setAttribute("value", listCategories[key].name);

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
	let name;
	let color;
	let catList = [];

	if (lastBadRow != null && lastBadRow.className != "markDelete") {
		lastBadRow.className = "";
	}

	let catorder = 0;
	for(let key in listCategories) {
		row = document.getElementById(key);

		name = row.childNodes[0].childNodes[0].value;
		color = row.childNodes[1].childNodes[0].value;
		catorder++;

		if(row.className != "markDelete" && !IsValid(name, color)) {
			row.className = "badRow";
			lastBadRow = row;
		}
		if(row.className != "markDelete") {
			if (color.toUpperCase() != "#659DD8") {
				catList.push({name: name, color: color, order: catorder});
			}
		}
	}

	requests = [];
	requests.push({ type: 'deleteColor', waitResponse: false });
	for (let i = 0; i < catList.length; i++) {
		requests.push({ type: 'addColor', data: { name: catList[i].name, color: catList[i].color, order: catList[i].order }, waitResponse: false });
	}
	requests.push({type: 'export', responsetype: 'responseExport', tableName: 'Colors', waitResponse: true, subtype: 'Colors' });
	sendtoSQL('requests', 'saveCategories', true, { requests: requests }, function(){
		window.location = chrome.runtime.getURL("viewer.html");
	});
}
