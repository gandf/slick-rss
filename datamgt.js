chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'get_name') {
        sendResponse("Jack");
    } else if (request.message === 'change_name') {
        chrome.storage.local.set({
            name: request.payload
        }, () => {
            if (chrome.runtime.lastError) {
                sendResponse({ message: 'fail' });
                return;
            }

            sendResponse({ message: 'success' });
        })

        return true;
    }
});
