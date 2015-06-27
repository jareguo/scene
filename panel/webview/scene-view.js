(function () {
var Ipc = require('ipc');

Polymer( {
    is: 'scene-view',

    properties: {
    },

    ready: function () {
        // make sure css reflow
        requestAnimationFrame( function () {
            this._initEngine();
        }.bind(this));
    },

    _initEngine: function () {
        // init asset library
        Fire.AssetLibrary.init(Editor.importPath);

        // init engine
        var canvasEL = this.$.canvas;
        var bcr = this.getBoundingClientRect();
        canvasEL.width  = bcr.width;
        canvasEL.height = bcr.height;

        var initOptions = {
            width: bcr.width,
            height: bcr.height,
            canvas: canvasEL,
        };

        Fire.engine.init(initOptions, function () {
            Editor.initScene(function (err) {
                if (err) {
                    Ipc.sendToHost('scene:init-error', err);
                    return;
                }

                Ipc.sendToHost('scene:ready');
            });
        });

        // beforeunload event
        window.addEventListener('beforeunload', function ( event ) {
            if ( Fire.engine.isPlaying ) {
                Fire.engine.stop();
            }
        });

        // debounce resize event
        var self = this;
        var _resizeDebounceID = null;
        window.addEventListener('resize', function ( event ) {
            // debounce write for 10ms
            if ( _resizeDebounceID ) {
                return;
            }
            _resizeDebounceID = setTimeout(function () {
                _resizeDebounceID = null;
                var bcr = self.getBoundingClientRect();
                Fire.engine.canvasSize = new Fire.v2( bcr.width, bcr.height );
            }, 10);
        });
    },
});

})();
