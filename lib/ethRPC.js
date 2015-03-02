const Account = require('ethereumjs-lib').Account;
const VM = require('ethereumjs-lib').VM;
const Transaction = require('ethereumjs-lib').Transaction;
const Block = require('ethereumjs-lib').Block;
const Trie = require('ethereumjs-lib').Trie;
const ethUtil = require('ethereumjs-util');
const crypto = require('crypto');

const SUPPORTED_RPC_VERSION = '2.0';

module.exports = EthRPC = function(opts) {
  var self = this;
  this.app = opts.app;
  this.filters = [];
  this.logQueue = [];
  this.app.vm.on('logs', function(log) {
    //check each filter
    for (var f in self.filters) {
      var topics = self.filters[f];
      if (log.bloom.multiCheck(topics)) {
        //great we have the topic
        checkLogs(topics, log.logs, f)
      }
    }
  });

  function checkLogs(topics, logs, id) {
    logs.forEach(function(l) {
      //push to the filter queue
      topics.forEach(function(t) {
        var logTopics = l[1];
        var match = true;
        logTopics.forEach(function(lt){
          match &= (lt.toString('hex') === t);
        });

        if(match){
          self.logQueue.push({
            address: l[0].toString('hex'),
            data: l[2].toString('hex'),
            number: id
          });
        }

      });
    });
  }
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
    if (err) return cb(err);

    var block = new Block(data);
    var stateRoot = block.header.stateRoot;
    var trie = new Trie(self.app.stateDB);

    trie.root = stateRoot;
    cb(null, trie);
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
    cb(null, this.app.vm.trie);
  }
};


//
// method implementations
//
EthRPC.prototype.eth_balanceAt = function(params, cb) {
  var address = normalizeHexString(params[0]);
  var blockHash = normalizeHexString(params[1]);

  this.getBlock(blockHash, function(err, trie) {
    if (err) return cb(err);
    trie.get(new Buffer(address, 'hex'), function(err, data) {
      if (err) return cb(err);
      var account = new Account(data);
      cb(null, account.balance.toString('hex'));
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

  function getState(err, trie) {
    if (err) return cb(err);
    trie.get(new Buffer(address, 'hex'), function(err, data) {
      if (err) return cb(err);
      var account = new Account(data);
      account.getStorage(new Buffer(key, 'hex'), function(err, val) {
        if (err) return cb(err);
        cb(null, val.toString('hex'));
      });
    });
  }

  this.getBlock(blockHash, getState);
};

EthRPC.prototype.eth_storageAt = function(params, cb) {
  var address = normalizeHexString(params[0]);
  var blockHash = normalizeHexString(params[1]);
  var self = this;

  function dumpState(err, trie) {
    if (err) return cb(err);
    trie.get(new Buffer(address, 'hex'), function(err, data) {
      if (err) return cb(err);

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
    });
  }

  this.getBlock(blockHash, dumpState);
};


EthRPC.prototype.eth_countAt = function(params, cb) {
  var address = normalizeHexString(params[0]);
  var blockHash = normalizeHexString(params[1]);
  var self = this;

  function getNonce(err, trie) {
    if (err) return cb(err);
    trie.get(new Buffer(address, 'hex'), function(err, data) {
      if (err) return cb(err);
      var account = new Account(data);
      cb(null, account.nonce.toString('hex'));
    });
  }

  this.getBlock(blockHash, getNonce);
};

EthRPC.prototype.eth_codeAt = function(params, cb) {
  var address = normalizeHexString(params[0]);
  var blockHash = normalizeHexString(params[1]);
  var self = this;

  function getCode(err, trie) {
    if (err) return cb(err);
    trie.get(new Buffer(address, 'hex'), function(err, data) {
      if (err) return cb(err);
      var account = new Account(data);
      account.getCode(trie, cb);
    });
  }

  this.getBlock(blockHash, getCode);
};

EthRPC.prototype.eth_signedTransact = function(params, cb) {

  var hexString = normalizeHexString(params[0])
  var raw = new Buffer(hexString, 'hex');

  var transaction = new Transaction(raw);
  var self = this;

  this.app.vm.runTx({
    tx: transaction
  }, function(err, result) {
    if (err) return cb(err);
    if (self.app.network) {
      self.app.network.broadcastTransactions([transaction]);
    }
    cb(null, result.createdAddress);
  });
};

EthRPC.prototype.eth_call = function(params, cb) {

  var stateTrie = new Trie(this.app.stateDB);
  stateTrie.root = this.app.vm.trie.root;

  var vm = new VM(stateTrie, this.app.blockchain);
  var to = normalizeHexString(params[0].to);
  var data = normalizeHexString(params[0].data);

  //just make up some values for the call
  var callParams = {
    account: new Account({
      balance: 99999999999
    }),
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
    if (err) return cb(err);
    cb(null, results.vm.returnValue.toString('hex'));
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
    if (err) return cb(err);
    cb(null, block.transactions[params[1]]);
  });
};

EthRPC.prototype.eth_transactionByNumber = function(params, cb) {
  this.app.blockchain.getBlockByNumber(params[0], function(err, block) {
    if (err) return cb(err);
    cb(null, block.transactions[params[1]]);
  });
};

EthRPC.prototype.eth_uncleByNumber = function(params, cb) {
  this.app.blockchain.getBlockByNumber(params[0], function(err, block) {
    if (err) return cb(err);
    cb(null, block.uncles[params[1]]);
  });
};

EthRPC.prototype.eth_newFilter = function(params, cb) {
  var self = this;
  var id = crypto.randomBytes(8).toString('hex');
  var f = params[0]

  var topics = f.topic || [];
  if (f.address) topics.push(f.address);
  self.filters[id] = topics;

  cb(null, id);
};

EthRPC.prototype.eth_changed = function(params, cb) {
  cb(null, this.logQueue);
  this.logQueue = [];
};

EthRPC.prototype.eth_unistallFilter = function(params, cb) {
  delete this.filters[params[0]]
  cb();
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
    eth_newFilter: EthRPC.prototype.eth_newFilter,
    eth_newFilterString: notImplemented,
    eth_uninstallFilter: EthRPC.prototype.eth_unistallFilter,
    eth_changed: EthRPC.prototype.eth_changed,
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
  if (!hex) {
    return hex
  }

  if (hex.slice(0, 2) === '0x') {
    return hex.slice(2);
  } else {
    return hex;
  }
}
