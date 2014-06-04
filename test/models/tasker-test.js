var should = require('should'),
  spawnasync = require('spawn-async'),
  bunyan = require('bunyan'),
  fs = require('fs');

before(function (done) {
  global.config = {
    data_dir: __dirname + '/output/'
  };

  // A bunyan log is required for the async workers 
  global.config.log = new bunyan({
    'name': 'koop-log',
    streams: [{
      type: 'rotating-file',
      path: __dirname + '/output/log.txt',
      period: '1d',
      count: 3
    }]
  });

  // allow us to kick off system commands w/o blocking
  global.config.worker = spawnasync.createWorker({'log': global.config.log});

  global.peechee = null;
  Cache = require('../helpers/Cache.js');
  Exporter = require('../../lib/Exporter.js');
  Tasker = require('../../lib/Tasker.js');
  done();
});

describe('The Tasker', function(){

    describe('when exporting geojson', function(){
      it('should return a pointer to file', function(done){
        var task = {
          format: 'json',
          dir:'json',
          key: 'agol:6c4b81eb2aed40d5840b8cb470983844',
          hash: 'testhash',
          options: {
            layer: 0
          }
        };        

        Tasker.taskQueue.push(task, function(err, file){
          var exists = fs.existsSync(file);
          exists.should.equal(true);
          fs.unlinkSync(file);
          done();
        });

      });
    });

});

