var Ethereum = require('ethereum-lib'),
  fs = require('fs'),
  crypto  = require('crypto'),
  levelup = require('levelup'),
  log = require('npmlog'),
  async = require('async'),
  defaults = require('./defaults.json'),
  upnp = require('./upnp.js');

/**
 * @constructor
 */
var App = module.exports = function (settings) {
  this.settings = settings = settings ? settings : {};

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
      stateDB = levelup(path + '/state'),
      blockDB = levelup(path + '/block'),
      detailsDB = self.detailsDB = levelup(path + '/details');

    self.blockchain = new Ethereum.Blockchain(blockDB, detailsDB);
    self.vm = new Ethereum.VM(stateDB);

    self.blockchain.init(done);
  }

  //generates the genesis hash if needed
  function genesis(done) {
    var head = self.blockchain.head;

    if (!head) {

      log.info('state', 'generating genesis block');
      //generate new genesis block
      self.vm.generateGenesis(function () {
        var block = new Ethereum.Block();
        block.header.stateRoot = self.vm.trie.root;
        self.blockchain.addBlock(block, done);
      });
    } else {

      log.info('state', 'starting with state root of: ' + head.header.stateRoot.toString('hex'));
      done();
    }
  }

  //get the unquie id of the client. If there isn't one then generate one
  function getId(done) {
    self.detailsDB.get('id', function (err, id) {
      if (!id) {
        var hash = crypto.createHash('sha512');
        hash.update((Math.random())
          .toString());

        id = hash.digest('hex');

        self.detailsDB.put('id', id, function (err) {
          done(err, id);
        });

      } else {
        done(err, id);
      }
    });
  }

  //run everything
  async.auto({
    checkPath: checkPath,
    setup: ['checkPath', setup],
    genesis: ['setup', genesis],
    ip: upnp.extrenalIp,
    upnp: async.apply(upnp.map, self.settings.network.port),
    id: ['setup', getId]
  }, function (err, results) {

    //get the external ip
    var exip = self.settings.network.externalIp;
    exip = exip ? exip : results.ip;

    self.network = new Ethereum.Network({
      version: self.settings.version,
      id: results.id,
      ip: exip 
    });

    self.network.on('message.hello', function (hello, peer) {
      self._sync(peer);
    });

    self.network.on('message.blocks', function (blocks) {
      self._onBlock(blocks);
    });


    self.network.listen(self.settings.network.port, self.settings.network.host);
    if (cb) cb();
  });
};

/**
 * Stops everything every
 * @method stop
 * @param {Function} cb calls this callback when everything is done
 */
App.prototype.stop = function (cb) {

  var self = this;

  async.parallel([
    upnp.unmap,
    self.network.stop.bind(self.network)
  ], cb);
};


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
