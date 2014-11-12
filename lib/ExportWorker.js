var kue = require('kue'),
  fs = require('node-fs');
  mv = require('mv'),
  koop = require('./');

var exec = require('child_process').exec;

config = JSON.parse(process.argv[2]);

koop.config = config;
koop.log = new koop.Logger( config );
koop.Cache = new koop.DataCache( koop );
koop.files = new koop.Files( koop );

// Start the Cache DB with the conn string from config
if ( config && config.db ) {
  if ( config.db.postgis ) {
    koop.Cache.db = koop.PostGIS.connect( config.db.postgis.conn );
  } else if ( config && config.db.sqlite ) {
    koop.Cache.db = koop.SQLite.connect( config.db.sqlite );
  }
  koop.Cache.db.log = koop.log;
} else if (config && !config.db){
  console.log('Exiting since no DB configuration found in config');
  process.exit();
}

jobs = kue.createQueue({
  prefix: 'export-q',
  redis: {
    port: config.export_workers.port,
    host: config.export_workers.host
  }
});


process.once( 'SIGINT', function ( sig ) {
  jobs.active(function(err, ids){
    console.log(ids)
    if ( ids.length ){
      ids.forEach( function( id ) {
        kue.Job.get( id, function( err, job ) {
          job.inactive();
          jobs.active(function(err, activeIds){
            if (!activeIds.length){
             jobs.shutdown(function(err) {
               console.log( 'Koop Kue is shut down.', err||'' );
               process.exit( 0 );
             }, 5000 );
            }
          });
        });
      });
    } else {
      jobs.shutdown(function(err) {
        console.log( 'Koop Kue is shut down.', err||'' );
        process.exit( 0 );
      }, 5000 );
    }
  });
});

jobs.process('exports', 2, function(job, done){
  selectData(job.id, job.data, done);
});

ogrFormats = {
  kml: 'KML',
  zip: '\"ESRI Shapefile\"',
  csv: 'CSV',
  json: 'GeoJSON',
  geojson: 'GeoJSON',
  gpkg: 'GPKG'
};

function selectData(id, data, done){
  var opts = {
    layer: data.options.layer,
    limit: data.options.limit,
    where: data.options.where,
    geometry: data.options.geometry,
    offset: data.offset,
    bypassProcessing: true
  };

  var filePart = data.file;

  koop.Cache.db.select(data.dbkey, opts, function(err, json){
    setTimeout(function(){
      koop.Cache.getInfo(data.table, function(err, info){
          if ( json && json[0] && json[0].info ){
            delete json[0].info;
            json = json[0];
          }
          var exists = fs.existsSync( filePart );
          if ( exists ){
            fs.unlinkSync( filePart );
          }
          fs.writeFile(filePart, JSON.stringify(json), function(){
            info.export_workers.complete++;

            info.export_workers.vrt += '<OGRVRTLayer name="OGRGeoJSON"><SrcDataSource>';
            info.export_workers.vrt += filePart;
            info.export_workers.vrt += '</SrcDataSource></OGRVRTLayer>';

            koop.Cache.updateInfo( data.table, info, function( err, res ){
              console.log(info.export_workers);
              if (info.export_workers.complete == info.export_workers.total){
                info.export_workers.vrt += '</OGRVRTDataSource>';
                fs.writeFile(data.files.rootVrtFile, info.export_workers.vrt, function(){
                  // CALL OGR
                  cmd = ['ogr2ogr', '-f', ogrFormats[data.format], '-update', '-append', ( data.format == 'zip' ) ? data.files.rootNewFileTmp.replace('zip', 'shp') : data.files.rootNewFileTmp, data.files.rootVrtFile];
                  callOGR(data.format, data.files.rootNewFileTmp, cmd, data.options, data.files, function(err, formatFile){
                      delete info.status;
                      delete info.generating;
                      koop.Cache.updateInfo( data.table, info, function(err, res){
                        done();
                      });
                  });
                });
              } else {
                done();  
              }
            });
          });
      });
    }, Math.floor(Math.random() * 5000));
  });
}


function callOGR( format, outFile, cmd, options, files, callback ){
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
  
  var base = files.base;

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
            var shpdir = base + files.tmpName + '.shp';
            mv(shpdir+'/OGRGeoJSON.shp', base+'/' + options.name + '.shp', function(err) {
              mv(shpdir+'/OGRGeoJSON.dbf', base+'/' + options.name + '.dbf', function(err) {
                mv(shpdir+'/OGRGeoJSON.shx', base+'/' + options.name + '.shx', function(err) {
                  mv(shpdir+'/OGRGeoJSON.prj', base+'/' + options.name + '.prj', function(err) {
                    mv(shpdir+'/OGRGeoJSON.cpg', base+'/' + options.name + '.cpg', function(err) {
                      // zip all and return the new zip
                      var newZipTmp = base + '/' + options.name + files.tmpName + '.zip';
                      var newZip = base + '/' + options.name + '.zip';
                      exec(['zip', '-rj', '"'+newZipTmp+'"', base+'/', '-x', base + '/*.json'].join(' '), function(err, stdout, stderr){
                        mv(newZipTmp, newZip, function(err) {
                          if ( koop.files.s3 ) {
                            var stream = fs.createReadStream(newZip);
                            koop.files.write( files.path+'/'+options.key, options.name + '.zip', stream, function( err ){
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
            mv(outFile, files.rootNewFile, function(err) {
              if ( koop.files.s3 ) {
                var stream = fs.createReadStream(files.rootNewFile);
                koop.files.write( files.path+'/'+options.key, files.newFile, stream, function( err ){
                  callback(null, files.rootNewFile);
                });
              } else {
                callback(null, files.rootNewFile);
              }
            });    
          });
        }
      });
    } else {
      mv(outFile, files.rootNewFile, function(err) {
        console.log('ogr2ogr done');
        if ( koop.files.s3 ) {
          var stream = fs.createReadStream(files.rootNewFile);
          koop.files.write( files.path+'/'+options.key, files.newFile, stream, function( err ){
            callback(null, files.rootNewFile);
          });
        } else {
          callback(null, files.rootNewFile);
        }
      });
    }
  });
};
