const   fs = require('fs'),
  cp = require('child_process'),
  crypto = require('crypto'),
  net = require('net'),
  Ethereum = require('ethereumjs-lib'),
  manifest = require('./manifest.json'),
  multilevel = require('multilevel'),
  LevelWriteStream = require('level-writestream'),
  log = require('npmlog'),
  async = require('async'),
  mkdirp = require('mkdirp'),
  defaults = require('../defaults.json'),
  upnp = require('./upnp.js'),
  mining = require('./mine.js'),
  XhrRpc = require('./xhrRPC.js'),
  WsRpc = require('./wsRPC.js'),
  AccountMan = require('./accountManager');

var webui;
var dbConnection;
var dbServer;

//a no-op
function noop(done) {
  done();
}

/**
 * @constructor
 */
var App = module.exports = function(settings) {

  this.settings = settings || {};
  this.plugins = {};
  this.log = log;

  //a queue of transaction that have yet to be inculded in the blockchain
  this.pendingTxs = [];
  this.isSyncing = false;

  //set the default path for the config and database files
  defaults.path = process.env.HOME + '/.ethereum/node';

  //add the defaults
  for (var prop in defaults) {
    if (this.settings[prop] === void 0) this.settings[prop] = defaults[prop];
  }
};

//attach sync function
App.prototype._sync = require('./sync.js');

//attach mining functions
App.prototype.startMining = mining.start;
App.prototype.stopMining = mining.stop;
App.prototype.toggleMining = mining.toggle;

/**
 * Starts the client
 * @method start
 * @param {Function} cb a callback
 */
