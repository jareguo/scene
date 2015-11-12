var Ipc = require('ipc');
var Async = require('async');
var Url = require('fire-url');

Ipc.on('scene:ipc-messages', function ( ipcList ) {
    for ( var i = 0; i < ipcList.length; ++i ) {
        Ipc.emit.apply( Ipc, ipcList[i] );
    }
});

Ipc.on('scene:new-scene', function () {
    window.sceneView.newScene();
});

Ipc.on('scene:save-scene-from-page', function ( url ) {
    var sceneAsset = new cc.SceneAsset();
    sceneAsset.scene = cc.director.getScene();

    // NOTE: we stash scene because we want to save and reload the connected browser
    Editor.stashScene(function () {
        // reload connected browser
        Editor.sendToCore('app:reload-on-device');

        //
        Editor.sendToCore( 'scene:save-scene', url, Editor.serialize(sceneAsset) );
    });
});

Ipc.on('scene:open-scene-by-uuid', function ( uuid ) {
    window.sceneView.loadScene(uuid);
});

Ipc.on('scene:play-on-device', function () {
    Editor.stashScene( function () {
        Editor.sendToCore( 'app:play-on-device' );
    });
});

Ipc.on('scene:reload-on-device', function () {
    Editor.stashScene( function () {
        Editor.sendToCore( 'app:reload-on-device' );
    });
});

Ipc.on('scene:drop', function ( uuids, type, x, y ) {
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

                    node.setPosition(window.sceneView.pixelToScene( cc.v2(x,y) ));
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
});

Ipc.on('scene:create-nodes-by-uuids', function ( uuids, parentID ) {
    var parentNode;
    if ( parentID ) {
        parentNode = cc.engine.getInstanceById(parentID);
    }
    if ( !parentNode ) {
        parentNode = cc.director.getScene();
    }

    Editor.Selection.clear('node');

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
                    node.scenePosition = window.sceneView.pixelToScene( cc.v2(center_x, center_y) );
                }

                next ( null, nodeID );
            }

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
});

Ipc.on('scene:create-node-by-classid', function ( name, classID, referenceID, position ) {
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
    node.scenePosition = window.sceneView.pixelToScene( cc.v2(center_x, center_y) );

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
});

Ipc.on('scene:query-hierarchy', function ( queryID ) {
    if (!cc.engine.isInitialized) {
        return Editor.sendToWindows( 'scene:reply-query-hierarchy', queryID, '', [] );
    }
    var nodes = Editor.getHierarchyDump();
    var sceneUuid = cc.director.getScene().uuid;
    Editor.sendToWindows( 'scene:reply-query-hierarchy', queryID, sceneUuid, nodes );
});

Ipc.on('scene:query-node', function ( queryID, nodeID ) {
    var node = cc.engine.getInstanceById(nodeID);
    var dump = Editor.getNodeDump(node);
    dump = JSON.stringify(dump);    // 改成发送字符串，以免字典的顺序发生改变
    Editor.sendToWindows( 'scene:reply-query-node', queryID, dump );
});

Ipc.on('scene:query-animation-node', function (queryID, nodeID, childName) {
    var node = cc.engine.getInstanceById(nodeID);
    var dump = Editor.getAnimationNodeDump(node, childName);
    Editor.sendToWindows( 'scene:reply-animation-node', queryID, dump );
});

Ipc.on('scene:query-node-info', function ( sessionID, nodeID ) {
    var node = cc.engine.getInstanceById(nodeID);

    Editor.sendToWindows( 'scene:query-node-info:reply', sessionID, {
        name: node ? node.name : '',
        type: cc.js.getClassName(node),
        missed: node ? false : true,
    });
});

Ipc.on('scene:new-property', function ( info ) {
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
});

Ipc.on('scene:set-property', function ( info ) {
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
});

Ipc.on('scene:component-add', function ( id, compId ) {
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
});

