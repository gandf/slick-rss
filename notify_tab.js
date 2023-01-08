window.onload = PlayNotificationSound;

document.documentElement.setAttribute('lang', GetMessageText('lang'));

function PlayNotificationSound() {
    var audio = new Audio('Glisten.ogg');
    audio.addEventListener('ended', CloseNotification);
    audio.play();
}

function CloseNotification() {
  window.close();
}
