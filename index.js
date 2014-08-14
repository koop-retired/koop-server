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
      
      app[ provider.name ] = new provider.controller( Koop.Cache );
    
      for (var route in provider.routes){
        var path = route.split(' ');
        app[path[0]]( path[1], app[ provider.name ][ 
          provider.routes[ route ].action 
        ]);
      }
    }
  };

   // Start the Cache DB with the conn string from config
  if ( config.db ) {
    if ( config.db.postgis ){
      Koop.Cache.db = Koop.PostGIS.connect( config.db.postgis.conn );
    } else if ( config.db.sqlite ) {
      Koop.Cache.db = Koop.SQLite.connect( config.db.sqlite );
    }
  } else {
    console.log('Exiting since no DB configuration found in config');
    process.exit();
  }

  return app;
  
};
