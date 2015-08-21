var Path = require('path');
var Fs = require('fire-fs');
var FireUrl = require('fire-url');

var sysRequire = require;
var builtinClassIds;
var builtinClassNames;
var builtinComponentMenus;
var builtinCustomAssetMenus;

var initialized = false;
var loadedScriptNodes = [];

function init () {
    //sandbox.globalVarsChecker = new GlobalVarsChecker().record();
    builtinClassIds = Fire.JS._registeredClassIds;
    builtinClassNames = Fire.JS._registeredClassNames;
    //builtinComponentMenus = Fire._componentMenuItems.slice();
    //builtinCustomAssetMenus = Fire._customAssetMenuItems.slice();
}

function reset () {
    // clear
    Fire.FObject._deferredDestroy();
    //// reset menus
    //Fire._componentMenuItems = builtinComponentMenus.slice();
    //Fire._customAssetMenuItems = builtinCustomAssetMenus.slice();
    //// Editor.MainMenu.reset();
    // remove user classes
    Fire.JS._registeredClassIds = builtinClassIds;
    Fire.JS._registeredClassNames = builtinClassNames;
    ////
    Fire.LoadManager.reset();
    // 清除 browserify 声明的 require 后，除非用户另外找地方存了原来的 require，否则之前的脚本都将会被垃圾回收
    require = sysRequire;
    Fire._RFreset();
}

var sandbox = {
    reload: function () {
        Editor.stashScene(function (err, json) {
            // reload connected browser
            Editor.sendToCore('app:reload-on-device');

            //
            reset();

            // reload
            Editor.initScene();
        });
    },

    loadCompiledScript: function (next) {
        if ( Editor.remote.Compiler.state !== 'idle' ) {
            setTimeout( function () {
                sandbox.loadCompiledScript(next);
            }, 50 );
            return;
        }

        if (!initialized) {
            initialized = true;
            init();
        }

        function doLoad (src, cb) {
            var script = document.createElement('script');
            script.onload = function () {
                console.timeEnd('load ' + src);
                cb();
            };
            script.onerror = function () {
                console.timeEnd('load ' + src);
                if (loadedScriptNodes.length > 0) {
                    loader.unloadAll();
                }
                console.error('Failed to load %s', src);
                cb(new Error('Failed to load ' + src));
            };
            script.setAttribute('type','text/javascript');
            script.setAttribute('charset', 'utf-8');
            script.setAttribute('src', FireUrl.addRandomQuery(src));
            console.time('load ' + src);
            document.head.appendChild(script);
            loadedScriptNodes.push(script);
        }
        var scriptPath = Path.join(Editor.libraryPath, 'bundle.project.js');
        Fs.exists(scriptPath, function (exists) {
            if (exists) {
                doLoad(scriptPath, next);
            }
            else {
                next();
            }
        });
    },

    unloadCompiledScript: function (next) {
        // remove script element
        for (var i = 0; i < loadedScriptNodes.length; i++) {
            var node = loadedScriptNodes[i];
            node.remove();
        }
        loadedScriptNodes.length = 0;
    }
};

module.exports = sandbox;
