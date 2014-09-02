var Ethereum = require('ethereum-lib'),
  bignum = require('bignum'),
  log = require('npmlog');

module.exports = function (done, results) {
  var self = this;

  //get the external ip
  var exip = this.settings.network.externalIp;
  exip = exip ? exip : results.ip;

  this.network = new Ethereum.Network({
    version: 30,
    id: results.id,
    ip: exip
  });

  this.network.on('connect', function (peer) {
    peer.sendHello(bignum(self.blockchain.td).toBuffer(), self.blockchain.head.hash(), new Buffer(self.blockchain.meta.genesis,'hex'));
    log.info('connection');
  });

  this.network.on('message.hello', function (hello, peer) {
    log.info('networking', 'hello from: ' + hello.clientId + ' version:' + hello.protocolVersion);
    peer._sendGetTransactions();
    self._sync.bind(self)(peer);
  });

  this.network.on('message.blocks', function (blocks, peer) {
    log.info('networking', peer.internalId + ' got ' + blocks.length + ' blocks');
  });

  this.network.on('message.disconnect', function (dis) {
    log.info('networking', 'dissconect: ' + dis.reason);
  });

  this.network.on('message.transactions', function (transactions, peer) {
    log.info('networking', peer.internalId + ' got transactions');
    //TODO: check if transaction is in the DB
    //check if the transaction is valid
    //push tx to txlist
    //save in db
  });

  this.network.on('message.peers', function (peers, peer) {
    log.info('networking', peer.internalId + ' got peers');
  });

  this.network.on('message.getPeers', function (peers, peer) {
    log.info('networking', peer.internalId + ' got get peers');
  });

  this.network.on('message.getBlockHashes', function (message, peer) {
    //console.log(message);
    log.info('networking', peer.internalId + ' got Get Block Hashes');
  });

  this.network.on('message.blockHashes', function (message, peer) {
    log.info('networking', peer.internalId + ' got Block Hashes');
  });

  this.network.on('message.getBlocks', function (message, peer) {
    log.info('networking', peer.internalId + 'got get Blocks');
  });

  this.network.on('message.getTransactions', function (message, peer) {
    //console.log(Utils.bufferToJSON(message.raw));
    log.info('networking', peer.internalId + ' got request for transactions');
  });
  this.network.on('closing', function (peer) {
    log.info('networking', peer.internalId + ' closing');
  });

  this.network.on('socket.error', function (e) {
    log.error('networking', 'socket error: ' + e);
  });

  this.network.on('parsing.error', function (e) {
    log.error('networking', 'parse error: ' + e);
  });

  this.network.on('message.ping', function (blocks, peer) {
    log.info('networking', peer.internalId + ' got ping');
  });

  this.network.listen(this.settings.network.port, this.settings.network.host, done);
};
