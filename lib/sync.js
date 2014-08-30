var async = require('async'),
  bignum = require('bignum'),
  processBlocks = require('./onBlock');

var hashes = [],
  largestTD = bignum(0),
  stopSyncing;

//get largest td that we have found
var sync = module.exports = function (peer, cb) {
  var td = bignum.fromBuffer(peer.td);

  if (largestTD.lt(this.blockchain.td)) {
    largestTD = this.blockchain.td;
  }

  if (largestTD.lt(td)) {
    var startHash;

    if (stopSyncing) {
      stopSyncing();
    }

    if (hashes) {
      startHash = hashes[hashes.length - 1];
    } else {
      startHash = this.blockchain.head.hash();
    }

    stopSyncing = syncHashes(peer, startHash, cb);
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
    count = 100, //how many blocks to get per requst.
    asyncCb,
    self = this;

  function onMessage(msgType, hs) {
    startHash = hs[0];
    addHahes.bind(self)(hs, peer);

    if (hs.length !== count) {
      more = false;
      peer.removeListener('message.blockHashes', onMessage);
    }

    asyncCb();
  }

  async.whilst(function () {
    return more;
  }, function (cb2) {
    asyncCb = cb2;
    peer.sendGetBlockHashes(startHash, count);
  }, cb);

  peer.on('message.blockHashes', onMessage);

  return function () {
    more = false;
    peer.removeListener('message.blockHashes', onMessage);
  };
}

function addHashes(hs, peer) {
  hs.forEach(function (hash) {
    hashes.push([hash, false]);
  });

  syncBlocks(peer);
}

var fetchedHashes = [];

function syncBlocks(sourcePeer) {
  //block to fetch per request
  var num = 20;


  var done = false;
  var self = this;
  var peers = this.networking.getPeers();

  async.whilst(function () {
    return !done;
  }, function () {

    //get blocks from all connected peers
    peers.forEach(function (peer) {

      var source = false,
        hashesToGet = [],
        i = 0;

      if (peer.id === sourcePeer.id) {
        source = true;
      }

      //get some hash of blocks we need
      while (hashesToGet.length !== num && hashes[i]) {
        //if not syncing
        if (!hashes[i][1]) {
          //mark syncing true
          hashes[i][1] = true;
          hashesToGet.push(hashes[i][0]);
        }
      }

      peer.getBlocks(hashesToGet, function (err, blocks) {
        if (err && source) {
          restartSync.bind(self)();
          return;
        }

        //get the blocks to process
        var blocksToProcess = [];
        var q = 0;
        while (blocks[q]) {
          if (blocks[q].hash().toString('hex') === hashes[q][0].toString('hex')) {
            if (!i) {
              blocksToProcess.push(blocks[i]);
              blocks.shift();
              hashes.shift();
            } else {
              //save the block to be processed later
              hashes[q].push(blocks[q]);
            }
          }
        }

        //add blocks that were saved tobe processed later if any
        while (hashes[0].length === 3) {
          blocksToProcess.push(hashes[0]);
          hashes.shift();
        }

        processBlocks(blocksToProcess, function (err) {
          if (err && source) {
            restartSync.bind(self)();
            peer.sendDisconnect();
          }
        });

      });

    });

  });
}

function restartSync() {
  hashes = [];
  largestTD = bignum(0);
  var peers = this.network;
  peers.sort(function (a, b) {
    return a.td < b.td;
  });

  sync(peers[0]);
}
