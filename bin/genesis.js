var Ethereum = require('../'),
    Async = require('async');

var Account = Ethereum.Account,
    Trie = Ethereum.Trie,
    VM = Ethereum.VM,
    Block = Ethereum.Block,
    rlp = Ethereum.RLP,
    utils = Ethereum.Util,
    internals = {};

exports.init = function (stateDB, blockchain) {
    var vm = new VM(stateDB); 

    vm.generateGenesis(function () {
        var block = new Block();
        block.header.stateRoot = vm.trie.root;
        console.log('root: ' + vm.trie.root.toString('hex'));
        console.log('rlp: ' + block.serialize().toString('hex'));
        console.log('hash: ' + block.hash());
        blockchain.addBlock(block);
    });
};
