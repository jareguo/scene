(function () {
    'use strict';

    const Url = require('fire-url');

    function getTopLevelNodes (nodes) {
        return Editor.Utils.arrayCmpFilter(nodes, function (a, b) {
            if (a === b) {
                return 0;
            }
            if (b.isChildOf(a)) {
                return 1;
            }
            if (a.isChildOf(b)) {
                return -1;
            }
            return 0;
        });
    }

    var detailsForClipboard = {
        data: null,
        hash: '',   // used to verify whether the detail data is match with current clipboard
    };

    Editor.registerPanel('scene.panel', {
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

            'panel-show': '_onPanelResize',
            'resize': '_onPanelResize'
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
            this._thisOnCopy = null;
            this._thisOnPaste = null;
            this._copyingIds = null;
            this._pastingId = '';

            console.time('scene:reloading');

            // change scene states
            Editor.sendToAll('scene:reloading');
        },

        ready: function () {
            // beforeunload event
            window.addEventListener('beforeunload', event => {
                let res = this.confirmCloseScene();
                switch ( res ) {
                // save
                case 0:
                    this._saveScene();
                    Editor.Selection.clear('node');
                    event.returnValue = true;
                    return;

                // cancel
                case 1:
                    event.returnValue = false;
                    return;

                // don't save
                case 2:
                    Editor.Selection.clear('node');
                    event.returnValue = true;
                    return;
                }
            });

            // init droppable
            this._initDroppable(this.$.dropArea);

            // init scene manager
            const SceneManager = Editor.require('packages://scene/panel/scene-view/scene-manager');
            SceneManager.init(this.$.sceneView);

            // init undo
            const SceneUndo = Editor.require('packages://scene/panel/scene-undo');
            SceneUndo.init();
            SceneUndo.on('changed', () => {
                Editor.sendToCore('scene:update-title', this.undo.dirty());
            });
            this.undo = SceneUndo;
            this.$.sceneView.undo = SceneUndo;
            this.$.sceneView.$.gizmosView.undo = SceneUndo;

            this._resizeDebounceID = null;

            // A VERY HACK SOLUTION
            // TODO: add panel-close event
            var Ipc = require('ipc');
            Ipc.on('panel:undock', (panelID) => {
                if ( panelID !== 'scene.panel' ) {
                    return;
                }

                const EngineEvents = Editor.require('packages://scene/panel/scene-view/engine-events');
                EngineEvents.unregister();
            });
        },

        attached: function () {
            this._thisOnCopy = this._onCopy.bind(this);
            document.addEventListener('copy', this._thisOnCopy);
            this._thisOnPaste = this._onPaste.bind(this);
            document.addEventListener('paste', this._thisOnPaste);
        },
        detached: function () {
            document.removeEventListener('copy', this._thisOnCopy);
            document.removeEventListener('paste', this._thisOnPaste);
        },

        _onPanelResize: function () {
            // debounce write for 10ms
            if ( this._resizeDebounceID ) {
                return;
            }

            this._resizeDebounceID = setTimeout(() => {
                this._resizeDebounceID = null;
                this.$.sceneView._resize();
            }, 10);
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
            var dirty = this.undo.dirty();
            if ( dirty ) {
                var name = 'New Scene';
                var url = 'db://assets/New Scene.fire';
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

        // copy & paste

        _onCopy: function ( clipboardEvent ) {
            //var copyingNode = this.$.sceneView.contains(document.activeElement);
            if (this._copyingIds) {
                clipboardEvent.clipboardData.clearData();
                if (this._copyingIds && this._copyingIds.length > 0) {
                    var copyInfo = {
                        nodeIDs: this._copyingIds
                    };
                    clipboardEvent.clipboardData.setData('text/fireball', JSON.stringify(copyInfo));
                }
                clipboardEvent.stopPropagation();
                clipboardEvent.preventDefault();
                this._copyingIds = null;
            }
        },

        _onPaste: function ( clipboardEvent ) {
            //var copyingNode = this.$.sceneView.contains(document.activeElement);
            if (this._pastingId) {
                var data = clipboardEvent.clipboardData.getData('text/fireball');
                if (data) {
                    clipboardEvent.stopPropagation();
                    clipboardEvent.preventDefault();

                    var copyed = JSON.parse(data).nodeIDs;
                    var hash = copyed.join(', ');
                    if (detailsForClipboard.hash === hash) {
                        var parent;
                        if (this._pastingId) {
                            parent = cc.engine.getInstanceById(this._pastingId);
                        }
                        if (!parent) {
                            parent = cc.director.getScene();
                        }

                        var nodes = detailsForClipboard.data.nodes;
                        var node;
                        for (var id in nodes) {
                            node = cc.instantiate(nodes[id]);
                            node.parent = parent;
                        }

                        // select the last one
                        Editor.Selection.select('node', node.uuid);
                        return;
                    }
                }
                // clear mismatched data
                detailsForClipboard.hash = '';
                detailsForClipboard.data = null;

                this._pastingId = '';
            }
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
            // var type = event.detail.dragType;
            var x = event.detail.offsetX;
            var y = event.detail.offsetY;
            var sceneView = this.$.sceneView;

            var Async = require('async');

            Editor.Selection.clear('node');
            Async.each( uuids, ( uuid, done ) => {
                Async.waterfall([
                    next => {
                        Editor.createNode(uuid, next);
                    },

                    ( node, next ) => {
                        var nodeID;
                        if ( node ) {
                            nodeID = node.uuid;

                            node.setPosition(sceneView.pixelToScene( cc.v2(x,y) ));
                            node.parent = cc.director.getScene();
                        }

                        this.undo.recordCreateNode(nodeID);
                        this.undo.commit();

                        next ( null, nodeID );
                    },

                ], ( err, nodeID ) => {
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
        _designSizeChanged: function () {
            if ( this.profiles.local.save ) {
                this.profiles.local.save();
            }
        },

        // view events
        _onSceneViewReady: function () {
            this._viewReady = true;
            this.$.loader.hidden = true;
            this.undo.clear();

            // register engine events
            const EngineEvents = Editor.require('packages://scene/panel/scene-view/engine-events');
            EngineEvents.register(this.$.sceneView);

            Editor.sendToAll('scene:ready');

            console.timeEnd('scene:reloading');
        },

        _onSceneViewInitError: function (event) {
            var err = event.args[0];
            Editor.failed('Failed to init scene: %s', err.stack);

            this.$.loader.hidden = true;
        },

        _saveScene: function ( cb ) {
            var sceneAsset = new cc.SceneAsset();
            sceneAsset.scene = cc.director.getScene();

            // NOTE: we stash scene because we want to save and reload the connected browser
            Editor.stashScene(function () {
                // reload connected browser
                Editor.sendToCore('app:reload-on-device');
                Editor.sendToCore('scene:save-scene', Editor.serialize(sceneAsset));

                if ( cb ) {
                    cb ();
                }
            });
        },

        _loadScene ( uuid ) {
            this.$.loader.hidden = false;
            Editor.sendToAll('scene:reloading');
            this.$.sceneView.loadScene(uuid);
        },

        'panel:run': function ( argv ) {
            if ( !argv || !argv.uuid ) {
                return;
            }

            let res = this.confirmCloseScene();
            switch ( res ) {
                // save
                case 0:
                this._saveScene(() => {
                    this._loadScene(argv.uuid);
                });
                return;

                // cancel
                case 1:
                return;

                // don't save
                case 2:
                this._loadScene(argv.uuid);
                return;
            }
        },

        'editor:dragstart': function () {
            this.$.dropArea.hidden = false;
        },

        'editor:dragend': function () {
            this.$.dropArea.hidden = true;
        },

        'scene:is-ready': function ( panelID ) {
            if ( this._viewReady ) {
                Editor.sendToPanel( panelID, 'scene:ready', this._viewReady );
            }
        },

        'scene:new-scene': function () {
            this.$.loader.hidden = false;
            Editor.sendToAll('scene:reloading');
            this.$.sceneView.newScene();
        },

        'scene:play-on-device': function () {
            Editor.stashScene( function () {
                Editor.sendToCore( 'app:play-on-device' );
            });
        },

        'scene:reload-on-device': function () {
            Editor.stashScene( function () {
                Editor.sendToCore( 'app:reload-on-device' );
            });
        },

        'scene:query-hierarchy': function ( queryID ) {
            if (!cc.engine.isInitialized) {
                return Editor.sendToWindows( 'scene:reply-query-hierarchy', queryID, '', [] );
            }
            var nodes = Editor.getHierarchyDump();
            var sceneUuid = cc.director.getScene().uuid;
            Editor.sendToWindows( 'scene:reply-query-hierarchy', queryID, sceneUuid, nodes );
        },

        'scene:query-node': function ( queryID, nodeID ) {
            var node = cc.engine.getInstanceById(nodeID);
            var dump = Editor.getNodeDump(node);
            dump = JSON.stringify(dump);    // 改成发送字符串，以免字典的顺序发生改变
            Editor.sendToWindows( 'scene:reply-query-node', queryID, dump );
        },

        'scene:query-node-info': function ( sessionID, nodeID ) {
            var node = cc.engine.getInstanceById(nodeID);

            Editor.sendToWindows( 'scene:query-node-info:reply', sessionID, {
                name: node ? node.name : '',
                type: cc.js.getClassName(node),
                missed: node === null,
            });
        },

        'scene:query-node-functions': function ( sessionID, nodeID ) {
            var node = cc.engine.getInstanceById(nodeID);
            var dump = Editor.getNodeFunctions(node);

            Editor.sendToWindows('scene:query-node-functions:reply', sessionID, dump);
        },

        'scene:query-animation-node': function (queryID, nodeID, childName) {
            var node = cc.engine.getInstanceById(nodeID);
            var dump = Editor.getAnimationNodeDump(node, childName);
            Editor.sendToWindows('scene:reply-animation-node', queryID, dump );
        },

        'scene:is-child-class-of': function ( sessionID, className, baseClassName ) {
            let sub = cc.js._getClassById(className);
            let base = cc.js._getClassById(baseClassName);
            let result = cc.isChildClassOf(sub, base);
            Editor.sendToWindows('scene:is-child-class-of:reply', sessionID, result);
        },

        'scene:new-property': function ( info ) {
            var nodeOrComp = cc.engine.getInstanceById(info.id);
            if (nodeOrComp) {
                try {
                    var id = info.type;
                    var ctor;
                    if (cc.js._isTempClassId(id)) {
                        ctor = cc.js._getClassById(id);
                    }
                    else {
                        ctor = cc.js.getClassByName(id);
                    }
                    if ( ctor ) {
                        var obj;
                        try {
                            obj = new ctor();
                        }
                        catch (e) {
                            Editor.error('Can not create new info.type directly.\nInner message: ' + e.stack);
                            return;
                        }
                        Editor.setDeepPropertyByPath(nodeOrComp, info.path, obj, info.type);
                        cc.engine.repaintInEditMode();
                    }
                }
                catch (e) {
                    Editor.warn('Failed to new property %s of %s to %s, ' + e.message,
                                info.path, nodeOrComp.name, info.value);
                }
            }
        },

        'scene:set-property': function ( info ) {
            var nodeOrComp = cc.engine.getInstanceById(info.id);
            if (nodeOrComp) {
                // 兼容旧版 Inspector
                if (info.mixinType) {
                    nodeOrComp = nodeOrComp.getComponent(info.mixinType);
                    if (!cc.isValid(nodeOrComp)) {
                        return;
                    }
                }
                //
                try {
                    this.undo.recordObject(info.id);
                    Editor.setPropertyByPath(nodeOrComp, info.path, info.value, info.type);
                    cc.engine.repaintInEditMode();
                }
                catch (e) {
                    Editor.warn('Failed to set property %s of %s to %s, ' + e.message,
                                info.path, nodeOrComp.name, info.value);
                }
            }
        },

        'scene:add-component': function ( nodeID, compID ) {
            if ( arguments.length === 1 ) {
                compID = nodeID;
                nodeID = Editor.Selection.curActivate('node');
            }

            if ( !nodeID ) {
                Editor.warn('Please select a node first');
                return;
            }

            if ( !compID ) {
                Editor.error('Component ID is undefined');
                return;
            }

            if (compID) {
                var isScript = Editor.isUuid(compID);
                var compCtor = cc.js._getClassById(compID);
                if (!compCtor) {
                    if (isScript) {
                        return Editor.error(`Can not find cc.Component in the script ${compID}.`);
                    }
                    else {
                        return Editor.error(`Failed to get component ${compID}`);
                    }
                }
                //
                var comp;
                var node = cc.engine.getInstanceById(nodeID);
                if (node) {
                    comp = node.addComponent(compCtor);
                    this.undo.recordAddComponent( nodeID, comp, node._components.indexOf(comp) );
                    this.undo.commit();
                } else {
                    Editor.error( `Can not find node ${nodeID}` );
                }
            }
        },

        'scene:remove-component': function ( nodeID, compID ) {
            var comp = cc.engine.getInstanceById(compID);
            if (comp) {
                var node = cc.engine.getInstanceById(nodeID);
                this.undo.recordRemoveComponent( nodeID, comp, node._components.indexOf(comp) );
                this.undo.commit();

                comp.destroy();
            }
        },

        'scene:create-nodes-by-uuids': function ( uuids, parentID ) {
            var Async = require('async');
            var self = this;

            var parentNode;
            if ( parentID ) {
                parentNode = cc.engine.getInstanceById(parentID);
            }
            if ( !parentNode ) {
                parentNode = cc.director.getScene();
            }

            Editor.Selection.unselect(
                'node',
                Editor.Selection.curSelection('node'),
                false
            );

            //
            Async.each( uuids, ( uuid, done ) => {
                Async.waterfall([
                    next => {
                        Editor.createNode(uuid, next);
                    },

                    ( node, next ) => {
                        var nodeID;
                        if ( node ) {
                            nodeID = node.uuid;

                            if ( parentNode ) {
                                node.parent = parentNode;
                            }
                            var centerX = cc.game.canvas.width / 2;
                            var centerY = cc.game.canvas.height / 2;
                            node.scenePosition = self.$.sceneView.pixelToScene( cc.v2(centerX, centerY) );

                            this.undo.recordCreateNode(nodeID);
                        }

                        next ( null, nodeID );
                    }

                ], ( err, nodeID ) => {
                    if ( err ) {
                        Editor.failed( 'Failed to drop asset %s, message: %s', uuid, err.stack || err.errorMessage );
                        return;
                    }

                    if ( nodeID ) {
                        Editor.Selection.select('node', nodeID, false, false );
                    }
                    cc.engine.repaintInEditMode();
                    done();
                });
            }, err => {
                this.undo.commit();

                if ( err ) {
                    Editor.Selection.cancel();
                    return;
                }
                Editor.Selection.confirm();
            });
        },

        'scene:create-node-by-classid': function ( name, classID, referenceID, position ) {
            var parent;

            if ( referenceID ) {
                parent = cc.engine.getInstanceById(referenceID);
                if ( position === 'sibling' ) {
                    parent = parent.parent;
                }
            }
            if ( !parent ) {
                parent = cc.director.getScene();
            }

            var node = new cc.ENode(name);
            node.parent = parent;

            var centerX = cc.game.canvas.width / 2;
            var centerY = cc.game.canvas.height / 2;
            node.scenePosition = this.$.sceneView.pixelToScene( cc.v2(centerX, centerY) );

            cc.engine.repaintInEditMode();
            Editor.Selection.select('node', node.uuid, true, true );

            if (classID) {
                // add component
                var Component = cc.js._getClassById(classID);
                if (Component) {
                    node.addComponent(Component);
                }
                else {
                    Editor.error('Unknown node to create:', classID);
                }
            }

            this.undo.recordCreateNode(node.uuid);
            this.undo.commit();
        },

        'scene:create-node-by-prefab': function ( name, prefabID, referenceID, position ) {
            var parent;

            Editor.createNode(prefabID, (err, node) => {
                if ( err ) {
                    Editor.error(err);
                    return;
                }

                Editor.PrefabUtils.unlinkPrefab(node);

                node.name = name;

                if ( referenceID ) {
                    parent = cc.engine.getInstanceById(referenceID);
                    if ( position === 'sibling' ) {
                        parent = parent.parent;
                    }
                }
                if ( !parent ) {
                    parent = cc.director.getScene();
                }

                node.parent = parent;

                var centerX = cc.game.canvas.width / 2;
                var centerY = cc.game.canvas.height / 2;
                node.scenePosition = this.$.sceneView.pixelToScene( cc.v2(centerX, centerY) );

                cc.engine.repaintInEditMode();
                Editor.Selection.select('node', node.uuid, true, true );

                this.undo.recordCreateNode(node.uuid);
                this.undo.commit();
            });
        },

        'scene:move-nodes': function ( ids, parentID, nextSiblingId ) {
            function getSiblingIndex (node) {
                return node._parent._children.indexOf(node);
            }

            var parent;

            if (parentID)
                parent = cc.engine.getInstanceById(parentID);
            else
                parent = cc.director.getScene();

            var next = nextSiblingId ? cc.engine.getInstanceById(nextSiblingId) : null;
            var nextIndex = next ? getSiblingIndex(next) : -1;

            for (var i = 0; i < ids.length; i++) {
                var id = ids[i];
                var node = cc.engine.getInstanceById(id);
                if (node && (!parent || !parent.isChildOf(node))) {
                    this.undo.recordMoveNode(id);

                    if (node.parent !== parent) {
                        // keep world transform not changed
                        var worldPos = node.worldPosition;
                        var worldRotation = node.worldRotation;
                        var lossyScale = node.worldScale;

                        node.parent = parent;

                        // restore world transform
                        node.worldPosition = worldPos;
                        node.worldRotation = worldRotation;
                        if (parent) {
                            lossyScale.x /= parent.worldScale.x;
                            lossyScale.y /= parent.worldScale.y;
                            node.scale = lossyScale;
                        }
                        else {
                            node.scale = lossyScale;
                        }

                        if (next) {
                            node.setSiblingIndex(nextIndex);
                            ++nextIndex;
                        }
                    }
                    else if (next) {
                        var lastIndex = getSiblingIndex(node);
                        var newIndex = nextIndex;
                        if (newIndex > lastIndex) {
                            --newIndex;
                        }
                        if (newIndex !== lastIndex) {
                            node.setSiblingIndex(newIndex);
                            if (lastIndex > newIndex) {
                                ++nextIndex;
                            }
                            else {
                                --nextIndex;
                            }
                        }
                    }
                    else {
                        // move to bottom
                        node.setSiblingIndex(-1);
                    }
                }
            }

            this.undo.commit();
        },

        'scene:delete-nodes': function ( ids ) {
            this.$.sceneView.delete(ids);
        },

        'scene:copy-nodes': function (ids) {
            var nodes = ids.map(x => cc.engine.getInstanceById(x)).filter(x => !!x);
            nodes = getTopLevelNodes(nodes).filter(x => !!x);
            this._copyingIds = nodes.map(x => x.uuid);

            var copyData = {
                sceneId: cc.director.getScene().uuid,
                nodes: {}
            };

            nodes.forEach(x => {
                // save current values
                copyData.nodes[x.uuid] = cc.instantiate(x);
            });

            // save real data to cache
            detailsForClipboard.hash = this._copyingIds.join(', ');
            detailsForClipboard.data = copyData;

            // Emit copy event on this web contents,
            // so that we can access to the clipboard without pressing [Command + C]
            require('remote').getCurrentWebContents().copy();
        },

        'scene:paste-nodes': function (parentId) {
            if (!parentId) {
                parentId = cc.director.getScene().uuid;
            }
            this._pastingId = parentId;

            // Emit paste event on this web contents
            // so that we can access to the clipboard without pressing [Command + P]
            require('remote').getCurrentWebContents().paste();
        },

        'scene:duplicate-nodes': function ( ids ) {
            var nodes = [];
            for ( var i = 0; i < ids.length; ++i ) {
                var node = cc.engine.getInstanceById(ids[i]);
                if (node) {
                    nodes.push(node);
                }
            }

            var results = getTopLevelNodes(nodes);

            // duplicate results
            var clones = [];
            results.forEach(function ( node ) {
                var clone = cc.instantiate(node);
                clone.parent = node.parent;

                clones.push(clone.uuid);
            });

            // select the last one
            Editor.Selection.select('node', clones);
        },

        'scene:stash-and-reload': function () {
            Editor.stashScene(function () {
                this.reload();
            }.bind(this));
        },

        'scene:soft-reload': function ( compiled ) {
            Editor.softReload(compiled);
        },

        'scene:create-prefab': function ( id, baseUrl ) {
            var node = cc.engine.getInstanceById(id);
            var prefab = Editor.PrefabUtils.createPrefabFrom(node);
            var json = Editor.serialize(prefab);
            var url = Url.join(baseUrl, node.name + '.prefab');

            Editor.sendRequestToCore('scene:create-prefab', url, json, function (err, uuid) {
                if (!err) {
                    Editor.PrefabUtils.savePrefabUuid(node, uuid);
                }
            });
        },

        'scene:apply-prefab': function ( id ) {
            var node = cc.engine.getInstanceById(id);
            if (!node || !node._prefab) {
                return;
            }

            node = node._prefab.root;
            var uuid = node._prefab.asset._uuid;
            var prefab = Editor.PrefabUtils.createPrefabFrom(node);
            Editor.PrefabUtils.savePrefabUuid(node, uuid);
            var json = Editor.serialize(prefab);

            Editor.sendToCore('scene:apply-prefab', uuid, json);
        },

        'scene:revert-prefab': function ( id ) {
            var node = cc.engine.getInstanceById(id);
            if (!node || !node._prefab) {
                return;
            }

            node = node._prefab.root;
            Editor.PrefabUtils.revertPrefab(node);
        },

        'scene:stash-and-save': function () {
            this._saveScene();
        },

        'scene:saved': function () {
            this.undo.save();
        },

        'scene:undo': function () {
            this.undo.undo();
        },

        'scene:redo': function () {
            this.undo.redo();
        },

        'scene:undo-record': function ( id, desc ) {
            this.undo.recordObject( id, desc );
        },

        'scene:undo-commit': function () {
            this.undo.commit();
        },

        'scene:undo-cancel': function () {
            this.undo.cancel();
        },

        'scene:animation-state-changed': function (info) {
            var node = cc.engine.getInstanceById(info.nodeId);
            var comp = node.getComponent(cc.AnimationComponent);
            var aniState = comp.getAnimationState(info.clip);

            var state = info.state;
            var clipName = info.clip;

            if (state === 'play') {
                comp.play(clipName);
                cc.engine.animatingInEditMode = true;
            }
            else if (state === 'pause') {
                if (aniState.isPlaying) {
                    comp.pause(clipName);
                }
                cc.engine.animatingInEditMode = false;
            }
            else if (state === 'stop') {
                comp.stop(clipName);
                cc.engine.animatingInEditMode = false;
            }
        },

        'scene:query-animation-time': function (sessionID, info) {
            var node = cc.engine.getInstanceById(info.nodeId);
            var comp = node.getComponent(cc.AnimationComponent);
            var aniState = comp.getAnimationState(info.clip);

            var wrappedInfo = aniState.getWrappedInfo(aniState.time);

            Editor.sendToWindows( 'scene:reply-animation-time', sessionID, {
                clip: info.clip,
                time: wrappedInfo.time,
                isPlaying: aniState.isPlaying
            });
        },

        'scene:animation-time-changed': function (info) {
            var node = cc.engine.getInstanceById(info.nodeId);
            var comp = node.getComponent(cc.AnimationComponent);
            var aniState = comp.getAnimationState(info.clip);

            var clipName = info.clip;

            if (!aniState.isPlaying) {
                comp.play(clipName);
                comp.pause(clipName);
            }

            var time = info.time;
            if (time > aniState.duration) time = aniState.duration;

            comp.setCurrentTime(time, clipName);
            comp.sample();

            cc.engine.repaintInEditMode();
        },

        'scene:animation-clip-changed': function (info) {
            var node = cc.engine.getInstanceById(info.nodeId);
            var comp = node.getComponent(cc.AnimationComponent);

            cc.AssetLibrary.loadJson(info.data, function (err, clip) {
                if (err) {
                    Editor.error(err);
                    return;
                }

                comp._updateClip(clip);
                cc.engine.repaintInEditMode();
            });
        },

        'selection:selected': function ( type, ids ) {
            if ( type !== 'node' ) {
                return;
            }
            this.$.sceneView.select(ids);
        },

        'selection:unselected': function ( type, ids ) {
            if ( type !== 'node' ) {
                return;
            }
            this.$.sceneView.unselect(ids);
        },

        'selection:activated': function ( type, id ) {
            if ( type !== 'node' || !id ) {
                return;
            }

            var node = cc.engine.getInstanceById(id);
            if (node) {
                var isAnimationNode = node.getComponent(cc.AnimationComponent);

                if (isAnimationNode) {
                    var dump = Editor.getAnimationNodeDump(node);
                    Editor.sendToWindows('scene:animation-node-activated', dump);
                }

                // Another Choose, select AnimationNode's child will also trigger scene:animation-node-activated

                // var animationNode = node;
                // var isAnimationNode = animationNode.getComponent(cc.AnimationComponent);;

                // while (animationNode && !(animationNode instanceof cc.EScene)) {
                //     isAnimationNode = animationNode.getComponent(cc.AnimationComponent);
                //     if (isAnimationNode) {
                //         var dump = Editor.getAnimationNodeDump(animationNode);
                //         Editor.sendToWindows('scene:animation-node-activated', dump);
                //         break;
                //     }

                //     animationNode = animationNode.parent;
                // }
            }

            this.$.sceneView.activate(id);
        },

        'selection:deactivated': function ( type, id ) {
            if ( type !== 'node' ) {
                return;
            }

            this.$.sceneView.deactivate(id);
        },

        'selection:hoverin': function ( type, id ) {
            if ( type !== 'node' ) {
                return;
            }
            this.$.sceneView.hoverin(id);
        },

        'selection:hoverout': function ( type, id ) {
            if ( type !== 'node' ) {
                return;
            }
            this.$.sceneView.hoverout(id);
        },
    });
})();
