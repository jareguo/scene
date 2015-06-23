(function () {
    Editor.projectInfo = Editor.remote.projectInfo;
    Editor.libraryPath = Editor.remote.libraryPath;

    if ( !Editor.assets ) Editor.assets = {};
    if ( !Editor.metas ) Editor.metas = {};
    if ( !Editor.inspectors ) Editor.inspectors = {};

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

        // init engine
        var canvasEL = document.getElementById('canvas');
        var bcr = document.body.getBoundingClientRect();

        //
        Fire.Engine.init({
            width: bcr.width,
            height: bcr.height,
            canvas: canvasEL,
        }, function ( err ) {
            // TODO:
        });

        window.onresize = function () {
            bcr = document.body.getBoundingClientRect();
            Fire.Engine.resize( bcr.width, bcr.height );
        };
    }, function ( err ) {
        Editor.error( 'Failed to load %s. message: %s', runtimeUrl, err.message );
    });
})();
