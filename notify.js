window.statusbar.visible = false;
window.toolbar.visible = false;

chrome.windows.update(chrome.windows.WINDOW_ID_CURRENT, { state: 'minimized' });
window.onload = PlayNotificationSound;

function PlayNotificationSound() {
    var audio = new Audio('Glisten.ogg');
    audio.addEventListener('ended', CloseNotification);
    audio.play();
}

function CloseNotification() {
  window.close();
}
