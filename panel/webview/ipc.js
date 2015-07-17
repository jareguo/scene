var Ipc = require('ipc');
var Async = require('async');

Ipc.on('scene:ipc-messages', function ( ipcList ) {
    for ( var i = 0; i < ipcList.length; ++i ) {
        Ipc.emit.apply( Ipc, ipcList[i] );
    }
});

Ipc.on('scene:new-scene', function () {
    window.sceneView.newScene();
});

Ipc.on('scene:save-scene-from-page', function ( url ) {
    var sceneAsset = new Fire.Scene();
    sceneAsset.scene = Fire.engine.getCurrentScene();

    Editor.sendToCore( 'scene:save-scene', url, Editor.serialize(sceneAsset) );
});

Ipc.on('scene:open-scene-by-uuid', function ( uuid ) {
    window.sceneView.loadScene(uuid);
});

Ipc.on('scene:play', function () {
    window.sceneView.play();
});

Ipc.on('scene:drop', function ( uuids, type, x, y ) {
    Editor.Selection.clear('node');

    Async.each( uuids, function ( uuid, done ) {
        Async.waterfall([
            function ( next ) {
                Fire.AssetLibrary.loadAsset(uuid, next);
            },

            function ( asset, next ) {
                if ( asset && asset.createNode ) {
                    asset.createNode( next );
                    return;
                }

                next ( null, null );
            },

            function ( node, next ) {
                var nodeID;
                if ( node ) {
                    var wrapper = Fire.node(node);
                    nodeID = wrapper.id;

                    wrapper.position = window.sceneView.pixelToScene( Fire.v2(x,y) );
                    wrapper.parent = Fire.engine.getCurrentScene();
                }

                next ( null, nodeID );
            },

        ], function ( err, nodeID ) {
            if ( err ) {
                Editor.failed( 'Failed to drop asset %s, message: %s', uuid, err.stack );
                return;
            }

            if ( nodeID ) {
                Editor.Selection.select('node', nodeID, false, true );
            }
            Fire.engine.repaintInEditMode();
            done();
        });
    });
});

Ipc.on('scene:create-assets', function ( uuids, parentID ) {
    var parentNode;
    if ( parentID ) {
        parentNode = Fire.engine.getRuntimeInstanceById(parentID);
    }
    if ( !parentNode ) {
        parentNode = Fire.engine.getCurrentRuntimeScene();
    }

    Editor.Selection.clear('node');

    //
    Async.each( uuids, function ( uuid, done ) {
        Async.waterfall([
            function ( next ) {
                Fire.AssetLibrary.loadAsset(uuid, next);
            },

            function ( asset, next ) {
                if ( asset && asset.createNode ) {
                    asset.createNode( next );
                    return;
                }

                next ( null, null );
            },

            function ( node, next ) {
                var nodeID;
                if ( node ) {
                    var wrapper = Fire.node(node);
                    nodeID = wrapper.id;

                    if ( parentNode ) {
                        wrapper.runtimeParent = parentNode;
                    }
                    var center_x = Fire.engine.canvasSize.x/2;
                    var center_y = Fire.engine.canvasSize.y/2;
                    wrapper.scenePosition = window.sceneView.pixelToScene( Fire.v2(center_x, center_y) );
                }

                next ( null, nodeID );
            },

        ], function ( err, nodeID ) {
            if ( err ) {
                Editor.failed( 'Failed to drop asset %s, message: %s', uuid, err.stack );
                return;
            }

            if ( nodeID ) {
                Editor.Selection.select('node', nodeID, false, true );
            }
            Fire.engine.repaintInEditMode();
            done();
        });
    });
});

Ipc.on('scene:create-new-node', function ( menuItem, parentID ) {
    var parentNode;
    if ( parentID ) {
        parentNode = Fire.engine.getRuntimeInstanceById(parentID);
    }
    if ( !parentNode ) {
        parentNode = Fire.engine.getCurrentRuntimeScene();
    }
    var wrapperID = menuItem.id;
    var Wrapper = Fire.JS._getClassById(wrapperID);
    if (Wrapper) {
        var wrapper = new Wrapper();
        wrapper.onAfterDeserialize();
        wrapper.runtimeParent = parentNode;

        var menuPath = menuItem.menuPath;
        wrapper.name = 'New ' + menuPath.split('/').slice(-1)[0];

        var center_x = Fire.engine.canvasSize.x/2;
        var center_y = Fire.engine.canvasSize.y/2;
        wrapper.scenePosition = window.sceneView.pixelToScene( Fire.v2(center_x, center_y) );

        Fire.engine.repaintInEditMode();
        Editor.Selection.select('node', wrapper.id, true, true );
    }
    else {
        Editor.error('Unknown node to create:', wrapperID);
    }
});

