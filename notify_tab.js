window.onload = PlayNotificationSound;

function PlayNotificationSound() {
    let audio = new Audio('Glisten.ogg');
    audio.addEventListener('ended', CloseNotification);
    audio.play();
}

function CloseNotification() {
  window.close();
}
