
module.exports = {
    'panel:run': function ( argv ) {
        if ( !argv || !argv.uuid )
            return;

        this.$.loader.hidden = false;
        Editor.sendToAll('scene:reloading');

        this.$.sceneView.loadScene(argv.uuid);
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

    'scene:save-scene-from-page': function ( url ) {
        var sceneAsset = new cc.SceneAsset();
        sceneAsset.scene = cc.director.getScene();

        // NOTE: we stash scene because we want to save and reload the connected browser
        Editor.stashScene(function () {
            // reload connected browser
            Editor.sendToCore('app:reload-on-device');

            //
            Editor.sendToCore( 'scene:save-scene', url, Editor.serialize(sceneAsset) );
        });
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
            missed: node ? false : true,
        });
    },

    'scene:query-animation-node': function (queryID, nodeID, childName) {
        var node = cc.engine.getInstanceById(nodeID);
        var dump = Editor.getAnimationNodeDump(node, childName);
        Editor.sendToWindows( 'scene:reply-animation-node', queryID, dump );
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
                Editor.setPropertyByPath(nodeOrComp, info.path, info.value, info.type);
                cc.engine.repaintInEditMode();
            }
            catch (e) {
                Editor.warn('Failed to set property %s of %s to %s, ' + e.message,
                    info.path, nodeOrComp.name, info.value);
            }
        }
    },

    'scene:component-add': function ( id, compId ) {
        if (compId) {
            var isScript = Editor.isUuid(compId);
            if (isScript) {
                compId = Editor.compressUuid(compId);
            }
            var Comp = cc.js._getClassById(compId);
            if (!Comp) {
                if (isScript) {
                    return Editor.error('Can not find cc.Component in the script "%s".', compId);
                }
                else {
                    return Editor.error('Failed to get component "%s".', compId);
                }
            }
            //
            var node = cc.engine.getInstanceById(id);
            if (node) {
                node.addComponent(Comp);
            }
            else {
                Editor.error('Can not find node ' + id);
            }
        }
        else {
            Editor.error('invalid compId to add component');
        }
    },

    'scene:component-remove': function ( id, uuid ) {
        var comp = cc.engine.getInstanceById(uuid);
        if (comp) {
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
        Async.each( uuids, function ( uuid, done ) {
            Async.waterfall([
                function ( next ) {
                    Editor.createNode(uuid, next);
                },

                function ( node, next ) {
                    var nodeID;
                    if ( node ) {
                        nodeID = node.uuid;

                        if ( parentNode ) {
                            node.parent = parentNode;
                        }
                        var center_x = cc.game.canvas.width / 2;
                        var center_y = cc.game.canvas.height / 2;
                        node.scenePosition = self.$.sceneView.pixelToScene( cc.v2(center_x, center_y) );
                    }

                    next ( null, nodeID );
                }

            ], function ( err, nodeID ) {
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
        }, function ( err ) {
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

        var center_x = cc.game.canvas.width / 2;
        var center_y = cc.game.canvas.height / 2;
        node.scenePosition = this.$.sceneView.pixelToScene( cc.v2(center_x, center_y) );

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
    },

    'scene:delete-nodes': function ( ids ) {
        this.$.sceneView.delete(ids);
    },

    'scene:duplicate-nodes': function ( ids ) {
        var nodes = [];
        for ( var i = 0; i < ids.length; ++i ) {
             var node = cc.engine.getInstanceById(ids[i]);
            if (node) {
                nodes.push(node);
            }
        }

        // get top-level wrappers
        var results = Editor.Utils.arrayCmpFilter ( nodes, function ( a, b ) {
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

    'scene:create-prefab': function ( id, url ) {
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

    'selection:context': function ( type, id ) {
    },

    'selection:changed': function ( type ) {
    },

    'scene:animation-state-changed': function (info) {
        var node = cc.engine.getInstanceById(info.nodeId);
        var comp = node.getComponent(cc.AnimationComponent);
        var aniState = comp.getAnimationState(info.clip);

        var state = info.state;
        var clipName = info.clip

        if (state === 'play') {
            comp.play(clipName);
            cc.engine.animatingInEditMode = true;
        }
        else if (state === 'pause') {
            comp.pause(clipName);
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

        Editor.sendToWindows( 'scene:reply-animation-time', sessionID, {
            clip: info.clip,
            time: aniState.time
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

        comp.setCurrentTime(info.time, clipName);
        comp.sample();

        cc.engine.repaintInEditMode();
    },

    'scene:animation-clip-changed': function (info) {
        var node = cc.engine.getInstanceById(info.nodeId);
        var comp = node.getComponent(cc.AnimationComponent);

        var details = new cc.deserialize.Details();
        var clip = cc.deserialize(info.data, details);

        comp._updateClip(clip);

        cc.engine.repaintInEditMode();
    }

};
