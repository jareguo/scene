cc.js.get(cc, '$0', function () {
    var selection = Editor.Selection.curSelection('node');
    if (selection.length > 0) {
        var id = selection[0];
        var node = cc.engine.getInstanceById(id);
        return node;
    }
});

cc.js.get(cc, '$0N', function () {
    var wrapper = cc.$0;
    if (wrapper) {
        return wrapper.targetN;
    }
});

cc.js.get(cc, '$s', function () {
    return cc(cc.director.getRunningScene());
});

cc.js.get(cc, '$S', function () {
    return cc(cc.director.getRunningScene());
});

cc.js.get(cc, '$SN', function () {
    return cc.director.getRunningScene();
});
