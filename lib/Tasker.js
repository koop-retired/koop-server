var async = require('async');

// concurrent queue for feature pages 
exports.taskQueue = async.queue(function (task, callback) {
  // tell the cache to ignore data in a processing state 
  task.options.bypassProcessing = true;
  finish(task, callback);
}, 2);

function finish( params, callback ){
  var limit = 10000;

  var layer = (params.options.layer || 0);

  var key = [params.type, params.id, layer].join(":");
    dir = params.id + '_' + layer;

  var _update = function( info, cb ){
    Cache.updateInfo(key, info, function(err, success){
      cb();
    });
  };

  Cache.getInfo(key, function(err, info){
    delete info.status;

    if (info.format){
      var format = info.format;
      delete info.format;

      Cache.getCount(key, function(err, count){
        if ( count > limit ){
          Exporter.exportLarge( format, params.id, params.hash, params.type, params.options, function(err, result){
            _update( info, function(){
              callback(err, result);
            });
          });

        } else {
          // export as normal 
          Cache.get( params.type, params.id, params.options, function(err, entry ){
            if (!err){
              Exporter.exportToFormat( format, dir, params.hash, entry[0], params.options, function(err, result){
                _update( info, function(){
                  callback(err, result);
                });
              }); 
            }
          });
        }
      })
    } else {
      _update( info, function(err, result) {
        callback(err, '');
      });
    }
  });
}
