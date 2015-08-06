var Fs = require('fire-fs');
var Path = require('fire-path');
var Url = require('fire-url');

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

    'scene:open-by-uuid': function ( uuid ) {
        Editor.Panel.open('scene.panel', {
            uuid: uuid,
        });
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
                    type: meta['asset-type'],
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

    'scene:query-asset-info-by-uuid': function (reply, uuid) {
        var path = Editor.assetdb.uuidToFspath(uuid);
        if (!path) {
            return reply(null);
        }

        var Meta = Editor.require('app://asset-db/lib/meta');
        var metaObj = Meta.load(Editor.assetdb, path + '.meta');

        if ( metaObj && !metaObj.useRawfile() ) {
            // if imported, return imported asset url
            path = Editor.assetdb._uuidToImportPathNoExt(uuid);
            path += '.json';
        }

        //var url = Url.format({
        //    protocol: '',
        //    pathname: path,
        //    slashes: true,
        //});
        var url = path.replace(/\\/g, '/');

        reply({
            url: url,
            type: metaObj['asset-type'],
        });
    }
};
