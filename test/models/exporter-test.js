var should = require('should'),
  fs = require('fs');

before(function (done) {
  global.config = {
    data_dir: __dirname + '/output/'
  };
  global.peechee = null;
  snowData = require('../fixtures/snow.geojson');
  Exporter = require('../../lib/Exporter.js');
  done();
});

describe('Extent Model', function(){

    describe('when exporting geojson', function(){
      it('should return a pointer to file', function(done){
        var format = 'json',
          dir = 'json',
          key = 'snow-data';

        Exporter.exportToFormat(format, dir, key, snowData, {}, function( err, file ){
          var exists = fs.existsSync(file);
          exists.should.equal(true);
          done();
        });
      });
    });

});

