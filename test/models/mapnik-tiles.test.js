var should = require('should');

before(function (done) {
  data = require('../fixtures/co.6.6.24.json'); //5.5.12.geojson');
  global.config = {};
  Tiles = require('../../lib/Tiles.js');
  done();
});

describe('Mapnik Tiles Model', function(){

    describe('errors when params are wrong', function(){
      it('when missing a z', function(done){
        Tiles.get( {x: 1, y: 1, format: 'png', key: 'fake-key'}, {}, function( err, res ){
          should.exist(err);
          should.not.exist(res);
          done();
        });
      });
    });

    describe('vector-tiles', function(){
      it('when creating a tile', function(done){

        var file = __dirname + '/../fixtures/co.6.6.24.vector.pbf',
          format = 'vector.pbf';

        Tiles._stash( file, format, data, 5, 5, 12, function( err, res ){
          should.not.exist(err);
          should.exist(res);
          done();
        });
      });
    });

    describe('png-tiles', function(){
      it('when creating a tile', function(done){

        var file = __dirname + '/../fixtures/5.5.12.png',
          format = 'png';

        Tiles._stash( file, format, data, 5, 5, 12, function( err, res ){
          should.not.exist(err);
          should.exist(res);
          done();
        });
      });
    });

    describe('utf-tiles', function(){
      it('when creating a tile', function(done){

        var file = __dirname + '/../fixtures/5.5.12.utf',
          format = 'utf';

        Tiles._stash( file, format, data, 5, 5, 12, function( err, res ){
          should.not.exist(err);
          should.exist(res);
          done();
        });
      });
    });

});

