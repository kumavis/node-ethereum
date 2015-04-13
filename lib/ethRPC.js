const Account = require('ethereumjs-lib').Account;
const VM = require('ethereumjs-lib').VM;
const Transaction = require('ethereumjs-lib').Transaction;
const Block = require('ethereumjs-lib').Block;
const Trie = require('ethereumjs-lib').Trie;
const netDefs = require('ethereumjs-lib').networkDef;
const ethUtil = require('ethereumjs-util');
const crypto = require('crypto');

const SUPPORTED_RPC_VERSION = '2.0';
const hexStrPrefix = '0x';

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
        logTopics.forEach(function(lt) {
          match &= (lt.toString('hex') === t);
        });

        if (match) {
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

  if(blockHash === 'last'){
    blockhash = this.app.blockchain.meta.genesis;
  }

  if(blockHash === 'latest' || blockHash === 'pending'){
    cb(null, this.app.vm.trie);
  }else if (blockHash) {

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


//th
// method implementations
//
EthRPC.prototype.eth_getBalance = function(params, cb) {
  var address = normalizeHexString(params[0]);
  var blockHash = normalizeHexString(params[1]);

  this.getBlock(blockHash, function(err, trie) {
    if (err) return cb(err);
    trie.get(new Buffer(address, 'hex'), function(err, data) {
      if (err) return cb(err);
      var account = new Account(data);
      cb(null, hexStrPrefix + account.balance.toString('hex'));
    });
  });
};

EthRPC.prototype.eth_number = function(params, cb) {
  cb(null, ethUtil.bufferToInt(this.app.blockchain.head.header.number));
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

EthRPC.prototype.net_listening = function(params, cb) {
  if (this.app.network) {
    cb(null, this.app.network.listening);
  } else {
    cb(null, false);
  }
};

EthRPC.prototype.eth_setListening = function(params, cb) {
  cb(null, this.app.network.listen());
};

EthRPC.prototype.eth_getState = function(params, cb) {
  var address = normalizeHexString(params[0]);
  var key = normalizeHexString(params[1]);
  var blockHash = normalizeHexString(params[2]);
  var self = this;

  function getState(err, trie) {
    if (err) return cb(err);
    trie.get(new Buffer(thaddress, 'hex'), function(err, data) {
      if (err) return cb(err);
      var account = new Account(data);
      account.getStorage(new Buffer(key, 'hex'), function(err, val) {
        if (err) return cb(err);
        cb(null, hexStrPrefix + val.toString('hex'));
      });
    });
  }

  this.getBlock(blockHash, getState);
};

EthRPC.prototype.eth_getStorageAt = function(params, cb) {
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
        returnVals[data.key.toString('hex')] = data.value.toString('hex');
      });

      stream.on('end', function() {
        cb(null, returnVals);
      });
    });
  }

  this.getBlock(blockHash, dumpState);
};


EthRPC.prototype.eth_getTransactionCount = function(params, cb) {
  var address = normalizeHexString(params[0]);
  var blockHash = normalizeHexString(params[1]);
  var self = this;

  function getNonce(err, trie) {
    if (err) return cb(err);
    trie.get(new Buffer(address, 'hex'), function(err, data) {
      if (err) return cb(err);
      var account = new Account(data);
      cb(null, hexStrPrefix + account.nonce.toString('hex'));
    });
  }

  this.getBlock(blockHash, getNonce);
};

