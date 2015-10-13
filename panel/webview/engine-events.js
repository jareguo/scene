cc.engine.on('node-attach-to-scene', function ( event ) {
    var wrapper = Fire(event.detail.targetN);
    var className = Fire.JS.getClassName(wrapper);

    var gizmoDef = Editor.gizmos[className];
    if ( gizmoDef ) {
        wrapper.gizmo = new gizmoDef( sceneView.$.gizmosView, wrapper );
        wrapper.gizmo.update();
    }

    // TODO:
    // wrapper.mixinGizmos =

    cc.engine.repaintInEditMode();
});

cc.engine.on('node-detach-from-scene', function ( event ) {
    var wrapper = Fire(event.detail.targetN);
    if ( wrapper.gizmo ) {
        wrapper.gizmo.remove();
        wrapper.gizmo = null;
    }

    // TODO:
    // wrapper.mixinGizmos =

    cc.engine.repaintInEditMode();
});

var _updateGizmos = function (node) {
    var wrapper = Fire(node);
    if ( wrapper.gizmo ) {
        wrapper.gizmo.update();
    }

    // TODO:
    // wrapper.mixinGizmos =

    var childrenN = wrapper.childrenN;
    childrenN.forEach(_updateGizmos);
};

cc.engine.on('post-update', function ( event ) {
    sceneView.$.gizmosView.update();

    var wrapper = cc(cc.director.getRunningScene());
    wrapper.childrenN.forEach(_updateGizmos);
});
