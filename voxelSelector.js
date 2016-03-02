pc.script.attribute('copiedVoxelEntity', 'entity', null);

pc.script.create('voxelSelector', function (app) {
    var rayEndVector = new pc.Vec3();
    
    // Creates a new VoxelSelector instance
    var VoxelSelector = function (entity) {
        this.entity = entity;
    };

    VoxelSelector.prototype = {
        // Called once after all resources are loaded and before the first update
        initialize: function () {
            this.dirtyChunkArray = [];
            this.lastDirtyPosArray = [];
            
            this.currentChunkerEntity = null;
            this.previousChunkerEntity = null;
            
            this.currentTargetVoxelCoordinate = [0, 0, 0];
            this.previousTargetVoxelCoordinate = [0, 0, 0];
            this.currentNormalVoxelCoordinate = [0, 0, 0];
            this.previousNormalVoxelCoordinate = [0, 0, 0];
            
            this.selectPointTargetEntity = null;
            this.selectPointCoordinate = []; // index 0 means the first select point and index 1 means the second select point
            this.allSelectPointCoordinate = []; // List of all selected points
            this.minSelectPointCoordinate = []; // x, y, z coordinate
            this.maxSelectPointCoordinate = []; // x, y, z coordinate
            
            this.undoBuffer = [];
            this.maxUndoBufferLength = 5;
            
            // [ToDo] This is dependent on entity initialization order. Fixit.
            this.copiedVoxelEntity = app.root.findByName('copiedVoxelEntity');
            
            app.keyboard.on(pc.EVENT_KEYDOWN, this.onKeyDown, this);
            
            // Attach enable pointer lock only to the canvas click event.
            $('#application-canvas').click(function(e) {
                if (pc.Mouse.isPointerLocked() === false) {
                    app.mouse.enablePointerLock();
                }
                else {
                    this.onClick(e);
                }
            }).bind(this);
        },
        
        onKeyDown: function(event) {
            if (event.key === pc.KEY_E) {
                if (pc.Mouse.isPointerLocked() === false) {
                    app.mouse.enablePointerLock();
                }
                else {
                    app.mouse.disablePointerLock();
                }
                
            }
        },

        checkRaycastResult: function(result) {
            var entity = result.entity;
                        
            if (entity.isChunkerEntity === true) {
                this.currentChunkerEntity = entity;
                var currentChunker = entity.chunkerObject.dataChunker;
                var chunkerPivot = entity.chunkerObject.chunkerPivot;
                var entityTranslation = entity.getWorldTransform().clone();
                var entityScale = entityTranslation.getScale();
                var scale = entityTranslation.getScale().clone();
                var minScale = Math.min(scale.x, scale.y, scale.z);
                entityTranslation = entityTranslation.invert();
                        
                // Get current Normal coordinate
                this.previousNormalVoxelCoordinate = this.currentNormalVoxelCoordinate.slice(0);
                var worldPoint = result.point.clone();
                var normal = result.normal.normalize();
                normal.scale(minScale * vx2.meshScale * 0.5); // 0.5 seems too much because the precision of the contact point is not so high
                var normalPoint = new pc.Vec3().add2(worldPoint, normal);
                var localPoint = entityTranslation.transformPoint(normalPoint);
                this.currentNormalVoxelCoordinate[0] = Math.floor((localPoint.x * scale.x + (currentChunker.originalDims[2] * chunkerPivot[0] + currentChunker.chunkPadHalf) * scale.x * vx2.meshScale) / vx2.meshScale / scale.x) - 1;
                this.currentNormalVoxelCoordinate[1] = Math.floor((localPoint.y * scale.y + (currentChunker.originalDims[1] * chunkerPivot[1] + currentChunker.chunkPadHalf) * scale.y * vx2.meshScale) / vx2.meshScale / scale.y) - 1;
                this.currentNormalVoxelCoordinate[2] = Math.floor((localPoint.z * scale.z + (currentChunker.originalDims[0] * chunkerPivot[2] + currentChunker.chunkPadHalf) * scale.z * vx2.meshScale) / vx2.meshScale / scale.z) - 1;
                
                // Get current coordinate
                this.previousTargetVoxelCoordinate = this.currentTargetVoxelCoordinate.slice(0);
                normal.scale(-1); // -0.5 seems too much because the precision of the contact point is not so high
                normalPoint = new pc.Vec3().add2(worldPoint, normal);
                localPoint = entityTranslation.transformPoint(normalPoint);
                this.currentTargetVoxelCoordinate[0] = Math.floor((localPoint.x * scale.x + (currentChunker.originalDims[2] * chunkerPivot[0] + currentChunker.chunkPadHalf) * scale.x * vx2.meshScale) / vx2.meshScale / scale.x) - 1;
                this.currentTargetVoxelCoordinate[1] = Math.floor((localPoint.y * scale.y + (currentChunker.originalDims[1] * chunkerPivot[1] + currentChunker.chunkPadHalf) * scale.y * vx2.meshScale) / vx2.meshScale / scale.y) - 1;
                this.currentTargetVoxelCoordinate[2] = Math.floor((localPoint.z * scale.z + (currentChunker.originalDims[0] * chunkerPivot[2] + currentChunker.chunkPadHalf) * scale.z * vx2.meshScale) / vx2.meshScale / scale.z) - 1;
            }
        },
        
        selectVoxelFrom2Points: function() {
            var currentChunker = this.selectPointTargetEntity.chunkerObject.dataChunker;
            var minSelectedCoordinates = [];
            var maxSelectedCoordinates = [];
            
            for (i = 0; i < 3; i++) {
                this.minSelectPointCoordinate[i] = Math.min(this.selectPointCoordinate[0][i], this.selectPointCoordinate[1][i]);
                this.maxSelectPointCoordinate[i] = Math.max(this.selectPointCoordinate[0][i], this.selectPointCoordinate[1][i]);
            }
            
            var lastDirtyChunkArray = [];
            for (var x = this.minSelectPointCoordinate[0]; x <= this.maxSelectPointCoordinate[0]; ++x) {
                for (var y = this.minSelectPointCoordinate[1]; y <= this.maxSelectPointCoordinate[1]; ++y) {
                    for (var z = this.minSelectPointCoordinate[2]; z <= this.maxSelectPointCoordinate[2]; ++z) {
                        this.allSelectPointCoordinate.push([x, y, z]);
                    }
                }
            }
        },
        
        unselectVoxel: function() {
            if (this.allSelectPointCoordinate.length === 0 || !this.selectPointTargetEntity) {
                return;
            }
            
            // Empty selected voxel
            this.selectPointCoordinate[0] = undefined;
            this.selectPointCoordinate[1] = undefined;
            this.selectPointTargetEntity = undefined;
            this.allSelectPointCoordinate = [];
            this.minSelectPointCoordinate = [];
            this.maxSelectPointCoordinate = [];
        },
        
        editVoxel: function(dt) {
            // If mouse isn't locked, ignore mouse event
            if (pc.Mouse.isPointerLocked() === false) return;
                        
            var dirtyChunk = null;
            var lastDirtyChunkArray = [];
            var minSelectedCoordinates = [];
            var maxSelectedCoordinates = [];
            
            var selectedDataChunker, copiedDataChunker, targetDataChunker;
            var color, activeColor, aColor, rColor, gColor, bColor;
            var result;
            var undoEntry;
            
            activeColor = colorPicker.activeColor;
            rColor = (activeColor[0] & 0xfc) >>> 2;
            gColor = (activeColor[1] & 0xfc) >>> 2;
            bColor = (activeColor[2] & 0xfc) >>> 2;
            aColor = (activeColor[3] & 0xfc) >>> 2;
            
            if (app.keyboard.wasPressed(pc.KEY_9)) {
                undoEntry = [];
                if (this.allSelectPointCoordinate.length > 0) {
                    selectedDataChunker = this.selectPointTargetEntity.chunkerObject.dataChunker;
                    color = (rColor << 18 | gColor << 12 | bColor << 6 | aColor) >>> 0;
                    
                    for (i = 0; i < this.allSelectPointCoordinate.length; i++) {
                        x = this.allSelectPointCoordinate[i][0];
                        y = this.allSelectPointCoordinate[i][1];
                        z = this.allSelectPointCoordinate[i][2];
                        result = selectedDataChunker.voxelAtCoordinates(z, y, x, { v: color, f: 0 }, false);
                        if (result[1]) {
                            undoEntry.push({chunker: selectedDataChunker, entity: this.selectPointTargetEntity, isDataModel: true, x: x, y: y, z: z, color: color, prevColor: result[0].v});
                            if (lastDirtyChunkArray.indexOf(result[1]) === -1) {
                                this.dirtyChunkArray.push({dirtyChunk: result[1], chunker: selectedDataChunker, entity: this.selectPointTargetEntity, isDataModel: true});
                                lastDirtyChunkArray.unshift(result[1]);
                            }
                        }
                    }
                    
                    if (undoEntry.length > 0) {
                        this.undoBuffer.push(undoEntry);
                        if(this.undoBuffer.length > this.maxUndoBufferLength) {
                            this.undoBuffer.shift();
                        }                        
                    }
                    
                    // Unselect voxel
                    this.unselectVoxel();
                }
            }
            
            if (app.keyboard.isPressed(pc.KEY_CONTROL) && (app.keyboard.wasPressed(pc.KEY_C) || app.keyboard.wasPressed(pc.KEY_X))) {
                undoEntry = [];
                copiedDataChunker = this.copiedVoxelEntity.chunkerObject.dataChunker;
                
                if (app.keyboard.wasPressed(pc.KEY_C)) {
                    // Copy
                    color = undefined;
                }
                else {
                    // Cut
                    color = 0;                    
                }
                
                if (this.allSelectPointCoordinate.length > 0) {
                    // Erase copied cells
                    for (x = 0; x < copiedDataChunker.originalDims[0]; x++) {
                        for (y = 0; y < copiedDataChunker.originalDims[1]; y++) {
                            for (z = 0; z < copiedDataChunker.originalDims[2]; z++) {
                                result = copiedDataChunker.voxelAtCoordinates(z, y, x, { v: 0, f: 0 }, false);
                                if (lastDirtyChunkArray.indexOf(result[1]) === -1) {
                                    this.dirtyChunkArray.push({dirtyChunk: result[1], chunker: copiedDataChunker, entity: this.copiedVoxelEntity, isDataModel: true});
                                    lastDirtyChunkArray.unshift(result[1]);
                                }
                            }
                        }
                    }
                                
                    for (i = 0; i < 3; i++) {
                        copiedDataChunker.originalDims[i] = this.maxSelectPointCoordinate[i] - this.minSelectPointCoordinate[i] + 1;
                    }
                    
                    selectedDataChunker = this.selectPointTargetEntity.chunkerObject.dataChunker;
                    for (i = 0; i < this.allSelectPointCoordinate.length; i++) {
                        x = this.allSelectPointCoordinate[i][0];
                        y = this.allSelectPointCoordinate[i][1];
                        z = this.allSelectPointCoordinate[i][2];
                        result = selectedDataChunker.voxelAtCoordinates(z, y, x, { v: color, f: 0 }, false);
                        if (color === 0) {
                            undoEntry.push({chunker: selectedDataChunker, entity: this.selectPointTargetEntity, isDataModel: true, x: x, y: y, z: z, color: color, prevColor: result[0].v});
                        }
                        if (lastDirtyChunkArray.indexOf(result[1]) === -1) {
                            this.dirtyChunkArray.push({dirtyChunk: result[1], chunker: selectedDataChunker, entity: this.selectPointTargetEntity, isDataModel: true});
                            lastDirtyChunkArray.unshift(result[1]);
                        }
                        result = copiedDataChunker.voxelAtCoordinates(z - this.minSelectPointCoordinate[2], y - this.minSelectPointCoordinate[1], x - this.minSelectPointCoordinate[0], { v: result[0].v, f: 0 }, true);
                        if (lastDirtyChunkArray.indexOf(result[1]) === -1) {
                            this.dirtyChunkArray.push({dirtyChunk: result[1], chunker: copiedDataChunker, entity: this.copiedVoxelEntity, isDataModel: true});
                            lastDirtyChunkArray.unshift(result[1]);
                        }
                    }
                    
                    if (undoEntry.length > 0) {
                        this.undoBuffer.push(undoEntry);
                        if(this.undoBuffer.length > this.maxUndoBufferLength) {
                            this.undoBuffer.shift();
                        }                        
                    }
                    
                    // Unselect voxel
                    this.unselectVoxel();
                }
            }
                        
            if (app.keyboard.isPressed(pc.KEY_CONTROL) && app.keyboard.wasPressed(pc.KEY_Z) && this.undoBuffer.length > 0) {
                undoEntry = this.undoBuffer.pop();
                for (var i = 0; i < undoEntry.length; i++) {
                    result = undoEntry[i].chunker.voxelAtCoordinates(undoEntry[i].z, undoEntry[i].y, undoEntry[i].x, { v: undoEntry[i].prevColor, f: 0 }, undoEntry[i].isDataModel);                                
                    if (lastDirtyChunkArray.indexOf(result[1]) === -1) {
                        this.dirtyChunkArray.push({dirtyChunk: result[1], chunker: undoEntry[i].chunker, entity: undoEntry[i].entity, isDataModel: undoEntry[i].isDataModel});
                        lastDirtyChunkArray.unshift(result[1]);
                    }
                }
                // Unselect voxel
                this.unselectVoxel();
            }
            
            // From here, you need a current chunker. Since this involves a "targetted entity"
            if (!this.currentChunkerEntity) return;
            
            targetDataChunker = this.currentChunkerEntity.chunkerObject.dataChunker;
            
            if (app.keyboard.isPressed(pc.KEY_CONTROL) && app.keyboard.wasPressed(pc.KEY_V)) {
                undoEntry = [];
                copiedDataChunker = this.copiedVoxelEntity.chunkerObject.dataChunker;
                for (x = 0; x < copiedDataChunker.originalDims[0]; x++) {
                    for (y = 0; y < copiedDataChunker.originalDims[1]; y++) {
                        for (z = 0; z < copiedDataChunker.originalDims[2]; z++) {
                            result = copiedDataChunker.voxelAtCoordinates(z, y, x);
                            color = result[0].v;
                            result = targetDataChunker.voxelAtCoordinates(this.currentNormalVoxelCoordinate[2] + z, this.currentNormalVoxelCoordinate[1] + y, this.currentNormalVoxelCoordinate[0] + x, { v: color, f: 0}, true);
                            undoEntry.push({chunker: targetDataChunker, entity: this.currentChunkerEntity,
                                            isDataModel: true,
                                            x: this.currentNormalVoxelCoordinate[0] + x,
                                            y: this.currentNormalVoxelCoordinate[1] + y,
                                            z: this.currentNormalVoxelCoordinate[2] + z,
                                            color: color,
                                            prevColor: result[0].v});
                            if (lastDirtyChunkArray.indexOf(result[1]) === -1) {
                                this.dirtyChunkArray.push({dirtyChunk: result[1], chunker: targetDataChunker, entity: this.currentChunkerEntity, isDataModel: true});
                                lastDirtyChunkArray.unshift(result[1]);
                            }
                        }
                    }
                }
                if (undoEntry.length > 0) {
                    this.undoBuffer.push(undoEntry);
                    if(this.undoBuffer.length > this.maxUndoBufferLength) {
                        this.undoBuffer.shift();
                    }                        
                }
            }

            if ((app.mouse.wasPressed(pc.MOUSEBUTTON_LEFT) === true && (colorPicker.selectedTool === 'addbox' || colorPicker.selectedTool === 'erase')) || (app.mouse.isPressed(pc.MOUSEBUTTON_LEFT) === true && colorPicker.selectedTool === 'paint')) {
                undoEntry = [];
                // Convert current color to 32bit RGBA value.
                activeColor = colorPicker.activeColor;
                color = (rColor << 18 | gColor << 12 | bColor << 6 | aColor) >>> 0;
                var targetCoordinate;
                if (colorPicker.selectedTool === 'erase' || activeColor[3] === 0) {
                    targetCoordinate = this.currentTargetVoxelCoordinate;
                    color = 0;
                }
                else if (colorPicker.selectedTool === 'paint') {
                    targetCoordinate = this.currentTargetVoxelCoordinate;
                }
                else {
                    targetCoordinate = this.currentNormalVoxelCoordinate;                    
                }
                result = targetDataChunker.voxelAtCoordinates(targetCoordinate[2], targetCoordinate[1], targetCoordinate[0], { v: color, f: 0 }, true);
                if (result[0].v !== color) {
                    undoEntry.push({chunker: targetDataChunker, entity: this.currentChunkerEntity, isDataModel: true, x: targetCoordinate[0], y: targetCoordinate[1], z: targetCoordinate[2], color: color, prevColor: result[0].v});
                    if (lastDirtyChunkArray.indexOf(result[1])) {
                        this.dirtyChunkArray.push({dirtyChunk: result[1], chunker: targetDataChunker, entity: this.currentChunkerEntity, isDataModel: true});
                        lastDirtyChunkArray.unshift(result[1]);
                    }
                    if (undoEntry.length > 0) {
                        this.undoBuffer.push(undoEntry);
                        if(this.undoBuffer.length > this.maxUndoBufferLength) {
                            this.undoBuffer.shift();
                        }                        
                    }
                    // Unselect voxel
                    this.unselectVoxel();
                }
            }
        },
        
        updateCursor: function () {
            var pos = this.entity.getPosition().clone();
            var dirtyChunk = null;
            var currentChunker;
            var minSelectedCoordinates = [];
            var maxSelectedCoordinates = [];
            var x, y, z, i;
            var color;
            var lastDirtyChunk;
            var result;
                        
            if (this.currentChunkerEntity) {
                currentDataChunker = this.currentChunkerEntity.chunkerObject.dataChunker;
            
                // Display cursor
                /*if (this.previousChunkerEntity != this.currentChunkerEntity ||
                    this.previousNormalVoxelCoordinate[0] != this.currentNormalVoxelCoordinate[0] ||
                    this.previousNormalVoxelCoordinate[1] != this.currentNormalVoxelCoordinate[1] ||
                    this.previousNormalVoxelCoordinate[2] != this.currentNormalVoxelCoordinate[2]) {
                    // Cursor moved. Erase previous cursor first.
                    for (i = 0; i < this.lastDirtyPosArray.length; i++) {
                        result = this.lastDirtyPosArray[i].chunker.voxelAtCoordinates(this.lastDirtyPosArray[i].z, this.lastDirtyPosArray[i].y, this.lastDirtyPosArray[i].x);
                        // Erase dirty pos only when it is a cursor
                        if (result[0] === 0x01 || result[0] === 0x7f) {
                            result = this.lastDirtyPosArray[i].chunker.voxelAtCoordinates(this.lastDirtyPosArray[i].z, this.lastDirtyPosArray[i].y, this.lastDirtyPosArray[i].x, 0x00, false);
                            if (result[1]) {
                                this.dirtyChunkArray.push({dirtyChunk: result[1], chunker: this.lastDirtyPosArray[i].chunker, entity: this.lastDirtyPosArray[i].entity, isDataModel: false});
                            }
                        }
                    }
                    this.lastDirtyPosArray = [];
                    
                    result = currentAttrChunker.voxelAtCoordinates(this.currentTargetVoxelCoordinate[2], this.currentTargetVoxelCoordinate[1], this.currentTargetVoxelCoordinate[0]);
                    if (!result[0] || result[0] === 0x00) {
                        result = currentAttrChunker.voxelAtCoordinates(this.currentTargetVoxelCoordinate[2], this.currentTargetVoxelCoordinate[1], this.currentTargetVoxelCoordinate[0], 0x01, true);
                        if (result[1]) {
                            this.dirtyChunkArray.push({dirtyChunk: result[1], chunker: currentAttrChunker, entity: this.currentChunkerEntity, isDataModel: false});
                            this.lastDirtyPosArray.push({ x: this.currentTargetVoxelCoordinate[0],
                                                          y: this.currentTargetVoxelCoordinate[1],
                                                          z: this.currentTargetVoxelCoordinate[2],
                                                          chunker: this.currentChunkerEntity.chunkerObject.attrChunker,
                                                          entity: this.currentChunkerEntity });
                        }
                    }
                }*/

                // 2 points select
                if (app.mouse.wasPressed(pc.MOUSEBUTTON_RIGHT) === true) {
                    // The new Chunker is selected. Clear previous "select" markers.
                    if (!this.selectPointCoordinate[0]) {
                        // Unselect selected voxels
                        this.unselectVoxel();
                        
                        // Update the newly selected chunker
                        this.selectPointCoordinate[0] = this.currentTargetVoxelCoordinate.slice(0);
                        this.selectPointCoordinate[1] = undefined;
                        this.selectPointTargetEntity = this.currentChunkerEntity;
                    }
                    else if (!this.selectPointCoordinate[1] && this.selectPointTargetEntity) {
                        this.selectPointCoordinate[1] = this.currentTargetVoxelCoordinate.slice(0);
                        this.selectVoxelFrom2Points();
                    }
                    else {
                        if (!this.selectPointCoordinate[1]) {
                            this.selectPointCoordinate[1] = this.selectPointCoordinate[0];
                        }
                        this.unselectVoxel();
                    }
                }
                
                // Magick select
                /*if (app.mouse.wasPressed(pc.MOUSEBUTTON_LEFT) && colorPicker.selectedTool === 'magickselect') {
                    var newSelectVoxelCoordinateArray = [];
                    var targetVoxelValue;
                    var result2;
                    var selectNum = 0;
                    var diff = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
                    
                    result = currentDataChunker.voxelAtCoordinates(this.currentTargetVoxelCoordinate[2], this.currentTargetVoxelCoordinate[1], this.currentTargetVoxelCoordinate[0]);
                    targetVoxelValue = result[0];
                    if (targetVoxelValue !== 0) {
                        // Unselect voxel first
                        this.unselectVoxel();

                        this.selectPointTargetEntity = this.currentChunkerEntity;
                        newSelectVoxelCoordinateArray.push(this.currentTargetVoxelCoordinate.slice(0));
                        this.allSelectPointCoordinate.push(this.currentTargetVoxelCoordinate.slice(0));
                        for (i = 0; i < 3; i++) {
                            this.minSelectPointCoordinate[i] = this.currentTargetVoxelCoordinate[i];
                            this.maxSelectPointCoordinate[i] = this.currentTargetVoxelCoordinate[i];
                        }
                        
                        while (newSelectVoxelCoordinateArray.length > 0 && selectNum < 4 * 4 * 4) {
                            var target = newSelectVoxelCoordinateArray.shift();
                            
                            for (var index = 0; index < diff.length; index++) {
                                result = currentDataChunker.voxelAtCoordinates(target[2] + diff[index][2], target[1] + diff[index][1], target[0] + diff[index][0]);
                                result2 = currentAttrChunker.voxelAtCoordinates(target[2] + diff[index][2], target[1] + diff[index][1], target[0] + diff[index][0]);
                                if (result[0] === targetVoxelValue && result2[0] !== 0x02) {
                                    newSelectVoxelCoordinateArray.push([target[0] + diff[index][0], target[1] + diff[index][1], target[2] + diff[index][2]]);
                                    this.allSelectPointCoordinate.push([target[0] + diff[index][0], target[1] + diff[index][1], target[2] + diff[index][2]]);
                                    selectNum += 1;
                                    
                                    for (i = 0; i < 3; i++) {
                                        this.minSelectPointCoordinate[i] = Math.min(this.minSelectPointCoordinate[i], target[i] + diff[index][i]);
                                        this.maxSelectPointCoordinate[i] = Math.max(this.maxSelectPointCoordinate[i], target[i] + diff[index][i]);
                                    }

                                    result = currentAttrChunker.voxelAtCoordinates(target[2] + diff[index][2], target[1] + diff[index][1], target[0] + diff[index][0], 0x02, true);
                                    if (result[1]) {
                                        this.dirtyChunkArray.push({dirtyChunk: result[1], chunker: currentAttrChunker, entity: this.currentChunkerEntity, isDataModel: false});
                                    }
                                }
                            }
                        }                        
                    }                    
                }*/
            }
            /*else if (this.previousChunkerEntity) {
                // Cursor moved. Erase previous cursor first.
                for (i = 0; i < this.lastDirtyPosArray.length; i++) {
                    result = this.lastDirtyPosArray[i].chunker.voxelAtCoordinates(this.lastDirtyPosArray[i].z, this.lastDirtyPosArray[i].y, this.lastDirtyPosArray[i].x);
                    // Erase dirty pos only when it is a cursor
                    if (result[0] === 0x01 || result[0] === 0x7f) {
                        result = this.lastDirtyPosArray[i].chunker.voxelAtCoordinates(this.lastDirtyPosArray[i].z, this.lastDirtyPosArray[i].y, this.lastDirtyPosArray[i].x, { v: 0, f: 0 }, false);
                        if (result[1]) {
                            this.dirtyChunkArray.push({dirtyChunk: result[1], chunker: this.lastDirtyPosArray[i].chunker, entity: this.lastDirtyPosArray[i].entity, isDataModel: false});
                        }
                    }
                }
                this.lastDirtyPosArray = [];
            }*/
            
            // Null current Chunker
            this.previousChunkerEntity = this.currentChunkerEntity;
            this.currentChunkerEntity = null;

            rayEndVector.add2(pos, this.entity.forward.scale(12 * 100 * vx2.meshScale));
            app.systems.rigidbody.raycastFirst(pos, rayEndVector, this.checkRaycastResult.bind(this));            
        },

        // Called every frame, dt is time in seconds since last update
        update: function (dt) {
            this.editVoxel(dt);
            this.updateCursor();
            
            // If there is any dirty chunk, recreate attr chunk model. Including cursors and selections.
            var processedDirtyChunkArray = [];
            for (var m = 0; m < this.dirtyChunkArray.length; m++) {
                var targetChunk = this.dirtyChunkArray[m].dirtyChunk;
                var entity = this.dirtyChunkArray[m].entity;
                var chunker = this.dirtyChunkArray[m].chunker;
                var isDataModel = this.dirtyChunkArray[m].isDataModel;
                var castShadows;
                var receiveShadows;

                if (!targetChunk || processedDirtyChunkArray.indexOf(this.dirtyChunkArray[m]) !== -1) {
                    continue;
                }
                
                if (isDataModel) {
                    castShadows = entity.model.castShadows;
                    receiveShadows = entity.model.castShadows;
                }
                else {
                    castShadows = true;
                    receiveShadows = true;
                }
                
                // Recreate model
                vx2.recreateModel(entity, isDataModel, castShadows, receiveShadows, targetChunk.position, 0, app);                    
                if (isDataModel) {
                    // Recreate rigid bodies
                    vx2.recreateRigidBodies(entity, targetChunk.position, 0, app); // Recreate rigid bodies
                }
                
                if (targetChunk.empty === true) {
                    printDebugMessage("Destroying an empty chunk " + targetChunk, 1);
                    chunker.deleteChunk(targetChunk.position[0], targetChunk.position[1], targetChunk.position[2]);
                }
            }
            this.dirtyChunkArray = [];
        }
    };

    return VoxelSelector;
});