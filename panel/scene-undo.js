'use strict';

const Record = Editor.require('app://editor/share/engine-extends/record-object');

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

let _needFlushRecords = false;
let _currentRecords = [];
let _undo = Editor.Undo.local();

let SceneUndo = {
    init () {
        _undo.register( 'record-objects', RecordObjectsCommand );
        _currentRecords = [];
        _needFlushRecords = false;
    },

    recordObject ( id, desc ) {
        _needFlushRecords = true;

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

    commit () {
        // flush records
        if ( _needFlushRecords ) {
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
            _needFlushRecords = false;
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

