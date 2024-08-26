var table;
var listdelete = [];
var listpromiseStart = [];

let resolveStartLoad;
let waitStartLoad = new Promise((resolve) => {
	resolveStartLoad = resolve;
});
listpromiseStart.push(waitStartLoad);

let resolveOptionStart;
let waitOptionStart = new Promise((resolve) => {
	resolveOptionStart = resolve;
});
listpromiseStart.push(waitOptionStart);


document.addEventListener('DOMContentLoaded', function () {
	document.getElementById('save').addEventListener('click',  function(){
		Save();
	});
	resolveStartLoad();
});

waitOptionReady().then(function () {
	if (options.darkmode) {
		activeDarkMode();
	} else {
		disableDarkMode();
	}
	document.documentElement.setAttribute('lang', GetMessageText('lang'));
	resolveOptionStart();
});

Promise.all(listpromiseStart).then(function() {
	ShowFeeds();
});

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

function Save()
{
	let requests = [];
	for(let i = 0; i < listdelete.length; i++) {
		let feedid = listdelete[i];
		if (feedid > 0) {
			requests.push({type: 'deleteFeed', waitResponse: false, data: { feed_id: feedid } });
		}
	}

	let datafeeds = table.getData();
	for (let i = 0; i < datafeeds.length; i++) {
		let feed = datafeeds[i];
		if (feed.id === undefined) {
			continue;
		}
		if (!IsValid(feed.title, feed.url, feed.group, feed.maxitems, feed.order)) {
			return;
		}
		if (feed.id < 0) {
			requests.push({type: 'addFeed', waitResponse: false, data: CreateNewFeed(feed.title, feed.url, feed.group, feed.maxitems, feed.order, feed.excludeUnreadCount) });
		} else {
			let onefeed = feeds.filter(x => x.id == feed.id);
			if (onefeed.length > 0) {
				onefeed = onefeed[0];
				if ((onefeed.title != feed.title) || (onefeed.url != feed.url) || (onefeed.group != feed.group) || (onefeed.maxitems != feed.maxitems) || (onefeed.order != feed.order) || (onefeed.excludeUnreadCount != feed.excludeUnreadCount)) {
					requests.push({type: 'updateFeed', waitResponse: false, data: feed });
				}
			}
		}
	}

	if (requests.length > 0) {
		requests.push({type: 'export', responsetype: 'responseExport', tableName: 'Group', waitResponse: true, subtype: 'Group' });
		requests.push({type: 'export', responsetype: 'responseExport', tableName: 'Feeds', waitResponse: true, subtype: 'Feeds' });
		sendtoSQL('requests', 'ManageImport', true, { requests: requests }, function(){
			GetUnreadCounts();
			CleanUpUnreadOrphans();
			chrome.runtime.sendMessage({"type": "refreshFeeds" }).then(function(){
				window.location = chrome.runtime.getURL("viewer.html");
			});
		});
	}
}

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
	if (cell.getRow().getData().id === undefined) {
		return '<button>' + GetMessageText("add") + '</button>';
	} else {
		return '<img src="x_gray.png" class="delete" title="' + GetMessageText("DeleteFeed") + '">';
	}
};

function ShowFeeds()
{
	GetFeedsSimple(function(feeds) {
		let feedsreturned = JSON.parse(JSON.stringify(feeds));

		feedsreturned.sort((a, b) => a.order - b.order);

		let reorder = 0;
		for(let i = 0; i < feedsreturned.length; i++) {
			if (feedsreturned[i].id != readLaterFeedID) {
				reorder++;
				feedsreturned[i].order = reorder;
			}
		}

		//Build Tabulator
		table = new Tabulator("#feedGrid-table", {
			height:"90vh",
			addRowPos:"top",
			layout: "fitData",
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
				{title:"", hozAlign:"center", vertAlign: "middle", formatter:deleteIcon, cssClass:"no-background", cellClick:function(e, cell)
					{
						if (cell.getRow().getData().id === undefined) {
							//Add feed
							let rowdata = cell.getRow().getData();
							if ((rowdata.title != undefined) && (rowdata.title != "") && (rowdata.url != undefined) && (rowdata.url != "")) {
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
								if (rowdata.id == undefined) {
									rowdata.id = -1;
								}
								table.addRow({ title: rowdata.title, url: rowdata.url, group: rowdata.group, maxitems: rowdata.maxitems, order: rowdata.order, id: rowdata.id, excludeUnreadCount: rowdata.excludeUnreadCount }, false);
								cell.getRow().delete();
								table.addRow({ excludeUnreadCount: false, maxitems: options.maxitems });
							}
						} else {
							//Delete feed
							let id = cell.getRow().getData().id;
							if ((id != undefined) && (id > 0)) {
								listdelete.push(id);
							}
							cell.getRow().delete();
						}					
					}, headerSort:false, minWidth: 80
				},
				{title: "", hozAlign: "center", formatter: function(cell, formatterParams, onRendered)
					{
						if (cell.getRow().getData().id === undefined) {
							return "";
						}
						return '<button class="suggest-button">' + GetMessageText("buttonSuggest") + '</button>';
					}, cssClass: "no-background", headerSort:false, widthShrink:1, cellClick:function(e, cell)
					{
						let rowdata = cell.getRow().getData();
						if ((rowdata.id != undefined) && (rowdata.url != undefined) && (rowdata.url != "")) {
							FeedAddSuggest(rowdata.url);
						}
					}
				},
			],
			data:feedsreturned.filter(filterByID)
		});
		
		table.on("tableBuilt", function() {
			table.addRow({ excludeUnreadCount: false, maxitems: options.maxitems });
		});
	});
}

function FeedAddSuggest(suggestion) {
	try {
		fetch('https://flyonsoft.eu/feedsadd.php', {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			body: '[{ "URL": "' + suggestion + '" }]'}).then(function(response){
		});
	}
	catch {}
}
