// to prevent XSS :(
$(document).ready(function () {
    waitOptionReady().then(function () {
        if (options.darkmode) {
            activeDarkMode();
        } else {
            disableDarkMode();
        }
        var port = chrome.runtime.connect({name: $(location).attr('hash').replaceAll("#", "")});

        port.onMessage.addListener(function (msg) {
            if (msg != null) {
                var title = "";
                var content = "";
                if (msg.title != null) {
                    title = msg.title;
                }
                if (msg.content != null) {
                    content = msg.content;
                }
            }
            port.disconnect();
            SetData(title, content);
        });
    });
});

function SetData(Title, Document) {
    if (Title != null) {
        var feedTitle = document.getElementById("title");
        if (feedTitle != null) {
            feedTitle.innerHTML = Title;
            removeImg("feedPreviewReadLater");
            removeImg("feedPreviewUnread");
            removeImg("feedPreviewSummaryImg");
            removeImg("feedPreviewSummaryImg2");
            removeImg("onefeed");
            removeImg("feedPreviewMarkRead");
        }
    }

    if (Document != null) {
        var feedContent = document.getElementById("content");
        if (feedContent != null) {
            feedContent.innerHTML = Document;
        }
    }
}

function removeImg(classname) {
    var elements = document.getElementsByClassName(classname);
    if (elements != null) {
        while(elements.length > 0){
            elements[0].parentNode.removeChild(elements[0]);
        }
    }
}
