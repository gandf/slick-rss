$(document).ready(function()
{
	$('#import').click(function(){Import();});
	$('#cancel').click(function(){window.close();});
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
				requests.push({type: 'addColor', waitResponse: false, data: { name: category.category, color: category.color ?? "#888888", order: category.order ?? index + 1 } });
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
