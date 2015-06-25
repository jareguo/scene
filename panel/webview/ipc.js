var Ipc = require('ipc');

Ipc.on('scene:play', function () {
    Editor.playScene(function (err) {
        if (err) {
            Editor.error(err);
        }
        else {
            Ipc.sendToHost('scene:played');
        }
    });
});
