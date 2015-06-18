(function () {
var Util = require('util');

Editor.registerPanel( 'scene.panel', {
    is: 'editor-scene',

    listeners: {
        'resize': '_onResize',
    },

    properties: {
    },

    ready: function () {
    },

    _onResize: function ( event ) {
        // var bcr = this.$.webviewWrapper.getBoundingClientRect();
        // this.$.view.setAttribute('minwidth', bcr.width);
        // this.$.view.setAttribute('minheight', bcr.height);
    },
});

})();
