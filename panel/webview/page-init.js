(function () {
    Editor.projectInfo = Editor.remote.projectInfo;

    // init engine-framework
    Editor.require('app://engine-framework');

    // init runtime
    var runtimeUrl = 'app://runtime/runtime-' + Editor.projectInfo.runtime + '/index.html';
    Polymer.Base.importHref( runtimeUrl, function ( event ) {
        // init asset library
        Fire.AssetLibrary.init('TODO');

        // init engine
        var canvasEL = document.getElementById('canvas');
        var bcr = canvasEL.getBoundingClientRect();
        Fire.Engine.init({
            width: bcr.width,
            height: bcr.height,
            canvas: canvasEL,
        }, function ( err ) {
            // TODO:
        });

    }, function ( err ) {
        Editor.error( 'Failed to load %s. message: %s', runtimeUrl, err.message );
    });
})();
