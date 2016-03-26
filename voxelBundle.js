(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*global voxel*/
/*global ndarray*/
voxel = require('voxel_nakata0705');
ndarray = require('ndarray');

},{"ndarray":2,"voxel_nakata0705":6}],2:[function(require,module,exports){
var iota = require("iota-array")
var isBuffer = require("is-buffer")

var hasTypedArrays  = ((typeof Float64Array) !== "undefined")

function compare1st(a, b) {
  return a[0] - b[0]
}

function order() {
  var stride = this.stride
  var terms = new Array(stride.length)
  var i
  for(i=0; i<terms.length; ++i) {
    terms[i] = [Math.abs(stride[i]), i]
  }
  terms.sort(compare1st)
  var result = new Array(terms.length)
  for(i=0; i<result.length; ++i) {
    result[i] = terms[i][1]
  }
  return result
}

function compileConstructor(dtype, dimension) {
  var className = ["View", dimension, "d", dtype].join("")
  if(dimension < 0) {
    className = "View_Nil" + dtype
  }
  var useGetters = (dtype === "generic")

  if(dimension === -1) {
    //Special case for trivial arrays
    var code =
      "function "+className+"(a){this.data=a;};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return -1};\
proto.size=0;\
proto.dimension=-1;\
proto.shape=proto.stride=proto.order=[];\
proto.lo=proto.hi=proto.transpose=proto.step=\
function(){return new "+className+"(this.data);};\
proto.get=proto.set=function(){};\
proto.pick=function(){return null};\
return function construct_"+className+"(a){return new "+className+"(a);}"
    var procedure = new Function(code)
    return procedure()
  } else if(dimension === 0) {
    //Special case for 0d arrays
    var code =
      "function "+className+"(a,d) {\
this.data = a;\
this.offset = d\
};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return this.offset};\
proto.dimension=0;\
proto.size=1;\
proto.shape=\
proto.stride=\
proto.order=[];\
proto.lo=\
proto.hi=\
proto.transpose=\
proto.step=function "+className+"_copy() {\
return new "+className+"(this.data,this.offset)\
};\
proto.pick=function "+className+"_pick(){\
return TrivialArray(this.data);\
};\
proto.valueOf=proto.get=function "+className+"_get(){\
return "+(useGetters ? "this.data.get(this.offset)" : "this.data[this.offset]")+
"};\
proto.set=function "+className+"_set(v){\
return "+(useGetters ? "this.data.set(this.offset,v)" : "this.data[this.offset]=v")+"\
};\
return function construct_"+className+"(a,b,c,d){return new "+className+"(a,d)}"
    var procedure = new Function("TrivialArray", code)
    return procedure(CACHED_CONSTRUCTORS[dtype][0])
  }

  var code = ["'use strict'"]

  //Create constructor for view
  var indices = iota(dimension)
  var args = indices.map(function(i) { return "i"+i })
  var index_str = "this.offset+" + indices.map(function(i) {
        return "this.stride[" + i + "]*i" + i
      }).join("+")
  var shapeArg = indices.map(function(i) {
      return "b"+i
    }).join(",")
  var strideArg = indices.map(function(i) {
      return "c"+i
    }).join(",")
  code.push(
    "function "+className+"(a," + shapeArg + "," + strideArg + ",d){this.data=a",
      "this.shape=[" + shapeArg + "]",
      "this.stride=[" + strideArg + "]",
      "this.offset=d|0}",
    "var proto="+className+".prototype",
    "proto.dtype='"+dtype+"'",
    "proto.dimension="+dimension)

  //view.size:
  code.push("Object.defineProperty(proto,'size',{get:function "+className+"_size(){\
return "+indices.map(function(i) { return "this.shape["+i+"]" }).join("*"),
"}})")

  //view.order:
  if(dimension === 1) {
    code.push("proto.order=[0]")
  } else {
    code.push("Object.defineProperty(proto,'order',{get:")
    if(dimension < 4) {
      code.push("function "+className+"_order(){")
      if(dimension === 2) {
        code.push("return (Math.abs(this.stride[0])>Math.abs(this.stride[1]))?[1,0]:[0,1]}})")
      } else if(dimension === 3) {
        code.push(
"var s0=Math.abs(this.stride[0]),s1=Math.abs(this.stride[1]),s2=Math.abs(this.stride[2]);\
if(s0>s1){\
if(s1>s2){\
return [2,1,0];\
}else if(s0>s2){\
return [1,2,0];\
}else{\
return [1,0,2];\
}\
}else if(s0>s2){\
return [2,0,1];\
}else if(s2>s1){\
return [0,1,2];\
}else{\
return [0,2,1];\
}}})")
      }
    } else {
      code.push("ORDER})")
    }
  }

  //view.set(i0, ..., v):
  code.push(
"proto.set=function "+className+"_set("+args.join(",")+",v){")
  if(useGetters) {
    code.push("return this.data.set("+index_str+",v)}")
  } else {
    code.push("return this.data["+index_str+"]=v}")
  }

  //view.get(i0, ...):
  code.push("proto.get=function "+className+"_get("+args.join(",")+"){")
  if(useGetters) {
    code.push("return this.data.get("+index_str+")}")
  } else {
    code.push("return this.data["+index_str+"]}")
  }

  //view.index:
  code.push(
    "proto.index=function "+className+"_index(", args.join(), "){return "+index_str+"}")

  //view.hi():
  code.push("proto.hi=function "+className+"_hi("+args.join(",")+"){return new "+className+"(this.data,"+
    indices.map(function(i) {
      return ["(typeof i",i,"!=='number'||i",i,"<0)?this.shape[", i, "]:i", i,"|0"].join("")
    }).join(",")+","+
    indices.map(function(i) {
      return "this.stride["+i + "]"
    }).join(",")+",this.offset)}")

  //view.lo():
  var a_vars = indices.map(function(i) { return "a"+i+"=this.shape["+i+"]" })
  var c_vars = indices.map(function(i) { return "c"+i+"=this.stride["+i+"]" })
  code.push("proto.lo=function "+className+"_lo("+args.join(",")+"){var b=this.offset,d=0,"+a_vars.join(",")+","+c_vars.join(","))
  for(var i=0; i<dimension; ++i) {
    code.push(
"if(typeof i"+i+"==='number'&&i"+i+">=0){\
d=i"+i+"|0;\
b+=c"+i+"*d;\
a"+i+"-=d}")
  }
  code.push("return new "+className+"(this.data,"+
    indices.map(function(i) {
      return "a"+i
    }).join(",")+","+
    indices.map(function(i) {
      return "c"+i
    }).join(",")+",b)}")

  //view.step():
  code.push("proto.step=function "+className+"_step("+args.join(",")+"){var "+
    indices.map(function(i) {
      return "a"+i+"=this.shape["+i+"]"
    }).join(",")+","+
    indices.map(function(i) {
      return "b"+i+"=this.stride["+i+"]"
    }).join(",")+",c=this.offset,d=0,ceil=Math.ceil")
  for(var i=0; i<dimension; ++i) {
    code.push(
"if(typeof i"+i+"==='number'){\
d=i"+i+"|0;\
if(d<0){\
c+=b"+i+"*(a"+i+"-1);\
a"+i+"=ceil(-a"+i+"/d)\
}else{\
a"+i+"=ceil(a"+i+"/d)\
}\
b"+i+"*=d\
}")
  }
  code.push("return new "+className+"(this.data,"+
    indices.map(function(i) {
      return "a" + i
    }).join(",")+","+
    indices.map(function(i) {
      return "b" + i
    }).join(",")+",c)}")

  //view.transpose():
  var tShape = new Array(dimension)
  var tStride = new Array(dimension)
  for(var i=0; i<dimension; ++i) {
    tShape[i] = "a[i"+i+"]"
    tStride[i] = "b[i"+i+"]"
  }
  code.push("proto.transpose=function "+className+"_transpose("+args+"){"+
    args.map(function(n,idx) { return n + "=(" + n + "===undefined?" + idx + ":" + n + "|0)"}).join(";"),
    "var a=this.shape,b=this.stride;return new "+className+"(this.data,"+tShape.join(",")+","+tStride.join(",")+",this.offset)}")

  //view.pick():
  code.push("proto.pick=function "+className+"_pick("+args+"){var a=[],b=[],c=this.offset")
  for(var i=0; i<dimension; ++i) {
    code.push("if(typeof i"+i+"==='number'&&i"+i+">=0){c=(c+this.stride["+i+"]*i"+i+")|0}else{a.push(this.shape["+i+"]);b.push(this.stride["+i+"])}")
  }
  code.push("var ctor=CTOR_LIST[a.length+1];return ctor(this.data,a,b,c)}")

  //Add return statement
  code.push("return function construct_"+className+"(data,shape,stride,offset){return new "+className+"(data,"+
    indices.map(function(i) {
      return "shape["+i+"]"
    }).join(",")+","+
    indices.map(function(i) {
      return "stride["+i+"]"
    }).join(",")+",offset)}")

  //Compile procedure
  var procedure = new Function("CTOR_LIST", "ORDER", code.join("\n"))
  return procedure(CACHED_CONSTRUCTORS[dtype], order)
}

function arrayDType(data) {
  if(isBuffer(data)) {
    return "buffer"
  }
  if(hasTypedArrays) {
    switch(Object.prototype.toString.call(data)) {
      case "[object Float64Array]":
        return "float64"
      case "[object Float32Array]":
        return "float32"
      case "[object Int8Array]":
        return "int8"
      case "[object Int16Array]":
        return "int16"
      case "[object Int32Array]":
        return "int32"
      case "[object Uint8Array]":
        return "uint8"
      case "[object Uint16Array]":
        return "uint16"
      case "[object Uint32Array]":
        return "uint32"
      case "[object Uint8ClampedArray]":
        return "uint8_clamped"
    }
  }
  if(Array.isArray(data)) {
    return "array"
  }
  return "generic"
}

var CACHED_CONSTRUCTORS = {
  "float32":[],
  "float64":[],
  "int8":[],
  "int16":[],
  "int32":[],
  "uint8":[],
  "uint16":[],
  "uint32":[],
  "array":[],
  "uint8_clamped":[],
  "buffer":[],
  "generic":[]
}

;(function() {
  for(var id in CACHED_CONSTRUCTORS) {
    CACHED_CONSTRUCTORS[id].push(compileConstructor(id, -1))
  }
});

function wrappedNDArrayCtor(data, shape, stride, offset) {
  if(data === undefined) {
    var ctor = CACHED_CONSTRUCTORS.array[0]
    return ctor([])
  } else if(typeof data === "number") {
    data = [data]
  }
  if(shape === undefined) {
    shape = [ data.length ]
  }
  var d = shape.length
  if(stride === undefined) {
    stride = new Array(d)
    for(var i=d-1, sz=1; i>=0; --i) {
      stride[i] = sz
      sz *= shape[i]
    }
  }
  if(offset === undefined) {
    offset = 0
    for(var i=0; i<d; ++i) {
      if(stride[i] < 0) {
        offset -= (shape[i]-1)*stride[i]
      }
    }
  }
  var dtype = arrayDType(data)
  var ctor_list = CACHED_CONSTRUCTORS[dtype]
  while(ctor_list.length <= d+1) {
    ctor_list.push(compileConstructor(dtype, ctor_list.length-1))
  }
  var ctor = ctor_list[d+1]
  return ctor(data, shape, stride, offset)
}

module.exports = wrappedNDArrayCtor

},{"iota-array":3,"is-buffer":4}],3:[function(require,module,exports){
"use strict"

function iota(n) {
  var result = new Array(n)
  for(var i=0; i<n; ++i) {
    result[i] = i
  }
  return result
}

module.exports = iota
},{}],4:[function(require,module,exports){
/**
 * Determine if an object is Buffer
 *
 * Author:   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * License:  MIT
 *
 * `npm install is-buffer`
 */

module.exports = function (obj) {
  return !!(obj != null &&
    (obj._isBuffer || // For Safari 5-7 (missing Object.prototype.constructor)
      (obj.constructor &&
      typeof obj.constructor.isBuffer === 'function' &&
      obj.constructor.isBuffer(obj))
    ))
}

},{}],5:[function(require,module,exports){
var events = require('events')
var inherits = require('inherits')

module.exports = function(opts) {
  return new Chunker(opts)
}

module.exports.Chunker = Chunker

function Chunker(opts) {
  this.distance = opts.chunkDistance || 0
  this.chunkSize = opts.chunkSize || 32
  this.chunkPad = opts.chunkPad !== undefined ? opts.chunkPad : 0
  this.cubeSize = opts.cubeSize || 25
  this.generateVoxelChunk = opts.generateVoxelChunk
  this.parentEntity = opts.parentEntity
  this.chunks = {}
  this.meshes = {}
  this.bodiesArray = {}

  if (this.chunkSize & this.chunkSize-1 !== 0)
    throw new Error('chunkSize must be a power of 2')
  var bits = 0;
  for (var size = this.chunkSize; size > 0; size >>= 1) bits++;
  this.chunkBits = bits - 1;
  this.chunkMask = (1 << this.chunkBits) - 1
  this.chunkPadHalf = this.chunkPad >> 1
}

inherits(Chunker, events.EventEmitter)

Chunker.prototype.nearbyChunks = function(position, distance) {
  var cpos = this.chunkAtPosition(position)
  return this.nearbyChunksCoordinate(cpos, distance);
}

Chunker.prototype.nearbyChunksCoordinate = function(cpos, distance) {
  var x = cpos[0]
  var y = cpos[1]
  var z = cpos[2]
  var dist = distance || this.distance
  var nearby = []
  if (dist === 0) {
      nearby.push([x, y, z]);
  }
  else {
    for (var cx = (x - dist); cx !== (x + dist); ++cx) {
      for (var cy = (y - dist); cy !== (y + dist); ++cy) {
        for (var cz = (z - dist); cz !== (z + dist); ++cz) {
          nearby.push([cx, cy, cz])
        }
      }
    }
  }
  return nearby
}

Chunker.prototype.requestMissingChunks = function(position) {
  var self = this
  this.nearbyChunks(position).map(function(chunk) {
    if (!self.chunks[chunk.join('|')]) {
      self.emit('missingChunk', chunk)
    }
  })
}

Chunker.prototype.getBounds = function(x, y, z) {
  var bits = this.chunkBits
  var low = [x << bits, y << bits, z << bits]
  var high = [(x+1) << bits, (y+1) << bits, (z+1) << bits]
  return [low, high]
}

Chunker.prototype.generateChunk = function(x, y, z) {
  var cpos = [x, y, z];
  var ckey = cpos.join('|')
  var chunk = this.chunks[ckey]
  if (chunk !== undefined) return chunk
  
  var self = this
  var bounds = this.getBounds(x, y, z)
  var chunk = this.generateVoxelChunk(bounds[0], bounds[1], x, y, z)
  chunk.position = cpos
  chunk.empty = true
  this.chunks[ckey] = chunk
  return chunk
}

Chunker.prototype.getChunk = function(x, y, z) {
  var cpos = [x, y, z];
  var ckey = cpos.join('|')
  var chunk = this.chunks[ckey]
  if (chunk) return chunk
  else return undefined  
}

Chunker.prototype.deleteChunk = function(x, y, z) {
  var cpos = [x, y, z];
  var ckey = cpos.join('|')
  var chunk = this.chunks[ckey]
  if (chunk) delete this.chunks[ckey]; 
}

Chunker.prototype.getMeshes = function (x, y, z) {
  var cpos = [x, y, z];
  var ckey = cpos.join('|')
  var meshes = this.meshes[ckey]
  if (meshes) return meshes
  else return undefined  
}

Chunker.prototype.setMeshes = function (x, y, z, mesh) {
  var cpos = [x, y, z];
  var ckey = cpos.join('|')
  if (mesh === undefined) this.meshes[ckey] = undefined
  if (!this.meshes[ckey]) this.meshes[ckey] = [mesh]
  else this.meshes[ckey].push(mesh)
}

Chunker.prototype.getBodies = function (x, y, z) {
  var cpos = [x, y, z];
  var ckey = cpos.join('|')
  var bodies = this.bodiesArray[ckey]
  if (bodies) return bodies
  else return undefined  
}

Chunker.prototype.setBodies = function (x, y, z, bodies) {
  var cpos = [x, y, z];
  var ckey = cpos.join('|')
  this.bodiesArray[ckey] = bodies
  return bodies;
}

Chunker.prototype.chunkAtCoordinates = function(x, y, z) {
  var bits = this.chunkBits;
  var cx = x >> bits;
  var cy = y >> bits;
  var cz = z >> bits;
  var chunkPos = [cx, cy, cz];
  return chunkPos;
}

Chunker.prototype.chunkAtPosition = function(position) {
  var cubeSize = this.cubeSize;
  var x = Math.floor(position[0] / cubeSize)
  var y = Math.floor(position[1] / cubeSize)
  var z = Math.floor(position[2] / cubeSize)
  var chunkPos = this.chunkAtCoordinates(x, y, z)
  return chunkPos
};

Chunker.prototype.voxelIndexFromCoordinates = function(x, y, z) {
  throw new Error('Chunker.prototype.voxelIndexFromCoordinates removed, use voxelAtCoordinates')
}

Chunker.prototype.voxelAtCoordinates = function(x, y, z, val, auto) {
  var cpos = this.chunkAtCoordinates(x, y, z)
  var ckey = cpos.join('|')
  var chunk = this.chunks[ckey]
  if (chunk === undefined) {
      // もしチャンクが存在せず、新規に代入されたボクセル値が0あるいはundefinedなら、自動的にチャンクを作成する設定でも新しいチャンクは作成しない
      if (val === 0) return [0, null]
      if (auto && typeof val !== 'undefined') chunk = this.generateChunk(cpos[0], cpos[1], cpos[2])
      else return [0, null]
  } 
  
  // チャンクの周囲に設定したパディングを考慮してボクセル値を代入する
  var mask = this.chunkMask
  var h = this.chunkPadHalf
  var mx = x & mask
  var my = y & mask
  var mz = z & mask
  var v = chunk.get(mx+h, my+h, mz+h)
  if (typeof val !== 'undefined') {
    chunk.set(mx+h, my+h, mz+h, val)
    
    // [ToDo] このコードはチャンクをクラス化したら、内部処理として取り込む
    if (val !== 0x00) chunk.empty = false
  }
  return [v, chunk]
}

Chunker.prototype.voxelAtPosition = function(pos, val, auto) {
  var cubeSize = this.cubeSize;
  var x = Math.floor(pos[0] / cubeSize)
  var y = Math.floor(pos[1] / cubeSize)
  var z = Math.floor(pos[2] / cubeSize)
  var v = this.voxelAtCoordinates(x, y, z, val, auto)
  return v;
}


},{"events":13,"inherits":12}],6:[function(require,module,exports){
var chunker = require('./chunker')
var ndarray = require('ndarray')

module.exports = function(opts) {
  if (!opts.generateVoxelChunk) opts.generateVoxelChunk = function(low, high) {
	return generate32(low, high, function(i, j, k) { return 0; })
  }
  return chunker(opts)
}

module.exports.meshers = {
  culled: require('./meshers/culled').mesher,
  greedy: require('./meshers/greedy').mesher,
  transgreedy: require('./meshers/transgreedy').mesher,
  monotone: require('./meshers/monotone').mesher,
  stupid: require('./meshers/stupid').mesher
}

module.exports.Chunker = chunker.Chunker
module.exports.geometry = {}
module.exports.generator = {}
module.exports.generate32 = generate32

function generate32(lo, hi, fn) {
  // To fix the display gaps, we need to pad the bounds
  lo[0]--
  lo[1]--
  lo[2]--
  hi[0]++
  hi[1]++
  hi[2]++
  var dims = [hi[2]-lo[2], hi[1]-lo[1], hi[0]-lo[0]]
  var data = ndarray(new Uint32Array(dims[2] * dims[1] * dims[0]), dims)
  for (var k = lo[2]; k < hi[2]; k++)
    for (var j = lo[1]; j < hi[1]; j++)
      for(var i = lo[0]; i < hi[0]; i++) {
        data.set(k-lo[2], j-lo[1], i-lo[0], fn(i, j, k))
      }
  return data
}

// shape and terrain generator functions
module.exports.generator['Sphere'] = function(i,j,k) {
  return i*i+j*j+k*k <= 16*16 ? 1 : 0
}

module.exports.generator['Noise'] = function(i,j,k) {
  return Math.random() < 0.1 ? Math.random() * 0xffffff : 0;
}

module.exports.generator['Dense Noise'] = function(i,j,k) {
  return Math.round(Math.random() * 0xffffff);
}

module.exports.generator['Checker'] = function(i,j,k) {
  return !!((i+j+k)&1) ? (((i^j^k)&2) ? 1 : 0xffffff) : 0;
}

module.exports.generator['Hill'] = function(i,j,k) {
  return j <= 16 * Math.exp(-(i*i + k*k) / 64) ? 1 : 0;
}

module.exports.generator['Valley'] = function(i,j,k) {
  return j <= (i*i + k*k) * 31 / (32*32*2) + 1 ? 1 + (1<<15) : 0;
}

module.exports.generator['Hilly Terrain'] = function(i,j,k) {
  var h0 = 3.0 * Math.sin(Math.PI * i / 12.0 - Math.PI * k * 0.1) + 27;    
  if(j > h0+1) {
    return 0;
  }
  if(h0 <= j) {
    return 1;
  }
  var h1 = 2.0 * Math.sin(Math.PI * i * 0.25 - Math.PI * k * 0.3) + 20;
  if(h1 <= j) {
    return 2;
  }
  if(2 < j) {
    return Math.random() < 0.1 ? 0x222222 : 0xaaaaaa;
  }
  return 3;
}

module.exports.scale = function ( x, fromLow, fromHigh, toLow, toHigh ) {
  return ( x - fromLow ) * ( toHigh - toLow ) / ( fromHigh - fromLow ) + toLow
}

// convenience function that uses the above functions to prebake some simple voxel geometries
module.exports.generateExamples = function() {
  return {
    'Sphere': generate32([-16,-16,-16], [16,16,16], module.exports.generator['Sphere']),
    'Noise': generate32([0,0,0], [16,16,16], module.exports.generator['Noise']),
    'Dense Noise': generate32([0,0,0], [16,16,16], module.exports.generator['Dense Noise']),
    'Checker': generate32([0,0,0], [8,8,8], module.exports.generator['Checker']),
    'Hill': generate32([-16, 0, -16], [16,16,16], module.exports.generator['Hill']),
    'Valley': generate32([0,0,0], [32,32,32], module.exports.generator['Valley']),
    'Hilly Terrain': generate32([0, 0, 0], [32,32,32], module.exports.generator['Hilly Terrain'])
  }
}


},{"./chunker":5,"./meshers/culled":7,"./meshers/greedy":8,"./meshers/monotone":9,"./meshers/stupid":10,"./meshers/transgreedy":11,"ndarray":2}],7:[function(require,module,exports){
//Naive meshing (with face culling)
function CulledMesh(volume, dims) {
  //Precalculate direction vectors for convenience
  var dir = new Array(3);
  for(var i=0; i<3; ++i) {
    dir[i] = [[0,0,0], [0,0,0]];
    dir[i][0][(i+1)%3] = 1;
    dir[i][1][(i+2)%3] = 1;
  }
  //March over the volume
  var vertices = []
    , faces = []
    , x = [0,0,0]
    , B = [[false,true]    //Incrementally update bounds (this is a bit ugly)
          ,[false,true]
          ,[false,true]]
    , n = -dims[0]*dims[1];
  for(           B[2]=[false,true],x[2]=-1; x[2]<dims[2]; B[2]=[true,(++x[2]<dims[2]-1)])
  for(n-=dims[0],B[1]=[false,true],x[1]=-1; x[1]<dims[1]; B[1]=[true,(++x[1]<dims[1]-1)])
  for(n-=1,      B[0]=[false,true],x[0]=-1; x[0]<dims[0]; B[0]=[true,(++x[0]<dims[0]-1)], ++n) {
    //Read current voxel and 3 neighboring voxels using bounds check results
    var p =   (B[0][0] && B[1][0] && B[2][0]) ? volume[n]                 : 0
      , b = [ (B[0][1] && B[1][0] && B[2][0]) ? volume[n+1]               : 0
            , (B[0][0] && B[1][1] && B[2][0]) ? volume[n+dims[0]]         : 0
            , (B[0][0] && B[1][0] && B[2][1]) ? volume[n+dims[0]*dims[1]] : 0
          ];
    //Generate faces
    for(var d=0; d<3; ++d)
    if((!!p) !== (!!b[d])) {
      var s = !p ? 1 : 0;
      var t = [x[0],x[1],x[2]]
        , u = dir[d][s]
        , v = dir[d][s^1];
      ++t[d];
      
      var vertex_count = vertices.length;
      vertices.push([t[0],           t[1],           t[2]          ]);
      vertices.push([t[0]+u[0],      t[1]+u[1],      t[2]+u[2]     ]);
      vertices.push([t[0]+u[0]+v[0], t[1]+u[1]+v[1], t[2]+u[2]+v[2]]);
      vertices.push([t[0]     +v[0], t[1]     +v[1], t[2]     +v[2]]);
      faces.push([vertex_count, vertex_count+1, vertex_count+2, vertex_count+3, s ? b[d] : p]);
    }
  }
  return { vertices:vertices, faces:faces };
}


if(exports) {
  exports.mesher = CulledMesh;
}

},{}],8:[function(require,module,exports){
var GreedyMesh = (function() {
//Cache buffer internally
var mask = new Uint32Array(4096);
var maskDirection = new Uint32Array(4096);

return function(volume, dims) {
  var vertices = [], faces = []
    , dimsX = dims[0]
    , dimsY = dims[1]
    , dimsXY = dimsX * dimsY;

  //Sweep over 3-axes
  for(var d=0; d<3; ++d) {
    var i, j, k, l, w, W, h, n, c
      , u = (d+1)%3
      , v = (d+2)%3
      , x = [0,0,0]
      , q = [0,0,0]
      , du = [0,0,0]
      , dv = [0,0,0]
      , dimsD = dims[d]
      , dimsU = dims[u]
      , dimsV = dims[v]
      , qdimsX, qdimsXY
      , xd

    if (mask.length < dimsU * dimsV) {
      mask = new Uint32Array(dimsU * dimsV);
      maskDirection = new Uint32Array(dimsU * dimsV);
    }

    q[d] =  1;
    x[d] = -1;

    qdimsX  = dimsX  * q[1]
    qdimsXY = dimsXY * q[2]

    // Compute mask
    while (x[d] < dimsD) {
      xd = x[d]
      n = 0;

      for(x[v] = 0; x[v] < dimsV; ++x[v]) {
        for(x[u] = 0; x[u] < dimsU; ++x[u], ++n) {
          var a = xd >= 0      && volume[x[0]      + dimsX * x[1]          + dimsXY * x[2]          ]
            , b = xd < dimsD-1 && volume[x[0]+q[0] + dimsX * x[1] + qdimsX + dimsXY * x[2] + qdimsXY]
          if (a ? b : !b) {
            mask[n] = 0; continue;
          }
          mask[n] = a ? a : b;
          maskDirection[n] = a ? 1 : -1;
        }
      }

      ++x[d];

      // Generate mesh for mask using lexicographic ordering
      n = 0;
      for (j=0; j < dimsV; ++j) {
        for (i=0; i < dimsU; ) {
          c = mask[n] * maskDirection[n];
          if (!c) {
            i++;  n++; continue;
          }

          //Compute width
          w = 1;
          while (c === mask[n+w] * maskDirection[n+w] && i+w < dimsU) w++;

          //Compute height (this is slightly awkward)
          for (h=1; j+h < dimsV; ++h) {
            k = 0;
            while (k < w && c === mask[n+k+h*dimsU] * maskDirection[n+k+h*dimsU]) k++
            if (k < w) break;
          }

          // Add quad
          // The du/dv arrays are reused/reset
          // for each iteration.
          du[d] = 0; dv[d] = 0;
          x[u]  = i;  x[v] = j;

          if (c > 0) {
            dv[v] = h; dv[u] = 0;
            du[u] = w; du[v] = 0;
          } else {
            c = -c;
            du[v] = h; du[u] = 0;
            dv[u] = w; dv[v] = 0;
          }
          var vertex_count = vertices.length;
          vertices.push([x[0],             x[1],             x[2]            ]);
          vertices.push([x[0]+du[0],       x[1]+du[1],       x[2]+du[2]      ]);
          vertices.push([x[0]+du[0]+dv[0], x[1]+du[1]+dv[1], x[2]+du[2]+dv[2]]);
          vertices.push([x[0]      +dv[0], x[1]      +dv[1], x[2]      +dv[2]]);
          faces.push([vertex_count, vertex_count+1, vertex_count+2, vertex_count+3, c]);

          //Zero-out mask
          W = n + w;
          for(l=0; l<h; ++l) {
            for(k=n; k<W; ++k) {
              mask[k+l*dimsU] = 0;
              maskDirection[k+l*dimsU] = 1;
            }
          }

          //Increment counters and continue
          i += w; n += w;
        }
      }
    }
  }
  return { vertices:vertices, faces:faces };
}
})();

if(exports) {
  exports.mesher = GreedyMesh;
}

},{}],9:[function(require,module,exports){
"use strict";

var MonotoneMesh = (function(){

function MonotonePolygon(c, v, ul, ur) {
  this.color  = c;
  this.left   = [[ul, v]];
  this.right  = [[ur, v]];
};

MonotonePolygon.prototype.close_off = function(v) {
  this.left.push([ this.left[this.left.length-1][0], v ]);
  this.right.push([ this.right[this.right.length-1][0], v ]);
};

MonotonePolygon.prototype.merge_run = function(v, u_l, u_r) {
  var l = this.left[this.left.length-1][0]
    , r = this.right[this.right.length-1][0]; 
  if(l !== u_l) {
    this.left.push([ l, v ]);
    this.left.push([ u_l, v ]);
  }
  if(r !== u_r) {
    this.right.push([ r, v ]);
    this.right.push([ u_r, v ]);
  }
};


return function(volume, dims) {
  function f(i,j,k) {
    return volume[i + dims[0] * (j + dims[1] * k)];
  }
  //Sweep over 3-axes
  var vertices = [], faces = [];
  for(var d=0; d<3; ++d) {
    var i, j, k
      , u = (d+1)%3   //u and v are orthogonal directions to d
      , v = (d+2)%3
      , x = new Int32Array(3)
      , q = new Int32Array(3)
      , runs = new Int32Array(2 * (dims[u]+1))
      , frontier = new Int32Array(dims[u])  //Frontier is list of pointers to polygons
      , next_frontier = new Int32Array(dims[u])
      , left_index = new Int32Array(2 * dims[v])
      , right_index = new Int32Array(2 * dims[v])
      , stack = new Int32Array(24 * dims[v])
      , delta = [[0,0], [0,0]];
    //q points along d-direction
    q[d] = 1;
    //Initialize sentinel
    for(x[d]=-1; x[d]<dims[d]; ) {
      // --- Perform monotone polygon subdivision ---
      var n = 0
        , polygons = []
        , nf = 0;
      for(x[v]=0; x[v]<dims[v]; ++x[v]) {
        //Make one pass over the u-scan line of the volume to run-length encode polygon
        var nr = 0, p = 0, c = 0;
        for(x[u]=0; x[u]<dims[u]; ++x[u], p = c) {
          //Compute the type for this face
          var a = (0    <= x[d]      ? f(x[0],      x[1],      x[2])      : 0)
            , b = (x[d] <  dims[d]-1 ? f(x[0]+q[0], x[1]+q[1], x[2]+q[2]) : 0);
          c = a;
          if((!a) === (!b)) {
            c = 0;
          } else if(!a) {
            c = -b;
          }
          //If cell type doesn't match, start a new run
          if(p !== c) {
            runs[nr++] = x[u];
            runs[nr++] = c;
          }
        }
        //Add sentinel run
        runs[nr++] = dims[u];
        runs[nr++] = 0;
        //Update frontier by merging runs
        var fp = 0;
        for(var i=0, j=0; i<nf && j<nr-2; ) {
          var p    = polygons[frontier[i]]
            , p_l  = p.left[p.left.length-1][0]
            , p_r  = p.right[p.right.length-1][0]
            , p_c  = p.color
            , r_l  = runs[j]    //Start of run
            , r_r  = runs[j+2]  //End of run
            , r_c  = runs[j+1]; //Color of run
          //Check if we can merge run with polygon
          if(r_r > p_l && p_r > r_l && r_c === p_c) {
            //Merge run
            p.merge_run(x[v], r_l, r_r);
            //Insert polygon into frontier
            next_frontier[fp++] = frontier[i];
            ++i;
            j += 2;
          } else {
            //Check if we need to advance the run pointer
            if(r_r <= p_r) {
              if(!!r_c) {
                var n_poly = new MonotonePolygon(r_c, x[v], r_l, r_r);
                next_frontier[fp++] = polygons.length;
                polygons.push(n_poly);
              }
              j += 2;
            }
            //Check if we need to advance the frontier pointer
            if(p_r <= r_r) {
              p.close_off(x[v]);
              ++i;
            }
          }
        }
        //Close off any residual polygons
        for(; i<nf; ++i) {
          polygons[frontier[i]].close_off(x[v]);
        }
        //Add any extra runs to frontier
        for(; j<nr-2; j+=2) {
          var r_l  = runs[j]
            , r_r  = runs[j+2]
            , r_c  = runs[j+1];
          if(!!r_c) {
            var n_poly = new MonotonePolygon(r_c, x[v], r_l, r_r);
            next_frontier[fp++] = polygons.length;
            polygons.push(n_poly);
          }
        }
        //Swap frontiers
        var tmp = next_frontier;
        next_frontier = frontier;
        frontier = tmp;
        nf = fp;
      }
      //Close off frontier
      for(var i=0; i<nf; ++i) {
        var p = polygons[frontier[i]];
        p.close_off(dims[v]);
      }
      // --- Monotone subdivision of polygon is complete at this point ---
      
      x[d]++;
      
      //Now we just need to triangulate each monotone polygon
      for(var i=0; i<polygons.length; ++i) {
        var p = polygons[i]
          , c = p.color
          , flipped = false;
        if(c < 0) {
          flipped = true;
          c = -c;
        }
        for(var j=0; j<p.left.length; ++j) {
          left_index[j] = vertices.length;
          var y = [0.0,0.0,0.0]
            , z = p.left[j];
          y[d] = x[d];
          y[u] = z[0];
          y[v] = z[1];
          vertices.push(y);
        }
        for(var j=0; j<p.right.length; ++j) {
          right_index[j] = vertices.length;
          var y = [0.0,0.0,0.0]
            , z = p.right[j];
          y[d] = x[d];
          y[u] = z[0];
          y[v] = z[1];
          vertices.push(y);
        }
        //Triangulate the monotone polygon
        var bottom = 0
          , top = 0
          , l_i = 1
          , r_i = 1
          , side = true;  //true = right, false = left
        
        stack[top++] = left_index[0];
        stack[top++] = p.left[0][0];
        stack[top++] = p.left[0][1];
        
        stack[top++] = right_index[0];
        stack[top++] = p.right[0][0];
        stack[top++] = p.right[0][1];
        
        while(l_i < p.left.length || r_i < p.right.length) {
          //Compute next side
          var n_side = false;
          if(l_i === p.left.length) {
            n_side = true;
          } else if(r_i !== p.right.length) {
            var l = p.left[l_i]
              , r = p.right[r_i];
            n_side = l[1] > r[1];
          }
          var idx = n_side ? right_index[r_i] : left_index[l_i]
            , vert = n_side ? p.right[r_i] : p.left[l_i];
          if(n_side !== side) {
            //Opposite side
            while(bottom+3 < top) {
              if(flipped === n_side) {
                faces.push([ stack[bottom], stack[bottom+3], idx, c]);
              } else {
                faces.push([ stack[bottom+3], stack[bottom], idx, c]);              
              }
              bottom += 3;
            }
          } else {
            //Same side
            while(bottom+3 < top) {
              //Compute convexity
              for(var j=0; j<2; ++j)
              for(var k=0; k<2; ++k) {
                delta[j][k] = stack[top-3*(j+1)+k+1] - vert[k];
              }
              var det = delta[0][0] * delta[1][1] - delta[1][0] * delta[0][1];
              if(n_side === (det > 0)) {
                break;
              }
              if(det !== 0) {
                if(flipped === n_side) {
                  faces.push([ stack[top-3], stack[top-6], idx, c ]);
                } else {
                  faces.push([ stack[top-6], stack[top-3], idx, c ]);
                }
              }
              top -= 3;
            }
          }
          //Push vertex
          stack[top++] = idx;
          stack[top++] = vert[0];
          stack[top++] = vert[1];
          //Update loop index
          if(n_side) {
            ++r_i;
          } else {
            ++l_i;
          }
          side = n_side;
        }
      }
    }
  }
  return { vertices:vertices, faces:faces };
}
})();

if(exports) {
  exports.mesher = MonotoneMesh;
}

},{}],10:[function(require,module,exports){
//The stupidest possible way to generate a Minecraft mesh (I think)
function StupidMesh(volume, dims) {
  var vertices = [], faces = [], x = [0,0,0], n = 0;
  for(x[2]=0; x[2]<dims[2]; ++x[2])
  for(x[1]=0; x[1]<dims[1]; ++x[1])
  for(x[0]=0; x[0]<dims[0]; ++x[0], ++n)
  if(!!volume[n]) {
    for(var d=0; d<3; ++d) {
      var t = [x[0], x[1], x[2]]
        , u = [0,0,0]
        , v = [0,0,0];
      u[(d+1)%3] = 1;
      v[(d+2)%3] = 1;
      for(var s=0; s<2; ++s) {
        t[d] = x[d] + s;
        var tmp = u;
        u = v;
        v = tmp;
        var vertex_count = vertices.length;
        vertices.push([t[0],           t[1],           t[2]          ]);
        vertices.push([t[0]+u[0],      t[1]+u[1],      t[2]+u[2]     ]);
        vertices.push([t[0]+u[0]+v[0], t[1]+u[1]+v[1], t[2]+u[2]+v[2]]);
        vertices.push([t[0]     +v[0], t[1]     +v[1], t[2]     +v[2]]);
        faces.push([vertex_count, vertex_count+1, vertex_count+2, vertex_count+3, volume[n]]);
      }
    }
  }
  return { vertices:vertices, faces:faces };
}


if(exports) {
  exports.mesher = StupidMesh;
}

},{}],11:[function(require,module,exports){
var GreedyMesh = (function greedyLoader() {
    
// スキャン方向に正面の面の情報を入れる
var mask = new Uint32Array(4096);
// スキャン方向に背面の面の情報を入れる
var invMask = new Uint32Array(4096);

// 32bitのボクセルIDで表現されるスペースのうち、最上位ビットは透明フラグとする
var kTransparentMask    = 0x80000000;
// 32bitのボクセルIDで表現されるスペースのうち、残りの3ビットはボクセルの正面方向を指定するフラグとする
var kFaceDirectionMask	= 0x70000000;
var kNoFlagsMask        = 0x0FFFFFFF;

function isTransparent(v) {
  return false; //(v & kTransparentMask) === kTransparentMask;
}

function removeFlags(v) {
  return (v & kNoFlagsMask);
}

return function ohSoGreedyMesher(volume, dims, mesherExtraData) {
  var vertices = [], faces = []
    , dimsX = dims[0]
    , dimsY = dims[1]
    , dimsXY = dimsX * dimsY;

  var tVertices = [], tFaces = []

  var transparentTypes = mesherExtraData ? (mesherExtraData.transparentTypes || {}) : {};
  var getType = function(voxels, offset) {
    var type = voxels[offset].v;
    return type | (type in transparentTypes ? kTransparentMask : 0);
  }


  //Sweep over 3-axes
  for(var d=0; d<3; ++d) {
    var i, j, k, l, w, W, h, n, c
      , u = (d+1)%3 //d === 0 ? 2 : d === 1 ? 2 : 0
      , v = (d+2)%3 //d === 0 ? 1 : d === 1 ? 0 : 1
      , x = [0,0,0]
      , q = [0,0,0]
      , du = [0,0,0]
      , dv = [0,0,0]
      , dimsD = dims[d]
      , dimsU = dims[u]
      , dimsV = dims[v]
      , qdimsX, qdimsXY
      , xd

    if (mask.length < dimsU * dimsV) {
      mask = new Uint32Array(dimsU * dimsV);
      invMask = new Uint32Array(dimsU * dimsV);
    }

    q[d] =  1;
    x[d] = -1;

    qdimsX  = dimsX  * q[1]
    qdimsXY = dimsXY * q[2]

    // Compute mask
    while (x[d] < dimsD) {
      xd = x[d]
      n = 0;

      for(x[v] = 0; x[v] < dimsV; ++x[v]) {
        for(x[u] = 0; x[u] < dimsU; ++x[u], ++n) {
          // Modified to read through getType()
          var a = xd >= 0      && getType(volume, x[0]      + dimsX * x[1]          + dimsXY * x[2]          )
            , b = xd < dimsD-1 && getType(volume, x[0]+q[0] + dimsX * x[1] + qdimsX + dimsXY * x[2] + qdimsXY)

          if (isTransparent(a) && isTransparent(b)) {
            if (a !== b) {
              // 両面が透明だが、それぞれの素材が違うため、両面とも描画する
              mask[n] = a;
              invMask[n] = b;
            }
            else {
              // 両面が透明でかつ同じ素材なので、描画しない
              mask[n] = 0;
              invMask[n] = 0;
            }
          } else if (a && (!b || isTransparent(b))) {
            // aが不透明でbが存在しないか半透明
            mask[n] = a;
            invMask[n] = 0
          } else if (b && (!a || isTransparent(a))) {
            // bが不透明でaが存在しないか半透明
            mask[n] = 0
            invMask[n] = b;
          } else {
            // 描画の必要なし
            mask[n] = 0
            invMask[n] = 0
          }
        }
      }

      ++x[d];

      // Generate mesh for mask using lexicographic ordering
      function generateMesh(mask, dimsV, dimsU, vertices, faces, clockwise) {
        clockwise = clockwise === undefined ? true : clockwise;
        var n, j, i, c, w, h, k, du = [0,0,0], dv = [0,0,0];
        n = 0;
        for (j=0; j < dimsV; ++j) {
          for (i=0; i < dimsU; ) {
            c = mask[n];
            if (!c) {
              i++;  n++; continue;
            }

            //Compute width
            w = 1;
            while (c === mask[n+w] && i+w < dimsU) w++;

            //Compute height (this is slightly awkward)
            for (h=1; j+h < dimsV; ++h) {
              k = 0;
              while (k < w && c === mask[n+k+h*dimsU]) k++
              if (k < w) break;
            }

            // Add quad
            // The du/dv arrays are reused/reset
            // for each iteration.
            du[d] = 0; dv[d] = 0;
            x[u]  = i;  x[v] = j;

            if (clockwise) {
            // if (c > 0) {
              dv[v] = h; dv[u] = 0;
              du[u] = w; du[v] = 0;
            } else {
              // c = -c;
              du[v] = h; du[u] = 0;
              dv[u] = w; dv[v] = 0;
            }
            
            var vertex_count
            if (!isTransparent(c)) {
              // 不透明な頂点と面としてバッファに値を追加
              vertex_count = vertices.length;
              vertices.push([x[0],             x[1],             x[2]            ]);
              vertices.push([x[0]+du[0],       x[1]+du[1],       x[2]+du[2]      ]);
              vertices.push([x[0]+du[0]+dv[0], x[1]+du[1]+dv[1], x[2]+du[2]+dv[2]]);
              vertices.push([x[0]      +dv[0], x[1]      +dv[1], x[2]      +dv[2]]);
              faces.push([vertex_count, vertex_count+1, vertex_count+2, vertex_count+3, c]);
            } else {
              // 透明な頂点と面としてバッファに値を追加
               vertex_count = tVertices.length;
               tVertices.push([x[0],             x[1],             x[2]            ]);
               tVertices.push([x[0]+du[0],       x[1]+du[1],       x[2]+du[2]      ]);
               tVertices.push([x[0]+du[0]+dv[0], x[1]+du[1]+dv[1], x[2]+du[2]+dv[2]]);
               tVertices.push([x[0]      +dv[0], x[1]      +dv[1], x[2]      +dv[2]]);
               tFaces.push([vertex_count, vertex_count+1, vertex_count+2, vertex_count+3, c]);
            }

            //Zero-out mask
            W = n + w;
            for(l=0; l<h; ++l) {
              for(k=n; k<W; ++k) {
                mask[k+l*dimsU] = 0;
              }
            }

            //Increment counters and continue
            i += w; n += w;
          }
        }
      }
      generateMesh(mask, dimsV, dimsU, vertices, faces, true)
      generateMesh(invMask, dimsV, dimsU, vertices, faces, false)
    }
  }
  
  // 透明部分と不透明部分を分離した状態で返す
  return { vertices:vertices, tVertices: tVertices, faces:faces, tFaces: tFaces }
}
})();

if(exports) {
  exports.mesher = GreedyMesh;
}

},{}],12:[function(require,module,exports){
module.exports = inherits

function inherits (c, p, proto) {
  proto = proto || {}
  var e = {}
  ;[c.prototype, proto].forEach(function (s) {
    Object.getOwnPropertyNames(s).forEach(function (k) {
      e[k] = Object.getOwnPropertyDescriptor(s, k)
    })
  })
  c.prototype = Object.create(p.prototype, e)
  c.super = p
}

//function Child () {
//  Child.super.call(this)
//  console.error([this
//                ,this.constructor
//                ,this.constructor === Child
//                ,this.constructor.super === Parent
//                ,Object.getPrototypeOf(this) === Child.prototype
//                ,Object.getPrototypeOf(Object.getPrototypeOf(this))
//                 === Parent.prototype
//                ,this instanceof Child
//                ,this instanceof Parent])
//}
//function Parent () {}
//inherits(Child, Parent)
//new Child

},{}],13:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIm1haW4uanMiLCJub2RlX21vZHVsZXMvbmRhcnJheS9uZGFycmF5LmpzIiwibm9kZV9tb2R1bGVzL25kYXJyYXkvbm9kZV9tb2R1bGVzL2lvdGEtYXJyYXkvaW90YS5qcyIsIm5vZGVfbW9kdWxlcy9uZGFycmF5L25vZGVfbW9kdWxlcy9pcy1idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdm94ZWxfbmFrYXRhMDcwNS9jaHVua2VyLmpzIiwibm9kZV9tb2R1bGVzL3ZveGVsX25ha2F0YTA3MDUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdm94ZWxfbmFrYXRhMDcwNS9tZXNoZXJzL2N1bGxlZC5qcyIsIm5vZGVfbW9kdWxlcy92b3hlbF9uYWthdGEwNzA1L21lc2hlcnMvZ3JlZWR5LmpzIiwibm9kZV9tb2R1bGVzL3ZveGVsX25ha2F0YTA3MDUvbWVzaGVycy9tb25vdG9uZS5qcyIsIm5vZGVfbW9kdWxlcy92b3hlbF9uYWthdGEwNzA1L21lc2hlcnMvc3R1cGlkLmpzIiwibm9kZV9tb2R1bGVzL3ZveGVsX25ha2F0YTA3MDUvbWVzaGVycy90cmFuc2dyZWVkeS5qcyIsIm5vZGVfbW9kdWxlcy92b3hlbF9uYWthdGEwNzA1L25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0cy5qcyIsIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdlZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKmdsb2JhbCB2b3hlbCovXG4vKmdsb2JhbCBuZGFycmF5Ki9cbnZveGVsID0gcmVxdWlyZSgndm94ZWxfbmFrYXRhMDcwNScpO1xubmRhcnJheSA9IHJlcXVpcmUoJ25kYXJyYXknKTtcbiIsInZhciBpb3RhID0gcmVxdWlyZShcImlvdGEtYXJyYXlcIilcbnZhciBpc0J1ZmZlciA9IHJlcXVpcmUoXCJpcy1idWZmZXJcIilcblxudmFyIGhhc1R5cGVkQXJyYXlzICA9ICgodHlwZW9mIEZsb2F0NjRBcnJheSkgIT09IFwidW5kZWZpbmVkXCIpXG5cbmZ1bmN0aW9uIGNvbXBhcmUxc3QoYSwgYikge1xuICByZXR1cm4gYVswXSAtIGJbMF1cbn1cblxuZnVuY3Rpb24gb3JkZXIoKSB7XG4gIHZhciBzdHJpZGUgPSB0aGlzLnN0cmlkZVxuICB2YXIgdGVybXMgPSBuZXcgQXJyYXkoc3RyaWRlLmxlbmd0aClcbiAgdmFyIGlcbiAgZm9yKGk9MDsgaTx0ZXJtcy5sZW5ndGg7ICsraSkge1xuICAgIHRlcm1zW2ldID0gW01hdGguYWJzKHN0cmlkZVtpXSksIGldXG4gIH1cbiAgdGVybXMuc29ydChjb21wYXJlMXN0KVxuICB2YXIgcmVzdWx0ID0gbmV3IEFycmF5KHRlcm1zLmxlbmd0aClcbiAgZm9yKGk9MDsgaTxyZXN1bHQubGVuZ3RoOyArK2kpIHtcbiAgICByZXN1bHRbaV0gPSB0ZXJtc1tpXVsxXVxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cblxuZnVuY3Rpb24gY29tcGlsZUNvbnN0cnVjdG9yKGR0eXBlLCBkaW1lbnNpb24pIHtcbiAgdmFyIGNsYXNzTmFtZSA9IFtcIlZpZXdcIiwgZGltZW5zaW9uLCBcImRcIiwgZHR5cGVdLmpvaW4oXCJcIilcbiAgaWYoZGltZW5zaW9uIDwgMCkge1xuICAgIGNsYXNzTmFtZSA9IFwiVmlld19OaWxcIiArIGR0eXBlXG4gIH1cbiAgdmFyIHVzZUdldHRlcnMgPSAoZHR5cGUgPT09IFwiZ2VuZXJpY1wiKVxuXG4gIGlmKGRpbWVuc2lvbiA9PT0gLTEpIHtcbiAgICAvL1NwZWNpYWwgY2FzZSBmb3IgdHJpdmlhbCBhcnJheXNcbiAgICB2YXIgY29kZSA9XG4gICAgICBcImZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIihhKXt0aGlzLmRhdGE9YTt9O1xcXG52YXIgcHJvdG89XCIrY2xhc3NOYW1lK1wiLnByb3RvdHlwZTtcXFxucHJvdG8uZHR5cGU9J1wiK2R0eXBlK1wiJztcXFxucHJvdG8uaW5kZXg9ZnVuY3Rpb24oKXtyZXR1cm4gLTF9O1xcXG5wcm90by5zaXplPTA7XFxcbnByb3RvLmRpbWVuc2lvbj0tMTtcXFxucHJvdG8uc2hhcGU9cHJvdG8uc3RyaWRlPXByb3RvLm9yZGVyPVtdO1xcXG5wcm90by5sbz1wcm90by5oaT1wcm90by50cmFuc3Bvc2U9cHJvdG8uc3RlcD1cXFxuZnVuY3Rpb24oKXtyZXR1cm4gbmV3IFwiK2NsYXNzTmFtZStcIih0aGlzLmRhdGEpO307XFxcbnByb3RvLmdldD1wcm90by5zZXQ9ZnVuY3Rpb24oKXt9O1xcXG5wcm90by5waWNrPWZ1bmN0aW9uKCl7cmV0dXJuIG51bGx9O1xcXG5yZXR1cm4gZnVuY3Rpb24gY29uc3RydWN0X1wiK2NsYXNzTmFtZStcIihhKXtyZXR1cm4gbmV3IFwiK2NsYXNzTmFtZStcIihhKTt9XCJcbiAgICB2YXIgcHJvY2VkdXJlID0gbmV3IEZ1bmN0aW9uKGNvZGUpXG4gICAgcmV0dXJuIHByb2NlZHVyZSgpXG4gIH0gZWxzZSBpZihkaW1lbnNpb24gPT09IDApIHtcbiAgICAvL1NwZWNpYWwgY2FzZSBmb3IgMGQgYXJyYXlzXG4gICAgdmFyIGNvZGUgPVxuICAgICAgXCJmdW5jdGlvbiBcIitjbGFzc05hbWUrXCIoYSxkKSB7XFxcbnRoaXMuZGF0YSA9IGE7XFxcbnRoaXMub2Zmc2V0ID0gZFxcXG59O1xcXG52YXIgcHJvdG89XCIrY2xhc3NOYW1lK1wiLnByb3RvdHlwZTtcXFxucHJvdG8uZHR5cGU9J1wiK2R0eXBlK1wiJztcXFxucHJvdG8uaW5kZXg9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5vZmZzZXR9O1xcXG5wcm90by5kaW1lbnNpb249MDtcXFxucHJvdG8uc2l6ZT0xO1xcXG5wcm90by5zaGFwZT1cXFxucHJvdG8uc3RyaWRlPVxcXG5wcm90by5vcmRlcj1bXTtcXFxucHJvdG8ubG89XFxcbnByb3RvLmhpPVxcXG5wcm90by50cmFuc3Bvc2U9XFxcbnByb3RvLnN0ZXA9ZnVuY3Rpb24gXCIrY2xhc3NOYW1lK1wiX2NvcHkoKSB7XFxcbnJldHVybiBuZXcgXCIrY2xhc3NOYW1lK1wiKHRoaXMuZGF0YSx0aGlzLm9mZnNldClcXFxufTtcXFxucHJvdG8ucGljaz1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfcGljaygpe1xcXG5yZXR1cm4gVHJpdmlhbEFycmF5KHRoaXMuZGF0YSk7XFxcbn07XFxcbnByb3RvLnZhbHVlT2Y9cHJvdG8uZ2V0PWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9nZXQoKXtcXFxucmV0dXJuIFwiKyh1c2VHZXR0ZXJzID8gXCJ0aGlzLmRhdGEuZ2V0KHRoaXMub2Zmc2V0KVwiIDogXCJ0aGlzLmRhdGFbdGhpcy5vZmZzZXRdXCIpK1xuXCJ9O1xcXG5wcm90by5zZXQ9ZnVuY3Rpb24gXCIrY2xhc3NOYW1lK1wiX3NldCh2KXtcXFxucmV0dXJuIFwiKyh1c2VHZXR0ZXJzID8gXCJ0aGlzLmRhdGEuc2V0KHRoaXMub2Zmc2V0LHYpXCIgOiBcInRoaXMuZGF0YVt0aGlzLm9mZnNldF09dlwiKStcIlxcXG59O1xcXG5yZXR1cm4gZnVuY3Rpb24gY29uc3RydWN0X1wiK2NsYXNzTmFtZStcIihhLGIsYyxkKXtyZXR1cm4gbmV3IFwiK2NsYXNzTmFtZStcIihhLGQpfVwiXG4gICAgdmFyIHByb2NlZHVyZSA9IG5ldyBGdW5jdGlvbihcIlRyaXZpYWxBcnJheVwiLCBjb2RlKVxuICAgIHJldHVybiBwcm9jZWR1cmUoQ0FDSEVEX0NPTlNUUlVDVE9SU1tkdHlwZV1bMF0pXG4gIH1cblxuICB2YXIgY29kZSA9IFtcIid1c2Ugc3RyaWN0J1wiXVxuXG4gIC8vQ3JlYXRlIGNvbnN0cnVjdG9yIGZvciB2aWV3XG4gIHZhciBpbmRpY2VzID0gaW90YShkaW1lbnNpb24pXG4gIHZhciBhcmdzID0gaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkgeyByZXR1cm4gXCJpXCIraSB9KVxuICB2YXIgaW5kZXhfc3RyID0gXCJ0aGlzLm9mZnNldCtcIiArIGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgICAgcmV0dXJuIFwidGhpcy5zdHJpZGVbXCIgKyBpICsgXCJdKmlcIiArIGlcbiAgICAgIH0pLmpvaW4oXCIrXCIpXG4gIHZhciBzaGFwZUFyZyA9IGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBcImJcIitpXG4gICAgfSkuam9pbihcIixcIilcbiAgdmFyIHN0cmlkZUFyZyA9IGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBcImNcIitpXG4gICAgfSkuam9pbihcIixcIilcbiAgY29kZS5wdXNoKFxuICAgIFwiZnVuY3Rpb24gXCIrY2xhc3NOYW1lK1wiKGEsXCIgKyBzaGFwZUFyZyArIFwiLFwiICsgc3RyaWRlQXJnICsgXCIsZCl7dGhpcy5kYXRhPWFcIixcbiAgICAgIFwidGhpcy5zaGFwZT1bXCIgKyBzaGFwZUFyZyArIFwiXVwiLFxuICAgICAgXCJ0aGlzLnN0cmlkZT1bXCIgKyBzdHJpZGVBcmcgKyBcIl1cIixcbiAgICAgIFwidGhpcy5vZmZzZXQ9ZHwwfVwiLFxuICAgIFwidmFyIHByb3RvPVwiK2NsYXNzTmFtZStcIi5wcm90b3R5cGVcIixcbiAgICBcInByb3RvLmR0eXBlPSdcIitkdHlwZStcIidcIixcbiAgICBcInByb3RvLmRpbWVuc2lvbj1cIitkaW1lbnNpb24pXG5cbiAgLy92aWV3LnNpemU6XG4gIGNvZGUucHVzaChcIk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywnc2l6ZScse2dldDpmdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfc2l6ZSgpe1xcXG5yZXR1cm4gXCIraW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkgeyByZXR1cm4gXCJ0aGlzLnNoYXBlW1wiK2krXCJdXCIgfSkuam9pbihcIipcIiksXG5cIn19KVwiKVxuXG4gIC8vdmlldy5vcmRlcjpcbiAgaWYoZGltZW5zaW9uID09PSAxKSB7XG4gICAgY29kZS5wdXNoKFwicHJvdG8ub3JkZXI9WzBdXCIpXG4gIH0gZWxzZSB7XG4gICAgY29kZS5wdXNoKFwiT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCdvcmRlcicse2dldDpcIilcbiAgICBpZihkaW1lbnNpb24gPCA0KSB7XG4gICAgICBjb2RlLnB1c2goXCJmdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfb3JkZXIoKXtcIilcbiAgICAgIGlmKGRpbWVuc2lvbiA9PT0gMikge1xuICAgICAgICBjb2RlLnB1c2goXCJyZXR1cm4gKE1hdGguYWJzKHRoaXMuc3RyaWRlWzBdKT5NYXRoLmFicyh0aGlzLnN0cmlkZVsxXSkpP1sxLDBdOlswLDFdfX0pXCIpXG4gICAgICB9IGVsc2UgaWYoZGltZW5zaW9uID09PSAzKSB7XG4gICAgICAgIGNvZGUucHVzaChcblwidmFyIHMwPU1hdGguYWJzKHRoaXMuc3RyaWRlWzBdKSxzMT1NYXRoLmFicyh0aGlzLnN0cmlkZVsxXSksczI9TWF0aC5hYnModGhpcy5zdHJpZGVbMl0pO1xcXG5pZihzMD5zMSl7XFxcbmlmKHMxPnMyKXtcXFxucmV0dXJuIFsyLDEsMF07XFxcbn1lbHNlIGlmKHMwPnMyKXtcXFxucmV0dXJuIFsxLDIsMF07XFxcbn1lbHNle1xcXG5yZXR1cm4gWzEsMCwyXTtcXFxufVxcXG59ZWxzZSBpZihzMD5zMil7XFxcbnJldHVybiBbMiwwLDFdO1xcXG59ZWxzZSBpZihzMj5zMSl7XFxcbnJldHVybiBbMCwxLDJdO1xcXG59ZWxzZXtcXFxucmV0dXJuIFswLDIsMV07XFxcbn19fSlcIilcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29kZS5wdXNoKFwiT1JERVJ9KVwiKVxuICAgIH1cbiAgfVxuXG4gIC8vdmlldy5zZXQoaTAsIC4uLiwgdik6XG4gIGNvZGUucHVzaChcblwicHJvdG8uc2V0PWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9zZXQoXCIrYXJncy5qb2luKFwiLFwiKStcIix2KXtcIilcbiAgaWYodXNlR2V0dGVycykge1xuICAgIGNvZGUucHVzaChcInJldHVybiB0aGlzLmRhdGEuc2V0KFwiK2luZGV4X3N0citcIix2KX1cIilcbiAgfSBlbHNlIHtcbiAgICBjb2RlLnB1c2goXCJyZXR1cm4gdGhpcy5kYXRhW1wiK2luZGV4X3N0citcIl09dn1cIilcbiAgfVxuXG4gIC8vdmlldy5nZXQoaTAsIC4uLik6XG4gIGNvZGUucHVzaChcInByb3RvLmdldD1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfZ2V0KFwiK2FyZ3Muam9pbihcIixcIikrXCIpe1wiKVxuICBpZih1c2VHZXR0ZXJzKSB7XG4gICAgY29kZS5wdXNoKFwicmV0dXJuIHRoaXMuZGF0YS5nZXQoXCIraW5kZXhfc3RyK1wiKX1cIilcbiAgfSBlbHNlIHtcbiAgICBjb2RlLnB1c2goXCJyZXR1cm4gdGhpcy5kYXRhW1wiK2luZGV4X3N0citcIl19XCIpXG4gIH1cblxuICAvL3ZpZXcuaW5kZXg6XG4gIGNvZGUucHVzaChcbiAgICBcInByb3RvLmluZGV4PWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9pbmRleChcIiwgYXJncy5qb2luKCksIFwiKXtyZXR1cm4gXCIraW5kZXhfc3RyK1wifVwiKVxuXG4gIC8vdmlldy5oaSgpOlxuICBjb2RlLnB1c2goXCJwcm90by5oaT1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfaGkoXCIrYXJncy5qb2luKFwiLFwiKStcIil7cmV0dXJuIG5ldyBcIitjbGFzc05hbWUrXCIodGhpcy5kYXRhLFwiK1xuICAgIGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBbXCIodHlwZW9mIGlcIixpLFwiIT09J251bWJlcid8fGlcIixpLFwiPDApP3RoaXMuc2hhcGVbXCIsIGksIFwiXTppXCIsIGksXCJ8MFwiXS5qb2luKFwiXCIpXG4gICAgfSkuam9pbihcIixcIikrXCIsXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwidGhpcy5zdHJpZGVbXCIraSArIFwiXVwiXG4gICAgfSkuam9pbihcIixcIikrXCIsdGhpcy5vZmZzZXQpfVwiKVxuXG4gIC8vdmlldy5sbygpOlxuICB2YXIgYV92YXJzID0gaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkgeyByZXR1cm4gXCJhXCIraStcIj10aGlzLnNoYXBlW1wiK2krXCJdXCIgfSlcbiAgdmFyIGNfdmFycyA9IGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHsgcmV0dXJuIFwiY1wiK2krXCI9dGhpcy5zdHJpZGVbXCIraStcIl1cIiB9KVxuICBjb2RlLnB1c2goXCJwcm90by5sbz1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfbG8oXCIrYXJncy5qb2luKFwiLFwiKStcIil7dmFyIGI9dGhpcy5vZmZzZXQsZD0wLFwiK2FfdmFycy5qb2luKFwiLFwiKStcIixcIitjX3ZhcnMuam9pbihcIixcIikpXG4gIGZvcih2YXIgaT0wOyBpPGRpbWVuc2lvbjsgKytpKSB7XG4gICAgY29kZS5wdXNoKFxuXCJpZih0eXBlb2YgaVwiK2krXCI9PT0nbnVtYmVyJyYmaVwiK2krXCI+PTApe1xcXG5kPWlcIitpK1wifDA7XFxcbmIrPWNcIitpK1wiKmQ7XFxcbmFcIitpK1wiLT1kfVwiKVxuICB9XG4gIGNvZGUucHVzaChcInJldHVybiBuZXcgXCIrY2xhc3NOYW1lK1wiKHRoaXMuZGF0YSxcIitcbiAgICBpbmRpY2VzLm1hcChmdW5jdGlvbihpKSB7XG4gICAgICByZXR1cm4gXCJhXCIraVxuICAgIH0pLmpvaW4oXCIsXCIpK1wiLFwiK1xuICAgIGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBcImNcIitpXG4gICAgfSkuam9pbihcIixcIikrXCIsYil9XCIpXG5cbiAgLy92aWV3LnN0ZXAoKTpcbiAgY29kZS5wdXNoKFwicHJvdG8uc3RlcD1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfc3RlcChcIithcmdzLmpvaW4oXCIsXCIpK1wiKXt2YXIgXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwiYVwiK2krXCI9dGhpcy5zaGFwZVtcIitpK1wiXVwiXG4gICAgfSkuam9pbihcIixcIikrXCIsXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwiYlwiK2krXCI9dGhpcy5zdHJpZGVbXCIraStcIl1cIlxuICAgIH0pLmpvaW4oXCIsXCIpK1wiLGM9dGhpcy5vZmZzZXQsZD0wLGNlaWw9TWF0aC5jZWlsXCIpXG4gIGZvcih2YXIgaT0wOyBpPGRpbWVuc2lvbjsgKytpKSB7XG4gICAgY29kZS5wdXNoKFxuXCJpZih0eXBlb2YgaVwiK2krXCI9PT0nbnVtYmVyJyl7XFxcbmQ9aVwiK2krXCJ8MDtcXFxuaWYoZDwwKXtcXFxuYys9YlwiK2krXCIqKGFcIitpK1wiLTEpO1xcXG5hXCIraStcIj1jZWlsKC1hXCIraStcIi9kKVxcXG59ZWxzZXtcXFxuYVwiK2krXCI9Y2VpbChhXCIraStcIi9kKVxcXG59XFxcbmJcIitpK1wiKj1kXFxcbn1cIilcbiAgfVxuICBjb2RlLnB1c2goXCJyZXR1cm4gbmV3IFwiK2NsYXNzTmFtZStcIih0aGlzLmRhdGEsXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwiYVwiICsgaVxuICAgIH0pLmpvaW4oXCIsXCIpK1wiLFwiK1xuICAgIGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBcImJcIiArIGlcbiAgICB9KS5qb2luKFwiLFwiKStcIixjKX1cIilcblxuICAvL3ZpZXcudHJhbnNwb3NlKCk6XG4gIHZhciB0U2hhcGUgPSBuZXcgQXJyYXkoZGltZW5zaW9uKVxuICB2YXIgdFN0cmlkZSA9IG5ldyBBcnJheShkaW1lbnNpb24pXG4gIGZvcih2YXIgaT0wOyBpPGRpbWVuc2lvbjsgKytpKSB7XG4gICAgdFNoYXBlW2ldID0gXCJhW2lcIitpK1wiXVwiXG4gICAgdFN0cmlkZVtpXSA9IFwiYltpXCIraStcIl1cIlxuICB9XG4gIGNvZGUucHVzaChcInByb3RvLnRyYW5zcG9zZT1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfdHJhbnNwb3NlKFwiK2FyZ3MrXCIpe1wiK1xuICAgIGFyZ3MubWFwKGZ1bmN0aW9uKG4saWR4KSB7IHJldHVybiBuICsgXCI9KFwiICsgbiArIFwiPT09dW5kZWZpbmVkP1wiICsgaWR4ICsgXCI6XCIgKyBuICsgXCJ8MClcIn0pLmpvaW4oXCI7XCIpLFxuICAgIFwidmFyIGE9dGhpcy5zaGFwZSxiPXRoaXMuc3RyaWRlO3JldHVybiBuZXcgXCIrY2xhc3NOYW1lK1wiKHRoaXMuZGF0YSxcIit0U2hhcGUuam9pbihcIixcIikrXCIsXCIrdFN0cmlkZS5qb2luKFwiLFwiKStcIix0aGlzLm9mZnNldCl9XCIpXG5cbiAgLy92aWV3LnBpY2soKTpcbiAgY29kZS5wdXNoKFwicHJvdG8ucGljaz1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfcGljayhcIithcmdzK1wiKXt2YXIgYT1bXSxiPVtdLGM9dGhpcy5vZmZzZXRcIilcbiAgZm9yKHZhciBpPTA7IGk8ZGltZW5zaW9uOyArK2kpIHtcbiAgICBjb2RlLnB1c2goXCJpZih0eXBlb2YgaVwiK2krXCI9PT0nbnVtYmVyJyYmaVwiK2krXCI+PTApe2M9KGMrdGhpcy5zdHJpZGVbXCIraStcIl0qaVwiK2krXCIpfDB9ZWxzZXthLnB1c2godGhpcy5zaGFwZVtcIitpK1wiXSk7Yi5wdXNoKHRoaXMuc3RyaWRlW1wiK2krXCJdKX1cIilcbiAgfVxuICBjb2RlLnB1c2goXCJ2YXIgY3Rvcj1DVE9SX0xJU1RbYS5sZW5ndGgrMV07cmV0dXJuIGN0b3IodGhpcy5kYXRhLGEsYixjKX1cIilcblxuICAvL0FkZCByZXR1cm4gc3RhdGVtZW50XG4gIGNvZGUucHVzaChcInJldHVybiBmdW5jdGlvbiBjb25zdHJ1Y3RfXCIrY2xhc3NOYW1lK1wiKGRhdGEsc2hhcGUsc3RyaWRlLG9mZnNldCl7cmV0dXJuIG5ldyBcIitjbGFzc05hbWUrXCIoZGF0YSxcIitcbiAgICBpbmRpY2VzLm1hcChmdW5jdGlvbihpKSB7XG4gICAgICByZXR1cm4gXCJzaGFwZVtcIitpK1wiXVwiXG4gICAgfSkuam9pbihcIixcIikrXCIsXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwic3RyaWRlW1wiK2krXCJdXCJcbiAgICB9KS5qb2luKFwiLFwiKStcIixvZmZzZXQpfVwiKVxuXG4gIC8vQ29tcGlsZSBwcm9jZWR1cmVcbiAgdmFyIHByb2NlZHVyZSA9IG5ldyBGdW5jdGlvbihcIkNUT1JfTElTVFwiLCBcIk9SREVSXCIsIGNvZGUuam9pbihcIlxcblwiKSlcbiAgcmV0dXJuIHByb2NlZHVyZShDQUNIRURfQ09OU1RSVUNUT1JTW2R0eXBlXSwgb3JkZXIpXG59XG5cbmZ1bmN0aW9uIGFycmF5RFR5cGUoZGF0YSkge1xuICBpZihpc0J1ZmZlcihkYXRhKSkge1xuICAgIHJldHVybiBcImJ1ZmZlclwiXG4gIH1cbiAgaWYoaGFzVHlwZWRBcnJheXMpIHtcbiAgICBzd2l0Y2goT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGRhdGEpKSB7XG4gICAgICBjYXNlIFwiW29iamVjdCBGbG9hdDY0QXJyYXldXCI6XG4gICAgICAgIHJldHVybiBcImZsb2F0NjRcIlxuICAgICAgY2FzZSBcIltvYmplY3QgRmxvYXQzMkFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJmbG9hdDMyXCJcbiAgICAgIGNhc2UgXCJbb2JqZWN0IEludDhBcnJheV1cIjpcbiAgICAgICAgcmV0dXJuIFwiaW50OFwiXG4gICAgICBjYXNlIFwiW29iamVjdCBJbnQxNkFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJpbnQxNlwiXG4gICAgICBjYXNlIFwiW29iamVjdCBJbnQzMkFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJpbnQzMlwiXG4gICAgICBjYXNlIFwiW29iamVjdCBVaW50OEFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJ1aW50OFwiXG4gICAgICBjYXNlIFwiW29iamVjdCBVaW50MTZBcnJheV1cIjpcbiAgICAgICAgcmV0dXJuIFwidWludDE2XCJcbiAgICAgIGNhc2UgXCJbb2JqZWN0IFVpbnQzMkFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJ1aW50MzJcIlxuICAgICAgY2FzZSBcIltvYmplY3QgVWludDhDbGFtcGVkQXJyYXldXCI6XG4gICAgICAgIHJldHVybiBcInVpbnQ4X2NsYW1wZWRcIlxuICAgIH1cbiAgfVxuICBpZihBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgcmV0dXJuIFwiYXJyYXlcIlxuICB9XG4gIHJldHVybiBcImdlbmVyaWNcIlxufVxuXG52YXIgQ0FDSEVEX0NPTlNUUlVDVE9SUyA9IHtcbiAgXCJmbG9hdDMyXCI6W10sXG4gIFwiZmxvYXQ2NFwiOltdLFxuICBcImludDhcIjpbXSxcbiAgXCJpbnQxNlwiOltdLFxuICBcImludDMyXCI6W10sXG4gIFwidWludDhcIjpbXSxcbiAgXCJ1aW50MTZcIjpbXSxcbiAgXCJ1aW50MzJcIjpbXSxcbiAgXCJhcnJheVwiOltdLFxuICBcInVpbnQ4X2NsYW1wZWRcIjpbXSxcbiAgXCJidWZmZXJcIjpbXSxcbiAgXCJnZW5lcmljXCI6W11cbn1cblxuOyhmdW5jdGlvbigpIHtcbiAgZm9yKHZhciBpZCBpbiBDQUNIRURfQ09OU1RSVUNUT1JTKSB7XG4gICAgQ0FDSEVEX0NPTlNUUlVDVE9SU1tpZF0ucHVzaChjb21waWxlQ29uc3RydWN0b3IoaWQsIC0xKSlcbiAgfVxufSk7XG5cbmZ1bmN0aW9uIHdyYXBwZWROREFycmF5Q3RvcihkYXRhLCBzaGFwZSwgc3RyaWRlLCBvZmZzZXQpIHtcbiAgaWYoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdmFyIGN0b3IgPSBDQUNIRURfQ09OU1RSVUNUT1JTLmFycmF5WzBdXG4gICAgcmV0dXJuIGN0b3IoW10pXG4gIH0gZWxzZSBpZih0eXBlb2YgZGF0YSA9PT0gXCJudW1iZXJcIikge1xuICAgIGRhdGEgPSBbZGF0YV1cbiAgfVxuICBpZihzaGFwZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgc2hhcGUgPSBbIGRhdGEubGVuZ3RoIF1cbiAgfVxuICB2YXIgZCA9IHNoYXBlLmxlbmd0aFxuICBpZihzdHJpZGUgPT09IHVuZGVmaW5lZCkge1xuICAgIHN0cmlkZSA9IG5ldyBBcnJheShkKVxuICAgIGZvcih2YXIgaT1kLTEsIHN6PTE7IGk+PTA7IC0taSkge1xuICAgICAgc3RyaWRlW2ldID0gc3pcbiAgICAgIHN6ICo9IHNoYXBlW2ldXG4gICAgfVxuICB9XG4gIGlmKG9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgb2Zmc2V0ID0gMFxuICAgIGZvcih2YXIgaT0wOyBpPGQ7ICsraSkge1xuICAgICAgaWYoc3RyaWRlW2ldIDwgMCkge1xuICAgICAgICBvZmZzZXQgLT0gKHNoYXBlW2ldLTEpKnN0cmlkZVtpXVxuICAgICAgfVxuICAgIH1cbiAgfVxuICB2YXIgZHR5cGUgPSBhcnJheURUeXBlKGRhdGEpXG4gIHZhciBjdG9yX2xpc3QgPSBDQUNIRURfQ09OU1RSVUNUT1JTW2R0eXBlXVxuICB3aGlsZShjdG9yX2xpc3QubGVuZ3RoIDw9IGQrMSkge1xuICAgIGN0b3JfbGlzdC5wdXNoKGNvbXBpbGVDb25zdHJ1Y3RvcihkdHlwZSwgY3Rvcl9saXN0Lmxlbmd0aC0xKSlcbiAgfVxuICB2YXIgY3RvciA9IGN0b3JfbGlzdFtkKzFdXG4gIHJldHVybiBjdG9yKGRhdGEsIHNoYXBlLCBzdHJpZGUsIG9mZnNldClcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB3cmFwcGVkTkRBcnJheUN0b3JcbiIsIlwidXNlIHN0cmljdFwiXG5cbmZ1bmN0aW9uIGlvdGEobikge1xuICB2YXIgcmVzdWx0ID0gbmV3IEFycmF5KG4pXG4gIGZvcih2YXIgaT0wOyBpPG47ICsraSkge1xuICAgIHJlc3VsdFtpXSA9IGlcbiAgfVxuICByZXR1cm4gcmVzdWx0XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW90YSIsIi8qKlxuICogRGV0ZXJtaW5lIGlmIGFuIG9iamVjdCBpcyBCdWZmZXJcbiAqXG4gKiBBdXRob3I6ICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIExpY2Vuc2U6ICBNSVRcbiAqXG4gKiBgbnBtIGluc3RhbGwgaXMtYnVmZmVyYFxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaikge1xuICByZXR1cm4gISEob2JqICE9IG51bGwgJiZcbiAgICAob2JqLl9pc0J1ZmZlciB8fCAvLyBGb3IgU2FmYXJpIDUtNyAobWlzc2luZyBPYmplY3QucHJvdG90eXBlLmNvbnN0cnVjdG9yKVxuICAgICAgKG9iai5jb25zdHJ1Y3RvciAmJlxuICAgICAgdHlwZW9mIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlciA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyKG9iaikpXG4gICAgKSlcbn1cbiIsInZhciBldmVudHMgPSByZXF1aXJlKCdldmVudHMnKVxudmFyIGluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdHMpIHtcbiAgcmV0dXJuIG5ldyBDaHVua2VyKG9wdHMpXG59XG5cbm1vZHVsZS5leHBvcnRzLkNodW5rZXIgPSBDaHVua2VyXG5cbmZ1bmN0aW9uIENodW5rZXIob3B0cykge1xuICB0aGlzLmRpc3RhbmNlID0gb3B0cy5jaHVua0Rpc3RhbmNlIHx8IDBcbiAgdGhpcy5jaHVua1NpemUgPSBvcHRzLmNodW5rU2l6ZSB8fCAzMlxuICB0aGlzLmNodW5rUGFkID0gb3B0cy5jaHVua1BhZCAhPT0gdW5kZWZpbmVkID8gb3B0cy5jaHVua1BhZCA6IDBcbiAgdGhpcy5jdWJlU2l6ZSA9IG9wdHMuY3ViZVNpemUgfHwgMjVcbiAgdGhpcy5nZW5lcmF0ZVZveGVsQ2h1bmsgPSBvcHRzLmdlbmVyYXRlVm94ZWxDaHVua1xuICB0aGlzLmNodW5rcyA9IHt9XG4gIHRoaXMubWVzaGVzID0ge31cbiAgdGhpcy5ib2RpZXNBcnJheSA9IHt9XG5cbiAgaWYgKHRoaXMuY2h1bmtTaXplICYgdGhpcy5jaHVua1NpemUtMSAhPT0gMClcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NodW5rU2l6ZSBtdXN0IGJlIGEgcG93ZXIgb2YgMicpXG4gIHZhciBiaXRzID0gMDtcbiAgZm9yICh2YXIgc2l6ZSA9IHRoaXMuY2h1bmtTaXplOyBzaXplID4gMDsgc2l6ZSA+Pj0gMSkgYml0cysrO1xuICB0aGlzLmNodW5rQml0cyA9IGJpdHMgLSAxO1xuICB0aGlzLmNodW5rTWFzayA9ICgxIDw8IHRoaXMuY2h1bmtCaXRzKSAtIDFcbiAgdGhpcy5jaHVua1BhZEhhbGYgPSB0aGlzLmNodW5rUGFkID4+IDFcbn1cblxuaW5oZXJpdHMoQ2h1bmtlciwgZXZlbnRzLkV2ZW50RW1pdHRlcilcblxuQ2h1bmtlci5wcm90b3R5cGUubmVhcmJ5Q2h1bmtzID0gZnVuY3Rpb24ocG9zaXRpb24sIGRpc3RhbmNlKSB7XG4gIHZhciBjcG9zID0gdGhpcy5jaHVua0F0UG9zaXRpb24ocG9zaXRpb24pXG4gIHJldHVybiB0aGlzLm5lYXJieUNodW5rc0Nvb3JkaW5hdGUoY3BvcywgZGlzdGFuY2UpO1xufVxuXG5DaHVua2VyLnByb3RvdHlwZS5uZWFyYnlDaHVua3NDb29yZGluYXRlID0gZnVuY3Rpb24oY3BvcywgZGlzdGFuY2UpIHtcbiAgdmFyIHggPSBjcG9zWzBdXG4gIHZhciB5ID0gY3Bvc1sxXVxuICB2YXIgeiA9IGNwb3NbMl1cbiAgdmFyIGRpc3QgPSBkaXN0YW5jZSB8fCB0aGlzLmRpc3RhbmNlXG4gIHZhciBuZWFyYnkgPSBbXVxuICBpZiAoZGlzdCA9PT0gMCkge1xuICAgICAgbmVhcmJ5LnB1c2goW3gsIHksIHpdKTtcbiAgfVxuICBlbHNlIHtcbiAgICBmb3IgKHZhciBjeCA9ICh4IC0gZGlzdCk7IGN4ICE9PSAoeCArIGRpc3QpOyArK2N4KSB7XG4gICAgICBmb3IgKHZhciBjeSA9ICh5IC0gZGlzdCk7IGN5ICE9PSAoeSArIGRpc3QpOyArK2N5KSB7XG4gICAgICAgIGZvciAodmFyIGN6ID0gKHogLSBkaXN0KTsgY3ogIT09ICh6ICsgZGlzdCk7ICsrY3opIHtcbiAgICAgICAgICBuZWFyYnkucHVzaChbY3gsIGN5LCBjel0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIG5lYXJieVxufVxuXG5DaHVua2VyLnByb3RvdHlwZS5yZXF1ZXN0TWlzc2luZ0NodW5rcyA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuICB0aGlzLm5lYXJieUNodW5rcyhwb3NpdGlvbikubWFwKGZ1bmN0aW9uKGNodW5rKSB7XG4gICAgaWYgKCFzZWxmLmNodW5rc1tjaHVuay5qb2luKCd8JyldKSB7XG4gICAgICBzZWxmLmVtaXQoJ21pc3NpbmdDaHVuaycsIGNodW5rKVxuICAgIH1cbiAgfSlcbn1cblxuQ2h1bmtlci5wcm90b3R5cGUuZ2V0Qm91bmRzID0gZnVuY3Rpb24oeCwgeSwgeikge1xuICB2YXIgYml0cyA9IHRoaXMuY2h1bmtCaXRzXG4gIHZhciBsb3cgPSBbeCA8PCBiaXRzLCB5IDw8IGJpdHMsIHogPDwgYml0c11cbiAgdmFyIGhpZ2ggPSBbKHgrMSkgPDwgYml0cywgKHkrMSkgPDwgYml0cywgKHorMSkgPDwgYml0c11cbiAgcmV0dXJuIFtsb3csIGhpZ2hdXG59XG5cbkNodW5rZXIucHJvdG90eXBlLmdlbmVyYXRlQ2h1bmsgPSBmdW5jdGlvbih4LCB5LCB6KSB7XG4gIHZhciBjcG9zID0gW3gsIHksIHpdO1xuICB2YXIgY2tleSA9IGNwb3Muam9pbignfCcpXG4gIHZhciBjaHVuayA9IHRoaXMuY2h1bmtzW2NrZXldXG4gIGlmIChjaHVuayAhPT0gdW5kZWZpbmVkKSByZXR1cm4gY2h1bmtcbiAgXG4gIHZhciBzZWxmID0gdGhpc1xuICB2YXIgYm91bmRzID0gdGhpcy5nZXRCb3VuZHMoeCwgeSwgeilcbiAgdmFyIGNodW5rID0gdGhpcy5nZW5lcmF0ZVZveGVsQ2h1bmsoYm91bmRzWzBdLCBib3VuZHNbMV0sIHgsIHksIHopXG4gIGNodW5rLnBvc2l0aW9uID0gY3Bvc1xuICBjaHVuay5lbXB0eSA9IHRydWVcbiAgdGhpcy5jaHVua3NbY2tleV0gPSBjaHVua1xuICByZXR1cm4gY2h1bmtcbn1cblxuQ2h1bmtlci5wcm90b3R5cGUuZ2V0Q2h1bmsgPSBmdW5jdGlvbih4LCB5LCB6KSB7XG4gIHZhciBjcG9zID0gW3gsIHksIHpdO1xuICB2YXIgY2tleSA9IGNwb3Muam9pbignfCcpXG4gIHZhciBjaHVuayA9IHRoaXMuY2h1bmtzW2NrZXldXG4gIGlmIChjaHVuaykgcmV0dXJuIGNodW5rXG4gIGVsc2UgcmV0dXJuIHVuZGVmaW5lZCAgXG59XG5cbkNodW5rZXIucHJvdG90eXBlLmRlbGV0ZUNodW5rID0gZnVuY3Rpb24oeCwgeSwgeikge1xuICB2YXIgY3BvcyA9IFt4LCB5LCB6XTtcbiAgdmFyIGNrZXkgPSBjcG9zLmpvaW4oJ3wnKVxuICB2YXIgY2h1bmsgPSB0aGlzLmNodW5rc1tja2V5XVxuICBpZiAoY2h1bmspIGRlbGV0ZSB0aGlzLmNodW5rc1tja2V5XTsgXG59XG5cbkNodW5rZXIucHJvdG90eXBlLmdldE1lc2hlcyA9IGZ1bmN0aW9uICh4LCB5LCB6KSB7XG4gIHZhciBjcG9zID0gW3gsIHksIHpdO1xuICB2YXIgY2tleSA9IGNwb3Muam9pbignfCcpXG4gIHZhciBtZXNoZXMgPSB0aGlzLm1lc2hlc1tja2V5XVxuICBpZiAobWVzaGVzKSByZXR1cm4gbWVzaGVzXG4gIGVsc2UgcmV0dXJuIHVuZGVmaW5lZCAgXG59XG5cbkNodW5rZXIucHJvdG90eXBlLnNldE1lc2hlcyA9IGZ1bmN0aW9uICh4LCB5LCB6LCBtZXNoKSB7XG4gIHZhciBjcG9zID0gW3gsIHksIHpdO1xuICB2YXIgY2tleSA9IGNwb3Muam9pbignfCcpXG4gIGlmIChtZXNoID09PSB1bmRlZmluZWQpIHRoaXMubWVzaGVzW2NrZXldID0gdW5kZWZpbmVkXG4gIGlmICghdGhpcy5tZXNoZXNbY2tleV0pIHRoaXMubWVzaGVzW2NrZXldID0gW21lc2hdXG4gIGVsc2UgdGhpcy5tZXNoZXNbY2tleV0ucHVzaChtZXNoKVxufVxuXG5DaHVua2VyLnByb3RvdHlwZS5nZXRCb2RpZXMgPSBmdW5jdGlvbiAoeCwgeSwgeikge1xuICB2YXIgY3BvcyA9IFt4LCB5LCB6XTtcbiAgdmFyIGNrZXkgPSBjcG9zLmpvaW4oJ3wnKVxuICB2YXIgYm9kaWVzID0gdGhpcy5ib2RpZXNBcnJheVtja2V5XVxuICBpZiAoYm9kaWVzKSByZXR1cm4gYm9kaWVzXG4gIGVsc2UgcmV0dXJuIHVuZGVmaW5lZCAgXG59XG5cbkNodW5rZXIucHJvdG90eXBlLnNldEJvZGllcyA9IGZ1bmN0aW9uICh4LCB5LCB6LCBib2RpZXMpIHtcbiAgdmFyIGNwb3MgPSBbeCwgeSwgel07XG4gIHZhciBja2V5ID0gY3Bvcy5qb2luKCd8JylcbiAgdGhpcy5ib2RpZXNBcnJheVtja2V5XSA9IGJvZGllc1xuICByZXR1cm4gYm9kaWVzO1xufVxuXG5DaHVua2VyLnByb3RvdHlwZS5jaHVua0F0Q29vcmRpbmF0ZXMgPSBmdW5jdGlvbih4LCB5LCB6KSB7XG4gIHZhciBiaXRzID0gdGhpcy5jaHVua0JpdHM7XG4gIHZhciBjeCA9IHggPj4gYml0cztcbiAgdmFyIGN5ID0geSA+PiBiaXRzO1xuICB2YXIgY3ogPSB6ID4+IGJpdHM7XG4gIHZhciBjaHVua1BvcyA9IFtjeCwgY3ksIGN6XTtcbiAgcmV0dXJuIGNodW5rUG9zO1xufVxuXG5DaHVua2VyLnByb3RvdHlwZS5jaHVua0F0UG9zaXRpb24gPSBmdW5jdGlvbihwb3NpdGlvbikge1xuICB2YXIgY3ViZVNpemUgPSB0aGlzLmN1YmVTaXplO1xuICB2YXIgeCA9IE1hdGguZmxvb3IocG9zaXRpb25bMF0gLyBjdWJlU2l6ZSlcbiAgdmFyIHkgPSBNYXRoLmZsb29yKHBvc2l0aW9uWzFdIC8gY3ViZVNpemUpXG4gIHZhciB6ID0gTWF0aC5mbG9vcihwb3NpdGlvblsyXSAvIGN1YmVTaXplKVxuICB2YXIgY2h1bmtQb3MgPSB0aGlzLmNodW5rQXRDb29yZGluYXRlcyh4LCB5LCB6KVxuICByZXR1cm4gY2h1bmtQb3Ncbn07XG5cbkNodW5rZXIucHJvdG90eXBlLnZveGVsSW5kZXhGcm9tQ29vcmRpbmF0ZXMgPSBmdW5jdGlvbih4LCB5LCB6KSB7XG4gIHRocm93IG5ldyBFcnJvcignQ2h1bmtlci5wcm90b3R5cGUudm94ZWxJbmRleEZyb21Db29yZGluYXRlcyByZW1vdmVkLCB1c2Ugdm94ZWxBdENvb3JkaW5hdGVzJylcbn1cblxuQ2h1bmtlci5wcm90b3R5cGUudm94ZWxBdENvb3JkaW5hdGVzID0gZnVuY3Rpb24oeCwgeSwgeiwgdmFsLCBhdXRvKSB7XG4gIHZhciBjcG9zID0gdGhpcy5jaHVua0F0Q29vcmRpbmF0ZXMoeCwgeSwgeilcbiAgdmFyIGNrZXkgPSBjcG9zLmpvaW4oJ3wnKVxuICB2YXIgY2h1bmsgPSB0aGlzLmNodW5rc1tja2V5XVxuICBpZiAoY2h1bmsgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8g44KC44GX44OB44Oj44Oz44Kv44GM5a2Y5Zyo44Gb44Ga44CB5paw6KaP44Gr5Luj5YWl44GV44KM44Gf44Oc44Kv44K744Or5YCk44GMMOOBguOCi+OBhOOBr3VuZGVmaW5lZOOBquOCieOAgeiHquWLleeahOOBq+ODgeODo+ODs+OCr+OCkuS9nOaIkOOBmeOCi+ioreWumuOBp+OCguaWsOOBl+OBhOODgeODo+ODs+OCr+OBr+S9nOaIkOOBl+OBquOBhFxuICAgICAgaWYgKHZhbCA9PT0gMCkgcmV0dXJuIFswLCBudWxsXVxuICAgICAgaWYgKGF1dG8gJiYgdHlwZW9mIHZhbCAhPT0gJ3VuZGVmaW5lZCcpIGNodW5rID0gdGhpcy5nZW5lcmF0ZUNodW5rKGNwb3NbMF0sIGNwb3NbMV0sIGNwb3NbMl0pXG4gICAgICBlbHNlIHJldHVybiBbMCwgbnVsbF1cbiAgfSBcbiAgXG4gIC8vIOODgeODo+ODs+OCr+OBruWRqOWbsuOBq+ioreWumuOBl+OBn+ODkeODh+OCo+ODs+OCsOOCkuiAg+aFruOBl+OBpuODnOOCr+OCu+ODq+WApOOCkuS7o+WFpeOBmeOCi1xuICB2YXIgbWFzayA9IHRoaXMuY2h1bmtNYXNrXG4gIHZhciBoID0gdGhpcy5jaHVua1BhZEhhbGZcbiAgdmFyIG14ID0geCAmIG1hc2tcbiAgdmFyIG15ID0geSAmIG1hc2tcbiAgdmFyIG16ID0geiAmIG1hc2tcbiAgdmFyIHYgPSBjaHVuay5nZXQobXgraCwgbXkraCwgbXoraClcbiAgaWYgKHR5cGVvZiB2YWwgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgY2h1bmsuc2V0KG14K2gsIG15K2gsIG16K2gsIHZhbClcbiAgICBcbiAgICAvLyBbVG9Eb10g44GT44Gu44Kz44O844OJ44Gv44OB44Oj44Oz44Kv44KS44Kv44Op44K55YyW44GX44Gf44KJ44CB5YaF6YOo5Yem55CG44Go44GX44Gm5Y+W44KK6L6844KAXG4gICAgaWYgKHZhbCAhPT0gMHgwMCkgY2h1bmsuZW1wdHkgPSBmYWxzZVxuICB9XG4gIHJldHVybiBbdiwgY2h1bmtdXG59XG5cbkNodW5rZXIucHJvdG90eXBlLnZveGVsQXRQb3NpdGlvbiA9IGZ1bmN0aW9uKHBvcywgdmFsLCBhdXRvKSB7XG4gIHZhciBjdWJlU2l6ZSA9IHRoaXMuY3ViZVNpemU7XG4gIHZhciB4ID0gTWF0aC5mbG9vcihwb3NbMF0gLyBjdWJlU2l6ZSlcbiAgdmFyIHkgPSBNYXRoLmZsb29yKHBvc1sxXSAvIGN1YmVTaXplKVxuICB2YXIgeiA9IE1hdGguZmxvb3IocG9zWzJdIC8gY3ViZVNpemUpXG4gIHZhciB2ID0gdGhpcy52b3hlbEF0Q29vcmRpbmF0ZXMoeCwgeSwgeiwgdmFsLCBhdXRvKVxuICByZXR1cm4gdjtcbn1cblxuIiwidmFyIGNodW5rZXIgPSByZXF1aXJlKCcuL2NodW5rZXInKVxudmFyIG5kYXJyYXkgPSByZXF1aXJlKCduZGFycmF5JylcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRzKSB7XG4gIGlmICghb3B0cy5nZW5lcmF0ZVZveGVsQ2h1bmspIG9wdHMuZ2VuZXJhdGVWb3hlbENodW5rID0gZnVuY3Rpb24obG93LCBoaWdoKSB7XG5cdHJldHVybiBnZW5lcmF0ZTMyKGxvdywgaGlnaCwgZnVuY3Rpb24oaSwgaiwgaykgeyByZXR1cm4gMDsgfSlcbiAgfVxuICByZXR1cm4gY2h1bmtlcihvcHRzKVxufVxuXG5tb2R1bGUuZXhwb3J0cy5tZXNoZXJzID0ge1xuICBjdWxsZWQ6IHJlcXVpcmUoJy4vbWVzaGVycy9jdWxsZWQnKS5tZXNoZXIsXG4gIGdyZWVkeTogcmVxdWlyZSgnLi9tZXNoZXJzL2dyZWVkeScpLm1lc2hlcixcbiAgdHJhbnNncmVlZHk6IHJlcXVpcmUoJy4vbWVzaGVycy90cmFuc2dyZWVkeScpLm1lc2hlcixcbiAgbW9ub3RvbmU6IHJlcXVpcmUoJy4vbWVzaGVycy9tb25vdG9uZScpLm1lc2hlcixcbiAgc3R1cGlkOiByZXF1aXJlKCcuL21lc2hlcnMvc3R1cGlkJykubWVzaGVyXG59XG5cbm1vZHVsZS5leHBvcnRzLkNodW5rZXIgPSBjaHVua2VyLkNodW5rZXJcbm1vZHVsZS5leHBvcnRzLmdlb21ldHJ5ID0ge31cbm1vZHVsZS5leHBvcnRzLmdlbmVyYXRvciA9IHt9XG5tb2R1bGUuZXhwb3J0cy5nZW5lcmF0ZTMyID0gZ2VuZXJhdGUzMlxuXG5mdW5jdGlvbiBnZW5lcmF0ZTMyKGxvLCBoaSwgZm4pIHtcbiAgLy8gVG8gZml4IHRoZSBkaXNwbGF5IGdhcHMsIHdlIG5lZWQgdG8gcGFkIHRoZSBib3VuZHNcbiAgbG9bMF0tLVxuICBsb1sxXS0tXG4gIGxvWzJdLS1cbiAgaGlbMF0rK1xuICBoaVsxXSsrXG4gIGhpWzJdKytcbiAgdmFyIGRpbXMgPSBbaGlbMl0tbG9bMl0sIGhpWzFdLWxvWzFdLCBoaVswXS1sb1swXV1cbiAgdmFyIGRhdGEgPSBuZGFycmF5KG5ldyBVaW50MzJBcnJheShkaW1zWzJdICogZGltc1sxXSAqIGRpbXNbMF0pLCBkaW1zKVxuICBmb3IgKHZhciBrID0gbG9bMl07IGsgPCBoaVsyXTsgaysrKVxuICAgIGZvciAodmFyIGogPSBsb1sxXTsgaiA8IGhpWzFdOyBqKyspXG4gICAgICBmb3IodmFyIGkgPSBsb1swXTsgaSA8IGhpWzBdOyBpKyspIHtcbiAgICAgICAgZGF0YS5zZXQoay1sb1syXSwgai1sb1sxXSwgaS1sb1swXSwgZm4oaSwgaiwgaykpXG4gICAgICB9XG4gIHJldHVybiBkYXRhXG59XG5cbi8vIHNoYXBlIGFuZCB0ZXJyYWluIGdlbmVyYXRvciBmdW5jdGlvbnNcbm1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnU3BoZXJlJ10gPSBmdW5jdGlvbihpLGosaykge1xuICByZXR1cm4gaSppK2oqaitrKmsgPD0gMTYqMTYgPyAxIDogMFxufVxuXG5tb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ05vaXNlJ10gPSBmdW5jdGlvbihpLGosaykge1xuICByZXR1cm4gTWF0aC5yYW5kb20oKSA8IDAuMSA/IE1hdGgucmFuZG9tKCkgKiAweGZmZmZmZiA6IDA7XG59XG5cbm1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnRGVuc2UgTm9pc2UnXSA9IGZ1bmN0aW9uKGksaixrKSB7XG4gIHJldHVybiBNYXRoLnJvdW5kKE1hdGgucmFuZG9tKCkgKiAweGZmZmZmZik7XG59XG5cbm1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnQ2hlY2tlciddID0gZnVuY3Rpb24oaSxqLGspIHtcbiAgcmV0dXJuICEhKChpK2oraykmMSkgPyAoKChpXmpeaykmMikgPyAxIDogMHhmZmZmZmYpIDogMDtcbn1cblxubW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydIaWxsJ10gPSBmdW5jdGlvbihpLGosaykge1xuICByZXR1cm4gaiA8PSAxNiAqIE1hdGguZXhwKC0oaSppICsgayprKSAvIDY0KSA/IDEgOiAwO1xufVxuXG5tb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ1ZhbGxleSddID0gZnVuY3Rpb24oaSxqLGspIHtcbiAgcmV0dXJuIGogPD0gKGkqaSArIGsqaykgKiAzMSAvICgzMiozMioyKSArIDEgPyAxICsgKDE8PDE1KSA6IDA7XG59XG5cbm1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnSGlsbHkgVGVycmFpbiddID0gZnVuY3Rpb24oaSxqLGspIHtcbiAgdmFyIGgwID0gMy4wICogTWF0aC5zaW4oTWF0aC5QSSAqIGkgLyAxMi4wIC0gTWF0aC5QSSAqIGsgKiAwLjEpICsgMjc7ICAgIFxuICBpZihqID4gaDArMSkge1xuICAgIHJldHVybiAwO1xuICB9XG4gIGlmKGgwIDw9IGopIHtcbiAgICByZXR1cm4gMTtcbiAgfVxuICB2YXIgaDEgPSAyLjAgKiBNYXRoLnNpbihNYXRoLlBJICogaSAqIDAuMjUgLSBNYXRoLlBJICogayAqIDAuMykgKyAyMDtcbiAgaWYoaDEgPD0gaikge1xuICAgIHJldHVybiAyO1xuICB9XG4gIGlmKDIgPCBqKSB7XG4gICAgcmV0dXJuIE1hdGgucmFuZG9tKCkgPCAwLjEgPyAweDIyMjIyMiA6IDB4YWFhYWFhO1xuICB9XG4gIHJldHVybiAzO1xufVxuXG5tb2R1bGUuZXhwb3J0cy5zY2FsZSA9IGZ1bmN0aW9uICggeCwgZnJvbUxvdywgZnJvbUhpZ2gsIHRvTG93LCB0b0hpZ2ggKSB7XG4gIHJldHVybiAoIHggLSBmcm9tTG93ICkgKiAoIHRvSGlnaCAtIHRvTG93ICkgLyAoIGZyb21IaWdoIC0gZnJvbUxvdyApICsgdG9Mb3dcbn1cblxuLy8gY29udmVuaWVuY2UgZnVuY3Rpb24gdGhhdCB1c2VzIHRoZSBhYm92ZSBmdW5jdGlvbnMgdG8gcHJlYmFrZSBzb21lIHNpbXBsZSB2b3hlbCBnZW9tZXRyaWVzXG5tb2R1bGUuZXhwb3J0cy5nZW5lcmF0ZUV4YW1wbGVzID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB7XG4gICAgJ1NwaGVyZSc6IGdlbmVyYXRlMzIoWy0xNiwtMTYsLTE2XSwgWzE2LDE2LDE2XSwgbW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydTcGhlcmUnXSksXG4gICAgJ05vaXNlJzogZ2VuZXJhdGUzMihbMCwwLDBdLCBbMTYsMTYsMTZdLCBtb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ05vaXNlJ10pLFxuICAgICdEZW5zZSBOb2lzZSc6IGdlbmVyYXRlMzIoWzAsMCwwXSwgWzE2LDE2LDE2XSwgbW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydEZW5zZSBOb2lzZSddKSxcbiAgICAnQ2hlY2tlcic6IGdlbmVyYXRlMzIoWzAsMCwwXSwgWzgsOCw4XSwgbW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydDaGVja2VyJ10pLFxuICAgICdIaWxsJzogZ2VuZXJhdGUzMihbLTE2LCAwLCAtMTZdLCBbMTYsMTYsMTZdLCBtb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ0hpbGwnXSksXG4gICAgJ1ZhbGxleSc6IGdlbmVyYXRlMzIoWzAsMCwwXSwgWzMyLDMyLDMyXSwgbW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydWYWxsZXknXSksXG4gICAgJ0hpbGx5IFRlcnJhaW4nOiBnZW5lcmF0ZTMyKFswLCAwLCAwXSwgWzMyLDMyLDMyXSwgbW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydIaWxseSBUZXJyYWluJ10pXG4gIH1cbn1cblxuIiwiLy9OYWl2ZSBtZXNoaW5nICh3aXRoIGZhY2UgY3VsbGluZylcbmZ1bmN0aW9uIEN1bGxlZE1lc2godm9sdW1lLCBkaW1zKSB7XG4gIC8vUHJlY2FsY3VsYXRlIGRpcmVjdGlvbiB2ZWN0b3JzIGZvciBjb252ZW5pZW5jZVxuICB2YXIgZGlyID0gbmV3IEFycmF5KDMpO1xuICBmb3IodmFyIGk9MDsgaTwzOyArK2kpIHtcbiAgICBkaXJbaV0gPSBbWzAsMCwwXSwgWzAsMCwwXV07XG4gICAgZGlyW2ldWzBdWyhpKzEpJTNdID0gMTtcbiAgICBkaXJbaV1bMV1bKGkrMiklM10gPSAxO1xuICB9XG4gIC8vTWFyY2ggb3ZlciB0aGUgdm9sdW1lXG4gIHZhciB2ZXJ0aWNlcyA9IFtdXG4gICAgLCBmYWNlcyA9IFtdXG4gICAgLCB4ID0gWzAsMCwwXVxuICAgICwgQiA9IFtbZmFsc2UsdHJ1ZV0gICAgLy9JbmNyZW1lbnRhbGx5IHVwZGF0ZSBib3VuZHMgKHRoaXMgaXMgYSBiaXQgdWdseSlcbiAgICAgICAgICAsW2ZhbHNlLHRydWVdXG4gICAgICAgICAgLFtmYWxzZSx0cnVlXV1cbiAgICAsIG4gPSAtZGltc1swXSpkaW1zWzFdO1xuICBmb3IoICAgICAgICAgICBCWzJdPVtmYWxzZSx0cnVlXSx4WzJdPS0xOyB4WzJdPGRpbXNbMl07IEJbMl09W3RydWUsKCsreFsyXTxkaW1zWzJdLTEpXSlcbiAgZm9yKG4tPWRpbXNbMF0sQlsxXT1bZmFsc2UsdHJ1ZV0seFsxXT0tMTsgeFsxXTxkaW1zWzFdOyBCWzFdPVt0cnVlLCgrK3hbMV08ZGltc1sxXS0xKV0pXG4gIGZvcihuLT0xLCAgICAgIEJbMF09W2ZhbHNlLHRydWVdLHhbMF09LTE7IHhbMF08ZGltc1swXTsgQlswXT1bdHJ1ZSwoKyt4WzBdPGRpbXNbMF0tMSldLCArK24pIHtcbiAgICAvL1JlYWQgY3VycmVudCB2b3hlbCBhbmQgMyBuZWlnaGJvcmluZyB2b3hlbHMgdXNpbmcgYm91bmRzIGNoZWNrIHJlc3VsdHNcbiAgICB2YXIgcCA9ICAgKEJbMF1bMF0gJiYgQlsxXVswXSAmJiBCWzJdWzBdKSA/IHZvbHVtZVtuXSAgICAgICAgICAgICAgICAgOiAwXG4gICAgICAsIGIgPSBbIChCWzBdWzFdICYmIEJbMV1bMF0gJiYgQlsyXVswXSkgPyB2b2x1bWVbbisxXSAgICAgICAgICAgICAgIDogMFxuICAgICAgICAgICAgLCAoQlswXVswXSAmJiBCWzFdWzFdICYmIEJbMl1bMF0pID8gdm9sdW1lW24rZGltc1swXV0gICAgICAgICA6IDBcbiAgICAgICAgICAgICwgKEJbMF1bMF0gJiYgQlsxXVswXSAmJiBCWzJdWzFdKSA/IHZvbHVtZVtuK2RpbXNbMF0qZGltc1sxXV0gOiAwXG4gICAgICAgICAgXTtcbiAgICAvL0dlbmVyYXRlIGZhY2VzXG4gICAgZm9yKHZhciBkPTA7IGQ8MzsgKytkKVxuICAgIGlmKCghIXApICE9PSAoISFiW2RdKSkge1xuICAgICAgdmFyIHMgPSAhcCA/IDEgOiAwO1xuICAgICAgdmFyIHQgPSBbeFswXSx4WzFdLHhbMl1dXG4gICAgICAgICwgdSA9IGRpcltkXVtzXVxuICAgICAgICAsIHYgPSBkaXJbZF1bc14xXTtcbiAgICAgICsrdFtkXTtcbiAgICAgIFxuICAgICAgdmFyIHZlcnRleF9jb3VudCA9IHZlcnRpY2VzLmxlbmd0aDtcbiAgICAgIHZlcnRpY2VzLnB1c2goW3RbMF0sICAgICAgICAgICB0WzFdLCAgICAgICAgICAgdFsyXSAgICAgICAgICBdKTtcbiAgICAgIHZlcnRpY2VzLnB1c2goW3RbMF0rdVswXSwgICAgICB0WzFdK3VbMV0sICAgICAgdFsyXSt1WzJdICAgICBdKTtcbiAgICAgIHZlcnRpY2VzLnB1c2goW3RbMF0rdVswXSt2WzBdLCB0WzFdK3VbMV0rdlsxXSwgdFsyXSt1WzJdK3ZbMl1dKTtcbiAgICAgIHZlcnRpY2VzLnB1c2goW3RbMF0gICAgICt2WzBdLCB0WzFdICAgICArdlsxXSwgdFsyXSAgICAgK3ZbMl1dKTtcbiAgICAgIGZhY2VzLnB1c2goW3ZlcnRleF9jb3VudCwgdmVydGV4X2NvdW50KzEsIHZlcnRleF9jb3VudCsyLCB2ZXJ0ZXhfY291bnQrMywgcyA/IGJbZF0gOiBwXSk7XG4gICAgfVxuICB9XG4gIHJldHVybiB7IHZlcnRpY2VzOnZlcnRpY2VzLCBmYWNlczpmYWNlcyB9O1xufVxuXG5cbmlmKGV4cG9ydHMpIHtcbiAgZXhwb3J0cy5tZXNoZXIgPSBDdWxsZWRNZXNoO1xufVxuIiwidmFyIEdyZWVkeU1lc2ggPSAoZnVuY3Rpb24oKSB7XG4vL0NhY2hlIGJ1ZmZlciBpbnRlcm5hbGx5XG52YXIgbWFzayA9IG5ldyBVaW50MzJBcnJheSg0MDk2KTtcbnZhciBtYXNrRGlyZWN0aW9uID0gbmV3IFVpbnQzMkFycmF5KDQwOTYpO1xuXG5yZXR1cm4gZnVuY3Rpb24odm9sdW1lLCBkaW1zKSB7XG4gIHZhciB2ZXJ0aWNlcyA9IFtdLCBmYWNlcyA9IFtdXG4gICAgLCBkaW1zWCA9IGRpbXNbMF1cbiAgICAsIGRpbXNZID0gZGltc1sxXVxuICAgICwgZGltc1hZID0gZGltc1ggKiBkaW1zWTtcblxuICAvL1N3ZWVwIG92ZXIgMy1heGVzXG4gIGZvcih2YXIgZD0wOyBkPDM7ICsrZCkge1xuICAgIHZhciBpLCBqLCBrLCBsLCB3LCBXLCBoLCBuLCBjXG4gICAgICAsIHUgPSAoZCsxKSUzXG4gICAgICAsIHYgPSAoZCsyKSUzXG4gICAgICAsIHggPSBbMCwwLDBdXG4gICAgICAsIHEgPSBbMCwwLDBdXG4gICAgICAsIGR1ID0gWzAsMCwwXVxuICAgICAgLCBkdiA9IFswLDAsMF1cbiAgICAgICwgZGltc0QgPSBkaW1zW2RdXG4gICAgICAsIGRpbXNVID0gZGltc1t1XVxuICAgICAgLCBkaW1zViA9IGRpbXNbdl1cbiAgICAgICwgcWRpbXNYLCBxZGltc1hZXG4gICAgICAsIHhkXG5cbiAgICBpZiAobWFzay5sZW5ndGggPCBkaW1zVSAqIGRpbXNWKSB7XG4gICAgICBtYXNrID0gbmV3IFVpbnQzMkFycmF5KGRpbXNVICogZGltc1YpO1xuICAgICAgbWFza0RpcmVjdGlvbiA9IG5ldyBVaW50MzJBcnJheShkaW1zVSAqIGRpbXNWKTtcbiAgICB9XG5cbiAgICBxW2RdID0gIDE7XG4gICAgeFtkXSA9IC0xO1xuXG4gICAgcWRpbXNYICA9IGRpbXNYICAqIHFbMV1cbiAgICBxZGltc1hZID0gZGltc1hZICogcVsyXVxuXG4gICAgLy8gQ29tcHV0ZSBtYXNrXG4gICAgd2hpbGUgKHhbZF0gPCBkaW1zRCkge1xuICAgICAgeGQgPSB4W2RdXG4gICAgICBuID0gMDtcblxuICAgICAgZm9yKHhbdl0gPSAwOyB4W3ZdIDwgZGltc1Y7ICsreFt2XSkge1xuICAgICAgICBmb3IoeFt1XSA9IDA7IHhbdV0gPCBkaW1zVTsgKyt4W3VdLCArK24pIHtcbiAgICAgICAgICB2YXIgYSA9IHhkID49IDAgICAgICAmJiB2b2x1bWVbeFswXSAgICAgICsgZGltc1ggKiB4WzFdICAgICAgICAgICsgZGltc1hZICogeFsyXSAgICAgICAgICBdXG4gICAgICAgICAgICAsIGIgPSB4ZCA8IGRpbXNELTEgJiYgdm9sdW1lW3hbMF0rcVswXSArIGRpbXNYICogeFsxXSArIHFkaW1zWCArIGRpbXNYWSAqIHhbMl0gKyBxZGltc1hZXVxuICAgICAgICAgIGlmIChhID8gYiA6ICFiKSB7XG4gICAgICAgICAgICBtYXNrW25dID0gMDsgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIG1hc2tbbl0gPSBhID8gYSA6IGI7XG4gICAgICAgICAgbWFza0RpcmVjdGlvbltuXSA9IGEgPyAxIDogLTE7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgKyt4W2RdO1xuXG4gICAgICAvLyBHZW5lcmF0ZSBtZXNoIGZvciBtYXNrIHVzaW5nIGxleGljb2dyYXBoaWMgb3JkZXJpbmdcbiAgICAgIG4gPSAwO1xuICAgICAgZm9yIChqPTA7IGogPCBkaW1zVjsgKytqKSB7XG4gICAgICAgIGZvciAoaT0wOyBpIDwgZGltc1U7ICkge1xuICAgICAgICAgIGMgPSBtYXNrW25dICogbWFza0RpcmVjdGlvbltuXTtcbiAgICAgICAgICBpZiAoIWMpIHtcbiAgICAgICAgICAgIGkrKzsgIG4rKzsgY29udGludWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy9Db21wdXRlIHdpZHRoXG4gICAgICAgICAgdyA9IDE7XG4gICAgICAgICAgd2hpbGUgKGMgPT09IG1hc2tbbit3XSAqIG1hc2tEaXJlY3Rpb25bbit3XSAmJiBpK3cgPCBkaW1zVSkgdysrO1xuXG4gICAgICAgICAgLy9Db21wdXRlIGhlaWdodCAodGhpcyBpcyBzbGlnaHRseSBhd2t3YXJkKVxuICAgICAgICAgIGZvciAoaD0xOyBqK2ggPCBkaW1zVjsgKytoKSB7XG4gICAgICAgICAgICBrID0gMDtcbiAgICAgICAgICAgIHdoaWxlIChrIDwgdyAmJiBjID09PSBtYXNrW24raytoKmRpbXNVXSAqIG1hc2tEaXJlY3Rpb25bbitrK2gqZGltc1VdKSBrKytcbiAgICAgICAgICAgIGlmIChrIDwgdykgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQWRkIHF1YWRcbiAgICAgICAgICAvLyBUaGUgZHUvZHYgYXJyYXlzIGFyZSByZXVzZWQvcmVzZXRcbiAgICAgICAgICAvLyBmb3IgZWFjaCBpdGVyYXRpb24uXG4gICAgICAgICAgZHVbZF0gPSAwOyBkdltkXSA9IDA7XG4gICAgICAgICAgeFt1XSAgPSBpOyAgeFt2XSA9IGo7XG5cbiAgICAgICAgICBpZiAoYyA+IDApIHtcbiAgICAgICAgICAgIGR2W3ZdID0gaDsgZHZbdV0gPSAwO1xuICAgICAgICAgICAgZHVbdV0gPSB3OyBkdVt2XSA9IDA7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGMgPSAtYztcbiAgICAgICAgICAgIGR1W3ZdID0gaDsgZHVbdV0gPSAwO1xuICAgICAgICAgICAgZHZbdV0gPSB3OyBkdlt2XSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciB2ZXJ0ZXhfY291bnQgPSB2ZXJ0aWNlcy5sZW5ndGg7XG4gICAgICAgICAgdmVydGljZXMucHVzaChbeFswXSwgICAgICAgICAgICAgeFsxXSwgICAgICAgICAgICAgeFsyXSAgICAgICAgICAgIF0pO1xuICAgICAgICAgIHZlcnRpY2VzLnB1c2goW3hbMF0rZHVbMF0sICAgICAgIHhbMV0rZHVbMV0sICAgICAgIHhbMl0rZHVbMl0gICAgICBdKTtcbiAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt4WzBdK2R1WzBdK2R2WzBdLCB4WzFdK2R1WzFdK2R2WzFdLCB4WzJdK2R1WzJdK2R2WzJdXSk7XG4gICAgICAgICAgdmVydGljZXMucHVzaChbeFswXSAgICAgICtkdlswXSwgeFsxXSAgICAgICtkdlsxXSwgeFsyXSAgICAgICtkdlsyXV0pO1xuICAgICAgICAgIGZhY2VzLnB1c2goW3ZlcnRleF9jb3VudCwgdmVydGV4X2NvdW50KzEsIHZlcnRleF9jb3VudCsyLCB2ZXJ0ZXhfY291bnQrMywgY10pO1xuXG4gICAgICAgICAgLy9aZXJvLW91dCBtYXNrXG4gICAgICAgICAgVyA9IG4gKyB3O1xuICAgICAgICAgIGZvcihsPTA7IGw8aDsgKytsKSB7XG4gICAgICAgICAgICBmb3Ioaz1uOyBrPFc7ICsraykge1xuICAgICAgICAgICAgICBtYXNrW2srbCpkaW1zVV0gPSAwO1xuICAgICAgICAgICAgICBtYXNrRGlyZWN0aW9uW2srbCpkaW1zVV0gPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vSW5jcmVtZW50IGNvdW50ZXJzIGFuZCBjb250aW51ZVxuICAgICAgICAgIGkgKz0gdzsgbiArPSB3O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiB7IHZlcnRpY2VzOnZlcnRpY2VzLCBmYWNlczpmYWNlcyB9O1xufVxufSkoKTtcblxuaWYoZXhwb3J0cykge1xuICBleHBvcnRzLm1lc2hlciA9IEdyZWVkeU1lc2g7XG59XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIE1vbm90b25lTWVzaCA9IChmdW5jdGlvbigpe1xuXG5mdW5jdGlvbiBNb25vdG9uZVBvbHlnb24oYywgdiwgdWwsIHVyKSB7XG4gIHRoaXMuY29sb3IgID0gYztcbiAgdGhpcy5sZWZ0ICAgPSBbW3VsLCB2XV07XG4gIHRoaXMucmlnaHQgID0gW1t1ciwgdl1dO1xufTtcblxuTW9ub3RvbmVQb2x5Z29uLnByb3RvdHlwZS5jbG9zZV9vZmYgPSBmdW5jdGlvbih2KSB7XG4gIHRoaXMubGVmdC5wdXNoKFsgdGhpcy5sZWZ0W3RoaXMubGVmdC5sZW5ndGgtMV1bMF0sIHYgXSk7XG4gIHRoaXMucmlnaHQucHVzaChbIHRoaXMucmlnaHRbdGhpcy5yaWdodC5sZW5ndGgtMV1bMF0sIHYgXSk7XG59O1xuXG5Nb25vdG9uZVBvbHlnb24ucHJvdG90eXBlLm1lcmdlX3J1biA9IGZ1bmN0aW9uKHYsIHVfbCwgdV9yKSB7XG4gIHZhciBsID0gdGhpcy5sZWZ0W3RoaXMubGVmdC5sZW5ndGgtMV1bMF1cbiAgICAsIHIgPSB0aGlzLnJpZ2h0W3RoaXMucmlnaHQubGVuZ3RoLTFdWzBdOyBcbiAgaWYobCAhPT0gdV9sKSB7XG4gICAgdGhpcy5sZWZ0LnB1c2goWyBsLCB2IF0pO1xuICAgIHRoaXMubGVmdC5wdXNoKFsgdV9sLCB2IF0pO1xuICB9XG4gIGlmKHIgIT09IHVfcikge1xuICAgIHRoaXMucmlnaHQucHVzaChbIHIsIHYgXSk7XG4gICAgdGhpcy5yaWdodC5wdXNoKFsgdV9yLCB2IF0pO1xuICB9XG59O1xuXG5cbnJldHVybiBmdW5jdGlvbih2b2x1bWUsIGRpbXMpIHtcbiAgZnVuY3Rpb24gZihpLGosaykge1xuICAgIHJldHVybiB2b2x1bWVbaSArIGRpbXNbMF0gKiAoaiArIGRpbXNbMV0gKiBrKV07XG4gIH1cbiAgLy9Td2VlcCBvdmVyIDMtYXhlc1xuICB2YXIgdmVydGljZXMgPSBbXSwgZmFjZXMgPSBbXTtcbiAgZm9yKHZhciBkPTA7IGQ8MzsgKytkKSB7XG4gICAgdmFyIGksIGosIGtcbiAgICAgICwgdSA9IChkKzEpJTMgICAvL3UgYW5kIHYgYXJlIG9ydGhvZ29uYWwgZGlyZWN0aW9ucyB0byBkXG4gICAgICAsIHYgPSAoZCsyKSUzXG4gICAgICAsIHggPSBuZXcgSW50MzJBcnJheSgzKVxuICAgICAgLCBxID0gbmV3IEludDMyQXJyYXkoMylcbiAgICAgICwgcnVucyA9IG5ldyBJbnQzMkFycmF5KDIgKiAoZGltc1t1XSsxKSlcbiAgICAgICwgZnJvbnRpZXIgPSBuZXcgSW50MzJBcnJheShkaW1zW3VdKSAgLy9Gcm9udGllciBpcyBsaXN0IG9mIHBvaW50ZXJzIHRvIHBvbHlnb25zXG4gICAgICAsIG5leHRfZnJvbnRpZXIgPSBuZXcgSW50MzJBcnJheShkaW1zW3VdKVxuICAgICAgLCBsZWZ0X2luZGV4ID0gbmV3IEludDMyQXJyYXkoMiAqIGRpbXNbdl0pXG4gICAgICAsIHJpZ2h0X2luZGV4ID0gbmV3IEludDMyQXJyYXkoMiAqIGRpbXNbdl0pXG4gICAgICAsIHN0YWNrID0gbmV3IEludDMyQXJyYXkoMjQgKiBkaW1zW3ZdKVxuICAgICAgLCBkZWx0YSA9IFtbMCwwXSwgWzAsMF1dO1xuICAgIC8vcSBwb2ludHMgYWxvbmcgZC1kaXJlY3Rpb25cbiAgICBxW2RdID0gMTtcbiAgICAvL0luaXRpYWxpemUgc2VudGluZWxcbiAgICBmb3IoeFtkXT0tMTsgeFtkXTxkaW1zW2RdOyApIHtcbiAgICAgIC8vIC0tLSBQZXJmb3JtIG1vbm90b25lIHBvbHlnb24gc3ViZGl2aXNpb24gLS0tXG4gICAgICB2YXIgbiA9IDBcbiAgICAgICAgLCBwb2x5Z29ucyA9IFtdXG4gICAgICAgICwgbmYgPSAwO1xuICAgICAgZm9yKHhbdl09MDsgeFt2XTxkaW1zW3ZdOyArK3hbdl0pIHtcbiAgICAgICAgLy9NYWtlIG9uZSBwYXNzIG92ZXIgdGhlIHUtc2NhbiBsaW5lIG9mIHRoZSB2b2x1bWUgdG8gcnVuLWxlbmd0aCBlbmNvZGUgcG9seWdvblxuICAgICAgICB2YXIgbnIgPSAwLCBwID0gMCwgYyA9IDA7XG4gICAgICAgIGZvcih4W3VdPTA7IHhbdV08ZGltc1t1XTsgKyt4W3VdLCBwID0gYykge1xuICAgICAgICAgIC8vQ29tcHV0ZSB0aGUgdHlwZSBmb3IgdGhpcyBmYWNlXG4gICAgICAgICAgdmFyIGEgPSAoMCAgICA8PSB4W2RdICAgICAgPyBmKHhbMF0sICAgICAgeFsxXSwgICAgICB4WzJdKSAgICAgIDogMClcbiAgICAgICAgICAgICwgYiA9ICh4W2RdIDwgIGRpbXNbZF0tMSA/IGYoeFswXStxWzBdLCB4WzFdK3FbMV0sIHhbMl0rcVsyXSkgOiAwKTtcbiAgICAgICAgICBjID0gYTtcbiAgICAgICAgICBpZigoIWEpID09PSAoIWIpKSB7XG4gICAgICAgICAgICBjID0gMDtcbiAgICAgICAgICB9IGVsc2UgaWYoIWEpIHtcbiAgICAgICAgICAgIGMgPSAtYjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy9JZiBjZWxsIHR5cGUgZG9lc24ndCBtYXRjaCwgc3RhcnQgYSBuZXcgcnVuXG4gICAgICAgICAgaWYocCAhPT0gYykge1xuICAgICAgICAgICAgcnVuc1tucisrXSA9IHhbdV07XG4gICAgICAgICAgICBydW5zW25yKytdID0gYztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy9BZGQgc2VudGluZWwgcnVuXG4gICAgICAgIHJ1bnNbbnIrK10gPSBkaW1zW3VdO1xuICAgICAgICBydW5zW25yKytdID0gMDtcbiAgICAgICAgLy9VcGRhdGUgZnJvbnRpZXIgYnkgbWVyZ2luZyBydW5zXG4gICAgICAgIHZhciBmcCA9IDA7XG4gICAgICAgIGZvcih2YXIgaT0wLCBqPTA7IGk8bmYgJiYgajxuci0yOyApIHtcbiAgICAgICAgICB2YXIgcCAgICA9IHBvbHlnb25zW2Zyb250aWVyW2ldXVxuICAgICAgICAgICAgLCBwX2wgID0gcC5sZWZ0W3AubGVmdC5sZW5ndGgtMV1bMF1cbiAgICAgICAgICAgICwgcF9yICA9IHAucmlnaHRbcC5yaWdodC5sZW5ndGgtMV1bMF1cbiAgICAgICAgICAgICwgcF9jICA9IHAuY29sb3JcbiAgICAgICAgICAgICwgcl9sICA9IHJ1bnNbal0gICAgLy9TdGFydCBvZiBydW5cbiAgICAgICAgICAgICwgcl9yICA9IHJ1bnNbaisyXSAgLy9FbmQgb2YgcnVuXG4gICAgICAgICAgICAsIHJfYyAgPSBydW5zW2orMV07IC8vQ29sb3Igb2YgcnVuXG4gICAgICAgICAgLy9DaGVjayBpZiB3ZSBjYW4gbWVyZ2UgcnVuIHdpdGggcG9seWdvblxuICAgICAgICAgIGlmKHJfciA+IHBfbCAmJiBwX3IgPiByX2wgJiYgcl9jID09PSBwX2MpIHtcbiAgICAgICAgICAgIC8vTWVyZ2UgcnVuXG4gICAgICAgICAgICBwLm1lcmdlX3J1bih4W3ZdLCByX2wsIHJfcik7XG4gICAgICAgICAgICAvL0luc2VydCBwb2x5Z29uIGludG8gZnJvbnRpZXJcbiAgICAgICAgICAgIG5leHRfZnJvbnRpZXJbZnArK10gPSBmcm9udGllcltpXTtcbiAgICAgICAgICAgICsraTtcbiAgICAgICAgICAgIGogKz0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy9DaGVjayBpZiB3ZSBuZWVkIHRvIGFkdmFuY2UgdGhlIHJ1biBwb2ludGVyXG4gICAgICAgICAgICBpZihyX3IgPD0gcF9yKSB7XG4gICAgICAgICAgICAgIGlmKCEhcl9jKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5fcG9seSA9IG5ldyBNb25vdG9uZVBvbHlnb24ocl9jLCB4W3ZdLCByX2wsIHJfcik7XG4gICAgICAgICAgICAgICAgbmV4dF9mcm9udGllcltmcCsrXSA9IHBvbHlnb25zLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBwb2x5Z29ucy5wdXNoKG5fcG9seSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaiArPSAyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy9DaGVjayBpZiB3ZSBuZWVkIHRvIGFkdmFuY2UgdGhlIGZyb250aWVyIHBvaW50ZXJcbiAgICAgICAgICAgIGlmKHBfciA8PSByX3IpIHtcbiAgICAgICAgICAgICAgcC5jbG9zZV9vZmYoeFt2XSk7XG4gICAgICAgICAgICAgICsraTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy9DbG9zZSBvZmYgYW55IHJlc2lkdWFsIHBvbHlnb25zXG4gICAgICAgIGZvcig7IGk8bmY7ICsraSkge1xuICAgICAgICAgIHBvbHlnb25zW2Zyb250aWVyW2ldXS5jbG9zZV9vZmYoeFt2XSk7XG4gICAgICAgIH1cbiAgICAgICAgLy9BZGQgYW55IGV4dHJhIHJ1bnMgdG8gZnJvbnRpZXJcbiAgICAgICAgZm9yKDsgajxuci0yOyBqKz0yKSB7XG4gICAgICAgICAgdmFyIHJfbCAgPSBydW5zW2pdXG4gICAgICAgICAgICAsIHJfciAgPSBydW5zW2orMl1cbiAgICAgICAgICAgICwgcl9jICA9IHJ1bnNbaisxXTtcbiAgICAgICAgICBpZighIXJfYykge1xuICAgICAgICAgICAgdmFyIG5fcG9seSA9IG5ldyBNb25vdG9uZVBvbHlnb24ocl9jLCB4W3ZdLCByX2wsIHJfcik7XG4gICAgICAgICAgICBuZXh0X2Zyb250aWVyW2ZwKytdID0gcG9seWdvbnMubGVuZ3RoO1xuICAgICAgICAgICAgcG9seWdvbnMucHVzaChuX3BvbHkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvL1N3YXAgZnJvbnRpZXJzXG4gICAgICAgIHZhciB0bXAgPSBuZXh0X2Zyb250aWVyO1xuICAgICAgICBuZXh0X2Zyb250aWVyID0gZnJvbnRpZXI7XG4gICAgICAgIGZyb250aWVyID0gdG1wO1xuICAgICAgICBuZiA9IGZwO1xuICAgICAgfVxuICAgICAgLy9DbG9zZSBvZmYgZnJvbnRpZXJcbiAgICAgIGZvcih2YXIgaT0wOyBpPG5mOyArK2kpIHtcbiAgICAgICAgdmFyIHAgPSBwb2x5Z29uc1tmcm9udGllcltpXV07XG4gICAgICAgIHAuY2xvc2Vfb2ZmKGRpbXNbdl0pO1xuICAgICAgfVxuICAgICAgLy8gLS0tIE1vbm90b25lIHN1YmRpdmlzaW9uIG9mIHBvbHlnb24gaXMgY29tcGxldGUgYXQgdGhpcyBwb2ludCAtLS1cbiAgICAgIFxuICAgICAgeFtkXSsrO1xuICAgICAgXG4gICAgICAvL05vdyB3ZSBqdXN0IG5lZWQgdG8gdHJpYW5ndWxhdGUgZWFjaCBtb25vdG9uZSBwb2x5Z29uXG4gICAgICBmb3IodmFyIGk9MDsgaTxwb2x5Z29ucy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgcCA9IHBvbHlnb25zW2ldXG4gICAgICAgICAgLCBjID0gcC5jb2xvclxuICAgICAgICAgICwgZmxpcHBlZCA9IGZhbHNlO1xuICAgICAgICBpZihjIDwgMCkge1xuICAgICAgICAgIGZsaXBwZWQgPSB0cnVlO1xuICAgICAgICAgIGMgPSAtYztcbiAgICAgICAgfVxuICAgICAgICBmb3IodmFyIGo9MDsgajxwLmxlZnQubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICBsZWZ0X2luZGV4W2pdID0gdmVydGljZXMubGVuZ3RoO1xuICAgICAgICAgIHZhciB5ID0gWzAuMCwwLjAsMC4wXVxuICAgICAgICAgICAgLCB6ID0gcC5sZWZ0W2pdO1xuICAgICAgICAgIHlbZF0gPSB4W2RdO1xuICAgICAgICAgIHlbdV0gPSB6WzBdO1xuICAgICAgICAgIHlbdl0gPSB6WzFdO1xuICAgICAgICAgIHZlcnRpY2VzLnB1c2goeSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yKHZhciBqPTA7IGo8cC5yaWdodC5sZW5ndGg7ICsraikge1xuICAgICAgICAgIHJpZ2h0X2luZGV4W2pdID0gdmVydGljZXMubGVuZ3RoO1xuICAgICAgICAgIHZhciB5ID0gWzAuMCwwLjAsMC4wXVxuICAgICAgICAgICAgLCB6ID0gcC5yaWdodFtqXTtcbiAgICAgICAgICB5W2RdID0geFtkXTtcbiAgICAgICAgICB5W3VdID0gelswXTtcbiAgICAgICAgICB5W3ZdID0gelsxXTtcbiAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKHkpO1xuICAgICAgICB9XG4gICAgICAgIC8vVHJpYW5ndWxhdGUgdGhlIG1vbm90b25lIHBvbHlnb25cbiAgICAgICAgdmFyIGJvdHRvbSA9IDBcbiAgICAgICAgICAsIHRvcCA9IDBcbiAgICAgICAgICAsIGxfaSA9IDFcbiAgICAgICAgICAsIHJfaSA9IDFcbiAgICAgICAgICAsIHNpZGUgPSB0cnVlOyAgLy90cnVlID0gcmlnaHQsIGZhbHNlID0gbGVmdFxuICAgICAgICBcbiAgICAgICAgc3RhY2tbdG9wKytdID0gbGVmdF9pbmRleFswXTtcbiAgICAgICAgc3RhY2tbdG9wKytdID0gcC5sZWZ0WzBdWzBdO1xuICAgICAgICBzdGFja1t0b3ArK10gPSBwLmxlZnRbMF1bMV07XG4gICAgICAgIFxuICAgICAgICBzdGFja1t0b3ArK10gPSByaWdodF9pbmRleFswXTtcbiAgICAgICAgc3RhY2tbdG9wKytdID0gcC5yaWdodFswXVswXTtcbiAgICAgICAgc3RhY2tbdG9wKytdID0gcC5yaWdodFswXVsxXTtcbiAgICAgICAgXG4gICAgICAgIHdoaWxlKGxfaSA8IHAubGVmdC5sZW5ndGggfHwgcl9pIDwgcC5yaWdodC5sZW5ndGgpIHtcbiAgICAgICAgICAvL0NvbXB1dGUgbmV4dCBzaWRlXG4gICAgICAgICAgdmFyIG5fc2lkZSA9IGZhbHNlO1xuICAgICAgICAgIGlmKGxfaSA9PT0gcC5sZWZ0Lmxlbmd0aCkge1xuICAgICAgICAgICAgbl9zaWRlID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2UgaWYocl9pICE9PSBwLnJpZ2h0Lmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIGwgPSBwLmxlZnRbbF9pXVxuICAgICAgICAgICAgICAsIHIgPSBwLnJpZ2h0W3JfaV07XG4gICAgICAgICAgICBuX3NpZGUgPSBsWzFdID4gclsxXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIGlkeCA9IG5fc2lkZSA/IHJpZ2h0X2luZGV4W3JfaV0gOiBsZWZ0X2luZGV4W2xfaV1cbiAgICAgICAgICAgICwgdmVydCA9IG5fc2lkZSA/IHAucmlnaHRbcl9pXSA6IHAubGVmdFtsX2ldO1xuICAgICAgICAgIGlmKG5fc2lkZSAhPT0gc2lkZSkge1xuICAgICAgICAgICAgLy9PcHBvc2l0ZSBzaWRlXG4gICAgICAgICAgICB3aGlsZShib3R0b20rMyA8IHRvcCkge1xuICAgICAgICAgICAgICBpZihmbGlwcGVkID09PSBuX3NpZGUpIHtcbiAgICAgICAgICAgICAgICBmYWNlcy5wdXNoKFsgc3RhY2tbYm90dG9tXSwgc3RhY2tbYm90dG9tKzNdLCBpZHgsIGNdKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmYWNlcy5wdXNoKFsgc3RhY2tbYm90dG9tKzNdLCBzdGFja1tib3R0b21dLCBpZHgsIGNdKTsgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJvdHRvbSArPSAzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvL1NhbWUgc2lkZVxuICAgICAgICAgICAgd2hpbGUoYm90dG9tKzMgPCB0b3ApIHtcbiAgICAgICAgICAgICAgLy9Db21wdXRlIGNvbnZleGl0eVxuICAgICAgICAgICAgICBmb3IodmFyIGo9MDsgajwyOyArK2opXG4gICAgICAgICAgICAgIGZvcih2YXIgaz0wOyBrPDI7ICsraykge1xuICAgICAgICAgICAgICAgIGRlbHRhW2pdW2tdID0gc3RhY2tbdG9wLTMqKGorMSkraysxXSAtIHZlcnRba107XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFyIGRldCA9IGRlbHRhWzBdWzBdICogZGVsdGFbMV1bMV0gLSBkZWx0YVsxXVswXSAqIGRlbHRhWzBdWzFdO1xuICAgICAgICAgICAgICBpZihuX3NpZGUgPT09IChkZXQgPiAwKSkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmKGRldCAhPT0gMCkge1xuICAgICAgICAgICAgICAgIGlmKGZsaXBwZWQgPT09IG5fc2lkZSkge1xuICAgICAgICAgICAgICAgICAgZmFjZXMucHVzaChbIHN0YWNrW3RvcC0zXSwgc3RhY2tbdG9wLTZdLCBpZHgsIGMgXSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGZhY2VzLnB1c2goWyBzdGFja1t0b3AtNl0sIHN0YWNrW3RvcC0zXSwgaWR4LCBjIF0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB0b3AgLT0gMztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy9QdXNoIHZlcnRleFxuICAgICAgICAgIHN0YWNrW3RvcCsrXSA9IGlkeDtcbiAgICAgICAgICBzdGFja1t0b3ArK10gPSB2ZXJ0WzBdO1xuICAgICAgICAgIHN0YWNrW3RvcCsrXSA9IHZlcnRbMV07XG4gICAgICAgICAgLy9VcGRhdGUgbG9vcCBpbmRleFxuICAgICAgICAgIGlmKG5fc2lkZSkge1xuICAgICAgICAgICAgKytyX2k7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICsrbF9pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzaWRlID0gbl9zaWRlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiB7IHZlcnRpY2VzOnZlcnRpY2VzLCBmYWNlczpmYWNlcyB9O1xufVxufSkoKTtcblxuaWYoZXhwb3J0cykge1xuICBleHBvcnRzLm1lc2hlciA9IE1vbm90b25lTWVzaDtcbn1cbiIsIi8vVGhlIHN0dXBpZGVzdCBwb3NzaWJsZSB3YXkgdG8gZ2VuZXJhdGUgYSBNaW5lY3JhZnQgbWVzaCAoSSB0aGluaylcbmZ1bmN0aW9uIFN0dXBpZE1lc2godm9sdW1lLCBkaW1zKSB7XG4gIHZhciB2ZXJ0aWNlcyA9IFtdLCBmYWNlcyA9IFtdLCB4ID0gWzAsMCwwXSwgbiA9IDA7XG4gIGZvcih4WzJdPTA7IHhbMl08ZGltc1syXTsgKyt4WzJdKVxuICBmb3IoeFsxXT0wOyB4WzFdPGRpbXNbMV07ICsreFsxXSlcbiAgZm9yKHhbMF09MDsgeFswXTxkaW1zWzBdOyArK3hbMF0sICsrbilcbiAgaWYoISF2b2x1bWVbbl0pIHtcbiAgICBmb3IodmFyIGQ9MDsgZDwzOyArK2QpIHtcbiAgICAgIHZhciB0ID0gW3hbMF0sIHhbMV0sIHhbMl1dXG4gICAgICAgICwgdSA9IFswLDAsMF1cbiAgICAgICAgLCB2ID0gWzAsMCwwXTtcbiAgICAgIHVbKGQrMSklM10gPSAxO1xuICAgICAgdlsoZCsyKSUzXSA9IDE7XG4gICAgICBmb3IodmFyIHM9MDsgczwyOyArK3MpIHtcbiAgICAgICAgdFtkXSA9IHhbZF0gKyBzO1xuICAgICAgICB2YXIgdG1wID0gdTtcbiAgICAgICAgdSA9IHY7XG4gICAgICAgIHYgPSB0bXA7XG4gICAgICAgIHZhciB2ZXJ0ZXhfY291bnQgPSB2ZXJ0aWNlcy5sZW5ndGg7XG4gICAgICAgIHZlcnRpY2VzLnB1c2goW3RbMF0sICAgICAgICAgICB0WzFdLCAgICAgICAgICAgdFsyXSAgICAgICAgICBdKTtcbiAgICAgICAgdmVydGljZXMucHVzaChbdFswXSt1WzBdLCAgICAgIHRbMV0rdVsxXSwgICAgICB0WzJdK3VbMl0gICAgIF0pO1xuICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt0WzBdK3VbMF0rdlswXSwgdFsxXSt1WzFdK3ZbMV0sIHRbMl0rdVsyXSt2WzJdXSk7XG4gICAgICAgIHZlcnRpY2VzLnB1c2goW3RbMF0gICAgICt2WzBdLCB0WzFdICAgICArdlsxXSwgdFsyXSAgICAgK3ZbMl1dKTtcbiAgICAgICAgZmFjZXMucHVzaChbdmVydGV4X2NvdW50LCB2ZXJ0ZXhfY291bnQrMSwgdmVydGV4X2NvdW50KzIsIHZlcnRleF9jb3VudCszLCB2b2x1bWVbbl1dKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHsgdmVydGljZXM6dmVydGljZXMsIGZhY2VzOmZhY2VzIH07XG59XG5cblxuaWYoZXhwb3J0cykge1xuICBleHBvcnRzLm1lc2hlciA9IFN0dXBpZE1lc2g7XG59XG4iLCJ2YXIgR3JlZWR5TWVzaCA9IChmdW5jdGlvbiBncmVlZHlMb2FkZXIoKSB7XG4gICAgXG4vLyDjgrnjgq3jg6Pjg7PmlrnlkJHjgavmraPpnaLjga7pnaLjga7mg4XloLHjgpLlhaXjgozjgotcbnZhciBtYXNrID0gbmV3IFVpbnQzMkFycmF5KDQwOTYpO1xuLy8g44K544Kt44Oj44Oz5pa55ZCR44Gr6IOM6Z2i44Gu6Z2i44Gu5oOF5aCx44KS5YWl44KM44KLXG52YXIgaW52TWFzayA9IG5ldyBVaW50MzJBcnJheSg0MDk2KTtcblxuLy8gMzJiaXTjga7jg5zjgq/jgrvjg6tJROOBp+ihqOePvuOBleOCjOOCi+OCueODmuODvOOCueOBruOBhuOBoeOAgeacgOS4iuS9jeODk+ODg+ODiOOBr+mAj+aYjuODleODqeOCsOOBqOOBmeOCi1xudmFyIGtUcmFuc3BhcmVudE1hc2sgICAgPSAweDgwMDAwMDAwO1xuLy8gMzJiaXTjga7jg5zjgq/jgrvjg6tJROOBp+ihqOePvuOBleOCjOOCi+OCueODmuODvOOCueOBruOBhuOBoeOAgeaui+OCiuOBrjPjg5Pjg4Pjg4jjga/jg5zjgq/jgrvjg6vjga7mraPpnaLmlrnlkJHjgpLmjIflrprjgZnjgovjg5Xjg6njgrDjgajjgZnjgotcbnZhciBrRmFjZURpcmVjdGlvbk1hc2tcdD0gMHg3MDAwMDAwMDtcbnZhciBrTm9GbGFnc01hc2sgICAgICAgID0gMHgwRkZGRkZGRjtcblxuZnVuY3Rpb24gaXNUcmFuc3BhcmVudCh2KSB7XG4gIHJldHVybiAodiAmIGtUcmFuc3BhcmVudE1hc2spID09PSBrVHJhbnNwYXJlbnRNYXNrO1xufVxuXG5mdW5jdGlvbiByZW1vdmVGbGFncyh2KSB7XG4gIHJldHVybiAodiAmIGtOb0ZsYWdzTWFzayk7XG59XG5cbnJldHVybiBmdW5jdGlvbiBvaFNvR3JlZWR5TWVzaGVyKHZvbHVtZSwgZGltcywgbWVzaGVyRXh0cmFEYXRhKSB7XG4gIHZhciB2ZXJ0aWNlcyA9IFtdLCBmYWNlcyA9IFtdXG4gICAgLCBkaW1zWCA9IGRpbXNbMF1cbiAgICAsIGRpbXNZID0gZGltc1sxXVxuICAgICwgZGltc1hZID0gZGltc1ggKiBkaW1zWTtcblxuICB2YXIgdFZlcnRpY2VzID0gW10sIHRGYWNlcyA9IFtdXG5cbiAgdmFyIHRyYW5zcGFyZW50VHlwZXMgPSBtZXNoZXJFeHRyYURhdGEgPyAobWVzaGVyRXh0cmFEYXRhLnRyYW5zcGFyZW50VHlwZXMgfHwge30pIDoge307XG4gIHZhciBnZXRUeXBlID0gZnVuY3Rpb24odm94ZWxzLCBvZmZzZXQpIHtcbiAgICB2YXIgdHlwZSA9IHZveGVsc1tvZmZzZXRdLnY7XG4gICAgcmV0dXJuIHR5cGUgfCAodHlwZSBpbiB0cmFuc3BhcmVudFR5cGVzID8ga1RyYW5zcGFyZW50TWFzayA6IDApO1xuICB9XG5cblxuICAvL1N3ZWVwIG92ZXIgMy1heGVzXG4gIGZvcih2YXIgZD0wOyBkPDM7ICsrZCkge1xuICAgIHZhciBpLCBqLCBrLCBsLCB3LCBXLCBoLCBuLCBjXG4gICAgICAsIHUgPSAoZCsxKSUzIC8vZCA9PT0gMCA/IDIgOiBkID09PSAxID8gMiA6IDBcbiAgICAgICwgdiA9IChkKzIpJTMgLy9kID09PSAwID8gMSA6IGQgPT09IDEgPyAwIDogMVxuICAgICAgLCB4ID0gWzAsMCwwXVxuICAgICAgLCBxID0gWzAsMCwwXVxuICAgICAgLCBkdSA9IFswLDAsMF1cbiAgICAgICwgZHYgPSBbMCwwLDBdXG4gICAgICAsIGRpbXNEID0gZGltc1tkXVxuICAgICAgLCBkaW1zVSA9IGRpbXNbdV1cbiAgICAgICwgZGltc1YgPSBkaW1zW3ZdXG4gICAgICAsIHFkaW1zWCwgcWRpbXNYWVxuICAgICAgLCB4ZFxuXG4gICAgaWYgKG1hc2subGVuZ3RoIDwgZGltc1UgKiBkaW1zVikge1xuICAgICAgbWFzayA9IG5ldyBVaW50MzJBcnJheShkaW1zVSAqIGRpbXNWKTtcbiAgICAgIGludk1hc2sgPSBuZXcgVWludDMyQXJyYXkoZGltc1UgKiBkaW1zVik7XG4gICAgfVxuXG4gICAgcVtkXSA9ICAxO1xuICAgIHhbZF0gPSAtMTtcblxuICAgIHFkaW1zWCAgPSBkaW1zWCAgKiBxWzFdXG4gICAgcWRpbXNYWSA9IGRpbXNYWSAqIHFbMl1cblxuICAgIC8vIENvbXB1dGUgbWFza1xuICAgIHdoaWxlICh4W2RdIDwgZGltc0QpIHtcbiAgICAgIHhkID0geFtkXVxuICAgICAgbiA9IDA7XG5cbiAgICAgIGZvcih4W3ZdID0gMDsgeFt2XSA8IGRpbXNWOyArK3hbdl0pIHtcbiAgICAgICAgZm9yKHhbdV0gPSAwOyB4W3VdIDwgZGltc1U7ICsreFt1XSwgKytuKSB7XG4gICAgICAgICAgLy8gTW9kaWZpZWQgdG8gcmVhZCB0aHJvdWdoIGdldFR5cGUoKVxuICAgICAgICAgIHZhciBhID0geGQgPj0gMCAgICAgICYmIGdldFR5cGUodm9sdW1lLCB4WzBdICAgICAgKyBkaW1zWCAqIHhbMV0gICAgICAgICAgKyBkaW1zWFkgKiB4WzJdICAgICAgICAgIClcbiAgICAgICAgICAgICwgYiA9IHhkIDwgZGltc0QtMSAmJiBnZXRUeXBlKHZvbHVtZSwgeFswXStxWzBdICsgZGltc1ggKiB4WzFdICsgcWRpbXNYICsgZGltc1hZICogeFsyXSArIHFkaW1zWFkpXG5cbiAgICAgICAgICBpZiAoaXNUcmFuc3BhcmVudChhKSAmJiBpc1RyYW5zcGFyZW50KGIpKSB7XG4gICAgICAgICAgICBpZiAoYSAhPT0gYikge1xuICAgICAgICAgICAgICAvLyDkuKHpnaLjgYzpgI/mmI7jgaDjgYzjgIHjgZ3jgozjgZ7jgozjga7ntKDmnZDjgYzpgZXjgYbjgZ/jgoHjgIHkuKHpnaLjgajjgoLmj4/nlLvjgZnjgotcbiAgICAgICAgICAgICAgbWFza1tuXSA9IGE7XG4gICAgICAgICAgICAgIGludk1hc2tbbl0gPSBiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIC8vIOS4oemdouOBjOmAj+aYjuOBp+OBi+OBpOWQjOOBmOe0oOadkOOBquOBruOBp+OAgeaPj+eUu+OBl+OBquOBhFxuICAgICAgICAgICAgICBtYXNrW25dID0gMDtcbiAgICAgICAgICAgICAgaW52TWFza1tuXSA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChhICYmICghYiB8fCBpc1RyYW5zcGFyZW50KGIpKSkge1xuICAgICAgICAgICAgLy8gYeOBjOS4jemAj+aYjuOBp2LjgYzlrZjlnKjjgZfjgarjgYTjgYvljYrpgI/mmI5cbiAgICAgICAgICAgIG1hc2tbbl0gPSBhO1xuICAgICAgICAgICAgaW52TWFza1tuXSA9IDBcbiAgICAgICAgICB9IGVsc2UgaWYgKGIgJiYgKCFhIHx8IGlzVHJhbnNwYXJlbnQoYSkpKSB7XG4gICAgICAgICAgICAvLyBi44GM5LiN6YCP5piO44GnYeOBjOWtmOWcqOOBl+OBquOBhOOBi+WNiumAj+aYjlxuICAgICAgICAgICAgbWFza1tuXSA9IDBcbiAgICAgICAgICAgIGludk1hc2tbbl0gPSBiO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyDmj4/nlLvjga7lv4XopoHjgarjgZdcbiAgICAgICAgICAgIG1hc2tbbl0gPSAwXG4gICAgICAgICAgICBpbnZNYXNrW25dID0gMFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICArK3hbZF07XG5cbiAgICAgIC8vIEdlbmVyYXRlIG1lc2ggZm9yIG1hc2sgdXNpbmcgbGV4aWNvZ3JhcGhpYyBvcmRlcmluZ1xuICAgICAgZnVuY3Rpb24gZ2VuZXJhdGVNZXNoKG1hc2ssIGRpbXNWLCBkaW1zVSwgdmVydGljZXMsIGZhY2VzLCBjbG9ja3dpc2UpIHtcbiAgICAgICAgY2xvY2t3aXNlID0gY2xvY2t3aXNlID09PSB1bmRlZmluZWQgPyB0cnVlIDogY2xvY2t3aXNlO1xuICAgICAgICB2YXIgbiwgaiwgaSwgYywgdywgaCwgaywgZHUgPSBbMCwwLDBdLCBkdiA9IFswLDAsMF07XG4gICAgICAgIG4gPSAwO1xuICAgICAgICBmb3IgKGo9MDsgaiA8IGRpbXNWOyArK2opIHtcbiAgICAgICAgICBmb3IgKGk9MDsgaSA8IGRpbXNVOyApIHtcbiAgICAgICAgICAgIGMgPSBtYXNrW25dO1xuICAgICAgICAgICAgaWYgKCFjKSB7XG4gICAgICAgICAgICAgIGkrKzsgIG4rKzsgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vQ29tcHV0ZSB3aWR0aFxuICAgICAgICAgICAgdyA9IDE7XG4gICAgICAgICAgICB3aGlsZSAoYyA9PT0gbWFza1tuK3ddICYmIGkrdyA8IGRpbXNVKSB3Kys7XG5cbiAgICAgICAgICAgIC8vQ29tcHV0ZSBoZWlnaHQgKHRoaXMgaXMgc2xpZ2h0bHkgYXdrd2FyZClcbiAgICAgICAgICAgIGZvciAoaD0xOyBqK2ggPCBkaW1zVjsgKytoKSB7XG4gICAgICAgICAgICAgIGsgPSAwO1xuICAgICAgICAgICAgICB3aGlsZSAoayA8IHcgJiYgYyA9PT0gbWFza1tuK2sraCpkaW1zVV0pIGsrK1xuICAgICAgICAgICAgICBpZiAoayA8IHcpIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBZGQgcXVhZFxuICAgICAgICAgICAgLy8gVGhlIGR1L2R2IGFycmF5cyBhcmUgcmV1c2VkL3Jlc2V0XG4gICAgICAgICAgICAvLyBmb3IgZWFjaCBpdGVyYXRpb24uXG4gICAgICAgICAgICBkdVtkXSA9IDA7IGR2W2RdID0gMDtcbiAgICAgICAgICAgIHhbdV0gID0gaTsgIHhbdl0gPSBqO1xuXG4gICAgICAgICAgICBpZiAoY2xvY2t3aXNlKSB7XG4gICAgICAgICAgICAvLyBpZiAoYyA+IDApIHtcbiAgICAgICAgICAgICAgZHZbdl0gPSBoOyBkdlt1XSA9IDA7XG4gICAgICAgICAgICAgIGR1W3VdID0gdzsgZHVbdl0gPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gYyA9IC1jO1xuICAgICAgICAgICAgICBkdVt2XSA9IGg7IGR1W3VdID0gMDtcbiAgICAgICAgICAgICAgZHZbdV0gPSB3OyBkdlt2XSA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciB2ZXJ0ZXhfY291bnRcbiAgICAgICAgICAgIGlmICghaXNUcmFuc3BhcmVudChjKSkge1xuICAgICAgICAgICAgICAvLyDkuI3pgI/mmI7jgarpoILngrnjgajpnaLjgajjgZfjgabjg5Djg4Pjg5XjgqHjgavlgKTjgpLov73liqBcbiAgICAgICAgICAgICAgdmVydGV4X2NvdW50ID0gdmVydGljZXMubGVuZ3RoO1xuICAgICAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt4WzBdLCAgICAgICAgICAgICB4WzFdLCAgICAgICAgICAgICB4WzJdICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICAgIHZlcnRpY2VzLnB1c2goW3hbMF0rZHVbMF0sICAgICAgIHhbMV0rZHVbMV0sICAgICAgIHhbMl0rZHVbMl0gICAgICBdKTtcbiAgICAgICAgICAgICAgdmVydGljZXMucHVzaChbeFswXStkdVswXStkdlswXSwgeFsxXStkdVsxXStkdlsxXSwgeFsyXStkdVsyXStkdlsyXV0pO1xuICAgICAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt4WzBdICAgICAgK2R2WzBdLCB4WzFdICAgICAgK2R2WzFdLCB4WzJdICAgICAgK2R2WzJdXSk7XG4gICAgICAgICAgICAgIGZhY2VzLnB1c2goW3ZlcnRleF9jb3VudCwgdmVydGV4X2NvdW50KzEsIHZlcnRleF9jb3VudCsyLCB2ZXJ0ZXhfY291bnQrMywgY10pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8g6YCP5piO44Gq6aCC54K544Go6Z2i44Go44GX44Gm44OQ44OD44OV44Kh44Gr5YCk44KS6L+95YqgXG4gICAgICAgICAgICAgICB2ZXJ0ZXhfY291bnQgPSB0VmVydGljZXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgdFZlcnRpY2VzLnB1c2goW3hbMF0sICAgICAgICAgICAgIHhbMV0sICAgICAgICAgICAgIHhbMl0gICAgICAgICAgICBdKTtcbiAgICAgICAgICAgICAgIHRWZXJ0aWNlcy5wdXNoKFt4WzBdK2R1WzBdLCAgICAgICB4WzFdK2R1WzFdLCAgICAgICB4WzJdK2R1WzJdICAgICAgXSk7XG4gICAgICAgICAgICAgICB0VmVydGljZXMucHVzaChbeFswXStkdVswXStkdlswXSwgeFsxXStkdVsxXStkdlsxXSwgeFsyXStkdVsyXStkdlsyXV0pO1xuICAgICAgICAgICAgICAgdFZlcnRpY2VzLnB1c2goW3hbMF0gICAgICArZHZbMF0sIHhbMV0gICAgICArZHZbMV0sIHhbMl0gICAgICArZHZbMl1dKTtcbiAgICAgICAgICAgICAgIHRGYWNlcy5wdXNoKFt2ZXJ0ZXhfY291bnQsIHZlcnRleF9jb3VudCsxLCB2ZXJ0ZXhfY291bnQrMiwgdmVydGV4X2NvdW50KzMsIGNdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9aZXJvLW91dCBtYXNrXG4gICAgICAgICAgICBXID0gbiArIHc7XG4gICAgICAgICAgICBmb3IobD0wOyBsPGg7ICsrbCkge1xuICAgICAgICAgICAgICBmb3Ioaz1uOyBrPFc7ICsraykge1xuICAgICAgICAgICAgICAgIG1hc2tbaytsKmRpbXNVXSA9IDA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9JbmNyZW1lbnQgY291bnRlcnMgYW5kIGNvbnRpbnVlXG4gICAgICAgICAgICBpICs9IHc7IG4gKz0gdztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGdlbmVyYXRlTWVzaChtYXNrLCBkaW1zViwgZGltc1UsIHZlcnRpY2VzLCBmYWNlcywgdHJ1ZSlcbiAgICAgIGdlbmVyYXRlTWVzaChpbnZNYXNrLCBkaW1zViwgZGltc1UsIHZlcnRpY2VzLCBmYWNlcywgZmFsc2UpXG4gICAgfVxuICB9XG4gIFxuICAvLyDpgI/mmI7pg6jliIbjgajkuI3pgI/mmI7pg6jliIbjgpLliIbpm6LjgZfjgZ/nirbmhYvjgafov5TjgZlcbiAgcmV0dXJuIHsgdmVydGljZXM6dmVydGljZXMsIHRWZXJ0aWNlczogdFZlcnRpY2VzLCBmYWNlczpmYWNlcywgdEZhY2VzOiB0RmFjZXMgfVxufVxufSkoKTtcblxuaWYoZXhwb3J0cykge1xuICBleHBvcnRzLm1lc2hlciA9IEdyZWVkeU1lc2g7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGluaGVyaXRzXG5cbmZ1bmN0aW9uIGluaGVyaXRzIChjLCBwLCBwcm90bykge1xuICBwcm90byA9IHByb3RvIHx8IHt9XG4gIHZhciBlID0ge31cbiAgO1tjLnByb3RvdHlwZSwgcHJvdG9dLmZvckVhY2goZnVuY3Rpb24gKHMpIHtcbiAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhzKS5mb3JFYWNoKGZ1bmN0aW9uIChrKSB7XG4gICAgICBlW2tdID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihzLCBrKVxuICAgIH0pXG4gIH0pXG4gIGMucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShwLnByb3RvdHlwZSwgZSlcbiAgYy5zdXBlciA9IHBcbn1cblxuLy9mdW5jdGlvbiBDaGlsZCAoKSB7XG4vLyAgQ2hpbGQuc3VwZXIuY2FsbCh0aGlzKVxuLy8gIGNvbnNvbGUuZXJyb3IoW3RoaXNcbi8vICAgICAgICAgICAgICAgICx0aGlzLmNvbnN0cnVjdG9yXG4vLyAgICAgICAgICAgICAgICAsdGhpcy5jb25zdHJ1Y3RvciA9PT0gQ2hpbGRcbi8vICAgICAgICAgICAgICAgICx0aGlzLmNvbnN0cnVjdG9yLnN1cGVyID09PSBQYXJlbnRcbi8vICAgICAgICAgICAgICAgICxPYmplY3QuZ2V0UHJvdG90eXBlT2YodGhpcykgPT09IENoaWxkLnByb3RvdHlwZVxuLy8gICAgICAgICAgICAgICAgLE9iamVjdC5nZXRQcm90b3R5cGVPZihPYmplY3QuZ2V0UHJvdG90eXBlT2YodGhpcykpXG4vLyAgICAgICAgICAgICAgICAgPT09IFBhcmVudC5wcm90b3R5cGVcbi8vICAgICAgICAgICAgICAgICx0aGlzIGluc3RhbmNlb2YgQ2hpbGRcbi8vICAgICAgICAgICAgICAgICx0aGlzIGluc3RhbmNlb2YgUGFyZW50XSlcbi8vfVxuLy9mdW5jdGlvbiBQYXJlbnQgKCkge31cbi8vaW5oZXJpdHMoQ2hpbGQsIFBhcmVudClcbi8vbmV3IENoaWxkXG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iXX0=
