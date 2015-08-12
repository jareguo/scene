(function () {
var Ipc = require('ipc');
var Url = require('fire-url');

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
    },

    created: function () {
        window.sceneView = this;
    },

    ready: function () {
        var mappingH = Fire.Runtime.Settings['mapping-h'];
        var mappingV = Fire.Runtime.Settings['mapping-v'];

        // grid
        this.$.grid.setScaleH( [5,2], 0.01, 1000 );
        this.$.grid.setMappingH( mappingH[0], mappingH[1], mappingH[2] );

        this.$.grid.setScaleV( [5,2], 0.01, 1000 );
        this.$.grid.setMappingV( mappingV[0], mappingV[1], mappingV[2] );

        this.$.grid.setAnchor( 0.5, 0.5 );

        // make sure css reflow
        requestAnimationFrame( function () {
            this._initEngine();

            // init grid
            this.$.grid.resize();
            this.$.grid.repaint();

            // init gizmos
            this.$.gizmosView.resize();
            this.$.gizmosView.sceneToPixel = this.sceneToPixel.bind(this);
            this.$.gizmosView.worldToPixel = this.worldToPixel.bind(this);
            this.$.gizmosView.pixelToScene = this.pixelToScene.bind(this);
            this.$.gizmosView.pixelToWorld = this.pixelToWorld.bind(this);
        }.bind(this));
    },

    reset: function () {
        Editor.Selection.clear('node');

        // reset scene gizmos, scene grid
        window.sceneView.$.gizmosView.reset();

        // reset Fire.engine editing state
        Fire.engine.animatingInEditMode = false;
    },

    init: function ( x, y, scale ) {
        this.scale = scale;

        //
        this.$.grid.xAxisSync ( x, scale );
        this.$.grid.yAxisSync ( y, scale );
        this.$.grid.repaint();

        //
        this.$.gizmosView.scale = scale;

        //
        var scene = Fire.engine.getCurrentScene();
        scene.scale = Fire.v2( this.$.grid.xAxisScale, this.$.grid.yAxisScale );
        scene.position = Fire.v2(this.$.grid.xAxisOffset, -this.$.grid.yAxisOffset);
        Fire.engine.repaintInEditMode();
    },

    _resize: function () {
        if ( Fire.engine.isPlaying ) {
            return;
        }

        // resize grid
        this.$.grid.resize();
        this.$.grid.repaint();

        // resize gizmos
        this.$.gizmosView.resize();

        // resize engine
        var bcr = this.getBoundingClientRect();
        Fire.engine.canvasSize = new Fire.v2( bcr.width, bcr.height );

        // sync axis offset and scale from grid
        var scene = Fire.engine.getCurrentScene();
        scene.scale = Fire.v2(this.$.grid.xAxisScale, this.$.grid.yAxisScale);
        scene.position = Fire.v2(this.$.grid.xAxisOffset, -this.$.grid.yAxisOffset);
        Fire.engine.repaintInEditMode();
    },

    _initEngine: function () {
        // init asset library
        //var importUrl = Url.format({
        //    protocol: '',
        //    pathname: Editor.importPath,
        //    slashes: true,
        //});
        var importUrl = Editor.importPath.replace(/\\/g, '/');
        Fire.AssetLibrary.init(importUrl);

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
                self._resize();
            }, 10);
        });
    },

    newScene: function () {
        var SceneWrapperImpl = Fire.engine.getCurrentScene().constructor;
        var sceneWrapper = new SceneWrapperImpl();
        sceneWrapper.createAndAttachNode();

        this.reset();
        Fire.engine._launchScene(sceneWrapper);

        this.adjustToCenter(20);
        Fire.engine.repaintInEditMode();

        Editor.remote.currentSceneUuid = null;
        Ipc.sendToHost('scene:ready');
    },

    loadScene: function ( uuid ) {
        var self = this;

        self.reset();

        Fire.engine._loadSceneByUuid(uuid, function (err) {
            self.adjustToCenter(20);
            Fire.engine.repaintInEditMode();

            if (err) {
                Ipc.sendToHost('scene:init-error', err);
            }
            else {
                Editor.remote.currentSceneUuid = uuid;
                Ipc.sendToHost('scene:ready');
            }
        });
    },

    adjustToCenter: function ( margin ) {
        var bcr = this.getBoundingClientRect();
        var fitWidth = bcr.width - margin * 2;
        var fitHeigth = bcr.height - margin * 2;
        var designWidth = this.$.gizmosView.designSize[0];
        var designHeight = this.$.gizmosView.designSize[1];

        if ( designWidth <= fitWidth && designHeight <= fitHeigth ) {
            this.init( (bcr.width - designWidth)/2,
                      -(bcr.height - designHeight)/2,
                      1.0
                     );
        }
        else {
            var result = EditorUI.fitSize(designWidth, designHeight,
                                          fitWidth, fitHeigth);
            // move x
            if ( result[0] < result[1] ) {
                this.init( (bcr.width - result[0])/2,
                          -(bcr.height - result[1])/2,
                          result[0]/designWidth
                         );
            }
            // move y
            else {
                this.init( (bcr.width - result[0])/2,
                          -(bcr.height - result[1])/2,
                          result[1]/designHeight
                         );
            }
        }
    },

    sceneToPixel: function ( pos ) {
        return Fire.v2(
            this.$.grid.valueToPixelH(pos.x),
            this.$.grid.valueToPixelV(pos.y)
        );
    },

    worldToPixel: function (pos) {
        var scene = Fire.engine.getCurrentScene();
        var scenePos = scene.transformPointToLocal(pos);
        return this.sceneToPixel( scenePos );
    },

    pixelToScene: function (pos) {
        return Fire.v2(
            this.$.grid.pixelToValueH(pos.x),
            this.$.grid.pixelToValueV(pos.y)
        );
    },

    pixelToWorld: function (pos) {
        var scene = Fire.engine.getCurrentScene();
        return scene.transformPointToWorld( this.pixelToScene(pos) );
    },

    activate: function ( id ) {
        if ( Editor.states['scene-playing'] ) {
            return;
        }

        var wrapper = Fire.engine.getInstanceById(id);
        if ( wrapper && wrapper.constructor.animatableInEditor ) {
            if ( wrapper.onFocusInEditor )
                wrapper.onFocusInEditor();

            Fire.engine.animatingInEditMode = true;
        }
    },

    deactivate: function ( id ) {
        if ( Editor.states['scene-playing'] ) {
            return;
        }

        var wrapper = Fire.engine.getInstanceById(id);
        if ( wrapper && wrapper.constructor.animatableInEditor ) {
            if ( wrapper.onLostFocusInEditor )
                wrapper.onLostFocusInEditor();

            Fire.engine.animatingInEditMode = false;
        }
    },

    select: function ( ids ) {
        if ( Editor.states['scene-playing'] ) {
            return;
        }

        this.$.gizmosView.select(ids);
    },

    unselect: function ( ids ) {
        if ( Editor.states['scene-playing'] ) {
            return;
        }

        this.$.gizmosView.unselect(ids);
    },

    hoverin: function ( id ) {
        this.$.gizmosView.hoverin(id);
    },

    hoverout: function ( id ) {
        this.$.gizmosView.hoverout(id);
    },

    delete: function ( ids ) {
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i];
            var nodeWrapper = Fire.engine.getInstanceById(id);
            if (nodeWrapper) {
                nodeWrapper.parent = null;
            }
        }
        Editor.Selection.unselect('node', ids, true);
    },

    hitTest: function ( x, y ) {
        // TODO
        // this.$.gizmosView.rectHitTest( x, y, 1, 1 );

        var worldHitPoint = this.pixelToWorld( Fire.v2(x,y) );
        var minDist = Number.MAX_VALUE;
        var resultNode;

        var nodes = Fire.engine.getIntersectionList( new Fire.Rect(worldHitPoint.x, worldHitPoint.y, 1, 1) );
        nodes.forEach( function ( node ) {
            var fireNode = Fire(node);
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
        var v1 = this.pixelToWorld( Fire.v2(x,y) );
        var v2 = this.pixelToWorld( Fire.v2(x+w,y+h) );
        var worldRect = Fire.Rect.fromMinMax(v1,v2);

        var results = [];
        var nodes = Fire.engine.getIntersectionList(worldRect);
        nodes.forEach( function ( node ) {
            var fireNode = Fire(node);
            results.push(fireNode);
        });

        return results;
    },

    play: function () {
        var self = this;
        //
        Editor.playScene(function (err) {
            if (err) {
                Ipc.sendToHost('scene:play-error', err);
                return;
            }
            Ipc.sendToHost('scene:playing');
        });
    },

    _onMouseDown: function ( event ) {
        event.stopPropagation();

        // panning
        if ( (event.which === 1 && event.shiftKey) ||
             event.which === 2
           )
        {
            this.style.cursor = '-webkit-grabbing';
            EditorUI.startDrag(
                '-webkit-grabbing',
                event,

                // move
                function ( event, dx, dy, offsetx, offsety ) {
                    this.$.grid.pan( dx, dy );
                    this.$.grid.repaint();

                    var scene = Fire.engine.getCurrentScene();
                    scene.position = Fire.v2(this.$.grid.xAxisOffset,
                                             -this.$.grid.yAxisOffset);
                    Fire.engine.repaintInEditMode();
                }.bind(this),

                // end
                function ( event, dx, dy, offsetx, offsety ) {
                    if ( event.shiftKey )
                        this.style.cursor = '-webkit-grab';
                    else
                        this.style.cursor = '';
                }.bind(this)
            );

            return;
        }

        // process rect-selection
        if ( event.which === 1 ) {
            var toggleMode = false;
            var lastSelection = Editor.Selection.curSelection('node');
            if ( event.metaKey || event.ctrlKey ) {
                toggleMode = true;
            }

            var startx = event.offsetX;
            var starty = event.offsetY;

            EditorUI.startDrag(
                'default',
                event,

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

                    this.$.gizmosView.updateSelectRect( x, y, offsetx, offsety );

                    var nodes = this.rectHitTest( x, y, offsetx, offsety );
                    var i, ids;

                    // toggle mode will always act added behaviour when we in rect-select-state
                    if ( toggleMode ) {
                        ids = lastSelection.slice();

                        for ( i = 0; i < nodes.length; ++i ) {
                            if ( ids.indexOf(nodes[i].uuid) === -1 )
                                ids.push( nodes[i].uuid );
                        }
                    }
                    else {
                        ids = [];

                        for ( i = 0; i < nodes.length; ++i ) {
                            ids.push( nodes[i].uuid );
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
                                if ( lastSelection.indexOf(node.uuid) === -1 ) {
                                    Editor.Selection.select ( 'node', node.uuid, false, true );
                                }
                                else {
                                    Editor.Selection.unselect ( 'node', node.uuid, true );
                                }
                            }
                        }
                        else {
                            if ( node ) {
                                Editor.Selection.select ( 'node', node.uuid, true, true );
                            }
                            else {
                                Editor.Selection.clear ( 'node' );
                            }
                        }
                    }
                    else {
                        Editor.Selection.confirm ();
                        this.$.gizmosView.fadeoutSelectRect();
                    }
                }.bind(this)
            );

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
        this.$.gizmosView.scale = newScale;

        //
        var scene = Fire.engine.getCurrentScene();
        scene.scale = Fire.v2( this.$.grid.xAxisScale, this.$.grid.yAxisScale );
        scene.position = Fire.v2(this.$.grid.xAxisOffset, -this.$.grid.yAxisOffset);
        Fire.engine.repaintInEditMode();
    },

    _onMouseMove: function ( event ) {
        event.stopPropagation();

        var node = this.hitTest( event.offsetX, event.offsetY );
        var id = node ? node.uuid : null;
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
    },

    _onKeyUp: function ( event ) {
        event.stopPropagation();

        if ( Editor.KeyCode(event.which) === 'shift' ) {
            this.style.cursor = '';
        }
    },
});

})();
