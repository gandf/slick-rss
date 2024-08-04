var table;
var listdelete = [];

var lastBadRow = null;
var listCategories = [];

$(document).ready(function()
{
	$('#save').click(function(){Save();});
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
	input.addEventListener("blur", function(e) {
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
		return '<img src="x_gray.png" class="delete" title="' + GetMessageText("Delete category") + '">';
	}
};

var colorEditor = function(cell, onRendered, success, cancel){
	var input = document.createElement("input");
	input.setAttribute("type", "color");
	input.value = cell.getValue();
	input.addEventListener("change", function(e){
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
				layout: "fitDataTable",
				index:"name",
				keybindings:{
					"navNext" : ["13"],
				},
				columns:[
					{title:"", field:"newcat", visible:false},
					{title:"", field:"toadd", visible:false},
					{title:GetMessageText("manageCategory"), field:"name", width:200, editor:"input", resizable:false},
					{title:GetMessageText("manageColor"), field:"color", width:100, editor:colorEditor, formatter: colorFormatter, resizable:false},
					{title:GetMessageText("manageOrder"), field:"order", editor:IntegerEditor, hozAlign:"center", width:100, headerHozAlign: "center", resizable:false },
					{title:"", hozAlign:"center", vertAlign: "middle", formatter:deleteIcon, cssClass:"no-background", resizable:false, cellClick:function(e, cell)
						{
							if (cell.getRow().getData().newcat) {
								//Add categorie
								let rowdata = cell.getRow().getData();
								if ((rowdata.name != undefined) && (rowdata.name != "") && (rowdata.color != undefined) && (rowdata.color != "")) {
									if(!IsValid(rowdata.name, rowdata.color)) {
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
									table.addRow({ name: rowdata.name, color: rowdata.color, order: rowdata.order, newcat:false, toadd:true }, false);
									cell.getRow().delete();
									table.addRow({ name: undefined, color: "#659DD8", order:undefined, newcat: true, toadd:true });
								}
							} else {
								//Delete categorie
								let id = cell.getRow().getData().id;
								if ((id != undefined) && (id > 0)) {
									listdelete.push(id);
								}
								cell.getRow().delete();
							}					
						}, headerSort:false, minWidth: 80
					},
				],
				data:listCategoriesreturned
			});
			
			table.on("tableBuilt", function() {
				table.addRow({ name: undefined, color: "#659DD8", order:undefined, newcat: true, toadd: true });
			});
		}
	});
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

function Save()
{
	let requests = [];
	for(let i = 0; i < listdelete.length; i++) {
		let catname = listdelete[i];
		if ((catname != undefined) && (catname != null) && (catname != "")) {
			requests.push({type: 'deleteColor', waitResponse: false, data: { name: catname } });
		}
	}

	let datacats = table.getData();
	for (let i = 0; i < datacats.length; i++) {
		let cat = datacats[i];
		if ((cat.name == undefined) || (cat.name == "") || cat.newcat) {
			continue;
		}
		if (!IsValid(cat.name, cat.color)) {
			return;
		}
		if (cat.toadd) {
			if (car.color.toUpperCase() != "#659DD8") {
				requests.push({ type: 'addColor', waitResponse: false, data: { name: cat.name, color: cat.color, order: cat.order } });
			}
		} else {
			let onecat = listCategories.filter(x => (x.name == cat.name) && (x.color == cat.color) && (x.order == cat.order));
			if (onecat.length > 0) {
				onecat = onecat[0];
				if ((onecat.name != cat.name) || (onecat.color != cat.color) || (onecat.order != cat.order)) {
					if (car.color.toUpperCase() != "#659DD8") {
						requests.push({type: 'modifyColor', waitResponse: false, data: { name: cat.name, color: cat.color, order: cat.order } });
					} else {
						requests.push({type: 'deleteColor', waitResponse: false, data: { name: cat.name } });
					}
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
