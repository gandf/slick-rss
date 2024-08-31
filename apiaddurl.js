var table;
feeds = [];

document.addEventListener('DOMContentLoaded', function()
{
	document.getElementById('close').addEventListener('click', function() {
		if (feedsToLoad.length > 0) {
			chrome.runtime.sendMessage({ type: 'cleanListApiUrlToAdd', target: 'background' }).then(function(){
				window.close();
			});
		} else {
			window.close();
		}
	});
	
	ShowFeeds();
});

document.documentElement.setAttribute('lang', GetMessageText('lang'));

var port = chrome.runtime.connect({name: "apiaddurlPort"});

port.onMessage.addListener(function (msg) {
	if (msg.type == "refresh") {
		chrome.runtime.sendMessage({ type: 'getApiUrlToAdd', target: 'background' }).then(function(data){
			if (data != undefined) {
				let idCount = 0;
				if (feeds.length > 0) {
					idCount = feeds.length;
				}

				let feedsToLoad = GetObjectFromStr(data);
				feedsToLoad.forEach(feedToLoad => {
					if (!feeds.find(function (el) {return (el.url == feedToLoad.Url);})) {
						let feed = CreateNewFeed((feedToLoad.Title == undefined) ? "" : feedToLoad.Title, feedToLoad.Url, (feedToLoad.Group == undefined) ? "" : feedToLoad.Group, options.maxitems, 1000 + idCount, 0, null);
						feeds.push(feed);
						idCount++;
						table.addRow(feed);
					}
				});
			}
		});
	}
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

function ShowFeeds()
{
	let forcelangen = localStorage.getItem('forcelangen');
    if ((forcelangen == undefined) || (forcelangen == null)) {
        options.forcelangen = false;
    }
	else {
		options.forcelangen = (forcelangen == "true");
	}

	//Build Tabulator
	table = new Tabulator("#feedGrid-table", {
		height:"90vh",
		layout: "fitColumns",
		index:"id",
		initialSort: [
			{column: "order", dir: "asc"}
		],
		keybindings:{
			"navNext" : ["13"],
		},
		columns:[
			{title:"", field:"id", visible:false},
			{title:GetMessageText("manageName"), field:"title", width:300, editor:"input"},
			{title:GetMessageText("manageUrl"), field:"url", width:400, editor:"input"},
			{title:GetMessageText("manageGroup"), field:"group", width:200, editor:"list", editorParams:{autocomplete:"true", allowEmpty:true,listOnEmpty:true, valuesLookup:true, freetext:true}},
			{title:GetMessageText("manageMaxItems"), field:"maxitems", width:120, editor:IntegerEditor, hozAlign:"center", headerHozAlign: "center", sorter: "number"},
			{title:GetMessageText("manageOrder"), field:"order", editor:IntegerEditor, hozAlign:"center", width:100, headerHozAlign: "center", sorter: "number"},
			{title:GetMessageText("excludeUnreadCount"), field:"excludeUnreadCount", hozAlign:"center", vertAlign:"middle", formatter:"toggle", width:200, headerHozAlign: "center", formatterParams:{
				size:16,
				onValue:1,
				offValue:0,
				onTruthy:true,
				onColor:"#285491",
				//offColor:"red",
				clickable:true,
			}},
			{title: "", hozAlign: "center", formatter: function(cell, formatterParams, onRendered)
				{
					return '<button>' + GetMessageText("add") + '</button>';
				}, cssClass: "no-background", headerSort:false, width: 100, cellClick:function(e, cell)
				{
					let rowdata = cell.getRow().getData();
					let rowdatasaved = cell.getRow().getData();
					if ((rowdata.id != undefined) && (rowdata.url != undefined) && (rowdata.url != "")) {
						if (IsValid(rowdata.title, rowdata.url, rowdata.group, rowdata.maxitems, rowdata.order)) {
							sendtoSQL('getFeeds', 'ApiAddUrlRowClick', true, undefined, function(datafeeds) {
								if (datafeeds != null) {
									while (datafeeds.find(function (el) {return (el.id == rowdata.id);})) {
										rowdata.id = GetRandomID();
									}
								}
								let requests = [];
								requests.push({type: 'addFeed', fromID: 'ApiAddUrlRowClick', waitResponse: false, data: { id: rowdata.id, title: rowdata.title, url: rowdata.url, group: rowdata.group, order: rowdata.order, maxitems: rowdata.maxitems, excludeUnreadCount: rowdata.excludeUnreadCount} });
								requests.push({type: 'export', responsetype: 'responseExport', tableName: 'Group', waitResponse: true, subtype: 'Group' });
								requests.push({type: 'export', responsetype: 'responseExport', tableName: 'Feeds', waitResponse: true, subtype: 'Feeds' });
								sendtoSQL('requests', 'ApiAddUrlRowClick', true, { requests: requests }, function() {
									cell.getRow().delete();
								});
							});
						}
					}
				}
			},
		],
		data:feeds
	});

	waitOptionReady().then(function () {
		if (options.darkmode) {
			activeDarkMode();
		} else {
			disableDarkMode();
		}

		chrome.runtime.sendMessage({ type: 'getApiUrlToAdd', target: 'background' }).then(function(data){
			if (data != undefined) {
				let idCount = 0;
				let feedsToLoad = GetObjectFromStr(data);
				feedsToLoad.forEach(feedToLoad => {
					let feed = CreateNewFeed((feedToLoad.Title == undefined) ? "" : feedToLoad.Title, feedToLoad.Url, (feedToLoad.Group == undefined) ? "" : feedToLoad.Group, options.maxitems, 1000 + idCount, 0, null);
					feeds.push(feed);
					table.addRow(feed);
					idCount++;
				});
			}
		});
	});
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
