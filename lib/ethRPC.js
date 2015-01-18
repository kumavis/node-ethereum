const Account = require('ethereumjs-lib').Account;

module.exports = EthRPC;


var SUPPORTED_RPC_VERSION = '2.0';

function EthRPC(opts) {
  this.app = opts.app;
}

EthRPC.prototype.processRpc = function(rpcMessage, cb) {
  // parse rpc arguments
  var method = rpcMessage.method;
  var params = rpcMessage.params;
  var requestId = rpcMessage.id;
  var version = rpcMessage.jsonrpc;
  // extract relevant function
  var fn = fnForMethod(method);
  // check rpc version
  if (version !== SUPPORTED_RPC_VERSION) {
    fn = versionNotSupported;
  }
  // execute rpc method
  fn.call(this, params, function(err, result){
    if (err) {
      cb(err);
    } else {
      cb(null, wrapResult(requestId, result));
    }
  });
}

function notImplemented(params, cb) {
  var errMessage = 'RPC Method Not Implemented.'
  console.error(errMessage)
  cb(new Error(errMessage))
}

function noSuchMethod(params, cb) {
  var errMessage = 'Unknown RPC Method.'
  console.error(errMessage)
  cb(new Error(errMessage))
}

function versionNotSupported(params, cb) {
  var errMessage = 'Unsupported RPC Version.'
  console.error(errMessage)
  cb(new Error(errMessage))
}

function wrapResult(requestId, value) {
  return {
    id: requestId,
    jsonrpc: SUPPORTED_RPC_VERSION,
    result: value,
  }
}

//
// method implementations
//

EthRPC.prototype.eth_balanceAt = function(params, cb) {
  var address = params[0];
  app.vm.trie.get(address, function(err, data) {
    var account = new Account(data);
    cb(null, account.balance.toString('hex'))
  })
}

//
// Method map
//

function fnForMethod(method) {
  var map = {
    eth_coinbase:              notImplemented,
    eth_setCoinbase:           notImplemented,
    eth_listening:             notImplemented,
    eth_setListening:          notImplemented,
    eth_mining:                notImplemented,
    eth_setMining:             notImplemented,
    eth_gasPrice:              notImplemented,
    eth_accounts:              notImplemented,
    eth_peerCount:             notImplemented,
    eth_defaultBlock:          notImplemented,
    eth_setDefaultBlock:       notImplemented,
    eth_number:                notImplemented,
    eth_balanceAt:             EthRPC.prototype.eth_balanceAt,
    eth_stateAt:               notImplemented,
    eth_storageAt:             notImplemented,
    eth_countAt:               notImplemented,
    eth_codeAt:                notImplemented,
    eth_transact:              notImplemented,
    eth_call:                  notImplemented,
    eth_blockByHash:           notImplemented, //( hash : String )
    eth_blockByNumber:         notImplemented, //( number : Integer )
    eth_transactionByHash:     notImplemented, //( hash : String, nth : Integer )
    eth_transactionByNumber:   notImplemented, //( number : Integer, nth : Integer )
    eth_uncleByHash:           notImplemented, //( hash : String, nth : Integer )
    eth_uncleByNumber:         notImplemented, //( number : Integer, nth : Integer )
    eth_compilers:             notImplemented,
    eth_lll:                   notImplemented,
    eth_solidity:              notImplemented,
    eth_serpent:               notImplemented,
    eth_newFilter:             notImplemented,
    eth_newFilterString:       notImplemented,
    eth_uninstallFilter:       notImplemented,
    eth_changed:               notImplemented,
    eth_filterLogs:            notImplemented,
    eth_logs:                  notImplemented,
    db_put:                    notImplemented,
    db_get:                    notImplemented,
    db_putString:              notImplemented,
    db_getString:              notImplemented,
    shh_post:                  notImplemented,
    shh_newIdeninty:           notImplemented,
    shh_haveIdentity:          notImplemented,
    shh_newGroup:              notImplemented,
    shh_addToGroup:            notImplemented,
    shh_newFilter:             notImplemented,
    shh_uninstallFilter:       notImplemented,
    shh_changed:               notImplemented,
  }
  return map[method] || noSuchMethod;
}


//  --------------------------
// | below code is not in use |
//  --------------------------

/*
//Returns the balance of the account of address given by the address
EthRPC.prototype.getBalanceAt = function(address) {
  getAccountInfo(address, self.vm.trie, self.blockchain, 'balance', cb);
};

//Returns the value in storage at position given by the number _x of the account of address given by the address _a.
EthRPC.prototype.getStateAt = function(address, key, cb) {
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
};

//Returns the number of transactions send from the account of address given by _a.
EthRPC.prototype.getCountAt = function(address) {
  getAccountInfo(address, self.vm.trie, self.blockchain, 'nonce', cb);
};

//Returns true if the account of address given by _a is a contract-account.
EthRPC.prototype.getCodeAt = function(address) {
  getAccountInfo(address, self.vm.trie, self.blockchain, 'code', cb);
};

//Returns an anonymous object describing the block with hash _hash, passed as a string.
//or Returns an anonymous object describing the block with number _number, passed as an integer.
EthRPC.prototype.getBlock = function(hash) {

};

EthRPC.prototype.getBlockByHash = function() {
  var hash = new Buffer(hash, 'hex');
  self.app.blockchain.getBlock(hash, done);
};

EthRPC.prototype.transact = function() {
  var tx = new Transaction([
    bignum(obj.nonce).toBuffer(),
    bignum(obj.gasPrice).toBuffer(),
    bignum(obj.gasLimit).toBuffer(),
    new Buffer(obj.to, 'hex'),
    bignum(obj.value).toBuffer(),
    new Buffer(obj.data, 'hex')
  ]);

  self.accountMan.sign(tx, function(err, signedTx) {
    if (err) {
      cb(err);
      return;
    }
    self.vm.runTx(signedTx, self.blockchain.head, cb);
  });
};

EthRPC.prototype.transactByHash = function(argument) {
  var hash = new Buffer(hash, 'hex');
  self.app.blockchain.getBlock(hash, function(err, block) {
    if (err) {
      done(err);
      return;
    }
    done(null, block.transactions[number]);
  });
};

EthRPC.prototype.uncleByHash = function(hash, number, done) {
  hash = new Buffer(hash, 'hex');
  self.blockchain.getBlock(hash, function(err, block) {
    if (err) {
      done(err);
      return;
    }
    done(null, block.uncleHeaders[number]);
  });
};

EthRPC.prototype.call = function() {

};

EthRPC.prototype.getPeers = function() {

};

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
*/

// some data manipulating code removed from WsRpc - useful?

/*
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
      resObj.code = -32603; //Internal error  Internal JSON-RPC error.
    }

    ws.send(JSON.stringify(resObj));

  });

  func.apply(self, params);

} else {
  resObj.code = -32601; //Method not found  The method does not exist / is not available.
  ws.send(JSON.stringify(resObj));
}
*/