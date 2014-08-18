var async = require('async'),
  Semaphore = require('semaphore');

//only sync one with one peer at a time
var sem = Semaphore(1);

module.exports = function (peer, cb) {

  var self = this;

  sem.take(function () {
    sync(peer, self.blockchain.head.hash, function () {
      sem.leave();
      if (cb) cb();
    });
  });
};

/**
 * Syncs blockchain with a peer
 * @method sync
 * @param {Object} peer
 * @param {String} startHash - the block hash to start the sync from
 * @param {Function} cb - the callback
 */
function sync(peer, startHash, cb) {
  var more = true,
    self = this,
    count = 100; //how many blocks to get per requst.

  //get the first five hashes
  self.blockchain.getBlockHashes(startHash, -5, function (err, hashes) {

    //include the starting hash
    hashes.unshift(startHash);
    async.whilst(function () {
      return more;
    }, function (cb2) {

      function onMessage(msgType, data) {
        if (msgType === 'blocks' || msgType === 'notInChain') {
          peer.removeListener('message', onMessage);
        }

        if (msgType === 'blocks') {
          if (data.length !== count) {
            more = false;
          } else {
            hashes = [data[data.length - 1].hash()];
          }

          cb2();
        } else if (msgType === 'notInChain') {
          //fetch the last 
          peer.once('message.notInChain', function () {
            if (self.blockchain.genesisHash.toString('hex') === hashes[0]) {
              //wrong genesis block
              peer.sendDisconnect(0x06, cb2);
            } else {
              //keep trying to synce. Start with the oldest hash
              self.sync(peer, hashes.pop(), cb2);
            }
          });
        }
      }

      if (err) {
        cb2(err);
      } else {
        peer.on('message', onMessage);
        peer.sendGetChain(hashes, count);
      }
    }, cb);
  });
}
