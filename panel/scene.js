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
        switch ( event.channel ) {
            case 'scene:played':
                this.$.loader.hidden = true;
                break;
            case 'scene:ready':
                this.$.loader.hidden = true;
                break;
        }
    },

    _onViewDidFinishLoad: function ( event ) {
        this.$.loader.hidden = true;
    },
});

})();
