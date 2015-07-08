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

    ready: function () {
        this._viewReady = false;
        this._ipcList = [];

        Editor.states['scene-initializing'] = true;

        this._initDroppable(this.$.dropArea);
    },

    reload: function () {
        this._viewReady = false;
        console.time('scene:reloading');

        // change scene states
        this.$.loader.hidden = false;
        Editor.states['scene-initializing'] = true;

        // reload the scene
        this.$.view.reloadIgnoringCache();
        Editor.sendToAll('scene:reloading');
    },

    openDevTools: function () {
        this.$.view.openDevTools();
    },

    'editor:dragstart': function () {
        this.$.dropArea.hidden = false;
    },

    'editor:dragend': function () {
        this.$.dropArea.hidden = true;
    },

    'editor:state-changed': function ( name, value ) {
        this._sendToView('editor:state-changed', name, value);
    },

    'scene:play': function () {
        this.$.loader.hidden = false;
        Editor.states['scene-initializing'] = true;

        this._sendToView('scene:play');
    },

    'scene:stop': function () {
        this.$.loader.hidden = false;
        Editor.states['scene-initializing'] = true;

        this.$.view.reloadIgnoringCache();
        Editor.sendToAll('scene:reloading');
    },

    'scene:query-hierarchy': function ( queryID ) {
        this._sendToView( 'scene:query-hierarchy', queryID );
    },

    'scene:query-node': function ( queryID, nodeID ) {
        this._sendToView( 'scene:query-node', queryID, nodeID );
    },

    'scene:node-set-property': function ( id, path, value, isMixin ) {
        this._sendToView( 'scene:node-set-property', id, path, value, isMixin );
    },

    'scene:node-mixin': function ( id, uuid ) {
        this._sendToView( 'scene:node-mixin', id, uuid );
    },

    'scene:create-assets': function ( uuids, nodeID ) {
        this._sendToView( 'scene:create-assets', uuids, nodeID );
    },

    'scene:move-nodes': function ( ids, parentID, nextSiblingId ) {
        this._sendToView( 'scene:move-nodes', ids, parentID, nextSiblingId );
    },

    'selection:selected': function ( type, ids ) {
        if ( type !== 'node' ) {
            return;
        }

        this._sendToView( 'selection:selected', type, ids );
    },

    'selection:unselected': function ( type, ids ) {
        if ( type !== 'node' ) {
            return;
        }

        this._sendToView( 'selection:unselected', type, ids );
    },

    'selection:activated': function ( type, id ) {
        if ( type !== 'node' ) {
            return;
        }

        this._sendToView( 'selection:activated', type, id );
    },

    'selection:deactivated': function ( type, id ) {
        if ( type !== 'node' ) {
            return;
        }

        this._sendToView( 'selection:deactivated', type, id );
    },

    'selection:hoverin': function ( type, id ) {
        if ( type !== 'node' ) {
            return;
        }

        this._sendToView( 'selection:hoverin', type, id );
    },

    'selection:hoverout': function ( type, id ) {
        if ( type !== 'node' ) {
            return;
        }

        this._sendToView( 'selection:hoverout', type, id );
    },

    'selection:changed': function ( type ) {
        if ( type !== 'node' ) {
            return;
        }

        this._sendToView( 'selection:changed', type );
    },

    _sendToView: function () {
        if ( !this._viewReady ) {
            return;
        }

        this._ipcList.push(arguments);

        // NOTE: This will prevent us send back ipc message
        //       in ipc callstack which will make ipc event in reverse order
        // NOTE: In Electron, webview.send have some remote.sync method in it
        //       popIpc one by one will prevent too much sync method in one frame
        if ( !this._timeoutID ) {
            this._timeoutID = setTimeout( function () {
                this._popIpc();
            }.bind(this),1);
        }
    },

    _popIpc: function () {
        // NOTE: without EditorUI.importing, the webview.send sometimes blocking the HTMLImports
        if ( EditorUI.importing ) {
            if ( this._ipcList.length > 0 ) {
                this._timeoutID = setTimeout( function () {
                    this._popIpc();
                }.bind(this),10);
            }

            return;
        }

        if ( this._ipcList.length > 0 ) {
            var args = this._ipcList.shift();
            this.$.view.send.apply( this.$.view, args );
        }

        this._timeoutID = null;

        if ( this._ipcList.length > 0 ) {
            this._timeoutID = setTimeout( function () {
                this._popIpc();
            }.bind(this),1);
        }

        // DISABLE
        // for ( var i = 0; i < this._ipcList.length; ++i ) {
        //     this.$.view.send.apply( this.$.view, this._ipcList[i] );
        // }
        // this._ipcList = [];
        // this._timeoutID = null;
    },

    // view events

    _onViewDomReady: function ( event ) {
        this._viewReady = true;
    },

    _onViewDidFinishLoad: function ( event ) {
        this._sendToView( 'scene:transform-tool-changed', this.transformTool );
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
                Editor.states['scene-initializing'] = false;
                Editor.states['scene-playing'] = false;

                Editor.sendToAll('scene:ready');
                console.timeEnd('scene:reloading');
                break;

            case 'scene:playing':
                this.$.loader.hidden = true;
                Editor.states['scene-initializing'] = false;
                Editor.states['scene-playing'] = true;

                break;

            case 'scene:init-error':
                err = event.args[0];
                Editor.failed('Failed to init scene: %s', err.stack);

                this.$.loader.hidden = true;
                Editor.states['scene-initializing'] = false;
                break;

            case 'scene:play-error':
                err = event.args[0];
                Editor.failed('Failed to play scene: %s', err.stack);

                this.$.loader.hidden = true;
                Editor.states['scene-initializing'] = false;
                break;

            case 'scene:change-transform-tool':
                this.transformTool = event.args[0];
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
        event.preventDefault();

        if ( EditorUI.DragDrop.type( event.dataTransfer ) === 'asset' ) {
            event.stopPropagation();

            EditorUI.DragDrop.allowDrop( event.dataTransfer, true );
            EditorUI.DragDrop.updateDropEffect( event.dataTransfer, 'copy' );
        }
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
});

})();
