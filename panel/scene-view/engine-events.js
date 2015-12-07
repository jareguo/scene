var _sceneView;

function onAttachToScene ( event ) {
    var node = event.detail.target;
    var className = cc.js.getClassName(node);

    var gizmoDef = Editor.gizmos[className];
    if ( gizmoDef ) {
        node.gizmo = new gizmoDef( _sceneView.$.gizmosView, node );
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
    _sceneView.$.gizmosView.update();

    var wrapper = cc.director.getScene();
    wrapper._children.forEach(_updateGizmos);
}


function onDesignResolutionChanged () {
    var size = cc.engine.getDesignResolutionSize();

    _sceneView.designWidth = size.width;
    _sceneView.designHeight = size.height;
}


module.exports = {
    isLoaded: false,

    register: function ( sceneView ) {
        if (this.isLoaded) return;
        this.isLoaded = true;
        _sceneView = sceneView;

        cc.director.on(cc.Director.EVENT_AFTER_VISIT, onPostUpdate);
        cc.engine.on('node-attach-to-scene', onAttachToScene);
        cc.engine.on('node-detach-from-scene', onDetachFromScene);
        cc.engine.on('design-resolution-changed', onDesignResolutionChanged);
    },

    unregister: function () {
        this.isLoaded = false;

        cc.director.off(cc.Director.EVENT_AFTER_VISIT, onPostUpdate);
        cc.engine.off('node-attach-to-scene', onAttachToScene);
        cc.engine.off('node-detach-from-scene', onDetachFromScene);
        cc.engine.off('design-resolution-changed', onDesignResolutionChanged);
    }
};
