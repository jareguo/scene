var Async = require('async');
var sandbox = require('./sandbox');

function enterEditMode ( stashedScene, next ) {
    if ( stashedScene ) {
        // restore selection
        Editor.Selection.select('node', stashedScene.sceneSelection, true, true);

        // restore scene view
        window.sceneView.init(stashedScene.sceneOffsetX,
                              stashedScene.sceneOffsetY,
                              stashedScene.sceneScale );
    }

    Editor.remote.stashedScene = null;
    next();
}

function createScene (sceneJson, next) {
    // reset scene view
    window.sceneView.reset();

    // Assets will be loaded by SceneWrapper.prototype.create, here we just deserialize the scene graph
    var scene = Fire.deserialize(sceneJson);
    Fire.engine._initScene(scene, function () {
        next(null, scene);
    });
}

Editor.initScene = function (callback) {
    var stashedScene = Editor.remote.stashedScene; // a remote sync method
    var sceneJson = stashedScene ? stashedScene.sceneJson : null;
    if (sceneJson) {
        // load last editing scene
        Async.waterfall(
            [
                sandbox.loadCompiledScript,
                createScene.bind(this, sceneJson),
                function (scene, next) {
                    Fire.engine._launchScene(scene);
                    Fire.engine.repaintInEditMode();
                    next( null, stashedScene );
                },
                enterEditMode,
            ],
            callback
        );
    }
    else {
        Async.waterfall([
            sandbox.loadCompiledScript,
            function ( next ) {
                var currentSceneUuid = Editor.remote.currentSceneUuid;
                if ( currentSceneUuid ) {
                    Fire.engine._loadSceneByUuid(currentSceneUuid, function ( err ) {
                        window.sceneView.adjustToCenter(10);
                        Fire.engine.repaintInEditMode();
                        next ( err, null );
                    });
                    return;
                }

                window.sceneView.adjustToCenter(10);
                next( null, null );
            },
            enterEditMode,
        ], callback );
    }
};

Editor.stashScene = function (callback) {
    // get scene json
    var scene = Fire.engine.getCurrentScene();
    var jsonText = Editor.serialize(scene, {stringify: true});

    // store the scene, scene-view postion, scene-view scale
    Editor.remote.stashedScene = {
        sceneJson: jsonText,
        sceneScale: window.sceneView.scale,
        sceneOffsetX: window.sceneView.$.grid.xAxisOffset,
        sceneOffsetY: window.sceneView.$.grid.yAxisOffset,
        sceneSelection: Editor.Selection.curSelection('node'),
    };

    if ( callback ) {
        callback(null, jsonText);
    }
};

Editor.reloadScene = function (callback) {
    Async.waterfall([
        Editor.stashScene,
        createScene,
        function (scene, next) {
            Fire.engine._launchScene(scene);
            Fire.engine.repaintInEditMode();
            next( null, Editor.remote.stashedScene );
        },
        enterEditMode,
    ], callback );
};

Editor.playScene = function (callback) {
    // store selection
    var selection = Editor.Selection.curSelection('node');

    Async.waterfall([
        Editor.stashScene,
        createScene,    // instantiate a new scene to play
        function (scene, next) {
            // setup scene list
            Fire.engine._sceneInfos = Editor.remote.sceneList.map(function ( info ) {
                return { url: info.url, uuid: info.uuid };
            });

            // reset scene camera
            scene.position = Fire.Vec2.zero;
            scene.scale = Fire.Vec2.one;

            // play new scene
            Fire.engine._launchScene(scene, function () {
                // restore selection
                Editor.Selection.select('node', selection, true, true);

                //
                window.sceneView.$.grid.hidden = true;
                window.sceneView.$.gizmosView.hidden = true;

                //if (this.$.pause.active) {
                //    Fire.engine.step();
                //}
                //else {
                Fire.engine.play();
                //}
            });
            next();
        },
    ], callback);
};

Editor.softReload = function () {
    // hot update new compiled scripts
    sandbox.reload();
};
