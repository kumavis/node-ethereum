var async = require('async'),
  log = require('npmlog'),
  bignum = require('bignum'),
  Semaphore = require('semaphore');

var sem = Semaphore(1);

/**
 * processes blocks and adds them to the blockchain
 * @method onBlock
 * @param {Aarray} - an `Array` of `Blocks`
 * @private
 */
module.exports = function (blocks, cb) {

  var self = this;

  this.vm.onTx = function (tx, done) {
    log.info("vm", " Transaction " + tx.nonce.toString('hex'));
    done();
  };

  this.vm.onStep = function (info, done) {
    log.info("vm", bignum(info.pc).toString(16) + " Opcode: " + info.opcode + " Gas: " + info.gasLeft.toString());

    info.stack.reverse();
    info.stack.forEach(function (item) {
      log.info("vm", "    " + item.toString('hex'));
    });
    info.stack.reverse();

    done();
  };


  sem.take(function () {
    //proccess the block and  update the world state
    async.eachSeries(blocks, function (block, cb) {
      log.info('vm', 'processing block:', block.hash().toString('hex'));
      var parentBlock = self.blockchain.head,
        ppBlock = self.blockchain.parentHead;

      async.series([
        async.apply(block.genTxTrie.bind(block)),
        //get parent block
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
          //get parent parent block
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
          //validate and run block
          if (block.validate(parentBlock, ppBlock)) {
            self.vm.runBlock(block, parentBlock.header.stateRoot, cb2);
          } else {
            log.warn('vm', 'invalid block');
            cb2('invalid block');
          }
        },
        async.apply(self.blockchain.addBlock.bind(self.blockchain), block)
      ], function (err) {
        if (err) {
          console.log('error processing block: ' + err);
          console.log('height: ' + block.header.number.toString('hex'));
          console.log('state: ' + block.header.stateRoot.toString('hex'));
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
