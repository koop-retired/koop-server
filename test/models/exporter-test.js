var should = require('should'),
  fs = require('fs');
  spawnasync = require('spawn-async'),
  bunyan = require('bunyan');

var snowData, exporter;

before(function (done) {
  data_dir: __dirname + '/output/'
  
  var log = new bunyan({
    'name': 'test-log',
    streams: [{
      type: 'rotating-file',
      path: __dirname + '/output/log.txt',
      period: '1d',
      count: 3
    }]
  });
  var worker = spawnasync.createWorker({'log': log});

  snowData = require('../fixtures/snow.geojson');

  var Exporter = require('../../lib/Exporter.js');
  exporter = new Exporter( Cache, worker );
  done();
});

describe('exporter Model', function(){

    describe('when exporting geojson', function(){
      it('should return a pointer to file', function(done){
        var format = 'json',
          dir = 'json',
          key = 'snow-data';

        exporter.exportToFormat(format, dir, key, snowData, {}, function( err, file ){
          var exists = fs.existsSync(file);
          exists.should.equal(true);
          done();
        });
      });
    });

});

