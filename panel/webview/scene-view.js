(function () {
var Ipc = require('ipc');
var _ = require('lodash');

Polymer( {
    is: 'scene-view',

    listeners: {
        'mousedown': '_onMouseDown',
        'mousewheel': '_onMouseWheel',
        'mousemove': '_onMouseMove',
        'mouseleave': '_onMouseLeave',
        'keydown': '_onKeyDown',
        'keyup': '_onKeyUp',
    },

    properties: {
        scale: {
            type: Number,
            value: 1.0,
        },

        transformTool: {
            type: String,
            value: 'move',
        },

        coordinate: {
            type: String,
            value: 'local',
        },

        pivot: {
            type: String,
            value: 'pivot',
        },
    },

    ready: function () {
        window.sceneView = this;

        this._selection = [];

        var mappingH = Fire.Runtime.Settings['mapping-h'];
        var mappingV = Fire.Runtime.Settings['mapping-v'];

        // grid
        this.$.grid.setScaleH( [5,2], 0.01, 1000 );
        this.$.grid.setMappingH( mappingH[0], mappingH[1], mappingH[2] );

        this.$.grid.setScaleV( [5,2], 0.01, 1000 );
        this.$.grid.setMappingV( mappingV[0], mappingV[1], mappingV[2] );

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
            Editor.Selection.clear('node');
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

    sceneToScreen: function ( x, y ) {
        return Fire.v2(
            this.$.grid.valueToPixelH(x),
            this.$.grid.valueToPixelV(y)
        );
    },

    worldToScreen: function ( x, y ) {
        var scene = Fire.engine.getCurrentScene();
        var scenePos = scene.transformPointToLocal( Fire.v2(x,y) );
        return this.sceneToScreen( scenePos.x, scenePos.y );
    },

    screenToScene: function ( x, y ) {
        return Fire.v2(
            this.$.grid.pixelToValueH(x),
            this.$.grid.pixelToValueV(y)
        );
    },

    screenToWorld: function ( x, y ) {
        var scene = Fire.engine.getCurrentScene();
        return scene.transformPointToWorld( this.screenToScene(x,y) );
    },

    select: function ( ids ) {
        this._selection = _.uniq(this._selection.concat(ids));

        // TODO
    },

    unselect: function ( ids ) {
        this._selection = _.difference( this._selection, ids );

        // TODO
    },

    hitTest: function ( x, y ) {
        // TODO
        // this.$.gizmos.rectHitTest( x, y, 1, 1 );

        var worldHitPoint = this.screenToWorld(x,y);
        var minDist = Number.MAX_VALUE;
        var resultNode;

        var nodes = Fire.engine.getIntersectionList( new Fire.Rect(worldHitPoint.x, worldHitPoint.y, 1, 1) );
        nodes.forEach( function ( node ) {
            var fireNode = Fire.node(node);
            var aabb = fireNode.getWorldBounds();
            // TODO: calculate the OBB center instead
            var dist = worldHitPoint.sub(aabb.center).magSqr();
            if ( dist < minDist ) {
                minDist = dist;
                resultNode = fireNode;
            }
        });

        return resultNode;
    },

    rectHitTest: function ( x, y, w, h ) {
        var v1 = this.screenToWorld(x,y);
        var v2 = this.screenToWorld(x+w,y+h);
        var worldRect = Fire.Rect.fromMinMax(v1,v2);

        var results = [];
        var nodes = Fire.engine.getIntersectionList(worldRect);
        nodes.forEach( function ( node ) {
            var fireNode = Fire.node(node);
            results.push(fireNode);
        });

        return results;
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
                var toggleMode = false;
                var lastSelection = Editor.Selection.entities;
                if ( event.metaKey || event.ctrlKey ) {
                    toggleMode = true;
                }

                var startx = event.offsetX;
                var starty = event.offsetY;

                EditorUI.startDrag('default', event,

                                   // move
                                   function ( event, dx, dy, offsetx, offsety ) {
                                       var magSqr = offsetx*offsetx + offsety*offsety;
                                       if ( magSqr < 2.0 * 2.0 ) {
                                           return;
                                       }

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

                                       var nodes = this.rectHitTest( x, y, offsetx, offsety );
                                       var i, ids;

                                       // toggle mode will always act added behaviour when we in rect-select-state
                                       if ( toggleMode ) {
                                           ids = lastSelection.slice();

                                           for ( i = 0; i < nodes.length; ++i ) {
                                               if ( ids.indexOf(nodes[i].id) === -1 )
                                                   ids.push( nodes[i].id );
                                           }
                                       }
                                       else {
                                           ids = [];

                                           for ( i = 0; i < nodes.length; ++i ) {
                                               ids.push( nodes[i].id );
                                           }
                                       }
                                       Editor.Selection.select ( 'node', ids, true, false );
                                   }.bind(this),

                                   // end
                                   function ( event, dx, dy, offsetx, offsety ) {
                                       var magSqr = offsetx*offsetx + offsety*offsety;
                                       if ( magSqr < 2.0 * 2.0 ) {
                                           var node = this.hitTest( startx, starty );

                                           if ( toggleMode ) {
                                               if ( node ) {
                                                   if ( lastSelection.indexOf(node.id) === -1 ) {
                                                       Editor.Selection.select ( 'node', node.id, false, true );
                                                   }
                                                   else {
                                                       Editor.Selection.unselect ( 'node', node.id, true );
                                                   }
                                               }
                                           }
                                           else {
                                               if ( node ) {
                                                   Editor.Selection.select ( 'node', node.id, true, true );
                                               }
                                               else {
                                                   Editor.Selection.clear ( 'node' );
                                               }
                                           }
                                       }
                                       else {
                                           Editor.Selection.confirm ();
                                           this.$.gizmos.fadeoutSelectRect();
                                       }
                                   }.bind(this));
            }

            return;
        }
    },

    _onMouseWheel: function ( event ) {
        event.stopPropagation();

        var newScale = Editor.Utils.smoothScale(this.scale, event.wheelDelta);
        newScale = Math.clamp(newScale,
                              this.$.grid.hticks.minValueScale,
                              this.$.grid.hticks.maxValueScale);

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

    _onMouseMove: function ( event ) {
        event.stopPropagation();

        var node = this.hitTest( event.offsetX, event.offsetY );
        var id = node ? node.id : null;
        Editor.Selection.hover( 'node', id );
    },

    _onMouseLeave: function ( event ) {
        Editor.Selection.hover( 'node', null );
    },

    _onKeyDown: function ( event ) {
        event.stopPropagation();

        if ( Editor.KeyCode(event.which) === 'shift' ) {
            this.style.cursor = '-webkit-grab';
            return;
        }

        if ( !event.metaKey && !event.shiftKey && !event.ctrlKey && !event.altKey ) {
            if ( Editor.KeyCode(event.which) === 'w' ) {
                Ipc.sendToHost('scene:change-transform-tool', 'move');
            }
            else if ( Editor.KeyCode(event.which) === 'e' ) {
                Ipc.sendToHost('scene:change-transform-tool', 'rotate');
            }
            else if ( Editor.KeyCode(event.which) === 'r' ) {
                Ipc.sendToHost('scene:change-transform-tool', 'scale');
            }
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
