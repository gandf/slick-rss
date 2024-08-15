importScripts('alasql.min.js'); 
importScripts('logworker.js'); 

const validTableNames = ['Colors', 'Group', 'Feeds', 'LastSelectedFeed', 'Options', 'ReadlaterinfoItem', 'ItemCategories', 'Categories', 'Unreadinfo', 'UnreadinfoItem', 'Cache', 'CacheFeedInfo', 'CacheFeedInfoItem'];

const readLaterFeedID = 9999999999;
const allFeedsID = 9999999998;
let initialized = false;
let tableInitialized = 0;
let canWork = false;
let readlaterurl;
let groupurl;

function result(type, id, waitResponse, msg) {
  if (waitResponse) {
    postMessage({ type, id, msg });
  }
}

self.onmessage = async function(event) {
  let requests = undefined;
  if (event.data.data != undefined) {
    if (event.data.data.requests != undefined) {
      requests = event.data.data.requests;
    }
  }
  if (requests == undefined) {
    requests = [event.data];
  }
  if (requests == undefined) {
    log(`Unexpected message type received: '${event.data}'.`);
  }

  for (let irequests = 0; irequests < requests.length; irequests++) {
    let request = requests[irequests];
    switch (request.type) {
      case 'init':
      {
        alasql("DROP TABLE IF EXISTS `Colors`;\
          CREATE TABLE `Colors` (`id` INT PRIMARY KEY, `name` string , `color` string, `fontColor` string, `order` INT);");

        alasql("DROP TABLE IF EXISTS `Group`;\
          CREATE TABLE `Group` (`id` INT AUTO_INCREMENT PRIMARY KEY , `name` string);");

        alasql("DROP TABLE IF EXISTS `Feeds`;\
          CREATE TABLE Feeds (`id` INT PRIMARY KEY , `title` string, `url` string, `group_id` INT, `maxitems` INT, `order` INT, `excludeUnreadCount` boolean, `urlredirected` boolean);");

        alasql("DROP TABLE IF EXISTS `LastSelectedFeed`;\
          CREATE TABLE `LastSelectedFeed` (`lastSelectedFeedID` INT, `lastSelectedFeedType` string);");

        alasql("DROP TABLE IF EXISTS `Options`;\
          CREATE TABLE `Options` (`value` JSON);");

        alasql("DROP TABLE IF EXISTS `ReadlaterinfoItem`;\
          CREATE TABLE `ReadlaterinfoItem` (`itemID` string, `title` string, `summary` string, `thumbnail` string, `content` string,\
            `date` string, `guid` string, `order` INT, idOrigin string, `updated` boolean, `url` string, `author` string, `comments` string, PRIMARY KEY (`idOrigin`, `itemID`));");

        alasql("DROP TABLE IF EXISTS `ItemCategories`;\
          CREATE TABLE `ItemCategories` (`idOrigin` INT, `itemID` string, `category_id` INT, PRIMARY KEY (`idOrigin`, `itemID`, `category_id`));");

        alasql("DROP TABLE IF EXISTS `Categories`;\
          CREATE TABLE `Categories` (`category_id` INT PRIMARY KEY, `name` string);");
    
        alasql("DROP TABLE IF EXISTS `Unreadinfo`;\
          CREATE TABLE `Unreadinfo` (`feed_id` INT PRIMARY KEY, `unreadtotal` INT);");

        alasql("DROP TABLE IF EXISTS `UnreadinfoItem`;\
          CREATE TABLE `UnreadinfoItem` (`feed_id` INT, `itemHash` string, `value` INT, PRIMARY KEY (`feed_id`, `itemHash`));");

        alasql("DROP TABLE IF EXISTS `Cache`;\
          CREATE TABLE `Cache` (`key` INT PRIMARY KEY, `value` DATETIME);");

        alasql("DROP TABLE IF EXISTS `CacheFeedInfo`;\
          CREATE TABLE `CacheFeedInfo` (`feed_id` INT PRIMARY KEY, `title` string, `description` string, `loading` boolean, `error` string, `errorContent` string, `showErrorContent` boolean, `guid` string, `image` string, `category` JSON, `date` DATETIME);");

        alasql("DROP TABLE IF EXISTS `CacheFeedInfoItem`;\
          CREATE TABLE `CacheFeedInfoItem` (`idOrigin` INT, `itemID` string, `title` string, `description` boolean, `date` string, `content` string, `summary` boolean, `updated` string, `guid` string, `category` JSON, `comments` string, `url` string,\
          `thumbnail` string, `author` string, `order` INT, PRIMARY KEY (`idOrigin`, `itemID`));");
    
        initialized = true;
        break;
      }
      case 'url':
      {
        if (request.data != undefined) {
          readlaterurl = request.data.readlaterurl;
          groupurl = request.data.groupurl;
        }
        break;
      }
      case 'beginTrans':
      {
        alasql('BEGIN TRANSACTION');
        break;
      }
      case 'commitTrans':
      {
        alasql('COMMIT TRANSACTION');
        break;
      }
      case 'load':
      {
        if (initialized) {
          if (request.subtype == 'Options') {
            alasql('DELETE FROM `Options`');
            if (request.data != null) {
              alasql('INSERT INTO `Options` VALUES (?)', [request.data]);
            }
            tableInitialized++;
          } else {
            if (importJsonToTable(request.data, request.subtype)) {
              tableInitialized++;
            };
          }
        }
        break;
      }
      case 'export':
      {
        if (canWork) {
          result(responseName(request.type), request.id, request.waitResponse, { tableName: request.subtype, data: (request.subtype == 'Options') ? alasql('SELECT `value` FROM `Options`') : exportTableToJson(request.subtype) });
        }
        break;
      }
      case 'isInitialized':
      {
        result(responseName(request.type), request.id, request.waitResponse, initialized);
        break;
      }
      case 'cleanCache':
      {
        if (canWork) {
          alasql("DELETE FROM `Cache` WHERE (`key` = '') AND (`value` < ?)", [request.time]);
        }
        break;
      }
      case 'setCache':
        {
          if (canWork && (request.data != undefined)) {
            if (request.data.time == undefined) {
              request.data.time = new Date().getTime();
            }
            alasql("DELETE FROM `Cache`;\
            INSERT INTO `Cache` VALUES ('', ?)", [request.data.time]);
          }
        break;
      }
      case 'getCache':
      {
        if (canWork) {
          result(responseName(request.type), request.id, request.waitResponse, alasql("SELECT `value` FROM `Cache` WHERE (`key` = '')"));
        }
        break;
      }
      case 'clearCacheFeedInfo':
      {
        if (canWork) {
          alasql(`DELETE FROM \`CacheFeedInfo\`;
          DELETE FROM \`CacheFeedInfoItem\``);
        }
        break;
      }
      case 'addCacheFeedInfo':
      {
        if (canWork && (request.data != undefined)) {
          let data = request.data;
          alasql(`DELETE FROM \`CacheFeedInfo\` WHERE \`feed_id\` = ?`, [data.feed_id]);
          alasql(`INSERT INTO \`CacheFeedInfo\` VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.feed_id, data.title, data.description, data.loading, data.error, data.errorContent,
            data.showErrorContent, data.guid, data.image, data.category, data.date]);
        }
        break;
      }
      case 'updateCacheFeedInfoLoading':
      {
        if (canWork && (request.data != undefined)) {
          if (request.data.feed_id == undefined) {
            alasql(`UPDATE \`CacheFeedInfo\` SET \`loading\` = ?`, [request.data.loading]);
          } else {
            alasql(`UPDATE \`CacheFeedInfo\` SET \`loading\` = ? WHERE \`feed_id\` = ?`, [request.data.loading, request.data.feed_id]);
          }
        }
        break;
      }
      case 'updateCacheFeedInfo':
      {
        if (canWork && (request.data != undefined)) {
          let data = request.data;
          alasql(`UPDATE \`CacheFeedInfo\` SET \`title\` = ?, \`description\` = ?, \`loading\` = ?, \`error\` = ?, \`errorContent\` = ?, \`showErrorContent\` = ?, \`guid\` = ?, \`image\` = ?, \`category\` = ?, \`date\` = ? WHERE \`feed_id\` = ?`, [data.title,
            data.description, data.loading, data.error, data.errorContent, data.showErrorContent, data.guid, data.image, data.category, data.feed_id, data.date]);
        }
        break;
      }
      case 'getCacheFeedInfo':
      {
        if (canWork) {
          let requestsql = `SELECT feedinfo.*, gr.name
              FROM \`CacheFeedInfo\` as feedinfo
              LEFT JOIN \`Feeds\` AS feeds ON feeds.\`id\` = feedinfo.\`feed_id\`
              LEFT JOIN \`Group\` AS gr ON gr.\`id\` = feeds.\`group_id\``;
          let resultdata;
          if (request.data == undefined) {
            resultdata = alasql(requestsql);
          } else {
            if (request.data.feed_id == undefined) {
              resultdata = alasql(requestsql);
            } else {
              resultdata = alasql(`${requestsql}
                WHERE feedinfo.\`feed_id\` = ?`, [request.data.feed_id]);
            }
          }

          if (request.data != undefined) {
            if (request.data.feed_id != undefined) {
              for (let i = 0; i < resultdata.length; i++) {
              resultdata[i].items = alasql(
                `SELECT \`itemID\`, \`title\`, \`description\`, \`date\`, \`content\`, \`summary\`, \`updated\`, \`guid\`, \`category\`, \`comments\`, \`url\`, \`thumbnail\`, \`author\`, \`order\`
                FROM \`CacheFeedInfoItem\`
                WHERE \`idOrigin\` = ?`, [resultdata[i].feed_id]);
              }
            }
          }
          result(responseName(request.type), request.id, request.waitResponse, resultdata);
        }
        break;
      }
      case 'addCacheFeedInfoItem':
      {
        if (canWork && (request.data != undefined)) {
          alasql(`DELETE FROM \`CacheFeedInfoItem\` WHERE \`idOrigin\` = ? AND \`itemID\` = ?`, [request.data.idOrigin, request.data.itemID]);
          alasql(`INSERT INTO \`CacheFeedInfoItem\` VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [request.data.idOrigin, request.data.itemID, request.data.title, request.data.description, request.data.date,
            request.data.content, request.data.summary, request.data.updated, request.data.guid, request.data.category, request.data.comments, request.data.url, request.data.thumbnail, request.data.author, request.data.order]);
          }
        break;
      }
      case 'select':
      {
        if (canWork && (request.table != undefined)) {
          if (validTableNames.includes(request.table)) {
            let select = '*';
            if (request.select != undefined) {
              select = request.select;
            }
            let top = '';
            if (request.top != undefined) {
              top = `TOP(${request.top})`;
            }
            let sql = `SELECT ${top} ${select} FROM \`${request.table}\``;
            if (request.where != undefined) {
              sql += ` WHERE ${request.where}`;
            }
            if (request.order != undefined) {
              sql += ` ORDER BY ${request.order}`;
            }
            result(responseName(request.type), request.id, request.waitResponse, alasql(sql));
          }
        }
        break;
      }
      case 'insert':
      {
        if (canWork && (request.table != undefined) && (request.data != undefined)) {
          if (validTableNames.includes(request.table)) {
            let sql = `INSERT INTO \`${request.table}\` SET ?`;
            result(responseName(request.type), request.id, request.waitResponse, alasql(sql, [request.data]));
          }
        }
        break;
      }
      case 'update':
      {
        if (canWork && (request.table != undefined) && (request.data != undefined) && (request.where != undefined)) {
          if (validTableNames.includes(request.table)) {
            let sql = `UPDATE \`${request.table}\` SET ? WHERE ${request.where}`;
            result(responseName(request.type), request.id, request.waitResponse, alasql(sql, [request.data]));
          }
        }
        break;
      }
      case 'delete':
      {
        if (canWork && (request.table != undefined)) {
          if (validTableNames.includes(request.table)) {
            let sql = `DELETE FROM \`${request.table}\``;
            if (request.where != undefined) {
              sql += ` WHERE ${request.where}`;
            }
            result(responseName(request.type), request.id, request.waitResponse, alasql(sql));
          }
        }
        break;
      }
      case 'query':
      {
        if (canWork && (request.sql != undefined) && (request.data != undefined)) {
          result(responseName(request.type), request.id, request.waitResponse, alasql(request.sql, [request.data]));
        }
        break;
      }
      case 'getUniqueList':
      {
        if (canWork && (request.data != undefined)) {
          result(responseName(request.type), request.id, request.waitResponse, alasql(`SELECT INDEX _ FROM ? GROUP BY _`, [request.data]));
        }
        break;
      }
      case 'getOptions':
      {
        if (canWork) {
          let option = alasql('SELECT `value` FROM `Options`')
          if (option.length == 0) {
            option = {};
          } else {
            option = option[0].value;
          }
          if (Array.isArray(option)) {
            if (option.length == 0) {
              option = {};
            } else {
              option = option[0];
              if (option.value != undefined) {
                option = option.value;
              }
            }
          }
          result(responseName(request.type), request.id, request.waitResponse, option);
        }
        break;
      }
      case 'setOptions':
      {
        if (canWork && (request.data != undefined)) {
          alasql(`DELETE FROM \`Options\`;
            INSERT INTO \`Options\` VALUES (?)`, [request.data]);
        }
        break;
      }
      case 'setLastSelectedFeed':
      {
        if (canWork && (request.data != undefined)) {
          alasql(`DELETE FROM \`LastSelectedFeed\`;
            INSERT INTO \`LastSelectedFeed\` VALUES (?, ?)`, [request.data.lastSelectedFeedID, request.data.lastSelectedFeedType]);
        }
        break;
      }
      case 'getLastSelectedFeed':
      {
        if (canWork) {
          result(responseName(request.type), request.id, request.waitResponse, alasql(`SELECT * FROM \`LastSelectedFeed\``));
        }
        break;
      }
      case 'getFeeds':
      {
        if (canWork) {
          result(responseName(request.type), request.id, request.waitResponse, alasql(`SELECT feed.\`id\`, feed.\`title\`, feed.\`url\`, feed.\`maxitems\`, feed.\`order\`, feed.\`excludeUnreadCount\`, feed.\`urlredirected\`, COALESCE(gr.\`name\`, "") AS \`group\`
            FROM ( 
              SELECT ${readLaterFeedID} AS \`id\`, '' AS \`title\`, ? AS \`url\`, '' AS \`group_id\`, 99999 AS \`maxitems\`, -9 AS \`order\`, 1 AS \`excludeUnreadCount\`, false AS \`urlredirected\`
              UNION ALL 
              SELECT * FROM \`Feeds\`
            ) as feed 
            LEFT JOIN \`Group\` AS gr ON feed.\`group_id\` = gr.\`id\`
            ORDER BY Feed.\`order\`;`, [readlaterurl]));
          }
        break;
      }
      case 'addFeed':
      {
        if (canWork && (request.data != undefined)) {
          let id;
          if (request.data.id == undefined) {
            id = alasql(`SELECT MAX(\`id\`) FROM \`Feeds\``);
            if (id == undefined) {
              id = 0;
            }
            id++;
          } else {
            id = request.data.id;
            deleteFeed(id);
          }
          let idgroup = null;
          if ((request.data.group == '') || (request.data.group == null) || (request.data.group == undefined)) {
            idgroup = null;
          } else {
            let searchidgroup = alasql(`SELECT \`id\` FROM \`Group\` WHERE \`name\` = ?`, [request.data.group]);
            if (searchidgroup.length > 0) {
              idgroup = searchidgroup[0].id;
            }
            if ((idgroup == undefined) || (idgroup == "") || (idgroup == null)) {
              alasql(`INSERT INTO \`Group\` (name) VALUES (?)`, [request.data.group]);
              let searchidgroup = alasql(`SELECT \`id\` FROM \`Group\` WHERE \`name\` = ?`, [request.data.group]);
              idgroup = searchidgroup[0].id;
            }
          }
          alasql(`INSERT INTO \`Feeds\` VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, request.data.title, request.data.url, idgroup, request.data.maxitems, request.data.order, request.data.excludeUnreadCount, request.data.urlredirected]);
        }
        break;
      }
      case 'deleteFeed':
      {
        if (canWork && (request.feed_id != undefined)) {
          deleteFeed(request.feed_id);
        }
        break;
      }
      case 'updateFeed':
      {
        if (canWork && (request.data != undefined)) {
          let idgroup = null;
          if (request.data.group == '') {
            idgroup = null;
          } else {
            let searchidgroup = alasql(`SELECT \`id\` FROM \`Group\` WHERE \`name\` = ?`, [request.data.group]);
            if (searchidgroup.length > 0) {
              idgroup = searchidgroup[0].id;
            }
            if ((idgroup == undefined) || (idgroup == "") || (idgroup == null)) {
              alasql(`INSERT INTO \`Group\` (name) VALUES (?)`, [request.data.group]);
              let searchidgroup = alasql(`SELECT \`id\` FROM \`Group\` WHERE \`name\` = ?`, [request.data.group]);
              idgroup = searchidgroup[0].id;
            }
          }
          alasql(`UPDATE \`Feeds\` SET \`title\` = ?, \`url\` = ?, \`group_id\` = ?, \`maxitems\` = ?, \`order\` = ?, \`excludeUnreadCount\` = ?, \`urlredirected\` = ? WHERE \`id\` = ?`, [request.data.title, request.data.url, idgroup, request.data.maxitems, request.data.order, request.data.excludeUnreadCount, request.data.urlredirected, request.data.id]);
        }
        break;
      }
      case 'clearReadlaterinfo':
      {
        if (canWork) {
          alasql(`DELETE FROM \`ReadlaterinfoItem\`;`);
        }
        break;
      }
      case 'getReadlaterinfoItem':
      {
        if (canWork) {
          let resultdata = alasql(`SELECT *
            FROM \`ReadlaterinfoItem\`
          `).reduce((acc, item) => {
            acc.push({ author: item.author, category: undefined, comments: item.comments, content: item.content, date: item.date, idOrigin: item.idOrigin, itemID: item.itemID,
              order: item.order, summary: item.summary, thumbnail: item.thumbnail, title: item.title, updated: item.updated, url: item.url});
            return acc;
          }, []);

          let keys = Object.keys(resultdata);
          for (let key of keys) {
            resultdata[key].category = alasql(`SELECT cat.\`name\`
            FROM \`ItemCategories\` AS itemcat
            LEFT JOIN \`Categories\` AS cat ON itemcat.\`category_id\` = cat.\`category_id\`
            WHERE (itemcat.\`idOrigin\` = ?) AND (itemcat.\`itemID\` = ?)`, [resultdata[key].idOrigin, resultdata[key].itemID]
            );
          }

          result(responseName(request.type), request.id, request.waitResponse, resultdata);
        }
        break;
      }
      case 'setReadlaterinfoItem':
      {
        if (canWork && (request.data != undefined)) {
          let result = alasql(`INSERT INTO \`ReadlaterinfoItem\` VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [request.data.itemID, request.data.title,
            request.data.summary, request.data.thumbnail, request.data.content, request.data.date, request.data.guid, request.data.order, 
            request.data.idOrigin, request.data.updated, request.data.url, request.data.author, request.data.comments]);
          if (request.data.category_names != undefined) {
            request.data.category_names.forEach(category_name => {
              let category_id = alasql(`SELECT \`category_id\` FROM \`Categories\` WHERE \`name\` = ?`, [category_name]);
              if (category_id == undefined) {
                category_id = alasql(`SELECT MAX(\`category_id\`) FROM \`Categories\``);
                if (category_id == undefined) {
                  category_id = 0;
                }
                category_id++;
                alasql(`INSERT INTO \`Categories\` VALUES (?, ?)`, [category_id, category_name]);
              }
              alasql(`INSERT INTO \`ItemCategories\` VALUES (?, ?)`, [request.data.itemID, category_id]);
            });
          }
        }
        break;
      }
      case 'removeReadlaterinfoItem':
      {
        if (canWork && (request.data.itemID != undefined)) {
          let item = alasql(`SELECT \`itemID\` FROM \`ReadlaterinfoItem\` WHERE (\`idOrigin\` = ?) AND (\`itemID\` = ?)`, [request.data.idOrigin, request.data.itemID]);
          if (item != undefined) {
            let categories = alasql(`SELECT \`category_id\` FROM \`ItemCategories\` WHERE (\`idOrigin\` = ?) AND (\`itemID\` = ?)`, [request.data.idOrigin, request.data.itemID]);
            alasql(`DELETE FROM \`ItemCategories\` WHERE (\`idOrigin\` = ?) AND (\`itemID\` = ?)`, [request.data.idOrigin, request.data.itemID]);
            if (categories != undefined) {
              categories.forEach(category => {
                let count = alasql(`SELECT COUNT(*) FROM \`ItemCategories\` WHERE \`category_id\` = ?`, [category.category_id]);
                if (count == 0) {
                  alasql(`DELETE FROM \`Categories\` WHERE \`category_id\` = ?`, [category.category_id]);
                }
              });
            }
          }
          let result = alasql(`DELETE FROM \`ReadlaterinfoItem\` WHERE (\`idOrigin\` = ?) AND (\`itemID\` = ?)`, [request.data.idOrigin, request.data.itemID]);
        }
        break;
      }
      case 'getColors':
      {
        if (canWork) {
          result(responseName(request.type), request.id, request.waitResponse, alasql('SELECT * FROM `Colors`'));
        }
        break;
      }
      case 'addColor':
      {
        if (canWork && (request.data != undefined) && (request.data.id != undefined)) {
          alasql(`DELETE FROM \`Colors\` WHERE \`id\` = ?`, [request.data.id]);
          alasql(`INSERT INTO \`Colors\` VALUES (?, ?, ?, ?, ?)`, [request.data.id, request.data.name, request.data.color, request.data.fontColor, request.data.order]);
        }
        break;
      }
      case 'deleteColor':
      {
        if (canWork) {
          if (request.data != undefined) {
            if (request.data.id != undefined) {
              alasql(`DELETE FROM \`Colors\` WHERE \`id\` = ?`, [request.data.id]);
              break;
            }
          }
          alasql(`DELETE FROM \`Colors\``);
        }
        break;
      }
      case 'modifyColor':
      {
        if (canWork && (request.data != undefined)) {
          alasql(`UPDATE \`Colors\` SET \`name\` = ?, \`color\` = ?, \`fontColor\` = ?, \`order\` = ? WHERE \`id\` = ?`, [request.data.name, request.data.color, request.data.fontColor, request.data.order, request.data.id]);
        }
        break;
      }
      case 'getUnreadTotal':
      {
        if (canWork) {
          result(responseName(request.type), request.id, request.waitResponse, alasql(`SELECT SUM(\`unreadtotal\`) FROM \`Unreadinfo\``));
        }
        break;
      }
      case 'getUnreadinfo':
      {
        if (canWork) {
          result(responseName(request.type), request.id, request.waitResponse, alasql(`SELECT \`feed_id\`, \`unreadtotal\` FROM \`Unreadinfo\``));
        }
        break;
      }
      case 'getUnreadinfoFull':
      {
        if (canWork) {
          let resultdata = alasql(`
            SELECT \`feed_id\`, \`unreadtotal\`
            FROM \`Unreadinfo\`
          `).reduce((acc, item) => {
            acc[item.feed_id] = { unreadtotal: item.unreadtotal, readitems: {} }
            return acc;
          }, {});

          let keys = Object.keys(resultdata);
          for (let key of keys) {
            resultdata[key].readitems = alasql(`
              SELECT \`itemHash\`, \`value\`
              FROM \`UnreadinfoItem\`
              WHERE \`feed_id\` = ${key}
            `).reduce((acc, item) => {
              acc[item.itemHash] = item.value;
              return acc;
            }, {});
          }

          result(responseName(request.type), request.id, request.waitResponse, resultdata);
        }
        break;
      }
      case 'setUnreadinfo':
      {
        if (canWork && (request.data != undefined)) {
          alasql(`DELETE FROM \`Unreadinfo\` WHERE \`feed_id\` = ?`, [request.data.feed_id]);
          alasql(`INSERT INTO \`Unreadinfo\` VALUES (?, ?)`, [request.data.feed_id, request.data.unreadtotal]);
        }
        break;
      }
      case 'clearUnreadinfo':
      {
        if (canWork) {
          if ((request.data != undefined)) {
            alasql(`DELETE FROM \`Unreadinfo\` WHERE \`feed_id\` = ?`, [request.data.feed_id]);
            alasql(`DELETE FROM \`UnreadinfoItem\` WHERE \`feed_id\` = ?`, [request.data.feed_id]);
          } else {
            alasql(`DELETE FROM \`Unreadinfo\``);
            alasql(`DELETE FROM \`UnreadinfoItem\``);
          }
        }
        break;
      }
      case 'addUnreadinfoItem':
      {
        if (canWork && (request.data != undefined)) {
          alasql(`DELETE FROM \`UnreadinfoItem\` WHERE \`feed_id\` = ? AND \`itemHash\` = ?`, [request.data.feed_id, request.data.itemHash]);
          alasql(`INSERT INTO \`UnreadinfoItem\` VALUES (?, ?, ?)`, [request.data.feed_id, request.data.itemHash, request.data.value]);
        }
        break;
      }
      case 'deleteUnreadinfoItem':
      {
        if (canWork && (request.data != undefined)) {
          alasql(`DELETE FROM \`UnreadinfoItem\` WHERE \`feed_id\` = ? AND \`itemHash\` = ?`, [request.data.feed_id, request.data.itemHash]);
        }
        break;
      }
      case 'cleanUnreadinfoItem':
      {
        if (canWork && (request.data.value != undefined)) {
          alasql(`DELETE FROM \`UnreadinfoItem\` WHERE \`value\` < ?`, [request.data.value]);
        }
        break;
      }
      case 'cleanUpUnreadOrphans':
      {
        if (canWork) {
          alasql(`
            DELETE FROM \`UnreadinfoItem\`
            WHERE \`feed_id\` IN (
                SELECT \`UnreadinfoItem\`.\`feed_id\`
                FROM \`UnreadinfoItem\`
                LEFT JOIN \`Unreadinfo\` ON \`UnreadinfoItem\`.\`feed_id\` = \`Unreadinfo\`.\`feed_id\`
                WHERE \`Unreadinfo\`.\`feed_id\` IS NULL)`);
        }
        break;
      }
      case 'getGroups':
      {
        if (canWork) {
          let resultdata = alasql(
            `SELECT gr.\`name\`, gr.\`id\`, SUM(unread.\`unreadtotal\`) AS \`unreadCount\` 
            FROM \`Group\` as gr
            LEFT JOIN (
              SELECT \`group_id\`
              FROM \`Feeds\`
              WHERE \`excludeUnreadCount\` = false
              ) AS feeds ON feeds.\`group_id\` = gr.\`id\`
            LEFT JOIN \`Unreadinfo\` AS unread ON unread.\`feed_id\` = feeds.\`id\`
            GROUP BY gr.\`name\`, gr.\`id\``
          ).reduce((acc, item) => {
            acc[item.id] = { title: item.name, url: groupurl, group: '', maxitems: 99999, order: 0, id: item.id, unreadCount: item.unreadCount == undefined ? 0 : item.unreadCount };
            return acc;
          }, {});
  
          result(responseName(request.type), request.id, request.waitResponse, resultdata);
        }
        break;
      }
      case 'getGroupInfo':
      {
        if (canWork) {
          let requestsql = `SELECT \`id\`, \`name\` FROM \`Group\``;
          let resultdata;
          let filterbygroup = false;
          let getallfeedinfo = false;
          if (request.data != undefined) {
            if ((request.data.group_id != undefined) && (request.data.group_id != allFeedsID)) {
              filterbygroup = true;
              resultdata = alasql(`${requestsql}
                WHERE \`id\` = ?`, [request.data.group_id]);
            }
            getallfeedinfo = (request.data.group_id != undefined) && (request.data.group_id == allFeedsID);
            if (getallfeedinfo) {
              resultdata = [{ id: allFeedsID, name: 'All Feeds' }];
            }
          }
          if (!filterbygroup && !getallfeedinfo) {
            resultdata = alasql(requestsql);
          }
          resultdata = resultdata.reduce((acc, item) => {
            acc[item.id] = { group: item.name };
            return acc;
          }, {});
          let keys = Object.keys(resultdata);
          for (let key of keys) {
            let intermResult = alasql(`SELECT feedinfo.\`title\`, feedinfo.\`description\`, feedinfo.\`loading\`, feedinfo.\`error\`, feedinfo.\`errorContent\`, feedinfo.\`showErrorContent\`, feedinfo.\`guid\`, feedinfo.\`image\`, feedinfo.\`category\`, feedinfo.\`date\`, feedinfo.\`feed_id\`, feeds.\`maxitems\`
              FROM \`Feeds\` AS feeds
              LEFT JOIN \`CacheFeedInfo\` AS feedinfo ON feedinfo.\`feed_id\` = feeds.\`id\`
              ${(key != allFeedsID) ? `WHERE feeds.\`group_id\` = ${key}` : ''}`);
            if (intermResult.length > 0) {
              resultdata[key] = { ...resultdata[key], ...intermResult[0] };
              resultdata[key].items = [];
              delete resultdata[key].maxitems;
              if (filterbygroup || getallfeedinfo) {
                if ((request.data.group_id == key) || getallfeedinfo) {
                  for (let i = 0; i < intermResult.length; i++) {
                    let items = alasql(
                      `SELECT \`itemID\`, \`title\`, \`description\`, \`date\`, \`content\`, \`summary\`, \`updated\`, \`guid\`, \`category\`, \`comments\`, \`url\`, \`thumbnail\`, \`author\`, \`order\`, \`idOrigin\`
                      FROM \`CacheFeedInfoItem\`
                      WHERE \`idOrigin\` = ?`, [intermResult[i].feed_id]);
                      if ((intermResult[i].maxitems != undefined) && (intermResult[i].maxitems > 0)) {
                        items.splice(intermResult[i].maxitems);
                      }
                    resultdata[key].items.push(...items);
                  }
                }
              }
            }
          }
          result(responseName(request.type), request.id, request.waitResponse, resultdata);
        }
        break;
      }
      case 'executeSql':
      {
        if (canWork && (request.sql != undefined)) {
          result(responseName(request.type), request.id, request.waitResponse, alasql(request.sql));
        }
        break;
      }
      case 'saveAll':
      {
        if (canWork) {
          result(responseName(request.type), request.id, true, {
            Colors: exportTableToJson('Colors'),
            Group: exportTableToJson('Group'),
            Feeds: exportTableToJson('Feeds'),
            LastSelectedFeed: exportTableToJson('LastSelectedFeed'),
            Options: request.data != undefined ? request.data : exportTableToJson('Options'),
            ReadlaterinfoItem: exportTableToJson('ReadlaterinfoItem'),
            ItemCategories: exportTableToJson('ItemCategories'),
            Categories: exportTableToJson('Categories'),
            Unreadinfo: exportTableToJson('Unreadinfo'),
            UnreadinfoItem: exportTableToJson('UnreadinfoItem'),
            Cache: exportTableToJson('Cache'),
            CacheFeedInfo: exportTableToJson('CacheFeedInfo'),
            CacheFeedInfoItem: exportTableToJson('CacheFeedInfoItem')
          });
        }
        break;
      }
    }
  };
  if (!canWork && initialized && tableInitialized === validTableNames.length) {
    canWork = true;
    result('event', null, true, 'initialized');
  }
  if (event.type == 'requests') {
    result('responseRequestsFinished', event.id, true, null);
  }
};

