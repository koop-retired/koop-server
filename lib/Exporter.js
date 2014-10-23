// Exports data as any supported format 
// take in a format, file key, geojson, and callback
var fs = require('node-fs'),
  crypto = require('crypto'),
  mv = require('mv'),
  async = require('async');

var exec = require('child_process').exec;

var Exporter = function( koop ){
  var self = this;

  this.ogrFormats = {
      kml: 'KML',
      zip: '\"ESRI Shapefile\"',
      csv: 'CSV',
      json: 'GeoJSON',
      geojson: 'GeoJSON',
      gpkg: 'GPKG'
  };

  // exports large data via multi part file strategy
  this.exportLarge = function( format, id, key, type, options, done ){
    var self = this;
    options.limit = 10000;

    var pages,
      fileCount = 0; 
    
    var dir = id +'_'+ (options.layer || 0),
      dbkey = type +':'+ id,
      table = dbkey +':'+ (options.layer || 0);

    var _update = function( info, cb ){
      koop.Cache.updateInfo(table, info, function(err, success){
        cb();
      });
    };

    // call ogr in a separate process
    var callOGR = function( format, outFile, cmd, callback ){
      if ( format == 'csv' && options.geomType && options.geomType == 'esriGeometryPoint' ) {
        cmd.push('-lco');
        cmd.push('GEOMETRY=AS_XY');
      } else if (format == 'zip' || format == 'shp'){
        cmd.push('-lco');
        cmd.push('ENCODING=UTF-8');
        if ( options.geomType && options.geomType == 'esriGeometryPoint' ){
          cmd.push('-where');
          cmd.push("OGR_GEOMETRY = 'POINT'");
        } else if (options.geomType && options.geomType == 'esriGeometryPolygon') {
          cmd.push('-lco');
          cmd.push("SHPT=POLYGON");
        }
        cmd.push('-fieldmap');
        cmd.push('identity');
      }

      koop.log.info('calling ogr2ogr: %s', cmd.join(' '));
      exec(cmd.join(' '), function (err, stdout, stderr) {
        koop.log.info('ogr2ogr done', err, stdout, stderr);
        if ( format == 'zip' || format == 'shp'){
          // mkdir for base path (dir + key) to store shp
          fs.mkdir( base, '0777', true, function(){
            var shp = outFile.replace('zip','shp');
            var dbf = outFile.replace('zip','dbf');
            var shx = outFile.replace('zip','shx');
            var prj = outFile.replace('zip','prj');
            if ( options.name ){
                // cp each file into dir with new name 
                var shpdir = base + tmpName + '.shp';
                mv(shpdir+'/OGRGeoJSON.shp', base+'/' + options.name + '.shp', function(err) {
                  mv(shpdir+'/OGRGeoJSON.dbf', base+'/' + options.name + '.dbf', function(err) {
                    mv(shpdir+'/OGRGeoJSON.shx', base+'/' + options.name + '.shx', function(err) {
                      mv(shpdir+'/OGRGeoJSON.prj', base+'/' + options.name + '.prj', function(err) {
                        mv(shpdir+'/OGRGeoJSON.cpg', base+'/' + options.name + '.cpg', function(err) {
                          // zip all and return the new zip
                          var newZipTmp = base + '/' + options.name + tmpName + '.zip';
                          var newZip = base + '/' + options.name + '.zip';
                          exec(['zip', '-rj', '"'+newZipTmp+'"', base+'/', '-x', base + '/*.json'].join(' '), function(err, stdout, stderr){
                            mv(newZipTmp, newZip, function(err) {
                              if ( koop.files.s3 ) {
                                var stream = fs.createReadStream(newZip);
                                koop.files.write( path+'/'+key, options.name + '.zip', stream, function( err ){
                                  callback(null, newZip);
                                });
                              } else {
                                callback(null, newZip);
                              }  
                            });
                          });     
                        });
                      });
                    });
                  });
                });  
            } else {
              child = exec(['zip', '-j', outFile, shp, dbf, shx, prj].join(' '), function (err, stdout, stderr) {
                mv(outFile, rootNewFile, function(err) {
                  if ( koop.files.s3 ) {
                    var stream = fs.createReadStream(rootNewFile);
                    koop.files.write( path+'/'+key, newFile, stream, function( err ){
                      callback(null, rootNewFile);
                    });
                  } else {
                    callback(null, rootNewFile);
                  }
                });    
              });
            }
          });
        } else {
          mv(outFile, rootNewFile, function(err) {
            console.log('ogr2ogr done');
            if ( koop.files.s3 ) {
              var stream = fs.createReadStream(rootNewFile);
              koop.files.write( path+'/'+key, newFile, stream, function( err ){
                callback(null, rootNewFile);
              });
            } else {
              callback(null, rootNewFile);
            }
          });
        }
      });
    };

    var vrt = '<OGRVRTDataSource>';

    var collect = function(file, json, callback){
      fileCount++;

      if ( json ){
        delete json.info;
      }
      var exists = fs.existsSync( file );
      if ( exists ){
        fs.unlinkSync( file );
      }
      fs.writeFile(file, JSON.stringify(json), function(){
        vrt += '<OGRVRTLayer name="OGRGeoJSON"><SrcDataSource>'+file+'</SrcDataSource></OGRVRTLayer>';
        if (fileCount == pages){
          
          vrt += '</OGRVRTDataSource>';
          fs.writeFile(rootVrtFile, vrt, function(){
            // CALL OGR
            cmd = ['ogr2ogr', '-f', self.ogrFormats[format], '-update', '-append', ( format == 'zip' ) ? rootNewFileTmp.replace('zip','shp') : rootNewFileTmp, rootVrtFile];
            callOGR(format, rootNewFileTmp, cmd, function(err, formatFile){
              koop.Cache.getInfo(table, function(err, info){
                delete info.status;
                delete info.generating;
                _update( info, function(err, res){
                });
              });
            });
          });
        }
        callback();
      });
    };

    var q = async.queue(function (task, cb) {
      var opts = {
        layer: options.layer,
        limit: options.limit,
        where: options.where,
        geometry: options.geometry,
        offset: task.offset,
        bypassProcessing: true
      };
      koop.Cache.db.select(dbkey, opts, function(err, data){
        collect(task.file, data[0], cb);
      });
    }, 1);

    var current_date = (new Date()).valueOf().toString();
    var random = Math.random().toString();
    var tmpName = crypto.createHash('sha1').update(current_date + random).digest('hex');

    // the paths for export files is complex because we support local and s3 uploads 
    var root = koop.files.localDir;
    var path = ['files', dir].join('/');
    var base = [root, path, key].join('/');

    var jsonFile = key + '.json',
      vrtFile = key + '.vrt',
      newFileTmp = key + tmpName + '.' + format,
      newFile = key + '.' + format;

    var rootJsonFile = [root, path, jsonFile].join( '/' ),
      rootVrtFile = [root, path, vrtFile].join( '/' ),
      rootNewFile = [root, path, newFile].join( '/' ),
      rootNewFileTmp = [root, path, newFileTmp].join( '/' );

    if (fs.existsSync(vrtFile) && !options.ignore_cache) {
      // if we already have the vrtfile and we want a diff format 
      koop.Cache.getInfo(table, function(err, info){
        info.status = 'processing';
        info.generating = true;
        _update( info, function(err, res){ 
          // return response 
          done(null, info);

          // call ogr to a create new tmp file from the VRT file 
          console.log('calling ogr');
          cmd = ['ogr2ogr', '-f', self.ogrFormats[format], '-update', '-append', ( format == 'zip' ) ? rootNewFileTmp.replace('zip','shp') : rootNewFileTmp, vrtFile];
          callOGR(format, rootNewFileTmp, cmd, function(err, formatFile){
             delete info.status;
             delete info.generating;
             _update( info, function(e, res){});
          });
        });
      });
    } else {
      // we have nothing; generate new data
      koop.Cache.getInfo(table, function(err, info){
        info.status = 'processing';
        info.generating = true;
        _update( info, function(err, res){
          done(null, info);
          fs.mkdir( base, '0777', true, function(){ 
            koop.Cache.getCount(table, options, function(err, count){
                  pages = Math.ceil(count / options.limit);
                  var noop = function(){};
                  for (var i = 0; i < pages; i++){
                    var offset = i * (options.limit);
                    q.push({ file: base+'/part.' + i + '.json', offset: offset }, noop);
                  }
            });
          });
        });
      });
        
    }

  };
 
  this.exportToFormat = function( format, dir, key, geojson, options, callback ){
    var self = this;

    var current_date = (new Date()).valueOf().toString();
    var random = Math.random().toString();
    var tmpName = crypto.createHash('sha1').update(current_date + random).digest('hex');

    // create the files for out output
    // we always create a json file, then use it to convert to a file
    var root = koop.files.localDir;
    var path = ['files', dir].join('/');
    var base = [root, path, key].join('/');
      
    var jsonFile = key + '.json',
      newFileTmp = key + tmpName + '.' + format,
      newFile = key + '.' + format;
    
    var rootJsonFile = [root, path, jsonFile].join( '/' ),
      rootNewFile = [root, path, newFile].join( '/' );
      rootNewFileTmp = [root, path, newFileTmp].join( '/' );

    // executes OGR
    var _callOgr = function(inFile, outFile, callback){
      if (format == 'json' || format == 'geojson'){
        callback(null, outFile.replace('geojson', 'json'));
      } else if (self.ogrFormats[format]) {
        
        var cmd = [
          'ogr2ogr', 
          '--config',
          'SHAPE_ENCODING',
          'UTF-8', 
          '-f', 
          self.ogrFormats[format], 
          ( format == 'zip' ) ? outFile.replace('zip','shp') : outFile, 
          inFile
        ];

        if (format == 'csv') {
          if ( geojson && geojson.features && geojson.features.length && (!geojson.features[0].geometry || geojson.features[0].geometry.type == 'Point')){
            cmd.push('-lco');
            cmd.push('GEOMETRY=AS_XY');
          }
        } else if (format == 'zip' || format == 'shp'){
          if ( geojson && geojson.features && geojson.features.length && (!geojson.features[0].geometry || geojson.features[0].geometry.type == 'Point')){
            //cmd.push('-where');
            //cmd.push("OGR_GEOMETRY='POINT'");
          }
        }
        // encode everything as utf8
        cmd.push('-lco');
        cmd.push('ENCODING=UTF-8');
        if ( fs.existsSync( outFile ) ) {
          callback(null, outFile);
        } else {
          koop.log.debug('calling ogr2ogr: %s', cmd.join(' '));
          child = exec(cmd.join(' '), function (err, stdout, stderr) {
              if (err) {
                callback(err.message, null);
              } else {
                if ( format == 'zip' ){
                  // mkdir for base path (dir + key) to store shp
                  fs.mkdir( base, '0777', true, function(){
                    var shp = outFile.replace('zip','shp');
                    var dbf = outFile.replace('zip','dbf');
                    var shx = outFile.replace('zip','shx');
                    var prj = outFile.replace('zip','prj');
                    var cpg = outFile.replace('zip','cpg');
                    if ( options.name ){
                      // cp each file into dir with new name 
                      mv(shp, base+'/' + options.name + '.shp', function(err){
                        mv(dbf, base+'/' + options.name + '.dbf', function(err){
                          mv(shx, base+'/' + options.name + '.shx', function(err){
                            mv(prj, base+'/' + options.name + '.prj', function(err){
                              mv(cpg, base+'/' + options.name + '.cpg', function(err){
                                var newZipTmp = base + '/' + options.name + tmpName + '.zip';
                                var newZip =  base + '/' + options.name + '.zip';
                                exec(['zip', '-rj', '"'+newZipTmp+'"', base+'/'].join(' '), function(err, stdout, stderr){
                                  mv(newZipTmp, newZip, function(err) {
                                    if ( koop.files.s3 ) {
                                      var stream = fs.createReadStream(newZip);
                                      koop.files.write( path+'/'+key, options.name + '.zip', stream, function( err ){
                                        callback(null, newZip);
                                      });
                                    } else {
                                      callback(null, newZip);
                                    }
                                  });
                                });
                              });
                            });
                          });
                        });
                      });
                    } else {
                      exec(['zip', '-j', outFile, shp, dbf, shx, prj].join(' '), function(err, stdout, stderr){
                        if ( koop.files.s3 ) { 
                          var stream = fs.createReadStream(outFile);
                          koop.files.write( path+'/'+key, newFile, stream, function( err ){
                            callback(null, outFile);
                          });
                        } else {
                          callback(null, outFile);
                        }
                      });
                    }
                  });
                } else {
                  mv(outFile, rootNewFile, function(err) {
                    if ( koop.files.s3 ){ 
                      var stream = fs.createReadStream(rootNewFile);
                      koop.files.write( path+'/'+key, newFile, stream, function( err ){
                        callback(null, rootNewFile);
                      });
                    } else {
                      callback(null, rootNewFile);
                    }
                  });
                }
              }
          });
        }
      } else {
        callback('Unknown format', null);
      }
    };

    // handles the response to callback
    var _send = function(err, file){
      if (err){
        callback( err, null );
      } else {
        callback(null, file);
      }
    };


    fs.mkdir( root+'/'+path, '0777', true, function(){
      if ( !fs.existsSync( rootJsonFile ) ) {
        delete geojson.info;
        var json = JSON.stringify(geojson).replace(/esri/g,'');
        fs.writeFile( rootJsonFile, json, function(err){
          if ( koop.files.s3 ){
            var stream = fs.createReadStream( rootJsonFile );
            koop.files.write( path+'/'+key, jsonFile, stream, function( err ){
              _callOgr( rootJsonFile, rootNewFile, _send );
            });
          } else {
            _callOgr( rootJsonFile, rootNewFile, _send);
          } 
        });
      } else {
        if (format == 'json' || format == 'geojson'){
          
          callback(null, rootJsonFile);
        } else {
          _callOgr( rootJsonFile, rootNewFileTmp, _send) ;
        }
      }
    });
  };

  // concurrent queue for feature pages
  this.taskQueue = async.queue(function (task, callback) {
    // tell the cache to ignore data in a processing state
    task.options.bypassProcessing = true;
    self._finish(task, callback);
  }, 2);


  this._finish = function( params, callback ){
    var self = this;
    var limit = 10000;

    var layer = (params.options.layer || 0);

    var key = [params.type, params.id, layer].join(":");
      dir = params.id + '_' + layer;

    var _update = function( info, cb ){
      koop.Cache.updateInfo(key, info, function(err, success){
        cb();
      });
    };

    koop.Cache.getInfo(key, function(err, info){
      if (info) {
        delete info.status;

        if (info.format){
          var format = info.format;
          delete info.format;

          koop.Cache.getCount(key, params.options, function(err, count){
            if ( count > limit ){
              self.exportLarge( format, params.id, params.hash, params.type, params.options, function(err, result){
                _update( info, function(){
                  callback(err, result);
                });
              });

            } else {
              // export as normal
              koop.Cache.get( params.type, params.id, params.options, function(err, entry ){
                if (!err){
                  self.exportToFormat( format, dir, params.hash, entry[0], params.options, function(err, result){
                    _update( info, function(){
                      callback(err, result);
                    });
                  });
                }
              });
            }
          });
        } else {
          _update( info, function(err, result) {
            callback(err, '');
          });
        }
      } else {
        callback(err, '');
      }
    });
  };


  return this;

};

module.exports = Exporter;
