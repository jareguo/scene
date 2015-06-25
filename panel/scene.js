(function () {
var Util = require('util');

Editor.registerPanel( 'scene.panel', {
    is: 'editor-scene',

    properties: {
    },

    ready: function () {
        this.viewIpc = new (require('events').EventEmitter)();

        this.viewIpc.on('scene:played', function () {
            this.$.loader.hidden = true;
        }.bind(this));

        this.viewIpc.on('scene:ready', function () {
            this.$.loader.hidden = true;
        }.bind(this));
    },

    reload: function () {
        this.$.loader.hidden = false;
        this.$.view.reloadIgnoringCache();
    },

    openDevTools: function () {
        this.$.view.openDevTools();
    },

    'scene:play': function () {
        this.$.loader.hidden = false;
        this.$.view.send('scene:play');
    },

    'scene:stop': function () {
        this.$.loader.hidden = false;
        this.$.view.reloadIgnoringCache();
    },

    _onViewConsole: function ( event ) {
        switch ( event.level ) {
        case 0:
            console.log('[scene-console]: ', event.message);
            break;

        case 1:
            console.warn('[scene-console]: ', event.message);
            break;

        case 2:
            console.error('[scene-console]: ', event.message);
            break;
        }
    },

    _onViewIpc: function ( event ) {
        var args = Array.prototype.slice.call(arguments);
        args[0] = event.channel;
        if (this.viewIpc) {
            this.viewIpc.emit.apply(this.viewIpc, args);
        }
    },

    _onViewDidFinishLoad: function ( event ) {
        this.$.loader.hidden = true;
    },
});

})();
