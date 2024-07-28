import { log } from './log.js';

let worker;
let listRequest = [];
let sqlReady = false;

function init() {
  log('CLS');
  worker = new Worker(chrome.runtime.getURL('sqlworker.js'));
  
  worker.addEventListener('error', e => {
    log("Worker error: " + JSON.stringify(e, ["message", "arguments", "type", "name"]));
  });
  
  log('Offscreen init & load database');
  
  worker.postMessage({ type: 'init' });

  try{
    loadTable('Options');
    loadTable('Colors');
    loadTable('Group');
    loadTable('Feeds');
    loadTable('LastSelectedFeed');
    loadTable('ReadlaterinfoItem');
    loadTable('ItemCategories');
    loadTable('Categories');
    loadTable('Unreadinfo');
    loadTable('UnreadinfoItem');
    loadTable('Cache');
    loadTable('CacheFeedInfo');
    loadTable('CacheFeedInfoItem');
    worker.postMessage({ type: 'readlaterurl', waitResponse: false, data: chrome.runtime.getURL("readlater.html") });
  } catch (e) {
    log("Error: " + e);
  }

  worker.addEventListener('message', e => {
    switch (e.data.type) {
      case 'log': {
        log(`worker log :=> '${JSON.stringify(e.data)}.`);
        break;
      }
      case 'event': {
        switch (e.data.msg) {
          case 'initialized': {
            log('database loaded');
            sqlReady = true;
            responseMessage('eventSqlReady');
            break;
          }
        }
        break;
      }
      case 'responseSaveAll': {
        store.setItem('tableColors', e.data.msg.Colors);
        store.setItem('tableGroup', e.data.msg.Group);
        store.setItem('tableFeeds', e.data.msg.Feeds);
        store.setItem('tableLastSelectedFeed', e.data.msg.LastSelectedFeed);
        store.setItem('tableReadlaterinfoItem', e.data.msg.ReadlaterinfoItem);
        store.setItem('tableItemCategories', e.data.msg.ItemCategories);
        store.setItem('tableCategories', e.data.msg.Categories);
        store.setItem('tableUnreadinfo', e.data.msg.Unreadinfo);
        store.setItem('tableUnreadinfoItem', e.data.msg.UnreadinfoItem);
        store.setItem('tableCache', e.data.msg.Cache);
        store.setItem('tableCacheFeedInfo', e.data.msg.CacheFeedInfo);
        store.setItem('tableCacheFeedInfoItem', e.data.msg.CacheFeedInfoItem);
        store.setItem('tableOptions', e.data.msg.Options);
        break;
      }
      default: {
        //log(`worker type :=> '${e.data.type}.`);
        let request = listRequest.find((element) => (element.type === e.data.type) && (element.id === e.data.id));
        if (request) {
          switch (request.type) {
            case 'responseExport': {
              if (e.data.msg.tableName == undefined) {
                //Do nothing
              } else {
                store.setItem(`table${e.data.msg.tableName}`, e.data.msg.data).then(function () {
                  responseMessage('saved', request.id, request.from, request.fromID, e.data.msg.tableName);
                });
              }
              break;
            }
            case 'responseIsInitialized': {
              responseMessage('Initialized', request.id, request.from, request.fromID, e.data.msg);
              break;
            }
            case 'responseExecuteSql': {
              responseMessage('ResultSQL', request.id, request.from, request.fromID, e.data.msg);
              break;
            }
            default: {
              if (request.type.startsWith('response') )
                responseMessage(request.type.substring("response".length), request.id, request.from, request.fromID, e.data.msg);
            }
          }
        }
        break;
      }
    }
  });
}

init();

chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message, sender, sendResponse) {
  if (message.target !== 'offscreen') {
    return false;
  }
  
  if (!sqlReady) {
    sendResponse({ sqlReady });
    return true;
  }
  //log(`handleMessages :=> '${message.type}'.`);

  // Dispatch the message to an appropriate handler.
  switch (message.type) {
    case 'sql': {
      let id = addRequest('responseExport', message.from, message.fromID, tableName);
      worker.postMessage({ type: 'executeSql', waitResponse: message.waitResponse, sql: message.data.sql, tableName, id });
      break;
    }
    case 'save': {
      saveTable(message.from, message.fromID, message.data.tableName);
      break;
    }
    case 'begin': {
      worker.postMessage({ type: 'beginTrans', waitResponse: message.waitResponse });
      break;
    }
    case 'commit': {
      worker.postMessage({ type: 'commitTrans', waitResponse: message.waitResponse });
      break;
    }
    case 'isInitialized': case 'getCache': {
      callWorker(true, null, message);
      break;
    }
    case 'cleanCache': {
      worker.postMessage({ type: 'cleanCache', waitResponse: message.waitResponse, time: new Date((new Date()).getTime() - (message.data.checkinterval * 60000)) });
      break;
    }
    case 'setCache': {
      worker.postMessage({ type: 'setCache', waitResponse: message.waitResponse, time: (new Date()).getTime(), data: message.data });
      break;
    }
    case 'select': {
      let id = addRequest('responseSelect', message.from, message.fromID, message.data.tableName);
      worker.postMessage({ type: 'select', waitResponse: message.waitResponse, table: message.data.table, select: message.data.select, top: message.data.top, where: message.data.where, order: message.data.order, id });
      break;
    }
    case 'insert': {
      let id = addRequest('responseInsert', message.from, message.fromID, message.data.tableName);
      worker.postMessage({ type: 'insert', waitResponse: message.waitResponse, table: message.data.table, data:message.data.data, id });
      break;
    }
    case 'update': {
      let id = addRequest('responseUpdate', message.from, message.fromID, message.data.tableName);
      worker.postMessage({ type: 'update', waitResponse: message.waitResponse, table: message.data.table, data:message.data.data, where: message.data.where, id });
      break;
    }
    case 'delete': {
      let id = addRequest('responseDelete', message.from, message.fromID, message.data.tableName);
      worker.postMessage({ type: 'delete', waitResponse: message.waitResponse, table: message.data.table, where: message.data.where, id });
      break;
    }
    case 'query': {
      callWorker(true, message.data.tableName, message, message.data.data, message.data.sql);
      break;
    }
    case 'getUniqueList': {
      callWorker(true, message.data.tableName, message, message.data.data);
      break;
    }
    case 'deleteFeed': {
      worker.postMessage({ type: 'deleteFeed', waitResponse: message.waitResponse, feed_id: message.data.feed_id });
      break;
    }
    case 'deleteUnreadinfoItem': {
      callWorker(false, null, message);
      break;
    }
    case 'removeReadlaterinfoItem': {
      worker.postMessage({ type: 'removeReadlaterinfoItem', waitResponse: message.waitResponse, itemID: message.data.itemID });
      break;
    }
    case 'getOptions': case 'getLastSelectedFeed': case 'getFeeds': case 'getReadlaterinfoItem': case 'getColors': case 'getCacheFeedInfo': case 'getUnreadTotal': case 'getUnreadinfo': case 'getUnreadinfoFull':{
      callWorker(true, message.type.substring("get".length), message);
      break;
    }
    case 'modifyColor': {
      worker.postMessage({ type: 'modifyColor', waitResponse: message.waitResponse, data: message.data.data, name: message.data.name });
      break;
    }
    case 'setOptions': case 'setLastSelectedFeed': case 'addFeed': case 'setReadlaterinfoItem': case 'addColor': case 'deleteColor': case 'setUnreadinfo':
    case 'clearUnreadinfo': case 'addUnreadinfoItem': case 'clearUnreadinfoItem': case 'clearReadlaterinfo': case 'clearCacheFeedInfo': case 'addCacheFeedInfo':
    case 'updateCacheFeedInfoLoading': case 'updateCacheFeedInfo': case 'addCacheFeedInfoItem': {
      callWorker(false, null, message);
      break;
    }
    case 'executeSql': {
      callWorker(true, null, message, null, message.data.sql);
      break;
    }
    case 'requests': {
      let id = addRequest('responseRequestsFinished', message.from, message.fromID, null);
      for (var i = 0; i < message.data.requests.length; i++) {
        if (message.data.requests[i].waitResponse) {
          let id = addRequest(message.data.requests[i].responsetype, message.from, message.fromID, null);
          message.data.requests[i].id = id;
        }
      }
      worker.postMessage({ type: 'requests', waitResponse: message.waitResponse, data: message.data, id });
      break;
    }
  }
  sendResponse();
  return true;
}

function responseMessage(type, requestId, from, fromID, data) {
  chrome.runtime.sendMessage({ type, target: from, targetID: fromID, data });
  if (requestId != undefined) {
    listRequest = listRequest.filter(request => request.id !== requestId);
  }
}

function sendToBackground(type, data) {
  chrome.runtime.sendMessage({
    type,
    target: 'background',
    data
  });
}

window.addEventListener("beforeunload", function(e){
  log(`Offscreen close.`);
  sendToBackground('close');
});

function loadTable(name) {
  store.getItem('table' + name).then(function (data) {
    worker.postMessage({ type: 'load', subtype: name, "data": data });
  });
}

function saveTable(from, fromID, tableName) {
  let id = addRequest('responseExport', from, fromID, tableName);
  worker.postMessage({ type: 'export', subtype: tableName, id });
}

function genererIdAleatoire() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function addRequest(type, from, fromID, tableName) {
  let id =  genererIdAleatoire();
  listRequest.push({type, id, tableName, from, fromID});
  return id;
}

function callWorker(WithId, tableName, message, data, sql) {
  let id = undefined;
  if (WithId) {
    id = addRequest('response' + capitalFirstLetter(message.type), message.from, message.fromID, tableName);
  }
  worker.postMessage({ type: message.type, waitResponse: message.waitResponse, data: (data != undefined ? data : message.data), sql, id });
}

function capitalFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
