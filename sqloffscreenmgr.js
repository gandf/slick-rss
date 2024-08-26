const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
let creatingOffscreen;
let OffscreenReady = false;
let resolveOffscreenReady;
var senderSql;
let waitOffscreenReady = new Promise((resolve) => {
  resolveOffscreenReady = resolve;
});

let listPromiseSqlReady = [];
let listCallback = [];

if (senderSql == undefined) {
  senderSql = GetSenderSql();
}

async function closeOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    chrome.offscreen.closeDocument();
  }
}

async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    OffscreenReady = true;
    resolveOffscreenReady();
    return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
    OffscreenReady = true;
    resolveOffscreenReady();
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'Run worker to access alasql database stored in indexeddb.',
    });
    await creatingOffscreen;
    creatingOffscreen = null;
    OffscreenReady = true;
    resolveOffscreenReady();
  }
}

setupOffscreenDocument().then(async () => {
  if (options.log) {
    console.log('Offscreen document is ready');
  }
});

async function sendtoSQL(type, fromID, waitResponse, data, callback, callbackAlreadyRegistered) {
  if (OffscreenReady == false) {
    await waitOffscreenReady;
  }
  if (callbackAlreadyRegistered !== true) {
    if ((waitResponse == true) && (callback != undefined)) {
      fromID += genererIdAleatoire();
      listCallback.push({ fromID, callback });
    }
  }
  if (OffscreenReady == true) {
    chrome.runtime.sendMessage({type, target: 'offscreen', from: senderSql, fromID, waitResponse, data}, response => {
      if (response != undefined) {
        if ((response.sqlReady != undefined) && (response.sqlReady == false)) {
          createAndStorePromiseSqlready().then(() => {
            sendtoSQL(type, fromID, waitResponse, data, callback, true);
          });
          return;
        }
      }
    });
  }
}

function createAndStorePromiseSqlready() {
  let resolveFunction;
  let promise = new Promise((resolve) => {
    resolveFunction = resolve;
  });
  listPromiseSqlReady.push(resolveFunction);
  return promise;
}

chrome.runtime.onMessage.addListener(eventSql);

async function eventSql(message) {
  if (message.type == 'eventSqlReady') {
    listPromiseSqlReady.forEach((resolve) => resolve());
    listPromiseSqlReady = [];
    return false;
  }
  
  if (message.target == senderSql) {
    listCallback.forEach((callback) => {
      if (callback.fromID === message.targetID) {
        callback.callback(message.data);
      }
    });
    listCallback = listCallback.filter(callback => callback.fromID !== message.targetID);
    return true;
  }
  return false;
}

function genererIdAleatoire() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function GetSenderSql() {
  if (isServiceWorkerContext()) {
    return 'background';
  }
  var url = window.location.href;
  var fileName = url.substring(url.lastIndexOf('/') + 1, url.includes('?') ? url.indexOf('?') : url.length);
  return fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
}

function isServiceWorkerContext() {
  return typeof self !== 'undefined' && typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope;
}
