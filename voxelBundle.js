(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*global voxel*/
voxel = require('voxel_nakata0705');
},{"voxel_nakata0705":3}],2:[function(require,module,exports){
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


},{"events":13,"inherits":9}],3:[function(require,module,exports){
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
module.exports.generate8 = generate8

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

function generate8(lo, hi, fn) {
  // To fix the display gaps, we need to pad the bounds
  lo[0]--
  lo[1]--
  lo[2]--
  hi[0]++
  hi[1]++
  hi[2]++
  var dims = [hi[2]-lo[2], hi[1]-lo[1], hi[0]-lo[0]]
  var data = ndarray(new Uint8Array(dims[2] * dims[1] * dims[0]), dims)
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


},{"./chunker":2,"./meshers/culled":4,"./meshers/greedy":5,"./meshers/monotone":6,"./meshers/stupid":7,"./meshers/transgreedy":8,"ndarray":10}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
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

},{"iota-array":11,"is-buffer":12}],11:[function(require,module,exports){
"use strict"

function iota(n) {
  var result = new Array(n)
  for(var i=0; i<n; ++i) {
    result[i] = i
  }
  return result
}

module.exports = iota
},{}],12:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIm1haW4uanMiLCJub2RlX21vZHVsZXMvdm94ZWxfbmFrYXRhMDcwNS9jaHVua2VyLmpzIiwibm9kZV9tb2R1bGVzL3ZveGVsX25ha2F0YTA3MDUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdm94ZWxfbmFrYXRhMDcwNS9tZXNoZXJzL2N1bGxlZC5qcyIsIm5vZGVfbW9kdWxlcy92b3hlbF9uYWthdGEwNzA1L21lc2hlcnMvZ3JlZWR5LmpzIiwibm9kZV9tb2R1bGVzL3ZveGVsX25ha2F0YTA3MDUvbWVzaGVycy9tb25vdG9uZS5qcyIsIm5vZGVfbW9kdWxlcy92b3hlbF9uYWthdGEwNzA1L21lc2hlcnMvc3R1cGlkLmpzIiwibm9kZV9tb2R1bGVzL3ZveGVsX25ha2F0YTA3MDUvbWVzaGVycy90cmFuc2dyZWVkeS5qcyIsIm5vZGVfbW9kdWxlcy92b3hlbF9uYWthdGEwNzA1L25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0cy5qcyIsIm5vZGVfbW9kdWxlcy92b3hlbF9uYWthdGEwNzA1L25vZGVfbW9kdWxlcy9uZGFycmF5L25kYXJyYXkuanMiLCJub2RlX21vZHVsZXMvdm94ZWxfbmFrYXRhMDcwNS9ub2RlX21vZHVsZXMvbmRhcnJheS9ub2RlX21vZHVsZXMvaW90YS1hcnJheS9pb3RhLmpzIiwibm9kZV9tb2R1bGVzL3ZveGVsX25ha2F0YTA3MDUvbm9kZV9tb2R1bGVzL25kYXJyYXkvbm9kZV9tb2R1bGVzL2lzLWJ1ZmZlci9pbmRleC5qcyIsIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLypnbG9iYWwgdm94ZWwqL1xudm94ZWwgPSByZXF1aXJlKCd2b3hlbF9uYWthdGEwNzA1Jyk7IiwidmFyIGV2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpXG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0cykge1xuICByZXR1cm4gbmV3IENodW5rZXIob3B0cylcbn1cblxubW9kdWxlLmV4cG9ydHMuQ2h1bmtlciA9IENodW5rZXJcblxuZnVuY3Rpb24gQ2h1bmtlcihvcHRzKSB7XG4gIHRoaXMuZGlzdGFuY2UgPSBvcHRzLmNodW5rRGlzdGFuY2UgfHwgMFxuICB0aGlzLmNodW5rU2l6ZSA9IG9wdHMuY2h1bmtTaXplIHx8IDMyXG4gIHRoaXMuY2h1bmtQYWQgPSBvcHRzLmNodW5rUGFkICE9PSB1bmRlZmluZWQgPyBvcHRzLmNodW5rUGFkIDogMFxuICB0aGlzLmN1YmVTaXplID0gb3B0cy5jdWJlU2l6ZSB8fCAyNVxuICB0aGlzLmdlbmVyYXRlVm94ZWxDaHVuayA9IG9wdHMuZ2VuZXJhdGVWb3hlbENodW5rXG4gIHRoaXMuY2h1bmtzID0ge31cbiAgdGhpcy5tZXNoZXMgPSB7fVxuICB0aGlzLmJvZGllc0FycmF5ID0ge31cblxuICBpZiAodGhpcy5jaHVua1NpemUgJiB0aGlzLmNodW5rU2l6ZS0xICE9PSAwKVxuICAgIHRocm93IG5ldyBFcnJvcignY2h1bmtTaXplIG11c3QgYmUgYSBwb3dlciBvZiAyJylcbiAgdmFyIGJpdHMgPSAwO1xuICBmb3IgKHZhciBzaXplID0gdGhpcy5jaHVua1NpemU7IHNpemUgPiAwOyBzaXplID4+PSAxKSBiaXRzKys7XG4gIHRoaXMuY2h1bmtCaXRzID0gYml0cyAtIDE7XG4gIHRoaXMuY2h1bmtNYXNrID0gKDEgPDwgdGhpcy5jaHVua0JpdHMpIC0gMVxuICB0aGlzLmNodW5rUGFkSGFsZiA9IHRoaXMuY2h1bmtQYWQgPj4gMVxufVxuXG5pbmhlcml0cyhDaHVua2VyLCBldmVudHMuRXZlbnRFbWl0dGVyKVxuXG5DaHVua2VyLnByb3RvdHlwZS5uZWFyYnlDaHVua3MgPSBmdW5jdGlvbihwb3NpdGlvbiwgZGlzdGFuY2UpIHtcbiAgdmFyIGNwb3MgPSB0aGlzLmNodW5rQXRQb3NpdGlvbihwb3NpdGlvbilcbiAgcmV0dXJuIHRoaXMubmVhcmJ5Q2h1bmtzQ29vcmRpbmF0ZShjcG9zLCBkaXN0YW5jZSk7XG59XG5cbkNodW5rZXIucHJvdG90eXBlLm5lYXJieUNodW5rc0Nvb3JkaW5hdGUgPSBmdW5jdGlvbihjcG9zLCBkaXN0YW5jZSkge1xuICB2YXIgeCA9IGNwb3NbMF1cbiAgdmFyIHkgPSBjcG9zWzFdXG4gIHZhciB6ID0gY3Bvc1syXVxuICB2YXIgZGlzdCA9IGRpc3RhbmNlIHx8IHRoaXMuZGlzdGFuY2VcbiAgdmFyIG5lYXJieSA9IFtdXG4gIGlmIChkaXN0ID09PSAwKSB7XG4gICAgICBuZWFyYnkucHVzaChbeCwgeSwgel0pO1xuICB9XG4gIGVsc2Uge1xuICAgIGZvciAodmFyIGN4ID0gKHggLSBkaXN0KTsgY3ggIT09ICh4ICsgZGlzdCk7ICsrY3gpIHtcbiAgICAgIGZvciAodmFyIGN5ID0gKHkgLSBkaXN0KTsgY3kgIT09ICh5ICsgZGlzdCk7ICsrY3kpIHtcbiAgICAgICAgZm9yICh2YXIgY3ogPSAoeiAtIGRpc3QpOyBjeiAhPT0gKHogKyBkaXN0KTsgKytjeikge1xuICAgICAgICAgIG5lYXJieS5wdXNoKFtjeCwgY3ksIGN6XSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gbmVhcmJ5XG59XG5cbkNodW5rZXIucHJvdG90eXBlLnJlcXVlc3RNaXNzaW5nQ2h1bmtzID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHRoaXMubmVhcmJ5Q2h1bmtzKHBvc2l0aW9uKS5tYXAoZnVuY3Rpb24oY2h1bmspIHtcbiAgICBpZiAoIXNlbGYuY2h1bmtzW2NodW5rLmpvaW4oJ3wnKV0pIHtcbiAgICAgIHNlbGYuZW1pdCgnbWlzc2luZ0NodW5rJywgY2h1bmspXG4gICAgfVxuICB9KVxufVxuXG5DaHVua2VyLnByb3RvdHlwZS5nZXRCb3VuZHMgPSBmdW5jdGlvbih4LCB5LCB6KSB7XG4gIHZhciBiaXRzID0gdGhpcy5jaHVua0JpdHNcbiAgdmFyIGxvdyA9IFt4IDw8IGJpdHMsIHkgPDwgYml0cywgeiA8PCBiaXRzXVxuICB2YXIgaGlnaCA9IFsoeCsxKSA8PCBiaXRzLCAoeSsxKSA8PCBiaXRzLCAoeisxKSA8PCBiaXRzXVxuICByZXR1cm4gW2xvdywgaGlnaF1cbn1cblxuQ2h1bmtlci5wcm90b3R5cGUuZ2VuZXJhdGVDaHVuayA9IGZ1bmN0aW9uKHgsIHksIHopIHtcbiAgdmFyIGNwb3MgPSBbeCwgeSwgel07XG4gIHZhciBja2V5ID0gY3Bvcy5qb2luKCd8JylcbiAgdmFyIGNodW5rID0gdGhpcy5jaHVua3NbY2tleV1cbiAgaWYgKGNodW5rICE9PSB1bmRlZmluZWQpIHJldHVybiBjaHVua1xuICBcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHZhciBib3VuZHMgPSB0aGlzLmdldEJvdW5kcyh4LCB5LCB6KVxuICB2YXIgY2h1bmsgPSB0aGlzLmdlbmVyYXRlVm94ZWxDaHVuayhib3VuZHNbMF0sIGJvdW5kc1sxXSwgeCwgeSwgeilcbiAgY2h1bmsucG9zaXRpb24gPSBjcG9zXG4gIGNodW5rLmVtcHR5ID0gdHJ1ZVxuICB0aGlzLmNodW5rc1tja2V5XSA9IGNodW5rXG4gIHJldHVybiBjaHVua1xufVxuXG5DaHVua2VyLnByb3RvdHlwZS5nZXRDaHVuayA9IGZ1bmN0aW9uKHgsIHksIHopIHtcbiAgdmFyIGNwb3MgPSBbeCwgeSwgel07XG4gIHZhciBja2V5ID0gY3Bvcy5qb2luKCd8JylcbiAgdmFyIGNodW5rID0gdGhpcy5jaHVua3NbY2tleV1cbiAgaWYgKGNodW5rKSByZXR1cm4gY2h1bmtcbiAgZWxzZSByZXR1cm4gdW5kZWZpbmVkICBcbn1cblxuQ2h1bmtlci5wcm90b3R5cGUuZGVsZXRlQ2h1bmsgPSBmdW5jdGlvbih4LCB5LCB6KSB7XG4gIHZhciBjcG9zID0gW3gsIHksIHpdO1xuICB2YXIgY2tleSA9IGNwb3Muam9pbignfCcpXG4gIHZhciBjaHVuayA9IHRoaXMuY2h1bmtzW2NrZXldXG4gIGlmIChjaHVuaykgZGVsZXRlIHRoaXMuY2h1bmtzW2NrZXldOyBcbn1cblxuQ2h1bmtlci5wcm90b3R5cGUuZ2V0TWVzaGVzID0gZnVuY3Rpb24gKHgsIHksIHopIHtcbiAgdmFyIGNwb3MgPSBbeCwgeSwgel07XG4gIHZhciBja2V5ID0gY3Bvcy5qb2luKCd8JylcbiAgdmFyIG1lc2hlcyA9IHRoaXMubWVzaGVzW2NrZXldXG4gIGlmIChtZXNoZXMpIHJldHVybiBtZXNoZXNcbiAgZWxzZSByZXR1cm4gdW5kZWZpbmVkICBcbn1cblxuQ2h1bmtlci5wcm90b3R5cGUuc2V0TWVzaGVzID0gZnVuY3Rpb24gKHgsIHksIHosIG1lc2gpIHtcbiAgdmFyIGNwb3MgPSBbeCwgeSwgel07XG4gIHZhciBja2V5ID0gY3Bvcy5qb2luKCd8JylcbiAgaWYgKG1lc2ggPT09IHVuZGVmaW5lZCkgdGhpcy5tZXNoZXNbY2tleV0gPSB1bmRlZmluZWRcbiAgaWYgKCF0aGlzLm1lc2hlc1tja2V5XSkgdGhpcy5tZXNoZXNbY2tleV0gPSBbbWVzaF1cbiAgZWxzZSB0aGlzLm1lc2hlc1tja2V5XS5wdXNoKG1lc2gpXG59XG5cbkNodW5rZXIucHJvdG90eXBlLmdldEJvZGllcyA9IGZ1bmN0aW9uICh4LCB5LCB6KSB7XG4gIHZhciBjcG9zID0gW3gsIHksIHpdO1xuICB2YXIgY2tleSA9IGNwb3Muam9pbignfCcpXG4gIHZhciBib2RpZXMgPSB0aGlzLmJvZGllc0FycmF5W2NrZXldXG4gIGlmIChib2RpZXMpIHJldHVybiBib2RpZXNcbiAgZWxzZSByZXR1cm4gdW5kZWZpbmVkICBcbn1cblxuQ2h1bmtlci5wcm90b3R5cGUuc2V0Qm9kaWVzID0gZnVuY3Rpb24gKHgsIHksIHosIGJvZGllcykge1xuICB2YXIgY3BvcyA9IFt4LCB5LCB6XTtcbiAgdmFyIGNrZXkgPSBjcG9zLmpvaW4oJ3wnKVxuICB0aGlzLmJvZGllc0FycmF5W2NrZXldID0gYm9kaWVzXG4gIHJldHVybiBib2RpZXM7XG59XG5cbkNodW5rZXIucHJvdG90eXBlLmNodW5rQXRDb29yZGluYXRlcyA9IGZ1bmN0aW9uKHgsIHksIHopIHtcbiAgdmFyIGJpdHMgPSB0aGlzLmNodW5rQml0cztcbiAgdmFyIGN4ID0geCA+PiBiaXRzO1xuICB2YXIgY3kgPSB5ID4+IGJpdHM7XG4gIHZhciBjeiA9IHogPj4gYml0cztcbiAgdmFyIGNodW5rUG9zID0gW2N4LCBjeSwgY3pdO1xuICByZXR1cm4gY2h1bmtQb3M7XG59XG5cbkNodW5rZXIucHJvdG90eXBlLmNodW5rQXRQb3NpdGlvbiA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG4gIHZhciBjdWJlU2l6ZSA9IHRoaXMuY3ViZVNpemU7XG4gIHZhciB4ID0gTWF0aC5mbG9vcihwb3NpdGlvblswXSAvIGN1YmVTaXplKVxuICB2YXIgeSA9IE1hdGguZmxvb3IocG9zaXRpb25bMV0gLyBjdWJlU2l6ZSlcbiAgdmFyIHogPSBNYXRoLmZsb29yKHBvc2l0aW9uWzJdIC8gY3ViZVNpemUpXG4gIHZhciBjaHVua1BvcyA9IHRoaXMuY2h1bmtBdENvb3JkaW5hdGVzKHgsIHksIHopXG4gIHJldHVybiBjaHVua1Bvc1xufTtcblxuQ2h1bmtlci5wcm90b3R5cGUudm94ZWxJbmRleEZyb21Db29yZGluYXRlcyA9IGZ1bmN0aW9uKHgsIHksIHopIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdDaHVua2VyLnByb3RvdHlwZS52b3hlbEluZGV4RnJvbUNvb3JkaW5hdGVzIHJlbW92ZWQsIHVzZSB2b3hlbEF0Q29vcmRpbmF0ZXMnKVxufVxuXG5DaHVua2VyLnByb3RvdHlwZS52b3hlbEF0Q29vcmRpbmF0ZXMgPSBmdW5jdGlvbih4LCB5LCB6LCB2YWwsIGF1dG8pIHtcbiAgdmFyIGNwb3MgPSB0aGlzLmNodW5rQXRDb29yZGluYXRlcyh4LCB5LCB6KVxuICB2YXIgY2tleSA9IGNwb3Muam9pbignfCcpXG4gIHZhciBjaHVuayA9IHRoaXMuY2h1bmtzW2NrZXldXG4gIGlmIChjaHVuayA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyDjgoLjgZfjg4Hjg6Pjg7Pjgq/jgYzlrZjlnKjjgZvjgZrjgIHmlrDopo/jgavku6PlhaXjgZXjgozjgZ/jg5zjgq/jgrvjg6vlgKTjgYww44GC44KL44GE44GvdW5kZWZpbmVk44Gq44KJ44CB6Ieq5YuV55qE44Gr44OB44Oj44Oz44Kv44KS5L2c5oiQ44GZ44KL6Kit5a6a44Gn44KC5paw44GX44GE44OB44Oj44Oz44Kv44Gv5L2c5oiQ44GX44Gq44GEXG4gICAgICBpZiAodmFsID09PSAwKSByZXR1cm4gWzAsIG51bGxdXG4gICAgICBpZiAoYXV0byAmJiB0eXBlb2YgdmFsICE9PSAndW5kZWZpbmVkJykgY2h1bmsgPSB0aGlzLmdlbmVyYXRlQ2h1bmsoY3Bvc1swXSwgY3Bvc1sxXSwgY3Bvc1syXSlcbiAgICAgIGVsc2UgcmV0dXJuIFswLCBudWxsXVxuICB9IFxuICBcbiAgLy8g44OB44Oj44Oz44Kv44Gu5ZGo5Zuy44Gr6Kit5a6a44GX44Gf44OR44OH44Kj44Oz44Kw44KS6ICD5oWu44GX44Gm44Oc44Kv44K744Or5YCk44KS5Luj5YWl44GZ44KLXG4gIHZhciBtYXNrID0gdGhpcy5jaHVua01hc2tcbiAgdmFyIGggPSB0aGlzLmNodW5rUGFkSGFsZlxuICB2YXIgbXggPSB4ICYgbWFza1xuICB2YXIgbXkgPSB5ICYgbWFza1xuICB2YXIgbXogPSB6ICYgbWFza1xuICB2YXIgdiA9IGNodW5rLmdldChteCtoLCBteStoLCBteitoKVxuICBpZiAodHlwZW9mIHZhbCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjaHVuay5zZXQobXgraCwgbXkraCwgbXoraCwgdmFsKVxuICAgIFxuICAgIC8vIFtUb0RvXSDjgZPjga7jgrPjg7zjg4njga/jg4Hjg6Pjg7Pjgq/jgpLjgq/jg6njgrnljJbjgZfjgZ/jgonjgIHlhoXpg6jlh6bnkIbjgajjgZfjgablj5bjgorovrzjgoBcbiAgICBpZiAodmFsICE9PSAweDAwKSBjaHVuay5lbXB0eSA9IGZhbHNlXG4gIH1cbiAgcmV0dXJuIFt2LCBjaHVua11cbn1cblxuQ2h1bmtlci5wcm90b3R5cGUudm94ZWxBdFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zLCB2YWwsIGF1dG8pIHtcbiAgdmFyIGN1YmVTaXplID0gdGhpcy5jdWJlU2l6ZTtcbiAgdmFyIHggPSBNYXRoLmZsb29yKHBvc1swXSAvIGN1YmVTaXplKVxuICB2YXIgeSA9IE1hdGguZmxvb3IocG9zWzFdIC8gY3ViZVNpemUpXG4gIHZhciB6ID0gTWF0aC5mbG9vcihwb3NbMl0gLyBjdWJlU2l6ZSlcbiAgdmFyIHYgPSB0aGlzLnZveGVsQXRDb29yZGluYXRlcyh4LCB5LCB6LCB2YWwsIGF1dG8pXG4gIHJldHVybiB2O1xufVxuXG4iLCJ2YXIgY2h1bmtlciA9IHJlcXVpcmUoJy4vY2h1bmtlcicpXG52YXIgbmRhcnJheSA9IHJlcXVpcmUoJ25kYXJyYXknKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdHMpIHtcbiAgaWYgKCFvcHRzLmdlbmVyYXRlVm94ZWxDaHVuaykgb3B0cy5nZW5lcmF0ZVZveGVsQ2h1bmsgPSBmdW5jdGlvbihsb3csIGhpZ2gpIHtcblx0cmV0dXJuIGdlbmVyYXRlMzIobG93LCBoaWdoLCBmdW5jdGlvbihpLCBqLCBrKSB7IHJldHVybiAwOyB9KVxuICB9XG4gIHJldHVybiBjaHVua2VyKG9wdHMpXG59XG5cbm1vZHVsZS5leHBvcnRzLm1lc2hlcnMgPSB7XG4gIGN1bGxlZDogcmVxdWlyZSgnLi9tZXNoZXJzL2N1bGxlZCcpLm1lc2hlcixcbiAgZ3JlZWR5OiByZXF1aXJlKCcuL21lc2hlcnMvZ3JlZWR5JykubWVzaGVyLFxuICB0cmFuc2dyZWVkeTogcmVxdWlyZSgnLi9tZXNoZXJzL3RyYW5zZ3JlZWR5JykubWVzaGVyLFxuICBtb25vdG9uZTogcmVxdWlyZSgnLi9tZXNoZXJzL21vbm90b25lJykubWVzaGVyLFxuICBzdHVwaWQ6IHJlcXVpcmUoJy4vbWVzaGVycy9zdHVwaWQnKS5tZXNoZXJcbn1cblxubW9kdWxlLmV4cG9ydHMuQ2h1bmtlciA9IGNodW5rZXIuQ2h1bmtlclxubW9kdWxlLmV4cG9ydHMuZ2VvbWV0cnkgPSB7fVxubW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yID0ge31cbm1vZHVsZS5leHBvcnRzLmdlbmVyYXRlMzIgPSBnZW5lcmF0ZTMyXG5tb2R1bGUuZXhwb3J0cy5nZW5lcmF0ZTggPSBnZW5lcmF0ZThcblxuZnVuY3Rpb24gZ2VuZXJhdGUzMihsbywgaGksIGZuKSB7XG4gIC8vIFRvIGZpeCB0aGUgZGlzcGxheSBnYXBzLCB3ZSBuZWVkIHRvIHBhZCB0aGUgYm91bmRzXG4gIGxvWzBdLS1cbiAgbG9bMV0tLVxuICBsb1syXS0tXG4gIGhpWzBdKytcbiAgaGlbMV0rK1xuICBoaVsyXSsrXG4gIHZhciBkaW1zID0gW2hpWzJdLWxvWzJdLCBoaVsxXS1sb1sxXSwgaGlbMF0tbG9bMF1dXG4gIHZhciBkYXRhID0gbmRhcnJheShuZXcgVWludDMyQXJyYXkoZGltc1syXSAqIGRpbXNbMV0gKiBkaW1zWzBdKSwgZGltcylcbiAgZm9yICh2YXIgayA9IGxvWzJdOyBrIDwgaGlbMl07IGsrKylcbiAgICBmb3IgKHZhciBqID0gbG9bMV07IGogPCBoaVsxXTsgaisrKVxuICAgICAgZm9yKHZhciBpID0gbG9bMF07IGkgPCBoaVswXTsgaSsrKSB7XG4gICAgICAgIGRhdGEuc2V0KGstbG9bMl0sIGotbG9bMV0sIGktbG9bMF0sIGZuKGksIGosIGspKVxuICAgICAgfVxuICByZXR1cm4gZGF0YVxufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZTgobG8sIGhpLCBmbikge1xuICAvLyBUbyBmaXggdGhlIGRpc3BsYXkgZ2Fwcywgd2UgbmVlZCB0byBwYWQgdGhlIGJvdW5kc1xuICBsb1swXS0tXG4gIGxvWzFdLS1cbiAgbG9bMl0tLVxuICBoaVswXSsrXG4gIGhpWzFdKytcbiAgaGlbMl0rK1xuICB2YXIgZGltcyA9IFtoaVsyXS1sb1syXSwgaGlbMV0tbG9bMV0sIGhpWzBdLWxvWzBdXVxuICB2YXIgZGF0YSA9IG5kYXJyYXkobmV3IFVpbnQ4QXJyYXkoZGltc1syXSAqIGRpbXNbMV0gKiBkaW1zWzBdKSwgZGltcylcbiAgZm9yICh2YXIgayA9IGxvWzJdOyBrIDwgaGlbMl07IGsrKylcbiAgICBmb3IgKHZhciBqID0gbG9bMV07IGogPCBoaVsxXTsgaisrKVxuICAgICAgZm9yKHZhciBpID0gbG9bMF07IGkgPCBoaVswXTsgaSsrKSB7XG4gICAgICAgIGRhdGEuc2V0KGstbG9bMl0sIGotbG9bMV0sIGktbG9bMF0sIGZuKGksIGosIGspKVxuICAgICAgfVxuICByZXR1cm4gZGF0YVxufVxuXG4vLyBzaGFwZSBhbmQgdGVycmFpbiBnZW5lcmF0b3IgZnVuY3Rpb25zXG5tb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ1NwaGVyZSddID0gZnVuY3Rpb24oaSxqLGspIHtcbiAgcmV0dXJuIGkqaStqKmorayprIDw9IDE2KjE2ID8gMSA6IDBcbn1cblxubW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydOb2lzZSddID0gZnVuY3Rpb24oaSxqLGspIHtcbiAgcmV0dXJuIE1hdGgucmFuZG9tKCkgPCAwLjEgPyBNYXRoLnJhbmRvbSgpICogMHhmZmZmZmYgOiAwO1xufVxuXG5tb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ0RlbnNlIE5vaXNlJ10gPSBmdW5jdGlvbihpLGosaykge1xuICByZXR1cm4gTWF0aC5yb3VuZChNYXRoLnJhbmRvbSgpICogMHhmZmZmZmYpO1xufVxuXG5tb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ0NoZWNrZXInXSA9IGZ1bmN0aW9uKGksaixrKSB7XG4gIHJldHVybiAhISgoaStqK2spJjEpID8gKCgoaV5qXmspJjIpID8gMSA6IDB4ZmZmZmZmKSA6IDA7XG59XG5cbm1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnSGlsbCddID0gZnVuY3Rpb24oaSxqLGspIHtcbiAgcmV0dXJuIGogPD0gMTYgKiBNYXRoLmV4cCgtKGkqaSArIGsqaykgLyA2NCkgPyAxIDogMDtcbn1cblxubW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydWYWxsZXknXSA9IGZ1bmN0aW9uKGksaixrKSB7XG4gIHJldHVybiBqIDw9IChpKmkgKyBrKmspICogMzEgLyAoMzIqMzIqMikgKyAxID8gMSArICgxPDwxNSkgOiAwO1xufVxuXG5tb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ0hpbGx5IFRlcnJhaW4nXSA9IGZ1bmN0aW9uKGksaixrKSB7XG4gIHZhciBoMCA9IDMuMCAqIE1hdGguc2luKE1hdGguUEkgKiBpIC8gMTIuMCAtIE1hdGguUEkgKiBrICogMC4xKSArIDI3OyAgICBcbiAgaWYoaiA+IGgwKzEpIHtcbiAgICByZXR1cm4gMDtcbiAgfVxuICBpZihoMCA8PSBqKSB7XG4gICAgcmV0dXJuIDE7XG4gIH1cbiAgdmFyIGgxID0gMi4wICogTWF0aC5zaW4oTWF0aC5QSSAqIGkgKiAwLjI1IC0gTWF0aC5QSSAqIGsgKiAwLjMpICsgMjA7XG4gIGlmKGgxIDw9IGopIHtcbiAgICByZXR1cm4gMjtcbiAgfVxuICBpZigyIDwgaikge1xuICAgIHJldHVybiBNYXRoLnJhbmRvbSgpIDwgMC4xID8gMHgyMjIyMjIgOiAweGFhYWFhYTtcbiAgfVxuICByZXR1cm4gMztcbn1cblxubW9kdWxlLmV4cG9ydHMuc2NhbGUgPSBmdW5jdGlvbiAoIHgsIGZyb21Mb3csIGZyb21IaWdoLCB0b0xvdywgdG9IaWdoICkge1xuICByZXR1cm4gKCB4IC0gZnJvbUxvdyApICogKCB0b0hpZ2ggLSB0b0xvdyApIC8gKCBmcm9tSGlnaCAtIGZyb21Mb3cgKSArIHRvTG93XG59XG5cbi8vIGNvbnZlbmllbmNlIGZ1bmN0aW9uIHRoYXQgdXNlcyB0aGUgYWJvdmUgZnVuY3Rpb25zIHRvIHByZWJha2Ugc29tZSBzaW1wbGUgdm94ZWwgZ2VvbWV0cmllc1xubW9kdWxlLmV4cG9ydHMuZ2VuZXJhdGVFeGFtcGxlcyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4ge1xuICAgICdTcGhlcmUnOiBnZW5lcmF0ZTMyKFstMTYsLTE2LC0xNl0sIFsxNiwxNiwxNl0sIG1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnU3BoZXJlJ10pLFxuICAgICdOb2lzZSc6IGdlbmVyYXRlMzIoWzAsMCwwXSwgWzE2LDE2LDE2XSwgbW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydOb2lzZSddKSxcbiAgICAnRGVuc2UgTm9pc2UnOiBnZW5lcmF0ZTMyKFswLDAsMF0sIFsxNiwxNiwxNl0sIG1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnRGVuc2UgTm9pc2UnXSksXG4gICAgJ0NoZWNrZXInOiBnZW5lcmF0ZTMyKFswLDAsMF0sIFs4LDgsOF0sIG1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnQ2hlY2tlciddKSxcbiAgICAnSGlsbCc6IGdlbmVyYXRlMzIoWy0xNiwgMCwgLTE2XSwgWzE2LDE2LDE2XSwgbW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydIaWxsJ10pLFxuICAgICdWYWxsZXknOiBnZW5lcmF0ZTMyKFswLDAsMF0sIFszMiwzMiwzMl0sIG1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnVmFsbGV5J10pLFxuICAgICdIaWxseSBUZXJyYWluJzogZ2VuZXJhdGUzMihbMCwgMCwgMF0sIFszMiwzMiwzMl0sIG1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnSGlsbHkgVGVycmFpbiddKVxuICB9XG59XG5cbiIsIi8vTmFpdmUgbWVzaGluZyAod2l0aCBmYWNlIGN1bGxpbmcpXG5mdW5jdGlvbiBDdWxsZWRNZXNoKHZvbHVtZSwgZGltcykge1xuICAvL1ByZWNhbGN1bGF0ZSBkaXJlY3Rpb24gdmVjdG9ycyBmb3IgY29udmVuaWVuY2VcbiAgdmFyIGRpciA9IG5ldyBBcnJheSgzKTtcbiAgZm9yKHZhciBpPTA7IGk8MzsgKytpKSB7XG4gICAgZGlyW2ldID0gW1swLDAsMF0sIFswLDAsMF1dO1xuICAgIGRpcltpXVswXVsoaSsxKSUzXSA9IDE7XG4gICAgZGlyW2ldWzFdWyhpKzIpJTNdID0gMTtcbiAgfVxuICAvL01hcmNoIG92ZXIgdGhlIHZvbHVtZVxuICB2YXIgdmVydGljZXMgPSBbXVxuICAgICwgZmFjZXMgPSBbXVxuICAgICwgeCA9IFswLDAsMF1cbiAgICAsIEIgPSBbW2ZhbHNlLHRydWVdICAgIC8vSW5jcmVtZW50YWxseSB1cGRhdGUgYm91bmRzICh0aGlzIGlzIGEgYml0IHVnbHkpXG4gICAgICAgICAgLFtmYWxzZSx0cnVlXVxuICAgICAgICAgICxbZmFsc2UsdHJ1ZV1dXG4gICAgLCBuID0gLWRpbXNbMF0qZGltc1sxXTtcbiAgZm9yKCAgICAgICAgICAgQlsyXT1bZmFsc2UsdHJ1ZV0seFsyXT0tMTsgeFsyXTxkaW1zWzJdOyBCWzJdPVt0cnVlLCgrK3hbMl08ZGltc1syXS0xKV0pXG4gIGZvcihuLT1kaW1zWzBdLEJbMV09W2ZhbHNlLHRydWVdLHhbMV09LTE7IHhbMV08ZGltc1sxXTsgQlsxXT1bdHJ1ZSwoKyt4WzFdPGRpbXNbMV0tMSldKVxuICBmb3Iobi09MSwgICAgICBCWzBdPVtmYWxzZSx0cnVlXSx4WzBdPS0xOyB4WzBdPGRpbXNbMF07IEJbMF09W3RydWUsKCsreFswXTxkaW1zWzBdLTEpXSwgKytuKSB7XG4gICAgLy9SZWFkIGN1cnJlbnQgdm94ZWwgYW5kIDMgbmVpZ2hib3Jpbmcgdm94ZWxzIHVzaW5nIGJvdW5kcyBjaGVjayByZXN1bHRzXG4gICAgdmFyIHAgPSAgIChCWzBdWzBdICYmIEJbMV1bMF0gJiYgQlsyXVswXSkgPyB2b2x1bWVbbl0gICAgICAgICAgICAgICAgIDogMFxuICAgICAgLCBiID0gWyAoQlswXVsxXSAmJiBCWzFdWzBdICYmIEJbMl1bMF0pID8gdm9sdW1lW24rMV0gICAgICAgICAgICAgICA6IDBcbiAgICAgICAgICAgICwgKEJbMF1bMF0gJiYgQlsxXVsxXSAmJiBCWzJdWzBdKSA/IHZvbHVtZVtuK2RpbXNbMF1dICAgICAgICAgOiAwXG4gICAgICAgICAgICAsIChCWzBdWzBdICYmIEJbMV1bMF0gJiYgQlsyXVsxXSkgPyB2b2x1bWVbbitkaW1zWzBdKmRpbXNbMV1dIDogMFxuICAgICAgICAgIF07XG4gICAgLy9HZW5lcmF0ZSBmYWNlc1xuICAgIGZvcih2YXIgZD0wOyBkPDM7ICsrZClcbiAgICBpZigoISFwKSAhPT0gKCEhYltkXSkpIHtcbiAgICAgIHZhciBzID0gIXAgPyAxIDogMDtcbiAgICAgIHZhciB0ID0gW3hbMF0seFsxXSx4WzJdXVxuICAgICAgICAsIHUgPSBkaXJbZF1bc11cbiAgICAgICAgLCB2ID0gZGlyW2RdW3NeMV07XG4gICAgICArK3RbZF07XG4gICAgICBcbiAgICAgIHZhciB2ZXJ0ZXhfY291bnQgPSB2ZXJ0aWNlcy5sZW5ndGg7XG4gICAgICB2ZXJ0aWNlcy5wdXNoKFt0WzBdLCAgICAgICAgICAgdFsxXSwgICAgICAgICAgIHRbMl0gICAgICAgICAgXSk7XG4gICAgICB2ZXJ0aWNlcy5wdXNoKFt0WzBdK3VbMF0sICAgICAgdFsxXSt1WzFdLCAgICAgIHRbMl0rdVsyXSAgICAgXSk7XG4gICAgICB2ZXJ0aWNlcy5wdXNoKFt0WzBdK3VbMF0rdlswXSwgdFsxXSt1WzFdK3ZbMV0sIHRbMl0rdVsyXSt2WzJdXSk7XG4gICAgICB2ZXJ0aWNlcy5wdXNoKFt0WzBdICAgICArdlswXSwgdFsxXSAgICAgK3ZbMV0sIHRbMl0gICAgICt2WzJdXSk7XG4gICAgICBmYWNlcy5wdXNoKFt2ZXJ0ZXhfY291bnQsIHZlcnRleF9jb3VudCsxLCB2ZXJ0ZXhfY291bnQrMiwgdmVydGV4X2NvdW50KzMsIHMgPyBiW2RdIDogcF0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4geyB2ZXJ0aWNlczp2ZXJ0aWNlcywgZmFjZXM6ZmFjZXMgfTtcbn1cblxuXG5pZihleHBvcnRzKSB7XG4gIGV4cG9ydHMubWVzaGVyID0gQ3VsbGVkTWVzaDtcbn1cbiIsInZhciBHcmVlZHlNZXNoID0gKGZ1bmN0aW9uKCkge1xuLy9DYWNoZSBidWZmZXIgaW50ZXJuYWxseVxudmFyIG1hc2sgPSBuZXcgVWludDMyQXJyYXkoNDA5Nik7XG52YXIgbWFza0RpcmVjdGlvbiA9IG5ldyBVaW50MzJBcnJheSg0MDk2KTtcblxucmV0dXJuIGZ1bmN0aW9uKHZvbHVtZSwgZGltcykge1xuICB2YXIgdmVydGljZXMgPSBbXSwgZmFjZXMgPSBbXVxuICAgICwgZGltc1ggPSBkaW1zWzBdXG4gICAgLCBkaW1zWSA9IGRpbXNbMV1cbiAgICAsIGRpbXNYWSA9IGRpbXNYICogZGltc1k7XG5cbiAgLy9Td2VlcCBvdmVyIDMtYXhlc1xuICBmb3IodmFyIGQ9MDsgZDwzOyArK2QpIHtcbiAgICB2YXIgaSwgaiwgaywgbCwgdywgVywgaCwgbiwgY1xuICAgICAgLCB1ID0gKGQrMSklM1xuICAgICAgLCB2ID0gKGQrMiklM1xuICAgICAgLCB4ID0gWzAsMCwwXVxuICAgICAgLCBxID0gWzAsMCwwXVxuICAgICAgLCBkdSA9IFswLDAsMF1cbiAgICAgICwgZHYgPSBbMCwwLDBdXG4gICAgICAsIGRpbXNEID0gZGltc1tkXVxuICAgICAgLCBkaW1zVSA9IGRpbXNbdV1cbiAgICAgICwgZGltc1YgPSBkaW1zW3ZdXG4gICAgICAsIHFkaW1zWCwgcWRpbXNYWVxuICAgICAgLCB4ZFxuXG4gICAgaWYgKG1hc2subGVuZ3RoIDwgZGltc1UgKiBkaW1zVikge1xuICAgICAgbWFzayA9IG5ldyBVaW50MzJBcnJheShkaW1zVSAqIGRpbXNWKTtcbiAgICAgIG1hc2tEaXJlY3Rpb24gPSBuZXcgVWludDMyQXJyYXkoZGltc1UgKiBkaW1zVik7XG4gICAgfVxuXG4gICAgcVtkXSA9ICAxO1xuICAgIHhbZF0gPSAtMTtcblxuICAgIHFkaW1zWCAgPSBkaW1zWCAgKiBxWzFdXG4gICAgcWRpbXNYWSA9IGRpbXNYWSAqIHFbMl1cblxuICAgIC8vIENvbXB1dGUgbWFza1xuICAgIHdoaWxlICh4W2RdIDwgZGltc0QpIHtcbiAgICAgIHhkID0geFtkXVxuICAgICAgbiA9IDA7XG5cbiAgICAgIGZvcih4W3ZdID0gMDsgeFt2XSA8IGRpbXNWOyArK3hbdl0pIHtcbiAgICAgICAgZm9yKHhbdV0gPSAwOyB4W3VdIDwgZGltc1U7ICsreFt1XSwgKytuKSB7XG4gICAgICAgICAgdmFyIGEgPSB4ZCA+PSAwICAgICAgJiYgdm9sdW1lW3hbMF0gICAgICArIGRpbXNYICogeFsxXSAgICAgICAgICArIGRpbXNYWSAqIHhbMl0gICAgICAgICAgXVxuICAgICAgICAgICAgLCBiID0geGQgPCBkaW1zRC0xICYmIHZvbHVtZVt4WzBdK3FbMF0gKyBkaW1zWCAqIHhbMV0gKyBxZGltc1ggKyBkaW1zWFkgKiB4WzJdICsgcWRpbXNYWV1cbiAgICAgICAgICBpZiAoYSA/IGIgOiAhYikge1xuICAgICAgICAgICAgbWFza1tuXSA9IDA7IGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBtYXNrW25dID0gYSA/IGEgOiBiO1xuICAgICAgICAgIG1hc2tEaXJlY3Rpb25bbl0gPSBhID8gMSA6IC0xO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgICsreFtkXTtcblxuICAgICAgLy8gR2VuZXJhdGUgbWVzaCBmb3IgbWFzayB1c2luZyBsZXhpY29ncmFwaGljIG9yZGVyaW5nXG4gICAgICBuID0gMDtcbiAgICAgIGZvciAoaj0wOyBqIDwgZGltc1Y7ICsraikge1xuICAgICAgICBmb3IgKGk9MDsgaSA8IGRpbXNVOyApIHtcbiAgICAgICAgICBjID0gbWFza1tuXSAqIG1hc2tEaXJlY3Rpb25bbl07XG4gICAgICAgICAgaWYgKCFjKSB7XG4gICAgICAgICAgICBpKys7ICBuKys7IGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vQ29tcHV0ZSB3aWR0aFxuICAgICAgICAgIHcgPSAxO1xuICAgICAgICAgIHdoaWxlIChjID09PSBtYXNrW24rd10gKiBtYXNrRGlyZWN0aW9uW24rd10gJiYgaSt3IDwgZGltc1UpIHcrKztcblxuICAgICAgICAgIC8vQ29tcHV0ZSBoZWlnaHQgKHRoaXMgaXMgc2xpZ2h0bHkgYXdrd2FyZClcbiAgICAgICAgICBmb3IgKGg9MTsgaitoIDwgZGltc1Y7ICsraCkge1xuICAgICAgICAgICAgayA9IDA7XG4gICAgICAgICAgICB3aGlsZSAoayA8IHcgJiYgYyA9PT0gbWFza1tuK2sraCpkaW1zVV0gKiBtYXNrRGlyZWN0aW9uW24raytoKmRpbXNVXSkgaysrXG4gICAgICAgICAgICBpZiAoayA8IHcpIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEFkZCBxdWFkXG4gICAgICAgICAgLy8gVGhlIGR1L2R2IGFycmF5cyBhcmUgcmV1c2VkL3Jlc2V0XG4gICAgICAgICAgLy8gZm9yIGVhY2ggaXRlcmF0aW9uLlxuICAgICAgICAgIGR1W2RdID0gMDsgZHZbZF0gPSAwO1xuICAgICAgICAgIHhbdV0gID0gaTsgIHhbdl0gPSBqO1xuXG4gICAgICAgICAgaWYgKGMgPiAwKSB7XG4gICAgICAgICAgICBkdlt2XSA9IGg7IGR2W3VdID0gMDtcbiAgICAgICAgICAgIGR1W3VdID0gdzsgZHVbdl0gPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjID0gLWM7XG4gICAgICAgICAgICBkdVt2XSA9IGg7IGR1W3VdID0gMDtcbiAgICAgICAgICAgIGR2W3VdID0gdzsgZHZbdl0gPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgdmVydGV4X2NvdW50ID0gdmVydGljZXMubGVuZ3RoO1xuICAgICAgICAgIHZlcnRpY2VzLnB1c2goW3hbMF0sICAgICAgICAgICAgIHhbMV0sICAgICAgICAgICAgIHhbMl0gICAgICAgICAgICBdKTtcbiAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt4WzBdK2R1WzBdLCAgICAgICB4WzFdK2R1WzFdLCAgICAgICB4WzJdK2R1WzJdICAgICAgXSk7XG4gICAgICAgICAgdmVydGljZXMucHVzaChbeFswXStkdVswXStkdlswXSwgeFsxXStkdVsxXStkdlsxXSwgeFsyXStkdVsyXStkdlsyXV0pO1xuICAgICAgICAgIHZlcnRpY2VzLnB1c2goW3hbMF0gICAgICArZHZbMF0sIHhbMV0gICAgICArZHZbMV0sIHhbMl0gICAgICArZHZbMl1dKTtcbiAgICAgICAgICBmYWNlcy5wdXNoKFt2ZXJ0ZXhfY291bnQsIHZlcnRleF9jb3VudCsxLCB2ZXJ0ZXhfY291bnQrMiwgdmVydGV4X2NvdW50KzMsIGNdKTtcblxuICAgICAgICAgIC8vWmVyby1vdXQgbWFza1xuICAgICAgICAgIFcgPSBuICsgdztcbiAgICAgICAgICBmb3IobD0wOyBsPGg7ICsrbCkge1xuICAgICAgICAgICAgZm9yKGs9bjsgazxXOyArK2spIHtcbiAgICAgICAgICAgICAgbWFza1trK2wqZGltc1VdID0gMDtcbiAgICAgICAgICAgICAgbWFza0RpcmVjdGlvbltrK2wqZGltc1VdID0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvL0luY3JlbWVudCBjb3VudGVycyBhbmQgY29udGludWVcbiAgICAgICAgICBpICs9IHc7IG4gKz0gdztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4geyB2ZXJ0aWNlczp2ZXJ0aWNlcywgZmFjZXM6ZmFjZXMgfTtcbn1cbn0pKCk7XG5cbmlmKGV4cG9ydHMpIHtcbiAgZXhwb3J0cy5tZXNoZXIgPSBHcmVlZHlNZXNoO1xufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBNb25vdG9uZU1lc2ggPSAoZnVuY3Rpb24oKXtcblxuZnVuY3Rpb24gTW9ub3RvbmVQb2x5Z29uKGMsIHYsIHVsLCB1cikge1xuICB0aGlzLmNvbG9yICA9IGM7XG4gIHRoaXMubGVmdCAgID0gW1t1bCwgdl1dO1xuICB0aGlzLnJpZ2h0ICA9IFtbdXIsIHZdXTtcbn07XG5cbk1vbm90b25lUG9seWdvbi5wcm90b3R5cGUuY2xvc2Vfb2ZmID0gZnVuY3Rpb24odikge1xuICB0aGlzLmxlZnQucHVzaChbIHRoaXMubGVmdFt0aGlzLmxlZnQubGVuZ3RoLTFdWzBdLCB2IF0pO1xuICB0aGlzLnJpZ2h0LnB1c2goWyB0aGlzLnJpZ2h0W3RoaXMucmlnaHQubGVuZ3RoLTFdWzBdLCB2IF0pO1xufTtcblxuTW9ub3RvbmVQb2x5Z29uLnByb3RvdHlwZS5tZXJnZV9ydW4gPSBmdW5jdGlvbih2LCB1X2wsIHVfcikge1xuICB2YXIgbCA9IHRoaXMubGVmdFt0aGlzLmxlZnQubGVuZ3RoLTFdWzBdXG4gICAgLCByID0gdGhpcy5yaWdodFt0aGlzLnJpZ2h0Lmxlbmd0aC0xXVswXTsgXG4gIGlmKGwgIT09IHVfbCkge1xuICAgIHRoaXMubGVmdC5wdXNoKFsgbCwgdiBdKTtcbiAgICB0aGlzLmxlZnQucHVzaChbIHVfbCwgdiBdKTtcbiAgfVxuICBpZihyICE9PSB1X3IpIHtcbiAgICB0aGlzLnJpZ2h0LnB1c2goWyByLCB2IF0pO1xuICAgIHRoaXMucmlnaHQucHVzaChbIHVfciwgdiBdKTtcbiAgfVxufTtcblxuXG5yZXR1cm4gZnVuY3Rpb24odm9sdW1lLCBkaW1zKSB7XG4gIGZ1bmN0aW9uIGYoaSxqLGspIHtcbiAgICByZXR1cm4gdm9sdW1lW2kgKyBkaW1zWzBdICogKGogKyBkaW1zWzFdICogayldO1xuICB9XG4gIC8vU3dlZXAgb3ZlciAzLWF4ZXNcbiAgdmFyIHZlcnRpY2VzID0gW10sIGZhY2VzID0gW107XG4gIGZvcih2YXIgZD0wOyBkPDM7ICsrZCkge1xuICAgIHZhciBpLCBqLCBrXG4gICAgICAsIHUgPSAoZCsxKSUzICAgLy91IGFuZCB2IGFyZSBvcnRob2dvbmFsIGRpcmVjdGlvbnMgdG8gZFxuICAgICAgLCB2ID0gKGQrMiklM1xuICAgICAgLCB4ID0gbmV3IEludDMyQXJyYXkoMylcbiAgICAgICwgcSA9IG5ldyBJbnQzMkFycmF5KDMpXG4gICAgICAsIHJ1bnMgPSBuZXcgSW50MzJBcnJheSgyICogKGRpbXNbdV0rMSkpXG4gICAgICAsIGZyb250aWVyID0gbmV3IEludDMyQXJyYXkoZGltc1t1XSkgIC8vRnJvbnRpZXIgaXMgbGlzdCBvZiBwb2ludGVycyB0byBwb2x5Z29uc1xuICAgICAgLCBuZXh0X2Zyb250aWVyID0gbmV3IEludDMyQXJyYXkoZGltc1t1XSlcbiAgICAgICwgbGVmdF9pbmRleCA9IG5ldyBJbnQzMkFycmF5KDIgKiBkaW1zW3ZdKVxuICAgICAgLCByaWdodF9pbmRleCA9IG5ldyBJbnQzMkFycmF5KDIgKiBkaW1zW3ZdKVxuICAgICAgLCBzdGFjayA9IG5ldyBJbnQzMkFycmF5KDI0ICogZGltc1t2XSlcbiAgICAgICwgZGVsdGEgPSBbWzAsMF0sIFswLDBdXTtcbiAgICAvL3EgcG9pbnRzIGFsb25nIGQtZGlyZWN0aW9uXG4gICAgcVtkXSA9IDE7XG4gICAgLy9Jbml0aWFsaXplIHNlbnRpbmVsXG4gICAgZm9yKHhbZF09LTE7IHhbZF08ZGltc1tkXTsgKSB7XG4gICAgICAvLyAtLS0gUGVyZm9ybSBtb25vdG9uZSBwb2x5Z29uIHN1YmRpdmlzaW9uIC0tLVxuICAgICAgdmFyIG4gPSAwXG4gICAgICAgICwgcG9seWdvbnMgPSBbXVxuICAgICAgICAsIG5mID0gMDtcbiAgICAgIGZvcih4W3ZdPTA7IHhbdl08ZGltc1t2XTsgKyt4W3ZdKSB7XG4gICAgICAgIC8vTWFrZSBvbmUgcGFzcyBvdmVyIHRoZSB1LXNjYW4gbGluZSBvZiB0aGUgdm9sdW1lIHRvIHJ1bi1sZW5ndGggZW5jb2RlIHBvbHlnb25cbiAgICAgICAgdmFyIG5yID0gMCwgcCA9IDAsIGMgPSAwO1xuICAgICAgICBmb3IoeFt1XT0wOyB4W3VdPGRpbXNbdV07ICsreFt1XSwgcCA9IGMpIHtcbiAgICAgICAgICAvL0NvbXB1dGUgdGhlIHR5cGUgZm9yIHRoaXMgZmFjZVxuICAgICAgICAgIHZhciBhID0gKDAgICAgPD0geFtkXSAgICAgID8gZih4WzBdLCAgICAgIHhbMV0sICAgICAgeFsyXSkgICAgICA6IDApXG4gICAgICAgICAgICAsIGIgPSAoeFtkXSA8ICBkaW1zW2RdLTEgPyBmKHhbMF0rcVswXSwgeFsxXStxWzFdLCB4WzJdK3FbMl0pIDogMCk7XG4gICAgICAgICAgYyA9IGE7XG4gICAgICAgICAgaWYoKCFhKSA9PT0gKCFiKSkge1xuICAgICAgICAgICAgYyA9IDA7XG4gICAgICAgICAgfSBlbHNlIGlmKCFhKSB7XG4gICAgICAgICAgICBjID0gLWI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vSWYgY2VsbCB0eXBlIGRvZXNuJ3QgbWF0Y2gsIHN0YXJ0IGEgbmV3IHJ1blxuICAgICAgICAgIGlmKHAgIT09IGMpIHtcbiAgICAgICAgICAgIHJ1bnNbbnIrK10gPSB4W3VdO1xuICAgICAgICAgICAgcnVuc1tucisrXSA9IGM7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vQWRkIHNlbnRpbmVsIHJ1blxuICAgICAgICBydW5zW25yKytdID0gZGltc1t1XTtcbiAgICAgICAgcnVuc1tucisrXSA9IDA7XG4gICAgICAgIC8vVXBkYXRlIGZyb250aWVyIGJ5IG1lcmdpbmcgcnVuc1xuICAgICAgICB2YXIgZnAgPSAwO1xuICAgICAgICBmb3IodmFyIGk9MCwgaj0wOyBpPG5mICYmIGo8bnItMjsgKSB7XG4gICAgICAgICAgdmFyIHAgICAgPSBwb2x5Z29uc1tmcm9udGllcltpXV1cbiAgICAgICAgICAgICwgcF9sICA9IHAubGVmdFtwLmxlZnQubGVuZ3RoLTFdWzBdXG4gICAgICAgICAgICAsIHBfciAgPSBwLnJpZ2h0W3AucmlnaHQubGVuZ3RoLTFdWzBdXG4gICAgICAgICAgICAsIHBfYyAgPSBwLmNvbG9yXG4gICAgICAgICAgICAsIHJfbCAgPSBydW5zW2pdICAgIC8vU3RhcnQgb2YgcnVuXG4gICAgICAgICAgICAsIHJfciAgPSBydW5zW2orMl0gIC8vRW5kIG9mIHJ1blxuICAgICAgICAgICAgLCByX2MgID0gcnVuc1tqKzFdOyAvL0NvbG9yIG9mIHJ1blxuICAgICAgICAgIC8vQ2hlY2sgaWYgd2UgY2FuIG1lcmdlIHJ1biB3aXRoIHBvbHlnb25cbiAgICAgICAgICBpZihyX3IgPiBwX2wgJiYgcF9yID4gcl9sICYmIHJfYyA9PT0gcF9jKSB7XG4gICAgICAgICAgICAvL01lcmdlIHJ1blxuICAgICAgICAgICAgcC5tZXJnZV9ydW4oeFt2XSwgcl9sLCByX3IpO1xuICAgICAgICAgICAgLy9JbnNlcnQgcG9seWdvbiBpbnRvIGZyb250aWVyXG4gICAgICAgICAgICBuZXh0X2Zyb250aWVyW2ZwKytdID0gZnJvbnRpZXJbaV07XG4gICAgICAgICAgICArK2k7XG4gICAgICAgICAgICBqICs9IDI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vQ2hlY2sgaWYgd2UgbmVlZCB0byBhZHZhbmNlIHRoZSBydW4gcG9pbnRlclxuICAgICAgICAgICAgaWYocl9yIDw9IHBfcikge1xuICAgICAgICAgICAgICBpZighIXJfYykge1xuICAgICAgICAgICAgICAgIHZhciBuX3BvbHkgPSBuZXcgTW9ub3RvbmVQb2x5Z29uKHJfYywgeFt2XSwgcl9sLCByX3IpO1xuICAgICAgICAgICAgICAgIG5leHRfZnJvbnRpZXJbZnArK10gPSBwb2x5Z29ucy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgcG9seWdvbnMucHVzaChuX3BvbHkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGogKz0gMjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vQ2hlY2sgaWYgd2UgbmVlZCB0byBhZHZhbmNlIHRoZSBmcm9udGllciBwb2ludGVyXG4gICAgICAgICAgICBpZihwX3IgPD0gcl9yKSB7XG4gICAgICAgICAgICAgIHAuY2xvc2Vfb2ZmKHhbdl0pO1xuICAgICAgICAgICAgICArK2k7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vQ2xvc2Ugb2ZmIGFueSByZXNpZHVhbCBwb2x5Z29uc1xuICAgICAgICBmb3IoOyBpPG5mOyArK2kpIHtcbiAgICAgICAgICBwb2x5Z29uc1tmcm9udGllcltpXV0uY2xvc2Vfb2ZmKHhbdl0pO1xuICAgICAgICB9XG4gICAgICAgIC8vQWRkIGFueSBleHRyYSBydW5zIHRvIGZyb250aWVyXG4gICAgICAgIGZvcig7IGo8bnItMjsgais9Mikge1xuICAgICAgICAgIHZhciByX2wgID0gcnVuc1tqXVxuICAgICAgICAgICAgLCByX3IgID0gcnVuc1tqKzJdXG4gICAgICAgICAgICAsIHJfYyAgPSBydW5zW2orMV07XG4gICAgICAgICAgaWYoISFyX2MpIHtcbiAgICAgICAgICAgIHZhciBuX3BvbHkgPSBuZXcgTW9ub3RvbmVQb2x5Z29uKHJfYywgeFt2XSwgcl9sLCByX3IpO1xuICAgICAgICAgICAgbmV4dF9mcm9udGllcltmcCsrXSA9IHBvbHlnb25zLmxlbmd0aDtcbiAgICAgICAgICAgIHBvbHlnb25zLnB1c2gobl9wb2x5KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy9Td2FwIGZyb250aWVyc1xuICAgICAgICB2YXIgdG1wID0gbmV4dF9mcm9udGllcjtcbiAgICAgICAgbmV4dF9mcm9udGllciA9IGZyb250aWVyO1xuICAgICAgICBmcm9udGllciA9IHRtcDtcbiAgICAgICAgbmYgPSBmcDtcbiAgICAgIH1cbiAgICAgIC8vQ2xvc2Ugb2ZmIGZyb250aWVyXG4gICAgICBmb3IodmFyIGk9MDsgaTxuZjsgKytpKSB7XG4gICAgICAgIHZhciBwID0gcG9seWdvbnNbZnJvbnRpZXJbaV1dO1xuICAgICAgICBwLmNsb3NlX29mZihkaW1zW3ZdKTtcbiAgICAgIH1cbiAgICAgIC8vIC0tLSBNb25vdG9uZSBzdWJkaXZpc2lvbiBvZiBwb2x5Z29uIGlzIGNvbXBsZXRlIGF0IHRoaXMgcG9pbnQgLS0tXG4gICAgICBcbiAgICAgIHhbZF0rKztcbiAgICAgIFxuICAgICAgLy9Ob3cgd2UganVzdCBuZWVkIHRvIHRyaWFuZ3VsYXRlIGVhY2ggbW9ub3RvbmUgcG9seWdvblxuICAgICAgZm9yKHZhciBpPTA7IGk8cG9seWdvbnMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIHAgPSBwb2x5Z29uc1tpXVxuICAgICAgICAgICwgYyA9IHAuY29sb3JcbiAgICAgICAgICAsIGZsaXBwZWQgPSBmYWxzZTtcbiAgICAgICAgaWYoYyA8IDApIHtcbiAgICAgICAgICBmbGlwcGVkID0gdHJ1ZTtcbiAgICAgICAgICBjID0gLWM7XG4gICAgICAgIH1cbiAgICAgICAgZm9yKHZhciBqPTA7IGo8cC5sZWZ0Lmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgbGVmdF9pbmRleFtqXSA9IHZlcnRpY2VzLmxlbmd0aDtcbiAgICAgICAgICB2YXIgeSA9IFswLjAsMC4wLDAuMF1cbiAgICAgICAgICAgICwgeiA9IHAubGVmdFtqXTtcbiAgICAgICAgICB5W2RdID0geFtkXTtcbiAgICAgICAgICB5W3VdID0gelswXTtcbiAgICAgICAgICB5W3ZdID0gelsxXTtcbiAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKHkpO1xuICAgICAgICB9XG4gICAgICAgIGZvcih2YXIgaj0wOyBqPHAucmlnaHQubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICByaWdodF9pbmRleFtqXSA9IHZlcnRpY2VzLmxlbmd0aDtcbiAgICAgICAgICB2YXIgeSA9IFswLjAsMC4wLDAuMF1cbiAgICAgICAgICAgICwgeiA9IHAucmlnaHRbal07XG4gICAgICAgICAgeVtkXSA9IHhbZF07XG4gICAgICAgICAgeVt1XSA9IHpbMF07XG4gICAgICAgICAgeVt2XSA9IHpbMV07XG4gICAgICAgICAgdmVydGljZXMucHVzaCh5KTtcbiAgICAgICAgfVxuICAgICAgICAvL1RyaWFuZ3VsYXRlIHRoZSBtb25vdG9uZSBwb2x5Z29uXG4gICAgICAgIHZhciBib3R0b20gPSAwXG4gICAgICAgICAgLCB0b3AgPSAwXG4gICAgICAgICAgLCBsX2kgPSAxXG4gICAgICAgICAgLCByX2kgPSAxXG4gICAgICAgICAgLCBzaWRlID0gdHJ1ZTsgIC8vdHJ1ZSA9IHJpZ2h0LCBmYWxzZSA9IGxlZnRcbiAgICAgICAgXG4gICAgICAgIHN0YWNrW3RvcCsrXSA9IGxlZnRfaW5kZXhbMF07XG4gICAgICAgIHN0YWNrW3RvcCsrXSA9IHAubGVmdFswXVswXTtcbiAgICAgICAgc3RhY2tbdG9wKytdID0gcC5sZWZ0WzBdWzFdO1xuICAgICAgICBcbiAgICAgICAgc3RhY2tbdG9wKytdID0gcmlnaHRfaW5kZXhbMF07XG4gICAgICAgIHN0YWNrW3RvcCsrXSA9IHAucmlnaHRbMF1bMF07XG4gICAgICAgIHN0YWNrW3RvcCsrXSA9IHAucmlnaHRbMF1bMV07XG4gICAgICAgIFxuICAgICAgICB3aGlsZShsX2kgPCBwLmxlZnQubGVuZ3RoIHx8IHJfaSA8IHAucmlnaHQubGVuZ3RoKSB7XG4gICAgICAgICAgLy9Db21wdXRlIG5leHQgc2lkZVxuICAgICAgICAgIHZhciBuX3NpZGUgPSBmYWxzZTtcbiAgICAgICAgICBpZihsX2kgPT09IHAubGVmdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIG5fc2lkZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIGlmKHJfaSAhPT0gcC5yaWdodC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBsID0gcC5sZWZ0W2xfaV1cbiAgICAgICAgICAgICAgLCByID0gcC5yaWdodFtyX2ldO1xuICAgICAgICAgICAgbl9zaWRlID0gbFsxXSA+IHJbMV07XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBpZHggPSBuX3NpZGUgPyByaWdodF9pbmRleFtyX2ldIDogbGVmdF9pbmRleFtsX2ldXG4gICAgICAgICAgICAsIHZlcnQgPSBuX3NpZGUgPyBwLnJpZ2h0W3JfaV0gOiBwLmxlZnRbbF9pXTtcbiAgICAgICAgICBpZihuX3NpZGUgIT09IHNpZGUpIHtcbiAgICAgICAgICAgIC8vT3Bwb3NpdGUgc2lkZVxuICAgICAgICAgICAgd2hpbGUoYm90dG9tKzMgPCB0b3ApIHtcbiAgICAgICAgICAgICAgaWYoZmxpcHBlZCA9PT0gbl9zaWRlKSB7XG4gICAgICAgICAgICAgICAgZmFjZXMucHVzaChbIHN0YWNrW2JvdHRvbV0sIHN0YWNrW2JvdHRvbSszXSwgaWR4LCBjXSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZmFjZXMucHVzaChbIHN0YWNrW2JvdHRvbSszXSwgc3RhY2tbYm90dG9tXSwgaWR4LCBjXSk7ICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBib3R0b20gKz0gMztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy9TYW1lIHNpZGVcbiAgICAgICAgICAgIHdoaWxlKGJvdHRvbSszIDwgdG9wKSB7XG4gICAgICAgICAgICAgIC8vQ29tcHV0ZSBjb252ZXhpdHlcbiAgICAgICAgICAgICAgZm9yKHZhciBqPTA7IGo8MjsgKytqKVxuICAgICAgICAgICAgICBmb3IodmFyIGs9MDsgazwyOyArK2spIHtcbiAgICAgICAgICAgICAgICBkZWx0YVtqXVtrXSA9IHN0YWNrW3RvcC0zKihqKzEpK2srMV0gLSB2ZXJ0W2tdO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHZhciBkZXQgPSBkZWx0YVswXVswXSAqIGRlbHRhWzFdWzFdIC0gZGVsdGFbMV1bMF0gKiBkZWx0YVswXVsxXTtcbiAgICAgICAgICAgICAgaWYobl9zaWRlID09PSAoZGV0ID4gMCkpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZihkZXQgIT09IDApIHtcbiAgICAgICAgICAgICAgICBpZihmbGlwcGVkID09PSBuX3NpZGUpIHtcbiAgICAgICAgICAgICAgICAgIGZhY2VzLnB1c2goWyBzdGFja1t0b3AtM10sIHN0YWNrW3RvcC02XSwgaWR4LCBjIF0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBmYWNlcy5wdXNoKFsgc3RhY2tbdG9wLTZdLCBzdGFja1t0b3AtM10sIGlkeCwgYyBdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdG9wIC09IDM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vUHVzaCB2ZXJ0ZXhcbiAgICAgICAgICBzdGFja1t0b3ArK10gPSBpZHg7XG4gICAgICAgICAgc3RhY2tbdG9wKytdID0gdmVydFswXTtcbiAgICAgICAgICBzdGFja1t0b3ArK10gPSB2ZXJ0WzFdO1xuICAgICAgICAgIC8vVXBkYXRlIGxvb3AgaW5kZXhcbiAgICAgICAgICBpZihuX3NpZGUpIHtcbiAgICAgICAgICAgICsrcl9pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICArK2xfaTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2lkZSA9IG5fc2lkZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4geyB2ZXJ0aWNlczp2ZXJ0aWNlcywgZmFjZXM6ZmFjZXMgfTtcbn1cbn0pKCk7XG5cbmlmKGV4cG9ydHMpIHtcbiAgZXhwb3J0cy5tZXNoZXIgPSBNb25vdG9uZU1lc2g7XG59XG4iLCIvL1RoZSBzdHVwaWRlc3QgcG9zc2libGUgd2F5IHRvIGdlbmVyYXRlIGEgTWluZWNyYWZ0IG1lc2ggKEkgdGhpbmspXG5mdW5jdGlvbiBTdHVwaWRNZXNoKHZvbHVtZSwgZGltcykge1xuICB2YXIgdmVydGljZXMgPSBbXSwgZmFjZXMgPSBbXSwgeCA9IFswLDAsMF0sIG4gPSAwO1xuICBmb3IoeFsyXT0wOyB4WzJdPGRpbXNbMl07ICsreFsyXSlcbiAgZm9yKHhbMV09MDsgeFsxXTxkaW1zWzFdOyArK3hbMV0pXG4gIGZvcih4WzBdPTA7IHhbMF08ZGltc1swXTsgKyt4WzBdLCArK24pXG4gIGlmKCEhdm9sdW1lW25dKSB7XG4gICAgZm9yKHZhciBkPTA7IGQ8MzsgKytkKSB7XG4gICAgICB2YXIgdCA9IFt4WzBdLCB4WzFdLCB4WzJdXVxuICAgICAgICAsIHUgPSBbMCwwLDBdXG4gICAgICAgICwgdiA9IFswLDAsMF07XG4gICAgICB1WyhkKzEpJTNdID0gMTtcbiAgICAgIHZbKGQrMiklM10gPSAxO1xuICAgICAgZm9yKHZhciBzPTA7IHM8MjsgKytzKSB7XG4gICAgICAgIHRbZF0gPSB4W2RdICsgcztcbiAgICAgICAgdmFyIHRtcCA9IHU7XG4gICAgICAgIHUgPSB2O1xuICAgICAgICB2ID0gdG1wO1xuICAgICAgICB2YXIgdmVydGV4X2NvdW50ID0gdmVydGljZXMubGVuZ3RoO1xuICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt0WzBdLCAgICAgICAgICAgdFsxXSwgICAgICAgICAgIHRbMl0gICAgICAgICAgXSk7XG4gICAgICAgIHZlcnRpY2VzLnB1c2goW3RbMF0rdVswXSwgICAgICB0WzFdK3VbMV0sICAgICAgdFsyXSt1WzJdICAgICBdKTtcbiAgICAgICAgdmVydGljZXMucHVzaChbdFswXSt1WzBdK3ZbMF0sIHRbMV0rdVsxXSt2WzFdLCB0WzJdK3VbMl0rdlsyXV0pO1xuICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt0WzBdICAgICArdlswXSwgdFsxXSAgICAgK3ZbMV0sIHRbMl0gICAgICt2WzJdXSk7XG4gICAgICAgIGZhY2VzLnB1c2goW3ZlcnRleF9jb3VudCwgdmVydGV4X2NvdW50KzEsIHZlcnRleF9jb3VudCsyLCB2ZXJ0ZXhfY291bnQrMywgdm9sdW1lW25dXSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiB7IHZlcnRpY2VzOnZlcnRpY2VzLCBmYWNlczpmYWNlcyB9O1xufVxuXG5cbmlmKGV4cG9ydHMpIHtcbiAgZXhwb3J0cy5tZXNoZXIgPSBTdHVwaWRNZXNoO1xufVxuIiwidmFyIEdyZWVkeU1lc2ggPSAoZnVuY3Rpb24gZ3JlZWR5TG9hZGVyKCkge1xuICAgIFxuLy8gY29udGFpbnMgYWxsIGZvcndhcmQgZmFjZXMgKGluIHRlcm1zIG9mIHNjYW4gZGlyZWN0aW9uKVxudmFyIG1hc2sgPSBuZXcgSW50MzJBcnJheSg0MDk2KTtcbi8vIGFuZCBhbGwgYmFja3dhcmRzIGZhY2VzLiBuZWVkZWQgd2hlbiB0aGVyZSBhcmUgdHdvIHRyYW5zcGFyZW50IGJsb2Nrc1xuLy8gbmV4dCB0byBlYWNoIG90aGVyLlxudmFyIGludk1hc2sgPSBuZXcgSW50MzJBcnJheSg0MDk2KTtcblxuLy8gMzJiaXTjga7jg5zjgq/jgrvjg6tJROOBp+ihqOePvuOBleOCjOOCi+OCueODmuODvOOCueOBruOBhuOBoeOAgeacgOS4iuS9jeODk+ODg+ODiOOBr+mAj+aYjuODleODqeOCsOOBqOOBmeOCi1xudmFyIGtUcmFuc3BhcmVudE1hc2sgICAgPSAweDgwMDAwMDAwO1xuLy8gMzJiaXTjga7jg5zjgq/jgrvjg6tJROOBp+ihqOePvuOBleOCjOOCi+OCueODmuODvOOCueOBruOBhuOBoeOAgeaui+OCiuOBrjPjg5Pjg4Pjg4jjga/jg5zjgq/jgrvjg6vjga7mraPpnaLmlrnlkJHjgpLmjIflrprjgZnjgovjg5Xjg6njgrDjgajjgZnjgotcbnZhciBrRmFjZURpcmVjdGlvbk1hc2tcdD0gMHg3MDAwMDAwMDtcbnZhciBrTm9GbGFnc01hc2sgICAgICAgID0gMHgwRkZGRkZGRjtcblxuZnVuY3Rpb24gaXNUcmFuc3BhcmVudCh2KSB7XG4gIHJldHVybiAodiAmIGtUcmFuc3BhcmVudE1hc2spID09PSBrVHJhbnNwYXJlbnRNYXNrO1xufVxuXG5mdW5jdGlvbiByZW1vdmVGbGFncyh2KSB7XG4gIHJldHVybiAodiAmIGtOb0ZsYWdzTWFzayk7XG59XG5cbnJldHVybiBmdW5jdGlvbiBvaFNvR3JlZWR5TWVzaGVyKHZvbHVtZSwgZGltcywgbWVzaGVyRXh0cmFEYXRhKSB7XG4gIHZhciB2ZXJ0aWNlcyA9IFtdLCBmYWNlcyA9IFtdXG4gICAgLCBkaW1zWCA9IGRpbXNbMF1cbiAgICAsIGRpbXNZID0gZGltc1sxXVxuICAgICwgZGltc1hZID0gZGltc1ggKiBkaW1zWTtcblxuICB2YXIgdFZlcnRpY2VzID0gW10sIHRGYWNlcyA9IFtdXG5cbiAgdmFyIHRyYW5zcGFyZW50VHlwZXMgPSBtZXNoZXJFeHRyYURhdGEgPyAobWVzaGVyRXh0cmFEYXRhLnRyYW5zcGFyZW50VHlwZXMgfHwge30pIDoge307XG4gIHZhciBnZXRUeXBlID0gZnVuY3Rpb24odm94ZWxzLCBvZmZzZXQpIHtcbiAgICB2YXIgdHlwZSA9IHZveGVsc1tvZmZzZXRdO1xuICAgIHJldHVybiB0eXBlIHwgKHR5cGUgaW4gdHJhbnNwYXJlbnRUeXBlcyA/IGtUcmFuc3BhcmVudE1hc2sgOiAwKTtcbiAgfVxuXG5cbiAgLy9Td2VlcCBvdmVyIDMtYXhlc1xuICBmb3IodmFyIGQ9MDsgZDwzOyArK2QpIHtcbiAgICB2YXIgaSwgaiwgaywgbCwgdywgVywgaCwgbiwgY1xuICAgICAgLCB1ID0gKGQrMSklMyAvL2QgPT09IDAgPyAyIDogZCA9PT0gMSA/IDIgOiAwXG4gICAgICAsIHYgPSAoZCsyKSUzIC8vZCA9PT0gMCA/IDEgOiBkID09PSAxID8gMCA6IDFcbiAgICAgICwgeCA9IFswLDAsMF1cbiAgICAgICwgcSA9IFswLDAsMF1cbiAgICAgICwgZHUgPSBbMCwwLDBdXG4gICAgICAsIGR2ID0gWzAsMCwwXVxuICAgICAgLCBkaW1zRCA9IGRpbXNbZF1cbiAgICAgICwgZGltc1UgPSBkaW1zW3VdXG4gICAgICAsIGRpbXNWID0gZGltc1t2XVxuICAgICAgLCBxZGltc1gsIHFkaW1zWFlcbiAgICAgICwgeGRcblxuICAgIGlmIChtYXNrLmxlbmd0aCA8IGRpbXNVICogZGltc1YpIHtcbiAgICAgIG1hc2sgPSBuZXcgSW50MzJBcnJheShkaW1zVSAqIGRpbXNWKTtcbiAgICAgIGludk1hc2sgPSBuZXcgSW50MzJBcnJheShkaW1zVSAqIGRpbXNWKTtcbiAgICB9XG5cbiAgICBxW2RdID0gIDE7XG4gICAgeFtkXSA9IC0xO1xuXG4gICAgcWRpbXNYICA9IGRpbXNYICAqIHFbMV1cbiAgICBxZGltc1hZID0gZGltc1hZICogcVsyXVxuXG4gICAgLy8gQ29tcHV0ZSBtYXNrXG4gICAgd2hpbGUgKHhbZF0gPCBkaW1zRCkge1xuICAgICAgeGQgPSB4W2RdXG4gICAgICBuID0gMDtcblxuICAgICAgZm9yKHhbdl0gPSAwOyB4W3ZdIDwgZGltc1Y7ICsreFt2XSkge1xuICAgICAgICBmb3IoeFt1XSA9IDA7IHhbdV0gPCBkaW1zVTsgKyt4W3VdLCArK24pIHtcbiAgICAgICAgICAvLyBNb2RpZmllZCB0byByZWFkIHRocm91Z2ggZ2V0VHlwZSgpXG4gICAgICAgICAgdmFyIGEgPSB4ZCA+PSAwICAgICAgJiYgZ2V0VHlwZSh2b2x1bWUsIHhbMF0gICAgICArIGRpbXNYICogeFsxXSAgICAgICAgICArIGRpbXNYWSAqIHhbMl0gICAgICAgICAgKVxuICAgICAgICAgICAgLCBiID0geGQgPCBkaW1zRC0xICYmIGdldFR5cGUodm9sdW1lLCB4WzBdK3FbMF0gKyBkaW1zWCAqIHhbMV0gKyBxZGltc1ggKyBkaW1zWFkgKiB4WzJdICsgcWRpbXNYWSlcblxuICAgICAgICAgIGlmIChpc1RyYW5zcGFyZW50KGEpICYmIGlzVHJhbnNwYXJlbnQoYikpIHtcbiAgICAgICAgICAgIGlmIChhICE9PSBiKSB7XG4gICAgICAgICAgICAgIC8vIOS4oemdouOBjOmAj+aYjuOBoOOBjOOAgeOBneOCjOOBnuOCjOOBrue0oOadkOOBjOmBleOBhuOBn+OCgeOAgeS4oemdouOBqOOCguaPj+eUu+OBmeOCi1xuICAgICAgICAgICAgICBtYXNrW25dID0gYTtcbiAgICAgICAgICAgICAgaW52TWFza1tuXSA9IGI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgLy8g5Lih6Z2i44GM6YCP5piO44Gn44GL44Gk5ZCM44GY57Sg5p2Q44Gq44Gu44Gn44CB5o+P55S744GX44Gq44GEXG4gICAgICAgICAgICAgIG1hc2tbbl0gPSAwO1xuICAgICAgICAgICAgICBpbnZNYXNrW25dID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKGEgJiYgKCFiIHx8IGlzVHJhbnNwYXJlbnQoYikpKSB7XG4gICAgICAgICAgICAvLyBh44GM5LiN6YCP5piO44GnYuOBjOWtmOWcqOOBl+OBquOBhOOBi+WNiumAj+aYjlxuICAgICAgICAgICAgbWFza1tuXSA9IGE7XG4gICAgICAgICAgICBpbnZNYXNrW25dID0gMFxuICAgICAgICAgIH0gZWxzZSBpZiAoYiAmJiAoIWEgfHwgaXNUcmFuc3BhcmVudChhKSkpIHtcbiAgICAgICAgICAgIC8vIGLjgYzkuI3pgI/mmI7jgadh44GM5a2Y5Zyo44GX44Gq44GE44GL5Y2K6YCP5piOXG4gICAgICAgICAgICBtYXNrW25dID0gMFxuICAgICAgICAgICAgaW52TWFza1tuXSA9IGI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIOaPj+eUu+OBruW/heimgeOBquOBl1xuICAgICAgICAgICAgbWFza1tuXSA9IDBcbiAgICAgICAgICAgIGludk1hc2tbbl0gPSAwXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgICsreFtkXTtcblxuICAgICAgLy8gR2VuZXJhdGUgbWVzaCBmb3IgbWFzayB1c2luZyBsZXhpY29ncmFwaGljIG9yZGVyaW5nXG4gICAgICBmdW5jdGlvbiBnZW5lcmF0ZU1lc2gobWFzaywgZGltc1YsIGRpbXNVLCB2ZXJ0aWNlcywgZmFjZXMsIGNsb2Nrd2lzZSkge1xuICAgICAgICBjbG9ja3dpc2UgPSBjbG9ja3dpc2UgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBjbG9ja3dpc2U7XG4gICAgICAgIHZhciBuLCBqLCBpLCBjLCB3LCBoLCBrLCBkdSA9IFswLDAsMF0sIGR2ID0gWzAsMCwwXTtcbiAgICAgICAgbiA9IDA7XG4gICAgICAgIGZvciAoaj0wOyBqIDwgZGltc1Y7ICsraikge1xuICAgICAgICAgIGZvciAoaT0wOyBpIDwgZGltc1U7ICkge1xuICAgICAgICAgICAgYyA9IG1hc2tbbl07XG4gICAgICAgICAgICBpZiAoIWMpIHtcbiAgICAgICAgICAgICAgaSsrOyAgbisrOyBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9Db21wdXRlIHdpZHRoXG4gICAgICAgICAgICB3ID0gMTtcbiAgICAgICAgICAgIHdoaWxlIChjID09PSBtYXNrW24rd10gJiYgaSt3IDwgZGltc1UpIHcrKztcblxuICAgICAgICAgICAgLy9Db21wdXRlIGhlaWdodCAodGhpcyBpcyBzbGlnaHRseSBhd2t3YXJkKVxuICAgICAgICAgICAgZm9yIChoPTE7IGoraCA8IGRpbXNWOyArK2gpIHtcbiAgICAgICAgICAgICAgayA9IDA7XG4gICAgICAgICAgICAgIHdoaWxlIChrIDwgdyAmJiBjID09PSBtYXNrW24raytoKmRpbXNVXSkgaysrXG4gICAgICAgICAgICAgIGlmIChrIDwgdykgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEFkZCBxdWFkXG4gICAgICAgICAgICAvLyBUaGUgZHUvZHYgYXJyYXlzIGFyZSByZXVzZWQvcmVzZXRcbiAgICAgICAgICAgIC8vIGZvciBlYWNoIGl0ZXJhdGlvbi5cbiAgICAgICAgICAgIGR1W2RdID0gMDsgZHZbZF0gPSAwO1xuICAgICAgICAgICAgeFt1XSAgPSBpOyAgeFt2XSA9IGo7XG5cbiAgICAgICAgICAgIGlmIChjbG9ja3dpc2UpIHtcbiAgICAgICAgICAgIC8vIGlmIChjID4gMCkge1xuICAgICAgICAgICAgICBkdlt2XSA9IGg7IGR2W3VdID0gMDtcbiAgICAgICAgICAgICAgZHVbdV0gPSB3OyBkdVt2XSA9IDA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBjID0gLWM7XG4gICAgICAgICAgICAgIGR1W3ZdID0gaDsgZHVbdV0gPSAwO1xuICAgICAgICAgICAgICBkdlt1XSA9IHc7IGR2W3ZdID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmFyIHZlcnRleF9jb3VudFxuICAgICAgICAgICAgaWYgKCFpc1RyYW5zcGFyZW50KGMpKSB7XG4gICAgICAgICAgICAgIC8vIOS4jemAj+aYjuOBqumggueCueOBqOmdouOBqOOBl+OBpuODkOODg+ODleOCoeOBq+WApOOCkui/veWKoFxuICAgICAgICAgICAgICB2ZXJ0ZXhfY291bnQgPSB2ZXJ0aWNlcy5sZW5ndGg7XG4gICAgICAgICAgICAgIHZlcnRpY2VzLnB1c2goW3hbMF0sICAgICAgICAgICAgIHhbMV0sICAgICAgICAgICAgIHhbMl0gICAgICAgICAgICBdKTtcbiAgICAgICAgICAgICAgdmVydGljZXMucHVzaChbeFswXStkdVswXSwgICAgICAgeFsxXStkdVsxXSwgICAgICAgeFsyXStkdVsyXSAgICAgIF0pO1xuICAgICAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt4WzBdK2R1WzBdK2R2WzBdLCB4WzFdK2R1WzFdK2R2WzFdLCB4WzJdK2R1WzJdK2R2WzJdXSk7XG4gICAgICAgICAgICAgIHZlcnRpY2VzLnB1c2goW3hbMF0gICAgICArZHZbMF0sIHhbMV0gICAgICArZHZbMV0sIHhbMl0gICAgICArZHZbMl1dKTtcbiAgICAgICAgICAgICAgZmFjZXMucHVzaChbdmVydGV4X2NvdW50LCB2ZXJ0ZXhfY291bnQrMSwgdmVydGV4X2NvdW50KzIsIHZlcnRleF9jb3VudCszLCBjXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyDpgI/mmI7jgarpoILngrnjgajpnaLjgajjgZfjgabjg5Djg4Pjg5XjgqHjgavlgKTjgpLov73liqBcbiAgICAgICAgICAgICAgIHZlcnRleF9jb3VudCA9IHRWZXJ0aWNlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICB0VmVydGljZXMucHVzaChbeFswXSwgICAgICAgICAgICAgeFsxXSwgICAgICAgICAgICAgeFsyXSAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgICAgdFZlcnRpY2VzLnB1c2goW3hbMF0rZHVbMF0sICAgICAgIHhbMV0rZHVbMV0sICAgICAgIHhbMl0rZHVbMl0gICAgICBdKTtcbiAgICAgICAgICAgICAgIHRWZXJ0aWNlcy5wdXNoKFt4WzBdK2R1WzBdK2R2WzBdLCB4WzFdK2R1WzFdK2R2WzFdLCB4WzJdK2R1WzJdK2R2WzJdXSk7XG4gICAgICAgICAgICAgICB0VmVydGljZXMucHVzaChbeFswXSAgICAgICtkdlswXSwgeFsxXSAgICAgICtkdlsxXSwgeFsyXSAgICAgICtkdlsyXV0pO1xuICAgICAgICAgICAgICAgdEZhY2VzLnB1c2goW3ZlcnRleF9jb3VudCwgdmVydGV4X2NvdW50KzEsIHZlcnRleF9jb3VudCsyLCB2ZXJ0ZXhfY291bnQrMywgY10pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL1plcm8tb3V0IG1hc2tcbiAgICAgICAgICAgIFcgPSBuICsgdztcbiAgICAgICAgICAgIGZvcihsPTA7IGw8aDsgKytsKSB7XG4gICAgICAgICAgICAgIGZvcihrPW47IGs8VzsgKytrKSB7XG4gICAgICAgICAgICAgICAgbWFza1trK2wqZGltc1VdID0gMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL0luY3JlbWVudCBjb3VudGVycyBhbmQgY29udGludWVcbiAgICAgICAgICAgIGkgKz0gdzsgbiArPSB3O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZ2VuZXJhdGVNZXNoKG1hc2ssIGRpbXNWLCBkaW1zVSwgdmVydGljZXMsIGZhY2VzLCB0cnVlKVxuICAgICAgZ2VuZXJhdGVNZXNoKGludk1hc2ssIGRpbXNWLCBkaW1zVSwgdmVydGljZXMsIGZhY2VzLCBmYWxzZSlcbiAgICB9XG4gIH1cbiAgXG4gIC8vIOmAj+aYjumDqOWIhuOBqOS4jemAj+aYjumDqOWIhuOCkuWIhumbouOBl+OBn+eKtuaFi+OBp+i/lOOBmVxuICByZXR1cm4geyB2ZXJ0aWNlczp2ZXJ0aWNlcywgdFZlcnRpY2VzOiB0VmVydGljZXMsIGZhY2VzOmZhY2VzLCB0RmFjZXM6IHRGYWNlcyB9XG59XG59KSgpO1xuXG5pZihleHBvcnRzKSB7XG4gIGV4cG9ydHMubWVzaGVyID0gR3JlZWR5TWVzaDtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gaW5oZXJpdHNcblxuZnVuY3Rpb24gaW5oZXJpdHMgKGMsIHAsIHByb3RvKSB7XG4gIHByb3RvID0gcHJvdG8gfHwge31cbiAgdmFyIGUgPSB7fVxuICA7W2MucHJvdG90eXBlLCBwcm90b10uZm9yRWFjaChmdW5jdGlvbiAocykge1xuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHMpLmZvckVhY2goZnVuY3Rpb24gKGspIHtcbiAgICAgIGVba10gPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHMsIGspXG4gICAgfSlcbiAgfSlcbiAgYy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHAucHJvdG90eXBlLCBlKVxuICBjLnN1cGVyID0gcFxufVxuXG4vL2Z1bmN0aW9uIENoaWxkICgpIHtcbi8vICBDaGlsZC5zdXBlci5jYWxsKHRoaXMpXG4vLyAgY29uc29sZS5lcnJvcihbdGhpc1xuLy8gICAgICAgICAgICAgICAgLHRoaXMuY29uc3RydWN0b3Jcbi8vICAgICAgICAgICAgICAgICx0aGlzLmNvbnN0cnVjdG9yID09PSBDaGlsZFxuLy8gICAgICAgICAgICAgICAgLHRoaXMuY29uc3RydWN0b3Iuc3VwZXIgPT09IFBhcmVudFxuLy8gICAgICAgICAgICAgICAgLE9iamVjdC5nZXRQcm90b3R5cGVPZih0aGlzKSA9PT0gQ2hpbGQucHJvdG90eXBlXG4vLyAgICAgICAgICAgICAgICAsT2JqZWN0LmdldFByb3RvdHlwZU9mKE9iamVjdC5nZXRQcm90b3R5cGVPZih0aGlzKSlcbi8vICAgICAgICAgICAgICAgICA9PT0gUGFyZW50LnByb3RvdHlwZVxuLy8gICAgICAgICAgICAgICAgLHRoaXMgaW5zdGFuY2VvZiBDaGlsZFxuLy8gICAgICAgICAgICAgICAgLHRoaXMgaW5zdGFuY2VvZiBQYXJlbnRdKVxuLy99XG4vL2Z1bmN0aW9uIFBhcmVudCAoKSB7fVxuLy9pbmhlcml0cyhDaGlsZCwgUGFyZW50KVxuLy9uZXcgQ2hpbGRcbiIsInZhciBpb3RhID0gcmVxdWlyZShcImlvdGEtYXJyYXlcIilcbnZhciBpc0J1ZmZlciA9IHJlcXVpcmUoXCJpcy1idWZmZXJcIilcblxudmFyIGhhc1R5cGVkQXJyYXlzICA9ICgodHlwZW9mIEZsb2F0NjRBcnJheSkgIT09IFwidW5kZWZpbmVkXCIpXG5cbmZ1bmN0aW9uIGNvbXBhcmUxc3QoYSwgYikge1xuICByZXR1cm4gYVswXSAtIGJbMF1cbn1cblxuZnVuY3Rpb24gb3JkZXIoKSB7XG4gIHZhciBzdHJpZGUgPSB0aGlzLnN0cmlkZVxuICB2YXIgdGVybXMgPSBuZXcgQXJyYXkoc3RyaWRlLmxlbmd0aClcbiAgdmFyIGlcbiAgZm9yKGk9MDsgaTx0ZXJtcy5sZW5ndGg7ICsraSkge1xuICAgIHRlcm1zW2ldID0gW01hdGguYWJzKHN0cmlkZVtpXSksIGldXG4gIH1cbiAgdGVybXMuc29ydChjb21wYXJlMXN0KVxuICB2YXIgcmVzdWx0ID0gbmV3IEFycmF5KHRlcm1zLmxlbmd0aClcbiAgZm9yKGk9MDsgaTxyZXN1bHQubGVuZ3RoOyArK2kpIHtcbiAgICByZXN1bHRbaV0gPSB0ZXJtc1tpXVsxXVxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cblxuZnVuY3Rpb24gY29tcGlsZUNvbnN0cnVjdG9yKGR0eXBlLCBkaW1lbnNpb24pIHtcbiAgdmFyIGNsYXNzTmFtZSA9IFtcIlZpZXdcIiwgZGltZW5zaW9uLCBcImRcIiwgZHR5cGVdLmpvaW4oXCJcIilcbiAgaWYoZGltZW5zaW9uIDwgMCkge1xuICAgIGNsYXNzTmFtZSA9IFwiVmlld19OaWxcIiArIGR0eXBlXG4gIH1cbiAgdmFyIHVzZUdldHRlcnMgPSAoZHR5cGUgPT09IFwiZ2VuZXJpY1wiKVxuXG4gIGlmKGRpbWVuc2lvbiA9PT0gLTEpIHtcbiAgICAvL1NwZWNpYWwgY2FzZSBmb3IgdHJpdmlhbCBhcnJheXNcbiAgICB2YXIgY29kZSA9XG4gICAgICBcImZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIihhKXt0aGlzLmRhdGE9YTt9O1xcXG52YXIgcHJvdG89XCIrY2xhc3NOYW1lK1wiLnByb3RvdHlwZTtcXFxucHJvdG8uZHR5cGU9J1wiK2R0eXBlK1wiJztcXFxucHJvdG8uaW5kZXg9ZnVuY3Rpb24oKXtyZXR1cm4gLTF9O1xcXG5wcm90by5zaXplPTA7XFxcbnByb3RvLmRpbWVuc2lvbj0tMTtcXFxucHJvdG8uc2hhcGU9cHJvdG8uc3RyaWRlPXByb3RvLm9yZGVyPVtdO1xcXG5wcm90by5sbz1wcm90by5oaT1wcm90by50cmFuc3Bvc2U9cHJvdG8uc3RlcD1cXFxuZnVuY3Rpb24oKXtyZXR1cm4gbmV3IFwiK2NsYXNzTmFtZStcIih0aGlzLmRhdGEpO307XFxcbnByb3RvLmdldD1wcm90by5zZXQ9ZnVuY3Rpb24oKXt9O1xcXG5wcm90by5waWNrPWZ1bmN0aW9uKCl7cmV0dXJuIG51bGx9O1xcXG5yZXR1cm4gZnVuY3Rpb24gY29uc3RydWN0X1wiK2NsYXNzTmFtZStcIihhKXtyZXR1cm4gbmV3IFwiK2NsYXNzTmFtZStcIihhKTt9XCJcbiAgICB2YXIgcHJvY2VkdXJlID0gbmV3IEZ1bmN0aW9uKGNvZGUpXG4gICAgcmV0dXJuIHByb2NlZHVyZSgpXG4gIH0gZWxzZSBpZihkaW1lbnNpb24gPT09IDApIHtcbiAgICAvL1NwZWNpYWwgY2FzZSBmb3IgMGQgYXJyYXlzXG4gICAgdmFyIGNvZGUgPVxuICAgICAgXCJmdW5jdGlvbiBcIitjbGFzc05hbWUrXCIoYSxkKSB7XFxcbnRoaXMuZGF0YSA9IGE7XFxcbnRoaXMub2Zmc2V0ID0gZFxcXG59O1xcXG52YXIgcHJvdG89XCIrY2xhc3NOYW1lK1wiLnByb3RvdHlwZTtcXFxucHJvdG8uZHR5cGU9J1wiK2R0eXBlK1wiJztcXFxucHJvdG8uaW5kZXg9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5vZmZzZXR9O1xcXG5wcm90by5kaW1lbnNpb249MDtcXFxucHJvdG8uc2l6ZT0xO1xcXG5wcm90by5zaGFwZT1cXFxucHJvdG8uc3RyaWRlPVxcXG5wcm90by5vcmRlcj1bXTtcXFxucHJvdG8ubG89XFxcbnByb3RvLmhpPVxcXG5wcm90by50cmFuc3Bvc2U9XFxcbnByb3RvLnN0ZXA9ZnVuY3Rpb24gXCIrY2xhc3NOYW1lK1wiX2NvcHkoKSB7XFxcbnJldHVybiBuZXcgXCIrY2xhc3NOYW1lK1wiKHRoaXMuZGF0YSx0aGlzLm9mZnNldClcXFxufTtcXFxucHJvdG8ucGljaz1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfcGljaygpe1xcXG5yZXR1cm4gVHJpdmlhbEFycmF5KHRoaXMuZGF0YSk7XFxcbn07XFxcbnByb3RvLnZhbHVlT2Y9cHJvdG8uZ2V0PWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9nZXQoKXtcXFxucmV0dXJuIFwiKyh1c2VHZXR0ZXJzID8gXCJ0aGlzLmRhdGEuZ2V0KHRoaXMub2Zmc2V0KVwiIDogXCJ0aGlzLmRhdGFbdGhpcy5vZmZzZXRdXCIpK1xuXCJ9O1xcXG5wcm90by5zZXQ9ZnVuY3Rpb24gXCIrY2xhc3NOYW1lK1wiX3NldCh2KXtcXFxucmV0dXJuIFwiKyh1c2VHZXR0ZXJzID8gXCJ0aGlzLmRhdGEuc2V0KHRoaXMub2Zmc2V0LHYpXCIgOiBcInRoaXMuZGF0YVt0aGlzLm9mZnNldF09dlwiKStcIlxcXG59O1xcXG5yZXR1cm4gZnVuY3Rpb24gY29uc3RydWN0X1wiK2NsYXNzTmFtZStcIihhLGIsYyxkKXtyZXR1cm4gbmV3IFwiK2NsYXNzTmFtZStcIihhLGQpfVwiXG4gICAgdmFyIHByb2NlZHVyZSA9IG5ldyBGdW5jdGlvbihcIlRyaXZpYWxBcnJheVwiLCBjb2RlKVxuICAgIHJldHVybiBwcm9jZWR1cmUoQ0FDSEVEX0NPTlNUUlVDVE9SU1tkdHlwZV1bMF0pXG4gIH1cblxuICB2YXIgY29kZSA9IFtcIid1c2Ugc3RyaWN0J1wiXVxuXG4gIC8vQ3JlYXRlIGNvbnN0cnVjdG9yIGZvciB2aWV3XG4gIHZhciBpbmRpY2VzID0gaW90YShkaW1lbnNpb24pXG4gIHZhciBhcmdzID0gaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkgeyByZXR1cm4gXCJpXCIraSB9KVxuICB2YXIgaW5kZXhfc3RyID0gXCJ0aGlzLm9mZnNldCtcIiArIGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgICAgcmV0dXJuIFwidGhpcy5zdHJpZGVbXCIgKyBpICsgXCJdKmlcIiArIGlcbiAgICAgIH0pLmpvaW4oXCIrXCIpXG4gIHZhciBzaGFwZUFyZyA9IGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBcImJcIitpXG4gICAgfSkuam9pbihcIixcIilcbiAgdmFyIHN0cmlkZUFyZyA9IGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBcImNcIitpXG4gICAgfSkuam9pbihcIixcIilcbiAgY29kZS5wdXNoKFxuICAgIFwiZnVuY3Rpb24gXCIrY2xhc3NOYW1lK1wiKGEsXCIgKyBzaGFwZUFyZyArIFwiLFwiICsgc3RyaWRlQXJnICsgXCIsZCl7dGhpcy5kYXRhPWFcIixcbiAgICAgIFwidGhpcy5zaGFwZT1bXCIgKyBzaGFwZUFyZyArIFwiXVwiLFxuICAgICAgXCJ0aGlzLnN0cmlkZT1bXCIgKyBzdHJpZGVBcmcgKyBcIl1cIixcbiAgICAgIFwidGhpcy5vZmZzZXQ9ZHwwfVwiLFxuICAgIFwidmFyIHByb3RvPVwiK2NsYXNzTmFtZStcIi5wcm90b3R5cGVcIixcbiAgICBcInByb3RvLmR0eXBlPSdcIitkdHlwZStcIidcIixcbiAgICBcInByb3RvLmRpbWVuc2lvbj1cIitkaW1lbnNpb24pXG5cbiAgLy92aWV3LnNpemU6XG4gIGNvZGUucHVzaChcIk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywnc2l6ZScse2dldDpmdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfc2l6ZSgpe1xcXG5yZXR1cm4gXCIraW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkgeyByZXR1cm4gXCJ0aGlzLnNoYXBlW1wiK2krXCJdXCIgfSkuam9pbihcIipcIiksXG5cIn19KVwiKVxuXG4gIC8vdmlldy5vcmRlcjpcbiAgaWYoZGltZW5zaW9uID09PSAxKSB7XG4gICAgY29kZS5wdXNoKFwicHJvdG8ub3JkZXI9WzBdXCIpXG4gIH0gZWxzZSB7XG4gICAgY29kZS5wdXNoKFwiT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCdvcmRlcicse2dldDpcIilcbiAgICBpZihkaW1lbnNpb24gPCA0KSB7XG4gICAgICBjb2RlLnB1c2goXCJmdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfb3JkZXIoKXtcIilcbiAgICAgIGlmKGRpbWVuc2lvbiA9PT0gMikge1xuICAgICAgICBjb2RlLnB1c2goXCJyZXR1cm4gKE1hdGguYWJzKHRoaXMuc3RyaWRlWzBdKT5NYXRoLmFicyh0aGlzLnN0cmlkZVsxXSkpP1sxLDBdOlswLDFdfX0pXCIpXG4gICAgICB9IGVsc2UgaWYoZGltZW5zaW9uID09PSAzKSB7XG4gICAgICAgIGNvZGUucHVzaChcblwidmFyIHMwPU1hdGguYWJzKHRoaXMuc3RyaWRlWzBdKSxzMT1NYXRoLmFicyh0aGlzLnN0cmlkZVsxXSksczI9TWF0aC5hYnModGhpcy5zdHJpZGVbMl0pO1xcXG5pZihzMD5zMSl7XFxcbmlmKHMxPnMyKXtcXFxucmV0dXJuIFsyLDEsMF07XFxcbn1lbHNlIGlmKHMwPnMyKXtcXFxucmV0dXJuIFsxLDIsMF07XFxcbn1lbHNle1xcXG5yZXR1cm4gWzEsMCwyXTtcXFxufVxcXG59ZWxzZSBpZihzMD5zMil7XFxcbnJldHVybiBbMiwwLDFdO1xcXG59ZWxzZSBpZihzMj5zMSl7XFxcbnJldHVybiBbMCwxLDJdO1xcXG59ZWxzZXtcXFxucmV0dXJuIFswLDIsMV07XFxcbn19fSlcIilcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29kZS5wdXNoKFwiT1JERVJ9KVwiKVxuICAgIH1cbiAgfVxuXG4gIC8vdmlldy5zZXQoaTAsIC4uLiwgdik6XG4gIGNvZGUucHVzaChcblwicHJvdG8uc2V0PWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9zZXQoXCIrYXJncy5qb2luKFwiLFwiKStcIix2KXtcIilcbiAgaWYodXNlR2V0dGVycykge1xuICAgIGNvZGUucHVzaChcInJldHVybiB0aGlzLmRhdGEuc2V0KFwiK2luZGV4X3N0citcIix2KX1cIilcbiAgfSBlbHNlIHtcbiAgICBjb2RlLnB1c2goXCJyZXR1cm4gdGhpcy5kYXRhW1wiK2luZGV4X3N0citcIl09dn1cIilcbiAgfVxuXG4gIC8vdmlldy5nZXQoaTAsIC4uLik6XG4gIGNvZGUucHVzaChcInByb3RvLmdldD1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfZ2V0KFwiK2FyZ3Muam9pbihcIixcIikrXCIpe1wiKVxuICBpZih1c2VHZXR0ZXJzKSB7XG4gICAgY29kZS5wdXNoKFwicmV0dXJuIHRoaXMuZGF0YS5nZXQoXCIraW5kZXhfc3RyK1wiKX1cIilcbiAgfSBlbHNlIHtcbiAgICBjb2RlLnB1c2goXCJyZXR1cm4gdGhpcy5kYXRhW1wiK2luZGV4X3N0citcIl19XCIpXG4gIH1cblxuICAvL3ZpZXcuaW5kZXg6XG4gIGNvZGUucHVzaChcbiAgICBcInByb3RvLmluZGV4PWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9pbmRleChcIiwgYXJncy5qb2luKCksIFwiKXtyZXR1cm4gXCIraW5kZXhfc3RyK1wifVwiKVxuXG4gIC8vdmlldy5oaSgpOlxuICBjb2RlLnB1c2goXCJwcm90by5oaT1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfaGkoXCIrYXJncy5qb2luKFwiLFwiKStcIil7cmV0dXJuIG5ldyBcIitjbGFzc05hbWUrXCIodGhpcy5kYXRhLFwiK1xuICAgIGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBbXCIodHlwZW9mIGlcIixpLFwiIT09J251bWJlcid8fGlcIixpLFwiPDApP3RoaXMuc2hhcGVbXCIsIGksIFwiXTppXCIsIGksXCJ8MFwiXS5qb2luKFwiXCIpXG4gICAgfSkuam9pbihcIixcIikrXCIsXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwidGhpcy5zdHJpZGVbXCIraSArIFwiXVwiXG4gICAgfSkuam9pbihcIixcIikrXCIsdGhpcy5vZmZzZXQpfVwiKVxuXG4gIC8vdmlldy5sbygpOlxuICB2YXIgYV92YXJzID0gaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkgeyByZXR1cm4gXCJhXCIraStcIj10aGlzLnNoYXBlW1wiK2krXCJdXCIgfSlcbiAgdmFyIGNfdmFycyA9IGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHsgcmV0dXJuIFwiY1wiK2krXCI9dGhpcy5zdHJpZGVbXCIraStcIl1cIiB9KVxuICBjb2RlLnB1c2goXCJwcm90by5sbz1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfbG8oXCIrYXJncy5qb2luKFwiLFwiKStcIil7dmFyIGI9dGhpcy5vZmZzZXQsZD0wLFwiK2FfdmFycy5qb2luKFwiLFwiKStcIixcIitjX3ZhcnMuam9pbihcIixcIikpXG4gIGZvcih2YXIgaT0wOyBpPGRpbWVuc2lvbjsgKytpKSB7XG4gICAgY29kZS5wdXNoKFxuXCJpZih0eXBlb2YgaVwiK2krXCI9PT0nbnVtYmVyJyYmaVwiK2krXCI+PTApe1xcXG5kPWlcIitpK1wifDA7XFxcbmIrPWNcIitpK1wiKmQ7XFxcbmFcIitpK1wiLT1kfVwiKVxuICB9XG4gIGNvZGUucHVzaChcInJldHVybiBuZXcgXCIrY2xhc3NOYW1lK1wiKHRoaXMuZGF0YSxcIitcbiAgICBpbmRpY2VzLm1hcChmdW5jdGlvbihpKSB7XG4gICAgICByZXR1cm4gXCJhXCIraVxuICAgIH0pLmpvaW4oXCIsXCIpK1wiLFwiK1xuICAgIGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBcImNcIitpXG4gICAgfSkuam9pbihcIixcIikrXCIsYil9XCIpXG5cbiAgLy92aWV3LnN0ZXAoKTpcbiAgY29kZS5wdXNoKFwicHJvdG8uc3RlcD1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfc3RlcChcIithcmdzLmpvaW4oXCIsXCIpK1wiKXt2YXIgXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwiYVwiK2krXCI9dGhpcy5zaGFwZVtcIitpK1wiXVwiXG4gICAgfSkuam9pbihcIixcIikrXCIsXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwiYlwiK2krXCI9dGhpcy5zdHJpZGVbXCIraStcIl1cIlxuICAgIH0pLmpvaW4oXCIsXCIpK1wiLGM9dGhpcy5vZmZzZXQsZD0wLGNlaWw9TWF0aC5jZWlsXCIpXG4gIGZvcih2YXIgaT0wOyBpPGRpbWVuc2lvbjsgKytpKSB7XG4gICAgY29kZS5wdXNoKFxuXCJpZih0eXBlb2YgaVwiK2krXCI9PT0nbnVtYmVyJyl7XFxcbmQ9aVwiK2krXCJ8MDtcXFxuaWYoZDwwKXtcXFxuYys9YlwiK2krXCIqKGFcIitpK1wiLTEpO1xcXG5hXCIraStcIj1jZWlsKC1hXCIraStcIi9kKVxcXG59ZWxzZXtcXFxuYVwiK2krXCI9Y2VpbChhXCIraStcIi9kKVxcXG59XFxcbmJcIitpK1wiKj1kXFxcbn1cIilcbiAgfVxuICBjb2RlLnB1c2goXCJyZXR1cm4gbmV3IFwiK2NsYXNzTmFtZStcIih0aGlzLmRhdGEsXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwiYVwiICsgaVxuICAgIH0pLmpvaW4oXCIsXCIpK1wiLFwiK1xuICAgIGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBcImJcIiArIGlcbiAgICB9KS5qb2luKFwiLFwiKStcIixjKX1cIilcblxuICAvL3ZpZXcudHJhbnNwb3NlKCk6XG4gIHZhciB0U2hhcGUgPSBuZXcgQXJyYXkoZGltZW5zaW9uKVxuICB2YXIgdFN0cmlkZSA9IG5ldyBBcnJheShkaW1lbnNpb24pXG4gIGZvcih2YXIgaT0wOyBpPGRpbWVuc2lvbjsgKytpKSB7XG4gICAgdFNoYXBlW2ldID0gXCJhW2lcIitpK1wiXVwiXG4gICAgdFN0cmlkZVtpXSA9IFwiYltpXCIraStcIl1cIlxuICB9XG4gIGNvZGUucHVzaChcInByb3RvLnRyYW5zcG9zZT1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfdHJhbnNwb3NlKFwiK2FyZ3MrXCIpe1wiK1xuICAgIGFyZ3MubWFwKGZ1bmN0aW9uKG4saWR4KSB7IHJldHVybiBuICsgXCI9KFwiICsgbiArIFwiPT09dW5kZWZpbmVkP1wiICsgaWR4ICsgXCI6XCIgKyBuICsgXCJ8MClcIn0pLmpvaW4oXCI7XCIpLFxuICAgIFwidmFyIGE9dGhpcy5zaGFwZSxiPXRoaXMuc3RyaWRlO3JldHVybiBuZXcgXCIrY2xhc3NOYW1lK1wiKHRoaXMuZGF0YSxcIit0U2hhcGUuam9pbihcIixcIikrXCIsXCIrdFN0cmlkZS5qb2luKFwiLFwiKStcIix0aGlzLm9mZnNldCl9XCIpXG5cbiAgLy92aWV3LnBpY2soKTpcbiAgY29kZS5wdXNoKFwicHJvdG8ucGljaz1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfcGljayhcIithcmdzK1wiKXt2YXIgYT1bXSxiPVtdLGM9dGhpcy5vZmZzZXRcIilcbiAgZm9yKHZhciBpPTA7IGk8ZGltZW5zaW9uOyArK2kpIHtcbiAgICBjb2RlLnB1c2goXCJpZih0eXBlb2YgaVwiK2krXCI9PT0nbnVtYmVyJyYmaVwiK2krXCI+PTApe2M9KGMrdGhpcy5zdHJpZGVbXCIraStcIl0qaVwiK2krXCIpfDB9ZWxzZXthLnB1c2godGhpcy5zaGFwZVtcIitpK1wiXSk7Yi5wdXNoKHRoaXMuc3RyaWRlW1wiK2krXCJdKX1cIilcbiAgfVxuICBjb2RlLnB1c2goXCJ2YXIgY3Rvcj1DVE9SX0xJU1RbYS5sZW5ndGgrMV07cmV0dXJuIGN0b3IodGhpcy5kYXRhLGEsYixjKX1cIilcblxuICAvL0FkZCByZXR1cm4gc3RhdGVtZW50XG4gIGNvZGUucHVzaChcInJldHVybiBmdW5jdGlvbiBjb25zdHJ1Y3RfXCIrY2xhc3NOYW1lK1wiKGRhdGEsc2hhcGUsc3RyaWRlLG9mZnNldCl7cmV0dXJuIG5ldyBcIitjbGFzc05hbWUrXCIoZGF0YSxcIitcbiAgICBpbmRpY2VzLm1hcChmdW5jdGlvbihpKSB7XG4gICAgICByZXR1cm4gXCJzaGFwZVtcIitpK1wiXVwiXG4gICAgfSkuam9pbihcIixcIikrXCIsXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwic3RyaWRlW1wiK2krXCJdXCJcbiAgICB9KS5qb2luKFwiLFwiKStcIixvZmZzZXQpfVwiKVxuXG4gIC8vQ29tcGlsZSBwcm9jZWR1cmVcbiAgdmFyIHByb2NlZHVyZSA9IG5ldyBGdW5jdGlvbihcIkNUT1JfTElTVFwiLCBcIk9SREVSXCIsIGNvZGUuam9pbihcIlxcblwiKSlcbiAgcmV0dXJuIHByb2NlZHVyZShDQUNIRURfQ09OU1RSVUNUT1JTW2R0eXBlXSwgb3JkZXIpXG59XG5cbmZ1bmN0aW9uIGFycmF5RFR5cGUoZGF0YSkge1xuICBpZihpc0J1ZmZlcihkYXRhKSkge1xuICAgIHJldHVybiBcImJ1ZmZlclwiXG4gIH1cbiAgaWYoaGFzVHlwZWRBcnJheXMpIHtcbiAgICBzd2l0Y2goT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGRhdGEpKSB7XG4gICAgICBjYXNlIFwiW29iamVjdCBGbG9hdDY0QXJyYXldXCI6XG4gICAgICAgIHJldHVybiBcImZsb2F0NjRcIlxuICAgICAgY2FzZSBcIltvYmplY3QgRmxvYXQzMkFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJmbG9hdDMyXCJcbiAgICAgIGNhc2UgXCJbb2JqZWN0IEludDhBcnJheV1cIjpcbiAgICAgICAgcmV0dXJuIFwiaW50OFwiXG4gICAgICBjYXNlIFwiW29iamVjdCBJbnQxNkFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJpbnQxNlwiXG4gICAgICBjYXNlIFwiW29iamVjdCBJbnQzMkFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJpbnQzMlwiXG4gICAgICBjYXNlIFwiW29iamVjdCBVaW50OEFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJ1aW50OFwiXG4gICAgICBjYXNlIFwiW29iamVjdCBVaW50MTZBcnJheV1cIjpcbiAgICAgICAgcmV0dXJuIFwidWludDE2XCJcbiAgICAgIGNhc2UgXCJbb2JqZWN0IFVpbnQzMkFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJ1aW50MzJcIlxuICAgICAgY2FzZSBcIltvYmplY3QgVWludDhDbGFtcGVkQXJyYXldXCI6XG4gICAgICAgIHJldHVybiBcInVpbnQ4X2NsYW1wZWRcIlxuICAgIH1cbiAgfVxuICBpZihBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgcmV0dXJuIFwiYXJyYXlcIlxuICB9XG4gIHJldHVybiBcImdlbmVyaWNcIlxufVxuXG52YXIgQ0FDSEVEX0NPTlNUUlVDVE9SUyA9IHtcbiAgXCJmbG9hdDMyXCI6W10sXG4gIFwiZmxvYXQ2NFwiOltdLFxuICBcImludDhcIjpbXSxcbiAgXCJpbnQxNlwiOltdLFxuICBcImludDMyXCI6W10sXG4gIFwidWludDhcIjpbXSxcbiAgXCJ1aW50MTZcIjpbXSxcbiAgXCJ1aW50MzJcIjpbXSxcbiAgXCJhcnJheVwiOltdLFxuICBcInVpbnQ4X2NsYW1wZWRcIjpbXSxcbiAgXCJidWZmZXJcIjpbXSxcbiAgXCJnZW5lcmljXCI6W11cbn1cblxuOyhmdW5jdGlvbigpIHtcbiAgZm9yKHZhciBpZCBpbiBDQUNIRURfQ09OU1RSVUNUT1JTKSB7XG4gICAgQ0FDSEVEX0NPTlNUUlVDVE9SU1tpZF0ucHVzaChjb21waWxlQ29uc3RydWN0b3IoaWQsIC0xKSlcbiAgfVxufSk7XG5cbmZ1bmN0aW9uIHdyYXBwZWROREFycmF5Q3RvcihkYXRhLCBzaGFwZSwgc3RyaWRlLCBvZmZzZXQpIHtcbiAgaWYoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdmFyIGN0b3IgPSBDQUNIRURfQ09OU1RSVUNUT1JTLmFycmF5WzBdXG4gICAgcmV0dXJuIGN0b3IoW10pXG4gIH0gZWxzZSBpZih0eXBlb2YgZGF0YSA9PT0gXCJudW1iZXJcIikge1xuICAgIGRhdGEgPSBbZGF0YV1cbiAgfVxuICBpZihzaGFwZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgc2hhcGUgPSBbIGRhdGEubGVuZ3RoIF1cbiAgfVxuICB2YXIgZCA9IHNoYXBlLmxlbmd0aFxuICBpZihzdHJpZGUgPT09IHVuZGVmaW5lZCkge1xuICAgIHN0cmlkZSA9IG5ldyBBcnJheShkKVxuICAgIGZvcih2YXIgaT1kLTEsIHN6PTE7IGk+PTA7IC0taSkge1xuICAgICAgc3RyaWRlW2ldID0gc3pcbiAgICAgIHN6ICo9IHNoYXBlW2ldXG4gICAgfVxuICB9XG4gIGlmKG9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgb2Zmc2V0ID0gMFxuICAgIGZvcih2YXIgaT0wOyBpPGQ7ICsraSkge1xuICAgICAgaWYoc3RyaWRlW2ldIDwgMCkge1xuICAgICAgICBvZmZzZXQgLT0gKHNoYXBlW2ldLTEpKnN0cmlkZVtpXVxuICAgICAgfVxuICAgIH1cbiAgfVxuICB2YXIgZHR5cGUgPSBhcnJheURUeXBlKGRhdGEpXG4gIHZhciBjdG9yX2xpc3QgPSBDQUNIRURfQ09OU1RSVUNUT1JTW2R0eXBlXVxuICB3aGlsZShjdG9yX2xpc3QubGVuZ3RoIDw9IGQrMSkge1xuICAgIGN0b3JfbGlzdC5wdXNoKGNvbXBpbGVDb25zdHJ1Y3RvcihkdHlwZSwgY3Rvcl9saXN0Lmxlbmd0aC0xKSlcbiAgfVxuICB2YXIgY3RvciA9IGN0b3JfbGlzdFtkKzFdXG4gIHJldHVybiBjdG9yKGRhdGEsIHNoYXBlLCBzdHJpZGUsIG9mZnNldClcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB3cmFwcGVkTkRBcnJheUN0b3JcbiIsIlwidXNlIHN0cmljdFwiXG5cbmZ1bmN0aW9uIGlvdGEobikge1xuICB2YXIgcmVzdWx0ID0gbmV3IEFycmF5KG4pXG4gIGZvcih2YXIgaT0wOyBpPG47ICsraSkge1xuICAgIHJlc3VsdFtpXSA9IGlcbiAgfVxuICByZXR1cm4gcmVzdWx0XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW90YSIsIi8qKlxuICogRGV0ZXJtaW5lIGlmIGFuIG9iamVjdCBpcyBCdWZmZXJcbiAqXG4gKiBBdXRob3I6ICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIExpY2Vuc2U6ICBNSVRcbiAqXG4gKiBgbnBtIGluc3RhbGwgaXMtYnVmZmVyYFxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaikge1xuICByZXR1cm4gISEob2JqICE9IG51bGwgJiZcbiAgICAob2JqLl9pc0J1ZmZlciB8fCAvLyBGb3IgU2FmYXJpIDUtNyAobWlzc2luZyBPYmplY3QucHJvdG90eXBlLmNvbnN0cnVjdG9yKVxuICAgICAgKG9iai5jb25zdHJ1Y3RvciAmJlxuICAgICAgdHlwZW9mIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlciA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyKG9iaikpXG4gICAgKSlcbn1cbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSBpZiAobGlzdGVuZXJzKSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24odHlwZSkge1xuICBpZiAodGhpcy5fZXZlbnRzKSB7XG4gICAgdmFyIGV2bGlzdGVuZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgICBpZiAoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlcbiAgICAgIHJldHVybiAxO1xuICAgIGVsc2UgaWYgKGV2bGlzdGVuZXIpXG4gICAgICByZXR1cm4gZXZsaXN0ZW5lci5sZW5ndGg7XG4gIH1cbiAgcmV0dXJuIDA7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJDb3VudCh0eXBlKTtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiJdfQ==
