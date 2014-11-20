var kue = require('kue'),
  fs = require('node-fs');
  mv = require('mv'),
  async = require('async'),
  koop = require('./'),
  exec = require('child_process').exec;

// get the config from stdin
config = JSON.parse(process.argv[2]);

// set up koop with the thing we need like logging and the cache
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
  process.exit();
}

// create the job queue
jobs = kue.createQueue({
  prefix: config.export_workers.redis.prefix,
  redis: {
    port: config.export_workers.redis.port,
    host: config.export_workers.redis.host
  }
});

// catch crashes and save the current jobs
process.once( 'SIGINT', function ( sig ) {
  jobs.active(function(err, ids){
    if ( ids.length ){
      ids.forEach( function( id ) {
        kue.Job.get( id, function( err, job ) {
          job.inactive();
          jobs.active(function(err, activeIds){
            if (!activeIds.length){
             jobs.shutdown(function(err) {
               process.exit( 0 );
             }, 5000 );
            }
          });
        });
      });
    } else {
      jobs.shutdown(function(err) {
        process.exit( 0 );
      }, 5000 );
    }
  });
});

// process 2 jobs at a time
// TODO think about scaling this and how to do we start many workers 
//  - ie can this be distributed across more machines?
//  - does it need to on the same server always? 
jobs.process('exports', 2, function(job, done){
  if (fs.existsSync(job.data.files.rootVrtFile) && !job.data.options.ignore_cache){
    // since we have a VRT file locally
    // we just want to create the export and complete the job
    koop.Cache.getInfo(job.data.table, function(err, info){
      info.status = 'processing';
      info.generating = true;
      koop.Cache.updateInfo(job.data.table, info, function(err, res){
        // create large file from vrt
        var cmd = ['ogr2ogr', '-f', job.data.ogrFormat, '-update', '-append', ( job.data.format == 'zip' ) ? job.data.files.rootNewFileTmp.replace('zip','shp') : job.data.files.rootNewFileTmp, job.data.files.rootVrtFile]; 

        callOGR(job.data.format, job.data.files.rootNewFileTmp, cmd, job.data.options, job.data.files, function(err, formatFile){
          // remove the processing state and return the job
          delete info.status;
          delete info.generating;
          koop.Cache.updateInfo(job.data.table, info, function(e, res){
            if (err) {
              return done(err);
            } else {
              return done();
            }
          });
        });
      });
    });
  } else {
    fs.mkdir( job.data.files.base, '0777', true, function(){
      koop.Cache.getCount(job.data.table, job.data.options, function(err, count){
        var pages = Math.ceil(count / job.data.options.limit);
        for (var i=0; i < pages; i++){
            var offset = i * (job.data.options.limit);
            var chunk = { file: job.data.files.base+'/part.' + i + '.json', offset: offset };
            job.data.pages.push( chunk );
        };
        createFiles( job, done );
      });
    });
  }
});

function createFiles(job, done){
  console.log('starting job ', job.id, job.data)
  var vrt = '<OGRVRTDataSource>';

  var pageLen = job.data.pages.length,
    completed = 0;

  var workerQ = async.queue(function(task, cb){
    var opts = {
      layer: task.options.layer,
      limit: task.options.limit,
      where: task.options.where,
      geometry: task.options.geometry,
      offset: task.offset,
      bypassProcessing: true
    };
  
    var filePart = task.file;
  
    koop.Cache.db.select(task.dbkey, opts, function(err, json){
      koop.Cache.getInfo(task.table, function(err, info){
        if ( json && json[0] && json[0].info ){
          delete json[0].info;
          json = json[0];
        }
        var exists = fs.existsSync( filePart );
        if ( exists ){
          fs.unlinkSync( filePart );
        }
        fs.writeFile(filePart, JSON.stringify(json), function(){
          // tick up the number of complete pages
          completed++;
          job.progress( completed, pageLen );
  
          vrt += '<OGRVRTLayer name="OGRGeoJSON"><SrcDataSource>';
          vrt += filePart;
          vrt += '</SrcDataSource></OGRVRTLayer>';
  
          if (completed == pageLen){
            vrt += '</OGRVRTDataSource>';
            fs.writeFile( task.files.rootVrtFile, vrt, function(){
              // CALL OGR
              cmd = [];
              cmd.push('ogr2ogr');
              cmd.push('-f');
              cmd.push(task.ogrFormat);
              cmd.push('-update')
              cmd.push('-append');
              cmd.push(( task.format == 'zip' ) 
                ? task.files.rootNewFileTmp.replace('zip', 'shp') 
                : task.files.rootNewFileTmp); 
              cmd.push( task.files.rootVrtFile );

              callOGR(task.format, task.files.rootNewFileTmp, cmd, task.options, task.files, function(err, formatFile){
                  delete info.status;
                  delete info.generating;
                  koop.Cache.updateInfo( task.table, info, function(err, res){
                    done();
                    cb();
                  });
              });
            });
          } else {
            cb();
          }
        });
      });
    });
  
  },4);

  job.data.pages.forEach(function(page,i){
    var task = {
      options: job.data.options,
      file: page.file,
      offset: page.offset,
      dbkey: job.data.dbkey,
      table: job.data.table,
      format: job.data.format,
      ogrFormat: job.data.ogrFormat,
      files: job.data.files
    }
    workerQ.push(task, function(err){ if (err) console.log(err); });
  });

};


function callOGR( format, outFile, cmd, options, files, callback ){
  if ( format == 'csv' && options.geomType && options.geomType == 'esriGeometryPoint' ) {
    cmd.push('-lco');
    cmd.push('GEOMETRY=AS_XY');
  } else if (format == 'zip' || format == 'shp'){
    cmd.push('-lco');
    cmd.push('ENCODING=UTF-8');
    if ( options.geomType && options.geomType == 'esriGeometryPoint' ){
      //cmd.push('-where');
      //cmd.push("'OGR_GEOMETRY=\"POINT\"'");
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
                      var zipCMD = ['zip', '-rj', '"'+newZipTmp+'"', base+'/', '--exclude=*.json*'].join(' ');
                      koop.log.debug('creating a new zip: %s', zipCMD);
                      exec(zipCMD, function(err, stdout, stderr){
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
