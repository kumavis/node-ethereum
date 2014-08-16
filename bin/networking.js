var async = require('async'),
    Ethereum = require('../'),
    genesis = require('./genesis'),
    Semaphore = require('semaphore'),
    bignum = require('bignum');

var internals = {},
    Network = Ethereum.Network,
    Utils = Ethereum.Utils,
    sem = Semaphore(1);

exports.init = function (blockchain, vm) {
    console.log('starting networking');
    internals.network = new Network({
        version: 25
    });
    internals.blockchain = blockchain;
    vm.onStep = function (info, done) {
        // if (info.opcode === 'SSTORE') {
        //     console.log("[vm] " + bignum(info.pc).toString(16) + " Opcode: " + info.opcode + " Gas: " + info.gasLeft.toString());

        //     // info.stack.reverse();
        //     info.stack.forEach(function (item) {
        //         console.log("[vm]    " + item.toString('hex'));
        //     });
        // }

        done();
    };

    vm.onTx = function (tx, done) {
        console.log("[vm] Transaction " + tx.nonce.toString('hex'));
        if (tx.nonce.toString('hex') === '0c') {
            0;
        }
        done();
    };

    internals.vm = vm;

    internals.network.on('connecting', function (socket, port, host) {
        console.log('[networking]' + host + ':' + port + ' connecting');
    });

    internals.network.on('closing', function (peer) {
        console.log('[networking]' + peer.internalId + ' closing');
    });

    internals.network.on('message.hello', function (hello, peer) {
        console.log('[networking] ' + hello.ip + ':' + hello.port + ' hello');
        console.log(hello);
        internals.sync(peer, blockchain.head.hash(), function (err) {
            console.log('done syncing');
        });

    });

    internals.network.on('message.transactions', function (transactions, peer) {
        console.log(Utils.BAToJSON(transactions[0].raw));
        console.log('[networking]' + peer.internalId + ' got transactions');
        //TODO: check if transaction is in the DB
        //check if the transaction is valid
        //push tx to txlist
        //save in db
    });

    internals.network.on('message.peers', function (peers, peer) {
        console.log(peers);
        console.log('[networking]' + peer.internalId + ' got peers');
    });

    internals.network.on('message.getPeers', function (peers, peer) {
        console.log('[networking]' + peer.internalId + ' got get peers');
    });

    internals.network.on('message.blocks', function (blocks, peer) {
        console.log('[networking]' + peer.internalId + ' got blocks');
        internals.onBlock(blocks);
    });

    internals.network.on('message.getChain', function (message, peer) {
        //console.log(message);
        console.log('[networking]' + peer.internalId + ' got get chain');
    });

    internals.network.on('message.notInChain', function (message, peer) {
        console.log('[networking]' + peer.internalId + ' got not in chain');
    });

    internals.network.on('message.getTransactions', function (message, peer) {
        //console.log(Utils.bufferToJSON(message.raw));
        console.log('[networking]' + peer.internalId + ' got request for transactions');
    });

    internals.network.on('message.disconnect', function (message, peer) {
        console.log('[networking]' + peer.internalId + ' got disconnected:' + message.reason);
    });

    internals.network.on('socket.error', function (e) {
        console.log('[networking] socket error: ' + e);
    });

    internals.network.on('parsing.error', function (e) {
        console.log('[networking] parse error: ' + e);
    });

    internals.network.listen(30303, '0.0.0.0');
    //internals.network.connect(30303, '54.204.10.41');

};

/**
 * Syncs blockchain with a peer
 * @method sync
 * @param {Object} peer
 * @param {String} startHash - the block hash to start the sync from
 * @param {Interger} count - the number of blocks to fetch per request
 * @param {Function} cb - the callback
 */
internals.sync = function (peer, startHash, cb) {
    var more = true,
        count = 30; //how many blocks to get.

    //get the first five hashes
    internals.blockchain.getBlockHashes(startHash, -5, function (err, hashes) {

        //include the starting hash
        hashes.unshift(startHash);
        async.whilst(function () {
            return more;
        }, function (cb2) {
            var onMessage = function (msgType, data) {
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
                        if (internals.blockchain.genesisHash.toString('hex') === hashes[0]) {
                            //wrong genesis block
                            peer.sendDisconnect(0x06, cb2);
                        } else {
                            //keep trying to synce. Start with the oldest hash
                            internals.sync(peer, hashes.pop(), cb2);
                        }
                    });
                }
            };

            if (err) {
                cb2(err);
            } else {
                peer.on('message', onMessage);
                peer.sendGetChain(hashes, count);
            }
        }, cb);
    });
};

/**
 * process a block and adds to the blockchain
 * @method onBlock
 */
internals.onBlock = function (blocks) {
    blocks.reverse();
    sem.take(function () {
        async.eachSeries(blocks, function (block, cb) {
            //TODO: get the parent block root state if parent is not head
            //validate block here -->
            //proccess the block and  update the world state
            console.log('adding block: ' + block.hash().toString('hex'));
            console.log('height: ' + block.header.number.toString('hex'));
            console.log('State Root: ' + block.header.stateRoot.toString('hex'));
            var parentBlock = internals.blockchain.head,
                ppBlock = internals.blockchain.parentHead;

            async.series([
                async.apply(block.genTxTrie.bind(block)),
                function (cb2) {
                    if (parentBlock.hash().toString('hex') !== block.header.parentHash.toString('hex')) {
                        ppBlock = false;
                        internals.blockchain.getBlock(block.header.parentHash, function (err, foundParentBlock) {
                            parentBlock = foundParentBlock;
                            if (!parentBlock) {
                                cb2('parentBlock not found');
                            } else {
                                cb2(err);
                            }
                        });
                    } else {
                        cb2();
                    }
                },
                function (cb2) {
                    if (!ppBlock && block.header.number.toString('hex') !== '01') {
                        internals.blockchain.getBlock(parentBlock.header.parentHash, function (err, foundPPBlock) {
                            ppBlock = foundPPBlock;
                            if (!parentBlock) {
                                cb2('parentBlock not found');
                            } else {
                                cb2(err);
                            }
                        });
                    } else {
                        cb2();
                    }
                },
                function (cb2) {
                    if (block.validate(parentBlock, ppBlock)) {
                        internals.vm.runBlock(block, parentBlock.header.stateRoot, cb2);
                    } else {
                        cb2('invalid block');
                    }
                },
                async.apply(internals.blockchain.addBlock.bind(internals.blockchain), block)
            ], function (err) {
                if (err) {
                    console.log('error processing block: ' + err);
                    console.log('height: ' + block.header.number.toString('hex'));
                    console.error({
                        preState: internals.blockchain.head.header.stateRoot.toString('hex')
                    });
                    process.exit(1);
                }
                cb(err);
            });
        }, function () {
            sem.leave();
        });
    });
};
