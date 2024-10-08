document.addEventListener('DOMContentLoaded', function()
{
	document.getElementById('close').addEventListener('click', function() {
		window.close();
	});

	promiseOptionBegin.then(function() {
		GetCategoriesRegistered().then(function() {
			ExportCategories();
		});
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

function ExportCategories()
{
	sendtoSQL('getColors', 'ExportCategories', true, undefined, function(response){
		document.getElementById("opml").value = JSON.stringify(response, null, '\t');
	});
}
