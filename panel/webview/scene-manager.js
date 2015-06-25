var Async = require('async');

function enterEditMode (next) {
    Editor.remote.stashedScene = null;
    // TODO - restore selection (gizmo)
    next();
}

Editor.initScene = function (callback) {
    var sceneJson = Editor.remote.currentStash; // a remote sync method
    if (sceneJson) {
        Async.waterfall(
            [
                function (next) {
                    // 依赖资源由 SceneWrapper.prototype.create 加载，这里只需要反序列化出来就行
                    var scene = Fire.deserialize(sceneJson);
                    next(null, scene);
                },
                function (scene, next) {
                    Fire.Engine._initScene(scene, function () {
                        next(null, scene);
                    });
                },
                function (scene, next) {
                    Fire.Engine._launchScene(scene);
                    next();
                },
                enterEditMode,
            ],
            callback
        );
    }
    else {
        enterEditMode(callback);
    }
};


function dumpScene (next) {
    var scene = Fire.Engine.getCurrentScene();
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
    var scene = Fire.Engine.getCurrentScene();
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
                Fire.Engine.play();
                next();
            },
        ],
        callback
    );
};

