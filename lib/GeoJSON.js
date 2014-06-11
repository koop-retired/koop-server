
var terraformer = require('terraformer');
var terraformerParser = require('terraformer-arcgis-parser');

exports.fromCSV = function( csv, callback ){
  var geojson = {type: 'FeatureCollection', features: []};
  var feature, headers, cols;
  csv.forEach(function(row,i){
    if (i === 0){
      headers = row.split(',');
    } else {
      feature = {id: i, properties: {}, geometry:null };
      cols = row.split(',');
      cols.forEach(function(col, j){
        feature.properties[headers[j]] = col;
      }); 
      geojson.features.push(feature);
    }
  });
  callback(null, geojson);
};

exports.fromEsri = function( fields, json, callback ){

    var dateFields = []; 
      
    fields.forEach(function(f,i){
      if ( f.type == 'esriFieldTypeDate'){
        dateFields.push(f.name); 
      }
    });

    // use terraformer to convert esri json to geojson
    var geojson = {type: 'FeatureCollection', features: []};
    var feature, newFeature;
    json.features.forEach(function(f, i){
      try {
        if (f.geometry){
          feature = terraformerParser.parse( f );

          // build a new feature
          // 'feature' has bboxes we dont want and 'delete' is slow
          newFeature = {
            id: feature.id, 
            properties: feature.properties, 
            type: 'Feature', 
            geometry: { 
              coordinates: feature.geometry.coordinates,
              type: feature.geometry.type
            }
          };

          if (!newFeature.id) {
            newFeature.id = i+1;
          }
        } else {
          newFeature = {
            id: i+1,
            properties: f.attributes,
            type: 'Feature',
            geometry: null
          };
        }

        if ( dateFields.length ){
          dateFields.forEach(function(d,i){
            newFeature.properties[d] = new Date(newFeature.properties[d]).toISOString();
          });
        }
        geojson.features.push( newFeature );
      } catch (e){
        if ( dateFields.length ){
          dateFields.forEach(function(d,i){
            feature.attributes[d] = new Date(feature.attributes[d]).toISOString();
          });
        }
        newFeature = {
            id: i+1,
            properties: f.attributes,
            type: 'Feature',
            geometry: null
        };
        geojson.features.push( newFeature );
        console.log('error parsing feature', e, f);
      }
    });
    callback(null, geojson);
  };
