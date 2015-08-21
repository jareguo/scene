(function () {
Editor.registerPanel( 'scene.panel', {
    is: 'editor-scene',

    behaviors: [ EditorUI.droppable ],

    hostAttributes: {
        'droppable': 'asset',
    },

    listeners: {
        'drop-area-enter': '_onDropAreaEnter',
        'drop-area-leave': '_onDropAreaLeave',
        'drop-area-accept': '_onDropAreaAccept',
    },

    properties: {
        transformTool: {
            type: String,
            value: 'move',
            observer: '_transformToolChanged',
        },

        coordinate: {
            type: String,
            value: 'local',
            observer: '_coordinateChanged',
        },

        pivot: {
            type: String,
            value: 'pivot',
            observer: '_pivotChanged',
        },
    },

    observers: [
        '_designSizeChanged(profiles.local.designWidth)',
        '_designSizeChanged(profiles.local.designHeight)',
    ],

    created: function () {
        this._viewReady = false;
        this._ipcList = [];
    },

    ready: function () {
        this._initDroppable(this.$.dropArea);

        // beforeunload event
        window.addEventListener('beforeunload', function ( event ) {
            Editor.Selection.clear('node');

            // TODO
            // var res = this.confirmCloseScene();
            // switch ( res ) {
            // // save
            // case 0:
            //     this.saveCurrentScene();
            //     event.returnValue = true;
            //     return;

            // // cancel
            // case 1:
            //     event.returnValue = false;
            //     return;

            // // don't save
            // case 2:
            //     event.returnValue = true;
            //     return;
            // }
        }.bind(this));
    },

    reload: function () {
        if ( this._viewReady ) {
            this.$.view.reloadIgnoringCache();
        }
    },

    openDevTools: function () {
        this.$.view.openDevTools();
    },

    selectMove: function ( event ) {
        if ( event ) {
            event.stopPropagation();
        }

        this.transformTool = 'move';
    },

    selectRotate: function ( event ) {
        if ( event ) {
            event.stopPropagation();
        }

        this.transformTool = 'rotate';
    },

    selectScale: function ( event ) {
        if ( event ) {
            event.stopPropagation();
        }

        this.transformTool = 'scale';
    },

    deleteCurrentSelected: function ( event ) {
        if ( event ) {
            event.stopPropagation();
        }

        var ids = Editor.Selection.curSelection('node');
        Editor.sendToPanel( 'scene.panel', 'scene:delete-nodes', ids);
    },

    duplicateCurrentSelected: function ( event ) {
        if ( event ) {
            event.stopPropagation();
        }

        var ids = Editor.Selection.curSelection('node');
        Editor.sendToPanel( 'scene.panel', 'scene:duplicate-nodes', ids);
    },

    confirmCloseScene: function () {
        var dirty = true;
        if ( dirty ) {
            var Url = require('fire-url');

            var name = 'New Scene';
            var url = 'assets://New Scene.fire';
            var currentSceneUuid = Editor.remote.currentSceneUuid;

            if ( currentSceneUuid ) {
                url = Editor.assetdb.remote.uuidToUrl(currentSceneUuid);
                name = Url.basename(url);
            }

            var Remote = require('remote');
            var Dialog = Remote.require('dialog');
            return Dialog.showMessageBox( Remote.getCurrentWindow(), {
                type: 'warning',
                buttons: ['Save','Cancel','Don\'t Save'],
                title: 'Save Scene Confirm',
                message: name + ' has changed, do you want to save it?',
                detail: 'Your changes will be lost if you close this item without saving.'
            } );
        }

        //
        return 2;
    },

    'panel:open': function ( argv ) {
        if ( !argv || !argv.uuid )
            return;

        this.$.loader.hidden = false;
        Editor.sendToAll('scene:reloading');
        this._sendToView('scene:open-scene-by-uuid', argv.uuid );
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
        this._sendToView('scene:new-scene' );
    },

    'scene:save-scene-from-page': function ( url ) {
        this._sendToView('scene:save-scene-from-page', url );
    },

    'scene:play-on-device': function () {
        this._sendToView('scene:play-on-device');
    },

    'scene:reload-on-device': function () {
        this._sendToView('scene:reload-on-device');
    },

    'scene:query-hierarchy': function ( queryID ) {
        this._sendToView( 'scene:query-hierarchy', queryID );
    },

    'scene:query-node': function ( queryID, nodeID ) {
        this._sendToView( 'scene:query-node', queryID, nodeID );
    },

    'scene:query-node-info': function ( sessionID, nodeID ) {
        this._sendToView( 'scene:query-node-info', sessionID, nodeID );
    },

    'scene:node-new-property': function ( info ) {
        this._sendToView( 'scene:node-new-property', info );
    },

    'scene:node-set-property': function ( info ) {
        this._sendToView( 'scene:node-set-property', info );
    },

    'scene:node-mixin': function ( id, uuid ) {
        this._sendToView( 'scene:node-mixin', id, uuid );
    },

    'scene:node-unmixin': function ( id, className ) {
        this._sendToView( 'scene:node-unmixin', id, className );
    },

    'scene:create-nodes-by-uuids': function ( uuids, parentID ) {
        this._sendToView( 'scene:create-nodes-by-uuids', uuids, parentID );
    },

    'scene:create-node-by-classid': function ( name, classid, referenceID, position ) {
        this._sendToView( 'scene:create-node-by-classid', name, classid, referenceID, position );
    },

    'scene:move-nodes': function ( ids, parentID, nextSiblingId ) {
        this._sendToView( 'scene:move-nodes', ids, parentID, nextSiblingId );
    },

    'scene:delete-nodes': function ( ids ) {
        this._sendToView( 'scene:delete-nodes', ids );
    },

    'scene:duplicate-nodes': function ( ids ) {
        this._sendToView( 'scene:duplicate-nodes', ids );
    },

    'scene:stash-and-reload': function () {
        this._sendToView( 'scene:stash-and-reload' );
    },

    'scene:soft-reload': function () {
        this._sendToView( 'scene:soft-reload' );
    },

    'selection:selected': function ( type, ids ) {
        this._sendToView( '_selection:selected', type, ids );
        this._sendToView( 'selection:selected', type, ids );
    },

    'selection:unselected': function ( type, ids ) {
        this._sendToView( '_selection:unselected', type, ids );
        this._sendToView( 'selection:unselected', type, ids );
    },

    'selection:activated': function ( type, id ) {
        this._sendToView( '_selection:activated', type, id );
        this._sendToView( 'selection:activated', type, id );
    },

    'selection:deactivated': function ( type, id ) {
        this._sendToView( '_selection:deactivated', type, id );
        this._sendToView( 'selection:deactivated', type, id );
    },

    'selection:hoverin': function ( type, id ) {
        this._sendToView( '_selection:hoverin', type, id );
        this._sendToView( 'selection:hoverin', type, id );
    },

    'selection:hoverout': function ( type, id ) {
        this._sendToView( '_selection:hoverout', type, id );
        this._sendToView( 'selection:hoverout', type, id );
    },

    'selection:context': function ( type, id ) {
        this._sendToView( '_selection:context', type, id );
        this._sendToView( 'selection:context', type, id );
    },

    'selection:changed': function ( type ) {
        this._sendToView( '_selection:changed', type );
        this._sendToView( 'selection:changed', type );
    },

    _sendToView: function () {
        var args = [].slice.call( arguments, 0 );
        this._ipcList.push(args);

        // NOTE: This will prevent us send back ipc message
        //       in ipc callstack which will make ipc event in reverse order
        // NOTE: In Electron, webview.send have some remote.sync method in it
        //       popIpc one by one will prevent too much sync method in one frame
        if ( !this._timeoutID ) {
            this._timeoutID = setTimeout( function () {
                this._flushIpc();
            }.bind(this),10);
        }
    },

    _flushIpc: function () {
        // NOTE: without EditorUI.importing, the webview.send sometimes blocking the HTMLImports
        if ( EditorUI.importing || !this._viewReady ) {
            if ( this._ipcList.length > 0 ) {
                this._timeoutID = setTimeout( function () {
                    this._flushIpc();
                }.bind(this),10);
            }

            return;
        }

        var list = this._ipcList;
        this._ipcList = [];
        this._timeoutID = null;

        this.$.view.send( 'scene:ipc-messages', list );

        // DISABLE
        // if ( this._ipcList.length > 0 ) {
        //     var args = this._ipcList.shift();
        //     this.$.view.send.apply( this.$.view, args );
        // }

        // this._timeoutID = null;

        // if ( this._ipcList.length > 0 ) {
        //     this._timeoutID = setTimeout( function () {
        //         this._flushIpc();
        //     }.bind(this),1);
        // }
    },

    // view events

    _onViewDidStartLoading: function ( event ) {
        console.time('scene:reloading');

        this.$.loader.hidden = false;
        this._viewReady = false;

        // change scene states
        Editor.sendToAll('scene:reloading');
    },

    _onViewDomReady: function ( event ) {
    },

    _onViewDidFinishLoad: function ( event ) {
        this._viewReady = true;
        this._sendToView( 'scene:init-scene-view', {
            transformTool: this.transformTool,
            coordinate: this.coordinate,
            pivot: this.pivot,
            designWidth: this.profiles.local.designWidth,
            designHeight: this.profiles.local.designHeight,
        });
    },

    _onViewDidFailLoad: function ( event ) {
        Editor.error('Failed loading scene view, Error Code: %s, Message: %s',
                     event.errorCode,
                     event.errorDescription );
    },

    _onViewCrashed: function ( event ) {
        Editor.error( 'Scene view crashed!' );
    },

    _onViewGpuCrashed: function ( event ) {
        Editor.error( 'Scene view gpu-crashed!' );
    },

    _onViewPluginCrashed: function ( event ) {
        Editor.error('Scene view plugin-crashed! Plugin Name: %s, Version: %s',
                     event.name,
                     event.version );
    },

    _onViewConsole: function ( event ) {
        switch ( event.level ) {
        case 0:
            console.log('[scene-console]: ', event.message);
            break;

        case 1:
            console.warn('[scene-console]: ', event.message);
            break;

        case 2:
            console.error('[scene-console]: ', event.message);
            break;
        }
    },

    _onViewIpc: function ( event ) {
        var err;

        // NOTE: webview ipc only send to editor-scene.panel
        switch ( event.channel ) {
            case 'scene:ready':
                this.$.loader.hidden = true;

                Editor.sendToAll('scene:ready');
                console.timeEnd('scene:reloading');
                break;

            case 'scene:playing':
                this.$.loader.hidden = true;
                break;

            case 'scene:init-error':
                err = event.args[0];
                Editor.failed('Failed to init scene: %s', err.stack);

                this.$.loader.hidden = true;
                break;

            case 'scene:play-error':
                err = event.args[0];
                Editor.failed('Failed to play scene: %s', err.stack);

                this.$.loader.hidden = true;
                break;

            case 'scene:ask-for-reload':
                this.reload();
                break;
        }
    },

    // drag & drop

    _onDropAreaEnter: function ( event ) {
        event.stopPropagation();
    },

    _onDropAreaLeave: function ( event ) {
        event.stopPropagation();
    },

    _onDropAreaAccept: function ( event ) {
        event.stopPropagation();

        Editor.Selection.cancel();
        this._sendToView( 'scene:drop',
                          event.detail.dragItems,
                          event.detail.dragType,
                          event.detail.offsetX,
                          event.detail.offsetY
                        );
    },

    _onDragOver: function ( event ) {
        var dragType = EditorUI.DragDrop.type(event.dataTransfer);
        if ( dragType !== 'asset' ) {
            EditorUI.DragDrop.allowDrop( event.dataTransfer, false );
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        EditorUI.DragDrop.allowDrop( event.dataTransfer, true );
        EditorUI.DragDrop.updateDropEffect( event.dataTransfer, 'copy' );
    },

    // value changes

    _transformToolChanged: function () {
        this._sendToView( 'scene:transform-tool-changed', this.transformTool );
    },

    _coordinateChanged: function () {
        this._sendToView( 'scene:coordinate-changed', this.coordinate );
    },

    _pivotChanged: function () {
        this._sendToView( 'scene:pivot-changed', this.pivot );
    },

    _designSizeChanged: function () {
        if ( this.profiles.local.save ) {
            this.profiles.local.save();
        }

        this._sendToView( 'scene:design-size-changed',
                         this.profiles.local.designWidth,
                         this.profiles.local.designHeight );
    },
});

})();
