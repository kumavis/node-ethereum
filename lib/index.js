var Ethereum = require('ethereumjs-lib'),
  fs = require('fs'),
  crypto = require('crypto'),
  levelup = require('levelup'),
  log = require('npmlog'),
  async = require('async'),
  defaults = require('../defaults.json'),
  upnp = require('./upnp.js'),
  rpc = require('./rpc.js'),
  EthAPI = require('./eth.js');

/**
 * @constructor
 */
var App = module.exports = function (settings) {

  //set the default path for the config and database files
  defaults.path = process.env['HOME'] + '/.ethereum-node';

  if (!settings) {
    try {
      settings = require(defaults.path + '/settings.json');
    } catch (e) {
      log.info('app', 'problem with settings.json: ' + e.toString());
      settings = {};
    }
  }

  this.settings = settings;
  this.plugins = {};
  this.log = log;

  //the current block
  this.currentBlock = new Ethereum.Block();
  //a queue of transaction that have yet to be inculded in the blockchain
  this.pendingTxs = [];
  this.isSyncing = false;

  //add the defaults
  for (var prop in defaults) {
    if (settings[prop] === void 0) settings[prop] = defaults[prop];
  }

  //create API
  this.api = new EthAPI(this);
};

App.prototype._sync = require('./sync.js');

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
      //generate new genesis block
      self.vm.generateGenesis(function () {
        var block = new Ethereum.Block();
        block.header.stateRoot = self.vm.trie.root;
        log.info('state', 'genesis hash:' + block.hash().toString('hex'));
        self.blockchain.addBlock(block, done);
      });
    } else {
      log.info('state', 'starting with state root of: ' + head.header.stateRoot.toString('hex') +
        ' height:' + head.header.number.toString('hex'));

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

  function noop(done){done();}

  var tasks = {
    checkPath: checkPath,
    setup: ['checkPath', setup],
    genesis: ['setup', genesis],
    plugins: ['genesis', async.apply(self.loadPlugins.bind(self), self.settings.plugins)],
    rcp: async.apply(rpc.start, self),
    ip:noop,
    upnp: noop,
    id: ['setup', getId],
    network: ['ip', 'upnp', 'id', require('./networking.js').bind(self)]
  };

  if (this.settings.upnp) {
    tasks.ip = upnp.extrenalIp;
    tasks.upnp = async.apply(upnp.map, self.settings.network.port);
  }

  //run everything
  async.auto(tasks, cb);
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
    rpc.stop,
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
    height = this.blockchain.meta.height,
    self = this;

  this.blockchain.getBlockChain([hash], height, function (err, results) {
    //add the genesis block to the end of the results
    self.blockchain.getBlock(hash, function (err, genesis) {
      results.push(genesis);

      results = results.map(function (b) {
        return b.serialize(false);
      });

      cb(results);
    });
  });
};

App.prototype.loadPlugins = function (plugins, cb) {
  plugins = Array.isArray(plugins) ? plugins : [plugins];

  var self = this;

  async.each(plugins, function (p, done) {
    if (p) {
      p = p.name ? p.name : {
        name: p
      };

      var plugin = require(p.name);

      plugin(self, p, function (err, results) {
        //save the results
        self.plugins[p] = results;
        done(err);
      });
    } else {
      done();
    }
  }, cb);
};
