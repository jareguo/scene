Fire.engine.on('node-attach-to-scene', function ( event ) {
    var wrapper = Fire.node(event.detail.runtimeTarget);
    var className = Fire.JS.getClassName(wrapper);

    var gizmoDef = Editor.gizmos[className];
    if ( gizmoDef ) {
        wrapper.gizmo = new gizmoDef( sceneView.$.gizmosView, wrapper );
        wrapper.gizmo.repaint();
    }

    // TODO:
    // wrapper.mixinGizmos =
});

Fire.engine.on('node-detach-from-scene', function ( event ) {
    var wrapper = Fire.node(event.detail.runtimeTarget);
    if ( wrapper.gizmo ) {
        wrapper.gizmo.remove();
        wrapper.gizmo = null;
    }

    // TODO:
    // wrapper.mixinGizmos =
});

var _repaintGizmos = function (node) {
    var wrapper = Fire.node(node);
    if ( wrapper.gizmo ) {
        wrapper.gizmo.repaint();
    }

    // TODO:
    // wrapper.mixinGizmos =

    var runtimeChildren = wrapper.runtimeChildren;
    runtimeChildren.map(_repaintGizmos);
};

Fire.engine.on('post-update', function ( event ) {
    sceneView.$.gizmosView.repaint();

    var wrapper = Fire.engine.getCurrentScene();
    wrapper.runtimeChildren.map(_repaintGizmos);
});
