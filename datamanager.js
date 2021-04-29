var store = localforage.createInstance(
{
    driver      : localforage.INDEXEDDB,
    name        : 'SlickRssByUsers',
    version     : 1.0,
    storeName   : 'keyvaluepairs',
    description : 'Store rss data'
});
