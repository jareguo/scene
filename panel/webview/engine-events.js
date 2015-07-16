Fire.engine.on('node-attach-to-scene', function ( event ) {
    var wrapper = Fire.node(event.detail.runtimeTarget);
    var className = Fire.JS.getClassName(wrapper);

    var gizmoDef = Editor.gizmos[className];
    if ( gizmoDef ) {
        wrapper.gizmo = new gizmoDef( sceneView.$.gizmosView, wrapper );
        wrapper.gizmo.update();
    }

    // TODO:
    // wrapper.mixinGizmos =

    Fire.engine.repaintInEditMode();
});

Fire.engine.on('node-detach-from-scene', function ( event ) {
    var wrapper = Fire.node(event.detail.runtimeTarget);
    if ( wrapper.gizmo ) {
        wrapper.gizmo.remove();
        wrapper.gizmo = null;
    }

    // TODO:
    // wrapper.mixinGizmos =

    Fire.engine.repaintInEditMode();
});

var _updateGizmos = function (node) {
    var wrapper = Fire.node(node);
    if ( wrapper.gizmo ) {
        wrapper.gizmo.update();
    }

    // TODO:
    // wrapper.mixinGizmos =

    var runtimeChildren = wrapper.runtimeChildren;
    runtimeChildren.map(_updateGizmos);
};

Fire.engine.on('post-update', function ( event ) {
    sceneView.$.gizmosView.update();

    var wrapper = Fire.engine.getCurrentScene();
    wrapper.runtimeChildren.map(_updateGizmos);
});
