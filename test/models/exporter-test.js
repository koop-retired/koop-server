var should = require('should'),
  fs = require('fs');

var snowData, exporter;

before(function (done) {
  var Cache = {
    data_dir: __dirname + '/output/'
  };
  snowData = require('../fixtures/snow.geojson');
  var Exporter = require('../../lib/Exporter.js');
  exporter = new Exporter( {Cache: Cache} );
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

