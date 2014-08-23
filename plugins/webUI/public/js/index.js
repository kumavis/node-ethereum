var settings = require('settings');

var ws = new WebSocket('ws://' + settings.domain + '/pubsub/ws');

