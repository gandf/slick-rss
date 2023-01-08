let objects = document.getElementsByTagName('html');
for (let j = 0; j < objects.length; j++)
{
    let obj = objects[j];

    waitOptionReady().then(function () {
        obj.querySelectorAll('[data-locale]').forEach(elem => {
          elem.innerText = GetMessageText(elem.dataset.locale)
        });
    });
}
