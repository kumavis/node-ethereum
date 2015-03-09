const App = require('../');
const assert = require('assert');
const Ws = require('ws');
const Block = require('ethereumjs-lib').Block;
const Account = require('ethereumjs-lib').Account;
const Tx = require('ethereumjs-lib').Transaction;
var jsonBC = require('ethereum-tests').blockchainTests.basicBlockChain.blockchain;
var t = require('ethereum-tests').blockchainTests.basicBlockChain;
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
var filterID;
var accountAddress;

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

  it('it check if it is listening', function(done) {
    var cmd = {
      'method': 'eth_listening',
      'params': [],
      'jsonrpc': '2.0',
      'id': 20
    };
    ws.send(JSON.stringify(cmd));
    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      assert.equal(msg.id, 20);
      assert.equal(msg.result, false);
      done();
    });
  });

  it('balanceAt', function(done) {
    var cmd = {
      'method': 'eth_balanceAt',
      'params': ['cd2a3d9f938e13cd947ec05abc7fe734df8dd826'],
      'jsonrpc': '2.0',
      'id': 1
    };
    ws.send(JSON.stringify(cmd));
    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      assert.equal(msg.id, 1);
      assert.equal(msg.result, '0x0100000000000000000000000000000000000000000000000000');
      done();
    });
  });

  it('balanceAt a given block', function(done) {
    var cmd = {
      'method': 'eth_balanceAt',
      'params': ['ca88d8a06020473dd34be02d62688c7e891133c0', '25dde3cae308f67e1dd50d69d41887a8f4879c01a940a3379985e40269b0418b'],
      'jsonrpc': '2.0',
      'id': 2
    };
    ws.send(JSON.stringify(cmd));
    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      assert.equal(msg.id, 2);
      assert.equal(msg.result, '0x53444835ec580000');
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
      'params': [{
        to: mulAddress.toString('hex'),
        data: data
      }],
      'jsonrpc': '2.0',
      'id': 2
    };

    ws.send(JSON.stringify(cmd));
    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      assert(msg.result === '0x0000000000000000000000000000000000000000000000000000000000090000');
      done();
    });
  });

  it('should make a call to an non-existant contract', function(done) {
    var data = '00000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000003';
    var cmd = {
      'method': 'eth_call',
      'params': [{
        to: '0999'
      }],
      'jsonrpc': '2.0',
      'id': 2
    };

    ws.send(JSON.stringify(cmd));
    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      assert(msg.result === null);
      done();
    });
  });


  it('should subcribe to a topic', function(done){
    cmd = {
      'method': 'eth_newFilter',
      'params': [{"topic":[ethUtil.pad(address, 32).toString('hex')]}],
      'jsonrpc': '2.0',
      'id': 3
    }
    ws.send(JSON.stringify(cmd));
    ws.once('message', function(msg){
      filterID = JSON.parse(msg).result;
      // assert(filterID !== null);
      done();
    });
  });

  it('send a tx that causes a log', function(done) {

    accountAddress = ethUtil.pubToAddress(crypto.randomBytes(32));

    function populateTrie(cb) {
      var account = new Account();
      var code = new Buffer('60ff6000533360206000a1', 'hex'); //some code that does some LOGs
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
      assert.equal(msg.result.length, 1);
      assert.equal(msg.result[0].number, filterID, 'should return correct filter id');
      assert.equal(msg.result[0].address, accountAddress.toString('hex'), 'should log correct address');
      var data = 'ff00000000000000000000000000000000000000000000000000000000000000';
      assert.equal(msg.result[0].data, data, 'should log correct data');
      done();
    });

  });

  it('eth_codeAt', function(done){
  
    var cmd = {
      'method': 'eth_codeAt',
      'params': [accountAddress.toString('hex')],
      'jsonrpc': '2.0',
      'id': 11
    };

    ws.send(JSON.stringify(cmd));

    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      assert.equal(msg.result, '0x60ff6000533360206000a1', 'should have correct code');
      done();
    });

  });

  it('eth_blockByNumber', function(done){
  
    var cmd = {
      'method': 'eth_blockByNumber',
      'params': [2],
      'jsonrpc': '2.0',
      'id': 11
    };

    ws.send(JSON.stringify(cmd));

    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      assert.equal(msg.result.header.parentHash, '516dccada94c7dd9936747c6819be3d28f9e91a46f18aada525d036ef09867be');
      done();
    });
  });

  it('eth_number', function(done){
  
    var cmd = {
      'method': 'eth_number',
      'jsonrpc': '2.0',
      'id': 11
    };

    ws.send(JSON.stringify(cmd));

    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      //todo figure out why its not reading from the testDB
      console.log(msg);
      done();
    });
  });


  it('should stop', function(done) {
    app.stop(done);
  });

});
