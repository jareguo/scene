var Async = require('async');

function enterEditMode (next) {
    Editor.remote.stashedScene = null;
    // TODO - restore selection (gizmo)
    next();
}

function createScene (sceneJson, next) {
    // Assets will be loaded by SceneWrapper.prototype.create, here we just deserialize the scene graph
    var scene = Fire.deserialize(sceneJson);
    Fire.engine._initScene(scene, function () {
        next(null, scene);
    });
}

Editor.initScene = function (callback) {
    var sceneJson = Editor.remote.stashedScene; // a remote sync method
    if (sceneJson) {
        // load last editing scene
        Async.waterfall(
            [
                loadCompiledScript,
                createScene.bind(this, sceneJson),
                function (scene, next) {
                    Fire.engine._launchScene(scene);
                    Fire.engine.repaintInEditMode();
                    next();
                },
                enterEditMode,
            ],
            callback
        );
    }
    else {
        Async.waterfall([
            loadCompiledScript,

            function ( next ) {
                var currentSceneUuid = Editor.remote.currentSceneUuid;
                if ( currentSceneUuid ) {
                    Fire.engine._loadSceneByUuid(currentSceneUuid, function ( err ) {
                        Fire.engine.repaintInEditMode();
                        next (err);
                    });
                    return;
                }

                next();
            },

            enterEditMode,
        ], callback );
    }
};

Editor.stashScene = function (next) {
    var scene = Fire.engine.getCurrentScene();
    var jsonObj = Editor.serialize(scene, {stringify: false});
    Editor.remote.stashedScene = jsonObj;
    next(null, jsonObj);
};

Editor.playScene = function (callback) {
    Async.waterfall(
        [
            Editor.stashScene,
            createScene,    // instantiate a new scene to play
            function (scene, next) {
                // reset scene camera
                scene.position = Fire.Vec2.zero;
                scene.scale = Fire.Vec2.one;
                // play new scene
                Fire.engine._launchScene(scene, function () {
                    //if (this.$.pause.active) {
                    //    Fire.engine.step();
                    //}
                    //else {
                        Fire.engine.play();
                    //}
                });
                next();
            },
        ],
        callback
    );
};

function loadCompiledScript (next) {
    function doLoad (src, cb) {
        var script = document.createElement('script');
        script.onload = function () {
            console.timeEnd('load ' + src);
            cb();
        };
        script.onerror = function () {
            console.timeEnd('load ' + src);
            //if (loadedScriptNodes.length > 0) {
            //    loader.unloadAll();
            //}
            console.error('Failed to load %s', src);
            cb(new Error('Failed to load ' + src));
        };
        script.setAttribute('type','text/javascript');
        script.setAttribute('charset', 'utf-8');
        script.setAttribute('src', src);    // FireUrl.addRandomQuery(src)
        console.time('load ' + src);
        document.head.appendChild(script);
        //loadedScriptNodes.push(script);
    }
    var Path = require('path');
    var scriptPath = Path.join(Editor.libraryPath, 'bundle.project.js');
    var Fs = require('fire-fs');
    Fs.exists(scriptPath, function (exists) {
        if (exists) {
            doLoad(scriptPath, next);
        }
        else {
            next();
        }
    });
}
