Fire.JS.get(Fire, '$0', function () {
    var selection = Editor.Selection.curSelection('node');
    if (selection.length > 0) {
        var id = selection[0];
        var node = Fire.engine.getRuntimeInstanceById(id);
        return Fire.node(node);
    }
});

Fire.JS.get(Fire, '$s', function () {
    return Fire.node(Fire.engine.getCurrentScene());
});
