(function () {
var Ipc = require('ipc');

Polymer( {
    is: 'scene-view',

    listeners: {
        'mousedown': '_onMouseDown',
        'mousewheel': '_onMouseWheel',
        'keydown': '_onKeyDown',
        'keyup': '_onKeyUp',
    },

    properties: {
        scale: {
            type: Number,
            value: 1.0,
        },
    },

    ready: function () {
        window.sceneView = this;

        // grid
        this.$.grid.setScaleH( [5,2], 0.01, 1000 );
        this.$.grid.setMappingH( 0, 100, 100 );

        this.$.grid.setScaleV( [5,2], 0.01, 1000 );
        this.$.grid.setMappingV( 100, 0, 100 );

        this.$.grid.setAnchor( 0.0, 1.0 );

        // make sure css reflow
        requestAnimationFrame( function () {
            this._initEngine();

            // init grid
            this.$.grid.resize();
            this.$.grid.repaint();

            // init gizmos
            this.$.gizmos.resize();
            this.$.gizmos.repaint();
        }.bind(this));
    },

    _resize: function () {
        this.$.grid.resize();
        this.$.grid.repaint();

        this.$.gizmos.resize();
        this.$.gizmos.repaint();
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
                }
                else {
                    Ipc.sendToHost('scene:ready');
                }
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
            self.$.gizmos.hidden = true;

            Ipc.sendToHost('scene:playing');
        });
    },

    _onMouseDown: function ( event ) {
        event.stopPropagation();

        // process rect-selection
        if ( event.which === 1 ) {
            if ( event.shiftKey ) {
                this.style.cursor = '-webkit-grabbing';
                EditorUI.startDrag('-webkit-grabbing', event,
                                   // move
                                   function ( event, dx, dy, offsetx, offsety ) {
                                       this.$.grid.pan( dx, dy );
                                       this.$.grid.repaint();

                                       var scene = Fire.engine.getCurrentScene();
                                       scene.position = Fire.v2(this.$.grid.xAxisOffset,
                                                               -this.$.grid.yAxisOffset);
                                   }.bind(this),

                                   // end
                                   function ( event, dx, dy, offsetx, offsety ) {
                                       if ( event.shiftKey )
                                           this.style.cursor = '-webkit-grab';
                                       else
                                           this.style.cursor = '';
                                   }.bind(this));
            }
            else {
                // TODO
                // var toggleMode = false;
                // var lastSelection = Editor.Selection.entities;
                // if ( event.metaKey || event.ctrlKey ) {
                //     toggleMode = true;
                // }

                var rect = this.$.gizmos.getBoundingClientRect();
                var startx = event.clientX - rect.left;
                var starty = event.clientY - rect.top;

                EditorUI.startDrag('default', event,

                                   // move
                                   function ( event, dx, dy, offsetx, offsety ) {
                                       var x = startx;
                                       var y = starty;
                                       if ( offsetx < 0.0 ) {
                                           x += offsetx;
                                           offsetx = -offsetx;
                                       }
                                       if ( offsety < 0.0 ) {
                                           y += offsety;
                                           offsety = -offsety;
                                       }

                                       this.$.gizmos.updateSelectRect( x, y, offsetx, offsety );
                                   }.bind(this),

                                   // end
                                   function ( event, dx, dy, offsetx, offsety ) {
                                       this.$.gizmos.fadeoutSelectRect();
                                   }.bind(this));
            }

            return;
        }
    },

    _onMouseWheel: function ( event ) {
        event.stopPropagation();

        var newScale = Editor.Utils.smoothScale(this.scale, event.wheelDelta);
        newScale = Math.clamp( newScale, 0.01, 1000 );

        //
        this.scale = newScale;

        //
        this.$.grid.xAxisScaleAt ( event.offsetX, newScale );
        this.$.grid.yAxisScaleAt ( event.offsetY, newScale );
        this.$.grid.repaint();

        //
        var scene = Fire.engine.getCurrentScene();
        scene.scale = Fire.v2( this.$.grid.xAxisScale, this.$.grid.yAxisScale );
        scene.position = Fire.v2(this.$.grid.xAxisOffset, -this.$.grid.yAxisOffset);
    },

    _onKeyDown: function ( event ) {
        event.stopPropagation();

        if ( Editor.KeyCode(event.which) === 'shift' ) {
            this.style.cursor = '-webkit-grab';
        }
    },

    _onKeyUp: function ( event ) {
        event.stopPropagation();

        if ( Editor.KeyCode(event.which) === 'shift' ) {
            this.style.cursor = '';
        }
    },
});

})();
