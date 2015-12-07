'use strict';

const Fs = require('fire-fs');
const Path = require('fire-path');
const Dialog = require('dialog');

function _updateTitile (dirty) {
    let url = Editor.assetdb.uuidToUrl(Editor.currentSceneUuid);
    if ( !url ) {
        url = 'Untitled';
    }

    let dirtyMark = dirty ? '*' : '';
    Editor.mainWindow.nativeWin.setTitle(
      `Fireball Editor - ${url}${dirtyMark}`
    );
}

function _showSaveDialog () {
    let rootPath = Editor.assetdb._fspath('db://assets/');
    let savePath = Dialog.showSaveDialog( Editor.mainWindow.nativeWin, {
        title: 'Save Scene',
        defaultPath: rootPath,
        filters: [
            { name: 'Scenes', extensions: ['fire'] },
        ],
    } );

    if ( savePath ) {
        if ( Path.contains( rootPath, savePath ) ) {
            return 'db://assets/' + Path.relative( rootPath, savePath );
        }

        Dialog.showMessageBox ( Editor.mainWindow.nativeWin, {
            type: 'warning',
            buttons: ['OK'],
            title: 'Warning',
            message: 'Warning: please save the scene in the assets folder.',
            detail: 'The scene needs to be saved inside the assets folder of your project.',
        });

        // try to popup the dailog for user to save the scene
        return _showSaveDialog();
    }
}

module.exports = {
    load () {
    },

    unload () {
    },

    'scene:open' () {
        Editor.Panel.open('scene.panel');
    },

    'scene:open-by-uuid' ( uuid ) {
        Editor.Panel.open('scene.panel', {
            uuid: uuid,
        });
    },

    'scene:ready' () {
        _updateTitile(false);
    },

    'scene:save-scene' (json) {
        let url = Editor.assetdb.uuidToUrl(Editor.currentSceneUuid);
        if ( !url ) {
            url = _showSaveDialog();

            // we've cancel the save
            if ( !url ) {
                return;
            }
        }

        let fspath = Editor.assetdb._fspath(url);

        if ( Fs.existsSync(fspath) ) {
            Editor.assetdb.save( url, json, ( err, result ) => {
                if ( err ) {
                    Editor.assetdb.error('Failed to save scene %s', url, err.stack);
                    return;
                }

                let meta = result.meta;
                Editor.currentSceneUuid = meta.uuid;

                Editor.sendToAll('asset-db:asset-changed', {
                    type: meta.assetType(),
                    uuid: meta.uuid,
                });

                Editor.sendToAll('scene:saved');
            });
        } else {
            Editor.assetdb.create( url, json, ( err, results ) => {
                if ( err ) {
                    Editor.assetdb.error('Failed to create asset %s, messages: %s',
                                         url, err.stack);
                                         return;
                }

                Editor.currentSceneUuid = results[0].uuid;

                Editor.sendToAll('asset-db:assets-created', results);
                Editor.sendToAll('scene:saved');
            });
        }
    },

    'scene:create-prefab' (replyUuid, url, json) {
        let fsPath = Editor.assetdb._fspath(url);
        if ( Fs.existsSync(fsPath) ) {
            Editor.assetdb.save( url, json, ( err, result ) => {
                if ( err ) {
                    Editor.assetdb.error('Failed to save prefab %s, messages: %s',
                        url, err.stack);
                    replyUuid( err );
                    return;
                }

                let meta = result.meta;
                replyUuid( null, meta.uuid );
                Editor.sendToAll( 'asset-db:asset-changed', {
                    type: meta.assetType(),
                    uuid: meta.uuid,
                });
            });
        } else {
            Editor.assetdb.create( url, json, ( err, results ) => {
                if ( err ) {
                    Editor.assetdb.error('Failed to create prefab %s, messages: %s',
                        url, err.stack);
                    replyUuid( err );
                    return;
                }
                replyUuid( null, results[0].uuid );
                Editor.sendToAll( 'asset-db:assets-created', results );
            });
        }
    },

    'scene:apply-prefab' (uuid, json) {
        let url = Editor.assetdb.uuidToUrl(uuid);
        Editor.assetdb.save( url, json, ( err, result ) => {
            if ( err ) {
                Editor.assetdb.error('Failed to apply prefab %s, messages: %s',
                    url, err.stack);
                //replyUuid( err );
                return;
            }

            let meta = result.meta;
            Editor.sendToAll( 'asset-db:asset-changed', {
                type: meta.assetType(),
                uuid: meta.uuid,
            });
        });
    },

    'scene:query-asset-info-by-uuid' (reply, uuid) {
        let path = Editor.assetdb.uuidToFspath(uuid);
        if (!path) {
            return reply(null);
        }

        let Meta = Editor.require('app://asset-db/lib/meta');
        let metaObj = Meta.load(Editor.assetdb, path + '.meta');

        if ( metaObj && !metaObj.useRawfile() ) {
            // if imported, return imported asset url
            path = Editor.assetdb._uuidToImportPathNoExt(uuid);
            path += '.json';
        }

        // let url = Url.format({
        //     protocol: '',
        //     pathname: path,
        //     slashes: true,
        // });
        let url = path.replace(/\\/g, '/');

        reply({
            url: url,
            type: metaObj.assetType(),
        });
    },

    'scene:update-title' ( dirty ) {
        _updateTitile(dirty);
    }
};
