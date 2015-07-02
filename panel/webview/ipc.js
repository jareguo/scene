var Ipc = require('ipc');
var Async = require('async');

Ipc.on('scene:play', function () {
    Editor.playScene(function (err) {
        if (err) {
            Ipc.sendToHost('scene:play-error', err);
            return;
        }

        Ipc.sendToHost('scene:playing');
    });
});

Ipc.on('scene:drop', function ( uuids, type, x, y ) {
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
                if ( node ) {
                    // var mousePos = new Fire.Vec2(x, y);
                    // // var worldMousePos = this.renderContext.camera.screenToWorld(mousePos);
                    // var worldMousePos = mousePos;
                    // node.worldPosition = worldMousePos;

                    var fireNode = Fire.node(node);
                    fireNode.position = Fire.v2( x, Fire.engine.canvasSize.y-y );
                    fireNode.parent = Fire.engine.getCurrentScene();

                    // TODO: Editor.Selection.select( 'node', ent.id, true, true );
                }

                next ();
            },

        ], function ( err ) {
            if ( err ) {
                Editor.failed( 'Failed to drop asset %s, message: %s', uuid, err.stack );
                return;
            }
        });
    });
});

Ipc.on('scene:query-hierarchy', function () {
    var nodes = Fire.takeHierarchySnapshot();
    Editor.sendToWindows( 'scene:reply-query-hierarchy', nodes );
});


Ipc.on('scene:query-node', function ( id ) {
    var node = Fire.engine.getInstanceById(id);
    var dump = Editor.getNodeDump(node);
    Editor.sendToWindows( 'scene:reply-query-node', dump );
});
