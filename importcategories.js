
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

		chrome.runtime.sendMessage({"type": "saveCategories", "data": GetStrFromObject(listCategoriesRegistered)}).then(function(){
			window.close();
		});
	}
	catch (e) {
		alert(GetMessageText("importAlertError") + e);
	}
}
