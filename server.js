var connect = require('connect');
var serveStatic = require('serve-static');
connect().use(serveStatic(__dirname)).listen(8082, function(){
    console.log('Server running on 8082...');
});

/*
1.- Install connect and serve-static with NPM

$ npm install connect serve-static

2.- Create server.js file with this content:

var connect = require('connect');
var serveStatic = require('serve-static');
connect().use(serveStatic(__dirname)).listen(8080, function(){
    console.log('Server running on 8080...');
});

3.-Run with Node.js

$ node server.js
You can now go to http://localhost:8080
*/