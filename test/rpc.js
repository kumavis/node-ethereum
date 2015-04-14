const App = require('../');
const assert = require('assert');
const Ws = require('ws');
const Block = require('ethereumjs-lib').Block;
const Account = require('ethereumjs-lib').Account;
const Tx = require('ethereumjs-lib').Transaction;
var jsonBC = require('ethereum-tests').blockchainTests.basicBlockChain.blockchain;
var t = require('ethereum-tests').blockchainTests.basicBlockChain;

const crypto = require('crypto');
const ethUtil = require('ethereumjs-util');
const ecdsa = require('secp256k1');


const allotment = {
  "a06ef3ed1ce41ade87f764de6ce8095c569d6d57": "1606938044258990275541962092341162602522202993782792835301376",
  "e4157b34ea9615cfbde6b4fda419828124b70c78": "1606938044258990275541962092341162602522202993782792835301376",
  "b9c015918bdaba24b4ff057a92a3873d6eb201be": "1606938044258990275541962092341162602522202993782792835301376",
  "6c386a4b26f73c802f34673f7248bb118f97424a": "1606938044258990275541962092341162602522202993782792835301376",
  "cd2a3d9f938e13cd947ec05abc7fe734df8dd826": "1606938044258990275541962092341162602522202993782792835301376",
  "2ef47100e0787b915105fd5e3f4ff6752079d5cb": "1606938044258990275541962092341162602522202993782792835301376",
  "e6716f9544a56c530d868e4bfbacb172315bdead": "1606938044258990275541962092341162602522202993782792835301376",
  "1a26338f0d905e295fccb71fa9ea849ffa12aaf4": "1606938044258990275541962092341162602522202993782792835301376",
  "b0afc46d9ce366d06ab4952ca27db1d9557ae9fd": "154162184000000000000000",
  "f6b1e9dc460d4d62cc22ec5f987d726929c0f9f0": "102774789000000000000000",
  "cc45122d8b7fa0b1eaa6b29e0fb561422a9239d0": "51387394000000000000000",
  "b7576e9d314df41ec5506494293afb1bd5d3f65d": "69423399000000000000000"
}
 
var settings = {
  'network': false,
  'path': './db/',
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
    // app.vm.db = db;
    app.vm.on('afterTx', function(){
      var root = app.vm.trie.root
      var block = new Block()
      block.header.stateRoot = root
      block.header.parentHash = app.blockchain.head.hash()
      app.blockchain.addBlock(block, function(){
        console.log('added block to blockchain')
      })
    })

    app.vm.generateGenesis(allotment, function() {
      var block = new Block();
      block.header.stateRoot = app.vm.trie.root;
      done();
    });

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
      'method': 'net_listening',
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

  it('getBalance', function(done) {
    var cmd = {
      'method': 'eth_getBalance',
      'params': ['e6716f9544a56c530d868e4bfbacb172315bdead'],
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

  it('shoud send a transation', function(done) {

    privateKey = crypto.randomBytes(32);
    address = ethUtil.pubToAddress(ecdsa.createPublicKey(privateKey));
    var mulContract = '602b80600b60003960365660003560001a60008114156029576001356040526021356060526060516040510260805260206080f35b505b6000f3';
    mulAddress = ethUtil.generateAddress(address, new Buffer([1]));

    function populateTrie(cb) {
      var account = new Account();
      account.balance = '0xffffffffffffffffff';
      app.vm.trie.put(address, account.serialize(), cb);
    }

    function sendTx() {
      var tx = new Tx({
        data: mulContract,
        gasLimit: 50000000,
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
      assert(msg.result === '0x' + mulAddress.toString('hex'))
      //check something?
      done();
    });
  });

  it('should make a call', function(done) {
    var data = '00000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000003';
    var cmd = {
      'method': 'eth_call',
      'params': [{
        from: '0xcd2a3d9f938e13cd947ec05abc7fe734df8dd826',
        to: mulAddress.toString('hex'),
        data: data,
        gas: 99999999999,
        gasPrice: 1
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
        gas: 500000,
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


  it.skip('should return logs after being pulled', function(done){
    var cmd = {
      'method': 'eth_getFilterChanges',
      'jsonrpc': '2.0',
      'params': [filterID],
      'id': 5
    };

    ws.send(JSON.stringify(cmd));

    ws.once('message', function(msg) {
      msg = JSON.parse(msg);
      console.log(msg);
      assert.equal(msg.result.length, 1);
      assert.equal(msg.result[0].number, filterID, 'should return correct filter id');
      assert.equal(msg.result[0].address, accountAddress.toString('hex'), 'should log correct address');
      var data = 'ff00000000000000000000000000000000000000000000000000000000000000';
      assert.equal(msg.result[0].data, data, 'should log correct data');
      done();
    });

  });

  it('eth_getCode', function(done){
  
    var cmd = {
      'method': 'eth_getCode',
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

  //we need blocks in chain to test
  it.skip('eth_blockByNumber', function(done){
  
    var cmd = {
      'method': 'eth_getBlockByNumber',
      'params': [2],
      'jsonrpc': '2.0',
      'id': 11
    };

    ws.send(JSON.stringify(cmd));

    ws.once('message', function(msg) {
      console.log(msg);
      msg = JSON.parse(msg);
      // assert.equal(msg.result.header.parentHash, '516dccada94c7dd9936747c6819be3d28f9e91a46f18aada525d036ef09867be');
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
      assert(msg.result === 0)
      done();
    });
  });

  it('should stop', function(done) {
    app.stop(done);
  });

});
