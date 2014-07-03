var Cache = require('../../lib/Cache.js'),
  PostGIS = require('../../lib/PostGIS.js'),
  SQLite = require('../../lib/SQLite.js'),
  config = require('config');

global.config = config;

if (config.db.test.postgis)
  Cache.db = PostGIS.connect(config.db.test.postgis.conn);
else if (config.db.test.sqlite)
  Cache.db = SQLite.connect(config.db.test.sqlite);

module.exports = Cache;
