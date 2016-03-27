pc.script.attribute('type', 'enumeration', 0, {
    displayName: "Type",
    enumerations: [{
       name: "None",
       value: 0
    }, {
       name: "Vox",
       value: 1
    }, {
       name: "Qb",
       value: 2
    }]
});

pc.script.attribute('file', 'asset', [], {
    displayName: "Base64 encoded Qb/Vox file",
    max: 1
});

pc.script.attribute('pivot', 'vec3', [0.5, 0, 0.5], {
    displayName: "Pivot point"
});

pc.script.attribute('rigidbody', 'boolean', true, {
    displayName: "Rigidbody"
});

pc.script.attribute('castShadows', 'boolean', false, {
    displayName: "Cast Shadows"
});

pc.script.attribute('receiveShadows', 'boolean', false, {
    displayName: "Receive Shadows"
});

pc.script.attribute('useVoxPalette', 'boolean', true, {
    displayName: "useVoxPalette"
});

pc.script.create('voxelEntity3', function (app) {    
    // Creates a new VoxelEntity instance
    var VoxelEntity3 = function (entity) {
        this.entity = entity;
    };

    VoxelEntity3.prototype = {
        // Called once after all resources are loaded and before the first update
        initialize: function () {
            var chunkerObjectArray = [];
            var generatedChunker;
                        
            // Set all the same scale for this entity.
            var scale = this.entity.getLocalScale().x;
            this.entity.setLocalScale(scale, scale, scale);
                        
            switch (this.type) {
                case 0:
                    dataChunker = new voxel.Chunker({ parentEntity: this.entity, chunkDistance: 0, chunkSize: 32, chunkPad: 2, cubeSize: scale * vx2.meshScale, generateVoxelChunk: this.createVoxelChunk});
                    dataChunker.originalDims = [0, 0, 0];
                    dataChunker.chunkerPivot = [0.5, 0, 0.5];
                    chunkerObjectArray.push({name: "copiedVoxelEntity", dataChunker: dataChunker, pos: [0, 0, 0], chunkerPivot: [0.5, 0, 0.5], chunkScale: scale});
                    break;
                case 1:
                    dataChunker = this.createChunkerFromVoxFile(app.assets.get(this.file).resource);
                    chunkerObjectArray.push({name: "voxEntity_" + this.entity.name, dataChunker: dataChunker, pos: [0, 0, 0], chunkerPivot: [this.pivot.x, this.pivot.y, this.pivot.z], chunkScale: scale});
                    break;
            }
            
            this.entity.isChunkerEntity = true;
            this.entity.chunkerObject = chunkerObjectArray[0];
            this.entity.needsRigidbody = this.rigidbody;
            this.entity.setLocalPosition(this.entity.chunkerObject.pos[0] * vx2.meshScale, this.entity.chunkerObject.pos[1] * vx2.meshScale, this.entity.chunkerObject.pos[2] * vx2.meshScale);
            this.entity.material = this.material;
            this.entity.transparentMaterial = this.transparentMaterial;
                
            // [ToDo] Use proper center and distance from model.
            vx2.recreateModel(this.entity, true, this.castShadows, this.receiveShadows, [0, 0, 0], 6, app); // Only recreate data model for now
            this.recreateRigidBodies([0, 0, 0], 6);
        },
        
        recreateRigidBodies: function(center, distance) {
    		if (!this.entity.needsRigidbody) return;
    
		    // 以前生成されたRigid Bodyを削除
		    this.removeRigidBodies(center, distance);
    
		    // collisionコンポーネントをエンティティに追加
		    if (!this.entity.collision) this.entity.addComponent("collision", {　type: "sphere",　radius: 0　});
		    if (this.entity.trigger) {
		        this.entity.trigger.destroy();
		        this.entity.trigger = undefined;
		    }
    
		    // ボクセル単位でのチャンカーの座標オフセットを求める(チャンカーが初期サイズを持っていたら、それが)
		    var chunker = this.entity.chunkerObject.dataChunker;
		    var chunkerPivot = this.entity.chunkerObject.chunkerPivot;
		    var coordinateOffset = [-(chunker.originalDims[2] * chunkerPivot[0] + chunker.chunkPadHalf), -(chunker.originalDims[1] * chunkerPivot[1] + chunker.chunkPadHalf), -(chunker.originalDims[0] * chunkerPivot[2] + chunker.chunkPadHalf)];
    
		    // 座標オフセットをもとにRigid Bodyを生成
		    vx2.createPlayCanvasRigidBodyForChunk(chunker, coordinateOffset, this.entity.chunkerObject.cubeSize, this.entity, center, distance);
		},
		
		removeRigidBodies: function(center, distance) {
			// チャンカーオブジェクトが存在しないなら処理を行わない
		    if (!this.entity.chunkerObject === undefined) return;
		    
		    // Dataチャンカーから中央から指定距離内にあるすべてのチャンク座標を取得   
			var chunker = this.entity.chunkerObject.dataChunker;
		    var nearby = chunker.nearbyChunksCoordinate(center, distance);
		    
		    // 見つかったそれぞれのチャンクに対してRigidBodyを削除する
		    for (var n = 0; n < nearby.length; n++) {
		        var targetChunk = chunker.getChunk(nearby[n][0], nearby[n][1], nearby[n][2]);
		        if (targetChunk) targetChunk.destroyRigidBody();
		    }    
		},
                 
        createVoxelChunk: function(low, high, x, y, z) {
        	// This function is called from Chunker with Chunker as "this".
        	var parentEntity;
        	if (this.entity) parentEntity = this.entity;
        	else if (this.parentEntity) parentEntity = this.parentEntity;
        	return new Chunk(parentEntity, this, low, high, function(i, j, k) { return { v: 0, f: 0 }; });
        },
        
        createChunkerFromVoxFile: function(resource) {
            var voxUint8Array = base64.toByteArray(resource);
            var voxDataView = new DataView(voxUint8Array.buffer);
            var scale = this.entity.getLocalScale().x;
            
            // Voxel adds 1 padding for each face. So chunkPad should be 2.
            var chunker = new voxel.Chunker({ parentEntity: this.entity, chunkDistance: 0, chunkSize: 32, chunkPad: 2, cubeSize: scale * vx2.meshScale, generateVoxelChunk: this.createVoxelChunk});
            
            // Set CoordinateOffset here
            chunker.chunkerPivot = [this.pivot.x, this.pivot.y, this.pivot.z];                    
            
            // Read header
            var index = 0;
            var targetIndex = 4;
            var headerMagic = "";
            for (; index < targetIndex; index++) {
                headerMagic += String.fromCharCode(voxDataView.getUint8(index));
            }            
            var headerVersion = voxDataView.getUint32(index, true); // ToDo VOX file should store version number in big endian but it's actually little endian???
            index += 4;
            
            if (headerMagic !== "VOX ") {
                return undefined;
            }
            
            this.readVoxFileChunk(voxDataView, index, chunker);
            return chunker;
        },
        
        readVoxFileChunk: function (dataView, offset, chunker) {
            var index = offset;
            var customPalette = vx2.magicaVoxelDefaultPalette.slice(0);
            
            while (index < dataView.byteLength) {
                var targetIndex = index + 4;
                var chunkMagic = "";
                for (; index < targetIndex; index++) {
                    chunkMagic += String.fromCharCode(dataView.getUint8(index));
                }
                var chunkContentSize = dataView.getUint32(index, true);
                index += 4;
                var childrenChunkContentSize = dataView.getUint32(index, true);
                index += 4;

                switch(chunkMagic) {
                    case "MAIN":
                        printDebugMessage("MAIN chunk", 8);
                        index += chunkContentSize;
                        break;
                    case "SIZE":
                        if (!chunker.originalDims) chunker.originalDims = [];
                        chunker.originalDims[0] = dataView.getUint32(index, true);
                        index += 4;
                        chunker.originalDims[2] = dataView.getUint32(index, true);
                        index += 4;
                        chunker.originalDims[1] = dataView.getUint32(index, true);
                        index += 4;
                        printDebugMessage("SIZE chunk: (x, y, z) = (" + chunker.originalDims[0] + ", " + chunker.originalDims[1] + ", " + chunker.originalDims[2] + ")", 8);
                        
                        // CoordinateOffsetをここで設定
		    			chunker.coordinateOffset = [-(chunker.originalDims[2] * chunker.chunkerPivot[0] + chunker.chunkPadHalf), -(chunker.originalDims[1] * chunker.chunkerPivot[1] + chunker.chunkPadHalf), -(chunker.originalDims[0] * chunker.chunkerPivot[2] + chunker.chunkPadHalf)];
                        break;
                    case "XYZI":
                        var numVoxels = dataView.getUint32(index, true);
                        printDebugMessage("VOXEL chunk: numVoxels = " + numVoxels, 8);
                        index += 4;
                        for (var voxelIndex = 0; voxelIndex < numVoxels; voxelIndex++) {
                            var voxelX = dataView.getUint8(index, true);
                            index += 1;
                            var voxelZ = dataView.getUint8(index, true);
                            index += 1;
                            var voxelY = dataView.getUint8(index, true);
                            index += 1;
                            var voxelColorIndex = dataView.getUint8(index, true);
                            index += 1;
                            printDebugMessage("    MagicaVoxel " + voxelIndex + " (" + voxelX + ", " + voxelY + ", " + voxelZ + ", " + voxelColorIndex + ")", 8);
                            chunker.voxelAtCoordinates(chunker.originalDims[2] - voxelZ - 1, voxelY, voxelX, { v: voxelColorIndex, f: 0}, true);
                        }
                        break;
                    case "RGBA":
                        printDebugMessage("RGBA chunk", 8);
                        for (var paletteIndex = 0; paletteIndex < 256; paletteIndex++) {
                            var rColor = (dataView.getUint8(index, true) & 0xfc) >>> 2;
                            index += 1;
                            var gColor = (dataView.getUint8(index, true) & 0xfc) >>> 2;
                            index += 1;
                            var bColor = (dataView.getUint8(index, true) & 0xfc) >>> 2;
                            index += 1;
                            var aColor = (dataView.getUint8(index, true) & 0xfc) >>> 2;
                            index += 1;
                            customPalette[paletteIndex + 1] = ((rColor << 18) | (gColor << 12) | (bColor << 6) | aColor) >>> 0;
                        }
                        break;
                    default:
                        printDebugMessage(chunkMagic + " chunk is not supported", 8);
                        index += chunkContentSize;
                        break;
                }
                printDebugMessage("chunkContentSize : " + chunkContentSize, 8);
                printDebugMessage("childrenChunkContentSize : " + childrenChunkContentSize, 8);
                
                if (childrenChunkContentSize > 0) {
                    this.readVoxFileChunk(dataView, index, chunker);                    
                }
                index += childrenChunkContentSize;
            }
            
            // Convert color index to 24bit RGBA color if necessary
            for (var x = 0; x < chunker.originalDims[0]; ++x) {
                for (var y = 0; y < chunker.originalDims[1]; ++y) {
                    for (var z = 0; z < chunker.originalDims[2]; ++z) {
                        var result = chunker.voxelAtCoordinates(x, y, z);
                        if (result[0] !== undefined && result[0].v > 0 && result[0].v <= 255) {
                            if (this.useVoxPalette === true) {
                            	// Convert voxel value to 24bit RGBA color
                            	chunker.voxelAtCoordinates(x, y, z, { v: customPalette[result[0].v], f: 0});
                            }
                            else {
                            	// Move the voxel value to "index" voxel ID space
                            	chunker.voxelAtCoordinates(x, y, z, { v: result[0].v + vx2.voxelIdOffset, f: 0});
                            }
                        }
                    }
                }
            }
        }
    };

    return VoxelEntity3;
});