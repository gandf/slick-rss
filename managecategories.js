var table;
var listdelete = [];
var listCategories = [];

document.addEventListener('DOMContentLoaded', function()
{
	document.getElementById('save').addEventListener('click', function() {
		Save();
	});
});

waitOptionReady().then(function () {
	if (options.darkmode) {
		activeDarkMode();
	} else {
		disableDarkMode();
	}
	document.documentElement.setAttribute('lang', GetMessageText('lang'));
});

var IntegerEditor = function(cell, onRendered, success, cancel) {
	var input = document.createElement("input");

	input.setAttribute("type", "number");
	input.setAttribute("min", "0");
	input.style.width = "100%";
	input.style.boxSizing = "border-box";
	input.value = cell.getValue();
	input.addEventListener("blur", function() {
		var value = input.value;
		if (Number.isInteger(parseInt(value))) {
			success(parseInt(value));
		} else {
			cancel();
		}
	});

	onRendered(function() {
		input.focus();
		input.style.height = "100%";
	});
	return input;
};

var deleteIcon = function(cell, formatterParams, onRendered){
	if (cell.getRow().getData().newcat) {
		return '<button>' + GetMessageText("add") + '</button>';
	} else {
		return '<img src="x_gray.png" class="delete" title="' + GetMessageText("DeleteCategory") + '">';
	}
};

var colorEditor = function(cell, onRendered, success, cancel){
	var input = document.createElement("input");
	input.setAttribute("type", "color");
	input.value = cell.getValue();
	input.addEventListener("change", function(){
		success(input.value);
	});

	onRendered(function(){
		input.focus();
		input.style.cssText = "width:100%; height:100%; padding:0; margin:0; border:none; background:transparent;";
		input.click();
	});
	return input;
};

var colorFormatter = function(cell, formatterParams, onRendered){
    var colorDiv = document.createElement("div");
    colorDiv.style.background = "transparent";
	colorDiv.style.backgroundColor = cell.getValue();
    colorDiv.style.width = "100%";
    colorDiv.style.height = "100%";
	colorDiv.style.padding = "0";
	colorDiv.style.margin = "0";
	colorDiv.style.border = "none";
    return colorDiv;
};

GetCategoriesList();

