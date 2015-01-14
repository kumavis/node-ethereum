var EthRPC = module.exports = function(app) {
  this.app = app;
};

//Returns the balance of the account of address given by the address
EthRPC.prototype.getBalanceAt = function(address) {
  getAccountInfo(address, self.vm.trie, self.blockchain, 'balance', cb);
};

//Returns the value in storage at position given by the number _x of the account of address given by the address _a.
EthRPC.prototype.getStateAt = function(address, key, cb) {
  var state = self.vm.trie,
    tmpBlockchain = self.blockchain;
  address = new Buffer(address, 'hex');
  at = new Buffer(at, 'hex');

  // ****************************************************
  // TODO hack needs to be removed (hack needed for now since processBlocks.js is affecting the root)
  // ****************************************************
  state.root = tmpBlockchain.head.header.stateRoot;

  state.get(address, function(err, raw) {
    if (err) {
      cb(err);
      return;
    }
    var account = new Account(raw),
      origRoot;

    //TODO create new state instead of settings roots
    origRoot = state.root;
    state.root = account.stateRoot;
    state.get(at, function(err, val) {
      if (err) {
        cb(err);
        return;
      }

      state.root = origRoot;
      cb(err, val);
    });
  });
};

//Returns the number of transactions send from the account of address given by _a.
EthRPC.prototype.getCountAt = function(address) {
  getAccountInfo(address, self.vm.trie, self.blockchain, 'nonce', cb);
};

//Returns true if the account of address given by _a is a contract-account.
EthRPC.prototype.getCodeAt = function(address) {
  getAccountInfo(address, self.vm.trie, self.blockchain, 'code', cb);
};

//Returns an anonymous object describing the block with hash _hash, passed as a string.
//or Returns an anonymous object describing the block with number _number, passed as an integer.
EthRPC.prototype.getBlock = function(hash) {

};

EthRPC.prototype.getBlockByHash = function() {
  var hash = new Buffer(hash, 'hex');
  self.app.blockchain.getBlock(hash, done);
};

EthRPC.prototype.transact = function() {
  var tx = new Transaction([
    bignum(obj.nonce).toBuffer(),
    bignum(obj.gasPrice).toBuffer(),
    bignum(obj.gasLimit).toBuffer(),
    new Buffer(obj.to, 'hex'),
    bignum(obj.value).toBuffer(),
    new Buffer(obj.data, 'hex')
  ]);

  self.accountMan.sign(tx, function(err, signedTx) {
    if (err) {
      cb(err);
      return;
    }
    self.vm.runTx(signedTx, self.blockchain.head, cb);
  });
};

EthRPC.prototype.transactByHash = function(argument) {
  var hash = new Buffer(hash, 'hex');
  self.app.blockchain.getBlock(hash, function(err, block) {
    if (err) {
      done(err);
      return;
    }
    done(null, block.transactions[number]);
  });
};

EthRPC.prototype.uncleByHash = function(hash, number, done) {
  hash = new Buffer(hash, 'hex');
  self.blockchain.getBlock(hash, function(err, block) {
    if (err) {
      done(err);
      return;
    }
    done(null, block.uncleHeaders[number]);
  });
};

EthRPC.prototype.call = function() {

};

EthRPC.prototype.getPeers = function() {

};

function getAccountInfo(address, state, tmpBlockchain, property, cb) {
  address = new Buffer(address, 'hex');

  // ****************************************************
  // TODO hack needs to be removed (hack needed for now since processBlocks.js is affecting the root)
  // ****************************************************
  state.root = tmpBlockchain.head.header.stateRoot;

  state.get(address, function(err, raw) {
    if (err) {
      cb(err);
      return;
    }
    var account = new Account(raw);

    if (property === 'code') {
      account.getCode(state, function(err, code) {
        if (err) {
          cb(err);
          return;
        }
        cb(null, code.toString('hex'));
      });
      return;
    }

    cb(null, bignum.fromBuffer(account[property]).toString());
  });
}
