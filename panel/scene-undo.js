'use strict';

const Record = Editor.require('app://editor/share/engine-extends/record-object');

class RecordObjectCommand extends Editor.Undo.Command {
    undo () {
        let obj = cc.engine.getInstanceById(this.info.id);
        Record.RestoreObject( obj, this.info.before );

        // TODO: select node
        // if ( obj instanceof cc.Component ) {
        //     obj.node
        // }
    }

    redo () {
        let obj = cc.engine.getInstanceById(this.info.id);
        Record.RestoreObject( obj, this.info.after );

        // TODO: select node
        // if ( obj instanceof cc.Component ) {
        //     obj.node
        // }
    }
}

let _needFlushRecords = false;
let _currentRecords = {};
let _undo = Editor.Undo.local();

let SceneUndo = {
    init () {
        _undo.register( 'record-object', RecordObjectCommand );
        _currentRecords = {};
        _needFlushRecords = false;
    },

    recordObject ( id, desc ) {
        _needFlushRecords = true;

        if ( desc ) {
            _undo.setCurrentDescription(desc);
        }

        // only record object if it has not recorded yet
        if ( !_currentRecords[id] ) {
            let obj = cc.engine.getInstanceById(id);
            let data = Record.RecordObject(obj);

            _currentRecords[id] = data;
        }
    },

    commit () {
        // flush records
        if ( _needFlushRecords ) {
            for ( let id in _currentRecords ) {
                let obj = cc.engine.getInstanceById(id);

                _undo.add('record-object', {
                    id: id,
                    before: _currentRecords[id],
                    after: Record.RecordObject(obj),
                });
            }
            _currentRecords = {};
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

