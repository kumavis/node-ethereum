const util = require('util');
const EventEmitter = require('events').EventEmitter;
const Transaction = require('ethereumjs-lib').Transaction;
const Block = require('ethereumjs-lib').Block;
const utils = require('ethereumjs-util');
const rlp = require('rlp');

const Version = 54;
const OFFSET = 0x10;
const TYPES = {
  0x0: 'status',
  0x1: 'getTransactions',
  0x2: 'transactions',
  0x3: 'getBlockHashes',
  0x4: 'blockHashes',
  0x5: 'getBlocks',
  0x6: 'blocks',
  0x7: 'newBlock'
};

const OFFSETS = {
  'status': 0x0,
  'getTransactions': 0x1,
  'transactions': 0x2,
  'getBlockHashes': 0x3,
  'blockHashes': 0x4,
  'getBlocks': 0x5,
  'blocks': 0x6,
  'newBlock': 0x7
};

var Manager = module.exports = function(stream) {
  // Register as event emitter
  EventEmitter.call(this);
  var self = this;
  this.version = 43;
  this.id = 1;
  stream.on('data', function(data){
    self.parse(data);
  });
};

util.inherits(Manager, EventEmitter);

//parses an array of transactions
function parseTxs(payload) {
  var txs = [];
  for (var i = 1; i < payload.length; i++) {
    txs.push(new Transaction(payload[i]));
  }
  return txs;
}

function parseBlocks(payload) {
  //blocks
  var blocks = [];
  for (var i = 1; i < payload.length; i++) {
    blocks.push(new Block(payload[i]));
  }
  return blocks;
}


//packet parsing methods
var parsingFunc = {
  status: function(payload) {
    return {
      ethVersion: payload[1][0],
      networkID: payload[2][0],
      td: payload[3],
      bestHash: payload[4],
      genesisHash: payload[5]
    };
  },
  transactions: function(payload) {
    return parseTxs(payload);
  },
  getBlockHashes: function(payload) {
    return {
      hash: payload[1],
      maxBlocks: payload[2]
    };
  },
  blockHashes: function(payload) {
    return payload.slice(1);
  },
  getBlocks: function(payload) {
    return payload.slice(1);
  },
  blocks: function(payload) {
    return parseBlocks(payload);
  },
  newBlock: function(payload) {
    return {
      block: new Block(payload[1]),
      td: payload[2]
    };
  }
};

Manager.prototype.parse = function(data) {
  var type = TYPES[data.slice(0, 1)[0] - OFFSET];
  //try{
  var parsed = parsingFunc[type](rlp.decode(data.slice(1)))
  this.emit(type, parsed);
  //}catch(e){
  //   this.emit('error', e);
  //}
};

Manager.prototype.send = function(type, data, cb){
  this.stream.write(Buffer.concat([new Buffer([type]), rlp.encode(data)]), cb);
};

//packet sending methods
Manager.prototype.sendStatus = function(td, bestHash, genesisHash, cb) {
  var msg = [
    this.version,
    this.networkID,
    td,
    bestHash,
    genesisHash
  ];
  this.send(OFFSETS.status, msg, cb);
};

/**
 * Specify (a) transaction(s) that the peer should make sure is included on its
 * transaction queue.
 * @method sendTransactions
 * @param {Array.<Transaction>} transaction
 * @param {Function} cb
 */
Manager.prototype.sendTransactions = function(transactions, cb) {
  var msg = [];
  transactions.forEach(function(tx) {
    msg.push(tx.serialize());
  });
  this.send(OFFSETS.transactions, msg, cb);
};

Manager.prototype.sendGetBlockHashes = function(startHash, max, cb) {
  var msg = [startHash, utils.intToBuffer(max)];
  this.send(OFFSETS.getBlockHashes, msg, cb);
};

Manager.prototype.sendBlockHashes = function(hashes, cb) {
  this.send(OFFSETS.blockHashes, cb)
};

Manager.prototype.sendGetBlocks = function(hashes, cb) {
  hashes = hashes.slice();
  this.send(OFFSETS.getBlockHashes, hashes, cb);
};

/**
 * Specify (a) block(s) that the peer should know about.
 * @method sendBlocks
 * @param {Array.<Block>} blocks
 * @param {Function} cb
 */
Manager.prototype.sendBlocks = function(blocks) {
  var msg = [];

  blocks.forEach(function(block) {
    msg.push(block.serialize());
  });

  return msg;
};

/**
 * Specify (a) block(s) that the peer should know about.
 * @method sendBlocks
 * @param {Array.<Block>} block
 * @param {Number} td tottal difficulty
 * @param {Function} cb
 */
Manager.prototype.sendNewBlock = function(block, td) {
  var msg = [block.serialize(false), td];
  return msg;
};

/**
 * Request the peer to send all transactions currently in the queue
 * @method sendGetTransactions
 * @param {Function} cb
 */
Manager.prototype.fetchTransaction = function(cb) {
  this.once('eth.transaction', cb);
  this.getTransactions();
};


Manager.prototype.fetchBlockHashes = function(startHash, max, cb) {
  this.once('eth.blockHashes', cb);
  this.getBlockHashes(startHash, max);
};

Manager.prototype.fetchBlocks = function(hashes, cb) {
  this.once('eth.blocks', cb);
  this.getBlocks(hashes);
};