Ipc.on('scene:query-hierarchy', function ( queryID ) {
    var nodes = Fire.takeHierarchySnapshot();
    Editor.sendToWindows( 'scene:reply-query-hierarchy', queryID, nodes );
});


Ipc.on('scene:query-node', function ( queryID, nodeID ) {
    var node = Fire.engine.getRuntimeInstanceById(nodeID);
    var dump = Editor.getNodeDump(node);
    Editor.sendToWindows( 'scene:reply-query-node', queryID, dump );
});

Ipc.on('scene:node-set-property', function ( id, path, value, isMixin ) {
    var node = Fire.engine.getRuntimeInstanceById(id);
    if (node) {
        var objToSet = isMixin ? node : Fire.node(node);
        try {
            Editor.setDeepPropertyByPath(objToSet, path, value);
            Fire.engine.repaintInEditMode();
        }
        catch (e) {
            Editor.warn('Failed to set property %s of %s to %s, ' + e.message,
                path, Fire.node(node).name, value);
        }
    }
});

Ipc.on('scene:node-mixin', function ( id, uuid ) {
    var node = Fire.engine.getRuntimeInstanceById(id);
    if (node) {
        var className = Editor.compressUuid(uuid);
        var classToMix = Fire.JS._getClassById(className);
        if (classToMix) {
            Fire.mixin(node, classToMix);
        }
        else {
            Editor.error('Can not find %s to mixin', uuid);
        }
    }
});

Ipc.on('scene:node-unmixin', function ( id, className ) {
    var node = Fire.engine.getRuntimeInstanceById(id);
    if (node) {
        Fire.unMixin( node, className);
    }
});

Ipc.on('scene:move-nodes', function ( ids, parentID, nextSiblingId ) {
    var parent;

    if (parentID)
        parent = Fire.node(Fire.engine.getRuntimeInstanceById(parentID));
    else
        parent = Fire.engine.getCurrentScene();

    var next = nextSiblingId ? Fire.node(Fire.engine.getRuntimeInstanceById(nextSiblingId)) : null;
    var nextIndex = next ? next.getSiblingIndex() : -1;

    for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var node = Fire.node(Fire.engine.getRuntimeInstanceById(id));
        if (node && (!parent || !parent.isChildOf(node))) {
            if (node.parent !== parent) {
                // TODO: ask @jare
                // // keep world transform not changed
                // var worldPos = node.transform.worldPosition;
                // var worldRotation = node.transform.worldRotation;
                // var lossyScale = node.transform.worldScale;

                node.parent = parent;

                // TODO: ask @jare
                // // restore world transform
                // node.transform.worldPosition = worldPos;
                // node.transform.worldRotation = worldRotation;
                // if (parent) {
                //     node.transform.scale = lossyScale.divSelf(parent.transform.worldScale);
                // }
                // else {
                //     node.transform.scale = lossyScale;
                // }

                if (next) {
                    node.setSiblingIndex(nextIndex);
                    ++nextIndex;
                }
            }
            else if (next) {
                var lastIndex = node.getSiblingIndex();
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
                node.setAsLastSibling();
            }
        }
    }
});

Ipc.on('scene:delete-nodes', function ( ids ) {
    window.sceneView.delete(ids);
});

Ipc.on('scene:stash-and-reload', function () {
    Editor.stashScene(function () {
        Ipc.sendToHost('scene:ask-for-reload');
    });
});

Ipc.on('selection:activated', function ( type, id ) {
    if ( type !== 'node' || !id ) {
        return;
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
});

Ipc.on('scene:transform-tool-changed', function ( value ) {
    window.sceneView.$.gizmosView.transformTool = value;
});

Ipc.on('scene:coordinate-changed', function ( value ) {
    window.sceneView.$.gizmosView.coordinate = value;
});

Ipc.on('scene:pivot-changed', function ( value ) {
    window.sceneView.$.gizmosView.pivot = value;
});
