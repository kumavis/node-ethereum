const async = require('async');
const log = require('npmlog');
const BN = require('bn.js');
const Semaphore = require('semaphore');
const util = require('util')

//require('v8-profiler');
var sem = Semaphore(1);

BlockProcesser = module.exports = function(app){
  this.app = app;
}

/**
 * processes blocks and adds them to the blockchain
 * @method onBlock
 * @param {Aarray} - an `Array` of `Blocks`
 * @private
 */
BlockProcesser.prototype.run = function(blocks, cb) {

  var self = this;

  this.app.vm.onTx = function(tx, done) {
    log.info('vm', ' Transaction ' + new BN(tx.nonce).toString());
    // if(bignum.fromBuffer(tx.nonce).toString() === '0'){
    //   console.log("value!!!!");
    
    
    // }else{
    // }
    done();
  };

  // self.app.vm.onStep = function(info, done) {
  //   log.info('vm', bignum(info.pc).toString(16) + ' Opcode: ' + info.opcode + ' Gas: ' + info.gasLeft.toString());


  //   done();
  // };

  //TODO: Move sem to `runBlock`
  sem.take(function() {
    //proccess the block and  update the world state
    async.eachSeries(blocks, function(block, cb2) {
        log.info('vm', 'processing block:', block.hash().toString('hex') + 'height: ' + block.header.number.toString('hex'));

        async.series([
            //validate and run block
            // block.validate.bind(block, self.app.blockchain),
            function(cb3) {
              self.app.vm.runBlock({block: block, root: block.parentBlock.header.stateRoot}, function(err, results) {

                //remove the txs that were in the block from `pendingTxs`
                var txs = self.app.pendingTxs.map(function(t) {
                  return t.hash().toString('hex');
                });

                block.transactions.forEach(function(tx) {
                  var pos = txs.indexOf(tx.hash().toString('hex'));
                  self.app.pendingTxs.splice(pos, pos + 1);
                });

                setImmediate(cb3.bind(cb3, err));
              });
            },
            async.apply(self.app.blockchain.addBlock.bind(self.app.blockchain), block)
          ],
          function(err) {
            if (err) {
              console.log('error processing block: ' + err);
              console.log('height: ' + block.header.number.toString('hex'));
              console.log('state: ' + block.header.stateRoot.toString('hex'));
              console.error({
                preState: self.app.blockchain.head.header.stateRoot.toString('hex')
              });

              //TODO: restart the chain. Block bad peer
              throw (err);
            }
            cb2(err);
          });
      },
      function(err) {
        setImmediate(function() {
          sem.leave();
          if (cb) cb(err);
        });
      });
  });
};

