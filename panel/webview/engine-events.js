Fire.engine.on('node-attach-to-scene', function ( event ) {
    var fireNode = Fire.node(event.detail.runtimeTarget);
    // TODO:
    // fireNode.gizmo = Editor.gizmos['mytype']...
    // fireNode.mixinGizmos =
});

Fire.engine.on('node-detach-from-scene', function ( event ) {
    // var fireNode = Fire.node(event.detail.runtimeTarget);
});

Fire.engine.on('post-update', function ( event ) {
    sceneView.$.gizmos.update();
});
