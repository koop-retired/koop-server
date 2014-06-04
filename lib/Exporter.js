// Exports data as any supported format 
// take in a format, file key, geojson, and callback
var fs = require('node-fs'),
  async = require('async');

module.exports = {
  ogrFormats: {
      kml: 'KML',
      zip: 'ESRI Shapefile',
      csv: 'CSV',
      gpkg: 'GPKG'
  },

  // exports large data via multi part file strategy
  exportLarge: function( format, dir, key, dbkey, table, options, done ){
    var self = this;
    options.limit = 20000;
    var pages,
      fileCount = 0; 

    // call ogr 
    var callOGR = function(outFile, cmd, callback){
      config.worker.aspawn(cmd,
        function (err, stdout, stderr) {
          console.log('ogr2ogr done', err, stdout, stderr);
          if (err) {
            callback(err.message, null);
          } else {
            callback(null, outFile);
          }
      });
    };

    var vrt = '<OGRVRTDataSource>';

    var collect = function(file, json, callback){
      console.log('Collect', file, json.features.length);
      fileCount++;

      delete json.info;
      fs.writeFile(file, JSON.stringify(json), function(){
        vrt += '<OGRVRTLayer name="OGRGeoJSON"><SrcDataSource>'+file+'</SrcDataSource></OGRVRTLayer>';
        if (fileCount == pages){
          vrt += '</OGRVRTDataSource>';
          fs.writeFile(vrtFile, vrt, function(){
            // CALL OGR
            console.log('calling ogr2ogr');
            var cmd = ['ogr2ogr', '-f', 'GeoJSON', '-append', jsonFile, vrtFile];
            callOGR(jsonFile, cmd, function(err, vrtOutFile){
              if (format == 'json' || format == 'geojson'){
                done(null, jsonFile.replace('geojson', 'json'));
              } else {
                //convert to format 
                cmd = ['ogr2ogr', '-f', self.ogrFormats[format], newFile, vrtOutFile];
                callOGR(newFile, cmd, function(err, formatFile){
                  done(null, formatFile);
                });
              }
            });
          });
        }
        callback();
      });
    }

    var q = async.queue(function (task, cb) {
      var opts = {
        layer: options.layer,
        limit: options.limit,
        where: options.where,
        offset: task.offset
      };
      Cache.db.select(dbkey, opts, function(err, data){
        collect(task.file, data[0], cb);
      });
    }, 2);


    // make a dir for the files
    var path = [config.data_dir + 'files', dir].join('/');
    var base = path + '/' + key,
      vrtFile = base + '.vrt',
      jsonFile = base + '.json',
      newFile = base + '.' + format;

    console.log('Looking for', jsonFile)
    // if we want json and it exists: return
    if ( fs.existsSync(jsonFile) && (format == 'json' || format == 'geojson') ){
      
      done(null, jsonFile);
    } else if (fs.existsSync(jsonFile)) {
      // if we already have the jsonfile and we want a diff format 
      console.log('calling ogr');
      cmd = ['ogr2ogr', '-f', self.ogrFormats[format], newFile, jsonFile];
      callOGR(newFile, cmd, function(err, formatFile){
        done(null, formatFile);
      });
    } else {
      // we have nothing; generate new data
      fs.mkdir( base, '0777', true, function(){ 
        Cache.getCount(table, function(err, count){
        
          pages = Math.ceil(count / options.limit);

          for (var i = 0; i < pages; i++){
            var offset = i * (options.limit);
            q.push({ file: base+'/part.' + i + '.json', offset: offset }, function(){});
          }
         
        });
      });
    }

  },
 
  exportToFormat: function( format, dir, key, geojson, options, callback ){
    var self = this;

    // create the files for out output
    // we always create a json file, then use it to convert to a file
    var path = [config.data_dir + 'files', dir].join('/');
    var base = path + '/' + key,
      jsonFile = base + '.json';
      newFile = base + '.' + format;

    // executes OGR
    var _callOgr = function(inFile, outFile, callback){
      if (format == 'json' || format == 'geojson'){
        callback(null, outFile.replace('geojson', 'json'));
      } else if (self.ogrFormats[format]) {
        var cmd = ['ogr2ogr', '-f', self.ogrFormats[format], ( format == 'zip' ) ? outFile.replace('zip','shp') : outFile, inFile];
        if (format == 'csv') {
          if ( !geojson.features[0].geometry || geojson.features[0].geometry.type == 'Point'){
            cmd.push('-lco');
            cmd.push('GEOMETRY=AS_XY');
          }
        } else if (format == 'zip' || format == 'shp'){
          cmd.push('-lco');
          cmd.push('ENCODING=UTF-8');
        }
        if ( fs.existsSync( outFile ) ) {
          callback(null, outFile);
        } else {
          console.log('calling ogr2ogr');
          config.worker.aspawn(cmd,
            function (err, stdout, stderr) {
              console.log('ogr2ogr', err, stdout, stderr);
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
                    if ( options.name ){
                      // cp each file into dir with new name 
                      fs.writeFileSync(base+'/' + options.name + '.shp', fs.readFileSync(shp));
                      fs.writeFileSync(base+'/' + options.name + '.dbf', fs.readFileSync(dbf));
                      fs.writeFileSync(base+'/' + options.name + '.shx', fs.readFileSync(shx));
                      fs.writeFileSync(base+'/' + options.name + '.prj', fs.readFileSync(prj));

                      // zip all and return the new zip
                      var newZip = base + '/' + options.name + '.zip';
                      config.worker.aspawn(['zip', '-rj', newZip, base+'/'], function(err, stdout, stderr){
                        callback(null, newZip);
                      });
                    } else {
                      config.worker.aspawn(['zip', '-j', outFile, shp, dbf, shx, prj], function(err, stdout, stderr){
                        callback(null, outFile);
                      });
                    }
                  });
                } else {
                  callback(null, outFile);
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
        // push the downloaded file up to s3
        if (peechee && peechee.type ){ 
          fs.readFile(file, function (err, data) {
            if ( format == 'zip' || format == 'gpkg' ){
              data = new Buffer(data, 'binary').toString('base64');
            }
            peechee.write(data, dir, key+'.'+format, function(err,res){
              if ( err ){
                callback('Problem saving file to s3: ' + err , null );
              } else {
                callback( null, file );
              }
            });
          });
        } else {
          callback(null, file);
        }
      }
    };

    fs.mkdir( path, '0777', true, function(){
      if ( !fs.existsSync( jsonFile ) ) {
        delete geojson.info;
        fs.writeFile( jsonFile, JSON.stringify( geojson ), function(){
          _callOgr( jsonFile, newFile, _send); 
        });
      } else {
        _callOgr( jsonFile, newFile, _send) ;
      }
    });
  }
};
