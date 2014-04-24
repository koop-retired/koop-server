var async = require('async');

// concurrent queue for feature pages 
exports.taskQueue = async.queue(function (task, callback) {
  // tell the cache to ignore data in a processing state 
  task.options.bypassProcessing = true;
  
  // get the geojson for the task key
  Cache.db.select( task.key, task.options, function( err, result ){
    finish(task.dir, task.key +":"+ (task.options.layer || 0), result[0], task.hash, callback);
  }); 

}, 2);

function finish( dir, key, geojson, hash, callback ){

  var _update = function( info ){
    Cache.updateInfo(key, info, function(err, success){
      callback();
    });
  };

  Cache.getInfo(key, function(err, info){
    delete info.status;
    if (info.format){
      Exporter.exportToFormat( info.format, dir, hash, geojson, function(err, result){
        delete info.format; 
        _update( info );
      }); 
    } else {
      _update( info );
    }
  });
};
