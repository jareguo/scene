(function () {
'use strict';

var Path = require('fire-path');
//var Url = require('fire-url');

function callOnFocusInTryCatch (c) {
    try {
        c.onFocusInEditor();
    }
    catch (e) {
        cc._throw(e);
    }
}
function callOnLostFocusInTryCatch (c) {
    try {
        c.onLostFocusInEditor();
    }
    catch (e) {
        cc._throw(e);
    }
}

Editor.registerElement({
    listeners: {
        'mousedown': '_onMouseDown',
        'mousewheel': '_onMouseWheel',
        'mousemove': '_onMouseMove',
        'mouseleave': '_onMouseLeave',
        'keydown': '_onKeyDown',
        'keyup': '_onKeyUp'
    },

    properties: {
        scale: {
            type: Number,
            value: 1.0,
        },

        transformTool: {
            type: String,
            value: 'move',
            notify: true,
            observer: 'setTransformTool',
        },

        coordinate: {
            type: String,
            value: 'local',
            notify: true,
            observer: 'setCoordinate',
        },

        pivot: {
            type: String,
            value: 'pivot',
            notify: true,
            observer: 'setPivot',
        },

        designWidth: {
            type: Number,
            value: 0,
            notify: true,
            observer: '_designSizeChanged',
        },

        designHeight: {
            type: Number,
            value: 0,
            notify: true,
            observer: '_designSizeChanged',
        }
    },

    ready: function () {
        this._inited = false;

        var mappingH = [0, 1, 1];
        var mappingV = [1, 0, 1];

        // grid
        this.$.grid.setScaleH( [5,2], 0.01, 1000 );
        this.$.grid.setMappingH( mappingH[0], mappingH[1], mappingH[2] );

        this.$.grid.setScaleV( [5,2], 0.01, 1000 );
        this.$.grid.setMappingV( mappingV[0], mappingV[1], mappingV[2] );

        this.$.grid.setAnchor( 0.5, 0.5 );
    },

    attached: function () {
        // this.async(() => {
        //     this.lightDomReady();
        // });

        window.requestAnimationFrame(() => {
            this.lightDomReady();
        });
    },

    lightDomReady: function  () {
        this._resize();
    },

    init: function () {
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

        this._inited = true;
    },

    reset: function () {
        Editor.Selection.clear('node');

        // reset scene gizmos, scene grid
        this.$.gizmosView.reset();

        // reset cc.engine editing state
        cc.engine.animatingInEditMode = false;
    },

    initPosition: function ( x, y, scale ) {
        this.scale = scale;

        //
        this.$.grid.xAxisSync ( x, scale );
        this.$.grid.yAxisSync ( y, scale );
        this.$.grid.repaint();

        //
        this.$.gizmosView.scale = scale;

        // override some attributes to make the transform of Scene not serializable
        var SceneTransformProps = ['_position', '_rotationX', '_rotationY', '_scaleX', '_scaleY', '_skewX', '_skewY'];
        SceneTransformProps.forEach(function (prop) {
            var attr = cc.Class.attr(cc.EScene, prop);
            attr = cc.js.addon({
                serializable: false
            }, attr);
            cc.Class.attr(cc.EScene.prototype, prop, attr);
        });

        var scene = cc.director.getScene();
        scene.scale = cc.v2( this.$.grid.xAxisScale, this.$.grid.yAxisScale );
        scene.setPosition(cc.v2( this.$.grid.xDirection * this.$.grid.xAxisOffset,
                                 this.$.grid.yDirection * this.$.grid.yAxisOffset ));
        cc.engine.repaintInEditMode();
    },

    _resize: function () {
        var bcr;

        // need init when panel has size, or canvas and resolution size will be zero
        if (!this._inited) {
            // should not init if bounding rect is zero
            bcr = this.getBoundingClientRect();
            if (bcr.width === 0 && bcr.height === 0) return;

            this.init();
            this._designSizeChanged();
        }

        if ( cc.engine.isPlaying || !cc.view) {
            return;
        }

        // resize grid
        this.$.grid.resize();
        this.$.grid.repaint();

        // resize gizmos
        this.$.gizmosView.resize();

        // resize engine
        bcr = this.getBoundingClientRect();
        cc.view.setCanvasSize(bcr.width, bcr.height);
        cc.view.setDesignResolutionSize(bcr.width, bcr.height);

        // sync axis offset and scale from grid
        var scene = cc.director.getScene();
        scene.scale = cc.v2(this.$.grid.xAxisScale, this.$.grid.yAxisScale);
        scene.setPosition(cc.v2(this.$.grid.xDirection * this.$.grid.xAxisOffset,
                                this.$.grid.yDirection * this.$.grid.yAxisOffset));
        cc.engine.repaintInEditMode();
    },

    _initEngine: function () {
        if ( cc.engine.isInitialized ) {
            // 从外部窗口 attach 回到主窗口时需要重置所有 engine 相关状态
            cc.engine.reset();
            Editor.Sandbox.reset();
        }

        // init engine
        var canvasEL = this.$['engine-canvas'];
        var bcr = this.getBoundingClientRect();
        canvasEL.width  = bcr.width;
        canvasEL.height = bcr.height;

        var initOptions = {
            width: bcr.width,
            height: bcr.height,
            id: 'engine-canvas',
            designWidth: bcr.width,
            designHeight: bcr.height
        };

        var self = this;
        cc.engine.init(initOptions, function () {
            Editor.initScene(function (err) {
                if (err) {
                    self.fire('scene-view-init-error', err);
                }
                else {
                    self.fire('scene-view-ready');
                    self._resize();
                }
            });
        });
    },

    newScene: function () {
        this.reset();
        Editor.runDefaultScene();

        this.adjustToCenter(20);
        cc.engine.repaintInEditMode();

        Editor.remote.currentSceneUuid = null;
        this.fire('scene-view-ready');
    },

    loadScene: function ( uuid ) {
        this.reset();

        cc.director._loadSceneByUuid(uuid, function (err) {
            this.adjustToCenter(20);
            cc.engine.repaintInEditMode();

            if (err) {
                this.fire('scene-view-init-error', err);
            }
            else {
                Editor.remote.currentSceneUuid = uuid;
                this.fire('scene-view-ready');
            }
        }.bind(this));
    },

    adjustToCenter: function ( margin ) {
        var bcr = this.getBoundingClientRect();
        var fitWidth = bcr.width - margin * 2;
        var fitHeigth = bcr.height - margin * 2;
        var designWidth = this.$.gizmosView.designSize[0];
        var designHeight = this.$.gizmosView.designSize[1];

        if ( designWidth <= fitWidth && designHeight <= fitHeigth ) {
            this.initPosition( this.$.grid.xDirection * (bcr.width - designWidth)/2,
                       this.$.grid.yDirection * (bcr.height - designHeight)/2,
                       1.0
                    );
        }
        else {
            var result = Editor.Utils.fitSize(designWidth, designHeight,
                                              fitWidth, fitHeigth);
            // move x
            if ( result[0] < result[1] ) {
                this.initPosition( this.$.grid.xDirection * (bcr.width - result[0])/2,
                           this.$.grid.yDirection * (bcr.height - result[1])/2,
                           result[0]/designWidth
                        );
            }
            // move y
            else {
                this.initPosition( this.$.grid.xDirection * (bcr.width - result[0])/2,
                           this.$.grid.yDirection * (bcr.height - result[1])/2,
                           result[1]/designHeight
                        );
            }
        }
    },

    sceneToPixel: function ( pos ) {
        return cc.v2(
            this.$.grid.valueToPixelH(pos.x),
            this.$.grid.valueToPixelV(pos.y)
        );
    },

    worldToPixel: function (pos) {
        var scene = cc.director.getScene();
        var scenePos = scene.convertToNodeSpaceAR(pos);
        return this.sceneToPixel( scenePos );
    },

    pixelToScene: function (pos) {
        return cc.v2(
            this.$.grid.pixelToValueH(pos.x),
            this.$.grid.pixelToValueV(pos.y)
        );
    },

    pixelToWorld: function (pos) {
        var scene = cc.director.getScene();
        return cc.v2(scene.convertToWorldSpaceAR(this.pixelToScene(pos)));
    },

    activate: function ( id ) {
        var node = cc.engine.getInstanceById(id);
        if (node) {
            for (var i = 0; i < node._components.length; ++i) {
                var comp = node._components[0];
                if (comp.constructor._executeInEditMode && comp.isValid) {
                    if (comp.onFocusInEditor) {
                        callOnFocusInTryCatch(comp);
                    }
                    if (comp.constructor._playOnFocus) {
                        cc.engine.animatingInEditMode = true;
                    }
                }
            }
        }
    },

    deactivate: function ( id ) {
        var node = cc.engine.getInstanceById(id);
        if (node && node.isValid) {
            for (var i = 0; i < node._components.length; ++i) {
                var comp = node._components[0];
                if (comp.constructor._executeInEditMode && comp.isValid) {
                    if (comp.onLostFocusInEditor) {
                        callOnLostFocusInTryCatch(comp);
                    }
                    if (comp.constructor._playOnFocus) {
                        cc.engine.animatingInEditMode = false;
                    }
                }
            }
        }
    },

    select: function ( ids ) {
        this.$.gizmosView.select(ids);
    },

    unselect: function ( ids ) {
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
            var node = cc.engine.getInstanceById(id);
            if (node) {
                this.undo.recordDeleteNode(id);
                node.destroy();
            }
        }
        this.undo.commit();
        Editor.Selection.unselect('node', ids, true);
    },

    hitTest: function ( x, y ) {
        // TODO
        // this.$.gizmosView.rectHitTest( x, y, 1, 1 );

        var worldHitPoint = this.pixelToWorld( cc.v2(x,y) );
        var minDist = Number.MAX_VALUE;
        var resultNode;

        var nodes = cc.engine.getIntersectionList( new cc.Rect(worldHitPoint.x, worldHitPoint.y, 1, 1) );
        nodes.forEach( function ( node ) {
            var aabb = node.getWorldBounds();
            // TODO: calculate the OBB center instead
            var dist = worldHitPoint.sub(aabb.center).magSqr();
            if ( dist < minDist ) {
                minDist = dist;
                resultNode = node;
            }
        });

        return resultNode;
    },

    rectHitTest: function ( x, y, w, h ) {
        var v1 = this.pixelToWorld( cc.v2(x,y) );
        var v2 = this.pixelToWorld( cc.v2(x+w,y+h) );
        var worldRect = cc.Rect.fromMinMax(v1,v2);

        var results = [];
        var nodes = cc.engine.getIntersectionList(worldRect);
        nodes.forEach( function ( node ) {
            results.push(node);
        });

        return results;
    },

    // DISABLE
    // play: function () {
    //     var self = this;
    //     //
    //     Editor.playScene(function (err) {
    //         if (err) {
    //             this.fire('scene:play-error', err);
    //             return;
    //         }
    //         this.fire('scene:playing');
    //     });
    // },

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

                    var scene = cc.director.getScene();
                    scene.setPosition(cc.v2(this.$.grid.xDirection * this.$.grid.xAxisOffset,
                                            this.$.grid.yDirection * this.$.grid.yAxisOffset));
                    cc.engine.repaintInEditMode();
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
        var scene = cc.director.getScene();
        scene.scale = cc.v2( this.$.grid.xAxisScale, this.$.grid.yAxisScale );
        scene.setPosition(cc.v2(this.$.grid.xDirection * this.$.grid.xAxisOffset,
                                this.$.grid.yDirection * this.$.grid.yAxisOffset));
        cc.engine.repaintInEditMode();
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
        }
    },

    _onKeyUp: function ( event ) {
        event.stopPropagation();

        if ( Editor.KeyCode(event.which) === 'shift' ) {
            this.style.cursor = '';
        }
    },

    setTransformTool: function (transformTool) {
        this.$.gizmosView.transformTool = transformTool || this.transformTool;
        cc.engine.repaintInEditMode();
    },

    setCoordinate: function (coordinate) {
        this.$.gizmosView.coordinate = coordinate || this.coordinate;
        cc.engine.repaintInEditMode();
    },

    setPivot: function (pivot) {
        this.$.gizmosView.pivot = pivot || this.pivot;
        cc.engine.repaintInEditMode();
    },

    _designSizeChanged: function () {
        if (!this._inited) return;

        var w = this.designWidth;
        var h = this.designHeight;

        this.$.gizmosView.designSize = [w, h];

        var size = cc.engine.getDesignResolutionSize();
        if (size.width !== w || size.height !== h) {
            cc.engine.setDesignResolutionSize(w, h);
            cc.engine.repaintInEditMode();
        }
    }
});

})();
