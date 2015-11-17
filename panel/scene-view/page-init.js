(function () {
    // init scene manager
    require('./scene-manager');

    // load editor engine
    require('./playable/playable');
    require('./playable/ticker');
    require('./playable/time');
    require('./editor-engine');

    require('./debug-helper');

    // init gizmos
    Editor.require('packages://fire-gizmos/init');
})();
