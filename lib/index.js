var Ethereum = require('ethereum-lib'),
  levelup = require('levelup'),
  async = require('async');

var Block = Ethereum.Block;

var App = module.exports = function (settings) {

  var self = this,
    stateDB = levelup('./db/state'),
    blockDB = levelup('./db/block'),
    detailsDB = levelup('./db/details');

  this.settings = settings;
  this.blockchain = new Ethereum.Blockchain(blockDB, detailsDB);
  this.vm = new Ethereum.VM(stateDB);
  this.network = new Ethereum.Network({
    version: 25
  });

  this.network.on('message.hello', function (hello, peer) {
    self._sync(peer);
  });

  this.network.on('message.blocks', function (blocks) {
    self._onBlock(blocks, self.blockchain.head);
  });
};

App.prototype._sync = require('./sync.js');
App.prototype._onBlock = require('./onBlock.js');

App.prototype.start = function (cb) {

  var self = this;

  function checkGenesis(done) {
    if (!this.blockchain.head) {
      this.vm.generateGenesis(function () {
        var block = new Block();
        block.header.stateRoot = this.vm.trie.root;
        this.blockchain.addBlock(block, done);
      });
    } else {
      done();
    }
  }

  async.series([
    this.blockchain.init.bind(this.blockchain),
    checkGenesis.bind(this)
  ], function () {
    self.network.listen(30303, '0.0.0.0');
    if (cb) cb();
  });

};

App.prototype.stop = function (cb) {};

App.prototype.dumpBlockChain = function (cb) {
  var hash = this.blockchain.meta.genesis,
    height = this.blockchain.meta.height;

  this.blockchain.getBlockChain([hash], height, function (err, results) {
    //add the genesis block to the end of the results
    this.blockchain.getBlock(hash, function (err, genesis) {
      results.push(genesis);
      results = results.map(function (b) {
        return b.serialize(false);
      });
      cb(results);
    });
  });
};
