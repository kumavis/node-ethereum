var Ethereum = require('ethereum-lib'),
  fs = require('fs'),
  levelup = require('levelup'),
  async = require('async'),
  defaults = require('./defaults.json');

/**
 * @constructor
 */
var App = module.exports = function (settings) {
  this.settings = settings  = settings ? settings : {};

  //set the default path for the config and database files
  defaults.path = process.env['HOME'] + '/.ethereum-node';

  //add the defaults
  for (var prop in defaults) {
    if (settings[prop] === void 0) settings[prop] = defaults[prop];
  }
};

App.prototype._sync = require('./sync.js');
App.prototype._onBlock = require('./onBlock.js');

/**
 * Starts the client
 * @method start
 * @param {Function} cb a callback
 */
App.prototype.start = function (cb) {

  var self = this;

  /**
   * Checks the for the db folder and creates a new folder if it doesn't exist
   * @method checkPath
   * @param {Function} done
   * @private
   */
  function checkPath(done) {
    fs.exists(self.settings.path, function (exists) {
      if (exists) {
        done();
      } else {
        fs.mkdir(self.settings.path, done);
      }
    });
  }

  function setup(done) {
    var path = self.settings.path,
      stateDB = levelup(path + 'state'),
      blockDB = levelup(path + 'block'),
      detailsDB = levelup(path + 'details');

    self.blockchain = new Ethereum.Blockchain(blockDB, detailsDB);
    self.vm = new Ethereum.VM(stateDB);
    self.network = new Ethereum.Network({
      version: self.settings.version
    });

    self.network.on('message.hello', function (hello, peer) {
      self._sync(peer);
    });

    self.network.on('message.blocks', function (blocks) {
      self._onBlock(blocks, self.blockchain.head);
    });

    self.blockchain.init(done);
  }

  //generates the genesis hash if needed
  function genesis(done){
    if (!self.blockchain.head) {

      //generate new genesis block
      self.vm.generateGenesis(function () {
        var block = new Ethereum.Block();
        block.header.stateRoot = self.vm.trie.root;
        self.blockchain.addBlock(block, done);
      });
    } else {
      done();
    }
  }

  //run everything
  async.series([
    checkPath,
    setup,
    genesis
  ], function () {
    self.network.listen(self.settings.port, self.settings.host);
    if (cb) cb();
  });
};

App.prototype.stop = function (cb) {};

/**
 * Gets and serializes the entire block chain
 * @method getBlockChain
 * @param {Function} cb the callback is give an `Array` if blocks repsenting the
 * blockchain
 */
App.prototype.getBlockChain = function (cb) {
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
