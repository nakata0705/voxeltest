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
    
// contains all forward faces (in terms of scan direction)
var mask = new Int32Array(4096);
// and all backwards faces. needed when there are two transparent blocks
// next to each other.
var invMask = new Int32Array(4096);

// 32bitのボクセルIDで表現されるスペースのうち、最上位ビットは透明フラグとする
var kTransparentMask    = 0x80000000;
// 32bitのボクセルIDで表現されるスペースのうち、残りの3ビットはボクセルの正面方向を指定するフラグとする
var kFaceDirectionMask	= 0x70000000;
var kNoFlagsMask        = 0x0FFFFFFF;

function isTransparent(v) {
  return (v & kTransparentMask) === kTransparentMask;
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
    var type = voxels[offset];
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
      mask = new Int32Array(dimsU * dimsV);
      invMask = new Int32Array(dimsU * dimsV);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIm1haW4uanMiLCJub2RlX21vZHVsZXMvbmRhcnJheS9uZGFycmF5LmpzIiwibm9kZV9tb2R1bGVzL25kYXJyYXkvbm9kZV9tb2R1bGVzL2lvdGEtYXJyYXkvaW90YS5qcyIsIm5vZGVfbW9kdWxlcy9uZGFycmF5L25vZGVfbW9kdWxlcy9pcy1idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdm94ZWxfbmFrYXRhMDcwNS9jaHVua2VyLmpzIiwibm9kZV9tb2R1bGVzL3ZveGVsX25ha2F0YTA3MDUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdm94ZWxfbmFrYXRhMDcwNS9tZXNoZXJzL2N1bGxlZC5qcyIsIm5vZGVfbW9kdWxlcy92b3hlbF9uYWthdGEwNzA1L21lc2hlcnMvZ3JlZWR5LmpzIiwibm9kZV9tb2R1bGVzL3ZveGVsX25ha2F0YTA3MDUvbWVzaGVycy9tb25vdG9uZS5qcyIsIm5vZGVfbW9kdWxlcy92b3hlbF9uYWthdGEwNzA1L21lc2hlcnMvc3R1cGlkLmpzIiwibm9kZV9tb2R1bGVzL3ZveGVsX25ha2F0YTA3MDUvbWVzaGVycy90cmFuc2dyZWVkeS5qcyIsIm5vZGVfbW9kdWxlcy92b3hlbF9uYWthdGEwNzA1L25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0cy5qcyIsIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdlZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qZ2xvYmFsIHZveGVsKi9cbi8qZ2xvYmFsIG5kYXJyYXkqL1xudm94ZWwgPSByZXF1aXJlKCd2b3hlbF9uYWthdGEwNzA1Jyk7XG5uZGFycmF5ID0gcmVxdWlyZSgnbmRhcnJheScpO1xuIiwidmFyIGlvdGEgPSByZXF1aXJlKFwiaW90YS1hcnJheVwiKVxudmFyIGlzQnVmZmVyID0gcmVxdWlyZShcImlzLWJ1ZmZlclwiKVxuXG52YXIgaGFzVHlwZWRBcnJheXMgID0gKCh0eXBlb2YgRmxvYXQ2NEFycmF5KSAhPT0gXCJ1bmRlZmluZWRcIilcblxuZnVuY3Rpb24gY29tcGFyZTFzdChhLCBiKSB7XG4gIHJldHVybiBhWzBdIC0gYlswXVxufVxuXG5mdW5jdGlvbiBvcmRlcigpIHtcbiAgdmFyIHN0cmlkZSA9IHRoaXMuc3RyaWRlXG4gIHZhciB0ZXJtcyA9IG5ldyBBcnJheShzdHJpZGUubGVuZ3RoKVxuICB2YXIgaVxuICBmb3IoaT0wOyBpPHRlcm1zLmxlbmd0aDsgKytpKSB7XG4gICAgdGVybXNbaV0gPSBbTWF0aC5hYnMoc3RyaWRlW2ldKSwgaV1cbiAgfVxuICB0ZXJtcy5zb3J0KGNvbXBhcmUxc3QpXG4gIHZhciByZXN1bHQgPSBuZXcgQXJyYXkodGVybXMubGVuZ3RoKVxuICBmb3IoaT0wOyBpPHJlc3VsdC5sZW5ndGg7ICsraSkge1xuICAgIHJlc3VsdFtpXSA9IHRlcm1zW2ldWzFdXG4gIH1cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5mdW5jdGlvbiBjb21waWxlQ29uc3RydWN0b3IoZHR5cGUsIGRpbWVuc2lvbikge1xuICB2YXIgY2xhc3NOYW1lID0gW1wiVmlld1wiLCBkaW1lbnNpb24sIFwiZFwiLCBkdHlwZV0uam9pbihcIlwiKVxuICBpZihkaW1lbnNpb24gPCAwKSB7XG4gICAgY2xhc3NOYW1lID0gXCJWaWV3X05pbFwiICsgZHR5cGVcbiAgfVxuICB2YXIgdXNlR2V0dGVycyA9IChkdHlwZSA9PT0gXCJnZW5lcmljXCIpXG5cbiAgaWYoZGltZW5zaW9uID09PSAtMSkge1xuICAgIC8vU3BlY2lhbCBjYXNlIGZvciB0cml2aWFsIGFycmF5c1xuICAgIHZhciBjb2RlID1cbiAgICAgIFwiZnVuY3Rpb24gXCIrY2xhc3NOYW1lK1wiKGEpe3RoaXMuZGF0YT1hO307XFxcbnZhciBwcm90bz1cIitjbGFzc05hbWUrXCIucHJvdG90eXBlO1xcXG5wcm90by5kdHlwZT0nXCIrZHR5cGUrXCInO1xcXG5wcm90by5pbmRleD1mdW5jdGlvbigpe3JldHVybiAtMX07XFxcbnByb3RvLnNpemU9MDtcXFxucHJvdG8uZGltZW5zaW9uPS0xO1xcXG5wcm90by5zaGFwZT1wcm90by5zdHJpZGU9cHJvdG8ub3JkZXI9W107XFxcbnByb3RvLmxvPXByb3RvLmhpPXByb3RvLnRyYW5zcG9zZT1wcm90by5zdGVwPVxcXG5mdW5jdGlvbigpe3JldHVybiBuZXcgXCIrY2xhc3NOYW1lK1wiKHRoaXMuZGF0YSk7fTtcXFxucHJvdG8uZ2V0PXByb3RvLnNldD1mdW5jdGlvbigpe307XFxcbnByb3RvLnBpY2s9ZnVuY3Rpb24oKXtyZXR1cm4gbnVsbH07XFxcbnJldHVybiBmdW5jdGlvbiBjb25zdHJ1Y3RfXCIrY2xhc3NOYW1lK1wiKGEpe3JldHVybiBuZXcgXCIrY2xhc3NOYW1lK1wiKGEpO31cIlxuICAgIHZhciBwcm9jZWR1cmUgPSBuZXcgRnVuY3Rpb24oY29kZSlcbiAgICByZXR1cm4gcHJvY2VkdXJlKClcbiAgfSBlbHNlIGlmKGRpbWVuc2lvbiA9PT0gMCkge1xuICAgIC8vU3BlY2lhbCBjYXNlIGZvciAwZCBhcnJheXNcbiAgICB2YXIgY29kZSA9XG4gICAgICBcImZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIihhLGQpIHtcXFxudGhpcy5kYXRhID0gYTtcXFxudGhpcy5vZmZzZXQgPSBkXFxcbn07XFxcbnZhciBwcm90bz1cIitjbGFzc05hbWUrXCIucHJvdG90eXBlO1xcXG5wcm90by5kdHlwZT0nXCIrZHR5cGUrXCInO1xcXG5wcm90by5pbmRleD1mdW5jdGlvbigpe3JldHVybiB0aGlzLm9mZnNldH07XFxcbnByb3RvLmRpbWVuc2lvbj0wO1xcXG5wcm90by5zaXplPTE7XFxcbnByb3RvLnNoYXBlPVxcXG5wcm90by5zdHJpZGU9XFxcbnByb3RvLm9yZGVyPVtdO1xcXG5wcm90by5sbz1cXFxucHJvdG8uaGk9XFxcbnByb3RvLnRyYW5zcG9zZT1cXFxucHJvdG8uc3RlcD1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfY29weSgpIHtcXFxucmV0dXJuIG5ldyBcIitjbGFzc05hbWUrXCIodGhpcy5kYXRhLHRoaXMub2Zmc2V0KVxcXG59O1xcXG5wcm90by5waWNrPWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9waWNrKCl7XFxcbnJldHVybiBUcml2aWFsQXJyYXkodGhpcy5kYXRhKTtcXFxufTtcXFxucHJvdG8udmFsdWVPZj1wcm90by5nZXQ9ZnVuY3Rpb24gXCIrY2xhc3NOYW1lK1wiX2dldCgpe1xcXG5yZXR1cm4gXCIrKHVzZUdldHRlcnMgPyBcInRoaXMuZGF0YS5nZXQodGhpcy5vZmZzZXQpXCIgOiBcInRoaXMuZGF0YVt0aGlzLm9mZnNldF1cIikrXG5cIn07XFxcbnByb3RvLnNldD1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfc2V0KHYpe1xcXG5yZXR1cm4gXCIrKHVzZUdldHRlcnMgPyBcInRoaXMuZGF0YS5zZXQodGhpcy5vZmZzZXQsdilcIiA6IFwidGhpcy5kYXRhW3RoaXMub2Zmc2V0XT12XCIpK1wiXFxcbn07XFxcbnJldHVybiBmdW5jdGlvbiBjb25zdHJ1Y3RfXCIrY2xhc3NOYW1lK1wiKGEsYixjLGQpe3JldHVybiBuZXcgXCIrY2xhc3NOYW1lK1wiKGEsZCl9XCJcbiAgICB2YXIgcHJvY2VkdXJlID0gbmV3IEZ1bmN0aW9uKFwiVHJpdmlhbEFycmF5XCIsIGNvZGUpXG4gICAgcmV0dXJuIHByb2NlZHVyZShDQUNIRURfQ09OU1RSVUNUT1JTW2R0eXBlXVswXSlcbiAgfVxuXG4gIHZhciBjb2RlID0gW1wiJ3VzZSBzdHJpY3QnXCJdXG5cbiAgLy9DcmVhdGUgY29uc3RydWN0b3IgZm9yIHZpZXdcbiAgdmFyIGluZGljZXMgPSBpb3RhKGRpbWVuc2lvbilcbiAgdmFyIGFyZ3MgPSBpbmRpY2VzLm1hcChmdW5jdGlvbihpKSB7IHJldHVybiBcImlcIitpIH0pXG4gIHZhciBpbmRleF9zdHIgPSBcInRoaXMub2Zmc2V0K1wiICsgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgICByZXR1cm4gXCJ0aGlzLnN0cmlkZVtcIiArIGkgKyBcIl0qaVwiICsgaVxuICAgICAgfSkuam9pbihcIitcIilcbiAgdmFyIHNoYXBlQXJnID0gaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwiYlwiK2lcbiAgICB9KS5qb2luKFwiLFwiKVxuICB2YXIgc3RyaWRlQXJnID0gaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwiY1wiK2lcbiAgICB9KS5qb2luKFwiLFwiKVxuICBjb2RlLnB1c2goXG4gICAgXCJmdW5jdGlvbiBcIitjbGFzc05hbWUrXCIoYSxcIiArIHNoYXBlQXJnICsgXCIsXCIgKyBzdHJpZGVBcmcgKyBcIixkKXt0aGlzLmRhdGE9YVwiLFxuICAgICAgXCJ0aGlzLnNoYXBlPVtcIiArIHNoYXBlQXJnICsgXCJdXCIsXG4gICAgICBcInRoaXMuc3RyaWRlPVtcIiArIHN0cmlkZUFyZyArIFwiXVwiLFxuICAgICAgXCJ0aGlzLm9mZnNldD1kfDB9XCIsXG4gICAgXCJ2YXIgcHJvdG89XCIrY2xhc3NOYW1lK1wiLnByb3RvdHlwZVwiLFxuICAgIFwicHJvdG8uZHR5cGU9J1wiK2R0eXBlK1wiJ1wiLFxuICAgIFwicHJvdG8uZGltZW5zaW9uPVwiK2RpbWVuc2lvbilcblxuICAvL3ZpZXcuc2l6ZTpcbiAgY29kZS5wdXNoKFwiT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCdzaXplJyx7Z2V0OmZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9zaXplKCl7XFxcbnJldHVybiBcIitpbmRpY2VzLm1hcChmdW5jdGlvbihpKSB7IHJldHVybiBcInRoaXMuc2hhcGVbXCIraStcIl1cIiB9KS5qb2luKFwiKlwiKSxcblwifX0pXCIpXG5cbiAgLy92aWV3Lm9yZGVyOlxuICBpZihkaW1lbnNpb24gPT09IDEpIHtcbiAgICBjb2RlLnB1c2goXCJwcm90by5vcmRlcj1bMF1cIilcbiAgfSBlbHNlIHtcbiAgICBjb2RlLnB1c2goXCJPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sJ29yZGVyJyx7Z2V0OlwiKVxuICAgIGlmKGRpbWVuc2lvbiA8IDQpIHtcbiAgICAgIGNvZGUucHVzaChcImZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9vcmRlcigpe1wiKVxuICAgICAgaWYoZGltZW5zaW9uID09PSAyKSB7XG4gICAgICAgIGNvZGUucHVzaChcInJldHVybiAoTWF0aC5hYnModGhpcy5zdHJpZGVbMF0pPk1hdGguYWJzKHRoaXMuc3RyaWRlWzFdKSk/WzEsMF06WzAsMV19fSlcIilcbiAgICAgIH0gZWxzZSBpZihkaW1lbnNpb24gPT09IDMpIHtcbiAgICAgICAgY29kZS5wdXNoKFxuXCJ2YXIgczA9TWF0aC5hYnModGhpcy5zdHJpZGVbMF0pLHMxPU1hdGguYWJzKHRoaXMuc3RyaWRlWzFdKSxzMj1NYXRoLmFicyh0aGlzLnN0cmlkZVsyXSk7XFxcbmlmKHMwPnMxKXtcXFxuaWYoczE+czIpe1xcXG5yZXR1cm4gWzIsMSwwXTtcXFxufWVsc2UgaWYoczA+czIpe1xcXG5yZXR1cm4gWzEsMiwwXTtcXFxufWVsc2V7XFxcbnJldHVybiBbMSwwLDJdO1xcXG59XFxcbn1lbHNlIGlmKHMwPnMyKXtcXFxucmV0dXJuIFsyLDAsMV07XFxcbn1lbHNlIGlmKHMyPnMxKXtcXFxucmV0dXJuIFswLDEsMl07XFxcbn1lbHNle1xcXG5yZXR1cm4gWzAsMiwxXTtcXFxufX19KVwiKVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb2RlLnB1c2goXCJPUkRFUn0pXCIpXG4gICAgfVxuICB9XG5cbiAgLy92aWV3LnNldChpMCwgLi4uLCB2KTpcbiAgY29kZS5wdXNoKFxuXCJwcm90by5zZXQ9ZnVuY3Rpb24gXCIrY2xhc3NOYW1lK1wiX3NldChcIithcmdzLmpvaW4oXCIsXCIpK1wiLHYpe1wiKVxuICBpZih1c2VHZXR0ZXJzKSB7XG4gICAgY29kZS5wdXNoKFwicmV0dXJuIHRoaXMuZGF0YS5zZXQoXCIraW5kZXhfc3RyK1wiLHYpfVwiKVxuICB9IGVsc2Uge1xuICAgIGNvZGUucHVzaChcInJldHVybiB0aGlzLmRhdGFbXCIraW5kZXhfc3RyK1wiXT12fVwiKVxuICB9XG5cbiAgLy92aWV3LmdldChpMCwgLi4uKTpcbiAgY29kZS5wdXNoKFwicHJvdG8uZ2V0PWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9nZXQoXCIrYXJncy5qb2luKFwiLFwiKStcIil7XCIpXG4gIGlmKHVzZUdldHRlcnMpIHtcbiAgICBjb2RlLnB1c2goXCJyZXR1cm4gdGhpcy5kYXRhLmdldChcIitpbmRleF9zdHIrXCIpfVwiKVxuICB9IGVsc2Uge1xuICAgIGNvZGUucHVzaChcInJldHVybiB0aGlzLmRhdGFbXCIraW5kZXhfc3RyK1wiXX1cIilcbiAgfVxuXG4gIC8vdmlldy5pbmRleDpcbiAgY29kZS5wdXNoKFxuICAgIFwicHJvdG8uaW5kZXg9ZnVuY3Rpb24gXCIrY2xhc3NOYW1lK1wiX2luZGV4KFwiLCBhcmdzLmpvaW4oKSwgXCIpe3JldHVybiBcIitpbmRleF9zdHIrXCJ9XCIpXG5cbiAgLy92aWV3LmhpKCk6XG4gIGNvZGUucHVzaChcInByb3RvLmhpPWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9oaShcIithcmdzLmpvaW4oXCIsXCIpK1wiKXtyZXR1cm4gbmV3IFwiK2NsYXNzTmFtZStcIih0aGlzLmRhdGEsXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFtcIih0eXBlb2YgaVwiLGksXCIhPT0nbnVtYmVyJ3x8aVwiLGksXCI8MCk/dGhpcy5zaGFwZVtcIiwgaSwgXCJdOmlcIiwgaSxcInwwXCJdLmpvaW4oXCJcIilcbiAgICB9KS5qb2luKFwiLFwiKStcIixcIitcbiAgICBpbmRpY2VzLm1hcChmdW5jdGlvbihpKSB7XG4gICAgICByZXR1cm4gXCJ0aGlzLnN0cmlkZVtcIitpICsgXCJdXCJcbiAgICB9KS5qb2luKFwiLFwiKStcIix0aGlzLm9mZnNldCl9XCIpXG5cbiAgLy92aWV3LmxvKCk6XG4gIHZhciBhX3ZhcnMgPSBpbmRpY2VzLm1hcChmdW5jdGlvbihpKSB7IHJldHVybiBcImFcIitpK1wiPXRoaXMuc2hhcGVbXCIraStcIl1cIiB9KVxuICB2YXIgY192YXJzID0gaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkgeyByZXR1cm4gXCJjXCIraStcIj10aGlzLnN0cmlkZVtcIitpK1wiXVwiIH0pXG4gIGNvZGUucHVzaChcInByb3RvLmxvPWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9sbyhcIithcmdzLmpvaW4oXCIsXCIpK1wiKXt2YXIgYj10aGlzLm9mZnNldCxkPTAsXCIrYV92YXJzLmpvaW4oXCIsXCIpK1wiLFwiK2NfdmFycy5qb2luKFwiLFwiKSlcbiAgZm9yKHZhciBpPTA7IGk8ZGltZW5zaW9uOyArK2kpIHtcbiAgICBjb2RlLnB1c2goXG5cImlmKHR5cGVvZiBpXCIraStcIj09PSdudW1iZXInJiZpXCIraStcIj49MCl7XFxcbmQ9aVwiK2krXCJ8MDtcXFxuYis9Y1wiK2krXCIqZDtcXFxuYVwiK2krXCItPWR9XCIpXG4gIH1cbiAgY29kZS5wdXNoKFwicmV0dXJuIG5ldyBcIitjbGFzc05hbWUrXCIodGhpcy5kYXRhLFwiK1xuICAgIGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBcImFcIitpXG4gICAgfSkuam9pbihcIixcIikrXCIsXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwiY1wiK2lcbiAgICB9KS5qb2luKFwiLFwiKStcIixiKX1cIilcblxuICAvL3ZpZXcuc3RlcCgpOlxuICBjb2RlLnB1c2goXCJwcm90by5zdGVwPWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9zdGVwKFwiK2FyZ3Muam9pbihcIixcIikrXCIpe3ZhciBcIitcbiAgICBpbmRpY2VzLm1hcChmdW5jdGlvbihpKSB7XG4gICAgICByZXR1cm4gXCJhXCIraStcIj10aGlzLnNoYXBlW1wiK2krXCJdXCJcbiAgICB9KS5qb2luKFwiLFwiKStcIixcIitcbiAgICBpbmRpY2VzLm1hcChmdW5jdGlvbihpKSB7XG4gICAgICByZXR1cm4gXCJiXCIraStcIj10aGlzLnN0cmlkZVtcIitpK1wiXVwiXG4gICAgfSkuam9pbihcIixcIikrXCIsYz10aGlzLm9mZnNldCxkPTAsY2VpbD1NYXRoLmNlaWxcIilcbiAgZm9yKHZhciBpPTA7IGk8ZGltZW5zaW9uOyArK2kpIHtcbiAgICBjb2RlLnB1c2goXG5cImlmKHR5cGVvZiBpXCIraStcIj09PSdudW1iZXInKXtcXFxuZD1pXCIraStcInwwO1xcXG5pZihkPDApe1xcXG5jKz1iXCIraStcIiooYVwiK2krXCItMSk7XFxcbmFcIitpK1wiPWNlaWwoLWFcIitpK1wiL2QpXFxcbn1lbHNle1xcXG5hXCIraStcIj1jZWlsKGFcIitpK1wiL2QpXFxcbn1cXFxuYlwiK2krXCIqPWRcXFxufVwiKVxuICB9XG4gIGNvZGUucHVzaChcInJldHVybiBuZXcgXCIrY2xhc3NOYW1lK1wiKHRoaXMuZGF0YSxcIitcbiAgICBpbmRpY2VzLm1hcChmdW5jdGlvbihpKSB7XG4gICAgICByZXR1cm4gXCJhXCIgKyBpXG4gICAgfSkuam9pbihcIixcIikrXCIsXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwiYlwiICsgaVxuICAgIH0pLmpvaW4oXCIsXCIpK1wiLGMpfVwiKVxuXG4gIC8vdmlldy50cmFuc3Bvc2UoKTpcbiAgdmFyIHRTaGFwZSA9IG5ldyBBcnJheShkaW1lbnNpb24pXG4gIHZhciB0U3RyaWRlID0gbmV3IEFycmF5KGRpbWVuc2lvbilcbiAgZm9yKHZhciBpPTA7IGk8ZGltZW5zaW9uOyArK2kpIHtcbiAgICB0U2hhcGVbaV0gPSBcImFbaVwiK2krXCJdXCJcbiAgICB0U3RyaWRlW2ldID0gXCJiW2lcIitpK1wiXVwiXG4gIH1cbiAgY29kZS5wdXNoKFwicHJvdG8udHJhbnNwb3NlPWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl90cmFuc3Bvc2UoXCIrYXJncytcIil7XCIrXG4gICAgYXJncy5tYXAoZnVuY3Rpb24obixpZHgpIHsgcmV0dXJuIG4gKyBcIj0oXCIgKyBuICsgXCI9PT11bmRlZmluZWQ/XCIgKyBpZHggKyBcIjpcIiArIG4gKyBcInwwKVwifSkuam9pbihcIjtcIiksXG4gICAgXCJ2YXIgYT10aGlzLnNoYXBlLGI9dGhpcy5zdHJpZGU7cmV0dXJuIG5ldyBcIitjbGFzc05hbWUrXCIodGhpcy5kYXRhLFwiK3RTaGFwZS5qb2luKFwiLFwiKStcIixcIit0U3RyaWRlLmpvaW4oXCIsXCIpK1wiLHRoaXMub2Zmc2V0KX1cIilcblxuICAvL3ZpZXcucGljaygpOlxuICBjb2RlLnB1c2goXCJwcm90by5waWNrPWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9waWNrKFwiK2FyZ3MrXCIpe3ZhciBhPVtdLGI9W10sYz10aGlzLm9mZnNldFwiKVxuICBmb3IodmFyIGk9MDsgaTxkaW1lbnNpb247ICsraSkge1xuICAgIGNvZGUucHVzaChcImlmKHR5cGVvZiBpXCIraStcIj09PSdudW1iZXInJiZpXCIraStcIj49MCl7Yz0oYyt0aGlzLnN0cmlkZVtcIitpK1wiXSppXCIraStcIil8MH1lbHNle2EucHVzaCh0aGlzLnNoYXBlW1wiK2krXCJdKTtiLnB1c2godGhpcy5zdHJpZGVbXCIraStcIl0pfVwiKVxuICB9XG4gIGNvZGUucHVzaChcInZhciBjdG9yPUNUT1JfTElTVFthLmxlbmd0aCsxXTtyZXR1cm4gY3Rvcih0aGlzLmRhdGEsYSxiLGMpfVwiKVxuXG4gIC8vQWRkIHJldHVybiBzdGF0ZW1lbnRcbiAgY29kZS5wdXNoKFwicmV0dXJuIGZ1bmN0aW9uIGNvbnN0cnVjdF9cIitjbGFzc05hbWUrXCIoZGF0YSxzaGFwZSxzdHJpZGUsb2Zmc2V0KXtyZXR1cm4gbmV3IFwiK2NsYXNzTmFtZStcIihkYXRhLFwiK1xuICAgIGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBcInNoYXBlW1wiK2krXCJdXCJcbiAgICB9KS5qb2luKFwiLFwiKStcIixcIitcbiAgICBpbmRpY2VzLm1hcChmdW5jdGlvbihpKSB7XG4gICAgICByZXR1cm4gXCJzdHJpZGVbXCIraStcIl1cIlxuICAgIH0pLmpvaW4oXCIsXCIpK1wiLG9mZnNldCl9XCIpXG5cbiAgLy9Db21waWxlIHByb2NlZHVyZVxuICB2YXIgcHJvY2VkdXJlID0gbmV3IEZ1bmN0aW9uKFwiQ1RPUl9MSVNUXCIsIFwiT1JERVJcIiwgY29kZS5qb2luKFwiXFxuXCIpKVxuICByZXR1cm4gcHJvY2VkdXJlKENBQ0hFRF9DT05TVFJVQ1RPUlNbZHR5cGVdLCBvcmRlcilcbn1cblxuZnVuY3Rpb24gYXJyYXlEVHlwZShkYXRhKSB7XG4gIGlmKGlzQnVmZmVyKGRhdGEpKSB7XG4gICAgcmV0dXJuIFwiYnVmZmVyXCJcbiAgfVxuICBpZihoYXNUeXBlZEFycmF5cykge1xuICAgIHN3aXRjaChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoZGF0YSkpIHtcbiAgICAgIGNhc2UgXCJbb2JqZWN0IEZsb2F0NjRBcnJheV1cIjpcbiAgICAgICAgcmV0dXJuIFwiZmxvYXQ2NFwiXG4gICAgICBjYXNlIFwiW29iamVjdCBGbG9hdDMyQXJyYXldXCI6XG4gICAgICAgIHJldHVybiBcImZsb2F0MzJcIlxuICAgICAgY2FzZSBcIltvYmplY3QgSW50OEFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJpbnQ4XCJcbiAgICAgIGNhc2UgXCJbb2JqZWN0IEludDE2QXJyYXldXCI6XG4gICAgICAgIHJldHVybiBcImludDE2XCJcbiAgICAgIGNhc2UgXCJbb2JqZWN0IEludDMyQXJyYXldXCI6XG4gICAgICAgIHJldHVybiBcImludDMyXCJcbiAgICAgIGNhc2UgXCJbb2JqZWN0IFVpbnQ4QXJyYXldXCI6XG4gICAgICAgIHJldHVybiBcInVpbnQ4XCJcbiAgICAgIGNhc2UgXCJbb2JqZWN0IFVpbnQxNkFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJ1aW50MTZcIlxuICAgICAgY2FzZSBcIltvYmplY3QgVWludDMyQXJyYXldXCI6XG4gICAgICAgIHJldHVybiBcInVpbnQzMlwiXG4gICAgICBjYXNlIFwiW29iamVjdCBVaW50OENsYW1wZWRBcnJheV1cIjpcbiAgICAgICAgcmV0dXJuIFwidWludDhfY2xhbXBlZFwiXG4gICAgfVxuICB9XG4gIGlmKEFycmF5LmlzQXJyYXkoZGF0YSkpIHtcbiAgICByZXR1cm4gXCJhcnJheVwiXG4gIH1cbiAgcmV0dXJuIFwiZ2VuZXJpY1wiXG59XG5cbnZhciBDQUNIRURfQ09OU1RSVUNUT1JTID0ge1xuICBcImZsb2F0MzJcIjpbXSxcbiAgXCJmbG9hdDY0XCI6W10sXG4gIFwiaW50OFwiOltdLFxuICBcImludDE2XCI6W10sXG4gIFwiaW50MzJcIjpbXSxcbiAgXCJ1aW50OFwiOltdLFxuICBcInVpbnQxNlwiOltdLFxuICBcInVpbnQzMlwiOltdLFxuICBcImFycmF5XCI6W10sXG4gIFwidWludDhfY2xhbXBlZFwiOltdLFxuICBcImJ1ZmZlclwiOltdLFxuICBcImdlbmVyaWNcIjpbXVxufVxuXG47KGZ1bmN0aW9uKCkge1xuICBmb3IodmFyIGlkIGluIENBQ0hFRF9DT05TVFJVQ1RPUlMpIHtcbiAgICBDQUNIRURfQ09OU1RSVUNUT1JTW2lkXS5wdXNoKGNvbXBpbGVDb25zdHJ1Y3RvcihpZCwgLTEpKVxuICB9XG59KTtcblxuZnVuY3Rpb24gd3JhcHBlZE5EQXJyYXlDdG9yKGRhdGEsIHNoYXBlLCBzdHJpZGUsIG9mZnNldCkge1xuICBpZihkYXRhID09PSB1bmRlZmluZWQpIHtcbiAgICB2YXIgY3RvciA9IENBQ0hFRF9DT05TVFJVQ1RPUlMuYXJyYXlbMF1cbiAgICByZXR1cm4gY3RvcihbXSlcbiAgfSBlbHNlIGlmKHR5cGVvZiBkYXRhID09PSBcIm51bWJlclwiKSB7XG4gICAgZGF0YSA9IFtkYXRhXVxuICB9XG4gIGlmKHNoYXBlID09PSB1bmRlZmluZWQpIHtcbiAgICBzaGFwZSA9IFsgZGF0YS5sZW5ndGggXVxuICB9XG4gIHZhciBkID0gc2hhcGUubGVuZ3RoXG4gIGlmKHN0cmlkZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgc3RyaWRlID0gbmV3IEFycmF5KGQpXG4gICAgZm9yKHZhciBpPWQtMSwgc3o9MTsgaT49MDsgLS1pKSB7XG4gICAgICBzdHJpZGVbaV0gPSBzelxuICAgICAgc3ogKj0gc2hhcGVbaV1cbiAgICB9XG4gIH1cbiAgaWYob2Zmc2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICBvZmZzZXQgPSAwXG4gICAgZm9yKHZhciBpPTA7IGk8ZDsgKytpKSB7XG4gICAgICBpZihzdHJpZGVbaV0gPCAwKSB7XG4gICAgICAgIG9mZnNldCAtPSAoc2hhcGVbaV0tMSkqc3RyaWRlW2ldXG4gICAgICB9XG4gICAgfVxuICB9XG4gIHZhciBkdHlwZSA9IGFycmF5RFR5cGUoZGF0YSlcbiAgdmFyIGN0b3JfbGlzdCA9IENBQ0hFRF9DT05TVFJVQ1RPUlNbZHR5cGVdXG4gIHdoaWxlKGN0b3JfbGlzdC5sZW5ndGggPD0gZCsxKSB7XG4gICAgY3Rvcl9saXN0LnB1c2goY29tcGlsZUNvbnN0cnVjdG9yKGR0eXBlLCBjdG9yX2xpc3QubGVuZ3RoLTEpKVxuICB9XG4gIHZhciBjdG9yID0gY3Rvcl9saXN0W2QrMV1cbiAgcmV0dXJuIGN0b3IoZGF0YSwgc2hhcGUsIHN0cmlkZSwgb2Zmc2V0KVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHdyYXBwZWROREFycmF5Q3RvclxuIiwiXCJ1c2Ugc3RyaWN0XCJcblxuZnVuY3Rpb24gaW90YShuKSB7XG4gIHZhciByZXN1bHQgPSBuZXcgQXJyYXkobilcbiAgZm9yKHZhciBpPTA7IGk8bjsgKytpKSB7XG4gICAgcmVzdWx0W2ldID0gaVxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpb3RhIiwiLyoqXG4gKiBEZXRlcm1pbmUgaWYgYW4gb2JqZWN0IGlzIEJ1ZmZlclxuICpcbiAqIEF1dGhvcjogICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogTGljZW5zZTogIE1JVFxuICpcbiAqIGBucG0gaW5zdGFsbCBpcy1idWZmZXJgXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqKSB7XG4gIHJldHVybiAhIShvYmogIT0gbnVsbCAmJlxuICAgIChvYmouX2lzQnVmZmVyIHx8IC8vIEZvciBTYWZhcmkgNS03IChtaXNzaW5nIE9iamVjdC5wcm90b3R5cGUuY29uc3RydWN0b3IpXG4gICAgICAob2JqLmNvbnN0cnVjdG9yICYmXG4gICAgICB0eXBlb2Ygb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyID09PSAnZnVuY3Rpb24nICYmXG4gICAgICBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIob2JqKSlcbiAgICApKVxufVxuIiwidmFyIGV2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpXG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0cykge1xuICByZXR1cm4gbmV3IENodW5rZXIob3B0cylcbn1cblxubW9kdWxlLmV4cG9ydHMuQ2h1bmtlciA9IENodW5rZXJcblxuZnVuY3Rpb24gQ2h1bmtlcihvcHRzKSB7XG4gIHRoaXMuZGlzdGFuY2UgPSBvcHRzLmNodW5rRGlzdGFuY2UgfHwgMFxuICB0aGlzLmNodW5rU2l6ZSA9IG9wdHMuY2h1bmtTaXplIHx8IDMyXG4gIHRoaXMuY2h1bmtQYWQgPSBvcHRzLmNodW5rUGFkICE9PSB1bmRlZmluZWQgPyBvcHRzLmNodW5rUGFkIDogMFxuICB0aGlzLmN1YmVTaXplID0gb3B0cy5jdWJlU2l6ZSB8fCAyNVxuICB0aGlzLmdlbmVyYXRlVm94ZWxDaHVuayA9IG9wdHMuZ2VuZXJhdGVWb3hlbENodW5rXG4gIHRoaXMuY2h1bmtzID0ge31cbiAgdGhpcy5tZXNoZXMgPSB7fVxuICB0aGlzLmJvZGllc0FycmF5ID0ge31cblxuICBpZiAodGhpcy5jaHVua1NpemUgJiB0aGlzLmNodW5rU2l6ZS0xICE9PSAwKVxuICAgIHRocm93IG5ldyBFcnJvcignY2h1bmtTaXplIG11c3QgYmUgYSBwb3dlciBvZiAyJylcbiAgdmFyIGJpdHMgPSAwO1xuICBmb3IgKHZhciBzaXplID0gdGhpcy5jaHVua1NpemU7IHNpemUgPiAwOyBzaXplID4+PSAxKSBiaXRzKys7XG4gIHRoaXMuY2h1bmtCaXRzID0gYml0cyAtIDE7XG4gIHRoaXMuY2h1bmtNYXNrID0gKDEgPDwgdGhpcy5jaHVua0JpdHMpIC0gMVxuICB0aGlzLmNodW5rUGFkSGFsZiA9IHRoaXMuY2h1bmtQYWQgPj4gMVxufVxuXG5pbmhlcml0cyhDaHVua2VyLCBldmVudHMuRXZlbnRFbWl0dGVyKVxuXG5DaHVua2VyLnByb3RvdHlwZS5uZWFyYnlDaHVua3MgPSBmdW5jdGlvbihwb3NpdGlvbiwgZGlzdGFuY2UpIHtcbiAgdmFyIGNwb3MgPSB0aGlzLmNodW5rQXRQb3NpdGlvbihwb3NpdGlvbilcbiAgcmV0dXJuIHRoaXMubmVhcmJ5Q2h1bmtzQ29vcmRpbmF0ZShjcG9zLCBkaXN0YW5jZSk7XG59XG5cbkNodW5rZXIucHJvdG90eXBlLm5lYXJieUNodW5rc0Nvb3JkaW5hdGUgPSBmdW5jdGlvbihjcG9zLCBkaXN0YW5jZSkge1xuICB2YXIgeCA9IGNwb3NbMF1cbiAgdmFyIHkgPSBjcG9zWzFdXG4gIHZhciB6ID0gY3Bvc1syXVxuICB2YXIgZGlzdCA9IGRpc3RhbmNlIHx8IHRoaXMuZGlzdGFuY2VcbiAgdmFyIG5lYXJieSA9IFtdXG4gIGlmIChkaXN0ID09PSAwKSB7XG4gICAgICBuZWFyYnkucHVzaChbeCwgeSwgel0pO1xuICB9XG4gIGVsc2Uge1xuICAgIGZvciAodmFyIGN4ID0gKHggLSBkaXN0KTsgY3ggIT09ICh4ICsgZGlzdCk7ICsrY3gpIHtcbiAgICAgIGZvciAodmFyIGN5ID0gKHkgLSBkaXN0KTsgY3kgIT09ICh5ICsgZGlzdCk7ICsrY3kpIHtcbiAgICAgICAgZm9yICh2YXIgY3ogPSAoeiAtIGRpc3QpOyBjeiAhPT0gKHogKyBkaXN0KTsgKytjeikge1xuICAgICAgICAgIG5lYXJieS5wdXNoKFtjeCwgY3ksIGN6XSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gbmVhcmJ5XG59XG5cbkNodW5rZXIucHJvdG90eXBlLnJlcXVlc3RNaXNzaW5nQ2h1bmtzID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHRoaXMubmVhcmJ5Q2h1bmtzKHBvc2l0aW9uKS5tYXAoZnVuY3Rpb24oY2h1bmspIHtcbiAgICBpZiAoIXNlbGYuY2h1bmtzW2NodW5rLmpvaW4oJ3wnKV0pIHtcbiAgICAgIHNlbGYuZW1pdCgnbWlzc2luZ0NodW5rJywgY2h1bmspXG4gICAgfVxuICB9KVxufVxuXG5DaHVua2VyLnByb3RvdHlwZS5nZXRCb3VuZHMgPSBmdW5jdGlvbih4LCB5LCB6KSB7XG4gIHZhciBiaXRzID0gdGhpcy5jaHVua0JpdHNcbiAgdmFyIGxvdyA9IFt4IDw8IGJpdHMsIHkgPDwgYml0cywgeiA8PCBiaXRzXVxuICB2YXIgaGlnaCA9IFsoeCsxKSA8PCBiaXRzLCAoeSsxKSA8PCBiaXRzLCAoeisxKSA8PCBiaXRzXVxuICByZXR1cm4gW2xvdywgaGlnaF1cbn1cblxuQ2h1bmtlci5wcm90b3R5cGUuZ2VuZXJhdGVDaHVuayA9IGZ1bmN0aW9uKHgsIHksIHopIHtcbiAgdmFyIGNwb3MgPSBbeCwgeSwgel07XG4gIHZhciBja2V5ID0gY3Bvcy5qb2luKCd8JylcbiAgdmFyIGNodW5rID0gdGhpcy5jaHVua3NbY2tleV1cbiAgaWYgKGNodW5rICE9PSB1bmRlZmluZWQpIHJldHVybiBjaHVua1xuICBcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHZhciBib3VuZHMgPSB0aGlzLmdldEJvdW5kcyh4LCB5LCB6KVxuICB2YXIgY2h1bmsgPSB0aGlzLmdlbmVyYXRlVm94ZWxDaHVuayhib3VuZHNbMF0sIGJvdW5kc1sxXSwgeCwgeSwgeilcbiAgY2h1bmsucG9zaXRpb24gPSBjcG9zXG4gIGNodW5rLmVtcHR5ID0gdHJ1ZVxuICB0aGlzLmNodW5rc1tja2V5XSA9IGNodW5rXG4gIHJldHVybiBjaHVua1xufVxuXG5DaHVua2VyLnByb3RvdHlwZS5nZXRDaHVuayA9IGZ1bmN0aW9uKHgsIHksIHopIHtcbiAgdmFyIGNwb3MgPSBbeCwgeSwgel07XG4gIHZhciBja2V5ID0gY3Bvcy5qb2luKCd8JylcbiAgdmFyIGNodW5rID0gdGhpcy5jaHVua3NbY2tleV1cbiAgaWYgKGNodW5rKSByZXR1cm4gY2h1bmtcbiAgZWxzZSByZXR1cm4gdW5kZWZpbmVkICBcbn1cblxuQ2h1bmtlci5wcm90b3R5cGUuZGVsZXRlQ2h1bmsgPSBmdW5jdGlvbih4LCB5LCB6KSB7XG4gIHZhciBjcG9zID0gW3gsIHksIHpdO1xuICB2YXIgY2tleSA9IGNwb3Muam9pbignfCcpXG4gIHZhciBjaHVuayA9IHRoaXMuY2h1bmtzW2NrZXldXG4gIGlmIChjaHVuaykgZGVsZXRlIHRoaXMuY2h1bmtzW2NrZXldOyBcbn1cblxuQ2h1bmtlci5wcm90b3R5cGUuZ2V0TWVzaGVzID0gZnVuY3Rpb24gKHgsIHksIHopIHtcbiAgdmFyIGNwb3MgPSBbeCwgeSwgel07XG4gIHZhciBja2V5ID0gY3Bvcy5qb2luKCd8JylcbiAgdmFyIG1lc2hlcyA9IHRoaXMubWVzaGVzW2NrZXldXG4gIGlmIChtZXNoZXMpIHJldHVybiBtZXNoZXNcbiAgZWxzZSByZXR1cm4gdW5kZWZpbmVkICBcbn1cblxuQ2h1bmtlci5wcm90b3R5cGUuc2V0TWVzaGVzID0gZnVuY3Rpb24gKHgsIHksIHosIG1lc2gpIHtcbiAgdmFyIGNwb3MgPSBbeCwgeSwgel07XG4gIHZhciBja2V5ID0gY3Bvcy5qb2luKCd8JylcbiAgaWYgKG1lc2ggPT09IHVuZGVmaW5lZCkgdGhpcy5tZXNoZXNbY2tleV0gPSB1bmRlZmluZWRcbiAgaWYgKCF0aGlzLm1lc2hlc1tja2V5XSkgdGhpcy5tZXNoZXNbY2tleV0gPSBbbWVzaF1cbiAgZWxzZSB0aGlzLm1lc2hlc1tja2V5XS5wdXNoKG1lc2gpXG59XG5cbkNodW5rZXIucHJvdG90eXBlLmdldEJvZGllcyA9IGZ1bmN0aW9uICh4LCB5LCB6KSB7XG4gIHZhciBjcG9zID0gW3gsIHksIHpdO1xuICB2YXIgY2tleSA9IGNwb3Muam9pbignfCcpXG4gIHZhciBib2RpZXMgPSB0aGlzLmJvZGllc0FycmF5W2NrZXldXG4gIGlmIChib2RpZXMpIHJldHVybiBib2RpZXNcbiAgZWxzZSByZXR1cm4gdW5kZWZpbmVkICBcbn1cblxuQ2h1bmtlci5wcm90b3R5cGUuc2V0Qm9kaWVzID0gZnVuY3Rpb24gKHgsIHksIHosIGJvZGllcykge1xuICB2YXIgY3BvcyA9IFt4LCB5LCB6XTtcbiAgdmFyIGNrZXkgPSBjcG9zLmpvaW4oJ3wnKVxuICB0aGlzLmJvZGllc0FycmF5W2NrZXldID0gYm9kaWVzXG4gIHJldHVybiBib2RpZXM7XG59XG5cbkNodW5rZXIucHJvdG90eXBlLmNodW5rQXRDb29yZGluYXRlcyA9IGZ1bmN0aW9uKHgsIHksIHopIHtcbiAgdmFyIGJpdHMgPSB0aGlzLmNodW5rQml0cztcbiAgdmFyIGN4ID0geCA+PiBiaXRzO1xuICB2YXIgY3kgPSB5ID4+IGJpdHM7XG4gIHZhciBjeiA9IHogPj4gYml0cztcbiAgdmFyIGNodW5rUG9zID0gW2N4LCBjeSwgY3pdO1xuICByZXR1cm4gY2h1bmtQb3M7XG59XG5cbkNodW5rZXIucHJvdG90eXBlLmNodW5rQXRQb3NpdGlvbiA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG4gIHZhciBjdWJlU2l6ZSA9IHRoaXMuY3ViZVNpemU7XG4gIHZhciB4ID0gTWF0aC5mbG9vcihwb3NpdGlvblswXSAvIGN1YmVTaXplKVxuICB2YXIgeSA9IE1hdGguZmxvb3IocG9zaXRpb25bMV0gLyBjdWJlU2l6ZSlcbiAgdmFyIHogPSBNYXRoLmZsb29yKHBvc2l0aW9uWzJdIC8gY3ViZVNpemUpXG4gIHZhciBjaHVua1BvcyA9IHRoaXMuY2h1bmtBdENvb3JkaW5hdGVzKHgsIHksIHopXG4gIHJldHVybiBjaHVua1Bvc1xufTtcblxuQ2h1bmtlci5wcm90b3R5cGUudm94ZWxJbmRleEZyb21Db29yZGluYXRlcyA9IGZ1bmN0aW9uKHgsIHksIHopIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdDaHVua2VyLnByb3RvdHlwZS52b3hlbEluZGV4RnJvbUNvb3JkaW5hdGVzIHJlbW92ZWQsIHVzZSB2b3hlbEF0Q29vcmRpbmF0ZXMnKVxufVxuXG5DaHVua2VyLnByb3RvdHlwZS52b3hlbEF0Q29vcmRpbmF0ZXMgPSBmdW5jdGlvbih4LCB5LCB6LCB2YWwsIGF1dG8pIHtcbiAgdmFyIGNwb3MgPSB0aGlzLmNodW5rQXRDb29yZGluYXRlcyh4LCB5LCB6KVxuICB2YXIgY2tleSA9IGNwb3Muam9pbignfCcpXG4gIHZhciBjaHVuayA9IHRoaXMuY2h1bmtzW2NrZXldXG4gIGlmIChjaHVuayA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyDjgoLjgZfjg4Hjg6Pjg7Pjgq/jgYzlrZjlnKjjgZvjgZrjgIHmlrDopo/jgavku6PlhaXjgZXjgozjgZ/jg5zjgq/jgrvjg6vlgKTjgYww44GC44KL44GE44GvdW5kZWZpbmVk44Gq44KJ44CB6Ieq5YuV55qE44Gr44OB44Oj44Oz44Kv44KS5L2c5oiQ44GZ44KL6Kit5a6a44Gn44KC5paw44GX44GE44OB44Oj44Oz44Kv44Gv5L2c5oiQ44GX44Gq44GEXG4gICAgICBpZiAodmFsID09PSAwKSByZXR1cm4gWzAsIG51bGxdXG4gICAgICBpZiAoYXV0byAmJiB0eXBlb2YgdmFsICE9PSAndW5kZWZpbmVkJykgY2h1bmsgPSB0aGlzLmdlbmVyYXRlQ2h1bmsoY3Bvc1swXSwgY3Bvc1sxXSwgY3Bvc1syXSlcbiAgICAgIGVsc2UgcmV0dXJuIFswLCBudWxsXVxuICB9IFxuICBcbiAgLy8g44OB44Oj44Oz44Kv44Gu5ZGo5Zuy44Gr6Kit5a6a44GX44Gf44OR44OH44Kj44Oz44Kw44KS6ICD5oWu44GX44Gm44Oc44Kv44K744Or5YCk44KS5Luj5YWl44GZ44KLXG4gIHZhciBtYXNrID0gdGhpcy5jaHVua01hc2tcbiAgdmFyIGggPSB0aGlzLmNodW5rUGFkSGFsZlxuICB2YXIgbXggPSB4ICYgbWFza1xuICB2YXIgbXkgPSB5ICYgbWFza1xuICB2YXIgbXogPSB6ICYgbWFza1xuICB2YXIgdiA9IGNodW5rLmdldChteCtoLCBteStoLCBteitoKVxuICBpZiAodHlwZW9mIHZhbCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjaHVuay5zZXQobXgraCwgbXkraCwgbXoraCwgdmFsKVxuICAgIFxuICAgIC8vIFtUb0RvXSDjgZPjga7jgrPjg7zjg4njga/jg4Hjg6Pjg7Pjgq/jgpLjgq/jg6njgrnljJbjgZfjgZ/jgonjgIHlhoXpg6jlh6bnkIbjgajjgZfjgablj5bjgorovrzjgoBcbiAgICBpZiAodmFsICE9PSAweDAwKSBjaHVuay5lbXB0eSA9IGZhbHNlXG4gIH1cbiAgcmV0dXJuIFt2LCBjaHVua11cbn1cblxuQ2h1bmtlci5wcm90b3R5cGUudm94ZWxBdFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zLCB2YWwsIGF1dG8pIHtcbiAgdmFyIGN1YmVTaXplID0gdGhpcy5jdWJlU2l6ZTtcbiAgdmFyIHggPSBNYXRoLmZsb29yKHBvc1swXSAvIGN1YmVTaXplKVxuICB2YXIgeSA9IE1hdGguZmxvb3IocG9zWzFdIC8gY3ViZVNpemUpXG4gIHZhciB6ID0gTWF0aC5mbG9vcihwb3NbMl0gLyBjdWJlU2l6ZSlcbiAgdmFyIHYgPSB0aGlzLnZveGVsQXRDb29yZGluYXRlcyh4LCB5LCB6LCB2YWwsIGF1dG8pXG4gIHJldHVybiB2O1xufVxuXG4iLCJ2YXIgY2h1bmtlciA9IHJlcXVpcmUoJy4vY2h1bmtlcicpXG52YXIgbmRhcnJheSA9IHJlcXVpcmUoJ25kYXJyYXknKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdHMpIHtcbiAgaWYgKCFvcHRzLmdlbmVyYXRlVm94ZWxDaHVuaykgb3B0cy5nZW5lcmF0ZVZveGVsQ2h1bmsgPSBmdW5jdGlvbihsb3csIGhpZ2gpIHtcblx0cmV0dXJuIGdlbmVyYXRlMzIobG93LCBoaWdoLCBmdW5jdGlvbihpLCBqLCBrKSB7IHJldHVybiAwOyB9KVxuICB9XG4gIHJldHVybiBjaHVua2VyKG9wdHMpXG59XG5cbm1vZHVsZS5leHBvcnRzLm1lc2hlcnMgPSB7XG4gIGN1bGxlZDogcmVxdWlyZSgnLi9tZXNoZXJzL2N1bGxlZCcpLm1lc2hlcixcbiAgZ3JlZWR5OiByZXF1aXJlKCcuL21lc2hlcnMvZ3JlZWR5JykubWVzaGVyLFxuICB0cmFuc2dyZWVkeTogcmVxdWlyZSgnLi9tZXNoZXJzL3RyYW5zZ3JlZWR5JykubWVzaGVyLFxuICBtb25vdG9uZTogcmVxdWlyZSgnLi9tZXNoZXJzL21vbm90b25lJykubWVzaGVyLFxuICBzdHVwaWQ6IHJlcXVpcmUoJy4vbWVzaGVycy9zdHVwaWQnKS5tZXNoZXJcbn1cblxubW9kdWxlLmV4cG9ydHMuQ2h1bmtlciA9IGNodW5rZXIuQ2h1bmtlclxubW9kdWxlLmV4cG9ydHMuZ2VvbWV0cnkgPSB7fVxubW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yID0ge31cbm1vZHVsZS5leHBvcnRzLmdlbmVyYXRlMzIgPSBnZW5lcmF0ZTMyXG5cbmZ1bmN0aW9uIGdlbmVyYXRlMzIobG8sIGhpLCBmbikge1xuICAvLyBUbyBmaXggdGhlIGRpc3BsYXkgZ2Fwcywgd2UgbmVlZCB0byBwYWQgdGhlIGJvdW5kc1xuICBsb1swXS0tXG4gIGxvWzFdLS1cbiAgbG9bMl0tLVxuICBoaVswXSsrXG4gIGhpWzFdKytcbiAgaGlbMl0rK1xuICB2YXIgZGltcyA9IFtoaVsyXS1sb1syXSwgaGlbMV0tbG9bMV0sIGhpWzBdLWxvWzBdXVxuICB2YXIgZGF0YSA9IG5kYXJyYXkobmV3IFVpbnQzMkFycmF5KGRpbXNbMl0gKiBkaW1zWzFdICogZGltc1swXSksIGRpbXMpXG4gIGZvciAodmFyIGsgPSBsb1syXTsgayA8IGhpWzJdOyBrKyspXG4gICAgZm9yICh2YXIgaiA9IGxvWzFdOyBqIDwgaGlbMV07IGorKylcbiAgICAgIGZvcih2YXIgaSA9IGxvWzBdOyBpIDwgaGlbMF07IGkrKykge1xuICAgICAgICBkYXRhLnNldChrLWxvWzJdLCBqLWxvWzFdLCBpLWxvWzBdLCBmbihpLCBqLCBrKSlcbiAgICAgIH1cbiAgcmV0dXJuIGRhdGFcbn1cblxuLy8gc2hhcGUgYW5kIHRlcnJhaW4gZ2VuZXJhdG9yIGZ1bmN0aW9uc1xubW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydTcGhlcmUnXSA9IGZ1bmN0aW9uKGksaixrKSB7XG4gIHJldHVybiBpKmkraipqK2sqayA8PSAxNioxNiA/IDEgOiAwXG59XG5cbm1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnTm9pc2UnXSA9IGZ1bmN0aW9uKGksaixrKSB7XG4gIHJldHVybiBNYXRoLnJhbmRvbSgpIDwgMC4xID8gTWF0aC5yYW5kb20oKSAqIDB4ZmZmZmZmIDogMDtcbn1cblxubW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydEZW5zZSBOb2lzZSddID0gZnVuY3Rpb24oaSxqLGspIHtcbiAgcmV0dXJuIE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIDB4ZmZmZmZmKTtcbn1cblxubW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydDaGVja2VyJ10gPSBmdW5jdGlvbihpLGosaykge1xuICByZXR1cm4gISEoKGkraitrKSYxKSA/ICgoKGleal5rKSYyKSA/IDEgOiAweGZmZmZmZikgOiAwO1xufVxuXG5tb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ0hpbGwnXSA9IGZ1bmN0aW9uKGksaixrKSB7XG4gIHJldHVybiBqIDw9IDE2ICogTWF0aC5leHAoLShpKmkgKyBrKmspIC8gNjQpID8gMSA6IDA7XG59XG5cbm1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnVmFsbGV5J10gPSBmdW5jdGlvbihpLGosaykge1xuICByZXR1cm4gaiA8PSAoaSppICsgayprKSAqIDMxIC8gKDMyKjMyKjIpICsgMSA/IDEgKyAoMTw8MTUpIDogMDtcbn1cblxubW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydIaWxseSBUZXJyYWluJ10gPSBmdW5jdGlvbihpLGosaykge1xuICB2YXIgaDAgPSAzLjAgKiBNYXRoLnNpbihNYXRoLlBJICogaSAvIDEyLjAgLSBNYXRoLlBJICogayAqIDAuMSkgKyAyNzsgICAgXG4gIGlmKGogPiBoMCsxKSB7XG4gICAgcmV0dXJuIDA7XG4gIH1cbiAgaWYoaDAgPD0gaikge1xuICAgIHJldHVybiAxO1xuICB9XG4gIHZhciBoMSA9IDIuMCAqIE1hdGguc2luKE1hdGguUEkgKiBpICogMC4yNSAtIE1hdGguUEkgKiBrICogMC4zKSArIDIwO1xuICBpZihoMSA8PSBqKSB7XG4gICAgcmV0dXJuIDI7XG4gIH1cbiAgaWYoMiA8IGopIHtcbiAgICByZXR1cm4gTWF0aC5yYW5kb20oKSA8IDAuMSA/IDB4MjIyMjIyIDogMHhhYWFhYWE7XG4gIH1cbiAgcmV0dXJuIDM7XG59XG5cbm1vZHVsZS5leHBvcnRzLnNjYWxlID0gZnVuY3Rpb24gKCB4LCBmcm9tTG93LCBmcm9tSGlnaCwgdG9Mb3csIHRvSGlnaCApIHtcbiAgcmV0dXJuICggeCAtIGZyb21Mb3cgKSAqICggdG9IaWdoIC0gdG9Mb3cgKSAvICggZnJvbUhpZ2ggLSBmcm9tTG93ICkgKyB0b0xvd1xufVxuXG4vLyBjb252ZW5pZW5jZSBmdW5jdGlvbiB0aGF0IHVzZXMgdGhlIGFib3ZlIGZ1bmN0aW9ucyB0byBwcmViYWtlIHNvbWUgc2ltcGxlIHZveGVsIGdlb21ldHJpZXNcbm1vZHVsZS5leHBvcnRzLmdlbmVyYXRlRXhhbXBsZXMgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHtcbiAgICAnU3BoZXJlJzogZ2VuZXJhdGUzMihbLTE2LC0xNiwtMTZdLCBbMTYsMTYsMTZdLCBtb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ1NwaGVyZSddKSxcbiAgICAnTm9pc2UnOiBnZW5lcmF0ZTMyKFswLDAsMF0sIFsxNiwxNiwxNl0sIG1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnTm9pc2UnXSksXG4gICAgJ0RlbnNlIE5vaXNlJzogZ2VuZXJhdGUzMihbMCwwLDBdLCBbMTYsMTYsMTZdLCBtb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ0RlbnNlIE5vaXNlJ10pLFxuICAgICdDaGVja2VyJzogZ2VuZXJhdGUzMihbMCwwLDBdLCBbOCw4LDhdLCBtb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ0NoZWNrZXInXSksXG4gICAgJ0hpbGwnOiBnZW5lcmF0ZTMyKFstMTYsIDAsIC0xNl0sIFsxNiwxNiwxNl0sIG1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnSGlsbCddKSxcbiAgICAnVmFsbGV5JzogZ2VuZXJhdGUzMihbMCwwLDBdLCBbMzIsMzIsMzJdLCBtb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ1ZhbGxleSddKSxcbiAgICAnSGlsbHkgVGVycmFpbic6IGdlbmVyYXRlMzIoWzAsIDAsIDBdLCBbMzIsMzIsMzJdLCBtb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ0hpbGx5IFRlcnJhaW4nXSlcbiAgfVxufVxuXG4iLCIvL05haXZlIG1lc2hpbmcgKHdpdGggZmFjZSBjdWxsaW5nKVxuZnVuY3Rpb24gQ3VsbGVkTWVzaCh2b2x1bWUsIGRpbXMpIHtcbiAgLy9QcmVjYWxjdWxhdGUgZGlyZWN0aW9uIHZlY3RvcnMgZm9yIGNvbnZlbmllbmNlXG4gIHZhciBkaXIgPSBuZXcgQXJyYXkoMyk7XG4gIGZvcih2YXIgaT0wOyBpPDM7ICsraSkge1xuICAgIGRpcltpXSA9IFtbMCwwLDBdLCBbMCwwLDBdXTtcbiAgICBkaXJbaV1bMF1bKGkrMSklM10gPSAxO1xuICAgIGRpcltpXVsxXVsoaSsyKSUzXSA9IDE7XG4gIH1cbiAgLy9NYXJjaCBvdmVyIHRoZSB2b2x1bWVcbiAgdmFyIHZlcnRpY2VzID0gW11cbiAgICAsIGZhY2VzID0gW11cbiAgICAsIHggPSBbMCwwLDBdXG4gICAgLCBCID0gW1tmYWxzZSx0cnVlXSAgICAvL0luY3JlbWVudGFsbHkgdXBkYXRlIGJvdW5kcyAodGhpcyBpcyBhIGJpdCB1Z2x5KVxuICAgICAgICAgICxbZmFsc2UsdHJ1ZV1cbiAgICAgICAgICAsW2ZhbHNlLHRydWVdXVxuICAgICwgbiA9IC1kaW1zWzBdKmRpbXNbMV07XG4gIGZvciggICAgICAgICAgIEJbMl09W2ZhbHNlLHRydWVdLHhbMl09LTE7IHhbMl08ZGltc1syXTsgQlsyXT1bdHJ1ZSwoKyt4WzJdPGRpbXNbMl0tMSldKVxuICBmb3Iobi09ZGltc1swXSxCWzFdPVtmYWxzZSx0cnVlXSx4WzFdPS0xOyB4WzFdPGRpbXNbMV07IEJbMV09W3RydWUsKCsreFsxXTxkaW1zWzFdLTEpXSlcbiAgZm9yKG4tPTEsICAgICAgQlswXT1bZmFsc2UsdHJ1ZV0seFswXT0tMTsgeFswXTxkaW1zWzBdOyBCWzBdPVt0cnVlLCgrK3hbMF08ZGltc1swXS0xKV0sICsrbikge1xuICAgIC8vUmVhZCBjdXJyZW50IHZveGVsIGFuZCAzIG5laWdoYm9yaW5nIHZveGVscyB1c2luZyBib3VuZHMgY2hlY2sgcmVzdWx0c1xuICAgIHZhciBwID0gICAoQlswXVswXSAmJiBCWzFdWzBdICYmIEJbMl1bMF0pID8gdm9sdW1lW25dICAgICAgICAgICAgICAgICA6IDBcbiAgICAgICwgYiA9IFsgKEJbMF1bMV0gJiYgQlsxXVswXSAmJiBCWzJdWzBdKSA/IHZvbHVtZVtuKzFdICAgICAgICAgICAgICAgOiAwXG4gICAgICAgICAgICAsIChCWzBdWzBdICYmIEJbMV1bMV0gJiYgQlsyXVswXSkgPyB2b2x1bWVbbitkaW1zWzBdXSAgICAgICAgIDogMFxuICAgICAgICAgICAgLCAoQlswXVswXSAmJiBCWzFdWzBdICYmIEJbMl1bMV0pID8gdm9sdW1lW24rZGltc1swXSpkaW1zWzFdXSA6IDBcbiAgICAgICAgICBdO1xuICAgIC8vR2VuZXJhdGUgZmFjZXNcbiAgICBmb3IodmFyIGQ9MDsgZDwzOyArK2QpXG4gICAgaWYoKCEhcCkgIT09ICghIWJbZF0pKSB7XG4gICAgICB2YXIgcyA9ICFwID8gMSA6IDA7XG4gICAgICB2YXIgdCA9IFt4WzBdLHhbMV0seFsyXV1cbiAgICAgICAgLCB1ID0gZGlyW2RdW3NdXG4gICAgICAgICwgdiA9IGRpcltkXVtzXjFdO1xuICAgICAgKyt0W2RdO1xuICAgICAgXG4gICAgICB2YXIgdmVydGV4X2NvdW50ID0gdmVydGljZXMubGVuZ3RoO1xuICAgICAgdmVydGljZXMucHVzaChbdFswXSwgICAgICAgICAgIHRbMV0sICAgICAgICAgICB0WzJdICAgICAgICAgIF0pO1xuICAgICAgdmVydGljZXMucHVzaChbdFswXSt1WzBdLCAgICAgIHRbMV0rdVsxXSwgICAgICB0WzJdK3VbMl0gICAgIF0pO1xuICAgICAgdmVydGljZXMucHVzaChbdFswXSt1WzBdK3ZbMF0sIHRbMV0rdVsxXSt2WzFdLCB0WzJdK3VbMl0rdlsyXV0pO1xuICAgICAgdmVydGljZXMucHVzaChbdFswXSAgICAgK3ZbMF0sIHRbMV0gICAgICt2WzFdLCB0WzJdICAgICArdlsyXV0pO1xuICAgICAgZmFjZXMucHVzaChbdmVydGV4X2NvdW50LCB2ZXJ0ZXhfY291bnQrMSwgdmVydGV4X2NvdW50KzIsIHZlcnRleF9jb3VudCszLCBzID8gYltkXSA6IHBdKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHsgdmVydGljZXM6dmVydGljZXMsIGZhY2VzOmZhY2VzIH07XG59XG5cblxuaWYoZXhwb3J0cykge1xuICBleHBvcnRzLm1lc2hlciA9IEN1bGxlZE1lc2g7XG59XG4iLCJ2YXIgR3JlZWR5TWVzaCA9IChmdW5jdGlvbigpIHtcbi8vQ2FjaGUgYnVmZmVyIGludGVybmFsbHlcbnZhciBtYXNrID0gbmV3IFVpbnQzMkFycmF5KDQwOTYpO1xudmFyIG1hc2tEaXJlY3Rpb24gPSBuZXcgVWludDMyQXJyYXkoNDA5Nik7XG5cbnJldHVybiBmdW5jdGlvbih2b2x1bWUsIGRpbXMpIHtcbiAgdmFyIHZlcnRpY2VzID0gW10sIGZhY2VzID0gW11cbiAgICAsIGRpbXNYID0gZGltc1swXVxuICAgICwgZGltc1kgPSBkaW1zWzFdXG4gICAgLCBkaW1zWFkgPSBkaW1zWCAqIGRpbXNZO1xuXG4gIC8vU3dlZXAgb3ZlciAzLWF4ZXNcbiAgZm9yKHZhciBkPTA7IGQ8MzsgKytkKSB7XG4gICAgdmFyIGksIGosIGssIGwsIHcsIFcsIGgsIG4sIGNcbiAgICAgICwgdSA9IChkKzEpJTNcbiAgICAgICwgdiA9IChkKzIpJTNcbiAgICAgICwgeCA9IFswLDAsMF1cbiAgICAgICwgcSA9IFswLDAsMF1cbiAgICAgICwgZHUgPSBbMCwwLDBdXG4gICAgICAsIGR2ID0gWzAsMCwwXVxuICAgICAgLCBkaW1zRCA9IGRpbXNbZF1cbiAgICAgICwgZGltc1UgPSBkaW1zW3VdXG4gICAgICAsIGRpbXNWID0gZGltc1t2XVxuICAgICAgLCBxZGltc1gsIHFkaW1zWFlcbiAgICAgICwgeGRcblxuICAgIGlmIChtYXNrLmxlbmd0aCA8IGRpbXNVICogZGltc1YpIHtcbiAgICAgIG1hc2sgPSBuZXcgVWludDMyQXJyYXkoZGltc1UgKiBkaW1zVik7XG4gICAgICBtYXNrRGlyZWN0aW9uID0gbmV3IFVpbnQzMkFycmF5KGRpbXNVICogZGltc1YpO1xuICAgIH1cblxuICAgIHFbZF0gPSAgMTtcbiAgICB4W2RdID0gLTE7XG5cbiAgICBxZGltc1ggID0gZGltc1ggICogcVsxXVxuICAgIHFkaW1zWFkgPSBkaW1zWFkgKiBxWzJdXG5cbiAgICAvLyBDb21wdXRlIG1hc2tcbiAgICB3aGlsZSAoeFtkXSA8IGRpbXNEKSB7XG4gICAgICB4ZCA9IHhbZF1cbiAgICAgIG4gPSAwO1xuXG4gICAgICBmb3IoeFt2XSA9IDA7IHhbdl0gPCBkaW1zVjsgKyt4W3ZdKSB7XG4gICAgICAgIGZvcih4W3VdID0gMDsgeFt1XSA8IGRpbXNVOyArK3hbdV0sICsrbikge1xuICAgICAgICAgIHZhciBhID0geGQgPj0gMCAgICAgICYmIHZvbHVtZVt4WzBdICAgICAgKyBkaW1zWCAqIHhbMV0gICAgICAgICAgKyBkaW1zWFkgKiB4WzJdICAgICAgICAgIF1cbiAgICAgICAgICAgICwgYiA9IHhkIDwgZGltc0QtMSAmJiB2b2x1bWVbeFswXStxWzBdICsgZGltc1ggKiB4WzFdICsgcWRpbXNYICsgZGltc1hZICogeFsyXSArIHFkaW1zWFldXG4gICAgICAgICAgaWYgKGEgPyBiIDogIWIpIHtcbiAgICAgICAgICAgIG1hc2tbbl0gPSAwOyBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbWFza1tuXSA9IGEgPyBhIDogYjtcbiAgICAgICAgICBtYXNrRGlyZWN0aW9uW25dID0gYSA/IDEgOiAtMTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICArK3hbZF07XG5cbiAgICAgIC8vIEdlbmVyYXRlIG1lc2ggZm9yIG1hc2sgdXNpbmcgbGV4aWNvZ3JhcGhpYyBvcmRlcmluZ1xuICAgICAgbiA9IDA7XG4gICAgICBmb3IgKGo9MDsgaiA8IGRpbXNWOyArK2opIHtcbiAgICAgICAgZm9yIChpPTA7IGkgPCBkaW1zVTsgKSB7XG4gICAgICAgICAgYyA9IG1hc2tbbl0gKiBtYXNrRGlyZWN0aW9uW25dO1xuICAgICAgICAgIGlmICghYykge1xuICAgICAgICAgICAgaSsrOyAgbisrOyBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvL0NvbXB1dGUgd2lkdGhcbiAgICAgICAgICB3ID0gMTtcbiAgICAgICAgICB3aGlsZSAoYyA9PT0gbWFza1tuK3ddICogbWFza0RpcmVjdGlvbltuK3ddICYmIGkrdyA8IGRpbXNVKSB3Kys7XG5cbiAgICAgICAgICAvL0NvbXB1dGUgaGVpZ2h0ICh0aGlzIGlzIHNsaWdodGx5IGF3a3dhcmQpXG4gICAgICAgICAgZm9yIChoPTE7IGoraCA8IGRpbXNWOyArK2gpIHtcbiAgICAgICAgICAgIGsgPSAwO1xuICAgICAgICAgICAgd2hpbGUgKGsgPCB3ICYmIGMgPT09IG1hc2tbbitrK2gqZGltc1VdICogbWFza0RpcmVjdGlvbltuK2sraCpkaW1zVV0pIGsrK1xuICAgICAgICAgICAgaWYgKGsgPCB3KSBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBBZGQgcXVhZFxuICAgICAgICAgIC8vIFRoZSBkdS9kdiBhcnJheXMgYXJlIHJldXNlZC9yZXNldFxuICAgICAgICAgIC8vIGZvciBlYWNoIGl0ZXJhdGlvbi5cbiAgICAgICAgICBkdVtkXSA9IDA7IGR2W2RdID0gMDtcbiAgICAgICAgICB4W3VdICA9IGk7ICB4W3ZdID0gajtcblxuICAgICAgICAgIGlmIChjID4gMCkge1xuICAgICAgICAgICAgZHZbdl0gPSBoOyBkdlt1XSA9IDA7XG4gICAgICAgICAgICBkdVt1XSA9IHc7IGR1W3ZdID0gMDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYyA9IC1jO1xuICAgICAgICAgICAgZHVbdl0gPSBoOyBkdVt1XSA9IDA7XG4gICAgICAgICAgICBkdlt1XSA9IHc7IGR2W3ZdID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIHZlcnRleF9jb3VudCA9IHZlcnRpY2VzLmxlbmd0aDtcbiAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt4WzBdLCAgICAgICAgICAgICB4WzFdLCAgICAgICAgICAgICB4WzJdICAgICAgICAgICAgXSk7XG4gICAgICAgICAgdmVydGljZXMucHVzaChbeFswXStkdVswXSwgICAgICAgeFsxXStkdVsxXSwgICAgICAgeFsyXStkdVsyXSAgICAgIF0pO1xuICAgICAgICAgIHZlcnRpY2VzLnB1c2goW3hbMF0rZHVbMF0rZHZbMF0sIHhbMV0rZHVbMV0rZHZbMV0sIHhbMl0rZHVbMl0rZHZbMl1dKTtcbiAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt4WzBdICAgICAgK2R2WzBdLCB4WzFdICAgICAgK2R2WzFdLCB4WzJdICAgICAgK2R2WzJdXSk7XG4gICAgICAgICAgZmFjZXMucHVzaChbdmVydGV4X2NvdW50LCB2ZXJ0ZXhfY291bnQrMSwgdmVydGV4X2NvdW50KzIsIHZlcnRleF9jb3VudCszLCBjXSk7XG5cbiAgICAgICAgICAvL1plcm8tb3V0IG1hc2tcbiAgICAgICAgICBXID0gbiArIHc7XG4gICAgICAgICAgZm9yKGw9MDsgbDxoOyArK2wpIHtcbiAgICAgICAgICAgIGZvcihrPW47IGs8VzsgKytrKSB7XG4gICAgICAgICAgICAgIG1hc2tbaytsKmRpbXNVXSA9IDA7XG4gICAgICAgICAgICAgIG1hc2tEaXJlY3Rpb25baytsKmRpbXNVXSA9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy9JbmNyZW1lbnQgY291bnRlcnMgYW5kIGNvbnRpbnVlXG4gICAgICAgICAgaSArPSB3OyBuICs9IHc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHsgdmVydGljZXM6dmVydGljZXMsIGZhY2VzOmZhY2VzIH07XG59XG59KSgpO1xuXG5pZihleHBvcnRzKSB7XG4gIGV4cG9ydHMubWVzaGVyID0gR3JlZWR5TWVzaDtcbn1cbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgTW9ub3RvbmVNZXNoID0gKGZ1bmN0aW9uKCl7XG5cbmZ1bmN0aW9uIE1vbm90b25lUG9seWdvbihjLCB2LCB1bCwgdXIpIHtcbiAgdGhpcy5jb2xvciAgPSBjO1xuICB0aGlzLmxlZnQgICA9IFtbdWwsIHZdXTtcbiAgdGhpcy5yaWdodCAgPSBbW3VyLCB2XV07XG59O1xuXG5Nb25vdG9uZVBvbHlnb24ucHJvdG90eXBlLmNsb3NlX29mZiA9IGZ1bmN0aW9uKHYpIHtcbiAgdGhpcy5sZWZ0LnB1c2goWyB0aGlzLmxlZnRbdGhpcy5sZWZ0Lmxlbmd0aC0xXVswXSwgdiBdKTtcbiAgdGhpcy5yaWdodC5wdXNoKFsgdGhpcy5yaWdodFt0aGlzLnJpZ2h0Lmxlbmd0aC0xXVswXSwgdiBdKTtcbn07XG5cbk1vbm90b25lUG9seWdvbi5wcm90b3R5cGUubWVyZ2VfcnVuID0gZnVuY3Rpb24odiwgdV9sLCB1X3IpIHtcbiAgdmFyIGwgPSB0aGlzLmxlZnRbdGhpcy5sZWZ0Lmxlbmd0aC0xXVswXVxuICAgICwgciA9IHRoaXMucmlnaHRbdGhpcy5yaWdodC5sZW5ndGgtMV1bMF07IFxuICBpZihsICE9PSB1X2wpIHtcbiAgICB0aGlzLmxlZnQucHVzaChbIGwsIHYgXSk7XG4gICAgdGhpcy5sZWZ0LnB1c2goWyB1X2wsIHYgXSk7XG4gIH1cbiAgaWYociAhPT0gdV9yKSB7XG4gICAgdGhpcy5yaWdodC5wdXNoKFsgciwgdiBdKTtcbiAgICB0aGlzLnJpZ2h0LnB1c2goWyB1X3IsIHYgXSk7XG4gIH1cbn07XG5cblxucmV0dXJuIGZ1bmN0aW9uKHZvbHVtZSwgZGltcykge1xuICBmdW5jdGlvbiBmKGksaixrKSB7XG4gICAgcmV0dXJuIHZvbHVtZVtpICsgZGltc1swXSAqIChqICsgZGltc1sxXSAqIGspXTtcbiAgfVxuICAvL1N3ZWVwIG92ZXIgMy1heGVzXG4gIHZhciB2ZXJ0aWNlcyA9IFtdLCBmYWNlcyA9IFtdO1xuICBmb3IodmFyIGQ9MDsgZDwzOyArK2QpIHtcbiAgICB2YXIgaSwgaiwga1xuICAgICAgLCB1ID0gKGQrMSklMyAgIC8vdSBhbmQgdiBhcmUgb3J0aG9nb25hbCBkaXJlY3Rpb25zIHRvIGRcbiAgICAgICwgdiA9IChkKzIpJTNcbiAgICAgICwgeCA9IG5ldyBJbnQzMkFycmF5KDMpXG4gICAgICAsIHEgPSBuZXcgSW50MzJBcnJheSgzKVxuICAgICAgLCBydW5zID0gbmV3IEludDMyQXJyYXkoMiAqIChkaW1zW3VdKzEpKVxuICAgICAgLCBmcm9udGllciA9IG5ldyBJbnQzMkFycmF5KGRpbXNbdV0pICAvL0Zyb250aWVyIGlzIGxpc3Qgb2YgcG9pbnRlcnMgdG8gcG9seWdvbnNcbiAgICAgICwgbmV4dF9mcm9udGllciA9IG5ldyBJbnQzMkFycmF5KGRpbXNbdV0pXG4gICAgICAsIGxlZnRfaW5kZXggPSBuZXcgSW50MzJBcnJheSgyICogZGltc1t2XSlcbiAgICAgICwgcmlnaHRfaW5kZXggPSBuZXcgSW50MzJBcnJheSgyICogZGltc1t2XSlcbiAgICAgICwgc3RhY2sgPSBuZXcgSW50MzJBcnJheSgyNCAqIGRpbXNbdl0pXG4gICAgICAsIGRlbHRhID0gW1swLDBdLCBbMCwwXV07XG4gICAgLy9xIHBvaW50cyBhbG9uZyBkLWRpcmVjdGlvblxuICAgIHFbZF0gPSAxO1xuICAgIC8vSW5pdGlhbGl6ZSBzZW50aW5lbFxuICAgIGZvcih4W2RdPS0xOyB4W2RdPGRpbXNbZF07ICkge1xuICAgICAgLy8gLS0tIFBlcmZvcm0gbW9ub3RvbmUgcG9seWdvbiBzdWJkaXZpc2lvbiAtLS1cbiAgICAgIHZhciBuID0gMFxuICAgICAgICAsIHBvbHlnb25zID0gW11cbiAgICAgICAgLCBuZiA9IDA7XG4gICAgICBmb3IoeFt2XT0wOyB4W3ZdPGRpbXNbdl07ICsreFt2XSkge1xuICAgICAgICAvL01ha2Ugb25lIHBhc3Mgb3ZlciB0aGUgdS1zY2FuIGxpbmUgb2YgdGhlIHZvbHVtZSB0byBydW4tbGVuZ3RoIGVuY29kZSBwb2x5Z29uXG4gICAgICAgIHZhciBuciA9IDAsIHAgPSAwLCBjID0gMDtcbiAgICAgICAgZm9yKHhbdV09MDsgeFt1XTxkaW1zW3VdOyArK3hbdV0sIHAgPSBjKSB7XG4gICAgICAgICAgLy9Db21wdXRlIHRoZSB0eXBlIGZvciB0aGlzIGZhY2VcbiAgICAgICAgICB2YXIgYSA9ICgwICAgIDw9IHhbZF0gICAgICA/IGYoeFswXSwgICAgICB4WzFdLCAgICAgIHhbMl0pICAgICAgOiAwKVxuICAgICAgICAgICAgLCBiID0gKHhbZF0gPCAgZGltc1tkXS0xID8gZih4WzBdK3FbMF0sIHhbMV0rcVsxXSwgeFsyXStxWzJdKSA6IDApO1xuICAgICAgICAgIGMgPSBhO1xuICAgICAgICAgIGlmKCghYSkgPT09ICghYikpIHtcbiAgICAgICAgICAgIGMgPSAwO1xuICAgICAgICAgIH0gZWxzZSBpZighYSkge1xuICAgICAgICAgICAgYyA9IC1iO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvL0lmIGNlbGwgdHlwZSBkb2Vzbid0IG1hdGNoLCBzdGFydCBhIG5ldyBydW5cbiAgICAgICAgICBpZihwICE9PSBjKSB7XG4gICAgICAgICAgICBydW5zW25yKytdID0geFt1XTtcbiAgICAgICAgICAgIHJ1bnNbbnIrK10gPSBjO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvL0FkZCBzZW50aW5lbCBydW5cbiAgICAgICAgcnVuc1tucisrXSA9IGRpbXNbdV07XG4gICAgICAgIHJ1bnNbbnIrK10gPSAwO1xuICAgICAgICAvL1VwZGF0ZSBmcm9udGllciBieSBtZXJnaW5nIHJ1bnNcbiAgICAgICAgdmFyIGZwID0gMDtcbiAgICAgICAgZm9yKHZhciBpPTAsIGo9MDsgaTxuZiAmJiBqPG5yLTI7ICkge1xuICAgICAgICAgIHZhciBwICAgID0gcG9seWdvbnNbZnJvbnRpZXJbaV1dXG4gICAgICAgICAgICAsIHBfbCAgPSBwLmxlZnRbcC5sZWZ0Lmxlbmd0aC0xXVswXVxuICAgICAgICAgICAgLCBwX3IgID0gcC5yaWdodFtwLnJpZ2h0Lmxlbmd0aC0xXVswXVxuICAgICAgICAgICAgLCBwX2MgID0gcC5jb2xvclxuICAgICAgICAgICAgLCByX2wgID0gcnVuc1tqXSAgICAvL1N0YXJ0IG9mIHJ1blxuICAgICAgICAgICAgLCByX3IgID0gcnVuc1tqKzJdICAvL0VuZCBvZiBydW5cbiAgICAgICAgICAgICwgcl9jICA9IHJ1bnNbaisxXTsgLy9Db2xvciBvZiBydW5cbiAgICAgICAgICAvL0NoZWNrIGlmIHdlIGNhbiBtZXJnZSBydW4gd2l0aCBwb2x5Z29uXG4gICAgICAgICAgaWYocl9yID4gcF9sICYmIHBfciA+IHJfbCAmJiByX2MgPT09IHBfYykge1xuICAgICAgICAgICAgLy9NZXJnZSBydW5cbiAgICAgICAgICAgIHAubWVyZ2VfcnVuKHhbdl0sIHJfbCwgcl9yKTtcbiAgICAgICAgICAgIC8vSW5zZXJ0IHBvbHlnb24gaW50byBmcm9udGllclxuICAgICAgICAgICAgbmV4dF9mcm9udGllcltmcCsrXSA9IGZyb250aWVyW2ldO1xuICAgICAgICAgICAgKytpO1xuICAgICAgICAgICAgaiArPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvL0NoZWNrIGlmIHdlIG5lZWQgdG8gYWR2YW5jZSB0aGUgcnVuIHBvaW50ZXJcbiAgICAgICAgICAgIGlmKHJfciA8PSBwX3IpIHtcbiAgICAgICAgICAgICAgaWYoISFyX2MpIHtcbiAgICAgICAgICAgICAgICB2YXIgbl9wb2x5ID0gbmV3IE1vbm90b25lUG9seWdvbihyX2MsIHhbdl0sIHJfbCwgcl9yKTtcbiAgICAgICAgICAgICAgICBuZXh0X2Zyb250aWVyW2ZwKytdID0gcG9seWdvbnMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHBvbHlnb25zLnB1c2gobl9wb2x5KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBqICs9IDI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvL0NoZWNrIGlmIHdlIG5lZWQgdG8gYWR2YW5jZSB0aGUgZnJvbnRpZXIgcG9pbnRlclxuICAgICAgICAgICAgaWYocF9yIDw9IHJfcikge1xuICAgICAgICAgICAgICBwLmNsb3NlX29mZih4W3ZdKTtcbiAgICAgICAgICAgICAgKytpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvL0Nsb3NlIG9mZiBhbnkgcmVzaWR1YWwgcG9seWdvbnNcbiAgICAgICAgZm9yKDsgaTxuZjsgKytpKSB7XG4gICAgICAgICAgcG9seWdvbnNbZnJvbnRpZXJbaV1dLmNsb3NlX29mZih4W3ZdKTtcbiAgICAgICAgfVxuICAgICAgICAvL0FkZCBhbnkgZXh0cmEgcnVucyB0byBmcm9udGllclxuICAgICAgICBmb3IoOyBqPG5yLTI7IGorPTIpIHtcbiAgICAgICAgICB2YXIgcl9sICA9IHJ1bnNbal1cbiAgICAgICAgICAgICwgcl9yICA9IHJ1bnNbaisyXVxuICAgICAgICAgICAgLCByX2MgID0gcnVuc1tqKzFdO1xuICAgICAgICAgIGlmKCEhcl9jKSB7XG4gICAgICAgICAgICB2YXIgbl9wb2x5ID0gbmV3IE1vbm90b25lUG9seWdvbihyX2MsIHhbdl0sIHJfbCwgcl9yKTtcbiAgICAgICAgICAgIG5leHRfZnJvbnRpZXJbZnArK10gPSBwb2x5Z29ucy5sZW5ndGg7XG4gICAgICAgICAgICBwb2x5Z29ucy5wdXNoKG5fcG9seSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vU3dhcCBmcm9udGllcnNcbiAgICAgICAgdmFyIHRtcCA9IG5leHRfZnJvbnRpZXI7XG4gICAgICAgIG5leHRfZnJvbnRpZXIgPSBmcm9udGllcjtcbiAgICAgICAgZnJvbnRpZXIgPSB0bXA7XG4gICAgICAgIG5mID0gZnA7XG4gICAgICB9XG4gICAgICAvL0Nsb3NlIG9mZiBmcm9udGllclxuICAgICAgZm9yKHZhciBpPTA7IGk8bmY7ICsraSkge1xuICAgICAgICB2YXIgcCA9IHBvbHlnb25zW2Zyb250aWVyW2ldXTtcbiAgICAgICAgcC5jbG9zZV9vZmYoZGltc1t2XSk7XG4gICAgICB9XG4gICAgICAvLyAtLS0gTW9ub3RvbmUgc3ViZGl2aXNpb24gb2YgcG9seWdvbiBpcyBjb21wbGV0ZSBhdCB0aGlzIHBvaW50IC0tLVxuICAgICAgXG4gICAgICB4W2RdKys7XG4gICAgICBcbiAgICAgIC8vTm93IHdlIGp1c3QgbmVlZCB0byB0cmlhbmd1bGF0ZSBlYWNoIG1vbm90b25lIHBvbHlnb25cbiAgICAgIGZvcih2YXIgaT0wOyBpPHBvbHlnb25zLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBwID0gcG9seWdvbnNbaV1cbiAgICAgICAgICAsIGMgPSBwLmNvbG9yXG4gICAgICAgICAgLCBmbGlwcGVkID0gZmFsc2U7XG4gICAgICAgIGlmKGMgPCAwKSB7XG4gICAgICAgICAgZmxpcHBlZCA9IHRydWU7XG4gICAgICAgICAgYyA9IC1jO1xuICAgICAgICB9XG4gICAgICAgIGZvcih2YXIgaj0wOyBqPHAubGVmdC5sZW5ndGg7ICsraikge1xuICAgICAgICAgIGxlZnRfaW5kZXhbal0gPSB2ZXJ0aWNlcy5sZW5ndGg7XG4gICAgICAgICAgdmFyIHkgPSBbMC4wLDAuMCwwLjBdXG4gICAgICAgICAgICAsIHogPSBwLmxlZnRbal07XG4gICAgICAgICAgeVtkXSA9IHhbZF07XG4gICAgICAgICAgeVt1XSA9IHpbMF07XG4gICAgICAgICAgeVt2XSA9IHpbMV07XG4gICAgICAgICAgdmVydGljZXMucHVzaCh5KTtcbiAgICAgICAgfVxuICAgICAgICBmb3IodmFyIGo9MDsgajxwLnJpZ2h0Lmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgcmlnaHRfaW5kZXhbal0gPSB2ZXJ0aWNlcy5sZW5ndGg7XG4gICAgICAgICAgdmFyIHkgPSBbMC4wLDAuMCwwLjBdXG4gICAgICAgICAgICAsIHogPSBwLnJpZ2h0W2pdO1xuICAgICAgICAgIHlbZF0gPSB4W2RdO1xuICAgICAgICAgIHlbdV0gPSB6WzBdO1xuICAgICAgICAgIHlbdl0gPSB6WzFdO1xuICAgICAgICAgIHZlcnRpY2VzLnB1c2goeSk7XG4gICAgICAgIH1cbiAgICAgICAgLy9Ucmlhbmd1bGF0ZSB0aGUgbW9ub3RvbmUgcG9seWdvblxuICAgICAgICB2YXIgYm90dG9tID0gMFxuICAgICAgICAgICwgdG9wID0gMFxuICAgICAgICAgICwgbF9pID0gMVxuICAgICAgICAgICwgcl9pID0gMVxuICAgICAgICAgICwgc2lkZSA9IHRydWU7ICAvL3RydWUgPSByaWdodCwgZmFsc2UgPSBsZWZ0XG4gICAgICAgIFxuICAgICAgICBzdGFja1t0b3ArK10gPSBsZWZ0X2luZGV4WzBdO1xuICAgICAgICBzdGFja1t0b3ArK10gPSBwLmxlZnRbMF1bMF07XG4gICAgICAgIHN0YWNrW3RvcCsrXSA9IHAubGVmdFswXVsxXTtcbiAgICAgICAgXG4gICAgICAgIHN0YWNrW3RvcCsrXSA9IHJpZ2h0X2luZGV4WzBdO1xuICAgICAgICBzdGFja1t0b3ArK10gPSBwLnJpZ2h0WzBdWzBdO1xuICAgICAgICBzdGFja1t0b3ArK10gPSBwLnJpZ2h0WzBdWzFdO1xuICAgICAgICBcbiAgICAgICAgd2hpbGUobF9pIDwgcC5sZWZ0Lmxlbmd0aCB8fCByX2kgPCBwLnJpZ2h0Lmxlbmd0aCkge1xuICAgICAgICAgIC8vQ29tcHV0ZSBuZXh0IHNpZGVcbiAgICAgICAgICB2YXIgbl9zaWRlID0gZmFsc2U7XG4gICAgICAgICAgaWYobF9pID09PSBwLmxlZnQubGVuZ3RoKSB7XG4gICAgICAgICAgICBuX3NpZGUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSBpZihyX2kgIT09IHAucmlnaHQubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgbCA9IHAubGVmdFtsX2ldXG4gICAgICAgICAgICAgICwgciA9IHAucmlnaHRbcl9pXTtcbiAgICAgICAgICAgIG5fc2lkZSA9IGxbMV0gPiByWzFdO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgaWR4ID0gbl9zaWRlID8gcmlnaHRfaW5kZXhbcl9pXSA6IGxlZnRfaW5kZXhbbF9pXVxuICAgICAgICAgICAgLCB2ZXJ0ID0gbl9zaWRlID8gcC5yaWdodFtyX2ldIDogcC5sZWZ0W2xfaV07XG4gICAgICAgICAgaWYobl9zaWRlICE9PSBzaWRlKSB7XG4gICAgICAgICAgICAvL09wcG9zaXRlIHNpZGVcbiAgICAgICAgICAgIHdoaWxlKGJvdHRvbSszIDwgdG9wKSB7XG4gICAgICAgICAgICAgIGlmKGZsaXBwZWQgPT09IG5fc2lkZSkge1xuICAgICAgICAgICAgICAgIGZhY2VzLnB1c2goWyBzdGFja1tib3R0b21dLCBzdGFja1tib3R0b20rM10sIGlkeCwgY10pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZhY2VzLnB1c2goWyBzdGFja1tib3R0b20rM10sIHN0YWNrW2JvdHRvbV0sIGlkeCwgY10pOyAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYm90dG9tICs9IDM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vU2FtZSBzaWRlXG4gICAgICAgICAgICB3aGlsZShib3R0b20rMyA8IHRvcCkge1xuICAgICAgICAgICAgICAvL0NvbXB1dGUgY29udmV4aXR5XG4gICAgICAgICAgICAgIGZvcih2YXIgaj0wOyBqPDI7ICsrailcbiAgICAgICAgICAgICAgZm9yKHZhciBrPTA7IGs8MjsgKytrKSB7XG4gICAgICAgICAgICAgICAgZGVsdGFbal1ba10gPSBzdGFja1t0b3AtMyooaisxKStrKzFdIC0gdmVydFtrXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB2YXIgZGV0ID0gZGVsdGFbMF1bMF0gKiBkZWx0YVsxXVsxXSAtIGRlbHRhWzFdWzBdICogZGVsdGFbMF1bMV07XG4gICAgICAgICAgICAgIGlmKG5fc2lkZSA9PT0gKGRldCA+IDApKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYoZGV0ICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgaWYoZmxpcHBlZCA9PT0gbl9zaWRlKSB7XG4gICAgICAgICAgICAgICAgICBmYWNlcy5wdXNoKFsgc3RhY2tbdG9wLTNdLCBzdGFja1t0b3AtNl0sIGlkeCwgYyBdKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgZmFjZXMucHVzaChbIHN0YWNrW3RvcC02XSwgc3RhY2tbdG9wLTNdLCBpZHgsIGMgXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHRvcCAtPSAzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICAvL1B1c2ggdmVydGV4XG4gICAgICAgICAgc3RhY2tbdG9wKytdID0gaWR4O1xuICAgICAgICAgIHN0YWNrW3RvcCsrXSA9IHZlcnRbMF07XG4gICAgICAgICAgc3RhY2tbdG9wKytdID0gdmVydFsxXTtcbiAgICAgICAgICAvL1VwZGF0ZSBsb29wIGluZGV4XG4gICAgICAgICAgaWYobl9zaWRlKSB7XG4gICAgICAgICAgICArK3JfaTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgKytsX2k7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNpZGUgPSBuX3NpZGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHsgdmVydGljZXM6dmVydGljZXMsIGZhY2VzOmZhY2VzIH07XG59XG59KSgpO1xuXG5pZihleHBvcnRzKSB7XG4gIGV4cG9ydHMubWVzaGVyID0gTW9ub3RvbmVNZXNoO1xufVxuIiwiLy9UaGUgc3R1cGlkZXN0IHBvc3NpYmxlIHdheSB0byBnZW5lcmF0ZSBhIE1pbmVjcmFmdCBtZXNoIChJIHRoaW5rKVxuZnVuY3Rpb24gU3R1cGlkTWVzaCh2b2x1bWUsIGRpbXMpIHtcbiAgdmFyIHZlcnRpY2VzID0gW10sIGZhY2VzID0gW10sIHggPSBbMCwwLDBdLCBuID0gMDtcbiAgZm9yKHhbMl09MDsgeFsyXTxkaW1zWzJdOyArK3hbMl0pXG4gIGZvcih4WzFdPTA7IHhbMV08ZGltc1sxXTsgKyt4WzFdKVxuICBmb3IoeFswXT0wOyB4WzBdPGRpbXNbMF07ICsreFswXSwgKytuKVxuICBpZighIXZvbHVtZVtuXSkge1xuICAgIGZvcih2YXIgZD0wOyBkPDM7ICsrZCkge1xuICAgICAgdmFyIHQgPSBbeFswXSwgeFsxXSwgeFsyXV1cbiAgICAgICAgLCB1ID0gWzAsMCwwXVxuICAgICAgICAsIHYgPSBbMCwwLDBdO1xuICAgICAgdVsoZCsxKSUzXSA9IDE7XG4gICAgICB2WyhkKzIpJTNdID0gMTtcbiAgICAgIGZvcih2YXIgcz0wOyBzPDI7ICsrcykge1xuICAgICAgICB0W2RdID0geFtkXSArIHM7XG4gICAgICAgIHZhciB0bXAgPSB1O1xuICAgICAgICB1ID0gdjtcbiAgICAgICAgdiA9IHRtcDtcbiAgICAgICAgdmFyIHZlcnRleF9jb3VudCA9IHZlcnRpY2VzLmxlbmd0aDtcbiAgICAgICAgdmVydGljZXMucHVzaChbdFswXSwgICAgICAgICAgIHRbMV0sICAgICAgICAgICB0WzJdICAgICAgICAgIF0pO1xuICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt0WzBdK3VbMF0sICAgICAgdFsxXSt1WzFdLCAgICAgIHRbMl0rdVsyXSAgICAgXSk7XG4gICAgICAgIHZlcnRpY2VzLnB1c2goW3RbMF0rdVswXSt2WzBdLCB0WzFdK3VbMV0rdlsxXSwgdFsyXSt1WzJdK3ZbMl1dKTtcbiAgICAgICAgdmVydGljZXMucHVzaChbdFswXSAgICAgK3ZbMF0sIHRbMV0gICAgICt2WzFdLCB0WzJdICAgICArdlsyXV0pO1xuICAgICAgICBmYWNlcy5wdXNoKFt2ZXJ0ZXhfY291bnQsIHZlcnRleF9jb3VudCsxLCB2ZXJ0ZXhfY291bnQrMiwgdmVydGV4X2NvdW50KzMsIHZvbHVtZVtuXV0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4geyB2ZXJ0aWNlczp2ZXJ0aWNlcywgZmFjZXM6ZmFjZXMgfTtcbn1cblxuXG5pZihleHBvcnRzKSB7XG4gIGV4cG9ydHMubWVzaGVyID0gU3R1cGlkTWVzaDtcbn1cbiIsInZhciBHcmVlZHlNZXNoID0gKGZ1bmN0aW9uIGdyZWVkeUxvYWRlcigpIHtcbiAgICBcbi8vIGNvbnRhaW5zIGFsbCBmb3J3YXJkIGZhY2VzIChpbiB0ZXJtcyBvZiBzY2FuIGRpcmVjdGlvbilcbnZhciBtYXNrID0gbmV3IEludDMyQXJyYXkoNDA5Nik7XG4vLyBhbmQgYWxsIGJhY2t3YXJkcyBmYWNlcy4gbmVlZGVkIHdoZW4gdGhlcmUgYXJlIHR3byB0cmFuc3BhcmVudCBibG9ja3Ncbi8vIG5leHQgdG8gZWFjaCBvdGhlci5cbnZhciBpbnZNYXNrID0gbmV3IEludDMyQXJyYXkoNDA5Nik7XG5cbi8vIDMyYml044Gu44Oc44Kv44K744OrSUTjgafooajnj77jgZXjgozjgovjgrnjg5rjg7zjgrnjga7jgYbjgaHjgIHmnIDkuIrkvY3jg5Pjg4Pjg4jjga/pgI/mmI7jg5Xjg6njgrDjgajjgZnjgotcbnZhciBrVHJhbnNwYXJlbnRNYXNrICAgID0gMHg4MDAwMDAwMDtcbi8vIDMyYml044Gu44Oc44Kv44K744OrSUTjgafooajnj77jgZXjgozjgovjgrnjg5rjg7zjgrnjga7jgYbjgaHjgIHmrovjgorjga4z44OT44OD44OI44Gv44Oc44Kv44K744Or44Gu5q2j6Z2i5pa55ZCR44KS5oyH5a6a44GZ44KL44OV44Op44Kw44Go44GZ44KLXG52YXIga0ZhY2VEaXJlY3Rpb25NYXNrXHQ9IDB4NzAwMDAwMDA7XG52YXIga05vRmxhZ3NNYXNrICAgICAgICA9IDB4MEZGRkZGRkY7XG5cbmZ1bmN0aW9uIGlzVHJhbnNwYXJlbnQodikge1xuICByZXR1cm4gKHYgJiBrVHJhbnNwYXJlbnRNYXNrKSA9PT0ga1RyYW5zcGFyZW50TWFzaztcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRmxhZ3Modikge1xuICByZXR1cm4gKHYgJiBrTm9GbGFnc01hc2spO1xufVxuXG5yZXR1cm4gZnVuY3Rpb24gb2hTb0dyZWVkeU1lc2hlcih2b2x1bWUsIGRpbXMsIG1lc2hlckV4dHJhRGF0YSkge1xuICB2YXIgdmVydGljZXMgPSBbXSwgZmFjZXMgPSBbXVxuICAgICwgZGltc1ggPSBkaW1zWzBdXG4gICAgLCBkaW1zWSA9IGRpbXNbMV1cbiAgICAsIGRpbXNYWSA9IGRpbXNYICogZGltc1k7XG5cbiAgdmFyIHRWZXJ0aWNlcyA9IFtdLCB0RmFjZXMgPSBbXVxuXG4gIHZhciB0cmFuc3BhcmVudFR5cGVzID0gbWVzaGVyRXh0cmFEYXRhID8gKG1lc2hlckV4dHJhRGF0YS50cmFuc3BhcmVudFR5cGVzIHx8IHt9KSA6IHt9O1xuICB2YXIgZ2V0VHlwZSA9IGZ1bmN0aW9uKHZveGVscywgb2Zmc2V0KSB7XG4gICAgdmFyIHR5cGUgPSB2b3hlbHNbb2Zmc2V0XTtcbiAgICByZXR1cm4gdHlwZSB8ICh0eXBlIGluIHRyYW5zcGFyZW50VHlwZXMgPyBrVHJhbnNwYXJlbnRNYXNrIDogMCk7XG4gIH1cblxuXG4gIC8vU3dlZXAgb3ZlciAzLWF4ZXNcbiAgZm9yKHZhciBkPTA7IGQ8MzsgKytkKSB7XG4gICAgdmFyIGksIGosIGssIGwsIHcsIFcsIGgsIG4sIGNcbiAgICAgICwgdSA9IChkKzEpJTMgLy9kID09PSAwID8gMiA6IGQgPT09IDEgPyAyIDogMFxuICAgICAgLCB2ID0gKGQrMiklMyAvL2QgPT09IDAgPyAxIDogZCA9PT0gMSA/IDAgOiAxXG4gICAgICAsIHggPSBbMCwwLDBdXG4gICAgICAsIHEgPSBbMCwwLDBdXG4gICAgICAsIGR1ID0gWzAsMCwwXVxuICAgICAgLCBkdiA9IFswLDAsMF1cbiAgICAgICwgZGltc0QgPSBkaW1zW2RdXG4gICAgICAsIGRpbXNVID0gZGltc1t1XVxuICAgICAgLCBkaW1zViA9IGRpbXNbdl1cbiAgICAgICwgcWRpbXNYLCBxZGltc1hZXG4gICAgICAsIHhkXG5cbiAgICBpZiAobWFzay5sZW5ndGggPCBkaW1zVSAqIGRpbXNWKSB7XG4gICAgICBtYXNrID0gbmV3IEludDMyQXJyYXkoZGltc1UgKiBkaW1zVik7XG4gICAgICBpbnZNYXNrID0gbmV3IEludDMyQXJyYXkoZGltc1UgKiBkaW1zVik7XG4gICAgfVxuXG4gICAgcVtkXSA9ICAxO1xuICAgIHhbZF0gPSAtMTtcblxuICAgIHFkaW1zWCAgPSBkaW1zWCAgKiBxWzFdXG4gICAgcWRpbXNYWSA9IGRpbXNYWSAqIHFbMl1cblxuICAgIC8vIENvbXB1dGUgbWFza1xuICAgIHdoaWxlICh4W2RdIDwgZGltc0QpIHtcbiAgICAgIHhkID0geFtkXVxuICAgICAgbiA9IDA7XG5cbiAgICAgIGZvcih4W3ZdID0gMDsgeFt2XSA8IGRpbXNWOyArK3hbdl0pIHtcbiAgICAgICAgZm9yKHhbdV0gPSAwOyB4W3VdIDwgZGltc1U7ICsreFt1XSwgKytuKSB7XG4gICAgICAgICAgLy8gTW9kaWZpZWQgdG8gcmVhZCB0aHJvdWdoIGdldFR5cGUoKVxuICAgICAgICAgIHZhciBhID0geGQgPj0gMCAgICAgICYmIGdldFR5cGUodm9sdW1lLCB4WzBdICAgICAgKyBkaW1zWCAqIHhbMV0gICAgICAgICAgKyBkaW1zWFkgKiB4WzJdICAgICAgICAgIClcbiAgICAgICAgICAgICwgYiA9IHhkIDwgZGltc0QtMSAmJiBnZXRUeXBlKHZvbHVtZSwgeFswXStxWzBdICsgZGltc1ggKiB4WzFdICsgcWRpbXNYICsgZGltc1hZICogeFsyXSArIHFkaW1zWFkpXG5cbiAgICAgICAgICBpZiAoaXNUcmFuc3BhcmVudChhKSAmJiBpc1RyYW5zcGFyZW50KGIpKSB7XG4gICAgICAgICAgICBpZiAoYSAhPT0gYikge1xuICAgICAgICAgICAgICAvLyDkuKHpnaLjgYzpgI/mmI7jgaDjgYzjgIHjgZ3jgozjgZ7jgozjga7ntKDmnZDjgYzpgZXjgYbjgZ/jgoHjgIHkuKHpnaLjgajjgoLmj4/nlLvjgZnjgotcbiAgICAgICAgICAgICAgbWFza1tuXSA9IGE7XG4gICAgICAgICAgICAgIGludk1hc2tbbl0gPSBiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIC8vIOS4oemdouOBjOmAj+aYjuOBp+OBi+OBpOWQjOOBmOe0oOadkOOBquOBruOBp+OAgeaPj+eUu+OBl+OBquOBhFxuICAgICAgICAgICAgICBtYXNrW25dID0gMDtcbiAgICAgICAgICAgICAgaW52TWFza1tuXSA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChhICYmICghYiB8fCBpc1RyYW5zcGFyZW50KGIpKSkge1xuICAgICAgICAgICAgLy8gYeOBjOS4jemAj+aYjuOBp2LjgYzlrZjlnKjjgZfjgarjgYTjgYvljYrpgI/mmI5cbiAgICAgICAgICAgIG1hc2tbbl0gPSBhO1xuICAgICAgICAgICAgaW52TWFza1tuXSA9IDBcbiAgICAgICAgICB9IGVsc2UgaWYgKGIgJiYgKCFhIHx8IGlzVHJhbnNwYXJlbnQoYSkpKSB7XG4gICAgICAgICAgICAvLyBi44GM5LiN6YCP5piO44GnYeOBjOWtmOWcqOOBl+OBquOBhOOBi+WNiumAj+aYjlxuICAgICAgICAgICAgbWFza1tuXSA9IDBcbiAgICAgICAgICAgIGludk1hc2tbbl0gPSBiO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyDmj4/nlLvjga7lv4XopoHjgarjgZdcbiAgICAgICAgICAgIG1hc2tbbl0gPSAwXG4gICAgICAgICAgICBpbnZNYXNrW25dID0gMFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICArK3hbZF07XG5cbiAgICAgIC8vIEdlbmVyYXRlIG1lc2ggZm9yIG1hc2sgdXNpbmcgbGV4aWNvZ3JhcGhpYyBvcmRlcmluZ1xuICAgICAgZnVuY3Rpb24gZ2VuZXJhdGVNZXNoKG1hc2ssIGRpbXNWLCBkaW1zVSwgdmVydGljZXMsIGZhY2VzLCBjbG9ja3dpc2UpIHtcbiAgICAgICAgY2xvY2t3aXNlID0gY2xvY2t3aXNlID09PSB1bmRlZmluZWQgPyB0cnVlIDogY2xvY2t3aXNlO1xuICAgICAgICB2YXIgbiwgaiwgaSwgYywgdywgaCwgaywgZHUgPSBbMCwwLDBdLCBkdiA9IFswLDAsMF07XG4gICAgICAgIG4gPSAwO1xuICAgICAgICBmb3IgKGo9MDsgaiA8IGRpbXNWOyArK2opIHtcbiAgICAgICAgICBmb3IgKGk9MDsgaSA8IGRpbXNVOyApIHtcbiAgICAgICAgICAgIGMgPSBtYXNrW25dO1xuICAgICAgICAgICAgaWYgKCFjKSB7XG4gICAgICAgICAgICAgIGkrKzsgIG4rKzsgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vQ29tcHV0ZSB3aWR0aFxuICAgICAgICAgICAgdyA9IDE7XG4gICAgICAgICAgICB3aGlsZSAoYyA9PT0gbWFza1tuK3ddICYmIGkrdyA8IGRpbXNVKSB3Kys7XG5cbiAgICAgICAgICAgIC8vQ29tcHV0ZSBoZWlnaHQgKHRoaXMgaXMgc2xpZ2h0bHkgYXdrd2FyZClcbiAgICAgICAgICAgIGZvciAoaD0xOyBqK2ggPCBkaW1zVjsgKytoKSB7XG4gICAgICAgICAgICAgIGsgPSAwO1xuICAgICAgICAgICAgICB3aGlsZSAoayA8IHcgJiYgYyA9PT0gbWFza1tuK2sraCpkaW1zVV0pIGsrK1xuICAgICAgICAgICAgICBpZiAoayA8IHcpIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBZGQgcXVhZFxuICAgICAgICAgICAgLy8gVGhlIGR1L2R2IGFycmF5cyBhcmUgcmV1c2VkL3Jlc2V0XG4gICAgICAgICAgICAvLyBmb3IgZWFjaCBpdGVyYXRpb24uXG4gICAgICAgICAgICBkdVtkXSA9IDA7IGR2W2RdID0gMDtcbiAgICAgICAgICAgIHhbdV0gID0gaTsgIHhbdl0gPSBqO1xuXG4gICAgICAgICAgICBpZiAoY2xvY2t3aXNlKSB7XG4gICAgICAgICAgICAvLyBpZiAoYyA+IDApIHtcbiAgICAgICAgICAgICAgZHZbdl0gPSBoOyBkdlt1XSA9IDA7XG4gICAgICAgICAgICAgIGR1W3VdID0gdzsgZHVbdl0gPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gYyA9IC1jO1xuICAgICAgICAgICAgICBkdVt2XSA9IGg7IGR1W3VdID0gMDtcbiAgICAgICAgICAgICAgZHZbdV0gPSB3OyBkdlt2XSA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciB2ZXJ0ZXhfY291bnRcbiAgICAgICAgICAgIGlmICghaXNUcmFuc3BhcmVudChjKSkge1xuICAgICAgICAgICAgICAvLyDkuI3pgI/mmI7jgarpoILngrnjgajpnaLjgajjgZfjgabjg5Djg4Pjg5XjgqHjgavlgKTjgpLov73liqBcbiAgICAgICAgICAgICAgdmVydGV4X2NvdW50ID0gdmVydGljZXMubGVuZ3RoO1xuICAgICAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt4WzBdLCAgICAgICAgICAgICB4WzFdLCAgICAgICAgICAgICB4WzJdICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICAgIHZlcnRpY2VzLnB1c2goW3hbMF0rZHVbMF0sICAgICAgIHhbMV0rZHVbMV0sICAgICAgIHhbMl0rZHVbMl0gICAgICBdKTtcbiAgICAgICAgICAgICAgdmVydGljZXMucHVzaChbeFswXStkdVswXStkdlswXSwgeFsxXStkdVsxXStkdlsxXSwgeFsyXStkdVsyXStkdlsyXV0pO1xuICAgICAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt4WzBdICAgICAgK2R2WzBdLCB4WzFdICAgICAgK2R2WzFdLCB4WzJdICAgICAgK2R2WzJdXSk7XG4gICAgICAgICAgICAgIGZhY2VzLnB1c2goW3ZlcnRleF9jb3VudCwgdmVydGV4X2NvdW50KzEsIHZlcnRleF9jb3VudCsyLCB2ZXJ0ZXhfY291bnQrMywgY10pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8g6YCP5piO44Gq6aCC54K544Go6Z2i44Go44GX44Gm44OQ44OD44OV44Kh44Gr5YCk44KS6L+95YqgXG4gICAgICAgICAgICAgICB2ZXJ0ZXhfY291bnQgPSB0VmVydGljZXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgdFZlcnRpY2VzLnB1c2goW3hbMF0sICAgICAgICAgICAgIHhbMV0sICAgICAgICAgICAgIHhbMl0gICAgICAgICAgICBdKTtcbiAgICAgICAgICAgICAgIHRWZXJ0aWNlcy5wdXNoKFt4WzBdK2R1WzBdLCAgICAgICB4WzFdK2R1WzFdLCAgICAgICB4WzJdK2R1WzJdICAgICAgXSk7XG4gICAgICAgICAgICAgICB0VmVydGljZXMucHVzaChbeFswXStkdVswXStkdlswXSwgeFsxXStkdVsxXStkdlsxXSwgeFsyXStkdVsyXStkdlsyXV0pO1xuICAgICAgICAgICAgICAgdFZlcnRpY2VzLnB1c2goW3hbMF0gICAgICArZHZbMF0sIHhbMV0gICAgICArZHZbMV0sIHhbMl0gICAgICArZHZbMl1dKTtcbiAgICAgICAgICAgICAgIHRGYWNlcy5wdXNoKFt2ZXJ0ZXhfY291bnQsIHZlcnRleF9jb3VudCsxLCB2ZXJ0ZXhfY291bnQrMiwgdmVydGV4X2NvdW50KzMsIGNdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9aZXJvLW91dCBtYXNrXG4gICAgICAgICAgICBXID0gbiArIHc7XG4gICAgICAgICAgICBmb3IobD0wOyBsPGg7ICsrbCkge1xuICAgICAgICAgICAgICBmb3Ioaz1uOyBrPFc7ICsraykge1xuICAgICAgICAgICAgICAgIG1hc2tbaytsKmRpbXNVXSA9IDA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9JbmNyZW1lbnQgY291bnRlcnMgYW5kIGNvbnRpbnVlXG4gICAgICAgICAgICBpICs9IHc7IG4gKz0gdztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGdlbmVyYXRlTWVzaChtYXNrLCBkaW1zViwgZGltc1UsIHZlcnRpY2VzLCBmYWNlcywgdHJ1ZSlcbiAgICAgIGdlbmVyYXRlTWVzaChpbnZNYXNrLCBkaW1zViwgZGltc1UsIHZlcnRpY2VzLCBmYWNlcywgZmFsc2UpXG4gICAgfVxuICB9XG4gIFxuICAvLyDpgI/mmI7pg6jliIbjgajkuI3pgI/mmI7pg6jliIbjgpLliIbpm6LjgZfjgZ/nirbmhYvjgafov5TjgZlcbiAgcmV0dXJuIHsgdmVydGljZXM6dmVydGljZXMsIHRWZXJ0aWNlczogdFZlcnRpY2VzLCBmYWNlczpmYWNlcywgdEZhY2VzOiB0RmFjZXMgfVxufVxufSkoKTtcblxuaWYoZXhwb3J0cykge1xuICBleHBvcnRzLm1lc2hlciA9IEdyZWVkeU1lc2g7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGluaGVyaXRzXG5cbmZ1bmN0aW9uIGluaGVyaXRzIChjLCBwLCBwcm90bykge1xuICBwcm90byA9IHByb3RvIHx8IHt9XG4gIHZhciBlID0ge31cbiAgO1tjLnByb3RvdHlwZSwgcHJvdG9dLmZvckVhY2goZnVuY3Rpb24gKHMpIHtcbiAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhzKS5mb3JFYWNoKGZ1bmN0aW9uIChrKSB7XG4gICAgICBlW2tdID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihzLCBrKVxuICAgIH0pXG4gIH0pXG4gIGMucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShwLnByb3RvdHlwZSwgZSlcbiAgYy5zdXBlciA9IHBcbn1cblxuLy9mdW5jdGlvbiBDaGlsZCAoKSB7XG4vLyAgQ2hpbGQuc3VwZXIuY2FsbCh0aGlzKVxuLy8gIGNvbnNvbGUuZXJyb3IoW3RoaXNcbi8vICAgICAgICAgICAgICAgICx0aGlzLmNvbnN0cnVjdG9yXG4vLyAgICAgICAgICAgICAgICAsdGhpcy5jb25zdHJ1Y3RvciA9PT0gQ2hpbGRcbi8vICAgICAgICAgICAgICAgICx0aGlzLmNvbnN0cnVjdG9yLnN1cGVyID09PSBQYXJlbnRcbi8vICAgICAgICAgICAgICAgICxPYmplY3QuZ2V0UHJvdG90eXBlT2YodGhpcykgPT09IENoaWxkLnByb3RvdHlwZVxuLy8gICAgICAgICAgICAgICAgLE9iamVjdC5nZXRQcm90b3R5cGVPZihPYmplY3QuZ2V0UHJvdG90eXBlT2YodGhpcykpXG4vLyAgICAgICAgICAgICAgICAgPT09IFBhcmVudC5wcm90b3R5cGVcbi8vICAgICAgICAgICAgICAgICx0aGlzIGluc3RhbmNlb2YgQ2hpbGRcbi8vICAgICAgICAgICAgICAgICx0aGlzIGluc3RhbmNlb2YgUGFyZW50XSlcbi8vfVxuLy9mdW5jdGlvbiBQYXJlbnQgKCkge31cbi8vaW5oZXJpdHMoQ2hpbGQsIFBhcmVudClcbi8vbmV3IENoaWxkXG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iXX0=
