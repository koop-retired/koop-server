var mapnik = require('mapnik'),  
  mercator = new(require('sphericalmercator')),
  nfs = require('node-fs'),
  path = require('path'),
  fs = require('fs');

// register geojson as a datasource in mapnik
mapnik.register_datasource(path.join(mapnik.settings.paths.input_plugins,'geojson.input'));

module.exports = {

  get: function(params, data, callback ){
    var x = parseInt( params.x ),
      y = parseInt( params.y ),
      z = parseInt( params.z ),
      key = params.key,
      format = params.format;

    var style = params.style;

    if (!params.x || !params.y || !params.z || !format || !key){
      callback('Missing parameters', null);
    } else {
      // check the cache - the local file system 
      this._check( x, y, z, key, format, data, function( err, file ){
        if ( file ){
          if ( format == 'json' ){
            callback( err, require(file) );
          } else {
            callback( err, file );
          }
        } else {
          callback( 'Something went wrong with the tiles', null );
        }
      });
    }

  },

  _check: function( x, y, z, key, format, data, callback ){
    var self = this;
    var p = [ config.data_dir + 'tiles', key, format, z, x].join('/');
    var file = p + '/' + y + '.' + format;

    nfs.mkdir( p, '0777', true, function(){
      if ( !nfs.existsSync( file ) ) {
        self._stash( file, format, data, z, x, y, function( err, newfile ){
          callback( err, newfile );
        });
      } else {
        callback( null, file );
      }
    });
  },

  _stash: function( file, format, geojson, z, x, y, callback ){
    var feature;

      if ( format == 'json' ){
        fs.writeFile( file, JSON.stringify( geojson ), function(){
          callback( null, file );
        });
      } else {

          function render(){

            if ( format == 'png' ){
              var map = new mapnik.Map(256, 256);
              map.loadSync(__dirname + '/../templates/renderers/style.xml');

              var layer = new mapnik.Layer('tile');
              layer.datasource = new mapnik.Datasource( { type: 'geojson', file: jsonFile } );

              // add styles
              if (geojson && geojson.features && geojson.features.length){ 
                layer.styles = [geojson.features[0].geometry.type.toLowerCase()];
              }
              map.add_layer(layer);

              var image = new mapnik.Image(256, 256);
              map.extent = mercator.bbox(x, y, z, false, '4326');

              map.render( image, {}, function( err, im ) {
                if (err) {
                  callback( err, null );
                } else {
                  im.encode( 'png', function( err, buffer ) {
                    fs.writeFile( file, buffer, function( err ) {
                      callback( null, file );
                    });
                  });
                }
              });
              
            } else if (format == 'vector.pbf' || format == 'pbf') {

              var map = new mapnik.Map(256, 256);
              
              var layer = new mapnik.Layer('tile');
              layer.datasource = new mapnik.Datasource( { type: 'geojson', file: jsonFile } );
              map.add_layer(layer);

              var vtile = new mapnik.VectorTile( z, x, y );
              map.extent = mercator.bbox(x, y, z, false, '4326');
      
              map.render( vtile, {}, function( err, vtile ) {
                if (err) {
                  callback( err, null );
                } else {
                  fs.writeFileSync( file, vtile.getData() );
                  callback( null, file );
                }
              });

            } else if ( format == 'utf') {
              var grid = new mapnik.Grid(256, 256);
              var map = new mapnik.Map(256, 256);
              map.loadSync(__dirname + '/../templates/renderers/style.xml');
              var layer = new mapnik.Layer('tile');
              layer.datasource = new mapnik.Datasource( { type: 'geojson', file: jsonFile } );
              // add styles 
              layer.styles = [geojson.features[0].geometry.type.toLowerCase()];
              map.add_layer(layer);

              map.extent = mercator.bbox(x, y, z, false, '4326');

              map.render( grid, {layer: 0}, function( err, g ) {
                if (err) {
                  callback( err, null );
                } else {
                    fs.writeFile( file, JSON.stringify(g), function( err ) {
                      callback( null, file );
                    });
                }
              });

            }
          };

          var jsonFile = file.replace(/png|utf|pbf|vector\.pbf/g, 'json');

          if ( !nfs.existsSync( jsonFile ) ) {

            var dir = jsonFile.split('/');
            var f = dir.pop();
            
            nfs.mkdir( dir.join('/'), '0777', true, function(){
              delete geojson.info;
              fs.writeFile( jsonFile, JSON.stringify( geojson ), function(){
                render();
              });
            });

          } else if ( format == 'utf' && nfs.existsSync( file )){
    
            fs.readFile(file, function(err, data){
              callback(null, JSON.parse(data));  
            });

          } else {
            render();
          }

      }
  } 

};
