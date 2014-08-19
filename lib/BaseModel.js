// Uses the module pattern for clean inheritance in models
// exposes shared functionality across providers, typically things that require central code in koop-server

var BaseModel = function( koop ){

  // returns configured data dir for the cache
  function cacheDir(){
    return koop.Cache.data_dir;
  }
  
  // converts GeoJSON in TopoJSON
  function topojsonConvert( data, callback ){
    koop.Topojson.convert( data, callback);
  }
  
  // exports data to the given format
  function exportToFormat( format, dir, key, data, options, callback){
    koop.exporter.exportToFormat( format, dir, key, data, options, callback);
  }

  function exportLarge( format, id, key, type, callback ){
    koop.exporter.exportLarge(format, id, key, type, callback);
  };

  // calls Thumbnail generate to create a thumbnail 
  function generateThumbnail( data, key, options, callback ){
    koop.Thumbnail.generate( data, key, options, callback );
  }

  // checks to see if the thumbnail exists 
  function thumbnailExists( key, options ){
    return koop.Thumbnail.exists( key, options );
  }
 
  // gets/creates a tile from the url params and data
  function tileGet( params, data, callback ){
    koop.Tiles.get( params, data, callback );
  }


  return {
    cacheDir: cacheDir,
    topojsonConvert: topojsonConvert,
    exportToFormat: exportToFormat,
    exportLarge: exportLarge,
    tileGet: tileGet,
    thumbnailExists: thumbnailExists,
    generateThumbnail: generateThumbnail
  }

};

module.exports = BaseModel;
