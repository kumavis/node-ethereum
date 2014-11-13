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
    log.info('vm', ' Transaction ' + bignum.fromBuffer(tx.nonce).toString());
    done();
  };

  // this.vm.onStep = function (info, done) {
  //   log.info('vm', bignum(info.pc).toString(16) + ' Opcode: ' + info.opcode + ' Gas: ' + info.gasLeft.toString());

  //   info.stack.reverse();
  //   info.stack.forEach(function (item) {
  //     log.info('vm', '    ' + item.toString('hex'));
  //   });
  //   info.stack.reverse();

  //   done();
  // };

  //TODO: Move sem to `runBlock`
  sem.take(function () {
    //proccess the block and  update the world state
    async.eachSeries(blocks, function (block, cb2) {
        log.info('vm', 'processing block:', block.hash().toString('hex') + 'height: ' + block.header.number.toString('hex'));

        async.series([
            //validate and run block
            block.validate.bind(block, self.blockchain),
            function (cb3) {
              self.vm.runBlock(block, block.parentBlock.header.stateRoot, function (err) {
                //remove the txs that were in the block from `pendingTxs`
                var txs = self.pendingTxs.map(function (t) {
                  return t.hash().toString('hex');
                });

                block.transactions.forEach(function (tx) {
                  var pos = txs.indexOf(tx.hash().toString('hex'));
                  self.pendingTxs.splice(pos, pos + 1);
                });

                cb3(err);
              });
            },
            async.apply(self.blockchain.addBlock.bind(self.blockchain), block)
          ],
          function (err) {
            if (err) {
              console.log('error processing block: ' + err);
              console.log('height: ' + block.header.number.toString('hex'));
              console.log('state: ' + block.header.stateRoot.toString('hex'));
              console.error({
                preState: self.blockchain.head.header.stateRoot.toString('hex')
              });

              //TODO: restart the chain. Block bad peer
              throw(err);
            }
            cb2(err);
          });
      },
      function (err) {
        sem.leave();
        if (cb) cb(err);
      });
  });
};
