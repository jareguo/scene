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

        this._designWidth = 0;
        this._designHeight = 0;
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
            self._isInitialized = true;
            self._isInitializing = false;

            callback(err);

            if (CC_EDITOR) {
                // start main loop for editor after initialized
                self._tickStart();
                // start timer to force repaint the scene in edit mode
                //noinspection SillyAssignmentJS
                self.forceRepaintIntervalInEM = self.forceRepaintIntervalInEM;
            }
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
                'jsList'                : [],
                'noCache'               : true,
            };

        cc.game.run(config, function () {
            if (CC_EDITOR) {
                cc.view.enableRetina(false);
                cc.game.canvas.style.imageRendering = 'pixelated';
                cc.director.setClearColor(cc.color(0,0,0,0));
            }

            cc.view.setDesignResolutionSize(options.designWidth, options.designHeight, cc.ResolutionPolicy.SHOW_ALL);
            cc.view.setCanvasSize(config.width, config.height);

            var scene = new cc.EScene();
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
     * @param {boolean} updateAnimate
     */
    tick: function (deltaTime, updateAnimate) {
        cc.director.mainLoop(deltaTime, updateAnimate);
    },

    /**
     * This method will be invoked in edit mode even if useDefaultMainLoop is false.
     * @method tickInEditMode
     * @param {number} deltaTime
     * @param {boolean} updateAnimate
     */
    tickInEditMode: function (deltaTime, updateAnimate) {
        if (CC_EDITOR) {
            cc.director.mainLoop(deltaTime, updateAnimate);
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

        function testNodeWithSize (node, size) {
            if (size.width === 0 || size.height === 0) return false;

            var bounds = node.getWorldBounds(size);

            // if intersect aabb success, then try intersect obb
            if (rect.intersects(bounds)) {
                bounds = node.getWorldOrientedBounds(size);
                var polygon = new Editor.Polygon(bounds);

                if (Editor.Intersection.rectPolygon(rect, polygon)) {
                    return true;
                }
            }

            return false;
        }

        deepQueryChildren(scene, function (child) {
            if (testNodeWithSize(child, child.getContentSize())) {
                list.push(child);
                return true;
            }

            var components = child._components;

            for (var i = 0, l = components.length; i < l; i++) {
                var component = components[i];
                var size = component.localSize;

                if (testNodeWithSize(child, size)) {
                    list.push(child);
                    break;
                }
            }

            return true;
        });

        return list;
    },

    // set the user defined desigin resolution for current scene
    setDesignResolutionSize: function (width, height, resolutionPolicy) {
        this._designWidth = width;
        this._designHeight = height;
        this.emit('design-resolution-changed');
    },

    // returns the desigin resolution set before
    getDesignResolutionSize: function () {
        return cc.size(this._designWidth, this._designHeight);
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
    },

    // reset engine state
    reset: function () {
        cc.game._prepared = false;
        cc.game._prepareCalled = false;
        cc.game._rendererInitialized = false;
        cc.textureCache._clear();
        cc.loader.releaseAll();
        // cc.shaderCache._programs = {};
        // cc.Director.firstUseDirector = true;
        // cc.EGLView._instance = null;

        // reset gl state
        // cc._currentProjectionMatrix = -1;
        cc._vertexAttribPosition = false;
        cc._vertexAttribColor = false;
        cc._vertexAttribTexCoords = false;
        // if (cc.ENABLE_GL_STATE_CACHE) {
        //     cc._currentShaderProgram = -1;
        //     for (var i = 0; i < cc.MAX_ACTIVETEXTURE; i++) {
        //         cc._currentBoundTexture[i] = -1;
        //     }
        //     cc._blendingSource = -1;
        //     cc._blendingDest = -1;
        //     cc._GLServerState = 0;
        // }
    }
});

cc.engine = new EditorEngine(false);

module.exports = EditorEngine;
