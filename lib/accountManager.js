var crypto = require('crypto'),
  secp256k1 = require('secp256k1'),
  Ethereum = require('ethereumjs-lib'),
  async = require('async');

ENCRYPT_ALGO = 'aes-256-ctr';

/**
 * @constructor
 */
var AccountMan = module.exports = function (db) {
console.log('@@@@@ aman ctr')

  this.db = db;
};

// TODO remove hardcoding
AccountMan.TESTACCTNAME = module.exports.TESTACCTNAME = 'testacctname';
AccountMan.TESTACCTPASSWORD = module.exports.TESTACCTPASSWORD = 'testacctpassword';


/**
 * initializes the accounts by loading an array of all the know accounts
 */
AccountMan.prototype.init = function (cb) {
  var self = this;

  self.loadAccounts(function(err) {
    if (err) {
      self.accounts = [];
      self.create(AccountMan.TESTACCTNAME, AccountMan.TESTACCTPASSWORD, cb);
      return;
    }
  });
}

AccountMan.prototype.loadAccounts = function (cb) {
console.log('@@@@@ aman loadAccounts')
  var self = this;

  this.db.get('accounts', function (err, accounts) {
console.log('@@@@@ aman loadAccounts err: ', err, 'accounts: ', accounts)

    if (err) {
      cb(err);
      return;
    }

    self.accounts = accounts ? accounts : [];
    cb();
  });
};

AccountMan.prototype.unlockPrivateKey = function (name, password, cb) {
  this.db.get(name, function (err, epk) {

    if (err) throw err;

    var cipher = crypto.createDecipher(ENCRYPT_ALGO, password),
      dec = Buffer.concat([cipher.update(epk), cipher.final()]);
    cb(null, dec);
  });
};

AccountMan.prototype.publicKey = function(cb) {
  this.unlockPrivateKey(AccountMan.TESTACCTNAME, AccountMan.TESTACCTPASSWORD, function(err, privKey) {
    if (err) {
      throw err;
    }
    var bufPk = new Buffer(privKey, 'binary');
    var pubKey = secp256k1.createPublicKey(bufPk, true);  // compressed pub key
console.log('@@@ pubKey: ', pubKey)
    cb(null, pubKey);
  });
}

AccountMan.prototype.create = function (name, password, cb) {

  var self = this,
    pk;

  function genKey(cb) {
    crypto.randomBytes(32, function (ex, buf) {
      pk = buf;
      cb(ex);
    });
  }

  function saveAccounts(cb) {
    self.accounts.push(name);
    self.accounts.sort();
    self.db.put('accounts', self.accounts, cb);
  }

  function savePk(cb) {
    var cipher = crypto.createCipher(ENCRYPT_ALGO, password),
      crypted = Buffer.concat([cipher.update(pk), cipher.final()])
    self.db.put(name, crypted, cb);
  }

  async.series([
    genKey,
    saveAccounts,
    savePk
  ], function (err) {
    cb(err, pk);
  });
};

AccountMan.prototype.coinbase = function(cb) {
  var self = this;
  self.publicKey(function(err, pubKey) {
    if (err) {
      throw err;
    }

    var address = Ethereum.utils.pubToAddress(pubKey).toString('hex');
console.log('@@@ coinbase addr: ', address)
    cb(null, address);
  });
}
