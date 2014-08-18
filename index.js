var express = require("express"),
  fs = require('fs'),
  bodyParser = require('body-parser'),
  koop = require('./lib');

module.exports = function(config) {
  var app = express(), route, controller, model;

  // handle POST requests 
  app.use(bodyParser());

  app.set('view engine', 'ejs');
  
  // serve the index 
  app.get("/", function(req, res, next) {
    res.render(__dirname + '/views/index');
  });

  // register providers into the app
  // sets up models, routes -> controllers/handlers 
  app.register = function(provider){
    // only register if the provider has a name 
    if ( provider.name ) {

      // save the provider onto the app
      model = new provider.model( koop );

      // pass the model to the controller
      controller = new provider.controller( model );

      // add each route
      app._bindRoutes( provider.routes, controller );
   
      // bind each route in the provider 
      //for ( route in provider.routes ){
      //  var path = route.split(' ');
      //  app[ path[0] ]( path[1], controller[ provider.routes[ route ] ]);
      //}
    }
  };

  // bind each route in a list to controller handler
  app._bindRoutes = function( routes, controller ){
    for ( route in routes ){
      var path = route.split(' ');
      app[ path[0] ]( path[1], controller[ routes[ route ] ]);
    }
  };


  // Start the Cache DB with the conn string from config
  if ( config && config.db ) {
    if ( config.db.postgis ) {
      koop.Cache.db = koop.PostGIS.connect( config.db.postgis.conn );
    } else if ( config && config.db.sqlite ) {
      koop.Cache.db = koop.SQLite.connect( config.db.sqlite );
    }
  } else if (config && !config.db){
    console.log('Exiting since no DB configuration found in config');
    process.exit();
  }
  
  // store the data_dir in the cache, tiles, thumbnails
  // TODO all writing to the filesystem needs to over hauled and centralized.
  var data_dir = config.data_dir || __dirname;
  koop.Cache.data_dir = data_dir;
  koop.Tiles.data_dir = data_dir;
  koop.Thumbnail.data_dir = data_dir;

  // Need the exporter to have access to the cache so we pass it Koop
  koop.exporter = new koop.Exporter( koop.Cache );

  return app;
  
};
