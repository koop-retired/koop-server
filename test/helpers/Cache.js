var Cache = require('../../lib/Cache.js'),
  PostGIS = require('../../lib/PostGIS.js');

Cache.db = PostGIS.connect("postgres://localhost/koopdev");

module.exports = Cache;
