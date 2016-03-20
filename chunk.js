// 定数の設定
var chunkSize = 32;
var chunkPad = 2;

// チャンクを管理するためのクラス
// 現在のところ、voxelArrayの中に入る値は
// { v: ボクセルID値, f: ボクセルフラグ値 }
// ボクセルID: 0x0 - 0xffffff = 24bit RGBAカラー
//           0x1000000 - = ボクセルID0からのテクスチャボクセル
// ボクセルフラグ: 未定

function Chunk(lo, hi, fn) {
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
	setRigidBody: function(x, y, z, parentEntityScale, rigidBodyBoxScale, targetEntity) {
	    printDebugMessage("(x, y, z) = (" + x + ", " + y + ", " + z + " parentEntityScale = " + parentEntityScale + " rigidBodyBoxScale = " + rigidBodyBoxScale, 8);
	
	    var mass = 0; // Static volume which has infinite mass
	    
	    var cleanUpTarget = {};
	    var localVec = new Ammo.btVector3(parentEntityScale.x * rigidBodyBoxScale.x * vx2.meshScale * 0.5, parentEntityScale.y * rigidBodyBoxScale.y * vx2.meshScale * 0.5, parentEntityScale.z * rigidBodyBoxScale.z * vx2.meshScale * 0.5);
	    var shape = new Ammo.btBoxShape(localVec);
	
	    var entityPos = targetEntity.getPosition();
	    var entityRot = targetEntity.getParent().getLocalRotation();
	    
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
	    body.entity = targetEntity; // This is necessary to have collision event work.
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
	}
};
