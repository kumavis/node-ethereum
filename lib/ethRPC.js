const Account = require('ethereumjs-lib').Account;
const VM = require('ethereumjs-lib').VM;
const Transaction = require('ethereumjs-lib').Transaction;
const Block = require('ethereumjs-lib').Block;
const Trie = require('ethereumjs-lib').Trie;
const ethUtil = require('ethereumjs-util');

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
  fn.call(this, params, function(err, result) {
    if (err) {
      cb(err);
    } else {
      cb(null, wrapResult(requestId, result));
    }
  });
};

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
    result: value
  };
}

/**
 * Fetches a block given a blockHash or A block Number. The callback is then
 * given a Trie that is set to the stateRoot of the found block if there is one
 */
EthRPC.prototype.getBlock = function(blockHash, cb) {
  blockHash = normalizeHexString(blockHash)
  var self = this;


  function createBlock(err, data) {
    if (err) {
      cb(err);
    } else {
      var block = new Block(data);
      var stateRoot = block.header.stateRoot;
      var trie = new Trie(self.app.stateDB);

      trie.root = stateRoot;
      cb(trie);
    }
  }

  if (blockHash) {

    //lookup a hash
    if (blockHash.length === 64) {
      this.app.blockDB.get(new Buffer(blockHash, 'hex'), {
        valueEncoding: 'binary'
      }, createBlock);
    } else {
      //find block by number
      this.app.blockchain.getBlockByNumber(blockHash, createBlock);
    }
  } else {
    cb(this.app.vm.trie);
  }
};


//
// method implementations
//
EthRPC.prototype.eth_balanceAt = function(params, cb) {
  var address = normalizeHexString(params[0]);
  var blockHash = normalizeHexString(params[1]);

  this.getBlock(blockHash, function(trie) {
    trie.get(new Buffer(address, 'hex'), function(err, data) {
      if (err) {
        cb(err);
      } else {
        var account = new Account(data);
        cb(null, account.balance.toString('hex'));
      }
    });
  });
};

EthRPC.prototype.eth_number = function(params, cb) {
  cb(null, this.app.blockchain.head.number);
};

EthRPC.prototype.eth_peerCount = function(params, cb) {
  var peers;
  if (this.app.network) {
    peers = this.app.network.peers.length;
  } else {
    peers = 0;
  }
  cb(null, peers);
};

EthRPC.prototype.eth_listening = function(params, cb) {
  cb(null, this.app.network.listening);
};

EthRPC.prototype.eth_setListening = function(params, cb) {
  cb(null, this.app.network.listen());
};

EthRPC.prototype.eth_stateAt = function(params, cb) {
  var address = normalizeHexString(params[0]);
  var key = normalizeHexString(params[1]);
  var blockHash = normalizeHexString(params[2]);
  var self = this;

  function getState(trie) {
    trie.get(new Buffer(address, 'hex'), function(err, data) {
      if (err) {
        cb(err);
      } else {
        var account = new Account(data);
        account.getStorage(new Buffer(key, 'hex'), function(err2, val) {
          cb(err2, val.toString('hex'));
        });
      }
    });
  }

  this.getBlock(blockHash, getState);
};

EthRPC.prototype.eth_storgeAt = function(params, cb) {
  var address = normalizeHexString(params[0]);
  var blockHash = normalizeHexString(params[1]);
  var self = this;

  function dumpState(trie) {

    trie.get(new Buffer(address, 'hex'), function(err, data) {
      if (err) {
        cb(err);
      } else {

        var account = new Account(data);
        var t = trie.copy();
        t.root = account.stateRoot;
        var stream = t.createReadStream();
        var returnVals = {};

        stream.on('data', function(data) {
          returnVals[data.key] = data.value.toString('hex');
        });

        stream.on('end', function() {
          cb(null, returnVals);
        });
      }
    });
  }

  this.getBlock(blockHash, dumpState);
};


EthRPC.prototype.eth_countAt = function(params, cb) {
  var address = normalizeHexString(params[0]);
  var blockHash = normalizeHexString(params[1]);
  var self = this;

  function getNonce(trie) {
    trie.get(new Buffer(address, 'hex'), function(err, data) {
      if (err) {
        cb(err);
      } else {
        var account = new Account(data);
        cb(null, account.nonce.toString('hex'));
      }
    });
  }

  this.getBlock(blockHash, getNonce);
};

EthRPC.prototype.eth_codeAt = function(params, cb) {
  var address = normalizeHexString(params[0]);
  var blockHash = normalizeHexString(params[1]);
  var self = this;

  function getCode(trie) {
    trie.get(new Buffer(address, 'hex'), function(err, data) {
      if (err) {
        cb(err);
      } else {
        var account = new Account(data);
        account.getCode(trie, cb);
      }
    });
  }

  this.getBlock(blockHash, getCode);
};

EthRPC.prototype.eth_signedTransact = function(params, cb) {

  var hexString = normalizeHexString(params[0])
  var raw = new Buffer(hexString, 'hex');

  var transaction = new Transaction(raw);
  var self = this;

  this.app.vm.runTx({tx: transaction}, function(err, result) {
    if (!err && self.app.network) {
      self.app.network.broadcastTransactions([transaction]);
    }
    if (err) {
      cb(err);
    } else {
      cb(null, result.vm.returnValue.toString('hex'));
    }
  });
};

