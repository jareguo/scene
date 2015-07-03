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

    'scene:query-hierarchy': function () {
        this._sendToView( 'scene:query-hierarchy' );
    },

    'scene:query-node': function ( id ) {
        this._sendToView( 'scene:query-node', id );
    },

    _sendToView: function () {
        if ( this._viewReady ) {
            var args = arguments;
            // NOTE: this will prevent us send back ipc message
            //       in ipc callstack which will make ipc event in reverse order
            setImmediate( function () {
                this.$.view.send.apply( this.$.view, args );
            }.bind(this));
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
            EditorUI.DragDrop.allowDrop( event.dataTransfer, true );
            EditorUI.DragDrop.updateDropEffect( event.dataTransfer, 'copy' );
        }
    },
});

})();
