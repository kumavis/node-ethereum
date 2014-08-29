var async = require('async'),
  bignum = require('bignum'),
  Semaphore = require('semaphore');

var sem = Semaphore(1),
  hashes = [],
  largestTD = bignum(0),
  stopSyncing;
//get largest td that we have found

module.exports = function (peer, hello, cb) {
  if(largestTD.lt(this.blockchain.td)){
    largestTD = bignum(this.blockchain.td);
  }

  var td = bignum.fromBuffer(hello.td);
  if (td.gt(largestTD)) {
    largestTD = td;
    if(stopSyncing){
      stopSyncing();
    }

    stopSyncing = syncHashes(peer, this.blockchain.head.hash(), cb);
  }
};

/**
 * Syncs blockchain with a peer
 * @method sync
 * @param {Object} peer
 * @param {String} startHash - the block hash to start the sync from
 * @param {Function} cb - the callback
 */
function syncHashes(peer, startHash, cb) {
  var more = true,
    count = 100; //how many blocks to get per requst.

  async.whilst(function () {
    return more;
  }, function (cb2) {

    function onMessage(msgType, hs) {
      addHahes(hs);

      if (hs.length !== count) {
        more = false;
        peer.removeListener('message.blockHashes', onMessage);
      }

      cb2();
    }

    if (err) {
      cb2(err);
    } else {
      peer.on('message.blockHashes', onMessage);
      peer.sendGetBlockHashes(startHash, count);
    }
  }, cb);
  
  return function(){  
    peer.removeListener('message.blockHashes', onMessage);
    more = false;
  }
}

function addHashes(hs){
  hs.forEach(function(hash){
    hashes.push([hash, false]);
  });
}
