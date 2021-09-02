var objects = document.getElementsByTagName('html');
for (var j = 0; j < objects.length; j++)
{
    var obj = objects[j];

    obj.querySelectorAll('[data-locale]').forEach(elem => {
      elem.innerText = GetMessageText(elem.dataset.locale)
    });
}
