var should = require('should');

before(function (done) {
  key = 'test:repo:file';
  repoData = require('../fixtures/snow2.geojson');
  snowData = require('../fixtures/snow.geojson');
  PostGIS = require('../../lib/PostGIS.js');
  conn = {
    data_dir: '/usr/local/koop/',
    db: { 
      postgis: {
        conn: "postgres://localhost/koopdev"
      }
    }
  };
  PostGIS.connect(conn.db.postgis.conn, function(){
    done();
  });
});

describe('PostGIS Model Tests', function(){

    describe('when caching a github file', function(){

      beforeEach(function(done){
        PostGIS.insert( key, repoData[0], 0, done);
      });

      afterEach(function(done){
        PostGIS.remove( key+':0', done);
      });

      it('should error when missing key is sent', function(done){
        PostGIS.getInfo(key+'-BS:0', function( err, data ){
          should.exist( err );
          done();
        });
      });

      it('should return info', function(done){
        PostGIS.getInfo(key+':0', function( err, data ){
          should.not.exist( err );
          done();
        });
      });

      it('should update info', function(done){
        PostGIS.updateInfo(key+':0', {test: true}, function( err, data ){
          should.not.exist( err );
          PostGIS.getInfo(key+':0', function(err, data){
            data.test.should.equal(true);
            done();
          });
        });
      });

      it('should insert, data', function(done){
        var snowKey = 'test:snow:data';
        PostGIS.insert( snowKey, snowData, 0, function( error, success ){
          should.not.exist(error);
          success.should.equal( true );
          PostGIS.getInfo( snowKey + ':0', function( err, info ){
            should.not.exist(err);
            info.name.should.equal('snow.geojson');
            PostGIS.remove(snowKey+':0', function(err, result){
              should.not.exist( err );
              PostGIS.getInfo( snowKey + ':0', function( err, info ){
                should.exist( err );
                done();
              });
            });
          });
        });
      });

      it('should select data from db', function(done){
        PostGIS.select( key, { layer: 0 }, function( error, success ){
          should.not.exist(error);
          should.exist(success[0].features);
          done();
        });
      });

      it('should select data from db with filter', function(done){
        PostGIS.select( key, { layer: 0, where: '\'total precip\' = 0.31' }, function( error, success ){
          should.not.exist(error);
          should.exist(success[0].features);
          success[0].features.length.should.equal(5);
          done();
        });
      });
    });

});

