#!/usr/bin/env node

var Ethereum = require('../'),
    genesis = require('./genesis'),
    networking = require('./networking'),
    levelup = require('levelup'),
    async = require('async');

var internals = {},
    Blockchain = Ethereum.Blockchain,
    VM = Ethereum.VM,
    Utils = Ethereum.Utils,
    stateDB = levelup('./db/state'),
    blockDB = levelup('./db/block'),
    detailsDB = levelup('./db/details');

var argv = require('minimist')(process.argv.slice(2));
if (argv.help) {
    console.log('TODO: write help');
} else {
    internals.blockchain = new Blockchain(blockDB, detailsDB);
    internals.vm = new VM(stateDB);

    internals.blockchain.init(function () {
        if (!internals.blockchain.head) {
            console.log('generating genesis block');
            genesis.init(stateDB, internals.blockchain);
        }else{
            console.log("current state is:" + internals.blockchain.head.header.stateRoot.toString('hex'));
        }
        if (!argv.dumpbc) {
            networking.init(internals.blockchain, internals.vm);
        } else {
            var hash = internals.blockchain.meta.genesis,
                height = internals.blockchain.meta.height;

            internals.blockchain.getBlockChain([hash], height, function (err, results) {
                //add the genesis block to the end of the results
                internals.blockchain.getBlock(hash, function (err, genesis) {
                    results.push(genesis);
                    results = results.map(function (b) {
                        return b.serialize(false);
                    });
                    console.log(JSON.stringify( Utils.bufferToJSON(results)));
                });
            });
        }
    });
}
