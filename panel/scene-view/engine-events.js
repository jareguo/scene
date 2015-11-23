function onAttachToScene ( event ) {
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
}

function onDetachFromScene ( event ) {
    var node = event.detail.target;
    if ( node.gizmo ) {
        node.gizmo.remove();
        node.gizmo = null;
    }

    // TODO:
    // components

    cc.engine.repaintInEditMode();
}


var _updateGizmos = function (node) {
    if ( node.gizmo ) {
        node.gizmo.update();
    }

    // TODO:
    // components

    node._children.forEach(_updateGizmos);
};

function onPostUpdate( event ) {
    sceneView.$.gizmosView.update();

    var wrapper = cc.director.getScene();
    wrapper._children.forEach(_updateGizmos);
}


function onDesignResolutionChanged () {
    var scenePanel = document.getElementById('scene.panel');

    var size = cc.engine.getDesignResolutionSize();
    scenePanel.set('profiles.local.designWidth', size.width);
    scenePanel.set('profiles.local.designHeight', size.height);
}


module.exports = {
    isLoaded: false,

    load: function () {
        if (this.isLoaded) return;
        this.isLoaded = true;

        cc.engine.on('post-update', onPostUpdate);
        cc.engine.on('node-attach-to-scene', onAttachToScene);
        cc.engine.on('node-detach-from-scene', onDetachFromScene);
        cc.engine.on('design-resolution-changed', onDesignResolutionChanged);
    },

    unload: function () {
        this.isLoaded = false;

        cc.engine.off('post-update', onPostUpdate);
        cc.engine.off('node-attach-to-scene', onAttachToScene);
        cc.engine.off('node-detach-from-scene', onDetachFromScene);
        cc.engine.off('design-resolution-changed', onDesignResolutionChanged);
    }
};
