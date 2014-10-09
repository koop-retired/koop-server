var should = require('should'),
  Files = require('../../lib/Files.js');

before(function (done) {
  var config = {};
  files = new Files(config);
  done();
});

describe('Files', function(){

    describe('when initializing files', function(){
      it('local and S3 storage should be false when nothing is configured', function(done){
        // init with an empty dir 
        var files = new Files( {} );
        files.localDir.should.equal( false );
        files.s3Bucket.should.equal( false );
        done();
      });
      it('local storage should be configured when passing a local dir', function(done){
        // init with a local dir 
        var dir = __dirname + '/output' 
        var files = new Files( { data_dir: dir } );
        files.localDir.should.equal( dir );
        files.s3Bucket.should.equal( false );
        done();
      });
      it('local storage and s3 should be configured when passing a local dir and a bucket', function(done){
        // init with a local dir 
        var dir = __dirname + '/output',
          bucket = 'test-bucket';
        var files = new Files( { data_dir: dir, s3: { bucket: bucket } } );
        files.localDir.should.equal( dir );
        files.s3Bucket.should.equal( bucket );
        done();
      });
    });
 
    describe('when checking if a file exists', function(){
      it('with local storage a non-existant', function(done){
        var dir = __dirname + '/output';
        var files = new Files( { data_dir: dir } );
        files.exists( 'dummy.png', function( exists ){
          exists.should.equal( false );
          done();
        });
      });
      it('with local storage and existing', function(done){
        var dir = __dirname + '/../fixtures';
        var files = new Files( { data_dir: dir } );
        files.exists( 'repo.geojson', function( exists ){
          exists.should.equal( true );
          done();
        });
      });
    });

    describe('when reading a file', function(){
      it('with local storage', function(done){
        var dir = __dirname + '/../fixtures';
        var files = new Files( { data_dir: dir } );
        files.read( 'repo.geojson', function( err, data ){
          should.not.exist( err );
          should.exist( data );
          done();
        });
      });
    });

    describe('when writing a file', function(){
      it('with local storage', function(done){
        var dir = __dirname + '/output',
          name = 'test.json';
        var files = new Files( { data_dir: dir } );
        files.write( name, JSON.stringify({"say":"yes"}), function( err, success ){
          should.not.exist( err );
          files.exists( name, function( exists ){
            exists.should.equal( true );
            done();
          });
        });
      });
    });

    describe('when removing a file', function(){
      it('with local storage', function(done){
        var dir = __dirname + '/output',
          name = 'test2.json';
        var files = new Files( { data_dir: dir } );
        files.write( name, JSON.stringify({"say":"yes"}), function( err, success ){
          should.not.exist( err );
          files.remove(name, function(err, success){
            files.exists( name, function( exists ){
              exists.should.equal( false );
              done();
            });
          });
        });
      });
    });

});

