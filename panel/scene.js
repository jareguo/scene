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
        this._initDroppable(this.$.dropArea);
    },

    reload: function () {
        this.$.loader.hidden = false;
        this.$.view.reloadIgnoringCache();
    },

    openDevTools: function () {
        this.$.view.openDevTools();
    },

    'scene:play': function () {
        this.$.loader.hidden = false;
        this.$.view.send('scene:play');
    },

    'scene:stop': function () {
        this.$.loader.hidden = false;
        this.$.view.reloadIgnoringCache();
    },

    'editor:dragstart': function () {
        this.$.dropArea.hidden = false;
    },

    'editor:dragend': function () {
        this.$.dropArea.hidden = true;
    },

    'editor:state-changed': function ( name, value ) {
        this.$.view.send('editor:state-changed', name, value);
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
        switch ( event.channel ) {
            case 'scene:played':
                this.$.loader.hidden = true;
                break;
            case 'scene:ready':
                this.$.loader.hidden = true;
                break;
            case 'scene:error':
                this.$.loader.hidden = true;
                break;
        }
    },

    _onViewDidFinishLoad: function ( event ) {
        this.$.loader.hidden = true;
    },

    _onDropAreaEnter: function ( event ) {
        event.stopPropagation();
    },

    _onDropAreaLeave: function ( event ) {
        event.stopPropagation();
    },

    _onDropAreaAccept: function ( event ) {
        event.stopPropagation();

        Editor.Selection.cancel();
        this.$.view.send( 'scene:drop',
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
