const Account = require('ethereumjs-lib').Account;
const VM = require('ethereumjs-lib').VM;
const Transaction = require('ethereumjs-lib').Transaction;
const Block = require('ethereumjs-lib').Block;
const Trie = require('ethereumjs-lib').Trie;
const netDefs = require('ethereumjs-lib').networkDef;
const ethUtil = require('ethereumjs-util');
const crypto = require('crypto');
const eth = require('./eth.js');
const net = require('./net.js');
const SUPPORTED_RPC_VERSION = '2.0';
const hexStrPrefix = '0x';

module.exports = EthRPC;

function EthRPC(app) {
  var self = this;
  this.app = app;

  this._setupHandlers();
  this._setupFilters();
}


EthRPC.prototype.processRpc = function(rpcMessage, cb) {
  // parse rpc arguments
  var method = rpcMessage.method;
  var params = rpcMessage.params;
  var requestId = rpcMessage.id;
  var version = rpcMessage.jsonrpc;
  // extract relevant function
  var fn = this._fnForMethod(method);
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
}

/**
 * Fetches a block given a blockHash or A block Number. The callback is then
 * given a Trie that is set to the stateRoot of the found block if there is one
 */
EthRPC.prototype.getStateAtBlock = function(blockHash, cb) {
  blockHash = normalizeHexString(blockHash)
  var self = this;

  function createBlock(err, data) {
    if (err) return cb(err);

    var block = new Block(data);
    var stateRoot = block.header.stateRoot;
    var trie = self.app.vm.trie.copy();

    trie.root = stateRoot;
    cb(null, trie);
  }

  if (blockHash === 'last') {
    blockhash = this.app.blockchain.meta.genesis;
  }

  if (blockHash === 'latest' || blockHash === 'pending') {
    cb(null, this.app.vm.trie);
  } else if (blockHash) {

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
}

EthRPC.prototype._setupHandlers = function() {
  this.map = {
    // -- web3 --
    web3_clientVersion: notImplemented,
    web3_sha3: notImplemented,

    // -- net --
    net_version: notImplemented,
    net_peerCount: net.peerCount,
    net_listening: net.listening,

    // -- eth --
    eth_protocolVersion: eth.protocolVersion,
    eth_coinbase: eth.coinbase,
    eth_mining: eth.mining,
    eth_hashrate: notImplemented,
    eth_gasPrice: notImplemented,
    eth_accounts: eth.accounts,
    eth_blockNumber: eth.blockNumber,
    eth_getBalance: eth.getBalance,
    eth_getStorageAt: eth.getStorageAt,
    eth_getTransactionCount: eth.getTransactionCount,
    eth_getBlockTransactionCountByHash: notImplemented,
    eth_getBlockTransactionCountByNumber: notImplemented,
    eth_getUncleCountByBlockHash: notImplemented,
    eth_getUncleCountByBlockNumber: notImplemented,
    eth_getCode: eth.getCode,
    eth_sign: notImplemented,
    eth_sendTransaction: notImplemented,
    eth_call: eth.call,
    eth_estimateGas: notImplemented,
    eth_getBlockByHash: eth.getBlockByHash,
    eth_getBlockByNumber: eth.getBlockByNumber,
    eth_getTransactionByHash: notImplemented,
    eth_getTransactionByBlockHashAndIndex: notImplemented,
    eth_getTransactionByBlockNumberAndIndex: eth.getTransactionByBlockNumberAndIndex,
    eth_getUncleByBlockHashAndIndex: notImplemented,
    eth_getUncleByBlockNumberAndIndex: notImplemented,
    eth_getCompilers: notImplemented,
    eth_compileLLL: notImplemented,
    eth_compileSolidity: notImplemented,
    eth_compileSerpent: notImplemented,
    eth_newFilter: eth.newFilter,
    eth_newBlockFilter: eth.newBlockFilter,
    eth_newPendingTransactionFilter: notImplemented,
    eth_uninstallFilter: eth.uninstallFilter,
    eth_getFilterChanges: eth.getFilterChanges,
    eth_getFilterLogs: eth.getFilterLogs,
    eth_getLogs: notImplemented,
    eth_getWork: notImplemented,
    eth_submitWork: notImplemented,
    // extra
    eth_signedTransact: eth._signedTransact,
    
    // -- db --
    db_putString: notImplemented,
    db_getString: notImplemented,
    db_putHex: notImplemented,
    db_getHex: notImplemented,
    
    // -- shh --
    shh_post: notImplemented,
    shh_version: notImplemented,
    shh_newIdentity: notImplemented,
    shh_hasIdentity: notImplemented,
    shh_newGroup: notImplemented,
    shh_addToGroup: notImplemented,
    shh_newFilter: notImplemented,
    shh_uninstallFilter: notImplemented,
    shh_getFilterChanges: notImplemented,
    shh_getMessages: notImplemented,
  }
}

EthRPC.prototype._setupFilters = function() {
  var self = this;
  this.logFilters = {};
  this.blockFilters = { pending: {}, latest: {} };

  // update "pending" block filters
  this.app.vm.on('afterTx', function(){
    for (id in self.blockFilters.pending) {
      var pendingFilter = self.blockFilters.pending[id]
      // "For filters created with eth_newBlockFilter log objects are null."
      // https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_getfilterchanges
      pendingFilter.results.push(null)
    }
  })

  // update "latest" block filters
  this.app.vm.on('block', function(){
    for (id in self.blockFilters.latest) {
      var blockFilter = self.blockFilters.latest[id]
      // "For filters created with eth_newBlockFilter log objects are null."
      // https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_getfilterchanges
      blockFilter.results.push(null)
    }
  })

  // update log filters
  this.app.vm.on('logs', function(logEvent) {
    for (var id in self.logFilters) {
      var filter = self.logFilters[id];
      // check for log filter match
      if (logEvent.bloom.multiCheck(filter.topics)) {
        onLogFilterBloomMatch(filter, logEvent, id)
      }
    }
  });

  function onLogFilterBloomMatch(filter, logEvent, id) {
    logEvent.logs.forEach(function(log, logIndex) {
      //push to the filter queue
      var match = true;
      var logTopics = log[1];
      // add address as topic
      logTopics.push(log[0]);

      filter.topics.forEach(function(filterTopic) {
        var filterMatch = false

        logTopics.forEach(function(logTopic) {
          filterMatch |= (logTopic.toString('hex') === filterTopic);
        });
        match &= filterMatch;
      });

      if (match) {
        var transactionIndex;
        if(logEvent.block){
          transactionIndex = logEvent.block.transactions.indexOf(logEvent.tx)
          //if -1
          if(transactionIndex < 0) transactionIndex = 0;
        }else{
          transactionIndex = 0;  
          logEvent.block = new Block();
        }

        filter.results.push({
          // HEX String - integer of the log index position in the block.
          logIndex: hexStrPrefix+ethUtil.intToHex(logIndex),
          // HEX String - integer of the transactions index position log was created from.
          transactionIndex: hexStrPrefix+ethUtil.intToHex(transactionIndex),
          // HEX String - hash of the transactions this log was created from.
          transactionHash: hexStrPrefix+logEvent.tx.hash().toString('hex'),
          // HEX String - 32-byte hash of the block where this log was in. null when the log is pending.
          blockHash: logEvent.block.hash().toString('hex'),
          // HEX String - integer of the block number where this log was in. null when the log is pending.
          blockNumber: hexStrPrefix+logEvent.block.header.number.toString('hex'),
          // HEX String - address from which this log originated.
          address: log[0].toString('hex'),
          // HEX String - contains the non-indexed arguments of the log.
          data: log[2].toString('hex'),
          // Array - Array of 0 to 4 HEX Strings of indexed log arguments.
          topics: logTopics.map(function(buffer) { return buffer.toString('hex') }),
        });
      }
    });
  }
}

//
// Method map
//

EthRPC.prototype._fnForMethod = function(method) {
  return this.map[method] || noSuchMethod(method);
}

// util

function notImplemented(params, cb) {
  var errMessage = 'RPC Method Not Implemented.'
  console.error(errMessage)
  cb(new Error(errMessage))
}

function noSuchMethod(method) {
  return function(params, cb){
    var errMessage = 'Unknown RPC Method "'+method+'".'
    console.error(errMessage)
    cb(new Error(errMessage))
  }
}

function versionNotSupported(params, cb) {
  var errMessage = 'Unsupported RPC Version.'
  console.error(errMessage)
  cb(new Error(errMessage))
}

function wrapResult(requestId, value) {
  var responseObj = {
    id: requestId,
    jsonrpc: SUPPORTED_RPC_VERSION,
    result: value
  };
  // if trace is present, move trace onto response object
  // and use correct return variable
  if (value && value.vmTrace) {
    responseObj.result = value.result;
    responseObj.vmTrace = value.vmTrace;
  }
  return responseObj;
}