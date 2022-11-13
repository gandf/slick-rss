
$(document).ready(function()
{
	$('#close').click(function(){window.close();});

	promiseOptionBegin.then(function() {
		ExportOptions();
	});
});

waitOptionReady().then(function () {
	if (options.darkmode) {
		activeDarkMode();
	} else {
		disableDarkMode();
	}
});

function ExportOptions()
{
	document.getElementById("opml").value = JSON.stringify(options, null, '\t');
}
