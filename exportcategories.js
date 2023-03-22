
$(document).ready(function()
{
	$('#close').click(function(){window.close();});

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
	document.getElementById("opml").value = JSON.stringify(listCategoriesRegistered, null, '\t');
}
