var Cache = require('../../lib/Cache.js'),
  PostGIS = require('../../lib/PostGIS.js'),
  config = require('config');

global.config = config;

Cache.db = PostGIS.connect(config.db.test.postgis.conn);

module.exports = Cache;
