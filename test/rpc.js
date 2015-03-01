const App = require('../');
const assert = require('assert');
const Ws = require('ws');
const Block = require('ethereumjs-lib').Block;
const Account = require('ethereumjs-lib').Account;
const Tx = require('ethereumjs-lib').Transaction;
var jsonBC = require('ethereum-tests').blockchainTests.basicBlockChain.blockchain;
const allotment = require('ethereum-tests').blockchainTests.basicBlockChain.allotment;
const crypto = require('crypto');
const ethUtil = require('ethereumjs-util');
const ecdsa = require('secp256k1');

var app;
var settings = {
  'network': false,
  'db': {
    'port': 30304
  },
  'dbServer': true,
  'webui': false,
  'upnp': false,
  'rpc': true,
  'ws': {
    'port': 40401
  }
};

var ws;
var mulAddress;
var privateKey;
var address;

describe('basic app functions', function() {

  it('should start', function(done) {
    app = new App(settings);
    app.start(done);
  });

  it('should generate genesis', function(done) {
    app.vm.generateGenesis(allotment, function() {
      var block = new Block();
      block.header.stateRoot = app.vm.trie.root;
      app.blockchain.addBlock(block, done);
    });
  });

  it('should load the blockchain', function(done) {
    var blocks = [];
    jsonBC.reverse();
    //lets only process 4 blocks
    jsonBC = jsonBC.slice(0, 4);
    jsonBC.forEach(function(json) {
      blocks.push(new Block(json));
    });

    app.blockProcesser.run(blocks, done);
  });

  it('should connect to the ws rpc', function(done) {
    ws = new Ws('ws://localhost:' + settings.ws.port);
    ws.on('open', function open() {
      done();
    });
  });

  it('it should get the peer count', function(done) {
    var cmd = {
      'method': 'eth_peerCount',
      'params': [],
      'jsonrpc': '2.0',
      'id': 0
    };
    ws.send(JSON.stringify(cmd));
    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      assert.equal(msg.id, 0);
      assert.equal(msg.result, 0);
      done();
    });
  });

  it('balanceAt', function(done) {
    var cmd = {
      'method': 'eth_balanceAt',
      'params': ['0f3388f4f086ca1666919a3e104d4335b915928e'],
      'jsonrpc': '2.0',
      'id': 1
    };
    ws.send(JSON.stringify(cmd));
    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      assert.equal(msg.id, 1);
      assert.equal(msg.result, '0de0b6b3a7640000');
      done();
    });
  });

  it('balanceAt a given block', function(done) {
    var cmd = {
      'method': 'eth_balanceAt',
      'params': ['8888f1f195afa192cfee860698584c030f4c9db1', 'da0bc84f4881690dcfbd8cfe5201ae729698e318397ab71df29fb0c42064fd04'],
      'jsonrpc': '2.0',
      'id': 2
    };
    ws.send(JSON.stringify(cmd));
    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      assert.equal(msg.id, 2);
      assert.equal(msg.result, '059fd3ff87f1676000');
      done();
    });
  });

  it('shoud send a transation', function(done) {

    privateKey = crypto.randomBytes(32);
    address = ethUtil.pubToAddress(ecdsa.createPublicKey(privateKey));
    var mulContract = '602b80600b60003960365660003560001a60008114156029576001356040526021356060526060516040510260805260206080f35b505b6000f3';
    mulAddress = ethUtil.generateAddress(address, new Buffer([1]));

    function populateTrie(cb) {
      var account = new Account();
      account.balance = 'ffffff';
      app.vm.trie.put(address, account.serialize(), cb);
    }

    function sendTx() {
      var tx = new Tx({
        data: mulContract,
        gasLimit: 5000,
        gasPrice: 1,
        nonce: 0
      })

      tx.sign(privateKey);

      cmd = {
        'method': 'eth_signedTransact',
        'params': [tx.serialize().toString('hex')],
        'jsonrpc': '2.0',
        'id': 2
      }
      ws.send(JSON.stringify(cmd));
    }

    populateTrie(sendTx);

    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      //check something?
      done();
    });
  });

  it('should make a call', function(done) {
    var data = '00000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000003';
    var cmd = {
      'method': 'eth_call',
      'params': {
        to: mulAddress.toString('hex'),
        data: data
      },
      'jsonrpc': '2.0',
      'id': 2
    };

    ws.send(JSON.stringify(cmd));
    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      assert(msg.result === '0000000000000000000000000000000000000000000000000000000000090000');
      done();
    });
  });


  it('should subcribe to a topic', function(done){
    cmd = {
      'method': 'eth_newFilter',
      'params': [{"topic":"12341234"}],
      'jsonrpc': '2.0',
      'id': 3
    }
    ws.send(JSON.stringify(cmd));
    ws.once('message', function(){
      done();
    });
  });

  it('send a tx that causes a log', function(done) {

    var accountAddress = ethUtil.pubToAddress(crypto.randomBytes(32));

    function populateTrie(cb) {
      var account = new Account();
      var code = '60ff60005358585860206000a3'; //some code that does some LOGs 
      account.balance = 'ffffff';
      account.storeCode(app.vm.trie, code, function() {
        app.vm.trie.put(accountAddress, account.serialize(), cb);
      });
    }

    function sendTx() {
      var tx = new Tx({
        to: accountAddress,
        gasLimit: 5000,
        gasPrice: 1,
        nonce: 1
      })

      tx.sign(privateKey);

      cmd = {
        'method': 'eth_signedTransact',
        'params': [tx.serialize().toString('hex')],
        'jsonrpc': '2.0',
        'id': 4
      }
      ws.send(JSON.stringify(cmd));
    }

    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      done();
    });

    populateTrie(sendTx);

  });

  it('should return logs after being pulled', function(done){
    var cmd = {
      'method': 'eth_changed',
      'jsonrpc': '2.0',
      'id': 5
    };

    ws.send(JSON.stringify(cmd));
 
    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      console.log(msg);
      done();
    });

  })

  it('should stop', function(done) {
    app.stop(done);
  });

});
