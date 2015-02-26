var App = require('../'),
  assert = require('assert'),
  Ws = require('ws'),
  Block = require('ethereumjs-lib').Block,
  jsonBC = require('ethereum-tests').blockchainTests.basicBlockChain.blockchain,
  allotment = require('ethereum-tests').blockchainTests.basicBlockChain.allotment;

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

describe('basic app functions', function() {

  it('should start', function(done) {
    app = new App(settings);
    app.start(done);
  });

  it('should generate genesis', function(done) {
    app.vm.generateGenesis(allotment, function(){
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

    app.processBlocks(blocks, done);
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

  // it('should make a call', function(done) {
  //   var cmd = {
  //     'method': 'eth_balanceAt',
  //     'params': ['8888f1f195afa192cfee860698584c030f4c9db1', 'da0bc84f4881690dcfbd8cfe5201ae729698e318397ab71df29fb0c42064fd04'],
  //     'jsonrpc': '2.0',
  //     'id': 2
  //   };
  //   ws.send(JSON.stringify(cmd));
  //   ws.once('message', function(msg) {
  //     msg = JSON.parse(msg);
  //     assert.equal(msg.id, 2);
  //     assert.equal(msg.result, '059fd3ff87f1676000');
  //     done();
  //   });
  // });

  it('should stop', function(done) {
    app.stop(done);
  });

});
