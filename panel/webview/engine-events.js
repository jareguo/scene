Fire.engine.on('node-attach-to-scene', function ( event ) {
    if ( Editor.states['scene-playing'] ) {
        return;
    }

    var wrapper = Fire(event.detail.targetN);
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
    if ( Editor.states['scene-playing'] ) {
        return;
    }

    var wrapper = Fire(event.detail.targetN);
    if ( wrapper.gizmo ) {
        wrapper.gizmo.remove();
        wrapper.gizmo = null;
    }

    // TODO:
    // wrapper.mixinGizmos =

    Fire.engine.repaintInEditMode();
});

var _updateGizmos = function (node) {
    var wrapper = Fire(node);
    if ( wrapper.gizmo ) {
        wrapper.gizmo.update();
    }

    // TODO:
    // wrapper.mixinGizmos =

    var childrenN = wrapper.childrenN;
    childrenN.map(_updateGizmos);
};

Fire.engine.on('post-update', function ( event ) {
    if ( Editor.states['scene-playing'] ) {
        return;
    }

    sceneView.$.gizmosView.update();

    var wrapper = Fire.engine.getCurrentScene();
    wrapper.childrenN.map(_updateGizmos);
});
