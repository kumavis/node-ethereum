var express = require('express'),
  request = require('request'),
  async = require('async'),
  shimServer = require('./shimServer.js'),
  WebSocketServer = require('ws').Server;

var app = express(),

  wss = new WebSocketServer({
    server: app
  });

wss.broadcast = function (data) {
  for (var i in this.clients)
    this.clients[i].send(data);
};

app.use('/public', express.static(__dirname + '/public'));
app.set('view engine', 'jade');

app.get('/', function (req, res) {
  res.render('index.jade');
});

app.get('*', function (req, res) {

  var url = req.url.slice(1),
    urlMatch = /^(https?|http?|file):\/\//;

  var match = url.match(urlMatch);
  if (!match) {
    url = 'http://' + url;
  }

  shimServer(url, 3000, function (port) {
    //load the page in a iframe
    res.render('page', {
      'url': 'http://localhost:' + port
    });
  });

});


app.listen(3000);
