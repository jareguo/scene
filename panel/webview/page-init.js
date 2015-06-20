(function () {
    Editor.projectInfo = Editor.remote.projectInfo;
    var libraryPath = Editor.remote.assetdb.library;

    // init engine-framework
    Editor.require('app://engine-framework');

    // init runtime
    var runtimeUrl = 'app://runtime/runtime-' + Editor.projectInfo.runtime + '/index.html';
    Polymer.Base.importHref( runtimeUrl, function ( event ) {
        // init asset library
        Fire.AssetLibrary.init(libraryPath);

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
