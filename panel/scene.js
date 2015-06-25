(function () {
var Util = require('util');

Editor.registerPanel( 'scene.panel', {
    is: 'editor-scene',

    properties: {
    },

    ready: function () {
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

    'scene:played': function () {
        this.$.loader.hidden = true;
    },

    'scene:stop': function () {
        this.$.loader.hidden = false;
        this.$.view.reloadIgnoringCache();
    },

    'scene:ready': function () {
        this.$.loader.hidden = true;
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
        var args = Array.prototype.slice.call(arguments, 1);
        var method = this[event.channel];
        if (typeof method === 'function') {
            method.apply(this, args);
        }
        else {
            switch ( event.channel ) {
            }
        }
    },

    _onViewDidFinishLoad: function ( event ) {
        this.$.loader.hidden = true;
    },
});

})();
