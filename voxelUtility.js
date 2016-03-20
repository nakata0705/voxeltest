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
vx2.rigidBodyGap = 0.01 * vx2.meshScale;
vx2.voxelIdOffset = 0x1000000;

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
               
vx2.removeRigidBodies = function(targetEntity, center, distance) {
	// チャンカーオブジェクトが存在しないなら処理を行わない
    if (!targetEntity.chunkerObject === undefined) return;
    
    // Dataチャンカーから中央から指定距離内にあるすべてのチャンク座標を取得   
	var app = pc.Application.getApplication();   
    var chunker = targetEntity.chunkerObject.dataChunker;
    var nearby = chunker.nearbyChunksCoordinate(center, distance);
    
    // 見つかったそれぞれのチャンクに対してRigidBodyを削除する
    for (var n = 0; n < nearby.length; n++) {
        var targetChunk = chunker.getChunk(nearby[n][0], nearby[n][1], nearby[n][2]);
        if (targetChunk) targetChunk.destroyRigidBody();
    }    
};

vx2.recreateModel = function(targetEntity, isDataModel, castShadows, receiveShadows, center, distance) {
	var app = pc.Application.getApplication();
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

vx2.recreateRigidBodies = function(targetEntity, center, distance) {
    if (!targetEntity.needsRigidbody) return;
    
    // 以前生成されたRigid Bodyを削除
    vx2.removeRigidBodies(targetEntity, center, distance);
    
    // collisionコンポーネントをエンティティに追加
    if (!targetEntity.collision) targetEntity.addComponent("collision", {　type: "sphere",　radius: 0　});
    if (targetEntity.trigger) {
        targetEntity.trigger.destroy();
        targetEntity.trigger = undefined;
    }
    
    // ボクセル単位でのチャンカーの座標オフセットを求める
    var chunker = targetEntity.chunkerObject.dataChunker;
    var chunkerPivot = targetEntity.chunkerObject.chunkerPivot;
    var coordinateOffset = [-(chunker.originalDims[2] * chunkerPivot[0] + chunker.chunkPadHalf), -(chunker.originalDims[1] * chunkerPivot[1] + chunker.chunkPadHalf), -(chunker.originalDims[0] * chunkerPivot[2] + chunker.chunkPadHalf)];
    
    // 座標オフセットをもとにRigid Bodyを生成
    vx2.createPlayCanvasRigidBodyForChunk(chunker, coordinateOffset, targetEntity.chunkerObject.cubeSize, targetEntity, center, distance);
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
            	// voxelIDを面の頂点色から取得
                color = chunkMesh.faces[i][4]; // The minimum color index in VOX is 1.
                
                // 面を追加
                indices.push(chunkMesh.faces[i][0], chunkMesh.faces[i][2], chunkMesh.faces[i][3], chunkMesh.faces[i][0], chunkMesh.faces[i][1], chunkMesh.faces[i][2]);
                
                // 面の向き、高さとと幅を取得する、ただしすべての面がローカル座標平面と垂直であることを前提とする
                var diff = [];
                var u = 0, v = 1;
                for (j = 0; j < 3; j++) {
                    diff[j] = Math.round(positions[chunkMesh.faces[i][2] * 3 + j] - positions[chunkMesh.faces[i][0] * 3 + j]);
                    if (diff[j] === 0) {
                        u = (j + 1) % 3;
                        v = (j + 2) % 3;
                    }
                }
                
                // diffVertexは現在操作中の面の情報が入っており、軸の情報を取得できる。
                var vertex = [];
                var diffVertex = [];
                for (j = 0; j < 4; j++) {
                    vertex[j] = [positions[chunkMesh.faces[i][j] * 3], positions[chunkMesh.faces[i][j] * 3 + 1], positions[chunkMesh.faces[i][j] * 3 + 2]];
                }
                for (j = 0; j < 3; j++) {
                    diffVertex[j] = [vertex[j + 1][0] - vertex[j][0], vertex[j + 1][1] - vertex[j][1], vertex[j + 1][2] - vertex[j][2]];
                }
                
                var clockwise;
                if (diffVertex[0][u] !== 0) {
                	clockwise = false;
                }
                else {
                	clockwise = true;
                }
				
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
                        	var voxelId = color - vx2.voxelIdOffset;
		            	    var face = resourcePack.getFace(u, clockwise);                
        			        var textureId = resourcePack.getTextureId(voxelId, face);
                        	colors[chunkMesh.faces[i][j] * 4] = textureId;
                        	colors[chunkMesh.faces[i][j] * 4 + 1] = textureId;
                        	colors[chunkMesh.faces[i][j] * 4 + 2] = textureId;
                        	colors[chunkMesh.faces[i][j] * 4 + 3] = textureId;
                        }
                    }
                    else {
                        colors[chunkMesh.faces[i][j] * 4] = color;
                        colors[chunkMesh.faces[i][j] * 4 + 1] = color;
                        colors[chunkMesh.faces[i][j] * 4 + 2] = color;
                        colors[chunkMesh.faces[i][j] * 4 + 3] = 0xff;
                    }
                }
                                
                // Set proper UV coordinate
                switch (u) {
                    case 0: // U = x axis. When counter clock wise, 0 to 1 increases Y value = V value.
                        if (clockwise === false) {
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
                        if (clockwise === false) {
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
                        if (clockwise === false) {
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

vx2.createPlayCanvasRigidBodyForChunk = function(chunker, coordinateOffset, cubeSize, targetEntity, center ,distance) {
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
        var volume = chunk.voxelArray.data;
        var mark = [];
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
                        if (mark[x[2]      + dimsX * x[1]          + dimsXY * x[0]          ] === undefined) {
                        	a = volume[x[2]      + dimsX * x[1]          + dimsXY * x[0]          ].v;
                        }
                        else {
                        	a = 0;
                        }
                    }
                    else if ((volume[x[2] - 1  + dimsX * x[1]          + dimsXY * x[0]          ].v === 0 ||
                    	      mark  [x[2] - 1  + dimsX * x[1]          + dimsXY * x[0]          ] !== undefined) ||
                             (volume[x[2] + 1  + dimsX * x[1]          + dimsXY * x[0]          ].v === 0 ||
                              mark  [x[2] + 1  + dimsX * x[1]          + dimsXY * x[0]          ] !== undefined) ||
                             (volume[x[2]      + dimsX * (x[1] + 1)    + dimsXY * x[0]          ].v === 0 ||
                              mark  [x[2]      + dimsX * (x[1] + 1)    + dimsXY * x[0]          ] !== undefined) ||
                             (volume[x[2]      + dimsX * (x[1] - 1)    + dimsXY * x[0]          ].v === 0 ||
                              mark  [x[2]      + dimsX * (x[1] - 1)    + dimsXY * x[0]          ] !== undefined) ||
                             (volume[x[2]      + dimsX * x[1]          + dimsXY * (x[0] - 1)    ].v === 0 ||
                              mark  [x[2]      + dimsX * x[1]          + dimsXY * (x[0] - 1)    ] !== undefined) ||
                             (volume[x[2]      + dimsX * x[1]          + dimsXY * (x[0] + 1)    ].v === 0 ||
                              mark  [x[2]      + dimsX * x[1]          + dimsXY * (x[0] + 1)    ] !== undefined)) {
                        if (mark[x[2]      + dimsX * x[1]          + dimsXY * x[0]          ] === undefined) {
                        	a = volume[x[2]      + dimsX * x[1]          + dimsXY * x[0]          ].v;
                        }
                        else {
                        	a = 0;
                        }
                    }
                    if (a !== 0) {
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
                                    var aa;
                                    if (mark[xx[2]      + dimsX * xx[1]          + dimsXY * xx[0]          ] === undefined) {
                                    	aa = volume[xx[2]      + dimsX * xx[1]          + dimsXY * xx[0]          ].v;
                                    }
                                    else {
                                    	aa = 0;
                                    }
                                    if (aa === 0) {
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

                        // Mark voxel as used
                        for (xx[d] = x[d]; xx[d] < max[d]; ++xx[d]) {
                            for (xx[v] = x[v]; xx[v] < max[v]; ++xx[v]) {
                                for (xx[u] = x[u]; xx[u] < max[u]; ++xx[u]) {
                                    mark[xx[2] + dimsX * xx[1] + dimsXY * xx[0]] = 1;
                                }
                            }
                        }

                        var rigidBodyBoxScale = new pc.Vec3(max[2] - x[2] - vx2.rigidBodyGap,
                                                            max[1] - x[1] - vx2.rigidBodyGap,
                                                            max[0] - x[0] - vx2.rigidBodyGap);               
                        chunk.setRigidBody((x[2] + max[2]) * 0.5 + coordinateOffset[0] + chunker.chunkSize * chunk.position[2],
                                           (x[1] + max[1]) * 0.5 + coordinateOffset[1] + chunker.chunkSize * chunk.position[1],
                                           (x[0] + max[0]) * 0.5 + coordinateOffset[2] + chunker.chunkSize * chunk.position[0],
                                           parentEntityScale, rigidBodyBoxScale, targetEntity, chunker, nearby[m]);
                        chunkRigidBodyNum += 1;
                    }
                }
            }
            ++x[d];
        }
        if (chunkRigidBodyNum === 0) {
            chunk.empty = true;
            printDebugMessage("chunkRigidBodyNum: " + chunkRigidBodyNum, 1);
        }
        totalRigidBodyNum += chunkRigidBodyNum;
    }
};

// MagicaVoxelDefaultPaletteを24bitカラーに変換する(下位24bitをRGBAカラーとして予約)
for (var i = 0; i < 255; i++) {
    vx2.magicaVoxelDefaultPalette[i] = vx2.convert32bitRGBAto24bitRGBA(vx2.magicaVoxelDefaultPalette[i]);
}
