var App = require('../');

var app = new App();

describe('basic app functions', function () {
  it('should start', function (done) {
    app.start(done);
  });

  it('should stop', function(done) {
    app.stop(done); 
  });
});
