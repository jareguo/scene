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

    _sendToView: function () {
        if ( !this._viewReady ) {
            return;
        }

        // NOTE: This will prevent us send back ipc message
        //       in ipc callstack which will make ipc event in reverse order
        // NOTE: In Electron, webview.send have some remote.sync method in it
        //       popIpc one by one will prevent too much sync method in one frame
        if ( !this._timeoutID ) {
            this._timeoutID = setTimeout( function () {
                // DISABLE
                // for ( var i = 0; i < this._ipcList.length; ++i ) {
                //     this.$.view.send.apply( this.$.view, this._ipcList[i] );
                // }
                // this._ipcList = [];
                // this._timeoutID = null;

                this._popIpc();
            }.bind(this),1);
        }
        this._ipcList.push(arguments);
    },

    _popIpc: function () {
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
    },

    // view events

    _onViewDomReady: function ( event ) {
        this._viewReady = true;
    },

    _onViewDidFinishLoad: function ( event ) {
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
});

})();
