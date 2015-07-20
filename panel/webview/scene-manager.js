var Async = require('async');

function enterEditMode ( stashedScene, next ) {
    if ( stashedScene ) {
        // restore selection
        var selection = [];
        var pathIDsList = stashedScene.sceneSelection;
        pathIDsList.forEach( function ( pathIDs ) {
            var node = findByPathIDs ( pathIDs );
            if ( node ) {
                selection.push(node.id);
            }
        });
        Editor.Selection.select('node', selection, true, true);

        // restore scene view

        window.sceneView.init(stashedScene.sceneOffsetX,
                              stashedScene.sceneOffsetY,
                              stashedScene.sceneScale );
    }

    Editor.remote.stashedScene = null;
    next();
}

function createScene (sceneJson, next) {
    // Assets will be loaded by SceneWrapper.prototype.create, here we just deserialize the scene graph
    var scene = Fire.deserialize(sceneJson);
    Fire.engine._initScene(scene, function () {
        next(null, scene);
    });
}

function getPathIDs ( wrapper ) {
    var pathIDs = [];
    for (var w = wrapper; w && !w.isScene; w = w.parent) {
        pathIDs.push(w.getSiblingIndex());
    }
    return pathIDs.reverse();
}

function findByPathIDs ( pathIDs ) {
    // getCurrentScene
    var scene = Fire.engine.getCurrentScene();
    var node;
    for ( var i = 0, children = scene.childrenN;
          i < pathIDs.length;
          i++, children = node.childrenN )
    {
        var index = pathIDs[i];
        if (index < children.length) {
            node = Fire(children[index]);
            continue;
        }
        return null;
    }
    return node;
}

Editor.initScene = function (callback) {
    var stashedScene = Editor.remote.stashedScene; // a remote sync method
    var sceneJson = stashedScene ? stashedScene.sceneJson : null;
    if (sceneJson) {
        // load last editing scene
        Async.waterfall(
            [
                loadCompiledScript,
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
            loadCompiledScript,

            function ( next ) {
                var currentSceneUuid = Editor.remote.currentSceneUuid;
                if ( currentSceneUuid ) {
                    Fire.engine._loadSceneByUuid(currentSceneUuid, function ( err ) {
                        Fire.engine.repaintInEditMode();
                        next ( err, null );
                    });
                    return;
                }

                next( null, null );
            },

            enterEditMode,
        ], callback );
    }
};

Editor.stashScene = function (next) {
    // get scene json
    var scene = Fire.engine.getCurrentScene();
    var jsonObj = Editor.serialize(scene, {stringify: false});

    // store selection
    var selection = Editor.Selection.curSelection('node');
    var paths = [];
    for ( var i = 0; i < selection.length; ++i ) {
        paths.push( getPathIDs( Fire.engine.getInstanceById(selection[i]) ) );
    }

    // store the scene, scene-view postion, scene-view scale
    Editor.remote.stashedScene = {
        sceneJson: jsonObj,
        sceneScale: window.sceneView.scale,
        sceneOffsetX: window.sceneView.$.grid.xAxisOffset,
        sceneOffsetY: window.sceneView.$.grid.yAxisOffset,
        sceneSelection: paths,
    };

    // reset scene view
    window.sceneView.reset();

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
