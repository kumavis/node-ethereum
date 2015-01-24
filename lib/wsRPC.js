const WebSocketServer = require('ws').Server;
const Rpc = require('./ethRPC.js');

module.exports = WsRpc;

function WsRpc(opts){

  var app = this.app = opts.app;
  var rpc = this.rpc = new Rpc({app: app});

}

//the function that starts the application
WsRpc.prototype.start = function(options, done) {
  var self = this;

  options = options || {};
  options.ws = options.ws || {};

  var port = options.ws.port || 40404;

  var server = this.server = new WebSocketServer({
    port: port
  });

  console.log('WebsocketRpcServer - opening: /:'+port);

  server.on('connection', function(ws) {
    ws.on('message', function(message) {

      try {
        message = JSON.parse(message);
        self.rpc.processRpc(message, function(err, data){
          if (err) {
            sendError(err);
          } else {
            sendSuccess(data);
          }
        });

      } catch (error) {
        // invalid json
        error.code = -32700;
        sendError(error);
      }

      function sendError(error) {
        sendResponse({
          status: 'failed',
          message: error.message,
          code: error.code,
        });
      }

      function sendSuccess(data) {
        sendResponse(data);
      }

      function sendResponse(data) {
        ws.send(JSON.stringify(data));
      }

    });
  });

  server.broadcast = function(data) {
    for (var i in this.clients) {
      this.clients[i].send(data);
    }
  };

  done();
};

WsRpc.prototype.stop = function(done) {
  console.log('WebsocketRpcServer - closing.')
  this.server.close();
  done();
};