EthRPC.prototype.eth_call = function(params, cb) {

  var stateTrie = new Trie(this.app.stateDB);
  stateTrie.root = this.app.vm.trie.root;

  var vm = new VM(stateTrie, this.app.blockchain);
  var to = normalizeHexString(params.to);
  var data = normalizeHexString(params.data);
  var callParams = {
    account: new Account({balance: 99999999999}),
    to: new Buffer(to, 'hex'),
    data: new Buffer(data, 'hex'),
    gas: 999999999,
    gasPrice: 0,
    caller: ethUtil.zeros(20),
    value: 0
  };

  stateTrie.checkpoint();
  vm.runCall(callParams, function(err, results) {
    stateTrie.revert();
    if (err) {
      cb(err);
    } else {
      cb(null, results.vm.returnValue.toString('hex'));
    }
  });
};

EthRPC.prototype.eth_blockByHash = function(params, cb) {
  var hash = normalizeHexString(params[0])
  this.app.blockchain.getBlock(hash, cb);
};

EthRPC.prototype.eth_blockByNumber = function(params, cb) {
  this.app.blockchain.getBlockByNumber(params[0], cb);
};

EthRPC.prototype.eth_transactionByNumber = function(params, cb) {
  this.app.blockchain.getBlockByNumber(params[0], function(err, block) {
    if (err) {
      cb(err);
    } else {
      cb(null, block.transactions[params[1]]);
    }
  });
};

EthRPC.prototype.eth_transactionByNumber = function(params, cb) {
  this.app.blockchain.getBlockByNumber(params[0], function(err, block) {
    if (err) {
      cb(err);
    } else {
      cb(null, block.transactions[params[1]]);
    }
  });
};

EthRPC.prototype.eth_uncleByNumber = function(params, cb) {
  this.app.blockchain.getBlockByNumber(params[0], function(err, block) {
    if (err) {
      cb(err);
    } else {
      cb(null, block.uncles[params[1]]);
    }
  });
};

// EthRPC.prototype.eth_filterLogs = function(params, cb){
//   var topic = params[0];
//   var stream  = this.app.logDB.createReadStream();
//   var matches = [];
//   stream.on('data', function(data){
//     var bloom = new Bloom(data.key);
//     if(bloom.check(topic)){
//       matches.push(data.values);
//     }
//   });
// };

// EthPRC.prototype.eth_newFilterString(){

// }

//
// Method map
//

function fnForMethod(method) {
  var map = {
    eth_coinbase: notImplemented, //need mining to work
    eth_setCoinbase: notImplemented, //need mining to word
    eth_listening: EthRPC.prototype.eth_listening,
    eth_setListening: EthRPC.prototype.eth_setListening,
    eth_mining: notImplemented, //need minig to work
    eth_setMining: notImplemented, //need minig to work
    eth_gasPrice: notImplemented, //nope nope nope
    eth_accounts: notImplemented, //nope nope nope
    eth_peerCount: EthRPC.prototype.eth_peerCount,
    eth_defaultBlock: notImplemented, //no
    eth_setDefaultBlock: notImplemented, //nota
    eth_number: EthRPC.prototype.eth_number,
    eth_balanceAt: EthRPC.prototype.eth_balanceAt,
    eth_stateAt: EthRPC.prototype.eth_stateAt, //this should be name getStorage
    eth_storageAt: EthRPC.prototype.eth_storageAt, //should be called dump storage
    eth_countAt: EthRPC.prototype.eth_countAt, // count aka nonce
    eth_codeAt: EthRPC.prototype.eth_codeAt,
    eth_transact: notImplemented,
    eth_signedTransact: EthRPC.prototype.eth_signedTransact,
    eth_call: EthRPC.prototype.eth_call,
    eth_blockByHash: EthRPC.prototype.eth_blockByHash, //( hash : String )
    eth_blockByNumber: EthRPC.prototype.eth_blockByNumber, //( number : Integer )
    eth_transactionByHash: notImplemented, //( hash : String, nth : Integer ) WTF? we cant do this because we didn't index the transactoins
    eth_transactionByNumber: EthRPC.prototype.eth_transactionByNumber, //( number : Integer, nth : Integer )
    eth_uncleByHash: notImplemented, //( hash : String, nth : Integer )
    eth_uncleByNumber: EthRPC.prototype.eth_uncleByNumber, //( number : Integer, nth : Integer )
    eth_compilers: notImplemented,
    eth_lll: notImplemented,
    eth_solidity: notImplemented,
    eth_serpent: notImplemented,
    eth_newFilter: notImplemented,
    eth_newFilterString: notImplemented,
    eth_uninstallFilter: notImplemented,
    eth_changed: notImplemented,
    eth_filterLogs: notImplemented,
    eth_logs: notImplemented,
    db_put: notImplemented,
    db_get: notImplemented,
    db_putString: notImplemented,
    db_getString: notImplemented,
    shh_post: notImplemented,
    shh_newIdeninty: notImplemented,
    shh_haveIdentity: notImplemented,
    shh_newGroup: notImplemented,
    shh_addToGroup: notImplemented,
    shh_newFilter: notImplemented,
    shh_uninstallFilter: notImplemented,
    shh_changed: notImplemented
  }
  return map[method] || noSuchMethod;
}

function normalizeHexString(hex) {
  if (hex.slice(0,2) === '0x') {
    return hex.slice(2);
  } else {
    return hex;
  }
}