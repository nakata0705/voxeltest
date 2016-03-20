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
                    dataChunker = new voxel.Chunker({ chunkDistance: 0, chunkSize: 32, chunkPad: 2, cubeSize: scale * vx2.meshScale, generateVoxelChunk: this.createVoxelChunk32});
                    dataChunker.originalDims = [0, 0, 0];
                    chunkerObjectArray.push({name: "copiedVoxelEntity", dataChunker: dataChunker, pos: [0, 0, 0], chunkerPivot: [0.5, 0, 0.5], chunkScale: scale});
                    break;
                case 1:
                    dataChunker = this.createChunkerFromVoxFile(app.assets.get(this.file).resource);
                    chunkerObjectArray.push({name: "voxEntity_" + this.entity.name, dataChunker: dataChunker, pos: [0, 0, 0], chunkerPivot: [this.pivot.x, this.pivot.y, this.pivot.z], chunkScale: scale});
                    break;
                case 2:
                    chunkerObjectArray = this.createVoxelDataFromQbFile();
                    break;
            }
            
            for (var i = 0; i < chunkerObjectArray.length; i++) {
                var entity = new pc.Entity();
                entity.isChunkerEntity = true;
                entity.chunkerObject = chunkerObjectArray[i];
                entity.name = entity.chunkerObject.name;
                entity.needsRigidbody = this.rigidbody;
                this.entity.addChild(entity);
                entity.setLocalPosition(entity.chunkerObject.pos[0] * vx2.meshScale, entity.chunkerObject.pos[1] * vx2.meshScale, entity.chunkerObject.pos[2] * vx2.meshScale);
                entity.material = this.material;
                entity.transparentMaterial = this.transparentMaterial;
                
                // [ToDo] Use proper center and distance from model.
                vx2.recreateModel(entity, true, this.castShadows, this.receiveShadows, [0, 0, 0], 6, app); // Only recreate data model for now
                vx2.recreateRigidBodies(entity, [0, 0, 0], 6);
            }            
        },
                 
        createVoxelChunk: function(low, high, x, y, z) {
        	return new Chunk(low, high, function(i, j, k) { return { v: 0, f: 0 }; });
        },
                
        createVoxelDataFromQbFile: function() {
            var qbUint8Array = base64.toByteArray(app.assets.get(this.file).resource);
            var qbDataView = new DataView(qbUint8Array.buffer);
            var chunkerObjectArray = [];
            
            // Read version
            var index = 0;
            var header = {};
            header.version = qbDataView.getUint32(index, true);
            index += 4;
            header.colorFormat = qbDataView.getUint32(index, true);
            index += 4;
            header.zAxisOrientation = qbDataView.getUint32(index, true);
            index += 4;
            header.compressed = qbDataView.getUint32(index, true);
            index += 4;
            header.visibilityMaskEncoded = qbDataView.getUint32(index, true);
            index += 4;
            header.numMatrices = qbDataView.getUint32(index, true);
            index += 4;
            
            for (var i = 0; i < header.numMatrices; ++i) {
                var matrixData = {};
                index = this.readQbFileMatrix(qbDataView, index, header, matrixData);
                chunkerObjectArray.push(matrixData);
            }
            return chunkerObjectArray;
        },
        
        readQbFileMatrix: function (qbDataView, offset, header, matrixData) {
            var index = offset;
            var pos = [0, 0, 0];

            var nameLength = qbDataView.getUint8(index);
            index += 1;
            
            var targetIndex = index + nameLength;
            var matrixName = "";
            for (; index < targetIndex; ++index) {
                matrixName += String.fromCharCode(qbDataView.getUint8(index));
            }
            
            // Voxel adds 1 padding for each face. So chunkPad should be 2.
            var scale = this.entity.getLocalScale().x;
            var chunker = new voxel.Chunker({ chunkDistance: 0, chunkSize: 32, chunkPad: 2, cubeSize: scale * vx2.meshScale, generateVoxelChunk: this.createVoxelChunk32});
            chunker.originalDims = [];
            chunker.originalDims[0] = qbDataView.getUint32(index, true);
            index += 4;
            chunker.originalDims[1] = qbDataView.getUint32(index, true);
            index += 4;
            chunker.originalDims[2] = qbDataView.getUint32(index, true);
            index += 4;
            
            pos[0] = qbDataView.getInt32(index, true);
            index += 4;
            pos[1] = qbDataView.getInt32(index, true);
            index += 4;
            pos[2] = qbDataView.getInt32(index, true);
            index += 4;
            
            printDebugMessage("Matrix { name: " + matrixName + ", size: (x, y, z) = (" + chunker.originalDims[0] + ", " + chunker.originalDims[1] + ", " + chunker.originalDims[2] + "), pos: (" + pos[0] + ", " + pos[1] + ", " + pos[2] + ") }", 8);
            
            var x, y, z, count, data, color, decompressIndex;

            if (header.compressed === 0) {
                for (z = 0; z < chunker.originalDims[2]; z++) {
                    for (y = 0; y < chunker.originalDims[1]; y++) {
                        for (x = 0; x < chunker.originalDims[0]; x++) {
                            color = qbDataView.getUint32(index);
                            index += 4;
                            if (color !== 0x00) {
                                chunker.voxelAtCoordinates(z, y, x, { v: color, f: 0 }, true);
                            }
                        }
                    }
                }
            }
            else {
                z = 0;
                while (z < chunker.originalDims[2]) {
                    z++;
                    decompressIndex = 0;
                    while (true) {
                        data = qbDataView.getUint32(index, true);
                        index += 4;
                        
                        if (data === vx2.QB_NEXTSLICEFLAG) {
                            break;
                        }
                        else if (data === vx2.QB_CODEFLAG) {
                            count = qbDataView.getUint32(index, true);
                            index += 4;
                            data = qbDataView.getUint32(index, false);
                            color = data;
                            index += 4;
                            
                            for(var j = 0; j < count; j++) {
                                x = decompressIndex % chunker.originalDims[0];
                                y = Math.floor(decompressIndex / chunker.originalDims[0]);
                                decompressIndex += 1;
                                if (color !== 0x00) {
                                    chunker.voxelAtCoordinates(z, y, x, { v: color, f: 0}, true);
                                }
                            }
                        }
                        else {
                            x = decompressIndex % chunker.originalDims[0];
                            y = Math.floor(decompressIndex / chunker.originalDims[0]);
                            decompressIndex += 1;
                            var aColor = (data & 0xfc000000) >>> (24 + 2);
                            var bColor = (data & 0x00fc0000) >>> (16 + 2);
                            var gColor = (data & 0x0000fc00) >>> (8 + 2);
                            var rColor = (data & 0x000000fc) >>> (2);
                            
                            color = (rColor << 18 | gColor << 12 | bColor << 6 | aColor) >>> 0;
                            if (color !== 0x00) {
                                chunker.voxelAtCoordinates(z, y, x, { v: color, f: 0}, true);                                
                            }
                        }
                    }
                }
            }
            matrixData.name = matrixName;
            matrixData.dataChunker = chunker;
            matrixData.pos = pos;
            matrixData.chunkerPivot = [0, 0, 0];
            matrixData.chunkScale = this.entity.getLocalScale().x;
            
            return index;
        },

        createChunkerFromVoxFile: function(resource) {
            var voxUint8Array = base64.toByteArray(resource);
            var voxDataView = new DataView(voxUint8Array.buffer);
            var scale = this.entity.getLocalScale().x;
            
            // Voxel adds 1 padding for each face. So chunkPad should be 2.
            var chunker = new voxel.Chunker({ chunkDistance: 0, chunkSize: 32, chunkPad: 2, cubeSize: scale * vx2.meshScale, generateVoxelChunk: this.createVoxelChunk});
            
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