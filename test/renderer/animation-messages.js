Editor.require('app://editor/test-utils/renderer/init');
var IpcHandler = Editor.require('app://builtin/scene/panel/scene-ipc-handler');

describe('scene messages', function () {
    var messages = [
        'scene:animation-state-changed',
        'scene:query-animation-time',
        'scene:animation-time-changed',
        'scene:animation-clip-changed'
    ];

    Helper.runGame(100,100);

    var node,
        animation,
        state,
        clip;

    function init () {
        node = new cc.ENode();
        animation = node.addComponent(cc.AnimationComponent);

        clip = Helper.newAnimClip('test', 2, {
            props: {
                x: [
                    {frame: 0, value: 0},
                    {frame: 1, value: 100},
                    {frame: 2, value: 200}
                ]
            }
        });

        animation.addClip(clip);
        state = animation.getAnimationState(clip.name);

        cc.engine.attachedObjsForEditor[node.uuid] = node;
    }


    describe(messages[0], function () {
        var handler;
        before(function () {
            init();
            handler = IpcHandler[ messages[0] ];
        });

        it('should play animation if origin state is \'stop\' and current state is \'play\'', function () {
            expect(state.isPlaying).to.be.false;
            expect(state.isPaused).to.be.false;

            handler({
                nodeId: node.uuid,
                clip: clip.name,
                state: 'play'
            });

            expect(state.isPlaying).to.be.true;
        });

        it('should pause animation if current state is \'pause\'', function () {
            expect(state.isPlaying).to.be.true;
            expect(state.isPaused).to.be.false;

            handler({
                nodeId: node.uuid,
                clip: clip.name,
                state: 'pause'
            });

            expect(state.isPaused).to.be.true;
        });

        it('should play animation if origin state is \'pause\' and current state is \'play\'', function () {
            expect(state.isPlaying).to.be.true;
            expect(state.isPaused).to.be.true;

            handler({
                nodeId: node.uuid,
                clip: clip.name,
                state: 'play'
            });

            expect(state.isPaused).to.be.false;
        });
    });

    describe(messages[1], function () {
        var Ipc = require('ipc');

        before(init);

        it('should get current time from message \'scene:reply-animation-time\'', function (done) {
            state.setTime(1.5);

            Ipc.on(messages[1], function () {
                var handler = IpcHandler[messages[1]];
                handler.apply(this, arguments);
            });

            Editor.sendToWindows(messages[1], 0, {
                nodeId: node.uuid,
                clip: clip.name
            });

            Ipc.on('scene:reply-animation-time', function (sessionID, info) {
                expect(info.time).to.equal(1.5);
                done();
            });
        });
    });

    describe(messages[2], function () {
        before(init);

        it('should change time when \'scene:animation-time-changed\' emit', function () {
            var handler = IpcHandler[ messages[2] ];

            expect(state.time).to.equal(0);
            expect(node.x).to.equal(0);

            handler({
                nodeId: node.uuid,
                clip: clip.name,
                time: 0.2
            });

            expect(state.time).to.equal(0.2);
            expect(node.x).to.equal(20);
        });
    });


    describe(messages[3], function () {
        before(function () {
            init();
            animation.play(clip.name, 0.4);
        });

        it('should change and apply clip when \'scene:animation-clip-changed\' emit', function () {
            var handler = IpcHandler[ messages[3] ];

            var newClip = Helper.newAnimClip('test', 2, {
                props: {
                    x: [
                        {frame: 0, value: 1000},
                        {frame: 1, value: 100},
                        {frame: 2, value: 200}
                    ]
                }
            });

            expect(node.x).to.equal(0);

            handler({
                nodeId: node.uuid,
                clip: clip.name,
                data: newClip.serialize()
            });

            expect(node.x).to.equal(640);

            var newState = animation.getAnimationState(newClip.name);
            expect(newState).not.to.equal(state);
            expect(newState.time).to.equal(0.4);
        });
    });

});
