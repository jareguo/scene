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
                    var wrapper = Fire(node);
                    nodeID = wrapper.uuid;

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

Ipc.on('scene:create-nodes-by-uuids', function ( uuids, parentID ) {
    var parentNode;
    if ( parentID ) {
        parentNode = Fire.engine.getInstanceByIdN(parentID);
    }
    if ( !parentNode ) {
        parentNode = Fire.engine.getCurrentSceneN();
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
                    var wrapper = Fire(node);
                    nodeID = wrapper.uuid;

                    if ( parentNode ) {
                        wrapper.parent = Fire(parentNode);
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

Ipc.on('scene:create-node-by-classid', function ( name, classID, referenceID, position ) {
    var parentNode;

    if ( referenceID ) {
        parentNode = Fire.engine.getInstanceByIdN(referenceID);
        if ( position === 'sibling' ) {
            parentNode = Fire(parentNode).parentN;
        }
    }

    if ( !parentNode ) {
        parentNode = Fire.engine.getCurrentSceneN();
    }
    var Wrapper = Fire.JS._getClassById(classID);
    if (Wrapper) {
        var wrapper = new Wrapper();
        wrapper.createAndAttachNode();
        wrapper.parent = Fire(parentNode);
        wrapper.name = name;

        var center_x = Fire.engine.canvasSize.x/2;
        var center_y = Fire.engine.canvasSize.y/2;
        wrapper.scenePosition = window.sceneView.pixelToScene( Fire.v2(center_x, center_y) );

        Fire.engine.repaintInEditMode();
        Editor.Selection.select('node', wrapper.uuid, true, true );
    }
    else {
        Editor.error('Unknown node to create:', classID);
    }
});

Ipc.on('scene:query-hierarchy', function ( queryID ) {
    var nodes = Editor.getHierarchyDump();
    var sceneUuid = Fire.engine.getCurrentScene().uuid;
    Editor.sendToWindows( 'scene:reply-query-hierarchy', queryID, sceneUuid, nodes );
});


Ipc.on('scene:query-node', function ( queryID, nodeID ) {
    var node = Fire.engine.getInstanceByIdN(nodeID);
    var dump = Editor.getNodeDump(node);
    Editor.sendToWindows( 'scene:reply-query-node', queryID, dump );
});

Ipc.on('scene:query-node-info', function ( sessionID, nodeID ) {
    var nodeWrapper = Fire.engine.getInstanceById(nodeID);

    Editor.sendToWindows( 'scene:query-node-info:reply', sessionID, {
        name: nodeWrapper ? nodeWrapper.name : '',
        type: Fire.JS.getClassName(nodeWrapper),
        missed: nodeWrapper ? false : true,
    });
});

Ipc.on('scene:node-new-property', function ( info ) {
    var node = Fire.engine.getInstanceByIdN(info.id);
    if (node) {
        var objToSet = info.mixinType ? node : Fire(node);
        try {
            var id = info.type;
            var ctor;
            if (Fire.JS._isTempClassId(id)) {
                ctor = Fire.JS._getClassById(id);
            }
            else {
                ctor = Fire.JS.getClassByName(id);
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
                Editor.setDeepPropertyByPath(objToSet, info.path, obj, info.type);
                Fire.engine.repaintInEditMode();
            }
        }
        catch (e) {
            Editor.warn('Failed to new property %s of %s to %s, ' + e.message,
                info.path, Fire(node).name, info.value);
        }
    }
});

Ipc.on('scene:node-set-property', function ( info ) {
    var node = Fire.engine.getInstanceByIdN(info.id);
    if (node) {
        var objToSet = info.mixinType ? node : Fire(node);
        try {
            Editor.setDeepPropertyByPath(objToSet, info.path, info.value, info.type);
            Fire.engine.repaintInEditMode();
        }
        catch (e) {
            Editor.warn('Failed to set property %s of %s to %s, ' + e.message,
                info.path, Fire(node).name, info.value);
        }
    }
});

Ipc.on('scene:node-mixin', function ( id, uuid ) {
    if (uuid && Editor.isUuid(uuid)) {
        // check script
        var className = Editor.compressUuid(uuid);
        var classToMix = Fire.JS._getClassById(className);
        if (!classToMix) {
            return Editor.error('Can not find Behavior in the script "%s".', uuid);
        }
        //
        var node = Fire.engine.getInstanceByIdN(id);
        if (node) {
            Fire.mixin(node, classToMix);
        }
        else {
            Editor.error('Can not find node to mixin: %s', id);
        }
    }
    else {
        Editor.error('invalid script to mixin');
    }
});

Ipc.on('scene:node-unmixin', function ( id, className ) {
    var node = Fire.engine.getInstanceByIdN(id);
    if (node) {
        Fire.unMixin( node, className);
    }
});

Ipc.on('scene:move-nodes', function ( ids, parentID, nextSiblingId ) {
    var parent;

    if (parentID)
        parent = Fire.engine.getInstanceById(parentID);
    else
        parent = Fire.engine.getCurrentScene();

    var next = nextSiblingId ? Fire.engine.getInstanceById(nextSiblingId) : null;
    var nextIndex = next ? next.getSiblingIndex() : -1;

    for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var wrapper = Fire.engine.getInstanceById(id);
        if (wrapper && (!parent || !parent.isChildOf(wrapper))) {
            if (wrapper.parent !== parent) {
                // keep world transform not changed
                var worldPos = wrapper.worldPosition;
                var worldRotation = wrapper.worldRotation;
                var lossyScale = wrapper.worldScale;

                wrapper.parent = parent;

                // restore world transform
                wrapper.worldPosition = worldPos;
                wrapper.worldRotation = worldRotation;
                if (parent) {
                    wrapper.scale = lossyScale.divSelf(parent.worldScale);
                }
                else {
                    wrapper.scale = lossyScale;
                }

                if (next) {
                    wrapper.setSiblingIndex(nextIndex);
                    ++nextIndex;
                }
            }
            else if (next) {
                var lastIndex = wrapper.getSiblingIndex();
                var newIndex = nextIndex;
                if (newIndex > lastIndex) {
                    --newIndex;
                }
                if (newIndex !== lastIndex) {
                    wrapper.setSiblingIndex(newIndex);
                    if (lastIndex > newIndex) {
                        ++nextIndex;
                    }
                    else {
                        --nextIndex;
                    }
                }
            }
            else {
                wrapper.setAsLastSibling();
            }
        }
    }
});

Ipc.on('scene:delete-nodes', function ( ids ) {
    window.sceneView.delete(ids);
});

Ipc.on('scene:duplicate-nodes', function ( ids ) {
    var wrappers = [];
    for ( var i = 0; i < ids.length; ++i ) {
         var wrapper = Fire.engine.getInstanceById(ids[i]);
        if (wrapper) {
            wrappers.push(wrapper);
        }
    }

    // get top-level wrappers
    var results = Editor.Utils.arrayCmpFilter ( wrappers, function ( a, b ) {
        var parent;

        // a contains b
        parent = b.parent;
        while ( parent ) {
            if ( a === parent ) {
                return 1;
            }
            parent = parent.parent;
        }

        // b contains a
        parent = a.parent;
        while ( parent ) {
            if ( b === parent ) {
                return -1;
            }
            parent = parent.parent;
        }

        return 0;
    });


    // duplicate results
    var clones = [];
    results.forEach(function ( wrapper ) {
        var clone = Fire.instantiate(wrapper);
        clone.parent = wrapper.parent;

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
});

Ipc.on('scene:transform-tool-changed', function ( value ) {
    window.sceneView.$.gizmosView.transformTool = value;
    Fire.engine.repaintInEditMode();
});

Ipc.on('scene:coordinate-changed', function ( value ) {
    window.sceneView.$.gizmosView.coordinate = value;
    Fire.engine.repaintInEditMode();
});

Ipc.on('scene:pivot-changed', function ( value ) {
    window.sceneView.$.gizmosView.pivot = value;
    Fire.engine.repaintInEditMode();
});

Ipc.on('scene:design-size-changed', function ( w, h ) {
    window.sceneView.$.gizmosView.designSize = [w, h];
    Fire.engine.repaintInEditMode();
});
