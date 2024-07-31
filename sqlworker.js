importScripts('alasql.min.js'); 
importScripts('logworker.js'); 

const validTableNames = ['Colors', 'Group', 'Feeds', 'LastSelectedFeed', 'Options', 'ReadlaterinfoItem', 'ItemCategories', 'Categories', 'Unreadinfo', 'UnreadinfoItem', 'Cache', 'CacheFeedInfo', 'CacheFeedInfoItem'];

const readLaterFeedID = 9999999999;
const allFeedsID = 9999999998;
let initialized = false;
let tableInitialized = 0;
let canWork = false;
let readlaterurl;

function result(type, id, waitResponse, msg) {
  //log(`result: '${type}' waitResponse: ${waitResponse} msg: ${JSON.stringify(msg)}.`);
  if (waitResponse) {
    postMessage({ type, id, msg });
  }
}

self.onmessage = async function(event) {
  //log(`event: '${event.data.type}'.`);
  //log(`event.data: '${JSON.stringify(event.data)}'.`);
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

  requests.forEach(request => {
    //log(`request: '${request.type}'.`);
    switch (request.type) {
      case 'init':
      {
        alasql("DROP TABLE IF EXISTS `Colors`;\
          CREATE TABLE `Colors` (`name` string PRIMARY KEY , `color` string, `order` INT);");

        alasql("DROP TABLE IF EXISTS `Group`;\
          CREATE TABLE `Group` (`id` INT AUTO_INCREMENT PRIMARY KEY , `name` string);");

        alasql("DROP TABLE IF EXISTS `Feeds`;\
          CREATE TABLE Feeds (`id` INT PRIMARY KEY , `title` string, `url` string, `group_id` INT, `maxitems` INT, `order` INT, `excludeUnreadCount` boolean, `urlredirected` boolean);");

        alasql("DROP TABLE IF EXISTS `LastSelectedFeed`;\
          CREATE TABLE `LastSelectedFeed` (`lastSelectedFeedID` INT, `lastSelectedFeedType` string);");

        alasql("DROP TABLE IF EXISTS `Options`;\
          CREATE TABLE `Options` (`value` JSON);");

        alasql("DROP TABLE IF EXISTS `ReadlaterinfoItem`;\
          CREATE TABLE `ReadlaterinfoItem` (`readlaterinfo_id` INT, `itemiD` string, `title` string, `summary` string, `thumbnail` string, `content` string,\
            `date` string, `guid` string, `order` INT, idOrigin string, `updated` boolean, `url` string, `author` string, `comments` string, PRIMARY KEY (`readlaterinfo_id`, `itemiD`));");

        alasql("DROP TABLE IF EXISTS `ItemCategories`;\
          CREATE TABLE `ItemCategories` (`itemID` string, `category_id` INT, PRIMARY KEY (`itemID`, `category_id`));");

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
      case 'readlaterurl':
      {
        readlaterurl = request.data;
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
          result(responseName(request.type), request.id, request.waitResponse, alasql(`
            SELECT item.*, ARRAY(cat.name) AS category_names
            FROM \`ReadlaterinfoItem\` AS item
            LEFT JOIN \`ItemCategories\` AS itemcat ON item.itemID = itemcat.itemID
            LEFT JOIN \`Categories\` AS cat ON itemcat.category_id = cat.category_id
            GROUP BY item.\`readlaterinfo_id\`, item.\`itemiD\`, item.\`title\`, item.\`summary\`, item.\`thumbnail\`, item.\`content\`,
            item.\`date\`, item.\`guid\`, item.\`order\`, item.\`idOrigin\`, item.\`updated\`, item.\`url\`, item.\`author\`, item.\`comments\`
          `));
        }
        break;
      }
      case 'setReadlaterinfoItem':
      {
        if (canWork && (request.data != undefined)) {
          alasql(`INSERT INTO \`ReadlaterinfoItem\` VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [readLaterFeedID, request.data.itemID, request.data.title,
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
        if (canWork && (request.itemID != undefined)) {
          let item = alasql(`SELECT \`readlaterinfo_id\` FROM \`ReadlaterinfoItem\` WHERE \`itemID\` = ?`, [request.itemID]);
          if (item != undefined) {
            let categories = alasql(`SELECT \`category_id\` FROM \`ItemCategories\` WHERE \`itemID\` = ?`, [request.itemID]);
            alasql(`DELETE FROM \`ItemCategories\` WHERE \`itemID\` = ?`, [request.itemID]);
            if (categories != undefined) {
              categories.forEach(category => {
                let count = alasql(`SELECT COUNT(*) FROM \`ItemCategories\` WHERE \`category_id\` = ?`, [category.category_id]);
                if (count == 0) {
                  alasql(`DELETE FROM \`Categories\` WHERE \`category_id\` = ?`, [category.category_id]);
                }
              });
            }
          }
          alasql(`DELETE FROM \`ReadlaterinfoItem\` WHERE \`itemID\` = ?`, [request.itemID]);
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
        if (canWork && (request.data != undefined) && (request.data.name != "")) {
          alasql(`DELETE FROM \`Colors\` WHERE \`name\` = ?`, [request.data.name]);
          alasql(`INSERT INTO \`Colors\` VALUES (?, ?, ?)`, [request.data.name, request.data.color, request.data.order]);
        }
        break;
      }
      case 'deleteColor':
      {
        if (canWork) {
          if (request.name != undefined) {
            alasql(`DELETE FROM \`Colors\` WHERE \`name\` = ?`, [request.name]);
          } else {
            alasql(`DELETE FROM \`Colors\``);
          }
        }
        break;
      }
      case 'modifyColor':
      {
        if (canWork && (request.data != undefined)) {
          alasql(`UPDATE \`Colors\` SET ? WHERE \`name\` = ?`, [request.data, request.name]);
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
          result(responseName(request.type), request.id, request.waitResponse, alasql(`
            SELECT feedspt.\`feed_id\`, feedspt.\`unreadtotal\`, items.\`itemHash\`, items.\`value\`
            FROM \`Unreadinfo\` AS feedspt
            LEFT JOIN \`UnreadinfoItem\` AS items ON items.feed_id = feedspt.feed_id
          `));
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
        if (canWork && (request.data != undefined)) {
          alasql(`DELETE FROM \`Unreadinfo\` WHERE \`feed_id\` = ?`, [request.data.feed_id]);
          alasql(`DELETE FROM \`UnreadinfoItem\` WHERE \`feed_id\` = ?`, [request.data.feed_id]);
        } else {
          alasql(`DELETE FROM \`Unreadinfo\``);
          alasql(`DELETE FROM \`UnreadinfoItem\``);
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
      case 'getGroups':
      {
        if (canWork) {
          result(responseName(request.type), request.id, request.waitResponse, alasql(
            `SELECT gr.\`name\` AS title, '' AS URL,'' AS \`group\`, 99999 AS maxitems, 0 AS \`order\`, gr.\`id\`, SUM(unread.\`unreadtotal\`) AS \`unreadCount\` 
            FROM \`Group\` as gr
            LEFT JOIN (
              SELECT \`group_id\`
              FROM \`Feeds\`
              WHERE \`excludeUnreadCount\` = false
              ) AS feeds ON feeds.\`group_id\` = gr.\`id\`
            LEFT JOIN \`Unreadinfo\` AS unread ON unread.\`feed_id\` = feeds.\`id\`
            GROUP BY gr.\`name\`, gr.\`id\``
          ));
        }
        break;
      }
      case 'getGroupInfo':
      {
        if (canWork) {
          let requestsql = `SELECT feedinfo.\`title\`, feedinfo.\`description\`, gr.\`name\` as \`group\`, feedinfo.\`loading\`, feedinfo.\`error\`, feedinfo.\`errorContent\`, feedinfo.\`showErrorContent\`, feedinfo.\`guid\`, feedinfo.\`image\`, feedinfo.\`category\`, feedinfo.\`date\`, feedinfo.\`feed_id\`
            FROM \`Group\` AS gr
            LEFT JOIN \`Feeds\` AS feeds ON feeds.\`group_id\` = gr.\`id\`
            LEFT JOIN \`CacheFeedInfo\` AS feedinfo ON feedinfo.\`feed_id\` = feeds.\`id\``;
          let resultdata;
          if (request.data == undefined) {
            resultdata = alasql(requestsql);
          } else {
            if (request.data.group_id == undefined) {
              resultdata = alasql(requestsql);
            } else {
              resultdata = alasql(`${requestsql}
                WHERE gr.\`id\` = ?`, [request.data.group_id]);
            }
          }

          for (let i = 0; i < resultdata.length; i++) {
            resultdata[i].items = alasql(
              `SELECT \`itemID\`, \`title\`, \`description\`, \`date\`, \`content\`, \`summary\`, \`updated\`, \`guid\`, \`category\`, \`comments\`, \`url\`, \`thumbnail\`, \`author\`, \`order\`
              FROM \`CacheFeedInfoItem\`
              WHERE \`idOrigin\` = ?`, [resultdata[i].feed_id]);
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
  });
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
