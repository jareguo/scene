var Ipc = require('ipc');
var Async = require('async');

Ipc.on('scene:play', function () {
    Editor.playScene(function (err) {
        if (err) {
            Editor.error(err);
        }
        else {
            Ipc.sendToHost('scene:played');
        }
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

                next ();
            },

            function ( node, next ) {
                // var mousePos = new Fire.Vec2(x, y);
                // // var worldMousePos = this.renderContext.camera.screenToWorld(mousePos);
                // var worldMousePos = mousePos;
                // node.worldPosition = worldMousePos;
                node.x = x;
                node.y = cc._canvas.height-y;
                Fire.Engine.scene.addChild( node );

                // TODO: Editor.Selection.select( 'node', ent.id, true, true );
                next ();
            },

        ], function ( err ) {
            if ( err ) {
                Editor.failed( 'Failed to drop asset %s, message: %s', uuid, err );
                return;
            }
        });
    });
});
