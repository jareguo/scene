"use strict";

cc.js.get(cc, '$0', function () {
    var selection = Editor.Selection.curSelection('node');
    if (selection.length > 0) {
        var id = selection[0];
        var node = cc.engine.getInstanceById(id);
        return node;
    }
});

// cc.$c0, cc.$c1, ...
for (let i = 0; i < 5; ++i) {
    cc.js.get(cc, '$c' + i, function () {
        var selected = cc.$0;
        if (selected) {
            return selected._components[i];
        }
    });
}

cc.js.get(cc, '$s', function () {
    return cc.director.getScene();
});

cc.js.get(cc, '$S', function () {
    return cc.director.getScene();
});

