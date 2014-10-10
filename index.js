var express = require("express"),
  fs = require('fs'),
  bodyParser = require('body-parser'),
  koop = require('./lib');

module.exports = function( config ) {
  var app = express(), route, controller, model;

  // init the koop log based on config params 
  koop.log = new koop.Logger( config );

  // log every request
  app.use(function(req, res, next) {
    koop.log.debug("%s %s", req.method, req.url);
    next();
  });

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

      // binds a series of standard routes
      if ( provider.name && provider.pattern ) {
        app._bindDefaultRoutes(provider.name, provider.pattern, controller );
      }

      // add each route, the routes let us override defaults etc. 
      app._bindRoutes( provider.routes, controller );
    }
  };

  var defaultRoutes = {
    'featureserver': ['/FeatureServer/:layer/:method', '/FeatureServer/:layer', '/FeatureServer'],
    'preview':['/preview'],
    'drop':['/drop']
  };  

  // assigns a series of default routes; assumes 
  app._bindDefaultRoutes = function( name, pattern, controller ){
    var routes, handler;
    for ( handler in defaultRoutes ){
      if ( controller[ handler ] ){
        defaultRoutes[ handler ].forEach(function(route){
          app[ 'get' ]( '/'+ name + pattern + route, controller[ handler ]);
        });
      }
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
 
  // init koop centralized file access  
  // this allows us to turn the FS access off globally
  koop.files = new koop.Files( config );

  // store the data_dir in the cache, tiles, thumbnails
  // TODO all writing to the filesystem needs to over hauled and centralized.
  var data_dir = config.data_dir || __dirname;
  koop.Cache.data_dir = data_dir;
  koop.Tiles.data_dir = data_dir;
  koop.Thumbnail.data_dir = data_dir;

  // Need the exporter to have access to the cache so we pass it Koop
  koop.exporter = new koop.Exporter( koop );


  return app;
  
};