EthRPC.prototype.eth_getCode = function(params, cb) {
  var address = normalizeHexString(params[0]);
  var blockHash = normalizeHexString(params[1]);
  var self = this;

  function getCode(err, trie) {
    if (err) return cb(err);
    trie.get(new Buffer(address, 'hex'), function(err, data) {
      if (err) return cb(err);
      var account = new Account(data);
      account.getCode(trie, function(err, code) {
        cb(err, hexStrPrefix + code.toString('hex'));
      });
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
    var returnValue = null;
    if (err) return cb(err);
    if (self.app.network) {
      self.app.network.broadcastTransactions([transaction]);
    }
    if (result.createdAddress) {
      returnValue = hexStrPrefix + result.createdAddress.toString('hex');
    }

    cb(null, returnValue);
  });
};

EthRPC.prototype.eth_call = function(params, cb) {
  this.getBlock(params[1], function(err, stateTrie){

    var vm = new VM(stateTrie, this.app.blockchain);
    var to = normalizeHexString(params[0].to);
    var data = normalizeHexString(params[0].data);

    //just make up some values for the call
    var callParams = {
      account: new Account({
        balance: 99999999999
      }),
      to: new Buffer(to, 'hex'),
      data: data ? new Buffer(data, 'hex') : data,
      gas: 999999999,
      gasPrice: 1,
      caller: ethUtil.zeros(20),
      value: 0
    };

    stateTrie.checkpoint();
    vm.runTx(callParams, function(err, results) {
      stateTrie.revert();
      if (err) return cb(err);
      if(results.vm.returnValue){
        cb(null, hexStrPrefix + results.vm.returnValue.toString('hex'));
      }else{
        cb(null,null);
      }
    });
  });
};

EthRPC.prototype.eth_blockByHash = function(params, cb) {
  var hash = normalizeHexString(params[0])
  this.app.blockchain.getBlock(hash, cb);
};

EthRPC.prototype.eth_blockByNumber = function(params, cb) {
  this.app.blockchain.getBlockByNumber(ethUtil.intToBuffer(params[0]), cb);
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

EthRPC.prototype.eth_newBlockFilter  = function(params, cb) {
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
  cb(null, id);
};

EthRPC.prototype.eth_protocolVersion = function(params, cb){
  cb(null, netDefs.meta.version);
}

EthRPC.prototype.eth_blockNumbere = function(params, cb){
  cb(null, this.blockchain.head.header.number);
}


//*****
//STUBS - these are not fully implemented
//*****
EthRPC.prototype.eth_accounts = function(params, cb) {
  cb(null, []);
};

EthRPC.prototype.eth_mining = function(params, cb) {
  cb(null, false);
};

EthRPC.prototype.eth_coinbase = function(params, cb) {
  var address = utils.zeros(20);
  cb(null, hexStrPrefix + address.toString('hex'));
};

//
// Method map
//
function fnForMethod(method) {
  var map = {
    eth_protocolVersiona: EthRPC.prototype.eth_protocolVersion,
    eth_coinbase: EthRPC.prototype.eth_coinbase, //need mining to work
    eth_setCoinbase: notImplemented, //need mining to word
    eth_setListening: EthRPC.prototype.eth_setListening,
    eth_mining: EthRPC.prototype.eth_mining, //need minig to work
    eth_setMining: notImplemented, //need minig to work
    eth_gasPrice: notImplemented, //nope nope nope
    eth_accounts: EthRPC.prototype.eth_accounts, //nope nope nope
    eth_peerCount: EthRPC.prototype.eth_peerCount,
    eth_defaultBlock: notImplemented, //no
    eth_setDefaultBlock: notImplemented, //nota
    eth_number: EthRPC.prototype.eth_number,
    eth_getBalance: EthRPC.prototype.eth_getBalance,
    eth_getState: EthRPC.prototype.eth_getState, //this should be name getStorage
    eth_getStorageAt: EthRPC.prototype.eth_getStorageAt, //should be called dump storage
    eth_getTransactionCount: EthRPC.prototype.eth_getTransactionCount, // count aka nonce
    eth_getCode: EthRPC.prototype.eth_getCode,
    eth_transact: notImplemented,
    eth_signedTransact: EthRPC.prototype.eth_signedTransact,
    eth_call: EthRPC.prototype.eth_call,
    eth_blockByHash: EthRPC.prototype.eth_blockByHash, //( hash : String )
    eth_blockByNumber: EthRPC.prototype.eth_blockByNumber, //( number : Integer )
    eth_blockNumber: EthRPC.prototype.eth_blockNumber,
    eth_transactionByHash: notImplemented, //( hash : String, nth : Integer ) WTF? we cant do this because we didn't index the transactoins
    eth_transactionByNumber: EthRPC.prototype.eth_transactionByNumber, //( number : Integer, nth : Integer )
    eth_uncleByHash: notImplemented, //( hash : String, nth : Integer )
    eth_uncleByNumber: EthRPC.prototype.eth_uncleByNumber, //( number : Integer, nth : Integer )
    eth_compilers: notImplemented,
    eth_lll: notImplemented,
    eth_solidity: notImplemented,
    eth_serpent: notImplemented,
    eth_newBlockFilter: EthRPC.prototype.eth_newBlockFilter,
    eth_newFilterString: notImplemented,
    eth_uninstallFilter: EthRPC.prototype.eth_unistallFilter,
    eth_changed: EthRPC.prototype.eth_changed,
    eth_filterLogs: notImplemented,
    eth_logs: notImplemented,
    net_listening: EthRPC.prototype.net_listening,
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