function GetCategoriesList() {
	sendtoSQL('getColors', 'GetCategoriesList', true, null, function(data){
		if (data != undefined) {
			listCategories = data;
			let listCategoriesreturned = JSON.parse(JSON.stringify(listCategories));

			//Build Tabulator
			table = new Tabulator("#feedGrid-table", {
				height:"90vh",
				addRowPos:"top",
				layout: "fitData",
				index:"name",
				initialSort: [
					{column: "order", dir: "asc"},
					{column: "name", dir: "asc"}
				],
						keybindings:{
					"navNext" : ["13"],
				},
				columns:[
					{title:"", field:"newcat", visible:false},
					{title:"", field:"toadd", visible:false},
					{title:"", field:"id", visible:false},
					{title:GetMessageText("manageCategory"), field:"name", width:200, editor:"input"},
					{title:GetMessageText("manageColor"), field:"color", width:100, editor:colorEditor, formatter: colorFormatter},
					{title:GetMessageText("manageFontColor"), field:"fontColor", width:100, editor:colorEditor, formatter: colorFormatter},
					{title:GetMessageText("manageOrder"), field:"order", editor:IntegerEditor, hozAlign:"center", width:100, headerHozAlign: "center", sorter: "number"},
					{title:"", hozAlign:"center", vertAlign: "middle", formatter:deleteIcon, cssClass:"no-background", cellClick:function(e, cell)
						{
							if (cell.getRow().getData().newcat) {
								//Add categorie
								let rowdata = cell.getRow().getData();
								if ((rowdata.name != undefined) && (rowdata.name != "") && (rowdata.color != undefined) && (rowdata.color != "")) {
									if(!IsValid(rowdata.name, rowdata.color, rowdata.fontColor)) {
										return;
									}
									let orderValues = table.getData().map(function(row) {
										return row.order;
									});
									orderValues = orderValues.filter(function(value) {
										return Number.isInteger(value);
									});
									if (!Number.isInteger(rowdata.order)) {
										let maxOrder;
										if (orderValues.length == 0) {
											maxOrder = 0;
										} else {
											maxOrder = Math.max(...orderValues);
										}
										rowdata.order = maxOrder + 1;
									}
									table.addRow({ id: GetRandomID(), name: rowdata.name, color: rowdata.color, fontColor: rowdata.fontColor, order: rowdata.order, newcat:false, toadd:true }, false);
									cell.getRow().delete();
									if (options.darkmode) {
										table.addRow({ id: undefined, name: undefined, color: "#659DD8", fontColor: "#4D5460", order:undefined, newcat: true, toadd:true });
									} else {
										table.addRow({ id: undefined, name: undefined, color: "#d7e6f8", fontColor: "#0000EE", order:undefined, newcat: true, toadd:true });
									}
								}
							} else {
								//Delete categorie
								let catid = cell.getRow().getData().id;
								if ((catid != undefined) && (catid != null)) {
									listdelete.push(catid);
								}
								cell.getRow().delete();
							}					
						}, headerSort:false, minWidth: 80
					},
				],
				data:listCategoriesreturned
			});
			
			table.on("tableBuilt", function() {
				if (options.darkmode) {
					table.addRow({ id: undefined, name: undefined, color: "#659DD8", fontColor: "#4D5460", order:undefined, newcat: true, toadd: true });
				} else {
					table.addRow({ id: undefined, name: undefined, color: "#d7e6f8", fontColor: "#0000EE", order:undefined, newcat: true, toadd: true });
				}
			});
		}
	});
}

function IsValid(name, color, fontColor)
{
	if(name == "") {
		alert(GetMessageText("manageAlertCategory"));
		return false;
	}
	if(!isValidColor(color)) {
		alert(GetMessageText("manageAlertColor"));
		return false;
	}
	if(!isValidColor(fontColor)) {
		alert(GetMessageText("manageAlertFontColor"));
		return false;
	}
	return true;
}

function isValidColor(Color) {
    var s = new Option().style;
    s.color = Color;
    return s.color !== '';
}

function Save()
{
	let requests = [];
	for(let i = 0; i < listdelete.length; i++) {
		let catid = listdelete[i];
		if ((catid != undefined) && (catid != null)) {
			requests.push({type: 'deleteColor', waitResponse: false, data: { id: catid } });
		}
	}

	let datacats = table.getData();
	for (let i = 0; i < datacats.length; i++) {
		let cat = datacats[i];
		if ((cat.name == undefined) || (cat.name == "") || cat.newcat || (cat.id == undefined)) {
			continue;
		}
		if (!IsValid(cat.name, cat.color, cat.fontColor)) {
			return;
		}
		if (cat.toadd) {
			requests.push({ type: 'addColor', waitResponse: false, data: { id: cat.id, name: cat.name, color: cat.color, fontColor: cat.fontColor, order: cat.order } });
		} else {
			let onecat = listCategories.filter(x => (x.id == cat.id));
			if (onecat.length > 0) {
				onecat = onecat[0];
				if ((onecat.name != cat.name) || (onecat.color != cat.color) || (onecat.fontColor != cat.fontColor) || (onecat.order != cat.order)) {
					requests.push({type: 'modifyColor', waitResponse: false, data: { id: cat.id, name: cat.name, color: cat.color, fontColor: cat.fontColor, order: cat.order } });
				}
			}
		}
	}

	if (requests.length > 0) {
		requests.push({type: 'export', responsetype: 'responseExport', tableName: 'Colors', waitResponse: true, subtype: 'Colors' });
		sendtoSQL('requests', 'saveCategories', true, { requests: requests }, function(){
			window.location = chrome.runtime.getURL("viewer.html");
		});
	}
}
