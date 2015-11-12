"use strict";

cc.js.get(cc, '$0', function () {
    var selection = Editor.Selection.curSelection('node');
    if (selection.length > 0) {
        var id = selection[0];
        var node = cc.engine.getInstanceById(id);
        return node;
    }
});

cc.js.get(cc, '$c', function () {
    var selected = cc.$0;
    if (selected) {
        return selected._components[0];
    }
});

// cc.$c1, cc.$c2, ...
for (let i = 1; i < 5; ++i) {
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

