// 定数の設定
var chunkSize = 32;
var chunkPad = 2;

// チャンクを管理するためのクラス
// 現在のところ、voxelArrayの中に入る値は
// { v: ボクセルID値, f: ボクセルフラグ値 }
// ボクセルID: 0x0 - 0xffffff = 24bit RGBAカラー
//           0x1000000 - = ボクセルID0からのテクスチャボクセル
// ボクセルフラグ: 未定

function Chunk(entity, chunker, lo, hi, fn) {
	lo[0]--;
	lo[1]--;
	lo[2]--;
	hi[0]++;
	hi[1]++;
	hi[2]++;
	var dims = [hi[2]-lo[2], hi[1]-lo[1], hi[0]-lo[0]]
	
	this.voxelArray = ndarray(new Array(dims[2] * dims[1] * dims[0]), dims);
	this.mesh = undefined;
	this.rigidBodyArray = [];
  
	// 初期値の設定
	for (var k = lo[2]; k < hi[2]; k++)
		for (var j = lo[1]; j < hi[1]; j++)
			for(var i = lo[0]; i < hi[0]; i++) {
				this.voxelArray.set(k-lo[2], j-lo[1], i-lo[0], fn(i, j, k));
			}
	// 親となるエンティティを記録
	this.parentEntity = entity;
	this.parentChunker = chunker;
};

Chunk.prototype = {
	get: function(x, y, z) {
		return this.voxelArray.get(x, y, z);
	},
	
	set: function(x, y, z, v) {
		this.voxelArray.set(x, y, z, v);
	},
	
	destroyRigidBody: function() {
		var app = pc.Application.getApplication();   
        for (var i = 0; i < this.rigidBodyArray.length; i++) {
            app.systems.rigidbody.removeBody(this.rigidBodyArray[i]);
            Ammo.destroy(this.rigidBodyArray[i].getCollisionShape());
            Ammo.destroy(this.rigidBodyArray[i]);
        }
        this.rigidBodyArray = [];
	},
	
	getRigidBodyArray: function() {
		return this.rigidBodyArray;
	},
	
	setRigidBody: function(x, y, z, parentEntityScale, rigidBodyBoxScale) {
	    printDebugMessage("(x, y, z) = (" + x + ", " + y + ", " + z + " parentEntityScale = " + parentEntityScale + " rigidBodyBoxScale = " + rigidBodyBoxScale, 8);
	
	    var mass = 0; // Static volume which has infinite mass
	    
	    var cleanUpTarget = {};
	    var localVec = new Ammo.btVector3(parentEntityScale.x * rigidBodyBoxScale.x * vx2.meshScale * 0.5, parentEntityScale.y * rigidBodyBoxScale.y * vx2.meshScale * 0.5, parentEntityScale.z * rigidBodyBoxScale.z * vx2.meshScale * 0.5);
	    var shape = new Ammo.btBoxShape(localVec);
	
	    var entityPos = this.parentEntity.getPosition();
	    var entityRot = this.parentEntity.getLocalRotation();
	    
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
	
	    body.chunk = this;
	    body.entity = this.parentEntity; // This is necessary to have collision event work.
	    body.localPos = localPos;
	    body.setRestitution(0.5);
	    body.setFriction(0.5);
	    body.setDamping(0.5, 0.5);
	
	    localVec.setValue(0, 0, 0);
	    body.setLinearFactor(localVec);
	    localVec.setValue(0, 0, 0);
	    body.setAngularFactor(localVec);
	
		// 生成した剛体を登録する
	    this.rigidBodyArray.push(body);
	    
	    Ammo.destroy(localVec);
	    Ammo.destroy(ammoQuat);
	    Ammo.destroy(startTransform);
	    Ammo.destroy(motionState);
	    Ammo.destroy(bodyInfo);
	
		var app = pc.Application.getApplication();   
		
	    app.systems.rigidbody.addBody(body, pc.BODYGROUP_STATIC, pc.BODYMASK_NOT_STATIC);
	    body.forceActivationState(pc.BODYFLAG_ACTIVE_TAG);
	    body.activate();
	},
	
	createPlayCanvasRigidBody: function() {
	    var pos = this.parentEntity.getPosition();
	    var entityScale = this.parentEntity.getLocalScale();
	    var totalRigidBodyNum = 0;
	    
        var chunkRigidBodyNum = 0;
        var volume = this.voxelArray.data;
        var mark = [];
        var dimsX = this.voxelArray.shape[2],
            dimsY = this.voxelArray.shape[1],
            dimsXY = dimsX * dimsY;
        
        // Sweep over Y axis
        var d = 1,
            u = (d + 1) % 3,
            v = (d + 2) % 3,
            x = [0, 0, 0],
            dimsD = this.voxelArray.shape[d],
            dimsU = this.voxelArray.shape[u],
            dimsV = this.voxelArray.shape[v],
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

                        printDebugMessage("a = " + a.toString(16) + " (x, y, z) = (" + xx[2] + ", " + xx[1] + ", " + xx[0] + ") scale = " + entityScale, 8);

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
                        var chunker = this.parentChunker;               
                        this.setRigidBody((x[2] + max[2]) * 0.5 + chunker.coordinateOffset[0] + chunker.chunkSize * this.position[2],
                                           (x[1] + max[1]) * 0.5 + chunker.coordinateOffset[1] + chunker.chunkSize * this.position[1],
                                           (x[0] + max[0]) * 0.5 + chunker.coordinateOffset[2] + chunker.chunkSize * this.position[0],
                                           entityScale, rigidBodyBoxScale);
                        chunkRigidBodyNum += 1;
                    }
                }
            }
            ++x[d];
        }
        if (chunkRigidBodyNum === 0) {
            this.empty = true;
            printDebugMessage("chunkRigidBodyNum: " + chunkRigidBodyNum, 1);
        }
	}
};
