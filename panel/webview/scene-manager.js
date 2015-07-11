var Async = require('async');

function enterEditMode (next) {
    Editor.remote.stashedScene = null;
    // TODO - restore selection (gizmo)
    next();
}

Editor.initScene = function (callback) {
    var sceneJson = Editor.remote.stashedScene; // a remote sync method
    if (sceneJson) {
        // load last editing scene
        Async.waterfall(
            [
                loadCompiledScript,
                function (next) {
                    // Assets will be loaded by SceneWrapper.prototype.create, here we just deserialize the scene graph
                    var scene = Fire.deserialize(sceneJson);
                    next(null, scene);
                },
                function (scene, next) {
                    Fire.engine._initScene(scene, function () {
                        next(null, scene);
                    });
                },
                function (scene, next) {
                    Fire.engine._launchScene(scene);
                    next();
                },
                enterEditMode,
            ],
            callback
        );
    }
    else {
        // empty scene
        loadCompiledScript(function () {
            enterEditMode(callback);
        });
    }
};


function dumpScene (next) {
    var scene = Fire.engine.getCurrentScene();
    var sceneJson = Editor.serialize(scene, {stringify: false});
    next(null, sceneJson);
}

function stashScene (jsonObj, next) {
    // TODO - including current-selection, editor-camera...
    Editor.remote.stashedScene = jsonObj;
    next();
}

function enterGameMode (next) {
    // reset scene camera
    var scene = Fire.engine.getCurrentScene();
    scene.position = Fire.Vec2.zero;
    scene.scale = Fire.Vec2.one;
    // TODO - clear selection (gizmo)
    next();
}

Editor.playScene = function (callback) {
    Async.waterfall(
        [
            dumpScene,
            stashScene,
            enterGameMode,
            function (next) {
                Fire.engine.play();
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
