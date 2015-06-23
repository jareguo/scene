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

    'scene:play': function () {
        this.$.view.send('play');
    },

    'scene:stop': function () {
        this.$.view.send('stop');
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
        switch ( event.channel ) {
        }
    },

    _onViewDidFinishLoad: function ( event ) {
        this.$.loader.hidden = true;
    },
});

})();
