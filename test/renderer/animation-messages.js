Editor.require('app://editor/test-utils/renderer/init');
var IpcHandler = Editor.require('app://builtin/scene/panel/scene-ipc-handler');

Helper.runGame();

describe('scene messages', function () {
    Helper.runPanel( 'scene.panel' );

    var node,
        animation,
        state,
        clip;

    beforeEach(function () {
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
    });


    describe('scene:animation-state-changed', function () {
        it('should play animation if origin state is \'stop\' and current state is \'play\'', function () {
            expect(state.isPlaying).to.be.false;
            expect(state.isPaused).to.be.false;

            Helper.recv('scene:animation-state-changed', {
                nodeId: node.uuid,
                clip: clip.name,
                state: 'play'
            });

            expect(state.isPlaying).to.be.true;
        });

        it('should pause animation if current state is \'pause\'', function () {
            animation.play(clip.name);

            expect(state.isPlaying).to.be.true;
            expect(state.isPaused).to.be.false;

            Helper.recv('scene:animation-state-changed', {
                nodeId: node.uuid,
                clip: clip.name,
                state: 'pause'
            });

            expect(state.isPaused).to.be.true;
        });

        it('should play animation if origin state is \'pause\' and current state is \'play\'', function () {
            animation.play(clip.name);
            animation.pause(clip.name);

            expect(state.isPlaying).to.be.true;
            expect(state.isPaused).to.be.true;

            Helper.recv('scene:animation-state-changed', {
                nodeId: node.uuid,
                clip: clip.name,
                state: 'play'
            });

            expect(state.isPaused).to.be.false;
        });
    });

    describe('scene:query-animation-time', function () {
        it('should get current time from message \'scene:reply-animation-time\'', function (done) {
            state.setTime(1.5);

            Helper.spyChannels( 'sendToWindows', [
                'scene:reply-animation-time'
            ]);

            Helper.recv('scene:query-animation-time', 0, {
                nodeId: node.uuid,
                clip: clip.name
            });

            setTimeout(() => {
                assert( Helper.sendToWindows.calledWith('scene:reply-animation-time', 0, {clip: clip.name, time: 1.5}) );
                done();
            }, 10);
        });
    });

    describe('scene:animation-time-changed', function () {
        it('should change time when \'scene:animation-time-changed\' emit', function () {

            expect(state.time).to.equal(0);
            expect(node.x).to.equal(0);

            Helper.recv('scene:animation-time-changed', {
                nodeId: node.uuid,
                clip: clip.name,
                time: 0.2
            });

            expect(state.time).to.equal(0.2);
            expect(node.x).to.equal(20);
        });
    });

    describe('scene:animation-clip-changed', function () {
        it('should change and apply clip when \'scene:animation-clip-changed\' emit', function () {
            animation.play(clip.name, 0.4);

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

            Helper.recv('scene:animation-clip-changed', {
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
