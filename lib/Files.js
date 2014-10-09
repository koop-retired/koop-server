var fs = require('fs');
var AWS = require('aws-sdk'); 

var Files = function( config ){

  this.localDir = config.data_dir || false;
  this.s3Bucket = (config.s3) ? config.s3.bucket : false; 
  if ( this.s3Bucket ) {
    this.s3 = new AWS.S3();
  }

  this.exists = function(name, callback){
    if ( this.s3 ){
      var params = { 
        Bucket: this.s3Bucket, 
        Key: name 
      };
      s3.getObject(params, callback);
    } else if ( this.localDir ){
      fs.exists( [ this.localDir, name ].join('/'), callback);
    } else {
      callback('No filesystem configured', null);
    }
  }

  this.read = function( name, callback ){
    if ( this.s3 ){
      var params = { 
        Bucket: this.s3Bucket, 
        Key: file 
      };
      s3.getObject(params, callback);
    } else if ( this.localDir ){
      fs.readFile( [ this.localDir, name ].join('/'), function( err, data ){
        callback(null, data.toString());
      });
    } else {
      callback('No filesystem configured', null);
    }
  };

  this.write = function( name, data, callback ){
    if ( this.s3 ){
      var params = {
        Bucket: this.s3Bucket,
        Key: file
      };
      s3.getObject(params, callback);
    } else if ( this.localDir ){
      fs.writeFile( [ this.localDir, name ].join('/'), data, callback );
    } else {
      callback('No filesystem configured', null);
    }

  }

  this.remove = function(name, callback){
     if ( this.s3 ){
      var params = {
        Bucket: this.s3Bucket,
        Key: file
      };
      s3.getObject(params, callback);
    } else if ( this.localDir ){
      fs.unlink( [ this.localDir, name].join('/'), callback );
    } else {
      callback('No filesystem configured', null);
    } 
  };

  return this;

};

module.exports = Files;
