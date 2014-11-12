var kue = require('kue'),
  koop = require('./');

config = JSON.parse(process.argv[2]);

koop.log = new koop.Logger( config );
koop.Cache = new koop.DataCache( koop );

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

function selectData(id, data, done){
  var opts = {
    layer: data.options.layer,
    limit: data.options.limit,
    where: data.options.where,
    geometry: data.options.geometry,
    offset: data.offset,
    bypassProcessing: true
  };
  koop.Cache.db.select(data.dbkey, opts, function(err, json){
    setTimeout(function(){
      koop.Cache.getInfo(data.dbkey, function(err, info){
        info.export_workers.complete++;
        koop.Cache.updateInfo(data.dbkey, info, function(err, res){
          console.log(info.export_workers);
          if (info.export_workers.complete == info.export_workers.total){
            console.log('do the data thing');
            done();
          } else {
            done();  
          }
        });
      });
    }, Math.floor(Math.random() * 3000));
    //collect(op.file, data[0], done);
  });
}

function collect(file, json, done){

  if ( json ){
    delete json.info;
  }

  var exists = fs.existsSync( file );
  if ( exists ){
    fs.unlinkSync( file );
  }

  fs.writeFile(file, JSON.stringify(json), function(){
    vrt += '<OGRVRTLayer name="OGRGeoJSON"><SrcDataSource>'+file+'</SrcDataSource></OGRVRTLayer>';
    /*if (fileCount == pages){

      vrt += '</OGRVRTDataSource>';
      fs.writeFile(files.rootVrtFile, vrt, function(){
        // CALL OGR
        cmd = ['ogr2ogr', '-f', self.ogrFormats[format], '-update', '-append', ( format == 'zip' ) ? rootNewFileTmp.replace('zip',    'shp') : rootNewFileTmp, rootVrtFile];
        callOGR(format, rootNewFileTmp, cmd, function(err, formatFile){
          koop.Cache.getInfo(table, function(err, info){
            delete info.status;
            delete info.generating;
            _update( info, function(err, res){
            });
          });
        });
      });
    }*/
    done();
  });
}