Ipc.on('scene:component-remove', function ( id, uuid ) {
    var comp = cc.engine.getInstanceById(uuid);
    if (comp) {
        comp.destroy();
    }
});

function getSiblingIndex (node) {
    return node._parent._children.indexOf(node);
}

Ipc.on('scene:move-nodes', function ( ids, parentID, nextSiblingId ) {
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
                    node.scale = lossyScale.divSelf(parent.worldScale);
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
});

Ipc.on('scene:delete-nodes', function ( ids ) {
    window.sceneView.delete(ids);
});

Ipc.on('scene:duplicate-nodes', function ( ids ) {
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
});

Ipc.on('scene:stash-and-reload', function () {
    Editor.stashScene(function () {
        Ipc.sendToHost('scene:ask-for-reload');
    });
});

Ipc.on('scene:soft-reload', function (compiled) {
    Editor.softReload(compiled);
});

Ipc.on('selection:activated', function ( type, id ) {
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

    window.sceneView.activate(id);
});

Ipc.on('selection:deactivated', function ( type, id ) {
    if ( type !== 'node' ) {
        return;
    }

    window.sceneView.deactivate(id);
});

Ipc.on('selection:selected', function ( type, ids ) {
    if ( type !== 'node' ) {
        return;
    }
    window.sceneView.select(ids);
});

Ipc.on('selection:unselected', function ( type, ids ) {
    if ( type !== 'node' ) {
        return;
    }
    window.sceneView.unselect(ids);
});

Ipc.on('selection:hoverin', function ( type, id ) {
    if ( type !== 'node' ) {
        return;
    }
    window.sceneView.hoverin(id);
});

Ipc.on('selection:hoverout', function ( type, id ) {
    if ( type !== 'node' ) {
        return;
    }
    window.sceneView.hoverout(id);
});

Ipc.on('scene:init-scene-view', function ( settings ) {
    window.sceneView.$.gizmosView.transformTool = settings.transformTool;
    window.sceneView.$.gizmosView.coordinate = settings.coordinate;
    window.sceneView.$.gizmosView.pivot = settings.pivot;
    window.sceneView.$.gizmosView.designSize = [settings.designWidth, settings.designHeight];
    cc.engine.setDesignResolutionSize(settings.designWidth, settings.designHeight);
});

Ipc.on('scene:transform-tool-changed', function ( value ) {
    window.sceneView.$.gizmosView.transformTool = value;
    cc.engine.repaintInEditMode();
});

Ipc.on('scene:coordinate-changed', function ( value ) {
    window.sceneView.$.gizmosView.coordinate = value;
    cc.engine.repaintInEditMode();
});

Ipc.on('scene:pivot-changed', function ( value ) {
    window.sceneView.$.gizmosView.pivot = value;
    cc.engine.repaintInEditMode();
});

Ipc.on('scene:design-size-changed', function ( w, h ) {
    window.sceneView.$.gizmosView.designSize = [w, h];
    cc.engine.setDesignResolutionSize(w, h);
    cc.engine.repaintInEditMode();
});

Ipc.on('scene:create-prefab', function ( id, baseUrl ) {
    var node = cc.engine.getInstanceById(id);
    var prefab = Editor.PrefabUtils.createPrefabFrom(node);
    var json = Editor.serialize(prefab);
    var url = Url.join(baseUrl, node.name + '.prefab');

    Editor.sendRequestToCore('scene:create-prefab', url, json, function (err, uuid) {
        if (!err) {
            Editor.PrefabUtils.savePrefabUuid(node, uuid);
        }
    });
});

Ipc.on('scene:apply-prefab', function ( id ) {
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
});

Ipc.on('scene:revert-prefab', function ( id ) {
    var node = cc.engine.getInstanceById(id);
    if (!node || !node._prefab) {
        return;
    }

    node = node._prefab.root;
    Editor.PrefabUtils.revertPrefab(node);
});

