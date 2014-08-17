var async = require('async'),
  Semaphore = require('semaphore');

var sem = Semaphore(1);

/**
 * processes blocks and adds them to the blockchain
 * @method onBlock
 * @param {Aarray} - an `Array` of `Blocks`
 * @private
 */
module.exports = function (blocks) {

  var self = this;

  blocks.reverse();
  sem.take(function () {
    //proccess the block and  update the world state
    async.eachSeries(blocks, function (block, cb) {
      var parentBlock = self.blockchain.head,
        ppBlock = self.blockchain.parentHead;

      async.series([
        async.apply(block.genTxTrie.bind(block)),
        function (cb2) {
          if (parentBlock.hash().toString('hex') !== block.header.parentHash.toString('hex')) {
            ppBlock = false;
            self.blockchain.getBlock(block.header.parentHash, function (err, foundParentBlock) {
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
            self.blockchain.getBlock(parentBlock.header.parentHash, function (err, foundPPBlock) {
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
            self.vm.runBlock(block, parentBlock.header.stateRoot, cb2);
          } else {
            cb2('invalid block');
          }
        },
        async.apply(self.blockchain.addBlock.bind(self.blockchain), block)
      ], function (err) {
        if (err) {
          console.log('error processing block: ' + err);
          console.log('height: ' + block.header.number.toString('hex'));
          console.error({
            preState: self.blockchain.head.header.stateRoot.toString('hex')
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
