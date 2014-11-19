const WebSocketServer = require('ws').Server,
  bignum = require('bignum'),
  Account = require('ethereumjs-lib').Account,
  Transaction = require('ethereumjs-lib').Transaction;

var wss;

function getAccountInfo(address, state, tmpBlockchain, property, cb) {
  address = new Buffer(address, 'hex');

  // ****************************************************
  // TODO hack needs to be removed (hack needed for now since processBlocks.js is affecting the root)
  // ****************************************************
  state.root = tmpBlockchain.head.header.stateRoot;

  state.get(address, function(err, raw) {
    if (err) {
      cb(err);
      return;
    }
    var account = new Account(raw);

    if (property === 'code') {
      account.getCode(state, function(err, code) {
        if (err) {
          cb(err);
          return;
        }
        cb(null, code.toString('hex'));
      });
      return;
    }

    cb(null, bignum.fromBuffer(account[property]).toString());
  });
}

//the function that starts the application
exports.start = function(options, done) {

  var self = this;

  wss = new WebSocketServer({
    port: 40404
  });

  var rpcFunctions = {
    blockByHash: function(hash, done) {
      hash = new Buffer(hash, 'hex');
      self.blockchain.getBlock(hash, done);
    },
    transactionByHash: function(hash, number, done) {
      hash = new Buffer(hash, 'hex');
      self.blockchain.getBlock(hash, function(err, block) {
        if (err) {
          done(err);
          return;
        }
        done(null, block.transactions[number]);
      });
    },
    uncleByHash: function(hash, number, done) {
      hash = new Buffer(hash, 'hex');
      self.blockchain.getBlock(hash, function(err, block) {
        if (err) {
          done(err);
          return;
        }
        done(null, block.uncleHeaders[number]);
      });
    },
    balanceAt: function(address, cb) {
      getAccountInfo(address, self.vm.trie, self.blockchain, 'balance', cb);
    },
    countAt: function(address, cb) {
      getAccountInfo(address, self.vm.trie, self.blockchain, 'nonce', cb);
    },
    codeAt: function(address, cb) {
      getAccountInfo(address, self.vm.trie, self.blockchain, 'code', cb);
    },
    stateAt: function(address, at, cb) {
      var state = self.vm.trie,
        tmpBlockchain = self.blockchain;
      address = new Buffer(address, 'hex');
      at = new Buffer(at, 'hex');

      // ****************************************************
      // TODO hack needs to be removed (hack needed for now since processBlocks.js is affecting the root)
      // ****************************************************
      state.root = tmpBlockchain.head.header.stateRoot;

      state.get(address, function(err, raw) {
        if (err) {
          cb(err);
          return;
        }
        var account = new Account(raw),
          origRoot;

        //TODO create new state instead of settings roots
        origRoot = state.root;
        state.root = account.stateRoot;
        state.get(at, function(err, val) {
          if (err) {
            cb(err);
            return;
          }

          state.root = origRoot;
          cb(err, val);
        });
      });
    },
    transact: function(obj, cb) {
      console.log('@@@@ obj: ', obj)

      var tx = new Transaction([
        bignum(obj.nonce).toBuffer(),
        bignum(obj.gasPrice).toBuffer(),
        bignum(obj.gasLimit).toBuffer(),
        new Buffer(obj.to, 'hex'),
        bignum(obj.value).toBuffer(),
        new Buffer(obj.data, 'hex')
      ]);
      //tx.sign(privKey);
    },
    isMining: function() {},
    mine: function(done) {
      self.toggleMining();
      done();
    },
    isListening: function() {},
    peers: function(done) {
      done(null, self.network.peers);
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
              resObj.results = result;
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
