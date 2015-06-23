var Ipc = require('ipc');

Ipc.on( 'play', function () {
    Editor.log('start playing');
});

Ipc.on( 'stop', function () {
    Editor.log('stop playing');
});
