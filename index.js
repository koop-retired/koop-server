var express = require("express"),
  fs = require('fs'),
  bodyParser = require('body-parser'),
  Koop = require('./lib');

module.exports = function(config) {
  var app = express();

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

      app[ provider.name ] = new provider.controller( Koop );
    
      for (var route in provider.routes){
        var path = route.split(' ');
        app[path[0]]( path[1], app[ provider.name ][ 
          provider.routes[ route ].action 
        ]);
      }
    }
  };

  // Start the Cache DB with the conn string from config
  if ( config && config.db ) {
    if ( config.db.postgis ){
      Koop.Cache.db = Koop.PostGIS.connect( config.db.postgis.conn );
    } else if ( config && config.db.sqlite ) {
      Koop.Cache.db = Koop.SQLite.connect( config.db.sqlite );
    }
  } else if (config && !config.db){
    console.log('Exiting since no DB configuration found in config');
    process.exit();
  }
  
  // store the data_dir in the cache
  Koop.Cache.data_dir = config.data_dir || __dirname;

  // TODO this is hack that acts like the global scope 
  // this will go away once a better way to access a central filesystem gets written
  Koop.config = config;

  return app;
  
};
