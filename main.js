var Fs = require('fire-fs');
var Path = require('fire-path');

function _updateTitile () {
    var url = Editor.assetdb.uuidToUrl(Editor.currentSceneUuid);
    if ( !url ) {
        url = 'Untitled';
    }
    Editor.mainWindow.nativeWin.setTitle( 'Fireball Editor - ' + url );
}

module.exports = {
    load: function () {
    },

    unload: function () {
    },

    'scene:open': function () {
        Editor.Panel.open('scene.panel');
    },

    'scene:ready': function () {
        _updateTitile();
    },

    'scene:save-scene': function (url, json) {
        var fspath = Editor.assetdb._fspath(url);
        if ( Fs.existsSync(fspath) ) {
            Editor.assetdb.save( url, json );
        }
        else {
            Editor.assetdb.create( url, json, function ( err, results ) {
                if ( err ) {
                    Editor.assetdb.error('Failed to create asset %s, messages: %s',
                                         url, err.stack);
                                         return;
                }

                Editor.currentSceneUuid = results[0].uuid;
                _updateTitile();

                results = results.map( function(result) {
                    var parentPath = Path.dirname(result.path);
                    var mountID = Editor.assetdb._mountIDByPath(parentPath);
                    var parentID = mountID ? mountID : Editor.assetdb.fspathToUuid(parentPath);

                    return {
                        name: Path.basenameNoExt(result.path),
                        extname: Path.extname(result.path),
                        uuid: result.uuid,
                        type: result.type,
                        parentUuid: parentID,
                    };
                });

                //
                Editor.sendToAll( 'asset-db:assets-created', results );
            });
        }
    },
};
