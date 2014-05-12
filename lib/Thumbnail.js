var fs = require('fs'),
  mapnik = require('mapnik'),
  mercator = new(require('sphericalmercator')),
  sm = require('sphericalmercator'),
  nfs = require('node-fs'),
  sm = require('sphericalmercator');


var Thumbnail = function(){

  // check to see if an image already exists is true
  this.exists = function(key, options, callback){

    var width = parseInt( options.width ) || 150;
    var height = parseInt( options.height ) || 150;
    var dir = config.data_dir + '/thumbs/';
    var png_name = dir + key + '/' + width + '::' + height + '.png';

    // if the png exists send it back
    var exists = fs.existsSync( png_name );

    if ( exists ){
      return png_name; 
    } else {
      return false;
    }
  };


  // Primary entry point for thumbnail generation 
  // should be relatively stupid about where to write file, but should check for cached images 
  // @param json GeoJSON for rendering to image 
  // @param extent bounding box for image  
  this.generate = function( json, key, options, callback ) {
    var self = this;

    var dir = config.data_dir + '/thumbs/' + key;
    // make sure dir exists 
    nfs.mkdir( dir, '0777', true, function(){
      fs.writeFile( options.f_base + '.json', JSON.stringify( json ), function(){
        self.render(json, options, callback);
      });
    });

  };

  // actually renders and returns the saved file 
  this.render = function( json, options, callback ){

    var png = options.f_base + '.png',
      jsonFile = options.f_base + '.json';

    fs.writeFileSync( jsonFile, JSON.stringify(json) );

    if (!options.extent){
      options.extent = Extent.bounds( json.features );
    }

    var map = new mapnik.Map(256, 256, '+init=epsg:3857');
    map.loadSync(__dirname + '/../templates/renderers/style.xml');

    var layer = new mapnik.Layer('tile');
    layer.datasource = new mapnik.Datasource( { type: 'geojson', file: jsonFile } );

    // add styles 
    layer.styles = [json.features[0].geometry.type.toLowerCase()];

    map.add_layer(layer);

    var image = new mapnik.Image(256, 256);

    // project extent
    var buff = 0;
    var merc = new sm( { size:options.width } ),
      mins = merc.forward( [options.extent.xmin-buff, options.extent.ymin-buff] ),
      maxs = merc.forward( [options.extent.xmax+buff, options.extent.ymax+buff] );
    
    map.extent = [options.extent.xmin-buff, options.extent.ymin-buff, options.extent.xmax+buff, options.extent.ymax-buff];

    map.render( image, {}, function( err, im ) {
      if (err) {
        callback( err, null );
      } else {
        im.encode( 'png', function( err, buffer ) {
          fs.writeFile( png, buffer, function( err ) {
            callback( null, png );
          });
        });
      }
    });
    
  }

};

module.exports = new Thumbnail();
