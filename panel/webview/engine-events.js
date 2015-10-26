cc.engine.on('node-attach-to-scene', function ( event ) {
    var node = event.detail.target;
    var className = cc.js.getClassName(node);

    var gizmoDef = Editor.gizmos[className];
    if ( gizmoDef ) {
        node.gizmo = new gizmoDef( sceneView.$.gizmosView, node );
        node.gizmo.update();
    }

    // TODO:
    // components

    cc.engine.repaintInEditMode();
});

cc.engine.on('node-detach-from-scene', function ( event ) {
    var node = event.detail.target;
    if ( node.gizmo ) {
        node.gizmo.remove();
        node.gizmo = null;
    }

    // TODO:
    // components

    cc.engine.repaintInEditMode();
});

var _updateGizmos = function (node) {
    if ( node.gizmo ) {
        node.gizmo.update();
    }

    // TODO:
    // components

    node._children.forEach(_updateGizmos);
};

cc.engine.on('post-update', function ( event ) {
    sceneView.$.gizmosView.update();

    var wrapper = cc.director.getScene();
    wrapper._children.forEach(_updateGizmos);
});
