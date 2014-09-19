var mapnik = require('mapnik'),  
  mapnikPool = require('mapnik-pool')(mapnik),
  mercator = new(require('sphericalmercator'))(),
  nfs = require('node-fs'),
  path = require('path'),
  fs = require('fs');

mapnik.register_default_input_plugins();

// register geojson as a datasource in mapnik
mapnik.register_datasource(path.join(mapnik.settings.paths.input_plugins,'geojson.input'));

// create a space to hold pools of maps for repeat referencing
mapnik.pools = {};

module.exports = {

  mapnikHeader: '<Map srs="+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0.0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +over" background-color="transparent" buffer-size="1"><Style name="esriGeometryPolygon" filter-mode="first"><Rule><PolygonSymbolizer fill="darkblue" fill-opacity=".75"/></Rule></Style><Style name="esriGeometryPoint"><Rule><MarkersSymbolizer fill="#55AADD" opacity=".75" width="10.5" stroke="white" stroke-width="2" stroke-opacity=".25" placement="point" marker-type="ellipse" allow-overlap="true"/></Rule></Style><Style name="esriGeometryPolyline">  <Rule><LineSymbolizer stroke="darkgrey" stroke-width="3" /><LineSymbolizer stroke="white" stroke-width="1.5" /></Rule></Style>',
  mapnikFooter: '</Map>',

  buildTableQuery: function( table, fields ){
    var select = "(Select geom, ";
    var list = [];
    fields.forEach(function(field, i){
      list.push("feature->'properties'->>'"+field.name+"' as "+field.name);
    });
    select += list.join(',');
    select += ' from "'+table+'") as foo';
    return select;
  },

  mapnikLayer: function( table, layerObj ){
    var name = layerObj.name,
      maxZoom = layerObj.maxScale,
      minZoom = layerObj.minScale,
      type = layerObj.geometryType,
      fields = layerObj.fields;

    tableQuery = this.buildTableQuery( table, fields);

    var layer = '<Layer name="'+name+'" maxzoom="'+minZoom+'" minzoom="'+maxZoom+'" status="on" srs="+proj=latlong +datum=WGS84">';
    layer += '<StyleName>' + type + '</StyleName>';
    layer += '<Datasource><Parameter name="type">postgis</Parameter>';
    layer += '<Parameter name="host">'+Cache.db.client.host+'</Parameter>';
    layer += '<Parameter name="dbname">'+Cache.db.client.database+'</Parameter>';
    layer += '<Parameter name="user">'+Cache.db.client.user+'</Parameter>';
    layer += '<Parameter name="password">'+(Cache.db.client.password || '')+'</Parameter>';
    layer += '<Parameter name="table">'+tableQuery+'</Parameter>';
    layer += '<Parameter name="geometry_field">geom</Parameter></Datasource></Layer>';

    return layer;
  },

  createMapnikStyleSheet: function(file, data, params, callback){
    var self = this;
    var styleSheet = this.mapnikHeader, table;
    var layers = [];

    var i = data.layerInfo.length - 1;
    while ( i >= 0 ) {
      layer = data.layerInfo[i];
      table = [params.type, params.item, layer.id].join(':');
      layers.push( self.mapnikLayer( table, layer ) );
      i--;
    } 

    /*layer = data.layerInfo[47];
    table = [params.type, params.item, layer.id].join(':');
    layers.push( self.mapnikLayer( table, layer ) );*/

    styleSheet += layers.join('');
    styleSheet += this.mapnikFooter;
    fs.writeFile(file, styleSheet, function(err){
      callback( null, file);
    });
  }, 

  getServiceTile: function( params, info, callback){
    var self = this;
    // check for the mapnik config
    var p = [ config.data_dir + 'tiles', params.key].join('/');
    var file = p + '/style.xml';
    nfs.mkdir( p, '0777', true, function(){
      if ( !nfs.existsSync( file ) ) {
        self.createMapnikStyleSheet(file, info, params, function(err, done){
          self.createServiceTile( params, file, function( err, tileFile ){
            callback( err, tileFile );
          });
        });
      } else {
        self.createServiceTile( params, file, function( err, tileFile ){
          callback( err, tileFile );
        });
      }
    });
 
  },

  createServiceTile: function(params, stylesheet, callback){
    var path = [ 
      config.data_dir + 'tiles', 
      params.key, 
      params.format, 
      params.z, 
      params.x
    ].join('/');

    var file = path + '/' + params.y + '.' + params.format;
    var size = params.size || 256;
    var mapKey = params.key +':'+ size; 

    nfs.mkdir( path, '0777', true, function(){
      if ( !fs.existsSync( file ) ) {
        if ( !mapnik.pools[ mapKey ] ){
          mapnik.pools[ mapKey ] = mapnikPool.fromString( fs.readFileSync( stylesheet, 'utf8' ), { 
            size: size+100,
            bufferSize: 100
          });
        }

        mapnik.pools[ mapKey ].acquire(function(err, map) {
          // pooled map extents
//          map = new mapnik.Map(256, 256);
//          map.loadSync( stylesheet );
          map.extent = mercator.bbox(params.x, params.y, params.z, false, '900913');

          if ( params.format == 'png' ){
    
            var image = new mapnik.Image(size, size);
    
            map.render( image, {}, function( err, im ) {
              if (err) {
                callback( err, null );
                mapnik.pools[ mapKey ].release( map );  
              } else {
                im.encode( 'png', function( err, buffer ) {
                  fs.writeFile( file, buffer, function( err ) {
                    mapnik.pools[ mapKey ].release( map );  
                    callback( null, file );
                  });
                });
              }
            });
  
          } else if ( params.format == 'pbf' ){

            var vtile = new mapnik.VectorTile( parseInt(params.z), parseInt(params.x), parseInt(params.y) );
            map.render( vtile, {}, function( err, vtile ) {
              if (err) {
                callback( err, null );
                mapnik.pools[ mapKey ].release( map );  
              } else {
                fs.writeFile( file, vtile.getData(), function(){
                  mapnik.pools[ mapKey ].release( map );  
                  callback( null, file );
                });
              }
            });
          }

        });

      } else {
        callback( null, file );
      }
    });

  },

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
            callback( err, file );
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
        delete geojson.info;
        fs.writeFile( file, JSON.stringify( geojson ), function(){
          callback( null, file );
        });
      } else {

          var render = function(){
            var map, layer;

            if ( format == 'png' ){
              map = new mapnik.Map(256, 256);
              map.loadSync(__dirname + '/../templates/renderers/style.xml');

              layer = new mapnik.Layer('tile');
              layer.srs = '+init=epsg:4326';
              layer.datasource = new mapnik.Datasource( { type: 'geojson', file: jsonFile } );

              // add styles
              if (geojson && geojson.features && geojson.features.length){ 
                layer.styles = [geojson.features[0].geometry.type.toLowerCase()];
              }
              map.add_layer(layer);

              var image = new mapnik.Image(256, 256);
              map.extent = mercator.bbox(x, y, z, false, '900913');

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

              map = new mapnik.Map(256, 256);
              map.loadSync(__dirname + '/../templates/renderers/style.xml');
              
              try {
                layer = new mapnik.Layer(geojson.name.replace( '.geojson', '' ));
              } catch (e){
                layer = new mapnik.Layer('tile');
              }
              layer.datasource = new mapnik.Datasource( { type: 'geojson', file: jsonFile } );
              map.add_layer(layer);

              var vtile = new mapnik.VectorTile( z, x, y );
              map.extent = mercator.bbox(x, y, z, false, '900913');

              map.render( vtile, {}, function( err, vtile ) {
                if (err) {
                  callback( err, null );
                } else {
                  fs.writeFileSync( file, vtile.getData() );
                  callback( null, file );
                }
              });

            } else if ( format == 'utf') {
              var grid = new mapnik.Grid(256, 256, {key: '__id__'});
              map = new mapnik.Map(256, 256);
              map.loadSync(__dirname + '/../templates/renderers/style.xml');
              layer = new mapnik.Layer('tile');
              layer.datasource = new mapnik.Datasource( { type: 'geojson', file: jsonFile } );
              // add styles 
              var options = {layer:0};
              if (geojson && geojson.features && geojson.features.length){
                layer.styles = [geojson.features[0].geometry.type.toLowerCase()];
                options.fields = Object.keys( geojson.features[0].properties );
              }
              map.add_layer(layer);
              map.extent = mercator.bbox(x, y, z, false, '900913');


              map.render( grid, options, function( err, g ) {
                if (err) {
                  callback( err, null );
                } else {
                    var utf = g.encodeSync('utf', {resolution: 4});
                    fs.writeFile( file, JSON.stringify(utf), function( err ) {
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
