var express = require('express'),
  jade = require('jade'),
  WebSocketServer = require('ws').Server;

var app = express(),
  wss = new WebSocketServer({
    server: app
  });

app.get('/', function (req, res) {
  res.render('index.jade');
});

wss.on('connection', function (ws) {
  ws.on('message', function (message) {
    app.rpc.runCall(message, function (result) {
      ws.send(result);
    });
  });
});

wss.broadcast = function (data) {
  for (var i in this.clients)
    this.clients[i].send(data);
};


app.listen(3000);
