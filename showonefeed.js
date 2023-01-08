// to prevent XSS :(
$(document).ready(function () {
    waitOptionReady().then(function () {
        var port = chrome.runtime.connect({name: $(location).attr('hash').replaceAll("#", "")});

        port.onMessage.addListener(function (msg) {
            let title = "";
            let content = "";
            if (msg != null) {
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

document.documentElement.setAttribute('lang', GetMessageText('lang'));

function SetData(Title, Document) {
    if (Title != null) {
        let feedTitle = document.getElementById("title");
        if (feedTitle != null) {
            feedTitle.innerHTML = Title;
            removeImg("feedPreviewReadLater");
            removeImg("feedPreviewUnread");
            removeImg("feedPreviewSummaryImg");
            removeImg("feedPreviewSummaryImg2");
            removeImg("onefeed");
            removeImg("feedPreviewMarkRead");
            let txt = "";
            if (feedTitle.childNodes[0] != null) {
                txt = feedTitle.childNodes[0].innerText;
                feedTitle.childNodes[0].innerText = txt.substring(txt.indexOf(". ") + 2);
            }
        }
    }

    if (Document != null) {
        let feedContent = document.getElementById("content");
        if (feedContent != null) {
            feedContent.innerHTML = Document;
        }
    }
}

function removeImg(classname) {
    let elements = document.getElementsByClassName(classname);
    if (elements != null) {
        while(elements.length > 0){
            elements[0].parentNode.removeChild(elements[0]);
        }
    }
}
