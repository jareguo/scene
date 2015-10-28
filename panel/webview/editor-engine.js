'use strict';

var Ticker = cc._Ticker;
var Time = cc.Time;

var EditorEngine = cc.Class({
    name: 'EditorEngine',
    extends: cc.Playable,

    ctor: function () {
        var useDefaultMainLoop = arguments[0];

        /**
         * We should use this id to cancel ticker, otherwise if the engine stop and replay immediately,
         * last ticker will not cancel correctly.
         *
         * @property _requestId
         * @type {number}
         * @private
         */
        this._requestId = -1;

        this._useDefaultMainLoop = useDefaultMainLoop;
        this._isInitializing = false;
        this._isInitialized = false;

        // current scene
        this._loadingScene = '';
        // temp sg scene
        this._emptySgScene = null;

        this._bindedTick = (CC_EDITOR || useDefaultMainLoop) && this._tick.bind(this);

        //this._isLockingScene = false;

        /**
         * The maximum value the Time.deltaTime in edit mode.
         * @property maxDeltaTimeInEM
         * @type {Number}
         * @private
         */
        this.maxDeltaTimeInEM = 1 / 30;
        /**
         * Is playing animation in edit mode.
         * @property animatingInEditMode
         * @type {Boolean}
         * @private
         */
        this.animatingInEditMode = false;

        this._shouldRepaintInEM = false;
        this._forceRepaintId = -1;

        // attached nodes and components used in getInstanceById
        this.attachedObjsForEditor = {};
    },

    properties: {
        /**
         * @property {boolean} isInitialized - Indicates whether the engine instance is initialized.
         * @readOnly
         */
        isInitialized: {
            get: function () {
                return this._isInitialized;
            }
        },

        /**
         * @property {boolean} loadingScene
         * @readOnly
         */
        loadingScene: {
            get: function () {
                return this._loadingScene;
            }
        },

        /**
         * The interval(ms) every time the engine force to repaint the scene in edit mode.
         * If don't need, set this to 0.
         * @property forceRepaintIntervalInEM
         * @type {Number}
         * @private
         */
        forceRepaintIntervalInEM: {
            default: 500,
            notify: CC_EDITOR && function () {
                if (this._forceRepaintId !== -1) {
                    clearInterval(this._forceRepaintId);
                }
                if (this.forceRepaintIntervalInEM > 0) {
                    var self = this;
                    this._forceRepaintId = setInterval(function () {
                        self.repaintInEditMode();
                    }, this.forceRepaintIntervalInEM);
                }
            }
        }
    },

    // PUBLIC

    /**
     * Initialize the engine. This method will be called by boot.js or editor.
     * @method init
     * @param {object} options
     * @param {number} options.width
     * @param {number} options.height
     * @param {string} options.rawUrl
     * @param {Canvas} [options.canvas]
     * @param {initCallback} callback
     */
    init: function (options, callback) {
        if (this._isInitializing) {
            cc.error('Editor Engine already initialized');
            return;
        }
        this._isInitializing = true;

        //if (options.rawUrl) {
        //    cc.url.rawUrl = cc.path._setEndWithSep(options.rawUrl, true, '/');
        //}
        //Resources._resBundle.init(options.resBundle);

        var self = this;
        this.createGame(options, function (err) {
            if (!err) {
                if (CC_EDITOR && Editor.isPageLevel) {
                    Editor.registerComponentsToCore();
                }
            }

            self._isInitialized = true;
            self._isInitializing = false;

            cc.view.setDesignResolutionSize(options.designWidth, options.designHeight, cc.ResolutionPolicy.SHOW_ALL);

            callback(err);

            if (CC_EDITOR) {
                // start main loop for editor after initialized
                self._tickStart();
                // start timer to force repaint the scene in edit mode
                self.forceRepaintIntervalInEM = self.forceRepaintIntervalInEM;
            }

            // create empty scene
            var scene = new cc.Scene();
            self._emptySgScene = scene;
        });
    },

    createGame: function (options, callback) {
        var config = {
                'width'                 : options.width,
                'height'                : options.height,
                'showFPS'               : false,
                'frameRate'             : 60,
                'id'                    : options.id,
                'renderMode'            : cc.isEditor ? 2 : options.renderMode,                 // 0: auto, 1:Canvas, 2:Webgl
                'registerSystemEvent'   : ! cc.isEditor,
                'jsList'                : []
            };

        cc.game.run(config, function () {
            var scene = new cc.EScene();

            // scene anchor point need be 0,0
            scene.setAnchorPoint(0.0, 0.0);

            if (CC_EDITOR) {
                cc.view.enableRetina(false);
                cc.game.canvas.style.imageRendering = 'pixelated';
                cc.director.setClearColor(cc.color(0,0,0,0));
            }
            cc.view.setCanvasSize(config.width, config.height);

            cc.director.runScene(scene);
            cc.game.pause();

            if (CC_EDITOR) {
                // set cocos canvas tabindex to -1 in edit mode
                cc.game.canvas.setAttribute('tabindex', -1);
                cc.game.canvas.style.backgroundColor = '';
                if (cc.imeDispatcher._domInputControl)
                    cc.imeDispatcher._domInputControl.setAttribute('tabindex', -1);
            }

            if (callback) {
                callback();
            }
        });
    },

    playInEditor: function () {
        if (CC_EDITOR) {
            cc.inputManager.registerSystemEvent(cc.game.canvas);

            // reset cocos tabindex in playing mode
            cc.game.canvas.setAttribute('tabindex', 99);
            cc.game.canvas.style.backgroundColor = 'black';
            if (cc.imeDispatcher._domInputControl)
                cc.imeDispatcher._domInputControl.setAttribute('tabindex', 2);
        }

        cc.director.resume();
    },

    /**
     * This method will be invoke only if useDefaultMainLoop is true.
     * @method tick
     * @param {number} deltaTime
     * @param {boolean} updateLogic
     */
    tick: function (deltaTime, updateLogic) {
        if (updateLogic) {
            cc.director.gameUpdate(deltaTime);
            cc.director.engineUpdate(deltaTime);
            this.emit('post-update');
        }
        cc.director.visit(deltaTime);
        cc.director.render(deltaTime);
    },

    /**
     * This method will be invoked in edit mode even if useDefaultMainLoop is false.
     * @method tickInEditMode
     * @param {number} deltaTime
     * @param {boolean} updateAnimate
     */
    tickInEditMode: function (deltaTime, updateAnimate) {
        if (CC_EDITOR) {
            // invoke updateInEditMode
            //cc.director.getScene()._callUpdateInEM(deltaTime);

            if (updateAnimate) {
                cc.director.engineUpdate(deltaTime);
            }
            this.emit('post-update');
            cc.director.visit();
            cc.director.render();
        }
    },

    repaintInEditMode: function () {
        if (CC_EDITOR && !this._isUpdating) {
            this._shouldRepaintInEM = true;
        }
    },

    /**
     * Returns the node by id.
     * @method getInstanceById
     * @param {String} uuid
     * @return {cc.ENode}
     */
    getInstanceById: function (uuid) {
        return this.attachedObjsForEditor[uuid] || null;
    },

    getIntersectionList: function (rect) {
        var scene = cc.director.getScene();
        var list = [];

        function deepQueryChildren (root, cb) {
            function traversal (node, cb) {
                var children = node.children;

                for (var i = 0; i<children.length; i++) {
                    var child = children[i];

                    if (!cb( child )) break;

                    traversal(child, cb);
                }
            }

            traversal(root, cb);
        }

        deepQueryChildren(scene, function (child) {

            var bounds = child.getWorldBounds();

            // if intersect aabb success, then try intersect obb
            if (rect.intersects(bounds)) {
                bounds = child.getWorldOrientedBounds();
                var polygon = new Editor.Polygon(bounds);

                if (Editor.Intersection.rectPolygon(rect, polygon)) {
                    list.push(child);
                }
            }

            return true;
        });

        return list;
    },

    // OVERRIDE

    onError: function (error) {
        if (CC_EDITOR) {
            switch (error) {
                case 'already-playing':
                    cc.warn('Fireball is already playing');
                    break;
            }
        }
    },
    onResume: function () {
        if (CC_EDITOR) {
            cc.Object._clearDeferredDestroyTimer();
        }
        cc.game.resume();

        if ((CC_EDITOR || CC_TEST) && !this._useDefaultMainLoop) {
            this._tickStop();
        }
    },
    onPause: function () {
        // if (CC_EDITOR) {
        //     editorCallback.onEnginePaused();
        // }
        cc.game.pause();

        if (CC_EDITOR) {
            // start tick for edit mode
            this._tickStart();
        }
    },
    onPlay: function () {
        if (CC_EDITOR && ! this._isPaused) {
            cc.Object._clearDeferredDestroyTimer();
        }

        this.playInEditor();

        this._shouldRepaintInEM = false;
        if (this._useDefaultMainLoop) {
            // reset timer for default main loop
            var now = Ticker.now();
            Time._restart(now);
            //
            this._tickStart();
        }
        else if (CC_EDITOR) {
            // dont tick in play mode
            this._tickStop();
        }

        //if (CC_EDITOR) {
        //    editorCallback.onEnginePlayed(false);
        //}
    },

    onStop: function () {
        //CCObject._deferredDestroy();

        cc.game.pause();

        // reset states
        this._loadingScene = ''; // TODO: what if loading scene ?

        if (CC_EDITOR) {
            // start tick for edit mode
            this.repaintInEditMode();
            this._tickStart();
        }

        //if (CC_EDITOR) {
        //    editorCallback.onEngineStopped();
        //}
    },

    // PRIVATE

    /**
     * @method _tick
     * @private
     */
    _tick: function () {
        this._requestId = Ticker.requestAnimationFrame(this._bindedTick);

        var now = Ticker.now();
        if (this._isUpdating || this._stepOnce) {
            // play mode

            //if (sceneLoadingQueue) {
            //    return;
            //}
            Time._update(now, false, this._stepOnce ? 1 / 60 : 0);
            this._stepOnce = false;

            //if (this._scene) {
                this.tick(Time.deltaTime, true);
            //}
        }
        else if (CC_EDITOR) {
            // edit mode
            Time._update(now, false, this.maxDeltaTimeInEM);
            if (this._shouldRepaintInEM || this.animatingInEditMode) {
                this.tickInEditMode(Time.deltaTime, this.animatingInEditMode);
                this._shouldRepaintInEM = false;
            }
        }
    },

    _tickStart: function () {
        if (this._requestId === -1) {
            this._tick();
        }
    },

    _tickStop: function () {
        if (this._requestId !== -1) {
            Ticker.cancelAnimationFrame(this._requestId);
            this._requestId = -1;
        }
    }
});

cc.engine = new EditorEngine(false);

module.exports = EditorEngine;
