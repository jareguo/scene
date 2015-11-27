'use strict';

const Record = Editor.require('app://editor/share/engine-extends/record-object');

/**
 * info = {
 *   before: [{id, data}],
 *   after: [{id, data}],
 * }
 */
class RecordObjectsCommand extends Editor.Undo.Command {
    undo () {
        let nodeIDs = [];

        this.info.before.forEach(objInfo => {
            let obj = cc.engine.getInstanceById(objInfo.id);
            Record.RestoreObject( obj, objInfo.data );

            //
            let node = null;
            if ( obj instanceof cc.ENode ) {
                node = obj;
            } else if ( obj instanceof cc.Component ) {
                node = obj.node;
            }

            //
            if ( node && nodeIDs.indexOf( node.uuid ) === -1 ) {
                nodeIDs.push( node.uuid );
            }

            Editor.Selection.select( 'node', nodeIDs );
        });
    }

    redo () {
        let nodeIDs = [];

        this.info.after.forEach(objInfo => {
            let obj = cc.engine.getInstanceById(objInfo.id);
            Record.RestoreObject( obj, objInfo.data );

            //
            let node = null;
            if ( obj instanceof cc.ENode ) {
                node = obj;
            } else if ( obj instanceof cc.Component ) {
                node = obj.node;
            }

            //
            if ( node && nodeIDs.indexOf( node.uuid ) === -1 ) {
                nodeIDs.push( node.uuid );
            }

            Editor.Selection.select( 'node', nodeIDs );
        });
    }
}

/**
 * info = {
 *   list: [{node, parent}]
 * }
 */
class CreateObjectsCommand extends Editor.Undo.Command {
    undo () {
        let nodeIDs = [];
        this.info.list.forEach(info => {
            info.node.parent = null;
            nodeIDs.push(info.node.uuid);
        });
        Editor.Selection.unselect('node', nodeIDs);
    }

    redo () {
        let nodeIDs = [];
        this.info.list.forEach(info => {
            info.node.parent = info.parent;
            nodeIDs.push(info.node.uuid);
        });
        Editor.Selection.select('node', nodeIDs);
    }
}

/**
 * info = {
 *   list: [{node, parent}]
 * }
 */
class DeleteObjectsCommand extends Editor.Undo.Command {
    undo () {
        let nodeIDs = [];
        this.info.list.forEach(info => {
            info.node.parent = info.parent;
            nodeIDs.push(info.node.uuid);
        });
        Editor.Selection.select('node', nodeIDs);
    }

    redo () {
        let nodeIDs = [];
        this.info.list.forEach(info => {
            info.node.parent = null;
            nodeIDs.push(info.node.uuid);
        });
        Editor.Selection.unselect('node', nodeIDs);
    }
}

/**
 * SceneUndo
 */

let _currentCreatedRecords = [];
let _currentDeletedRecords = [];
let _currentRecords = [];
let _undo = Editor.Undo.local();

let SceneUndo = {
    init () {
        _undo.register( 'record-objects', RecordObjectsCommand );
        _undo.register( 'create-objects', CreateObjectsCommand );
        _undo.register( 'delete-objects', DeleteObjectsCommand );

        _currentCreatedRecords = [];
        _currentRecords = [];
    },

    recordObject ( id, desc ) {
        if ( desc ) {
            _undo.setCurrentDescription(desc);
        }

        // only record object if it has not recorded yet
        let exists = _currentRecords.some( info => {
            return info.id === id;
        });
        if ( !exists ) {
            let obj = cc.engine.getInstanceById(id);
            let data = Record.RecordObject(obj);

            _currentRecords.push({
                id: id,
                data: data,
            });
        }
    },

    recordCreatedNode ( id, desc ) {
        if ( desc ) {
            _undo.setCurrentDescription(desc);
        }

        // only record object if it has not recorded yet
        let exists = _currentCreatedRecords.some(info => {
            return info.node.id === id;
        });
        if ( !exists ) {
            let node = cc.engine.getInstanceById(id);
            _currentCreatedRecords.push({
                node: node,
                parent: node.parent,
            });
        }
    },

    recordDeletedNode ( id, desc ) {
        if ( desc ) {
            _undo.setCurrentDescription(desc);
        }

        // only record object if it has not recorded yet
        let exists = _currentDeletedRecords.some(info => {
            return info.node.id === id;
        });
        if ( !exists ) {
            let node = cc.engine.getInstanceById(id);
            _currentDeletedRecords.push({
                node: node,
                parent: node.parent,
            });
        }
    },

    commit () {
        // flush created records
        if ( _currentCreatedRecords.length ) {
            _undo.add('create-objects', {
                list: _currentCreatedRecords
            });

            _currentCreatedRecords = [];
        }

        // flush records
        if ( _currentRecords.length ) {
            let beforeList = _currentRecords;
            let afterList = _currentRecords.map( info => {
                let obj = cc.engine.getInstanceById(info.id);
                return {
                    id: info.id,
                    data: Record.RecordObject(obj),
                };
            });

            _undo.add('record-objects', {
                before: beforeList,
                after: afterList,
            });

            _currentRecords = [];
        }

        // flush deleted records
        if ( _currentDeletedRecords.length ) {
            _undo.add('delete-objects', {
                list: _currentDeletedRecords
            });

            _currentDeletedRecords = [];
        }

        //
        _undo.commit();
    },

    undo () {
        _undo.undo();
        cc.engine.repaintInEditMode();
    },

    redo () {
        _undo.redo();
        cc.engine.repaintInEditMode();
    },
};

module.exports = SceneUndo;

