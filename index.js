var express = require("express");
  fs = require('fs');
  koop = require('./lib');

module.exports = function(config) {
  var app = express();
  app.set('view engine', 'ejs');
  
  // serve the index 
  app.get("/", function(req, res, next) {
    res.render(__dirname + '/views/home/index');
  });


  // register providers into the app
  // sets up models, routes -> controllers/handlers 
  app.register = function(provider){
    if ( provider.name ) {
      for (var route in provider.routes){
        var path = route.split(' ');
        app[path[0]]( path[1], provider.controller[ 
          provider.routes[ route ].action 
        ]);
      }
      global[provider.name] = provider.model;
    }
  };

  return app;
  
};
