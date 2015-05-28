const Network = require('devp2p');
const Ethereum = require('ethereumjs-lib');
const log = require('npmlog');
const processTx = require('./processTxs');

var blockQueue = [],
  utils = Ethereum.utils;

module.exports = function(done, options) {
  var self = this;

  //get the external ip
  var exip = this.settings.network.externalIp || options.ip,
    port = this.settings.network.port || 30303;

  console.log(port + " " + exip);
    
  //todo restore id
  this.network = new Network({
    address: '0.0.0.0',
    port: port,
    // peerDB: peerDB,
    secretKey: new Buffer('a153387bcc66f16b6aeaed404d3c3e2ec04f3a85c6942e9de107fb8b2f71e322', 'hex'),
    capabilities: {
      eth: 60
    }
  });

  this.network.on('connect', function(peer) {
    log.info('connection');
  });

  // this.network.on('hello', function(hello, peer) {
  //   //peer.eth.status(bignum(self.blockchain.td).toBuffer(), self.blockchain.head.hash(), new Buffer(self.blockchain.meta.genesis, 'hex'));
  //   log.info('networking', 'hello from: ' + hello.clientId + ' version:' + hello.protocolVersion);
  // });

  this.network.on('eth.status', function(status, peer) {

    peer.td = status.td;
    peer.bestHash = status.bestHash;

    log.info('networking', peer.internalId + ' status');

    //try to sync the blockchain
    // self._sync.bind(self)(peer, function() {
    //   self.blockProcesser.run(blockQueue);
    //   log.info('sync', 'done syncing!');
    // });
  });

  this.network.on('eth.blocks', function(blocks, peer) {
    log.info('networking', peer.toString() + ' got ' + blocks.length + ' blocks');
  });

  this.network.on('disconnect', function(dis) {
    log.info('networking', 'dissconect: ' + dis.reason);
  });

  this.network.on('eth.transactions', function(transactions, peer) {
    log.info('networking', peer.toString() + ' got transactions');

    //check to make sure we dont alread have the tx
    transactions.forEach(function(tx) {
      var hash = tx.hash().toString('hex');
      if (tx.validate()) {

        var pos = self.pendingTxs.map(function(t) {
          return t.hash().toString('hex');
        }).indexOf(hash);

        if (!pos) {
          //save the tx
          pos = self.pendingTxs.push(tx) - 1;
          processTx.bind(self)(tx, function(p, err) {
            //if it is an invalid tx remove it from the list
            if (err) {
              log.info('tx', 'invalid state: ' + hash);
              self.orderedTxs.splice(p, p + 1);
            }
          }.bind(this, pos));
        }
      } else {
        log.info('tx', 'invalid signature or stucture' + hash);
      }
    });

    //TODO: check if transaction is in the DB
    //check if the transaction is valid
    //push tx to txlist
    //save in db
  });

  this.network.on('peers', function(peers, peer) {
    log.info('networking', peer.toString() + ' got peers');
  });

  this.network.on('getPeers', function(peers, peer) {
    //sending peers is implemented in the logic
    log.info('networking', peer.toString() + ' got get peers');
  });

  this.network.on('eth.getBlockHashes', function(message, peer) {
    log.info('networking', peer.toString() + ' got Get Block Hashes');
    self.blockchain.getBlockHashes(message.hash, utils.bufferToInt(message.maxBlocks), function(err, hashes) {
      console.log(err + hashes);
    });
  });

  this.network.on('eth.blockHashes', function(message, peer) {
    log.info('networking', peer.toString() + ' got Block Hashes');
  });

  this.network.on('eth.getBlocks', function(message, peer) {
    this.blockchain.getBlocks(message, function(blocks) {
      peer.eth.sendBlocks(blocks);
    });
    log.info('networking', peer.toString() + ' got get Blocks');
  });

  this.network.on('eth.newBlock', function(message, peer) {
    log.info('networking', peer.toString() + ' got new Block:' + message.block.hash().toString('hex'));
    if (self.isSyncing) {
      blockQueue.push(message);
    } else {
      //TODO: check td
      self.blockProcesser.run([message.block]);
    }
  });

  this.network.on('eth.getTransactions', function(message, peer) {
    log.info('networking', peer.toString() + ' got request for transactions');
    peer.eth.transactions(self.pendingTxs);
  });

  // this.network.on('closing', function(peer) {
  //   log.info('networking', peer.toString() + ' closing');
  // });

  // this.network.on('socket.error', function(e) {
  //   log.error('networking', 'socket error: ' + e);
  // });

  // this.network.on('parsing.error', function(e) {
  //   log.error('networking', 'parse error: ' + e);
  // });

  // this.network.on('ping', function(blocks, peer) {
  //   log.info('networking', peer.toString() + ' got ping');
  // });

  var dpt =this.network.dpt;

  dpt.socket.on('message', function(msg, rinfo) {
    // console.log('server got msg from ' + rinfo.address + ":" + rinfo.port);
  });

  dpt.on('ping', function(ping, peer) {
    console.log('peerId: ' + peer.id.toString('hex'));
    // console.log(ping);
    // console.log('got ping ---- ');
  });

  dpt.on('pong', function(pong, peer) {
    // console.log('got pong: ' + peer);
  });

  dpt.on('findNode', function(findNode, peer) {
    // console.log('findNode----');
    // console.log(findNode.id.toString('hex'));
  });

  dpt.on('neighbors', function(neighbors, peer) {
    // console.log('neighbors----');
    // neighbors.forEach(function(n) {
    //   console.log('adding: ' + n.id.toString('hex'));
    // });
  });

  dpt.on('error', function(){
    console.log('eeeerorrr');
  })

  this.network.listen(this.settings.network.port, this.settings.network.host, function(){

    // self.network.connect({
    //   address: '127.0.0.1',
    //   port: '30303'
    // });

    done()
  });
};
