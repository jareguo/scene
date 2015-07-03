(function () {
    Editor.isRuntime = true;

    // mixin Editor for canvas-studio
    Editor.require('app://canvas-studio/page/editor-init');

    // init scene manager
    require('./scene-manager');

    // init ipc messages
    require('./ipc');

    // init engine-framework
    Editor.require('app://engine-framework');

    // init canvas-assets
    Editor.require('packages://canvas-assets/init');

    // init runtime
    var runtimeUrl = 'app://runtime/runtime-' + Editor.projectInfo.runtime + '/index.html';
    Polymer.Base.importHref( runtimeUrl, null, function ( err ) {
        Editor.error( 'Failed to load %s. message: %s', runtimeUrl, err.message );
    });
})();
