var crypto = require('crypto'),
  async = require('async');

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

AccountMan.prototype.unlock = function (name, password, cb) {
  this.db.get(name, function (err, epk) {

    if (err) throw err;

    var cipher = crypto.createDecipher('camellia256', password);

    cipher.update(epk);
    cb(cipher.final());
  });
};


AccountMan.prototype.create = function (name, password, cb) {

  var self = this,
    pk;

  function genKey(cb) {
    crypto.randomBytes(256, function (ex, buf) {
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
    var cipher = crypto.createCipher('camellia256', password);
    self.db.put(name, cipher.final(), cb);
  }

  async.series([
    genKey,
    saveAccounts,
    savePk
  ], function (err) {
    cb(err, pk);
  });
};
