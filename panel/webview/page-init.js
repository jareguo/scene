(function () {
    Editor.projectInfo = Editor.remote.projectInfo;
    Editor.libraryPath = Editor.remote.libraryPath;

    if ( !Editor.assets ) Editor.assets = {};
    if ( !Editor.metas ) Editor.metas = {};
    if ( !Editor.inspectors ) Editor.inspectors = {};

    // init scene manager
    require('./scene-manager');

    // init ipc messages
    require('./ipc');

    // init engine-framework
    Editor.require('app://engine-framework');

    // init canvas-assets
    // TODO: do we really need meta in scene-webview ???
    var Meta = Editor.require('app://asset-db/lib/meta');
    Editor.metas.asset = Meta.AssetMeta;
    Editor.metas.folder = Meta.FolderMeta;
    Editor.require('packages://canvas-assets/init');

    // init runtime
    var runtimeUrl = 'app://runtime/runtime-' + Editor.projectInfo.runtime + '/index.html';
    Polymer.Base.importHref( runtimeUrl, function ( event ) {

        // init asset library
        Fire.AssetLibrary.init(Editor.libraryPath);

        // init canvas
        var canvasEL = document.getElementById('canvas');
        var bcr = document.body.getBoundingClientRect();
        canvasEL.width  = bcr.width;
        canvasEL.height = bcr.height;

        var initOptions = {
            width: bcr.width,
            height: bcr.height,
            canvas: canvasEL,
        };

        // init engine
        Fire.Engine.init(initOptions, function () {
            Editor.initScene(function (err) {
                if (err) {
                    Editor.error(err);
                    Ipc.sendToHost('scene:error', err);
                }
                else {
                    var Ipc = require('ipc');
                    Ipc.sendToHost('scene:ready');
                }
            });
        });

        // debounce resize
        var _resizeDebounceID = null;
        window.onresize = function () {
            // debounce write for 10ms
            if ( _resizeDebounceID ) {
                return;
            }
            _resizeDebounceID = setTimeout(function () {
                _resizeDebounceID = null;
                bcr = document.body.getBoundingClientRect();
                Fire.Engine.resize( bcr.width, bcr.height );
            }, 10);
        };

        //
        window.addEventListener('beforeunload', function () {
            if (Fire.Engine.isPlaying) {
                Fire.Engine.stop();
            }
        });

    }, function ( err ) {
        Editor.error( 'Failed to load %s. message: %s', runtimeUrl, err.message );
    });
})();