function exportTableToJson(tableName) {
  const data = alasql(`SELECT * FROM \`${tableName}\``);
  return data;
}

function importJsonToTable(jsonData, tableName) {
  if (!initialized) {
    return false;
  }
  if (!validTableNames.includes(tableName)) {
    return false;
  }
  let result = true;
  alasql(`DELETE FROM \`${tableName}\``);
  if (jsonData != null) {
    try {
      if (Array.isArray(jsonData)) {
        jsonData.forEach(row => {
          // Create an array of keys for columns
          const keys = Object.keys(row).map(key => `\`${key}\``).join(', ');
          // Create an array of parameters for values
          const placeholders = Object.keys(row).map(() => '?').join(', ');
          // Create an array of values for the parameters
          const values = Object.values(row);

          const query = `INSERT INTO \`${tableName}\` (${keys}) VALUES (${placeholders})`;
          alasql(query, values);
        });
      } else {
        if (jsonData == undefined) {
          result = false;
        }
      }
    }
    catch (error) {
      log(`error ${tableName} data: ${JSON.stringify(jsonData)} ==> ${error}`);
      result = false;
    }
  }
  return result;
}

function deleteFeed(feed_id) {
  var feedIdInt = parseInt(feed_id, 10);
  alasql(`DELETE FROM \`Feeds\` WHERE \`id\` = ?`, [feedIdInt]);
}

function responseName(id) {
  return 'response' + capitalFirstLetter(id);
}

function capitalFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
