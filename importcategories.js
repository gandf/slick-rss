document.addEventListener('DOMContentLoaded', function()
{
	document.getElementById('import').addEventListener('click', function() {
		Import();
	});
	document.getElementById('close').addEventListener('click', function() {
		window.close();
	});
});

document.documentElement.setAttribute('lang', GetMessageText('lang'));

waitOptionReady().then(function () {
	if (options.darkmode) {
		activeDarkMode();
	} else {
		disableDarkMode();
	}
});

// starts import
function Import()
{
	if(document.getElementById("opml").value == "")
	{
		alert(GetMessageText("importAlertNothing"));
		return;
	}

	ImportCategories();
}

function ImportCategories()
{
	let value = document.getElementById("opml").value;

	if ((value === null) || (value === undefined)) {
		alert(GetMessageText("importAlertNothing"));
        return;
    }

	try {
		listCategoriesRegistered = JSON.parse(value);

		let requests = [];
		listCategoriesRegistered.forEach((category, index) => {
			if (category.category && category.category != "") {
				if (options.darkmode) {
					requests.push({type: 'addColor', waitResponse: false, data: { id: category.id == undefined ? GetRandomID() : category.id, name: category.category, color: category.color ?? "#659DD8", fontColor: category.fontColor ?? "#4D5460", order: category.order ?? index + 1 } });
				} else {
					requests.push({type: 'addColor', waitResponse: false, data: { id: category.id == undefined ? GetRandomID() : category.id, name: category.category, color: category.color ?? "#d7e6f8", fontColor: category.fontColor ?? "#0000EE", order: category.order ?? index + 1 } });
				}
			}
		});

		if (requests.length > 0) {
			requests.push({type: 'export', responsetype: 'responseExport', tableName: '', waitResponse: true, subtype: 'Colors', data: options });
			sendtoSQL('requests', 'ImportCategories', true, { requests: requests }, function(){
				window.close();
			});
		}
	}
	catch (e) {
		alert(GetMessageText("importAlertError") + e);
	}
}
