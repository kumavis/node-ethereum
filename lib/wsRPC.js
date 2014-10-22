const WebSocketServer = require('ws').Server;

var wss;

//the function that starts the application
exports.start = function(options, done) {

  var self = this;

  wss = new WebSocketServer({
    port: 8084
  });

  var rpcFunctions = {
    blocks: function(hashes) {

    },
    transaction: function() {},
    balanceAt: function() {},
    countAt: function() {},
    codeAt: function() {},
    stateAt: function() {},
    isMining: function() {},
    mine: function(done) {
      self.toggleMining();
      done();
    },
    isListening: function() {},
    peers: function(done) {
      done(null, self.network.getPeers());
    },
    newFilter: function() {},
    deleteFilter: function() {}
  };

  wss.on('connection', function(ws) {
    ws.on('message', function(message) {

      try {
        var command = JSON.parse(message),
          func = rpcFunctions[command.method],
          params = command.params,
          resObj = {
            'id': command.id
          };

        if (!Array.isArray(params)) {
          params = params ? [params] : [];
        }

        if (func) {
          params.push(function(err, result) {

            if (!err) {
              resObj.result = result;
            } else {
              resObj.code = -32603; //Internal error	Internal JSON-RPC error.
            }

            ws.send(JSON.stringify(resObj));

          });

          func.apply(self, params);

        } else {
          resObj.code = -32601; //Method not found	The method does not exist / is not available.
          ws.send(JSON.stringify(resObj));
        }
      } catch (e) {
        ws.send(JSON.stringify({
          'code': -32700 //invalid json
        }));
      }

    });
  });

  wss.broadcast = function(data) {
    for (var i in this.clients)
      this.clients[i].send(data);
  };

  done();
};

exports.stop = function(done) {
  wss.close();
  done();
};
