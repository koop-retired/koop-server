var AWS = require('aws-sdk'),
  fs = require('fs'),
  child = require('child_process'),
  mkdirp = require('mkdirp');

var Files = function( config ){

  this.localDir = config.data_dir || false;
  this.s3Bucket = (config.s3) ? config.s3.bucket : false; 
  if ( this.s3Bucket ) {
    this.s3 = new AWS.S3();
  }

  // returns the path to the file locally or on s3
  this.path = function( subdir, name, callback ){
    var self = this;
    if ( this.s3 ){
      var params = { 
        Bucket: [this.s3Bucket, subdir].join('/'), 
        Key: name
      };  
      this.s3.getObjectAcl(params, function(err, res){
        if (err){
          callback( err.message, null );
        } else {
          self.s3.getSignedUrl( 'getObject', params, function ( err, url ) {
            callback( err, url.split('?')[0] );
          });
        }
      });
    } else if ( this.localDir ){
      var dir = [ this.localDir, subdir, name ].join('/');
      fs.exists( dir, function( exists ){
        if ( exists ){
          callback(null, dir);
        } else {
          callback('File not found on local filesystem', null);
        }
      });
    } else {
      callback('No filesystem configured', null);
    }
  };

  // returns a boolean whether the file exists on s3 or local storage
  this.exists = function(subdir, name, callback){
    var self = this;
    if ( this.s3 ){
      var params = { 
        Bucket: [this.s3Bucket, subdir].join('/'), 
        Key: name 
      };
      this.s3.getObjectAcl(params, function(err, res){
        if (err){
          callback( false );
        } else {
          self.s3.getSignedUrl( 'getObject', params, function ( err, url ) {
            callback( true, url.split('?')[0] );
          });
        }
      });
    } else if ( this.localDir ){
      var path = [ this.localDir, subdir, name ].join('/');
      fs.exists( path, function( exists ){
        if ( exists ){
          callback(true, path);
        } else {
          callback( false );
        }
      });
    } else {
      callback(false, 'No filesystem configured');
    }
  };

  // reads a file to either s3 or local fs 
  this.read = function( subdir, name, callback ){
    if ( this.s3 ){
      var params = { 
        Bucket: [this.s3Bucket, subdir].join('/'), 
        Key: file 
      };
      this.s3.getObject(params, callback);
    } else if ( this.localDir ){
      fs.readFile( [ this.localDir, subdir, name ].join('/'), function( err, data ){
        callback(null, data.toString());
      });
    } else {
      callback('No filesystem configured', null);
    }
  };

  // writes a file to either s3 or local fs 
  this.write = function( subdir, name, data, callback ){
    var self = this;
    if ( this.s3 ){
      var bucket = [this.s3Bucket, subdir].join('/');
      this.s3.createBucket({ Bucket: bucket }, function(err) {
        self.s3.putObject({Bucket: bucket, Key: name, Body: data, ACL:'public-read'}, function( err ) {
          callback( err );
        });
      });
    } else if ( this.localDir ){
      var dir = [ this.localDir, subdir].join('/');
      mkdirp( dir, function(){
        fs.writeFile( [ dir, name ].join('/'), data, callback );
      });
    } else {
      callback('No filesystem configured', null);
    }

  };

  // removes a file to either s3 or local fs 
  this.remove = function(subdir, name, callback){
    if ( this.s3 ){
      var params = {
        Bucket: [this.s3Bucket, subdir].join('/'),
        Key: name
      };
      this.s3.deleteObject(params, function(err){
        callback(err);
      });
    } else if ( this.localDir ){
      fs.unlink( [ this.localDir, subdir, name].join('/'), callback );
    } else {
      callback('No filesystem configured', null);
    } 
  };

  this.removeDir = function(dir, callback){
      var self = this;
      if ( this.s3 ){
        var params = {
          Bucket: [ this.s3Bucket, dir ].join('/')
        };
        this.s3.deleteBucket(params, function(err){
          if ( self.localDir ){
            self.removeLocalDir( dir, callback );
          } else {
            callback( err );
          }
        });
      } else {
        this.removeLocalDir( dir, callback );
      }
  };

  this.removeLocalDir = function( dir, callback ){
    var rootDir = [[this.localDir, dir].join('/')];
    var args = rootDir;
    args.unshift('-rf');
    child.execFile('rm', args, { env: process.env }, function( err, stdout, stderr ) {
      callback.apply(this, arguments);
    });
  };

  return this;

};

module.exports = Files;
