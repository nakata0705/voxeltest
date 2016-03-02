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

pc.script.attribute('material', 'asset', [], {
    displayName: "Material",
    max: 1,
    type: 'material'
});

pc.script.attribute('transparentMaterial', 'asset', [], {
    displayName: "transparentMaterial",
    max: 1,
    type: 'material'
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

// Global voxel related function and variables.
var vx2 = {};

vx2.magicaVoxelDefaultPalette = [0x00000000,
                          0xffffffff, 0xffffccff, 0xffff99ff, 0xffff66ff, 0xffff33ff, 0xffff00ff, 0xffccffff, 0xffccccff, 0xffcc99ff, 0xffcc66ff, 0xffcc33ff, 0xffcc00ff, 0xff99ffff, 0xff99ccff, 0xff9999ff, 0xff9966ff, // 25
                          0xff9933ff, 0xff9900ff, 0xff66ffff, 0xff66ccff, 0xff6699ff, 0xff6666ff, 0xff6633ff, 0xff6600ff, 0xff33ffff, 0xff33ccff, 0xff3399ff, 0xff3366ff, 0xff3333ff, 0xff3300ff, 0xff00ffff, 0xff00ccff, // 31
                          0xff0099ff, 0xff0066ff, 0xff0033ff, 0xff0000ff, 0xccffffff, 0xccffccff, 0xccff99ff, 0xccff66ff, 0xccff33ff, 0xccff00ff, 0xccccffff, 0xccccccff, 0xcccc99ff, 0xcccc66ff, 0xcccc33ff, 0xcccc00ff, // 47
                          0xcc99ffff, 0xcc99ccff, 0xcc9999ff, 0xcc9966ff, 0xcc9933ff, 0xcc9900ff, 0xcc66ffff, 0xcc66ccff, 0xcc6699ff, 0xcc6666ff, 0xcc6633ff, 0xcc6600ff, 0xcc33ffff, 0xcc33ccff, 0xcc3399ff, 0xcc3366ff, // 63
                          0xcc3333ff, 0xcc3300ff, 0xcc00ffff, 0xcc00ccff, 0xcc0099ff, 0xcc0066ff, 0xcc0033ff, 0xcc0000ff, 0x99ffffff, 0x99ffccff, 0x99ff99ff, 0x99ff66ff, 0x99ff33ff, 0x99ff00ff, 0x99ccffff, 0x99ccccff, // 79
                          0x99cc99ff, 0x99cc66ff, 0x99cc33ff, 0x99cc00ff, 0x9999ffff, 0x9999ccff, 0x999999ff, 0x999966ff, 0x999933ff, 0x999900ff, 0x9966ffff, 0x9966ccff, 0x996699ff, 0x996666ff, 0x996633ff, 0x996600ff, // 95
                          0x9933ffff, 0x9933ccff, 0x993399ff, 0x993366ff, 0x993333ff, 0x993300ff, 0x9900ffff, 0x9900ccff, 0x990099ff, 0x990066ff, 0x990033ff, 0x990000ff, 0x66ffffff, 0x66ffccff, 0x66ff99ff, 0x66ff66ff, // 111
                          0x66ff33ff, 0x66ff00ff, 0x66ccffff, 0x66ccccff, 0x66cc99ff, 0x66cc66ff, 0x66cc33ff, 0x66cc00ff, 0x6699ffff, 0x6699ccff, 0x669999ff, 0x669966ff, 0x669933ff, 0x669900ff, 0x6666ffff, 0x6666ccff, // 127
                          0x666699ff, 0x666666ff, 0x666633ff, 0x666600ff, 0x6633ffff, 0x6633ccff, 0x663399ff, 0x663366ff, 0x663333ff, 0x663300ff, 0x6600ffff, 0x6600ccff, 0x660099ff, 0x660066ff, 0x660033ff, 0x660000ff, // 143
                          0x33ffffff, 0x33ffccff, 0x33ff99ff, 0x33ff66ff, 0x33ff33ff, 0x33ff00ff, 0x33ccffff, 0x33ccccff, 0x33cc99ff, 0x33cc66ff, 0x33cc33ff, 0x33cc00ff, 0x3399ffff, 0x3399ccff, 0x339999ff, 0x339966ff, // 159
                          0x339933ff, 0x339900ff, 0x3366ffff, 0x3366ccff, 0x336699ff, 0x336666ff, 0x336633ff, 0x336600ff, 0x3333ffff, 0x3333ccff, 0x333399ff, 0x333366ff, 0x333333ff, 0x333300ff, 0x3300ffff, 0x3300ccff, // 175
                          0x330099ff, 0x330066ff, 0x330033ff, 0x330000ff, 0x00ffffff, 0x00ffccff, 0x00ff99ff, 0x00ff66ff, 0x00ff33ff, 0x00ff00ff, 0x00ccffff, 0x00ccccff, 0x00cc99ff, 0x00cc66ff, 0x00cc33ff, 0x00cc00ff, // 191
                          0x0099ffff, 0x0099ccff, 0x009999ff, 0x009966ff, 0x009933ff, 0x009900ff, 0x0066ffff, 0x0066ccff, 0x006699ff, 0x006666ff, 0x006633ff, 0x006600ff, 0x0033ffff, 0x0033ccff, 0x003399ff, 0x003366ff, // 207
                          0x003333ff, 0x003300ff, 0x0000ffff, 0x0000ccff, 0x000099ff, 0x000066ff, 0x000033ff, 0xee0000ff, 0xdd0000ff, 0xbb0000ff, 0xaa0000ff, 0x880000ff, 0x770000ff, 0x550000ff, 0x440000ff, 0x220000ff, // 223
                          0x110000ff, 0x00ee00ff, 0x00dd00ff, 0x00bb00ff, 0x00aa00ff, 0x008800ff, 0x007700ff, 0x005500ff, 0x004400ff, 0x002200ff, 0x001100ff, 0x0000eeff, 0x0000ddff, 0x0000bbff, 0x0000aaff, 0x000088ff, // 239
                          0x000077ff, 0x000055ff, 0x000044ff, 0x000022ff, 0x000011ff, 0xeeeeeeff, 0xddddddff, 0xbbbbbbff, 0xaaaaaaff, 0x888888ff, 0x777777ff, 0x555555ff, 0x444444ff, 0x222222ff, 0x111111ff, 0x000000ff];  // 255
vx2.QB_CODEFLAG = 2;
vx2.QB_NEXTSLICEFLAG = 6;
vx2.meshScale = 1.0;
vx2.rigidBodyGap = 0.0 * vx2.meshScale;
vx2.voxelIdOffset = 0x40000;

vx2.convert32bitRGBAto24bitRGBA = function(color) {
	var aColor = (color & 0xfc000000) >>> (24 + 2);
	var bColor = (color & 0x00fc0000) >>> (16 + 2);
	var gColor = (color & 0x0000fc00) >>> (8 + 2);
	var rColor = (color & 0x000000fc) >>> (2);                    
    return (rColor << 18 | gColor << 12 | bColor << 6 | aColor) >>> 0;
};

vx2.convert24bitRGBAto8bitRGBAArray = function(color) {
	return [ Math.round((((color >>> 18) & 0x3f) / 0x3f) * 0xff),
			 Math.round((((color >>> 12) & 0x3f) / 0x3f) * 0xff),
             Math.round((((color >>> 6) & 0x3f) / 0x3f) * 0xff),
             Math.round(((color & 0x3f) / 0x3f) * 0xff) ];
};

vx2.convert32bitRGBAto8bitRGBAArray = function(color) {
	return [ (color >>> 24) & 0xff,
	         (color >>> 16) & 0xff,
	         (color >>> 8) & 0xff,
	         color & 0xff ];
};
               
vx2.removeRigidBodies = function(targetEntity, center, distance, app) {
    if (targetEntity.chunkerObject === undefined) {
        return;
    }
   
    var chunker = targetEntity.chunkerObject.dataChunker;
    var nearby = chunker.nearbyChunksCoordinate(center, distance);
    for (var n = 0; n < nearby.length; n++) {
        var bodiesArray = chunker.getBodies(nearby[n][0], nearby[n][1], nearby[n][2]);
        if (!bodiesArray) continue;
        
        // Remove all rigidbodies
        for (var i = 0; i < bodiesArray.length; i++) {
            app.systems.rigidbody.removeBody(bodiesArray[i]);
            Ammo.destroy(bodiesArray[i].getCollisionShape());
            Ammo.destroy(bodiesArray[i]);
        }
        chunker.setBodies(nearby[n][0], nearby[n][1], nearby[n][2], []);
    }    
};

vx2.recreateModel = function(targetEntity, isDataModel, castShadows, receiveShadows, center, distance, app) {
    if (targetEntity.chunkerObject === undefined) {
        return;
    }
    if (targetEntity.model === undefined) {
        targetEntity.addComponent('model');
        targetEntity.model.castShadows = castShadows;
        targetEntity.model.receiveShadows = receiveShadows;
    }
    
    // Calculate XYZ offset for mesh
    var chunker = targetEntity.chunkerObject.dataChunker;
    var chunkerPivot = targetEntity.chunkerObject.chunkerPivot;
    var coordinateOffset = [-(chunker.originalDims[2] * chunkerPivot[0] + chunker.chunkPadHalf), -(chunker.originalDims[1] * chunkerPivot[1] + chunker.chunkPadHalf), -(chunker.originalDims[0] * chunkerPivot[2] + chunker.chunkPadHalf)];

    // Create a new PlayCanvas Model from MeshInstance in each chunk
    var node;
    var material = app.assets.get(targetEntity.material).resource;
    var transparentMaterial = app.assets.get(targetEntity.transparentMaterial).resource;
    var model;
    if (!targetEntity.model.model) {
        node = new pc.GraphNode();
        model = new pc.Model();
        model.graph = node;
        model.meshInstances = [];
    }
    else {
        model = targetEntity.model.model;
        node = targetEntity.model.model.graph;
        app.scene.removeModel(model);
    }
    
    var nearby = chunker.nearbyChunksCoordinate(center, distance);
    var meshInstance;
    var meshInstanceIndex;
    var n, m;
    // Remove nearby chunk's mesh from model
    for (n = 0; n < nearby.length; n++) {
        meshInstances = chunker.getMeshes(nearby[n][0], nearby[n][1], nearby[n][2]);
        if (!meshInstances) continue;
        for (m = 0; m < meshInstances.length; m++) {
            // Create and keep the MeshInstance in the chunk
            meshInstanceIndex = model.meshInstances.indexOf(meshInstances[m]);
            if (meshInstanceIndex >= 0) {
                model.meshInstances.splice(meshInstanceIndex, 1);
            }
        }
        chunker.setMeshes(nearby[n][0], nearby[n][1], nearby[n][2], undefined);
    }
    
    vx2.createPlayCanvasMeshInstanceForChunk(chunker, isDataModel, coordinateOffset, material, transparentMaterial, center, distance, node, app);
    
    // Add nearby chunk's mesh to model
    for (n = 0; n < nearby.length; n++) {
        meshInstances = chunker.getMeshes(nearby[n][0], nearby[n][1], nearby[n][2]);
        if (!meshInstances) continue;
        for (m = 0; m < meshInstances.length; m++) {
            if (!meshInstances[m]) continue;
            // Create and keep the MeshInstance in the chunk
            model.meshInstances.push(meshInstances[m]);
            if (isDataModel === false) {
                // This is a attr rendering. Use wireframe.
                meshInstances[m].renderStyle = pc.RENDERSTYLE_WIREFRAME;
            }
        }
    }    
    if (isDataModel === false) {
        model.generateWireframe();        
    }
    targetEntity.model.model = model;
    app.scene.addModel(model);
};

vx2.recreateRigidBodies = function(targetEntity, center, distance, app) {
    if (targetEntity.needsRigidbody) {
        // Remove rigid bodies
        vx2.removeRigidBodies(targetEntity, center, distance, app);
        
        // Add collision component
        if (targetEntity.collision === undefined) {
            targetEntity.addComponent("collision", {
                type: "sphere",
                radius: 0
            });
        }
        if (targetEntity.trigger) {
            targetEntity.trigger.destroy();
            targetEntity.trigger = undefined;
        }
        
        // Create rigid bodies
        var chunker = targetEntity.chunkerObject.dataChunker;
        var chunkerPivot = targetEntity.chunkerObject.chunkerPivot;
        var coordinateOffset = [-(chunker.originalDims[2] * chunkerPivot[0] + chunker.chunkPadHalf), -(chunker.originalDims[1] * chunkerPivot[1] + chunker.chunkPadHalf), -(chunker.originalDims[0] * chunkerPivot[2] + chunker.chunkPadHalf)];
        vx2.createPlayCanvasRigidBodyForChunk(chunker, coordinateOffset, targetEntity.chunkerObject.cubeSize, targetEntity, center, distance, app);
    }
};

vx2.createPlayCanvasMeshInstanceForChunk = function (chunker, isDataModel, coordinateOffset, material, transparentMaterial, center, distance, node, app) {    
    var nearby = chunker.nearbyChunksCoordinate(center, distance);
    var i, j, n;
    for (n = 0; n < nearby.length; n++) {
        var chunk = chunker.getChunk(nearby[n][0], nearby[n][1], nearby[n][2]);
        if (chunk === undefined) {
            continue;
        }
        
        var positions = [];
        var uvs = [];
        var colors = [];
        var indices = [];
        
        // Generate chunkMesh from chunker
        var chunkMesh;
        if (isDataModel === true) {
            chunkMesh = voxel.meshers.transgreedy(chunk.voxelArray.data, chunk.voxelArray.shape);
        }
        else {
            chunkMesh = voxel.meshers.greedy(chunk.voxelArray.data, chunk.voxelArray.shape);
        }
        
        if ((!chunkMesh.faces || chunkMesh.faces.length === 0) && (!chunkMesh.tFaces || chunkMesh.tFaces.length === 0)) {
            // No voxel in the chunk anymore. Continue.
            chunker.setMeshes(nearby[n][0], nearby[n][1], nearby[n][2], undefined);
            chunk.empty = true;
            continue;
        }

        var color, normals, tangents, playCanvasMesh, mesh, meshInstance;
        if (chunkMesh.faces && chunkMesh.faces.length > 0) {
            // Push positions
            for (i = 0; i < chunkMesh.vertices.length; i++) {
                positions.push((chunkMesh.vertices[i][0] + coordinateOffset[0] + chunker.chunkSize * chunk.position[2]) * vx2.meshScale,
                               (chunkMesh.vertices[i][1] + coordinateOffset[1] + chunker.chunkSize * chunk.position[1]) * vx2.meshScale,
                               (chunkMesh.vertices[i][2] + coordinateOffset[2] + chunker.chunkSize * chunk.position[0]) * vx2.meshScale);
                colors.push(0, 0, 0, 0);
                uvs.push(0, 0);
            }
            
            for (i = 0; i < chunkMesh.faces.length; i++) {
                color = chunkMesh.faces[i][4]; // The minimum color index in VOX is 1.
                indices.push(chunkMesh.faces[i][0], chunkMesh.faces[i][2], chunkMesh.faces[i][3], chunkMesh.faces[i][0], chunkMesh.faces[i][1], chunkMesh.faces[i][2]);
                
                for (j = 0; j < 4; j++) {
                    // Set vertex color
                    if (isDataModel === true) {
                    	if (color < vx2.voxelIdOffset) {
                    		// Set 24bit RGBA color
                    		uInt8RGBAArray = vx2.convert24bitRGBAto8bitRGBAArray(color);
                        	colors[chunkMesh.faces[i][j] * 4] = uInt8RGBAArray[0];
                        	colors[chunkMesh.faces[i][j] * 4 + 1] = uInt8RGBAArray[1];
                        	colors[chunkMesh.faces[i][j] * 4 + 2] = uInt8RGBAArray[2];
                        	colors[chunkMesh.faces[i][j] * 4 + 3] = uInt8RGBAArray[3];
                        }
                        else {
                        	
                        }
                    }
                    else {
                        colors[chunkMesh.faces[i][j] * 4] = color;
                        colors[chunkMesh.faces[i][j] * 4 + 1] = color;
                        colors[chunkMesh.faces[i][j] * 4 + 2] = color;
                        colors[chunkMesh.faces[i][j] * 4 + 3] = 0xff;
                    }
                }
                
                // Trying to get the face's width and height
                var diff = [];
                var u = 0, v = 1;
                for (j = 0; j < 3; j++) {
                    diff[j] = Math.round(positions[chunkMesh.faces[i][2] * 3 + j] - positions[chunkMesh.faces[i][0] * 3 + j]);
                    if (diff[j] === 0) {
                        u = (j + 1) % 3;
                        v = (j + 2) % 3;
                    }
                }
                
                // Get if the face is clockwise or counter clockwise.
                var vertex = [];
                var diffVertex = [];
                for (j = 0; j < 4; j++) {
                    vertex[j] = [positions[chunkMesh.faces[i][j] * 3], positions[chunkMesh.faces[i][j] * 3 + 1], positions[chunkMesh.faces[i][j] * 3 + 2]];
                }
                for (j = 0; j < 3; j++) {
                    diffVertex[j] = [vertex[j + 1][0] - vertex[j][0], vertex[j + 1][1] - vertex[j][1], vertex[j + 1][2] - vertex[j][2]];
                }
                
                // Set proper UV coordinate
                switch (u) {
                    case 0: // U = x axis. When counter clock wise, 0 to 1 increases Y value = V value.
                        if (diffVertex[0][u] !== 0) {
                            // Counter clock wise
                            uvs[chunkMesh.faces[i][0] * 2] = 0;
                            uvs[chunkMesh.faces[i][0] * 2 + 1] = 0;
                            uvs[chunkMesh.faces[i][1] * 2] = diff[u];
                            uvs[chunkMesh.faces[i][1] * 2 + 1] = 0;
                            uvs[chunkMesh.faces[i][2] * 2] = diff[u];
                            uvs[chunkMesh.faces[i][2] * 2 + 1] = diff[v];
                            uvs[chunkMesh.faces[i][3] * 2] = 0;
                            uvs[chunkMesh.faces[i][3] * 2 + 1] = diff[v];
                        }
                        else {
                            // Clock wise
                            uvs[chunkMesh.faces[i][0] * 2] = diff[u];
                            uvs[chunkMesh.faces[i][0] * 2 + 1] = 0;
                            uvs[chunkMesh.faces[i][1] * 2] = diff[u];
                            uvs[chunkMesh.faces[i][1] * 2 + 1] = diff[v];
                            uvs[chunkMesh.faces[i][2] * 2] = 0;
                            uvs[chunkMesh.faces[i][2] * 2 + 1] = diff[v];
                            uvs[chunkMesh.faces[i][3] * 2] = 0;
                            uvs[chunkMesh.faces[i][3] * 2 + 1] = 0;
                        }
                        break;
                    case 1: // U = y axis
                        if (diffVertex[0][u] !== 0) {
                            // Counter clock wise
                            uvs[chunkMesh.faces[i][0] * 2] = diff[v];
                            uvs[chunkMesh.faces[i][0] * 2 + 1] = 0;
                            uvs[chunkMesh.faces[i][1] * 2] = diff[v];
                            uvs[chunkMesh.faces[i][1] * 2 + 1] = diff[u];
                            uvs[chunkMesh.faces[i][2] * 2] = 0;
                            uvs[chunkMesh.faces[i][2] * 2 + 1] = diff[u];
                            uvs[chunkMesh.faces[i][3] * 2] = 0;
                            uvs[chunkMesh.faces[i][3] * 2 + 1] = 0;
                        }
                        else {
                            // Clock wise
                            uvs[chunkMesh.faces[i][0] * 2] = 0;
                            uvs[chunkMesh.faces[i][0] * 2 + 1] = 0;
                            uvs[chunkMesh.faces[i][1] * 2] = diff[v];
                            uvs[chunkMesh.faces[i][1] * 2 + 1] = 0;
                            uvs[chunkMesh.faces[i][2] * 2] = diff[v];
                            uvs[chunkMesh.faces[i][2] * 2 + 1] = diff[u];
                            uvs[chunkMesh.faces[i][3] * 2] = 0;
                            uvs[chunkMesh.faces[i][3] * 2 + 1] = diff[u];
                        }
                        break;
                    case 2: // U = z axis
                        if (diffVertex[0][u] !== 0) {
                            // Counter clock wise
                            uvs[chunkMesh.faces[i][0] * 2] = 0;
                            uvs[chunkMesh.faces[i][0] * 2 + 1] = 0;
                            uvs[chunkMesh.faces[i][1] * 2] = diff[u];
                            uvs[chunkMesh.faces[i][1] * 2 + 1] = 0;
                            uvs[chunkMesh.faces[i][2] * 2] = diff[u];
                            uvs[chunkMesh.faces[i][2] * 2 + 1] = diff[v];
                            uvs[chunkMesh.faces[i][3] * 2] = 0;
                            uvs[chunkMesh.faces[i][3] * 2 + 1] = diff[v];
                        }
                        else {
                            // Clock wise
                            uvs[chunkMesh.faces[i][0] * 2] = 0;
                            uvs[chunkMesh.faces[i][0] * 2 + 1] = 0;
                            uvs[chunkMesh.faces[i][1] * 2] = 0;
                            uvs[chunkMesh.faces[i][1] * 2 + 1] = diff[v];
                            uvs[chunkMesh.faces[i][2] * 2] = diff[u];
                            uvs[chunkMesh.faces[i][2] * 2 + 1] = diff[v];
                            uvs[chunkMesh.faces[i][3] * 2] = diff[u];
                            uvs[chunkMesh.faces[i][3] * 2 + 1] = 0;
                        }
                        break;
                }
            }

            normals = pc.calculateNormals(positions, indices);
            tangents = pc.calculateTangents(positions, normals, uvs, indices);            

            // Convert Voxel.js mesh information to PlayCanvas mesh info
            playCanvasMesh = { indices: indices, positions: positions, normals: normals, colors: colors, uvs: uvs, tangents: tangents };
            mesh = pc.createMesh(app.graphicsDevice, playCanvasMesh.positions, {
                normals: playCanvasMesh.normals,
                colors: playCanvasMesh.colors,
                uvs: playCanvasMesh.uvs,
                indices: playCanvasMesh.indices,
                tangents: playCanvasMesh.tangents
            });
            meshInstance = new pc.MeshInstance(node, mesh, material);
            chunker.setMeshes(nearby[n][0], nearby[n][1], nearby[n][2], meshInstance);        
        }

        // Create transparent meshInstances from transparent faces
        if (chunkMesh.tFaces && chunkMesh.tFaces.length > 0) {
            for (i = 0; i < chunkMesh.tFaces.length; i++) {
                positions = [];
                indices = [];
                colors = [];

                for (j = 0; j < 4; j++) {
                    positions.push((chunkMesh.tVertices[chunkMesh.tFaces[i][j]][0] + coordinateOffset[0] + chunker.chunkSize * chunk.position[2]) * vx2.meshScale,
                                   (chunkMesh.tVertices[chunkMesh.tFaces[i][j]][1] + coordinateOffset[1] + chunker.chunkSize * chunk.position[1]) * vx2.meshScale,
                                   (chunkMesh.tVertices[chunkMesh.tFaces[i][j]][2] + coordinateOffset[2] + chunker.chunkSize * chunk.position[0]) * vx2.meshScale);
                }
                colors.push(0, 0, 0, 0);
                indices.push(0, 1, 2, 2, 3, 0);

                color = chunkMesh.tFaces[i][4]; // The minimum color index in VOX is 1.

                // Set vertex color
                for (j = 0; j < 4; j++) {
                    if (isDataModel === true) {
                        colors[j * 4] = Math.round((((color >>> 18) & 0x3f) / 0x3f) * 0xff);
                        colors[j * 4 + 1] = Math.round((((color >>> 12) & 0x3f) / 0x3f) * 0xff);
                        colors[j * 4 + 2] = Math.round((((color >>> 6) & 0x3f) / 0x3f) * 0xff);
                        colors[j * 4 + 3] = Math.round(((color & 0x3f) / 0x3f) * 0xff);
                    }
                    else {
                        colors[j * 4] = color;
                        colors[j * 4 + 1] = color;
                        colors[j * 4 + 2] = color;
                        colors[j * 4 + 3] = color;
                    }
                }
                normals = pc.calculateNormals(positions, indices);

                // Convert Voxel.js mesh information to PlayCanvas mesh info
                playCanvasMesh = { indices: indices, positions: positions, normals: normals, colors: colors };
                mesh = pc.createMesh(app.graphicsDevice, playCanvasMesh.positions, {
                    normals: playCanvasMesh.normals,
                    colors: playCanvasMesh.colors,
                    indices: playCanvasMesh.indices
                });
                meshInstance = new pc.MeshInstance(node, mesh, transparentMaterial);
                chunker.setMeshes(nearby[n][0], nearby[n][1], nearby[n][2], meshInstance);        
            }
        }
    }
};

vx2.createPlayCanvasRigidBodyForChunk = function(chunker, coordinateOffset, cubeSize, targetEntity, center ,distance, app) {
    var nearby = chunker.nearbyChunksCoordinate(center, distance);
    
    // Calculate center offset
    var pos = targetEntity.getPosition();
    var parentEntityScale = targetEntity.getParent().getLocalScale();
    var totalRigidBodyNum = 0;
    
    // Register rigidbodies for each nearby chunk
    for (var m = 0; m < nearby.length; m++) {
        var chunk = chunker.getChunk(nearby[m][0], nearby[m][1], nearby[m][2]);
        if (chunk === undefined) {
            continue;
        }
        
        var chunkRigidBodyNum = 0;
        var volume = chunk.voxelArray.data.slice(0); // Copy the voxel data. Might be costly.
        var dimsX = chunk.voxelArray.shape[2],
            dimsY = chunk.voxelArray.shape[1],
            dimsXY = dimsX * dimsY;

        // Sweep over Y axis
        var d = 1,
            u = (d + 1) % 3,
            v = (d + 2) % 3,
            x = [0, 0, 0],
            dimsD = chunk.voxelArray.shape[d],
            dimsU = chunk.voxelArray.shape[u],
            dimsV = chunk.voxelArray.shape[v],
            xd, xv, xu,
            n;

        while (x[d] < dimsD) {
            xd = x[d];
            for(x[v] = 0; x[v] < dimsV; ++x[v]) {
                xv = x[v];
                for(x[u] = 0; x[u] < dimsU; ++x[u]) {
                    xu = x[u];
                    var a = 0x00000000;
                    if (xd === 0 || xd === dimsD - 1 || xu === 0 || xu === dimsU - 1 || xv === 0 || xv === dimsV - 1) {
                        a = volume[x[2]      + dimsX * x[1]          + dimsXY * x[0]          ];
                    }
                    else if (volume[x[2] - 1  + dimsX * x[1]          + dimsXY * x[0]          ] === 0x0000 ||
                             volume[x[2] + 1  + dimsX * x[1]          + dimsXY * x[0]          ] === 0x0000 ||
                             volume[x[2]      + dimsX * (x[1] + 1)    + dimsXY * x[0]          ] === 0x0000 ||
                             volume[x[2]      + dimsX * (x[1] - 1)    + dimsXY * x[0]          ] === 0x0000 ||
                             volume[x[2]      + dimsX * x[1]          + dimsXY * (x[0] - 1)    ] === 0x0000 ||
                             volume[x[2]      + dimsX * x[1]          + dimsXY * (x[0] + 1)    ] === 0x0000 ) {
                        a = volume[x[2]      + dimsX * x[1]          + dimsXY * x[0]          ];
                    }
                    if (a !== 0x00000000) {
                        // Found the origin point. Scan voxel and create as large as possible box rigid body
                        var xx = x.slice(0);
                        var max = [0, 0, 0];
                        max[d] = dimsD;
                        max[v] = dimsV;
                        max[u] = dimsU;
                        maxValid = [false, false, false];

                        printDebugMessage("a = " + a.toString(16) + " (x, y, z) = (" + xx[2] + ", " + xx[1] + ", " + xx[0] + ") scale = " + parentEntityScale, 8);

                        while (xx[d] < max[d]) {
                            for(xx[v] = x[v]; xx[v] < max[v]; ++xx[v]) {
                                for (xx[u] = x[u]; xx[u] < max[u]; ++xx[u]) {
                                    var aa = volume[xx[2]      + dimsX * xx[1]          + dimsXY * xx[0]          ];
                                    if (aa === 0x0000) {
                                        if (maxValid[u] === false) {
                                            // Found new uMax
                                            max[u] = xx[u];
                                            maxValid[u] = true;
                                            printDebugMessage("Found uMax: " + max[u], 8);
                                        }
                                        break;
                                    }
                                }
                                if (maxValid[u] === false) {
                                    // Exit from the loop without finding the new uMax
                                    max[u] = xx[u];
                                    maxValid[u] = true;
                                    printDebugMessage("Found uMax: " + max[u], 8);
                                }
                                if (xx[u] < max[u]) {
                                    if (maxValid[v] === false) {
                                        // Found new vMax
                                        max[v] = xx[v];
                                        maxValid[v] = true;
                                        printDebugMessage("Found vMax: " + max[v], 8);
                                    }
                                    break;                                        
                                }
                            }
                            if (maxValid[v] === false) {
                                // Exit from the loop without finding the new uMax
                                max[v] = xx[v];
                                maxValid[v] = true;
                                printDebugMessage("Found vMax: " + max[v], 8);
                            }
                            if (xx[v] < max[v]) {
                                if (maxValid[d] === false) {
                                    // Found new dMax
                                    max[d] = xx[d];
                                    maxValid[d] = true;
                                    printDebugMessage("Found dMax: " + max[d], 8);
                                }
                                break;
                            }
                            ++xx[d];
                        }

                        // Clear voxel value
                        for (xx[d] = x[d]; xx[d] < max[d]; ++xx[d]) {
                            for (xx[v] = x[v]; xx[v] < max[v]; ++xx[v]) {
                                for (xx[u] = x[u]; xx[u] < max[u]; ++xx[u]) {
                                    volume[xx[2] + dimsX * xx[1] + dimsXY * xx[0]] = 0x0000;
                                }
                            }
                        }

                        var rigidBodyBoxScale = new pc.Vec3(max[2] - x[2] - vx2.rigidBodyGap,
                                                            max[1] - x[1] - vx2.rigidBodyGap,
                                                            max[0] - x[0] - vx2.rigidBodyGap);               
                        vx2.registerStaticRigidBody((x[2] + max[2]) * 0.5 + coordinateOffset[0] + chunker.chunkSize * chunk.position[2],
                                                    (x[1] + max[1]) * 0.5 + coordinateOffset[1] + chunker.chunkSize * chunk.position[1],
                                                    (x[0] + max[0]) * 0.5 + coordinateOffset[2] + chunker.chunkSize * chunk.position[0],
                                                    parentEntityScale, rigidBodyBoxScale, targetEntity, chunker, nearby[m], app);
                        chunkRigidBodyNum += 1;
                    }
                }
            }
            ++x[d];
        }
        if (chunkRigidBodyNum === 0) {
            chunk.empty = true;
        }
        totalRigidBodyNum += chunkRigidBodyNum;
    }
};

vx2.registerStaticRigidBody = function(x, y, z, parentEntityScale, rigidBodyBoxScale, targetEntity, chunker, nearby, app) {
    printDebugMessage("(x, y, z) = (" + x + ", " + y + ", " + z + " parentEntityScale = " + parentEntityScale + " rigidBodyBoxScale = " + rigidBodyBoxScale, 8);

    var mass = 0; // Static volume which has infinite mass
    
    var cleanUpTarget = {};
    var localVec = new Ammo.btVector3(parentEntityScale.x * rigidBodyBoxScale.x * vx2.meshScale * 0.5, parentEntityScale.y * rigidBodyBoxScale.y * vx2.meshScale * 0.5, parentEntityScale.z * rigidBodyBoxScale.z * vx2.meshScale * 0.5);
    var shape = new Ammo.btBoxShape(localVec);

    var entityPos = targetEntity.getPosition();
    var entityRot = targetEntity.getParent().getLocalRotation();
    
    var chunk = chunker.getChunk(nearby[0], nearby[1], nearby[2]);
    var bodiesArray = chunker.getBodies(nearby[0], nearby[1], nearby[2]);
    if (bodiesArray === undefined) {
        bodiesArray = chunker.setBodies(nearby[0], nearby[1], nearby[2], []);
    }

    var localPos = new pc.Vec3(x, y, z);
    localPos.x = (localPos.x) * vx2.meshScale * parentEntityScale.x;
    localPos.y = (localPos.y) * vx2.meshScale * parentEntityScale.y;
    localPos.z = (localPos.z) * vx2.meshScale * parentEntityScale.z;            
    localPos = entityRot.transformVector(localPos);

    var transformPos = new pc.Vec3();
    transformPos.add2(entityPos, localPos);

    var ammoQuat = new Ammo.btQuaternion();
    ammoQuat.setValue(entityRot.x, entityRot.y, entityRot.z, entityRot.w);

    var startTransform = new Ammo.btTransform();
    startTransform.setIdentity();
    startTransform.getOrigin().setValue(transformPos.x, transformPos.y, transformPos.z);            
    startTransform.setRotation(ammoQuat);

    localVec.setValue(0, 0, 0);

    var motionState = new Ammo.btDefaultMotionState(startTransform);
    var bodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localVec);

    var body = new Ammo.btRigidBody(bodyInfo);

    body.chunk = chunk;
    body.entity = targetEntity; // This is necessary to have collision event work.
    body.localPos = localPos;
    body.setRestitution(0.5);
    body.setFriction(0.5);
    body.setDamping(0.5, 0.5);

    localVec.setValue(0, 0, 0);
    body.setLinearFactor(localVec);
    localVec.setValue(0, 0, 0);
    body.setAngularFactor(localVec);

    bodiesArray.push(body);
    
    Ammo.destroy(localVec);
    Ammo.destroy(ammoQuat);
    Ammo.destroy(startTransform);
    Ammo.destroy(motionState);
    Ammo.destroy(bodyInfo);

    app.systems.rigidbody.addBody(body, pc.BODYGROUP_STATIC, pc.BODYMASK_NOT_STATIC);
    body.forceActivationState(pc.BODYFLAG_ACTIVE_TAG);
    body.activate();
};

// MagicaVoxelDefaultPaletteを24bitカラーに変換する(下位24bitをRGBAカラーとして予約)
for (var i = 0; i < 255; i++) {
    vx2.magicaVoxelDefaultPalette[i] = vx2.convert32bitRGBAto24bitRGBA(vx2.magicaVoxelDefaultPalette[i]);
}

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
                vx2.recreateRigidBodies(entity, [0, 0, 0], 6, app);
            }            
        },
                 
        createVoxelChunk: function(low, high, x, y, z) {
        	return new Chunk(low, high, function(i, j, k) { return 0; });
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
                                chunker.voxelAtCoordinates(z, y, x, color, true);
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
                                    chunker.voxelAtCoordinates(z, y, x, color, true);
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
                                chunker.voxelAtCoordinates(z, y, x, color, true);                                
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
                            chunker.voxelAtCoordinates(chunker.originalDims[2] - voxelZ - 1, voxelY, voxelX, voxelColorIndex, true);
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
                        if (result[0] !== undefined && result[0] > 0 && result[0] <= 255) {
                            if (this.useVoxPalette === true) {
                            	// Convert voxel value to 24bit RGBA color
                            	chunker.voxelAtCoordinates(x, y, z, customPalette[result[0]]);
                            }
                            else {
                            	// Move the voxel value to "index" voxel ID space
                            	chunker.voxelAtCoordinates(x, y, z, result[0] + vx2.voxelIdOffset);
                            }
                        }
                    }
                }
            }
        }
    };

    return VoxelEntity3;
});