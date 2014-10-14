var Ethereum = require('ethereumjs-lib');
var crypto = require('crypto');
var bignum = require('bignum');

var utils = Ethereum.utils;

exports.toggle = exports.start = function () {

  console.log('starting mining!');

  var self = this;

  var head = this.blockchain.head;
  var vm = this.vm;
  //the current block
  var currentBlock = new Ethereum.Block();

  currentBlock.header.timestamp = utils.intToBuffer(Date.now() / 1000 | 0);
  currentBlock.header.number = bignum.fromBuffer(head.header.number).add(1).toBuffer();
  currentBlock.header.difficulty = utils.intToBuffer(currentBlock.header.canonicalDifficulty(head));
  currentBlock.header.gasLimit = utils.intToBuffer(currentBlock.header.canonicalGaslimit(head));
  currentBlock.header.parentHash = head.hash();
  currentBlock.header.coinbase = new Buffer('fdad8ec94f3eca927e576b880defb6f69a7d5d9c', 'hex');

  vm.runBlock(currentBlock, head.header.state, true, function () {

    var notFound = true;
    var start = process.hrtime();
    var hashes = 0;

    //generate state;
    while (notFound) {
      currentBlock.header.nonce = crypto.pseudoRandomBytes(32);
      hashes++;
      if (currentBlock.header.validatePOW()) {
        console.log('nonce found!');
        notFound = false;
      }
    }

    var precision = 3; // 3 decimal places
    var elapsed = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli
    var sec = process.hrtime(start)[0];

    currentBlock.validate(self.blockchain, function () {
      self.network.broadcastNewBlock(currentBlock, bignum.fromBuffer(currentBlock.header.difficulty).add(bignum.fromBuffer(head.header.difficulty)).toBuffer());
    });

    console.log(sec + ' s, ' + elapsed.toFixed(precision) + ' ms - '); // print message + time
    console.log('hash/s: ' + (hashes / sec));
  });
};

exports.stop = function () {};
