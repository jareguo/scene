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
            Editor.assetdb.save( url, json, function ( err, meta ) {
                if ( err ) {
                    Editor.assetdb.error('Failed to save scene %s', url, err.stack);
                    return;
                }

                Editor.currentSceneUuid = meta.uuid;
                _updateTitile();

                Editor.sendToAll( 'asset-db:asset-changed', {
                    type: meta['meta-type'],
                    uuid: meta.uuid,
                });
            });
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

                //
                Editor.sendToAll( 'asset-db:assets-created', results );
            });
        }
    },
};
