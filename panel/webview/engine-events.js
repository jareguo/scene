Fire.engine.on('node-attach-to-scene', function ( event ) {
    var fireNode = Fire.node(event.detail.runtimeTarget);
    console.log( 'attach fireNode ', fireNode );
});

Fire.engine.on('node-detach-from-scene', function ( event ) {
    var fireNode = Fire.node(event.detail.runtimeTarget);
    console.log( 'detach fireNode ', fireNode );
});
