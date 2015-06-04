const BN = require('bn.js');
const async = require('async');

var SyncManager = module.exports = function(app) {
  this.maxNumToDownload = 32; // the number of hashed to get per request TODO: vary on rating of peer
  this.syncingPeers = {};
  this.app = app;
  this.currentBlock = this.largestTD;
  /**
   * hash enum
   * fetching, fetched, needed
   */
  this.hashes = {};
};

/**
 * adds
 * peer.skipList // list of hashes where being fetched by someone else
 * peer.orderedHashes // list of hashes
 * peer.startBlockNumber //the blocknumber which we are starting to sync from
 */
SyncManager.prototype.sync = function(peer, cb) {
  if (!cb) cb = function() {};

  var td = new BN(peer.status.td);
  if (new BN(this.app.blockchain.td).cmp(td) === -1) {
    peer.doneSyncing = false; //is the ordered hash list full?
    peer.skipList = [peer.status.bestHash];
    peer.startBlockNumber = this.app.blockchain.meta.height;
    var bestHash = peer.status.bestHash.toString('hex');
    this.hashes[bestHash] = 'needed';
    this.hashes[this.app.blockchain.genesis] = 'have';
    this.downloadChain(peer.status.bestHash, peer, cb);
  } else {
    cb();
  }
};

SyncManager.prototype.downloadChain = function(startHash, peer, cb) {
  console.log('syncing starting with: ' + startHash.toString('hex'));
  var self = this;

  if(peer.doneSyncing || startHash.toString('hex') === this.app.blockchain.meta.genesis) {
    cb();
    return;
  }

  peer.fetchBlockHashes(startHash, this.maxNumToDownload, function(hashes) {

    console.log('got hashing: ' + hashes.length);
    //if no hashes returned then jump backwards
    self.app.blockchain.selectNeededHashes(hashes, function(err, neededHashes) {

      if (neededHashes.length < hashes.length){
        peer.doneSyncing = true;
      }

      var hashesToFetch = [];

      peer.skipList.forEach(function(h) {
        if (self.hashes[h] !== 'have') {
          hashesToFetch.push(h);
        }
      });

      peer.skipList = [];

      neededHashes.forEach(function(h) {
        h = h.toString('hex');

        if (!self.hashes[h]) {
          self.hashes[h] = 'fetching';
          hashesToFetch.push(h);
        } else if (self.hashes[h] === 'needed') {
          self.hashes[h] = 'fetching';
          hashesToFetch.push(h);
        } else if (self.hashes[h] === 'fetching') {
          //someelse is downloading this hash
          //save it a check back later
          peer.skipList.push(h);
        }
      });

      if (hashesToFetch.length) {

        hashesToFetch = hashesToFetch.map(function(h){
          return new Buffer(h, 'hex');
        });

        console.log('fetching: ');
        peer.fetchBlocks(hashesToFetch, function(blocks) {
          console.log('got blocks: ' + blocks.length);
          blocks.forEach(function(block) {
            // console.log(block.hash().toString('hex'));
            var bh = block.hash().toString('hex');
            self.hashes[bh] = 'have';
          });

          async.eachSeries(function(block, done) {
            //todo check POS
            self.app.blockchain.addBlockRaw(block, done);
          }, function() {
            self.downloadChain(hashes.pop(), peer, cb);
          });
        });
      } else {
        self.downloadChain(hashes.pop(), peer, cb);
      }
    });
  });
};
