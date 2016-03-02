// 定数の設定
var chunkSize = 32;
var chunkPad = 2;

// チャンクを管理するためのクラス
function Chunk(lo, hi, fn) {
	lo[0]--;
	lo[1]--;
	lo[2]--;
	hi[0]++;
	hi[1]++;
	hi[2]++;
	var dims = [hi[2]-lo[2], hi[1]-lo[1], hi[0]-lo[0]]
	
	this.voxelArray = ndarray(new Uint32Array(dims[2] * dims[1] * dims[0]), dims);
	this.voxelFlagArray = ndarray(new Uint32Array(dims[2] * dims[1] * dims[0]), dims);
	this.voxelAttrArray = [];
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
	}
};
