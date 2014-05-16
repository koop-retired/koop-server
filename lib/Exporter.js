// Exports data as any supported format 
// take in a format, file key, geojson, and callback
var fs = require('node-fs');
 
exports.exportToFormat = function( format, dir, key, geojson, callback ){

    // executes OGR
    var _callOgr = function(inFile, outFile, callback){
      if (format == 'json' || format == 'geojson'){
        callback(null, outFile.replace('geojson', 'json'));
      } else if (ogrFormats[format]) {
        var cmd = ['ogr2ogr', '-f', ogrFormats[format], ( format == 'zip' ) ? outFile.replace('zip','shp') : outFile, inFile, '-lco', 'ENCODING=UTF-8'];
        if (format == 'csv'){
          cmd.push('-lco');
          cmd.push('GEOMETRY=AS_XY');
        }
        config.worker.aspawn(cmd,
          function (err, stdout, stderr) {
            console.log('ogr2ogr', err, stdout, stderr);
            if (err) {
              callback(err.message, null);
            } else {
              if ( format == 'zip' ){
                var shp = outFile.replace('zip','shp');
                var dbf = outFile.replace('zip','dbf');
                var shx = outFile.replace('zip','shx');
                var prj = outFile.replace('zip','prj');
                config.worker.aspawn(['zip', '-j', outFile, shp, dbf, shx, prj], function(err, stdout, stderr){
                  callback(null, outFile);
                });
              } else {
                callback(null, outFile);
              }
            }
        });
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
                console.log('Peechee Error', err);
                callback('Problem saving file to s3', null );
              } else {
                callback( null, file );
              }
            })
          });
        } else {
          callback(null, file);
        }
      }
    };

    var ogrFormats = {
      kml: 'KML',
      zip: 'ESRI Shapefile',
      csv: 'CSV',
      gpkg: 'GPKG'
    };

    // create the files for out output
    // we always create a json file, then use it to convert to a file
    var path = [config.data_dir + 'files', dir].join('/');
    var base = path + '/' + key,
      jsonFile = base + '.json';
      newFile = base + '.' + format;


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

};
