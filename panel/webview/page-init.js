(function () {
    Editor.isRuntime = true;

    // mixin Editor for editor
    Editor.require('app://editor/page/editor-init');

    // init scene manager
    require('./scene-manager');

    // init ipc messages
    require('./ipc');

    // init engine
    Editor.require('app://cocos2d/cocos2d-html5');

    // load editor engine
    require('./playable/playable');
    require('./playable/ticker');
    require('./playable/time');
    require('./editor-engine');

    // init engine extends
    Editor.require('app://editor/share/engine-extends');

    //
    require('./engine-events');
    require('./debug-helper');
    
    // init fire-assets
    Editor.require('packages://fire-assets/init');
    
    // init gizmos
    Editor.require('packages://fire-gizmos/init');
})();
