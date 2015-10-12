Fire.JS.get(Fire, '$0', function () {
    var selection = Editor.Selection.curSelection('node');
    if (selection.length > 0) {
        var id = selection[0];
        var node = Fire.engine.getInstanceById(id);
        return node;
    }
});

Fire.JS.get(Fire, '$0N', function () {
    var wrapper = Fire.$0;
    if (wrapper) {
        return wrapper.targetN;
    }
});

Fire.JS.get(Fire, '$s', function () {
    return cc(cc.director.getRunningScene());
});

Fire.JS.get(Fire, '$S', function () {
    return cc(cc.director.getRunningScene());
});

Fire.JS.get(Fire, '$SN', function () {
    return cc.director.getRunningScene();
});
