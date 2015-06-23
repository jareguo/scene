(function () {
var Util = require('util');

Editor.registerPanel( 'scene.panel', {
    is: 'editor-scene',

    properties: {
    },

    ready: function () {
    },

    reload: function () {
        this.$.view.reloadIgnoringCache();
    },

    'scene:play': function () {
        this.$.view.send('play');
    },

    'scene:stop': function () {
        this.$.view.send('stop');
    },
});

})();
