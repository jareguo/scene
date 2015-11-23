(function () {
var IpcHandler = Editor.require('packages:scene/panel/scene-ipc-handler');

var scenePanel = {
    behaviors: [ EditorUI.droppable ],

    hostAttributes: {
        'droppable': 'asset',
    },

    listeners: {
        'drop-area-enter': '_onDropAreaEnter',
        'drop-area-leave': '_onDropAreaLeave',
        'drop-area-accept': '_onDropAreaAccept',

        'scene-view-ready': '_onSceneViewReady',
        'scene-view-init-error': '_onSceneViewInitError',

        'panel-show': '_resize'
    },

    properties: {
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

    observers: [
        '_designSizeChanged(profiles.local.designWidth)',
        '_designSizeChanged(profiles.local.designHeight)',
    ],

    created: function () {
        this._viewReady = false;
        this._ipcList = [];

        console.time('scene:reloading');

        // change scene states
        Editor.sendToAll('scene:reloading');
    },

    ready: function () {
        this._initDroppable(this.$.dropArea);

        // beforeunload event
        window.addEventListener('beforeunload', function ( event ) {
            Editor.Selection.clear('node');

            // TODO
            // var res = this.confirmCloseScene();
            // switch ( res ) {
            // // save
            // case 0:
            //     this.saveCurrentScene();
            //     event.returnValue = true;
            //     return;

            // // cancel
            // case 1:
            //     event.returnValue = false;
            //     return;

            // // don't save
            // case 2:
            //     event.returnValue = true;
            //     return;
            // }
        }.bind(this));

        // debounce resize event
        var self = this;
        var _resizeDebounceID = null;
        this.addEventListener('resize', function ( event ) {
            // debounce write for 10ms
            if ( _resizeDebounceID ) {
                return;
            }
            _resizeDebounceID = setTimeout(function () {
                _resizeDebounceID = null;
                self._resize();
            }, 10);
        });

        var Ipc = require('ipc');
        Ipc.on('panel:undock', this._onUndock.bind(this));
    },

    _onUndock: function () {
        var EngineEvents = Editor.require('packages://scene/panel/scene-view/engine-events');
        EngineEvents.unregister();
    },

    _resize: function () {
        this.$.sceneView._resize();
    },

    reload: function () {
        // if ( this._viewReady ) {
        //     this.$.view.reloadIgnoringCache();
        // }
    },

    // menu messages
    selectMove: function ( event ) {
        if ( event ) {
            event.stopPropagation();
        }

        this.transformTool = 'move';
    },

    selectRect: function ( event ) {
        if ( event ) {
            event.stopPropagation();
        }

        this.transformTool = 'rect';
    },

    selectRotate: function ( event ) {
        if ( event ) {
            event.stopPropagation();
        }

        this.transformTool = 'rotate';
    },

    selectScale: function ( event ) {
        if ( event ) {
            event.stopPropagation();
        }

        this.transformTool = 'scale';
    },

    deleteCurrentSelected: function ( event ) {
        if ( event ) {
            event.stopPropagation();
        }

        var ids = Editor.Selection.curSelection('node');
        Editor.sendToPanel( 'scene.panel', 'scene:delete-nodes', ids);
    },

    duplicateCurrentSelected: function ( event ) {
        if ( event ) {
            event.stopPropagation();
        }

        var ids = Editor.Selection.curSelection('node');
        Editor.sendToPanel( 'scene.panel', 'scene:duplicate-nodes', ids);
    },

    confirmCloseScene: function () {
        var dirty = true;
        if ( dirty ) {
            var Url = require('fire-url');

            var name = 'New Scene';
            var url = 'assets://New Scene.fire';
            var currentSceneUuid = Editor.remote.currentSceneUuid;

            if ( currentSceneUuid ) {
                url = Editor.assetdb.remote.uuidToUrl(currentSceneUuid);
                name = Url.basename(url);
            }

            var Remote = require('remote');
            var Dialog = Remote.require('dialog');
            return Dialog.showMessageBox( Remote.getCurrentWindow(), {
                type: 'warning',
                buttons: ['Save','Cancel','Don\'t Save'],
                title: 'Save Scene Confirm',
                message: name + ' has changed, do you want to save it?',
                detail: 'Your changes will be lost if you close this item without saving.'
            } );
        }

        //
        return 2;
    },

    // drag & drop

    _onDropAreaEnter: function ( event ) {
        event.stopPropagation();
    },

    _onDropAreaLeave: function ( event ) {
        event.stopPropagation();
    },

    _onDropAreaAccept: function ( event ) {
        event.stopPropagation();

        Editor.Selection.cancel();

        var uuids = event.detail.dragItems;
        var type = event.detail.dragType;
        var x = event.detail.offsetX;
        var y = event.detail.offsetY;
        var sceneView = this.$.sceneView;

        var Async = require('async');

        Editor.Selection.clear('node');
        Async.each( uuids, function ( uuid, done ) {
            Async.waterfall([
                function ( next ) {
                    Editor.createNode(uuid, next);
                },

                function ( node, next ) {
                    var nodeID;
                    if ( node ) {
                        nodeID = node.uuid;

                        node.setPosition(sceneView.pixelToScene( cc.v2(x,y) ));
                        node.parent = cc.director.getScene();
                    }

                    next ( null, nodeID );
                },

            ], function ( err, nodeID ) {
                if ( err ) {
                    Editor.failed( 'Failed to drop asset %s, message: %s', uuid, err.stack || err.errorMessage );
                    return;
                }

                if ( nodeID ) {
                    Editor.Selection.select('node', nodeID, false, true );
                }
                cc.engine.repaintInEditMode();
                done();
            });
        });
    },

    _onDragOver: function ( event ) {
        var dragType = EditorUI.DragDrop.type(event.dataTransfer);
        if ( dragType !== 'asset' ) {
            EditorUI.DragDrop.allowDrop( event.dataTransfer, false );
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        EditorUI.DragDrop.allowDrop( event.dataTransfer, true );
        EditorUI.DragDrop.updateDropEffect( event.dataTransfer, 'copy' );
    },

    // value changes
    _designSizeChanged: function (event) {
        if ( this.profiles.local.save ) {
            this.profiles.local.save();
        }
    },

    // view events
    _onSceneViewReady: function () {
        this._viewReady = true;
        this.$.loader.hidden = true;

        Editor.sendToAll('scene:ready');

        var EngineEvents = Editor.require('packages://scene/panel/scene-view/engine-events');
        EngineEvents.register(this.$.sceneView);

        console.timeEnd('scene:reloading');
    },

    _onSceneViewInitError: function (event) {
        err = event.args[0];
        Editor.failed('Failed to init scene: %s', err.stack);

        this.$.loader.hidden = true;
    }
};

Editor.JS.mixin(scenePanel, IpcHandler);

Editor.registerPanel( 'scene.panel', scenePanel);

})();
