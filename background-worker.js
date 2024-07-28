try {
  importScripts("sha256.js");
  importScripts("localforage.min.js");
  importScripts("fxparser.min.js");
  importScripts("datamanager.js");
  importScripts("sqloffscreenmgr.js");
  importScripts("common-worker.js");
  importScripts("common.js");
  importScripts("background.js");
} catch (e) {
  console.error(e);
}