App.prototype.start = function(cb) {

  var self = this;

  /**
   * Checks the for the db folder and creates a new folder if it doesn't exist
   * @method checkPath
   * @param {Function} done
   * @private
   */
  function checkPath(done) {
    fs.exists(self.settings.path, function(exists) {
      if (exists) {
        done();
      } else {
        mkdirp(self.settings.path, done);
      }
    });
  }

  function setup(done) {
    //open DBs
    var db = multilevel.client(manifest);
    dbConnection = net.connect(self.settings.db.port);
    dbConnection.pipe(db.createRpcStream()).pipe(dbConnection);

    var stateDB = LevelWriteStream(db.sublevel('state'));
    var blockDB = db.sublevel('blocks');
    var detailsDB = self.detailsDB = db.sublevel('details');
    var peersDB = self.peersDB = db.sublevel('peers');

    //create the blockchain
    self.blockchain = new Ethereum.Blockchain(blockDB, detailsDB);
    //create a VM
    self.vm = new Ethereum.VM(stateDB);

    self.accountMan = new AccountMan(detailsDB);

    //start the blockchain. This will lookup last block on the blockchain.
    self.blockchain.init(done);
  }

  //generates the genesis hash if needed
  function genesis(done) {
    var head = self.blockchain.head;

    if (!head) {
      //generate new genesis block
      self.vm.generateGenesis(function() {
        var block = new Ethereum.Block();
        block.header.stateRoot = self.vm.trie.root;
        log.info('state', 'root: ' + self.vm.trie.root.toString('hex'));
        log.info('state', 'genesis hash:' + block.hash().toString('hex'));
        log.info('rlp', block.serialize().toString('hex'));

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
    self.detailsDB.get('id', function(err, id) {
      if (!id) {
        var hash = crypto.createHash('sha512');
        hash.update((Math.random())
          .toString());

        id = hash.digest('hex');

        self.detailsDB.put('id', id, function(err) {
          done(err, id);
        });

      } else {
        done(err, id);
      }
    });
  }

  // Load Existing Peers
  function loadPeers(done) {
    var peers = [];

    self.peersDB.createReadStream()
      .on('data', function(peer) {
        peers.push({id: peer.key, value: JSON.parse(peer.value)});
      })
      .on('error', done)
      .on('end', function() {
        done(null, peers);
      });
  }

  function connectPeers(done, results) {
    // Get Max Rep from Networking.js
    self.maxrep = self.maxrep || 3;

    results.loadPeers.forEach(function(peer) {
      self.network.connect(peer.value.ip, peer.value.port, function(err) {
        // Evaluate A Connecting Peer
        if (!err) {
          evalPeer(peer,1);
          log.info('networking','Connecting to '+ peer.value.ip+':'+ peer.value.port, 'Upvoting...');
        }
        // Evaluate A Non-Connecting Peer
        else {
          evalPeer(peer,-1);
        }
      });
    });
    done();
  }

  function evalPeer(peer, rate) {
    if(peer.value.rep <= self.maxrep || peer.value.rep >= 1){
      self.peersDB.put(peer.id, JSON.stringify({ip: peer.value.ip, port: peer.value.port, rep: rate+peer.value.rep}),
        function(err) {
          if(err)
            log.error('database', err)
        })
    }
    else {
      self.peersDB.del(peer.id,
        function(err) {
          if(err)
            log.error('database', err);
          else
            log.info('networking', 'Peer '+peer.value.port+' lost all rep, deleted...')
        });
    }
  }

  // XHR RPC Server
  function startXhrRpcServer(done) {
    self.xhrRpc = new XhrRpc({app: self});
    self.xhrRpc.start({}, done);
  }

  // WS RPC Server
  function startWsRpcServer(done) {
    self.wsRpc = new WsRpc({app: self});
    self.wsRpc.start({}, done);
  }

  var tasks = {
    checkPath: checkPath,
    startDB: noop,
    setup: ['checkPath', 'startDB', setup],
    genesis: ['setup', genesis],
    loadPeers: ['setup', loadPeers],
    ip: noop,
    upnp: noop,
    rcp: noop,
    id: ['setup', getId],
    //accountMan: ['setup', initAccountMan],
    network: ['ip', 'upnp', 'id', 'loadPeers', require('./networking.js').bind(self)],
    connectPeers: ['network', connectPeers]
  };

  if (this.settings.upnp) {
    tasks.ip = upnp.extrenalIp;
    tasks.upnp = async.apply(upnp.map, self.settings.network.port);
  }

  if (this.settings.rpc) {
    tasks.startXhrRpcServer = startXhrRpcServer;
    tasks.startWsRpcServer = startWsRpcServer;
  }

  //start the webui if enabled
  if (this.settings.webui) {
    webui = cp.fork('./bin/webui.js');
    webui.send({
      command: 'start',
      settings: this.settings.webui
    });
  }

  //start the db server
  if(this.settings.dbServer){
    tasks.startDB = function startDBserver(done){
      dbServer = cp.fork('./bin/dbServer', [ self.settings.path, self.settings.db.port], {execArgv: []} );
      dbServer.on('message', function(){
        done();
      });
    };
  }

  //run everything
  async.auto(tasks, cb);
};

/**
 * Stops everything every
 * @method stop
 * @param {Function} cb calls this callback when everything is done
 */
App.prototype.stop = function(cb) {

  var self = this,
    tasks = [
      upnp.unmap,
      self.network.stop.bind(self.network)
    ];

  dbConnection.end();

  if (this.settings.rpc) {
    tasks.push(self.wsRpc.stop.bind(self.wsRpc));
    tasks.push(self.xhrRpc.stop.bind(self.xhrRpc));
  }

  if (webui) {
    tasks.push(function(done){
      webui.send.bind(this, {command: 'stop' });
      //the only message should be done
      webui.on('message', done);
    });
  }

  if(dbServer){
    dbServer.kill();
  }

  async.parallel(tasks, cb);
};


/**
 * Gets and serializes the entire block chain
 * @method getBlockChain
 * @param {Function} cb the callback is give an `Array` if blocks repsenting the
 * blockchain
 */
App.prototype.getBlockChain = function(cb) {

  var hash = this.blockchain.meta.genesis,
    height = this.blockchain.meta.height,
    self = this;

  this.blockchain.getBlockChain([hash], height, function(err, results) {
    //add the genesis block to the end of the results
    err = null;
    self.blockchain.getBlock(hash, function(err, genesis) {
      err = null;
      results.push(genesis);

      results = results.map(function(b) {
        return b.serialize(false);
      });

      cb(results);

    });
  });
};
