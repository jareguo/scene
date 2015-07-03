(function () {
var Ipc = require('ipc');

Polymer( {
    is: 'scene-view',

    properties: {
    },

    ready: function () {
        window.sceneView = this;

        // grid
        this.$.grid.setScaleH( [5,2], 0.01, 1000 );
        this.$.grid.setMappingH( 0, 100, 100 );

        this.$.grid.setScaleV( [5,2], 0.01, 1000 );
        this.$.grid.setMappingV( 100, 0, 100 );

        this.$.grid.setAnchor( 0.0, 0.0 );

        // make sure css reflow
        requestAnimationFrame( function () {
            this._initEngine();

            // init grid
            this.$.grid.resize();
            this.$.grid.repaint();
        }.bind(this));
    },

    _resize: function () {
        this.$.grid.resize();
        this.$.grid.repaint();
    },

    _initEngine: function () {
        // init asset library
        Fire.AssetLibrary.init(Editor.importPath);

        // init engine
        var canvasEL = this.$['runtime-canvas'];
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
                self._resize();
            }, 10);
        });
    },

    play: function () {
        var self = this;
        Editor.playScene(function (err) {
            if (err) {
                Ipc.sendToHost('scene:play-error', err);
                return;
            }

            self.$.grid.hidden = true;
            Ipc.sendToHost('scene:playing');
        });
    },
});

})();
