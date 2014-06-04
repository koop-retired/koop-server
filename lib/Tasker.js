var async = require('async');

// concurrent queue for feature pages 
exports.taskQueue = async.queue(function (task, callback) {
  // tell the cache to ignore data in a processing state 
  task.options.bypassProcessing = true;
  finish(task.dir, task.key +":"+ (task.options.layer || 0), task.options, {}, task.hash, callback);
}, 2);

function finish( dir, key, options, geojson, hash, callback ){
  var limit = 20000;

  var _update = function( info, cb ){
    Cache.updateInfo(key, info, function(err, success){
      cb();
    });
  };

  Cache.getInfo(key, function(err, info){
    delete info.status;
    info.format = 'json';
    if (info.format){
      var keys = key.split(':');
      var format = info.format;
      delete info.format;
      Cache.getCount(key, function(err, count){
        if ( count > limit ){
          Exporter.exportLarge( format, dir, key, [keys[0],keys[1]].join(':'), key, options, function(err, result){
          _update( info, function(){
            callback(err, result);
          });
          });
        } else {
  
          Cache.get( keys[0], keys[1], options, function(err, entry ){
            if (!err){
              Exporter.exportToFormat( format, dir, hash, entry[0], options, function(err, result){
                _update( info, function(){
                  callback(err, result);
                });
              }); 
            }
          });
        }
      })
    } else {
      _update( info, callback );
    
    }
  });
}
