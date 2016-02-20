(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
  var current = this.chunkAtPosition(position)
  return this.nearbyChunksCoordinate(current, distance);
}

Chunker.prototype.nearbyChunksCoordinate = function(center, distance) {
  var x = center[0]
  var y = center[1]
  var z = center[2]
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
  var position = [x, y, z]
  chunk.position = position
  chunk.empty = true
  this.chunks[position.join('|')] = chunk
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

// Added auto chunk generation function
Chunker.prototype.voxelAtCoordinates = function(x, y, z, val, auto) {
  var cpos = this.chunkAtCoordinates(x, y, z)
  var ckey = cpos.join('|')
  var chunk = this.chunks[ckey]
  if (chunk === undefined) {
      // If chunk is undefined and "void" is specified, don't create a new chunk.
      if (val === 0) return [0, null]
      if (auto && typeof val !== 'undefined') chunk = this.generateChunk(cpos[0], cpos[1], cpos[2])
      else return [0, null]
  } 
  var mask = this.chunkMask
  var h = this.chunkPadHalf
  var mx = x & mask
  var my = y & mask
  var mz = z & mask
  var v = chunk.get(mx+h, my+h, mz+h)
  if (typeof val !== 'undefined') {
    chunk.set(mx+h, my+h, mz+h, val)
    if (val !== 0x00) chunk.empty = false
  }
  return [v, chunk]
}

// Added auto chunk generation function
Chunker.prototype.voxelAtPosition = function(pos, val, auto) {
  var cubeSize = this.cubeSize;
  var x = Math.floor(pos[0] / cubeSize)
  var y = Math.floor(pos[1] / cubeSize)
  var z = Math.floor(pos[2] / cubeSize)
  var v = this.voxelAtCoordinates(x, y, z, val, auto)
  return v;
}


},{"events":13,"inherits":8}],2:[function(require,module,exports){
var chunker = require('./chunker')
var ndarray = require('ndarray')

module.exports = function(opts) {
  if (!opts.generateVoxelChunk) {
      opts.generateVoxelChunk = function(low, high) { return generate32(low, high, function(i, j, k) { return 0; }); }
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


},{"./chunker":1,"./meshers/culled":3,"./meshers/greedy":4,"./meshers/monotone":5,"./meshers/stupid":6,"./meshers/transgreedy":7,"ndarray":9}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
var GreedyMesh = (function() {
//Cache buffer internally
var mask = new Uint32Array(4096);
var maskDirection = new Array(4096);

return function(volume, dims) {
  var vertices = [], faces = []
    //, dimsX = dims[0]
    , dimsX = dims[2]
    , dimsY = dims[1]
    , dimsXY = dimsX * dimsY;
  
  //Sweep over 3-axes
  for(var d=0; d<3; ++d) {
    var i, j, k, l, w, W, h, n, c
      //, u = (d+1)%3
      //, v = (d+2)%3
      , u = (d+2)%3
      , v = (d+1)%3
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
      //mask = new Int32Array(dimsU * dimsV);
      mask = new Uint32Array(dimsU * dimsV);
      maskDirection = new Array(dimsU * dimsV);
    }

    q[d] =  1;
    x[d] = -1;

    qdimsX  = dimsX  * q[1]
    //qdimsXY = dimsXY * q[2]
    qdimsXY = dimsXY * q[0]

    // Compute mask
    while (x[d] < dimsD) {
      xd = x[d]
      n = 0;

      for(x[v] = 0; x[v] < dimsV; ++x[v]) {
        for(x[u] = 0; x[u] < dimsU; ++x[u], ++n) {
          //var a = xd >= 0      && volume[x[0]      + dimsX * x[1]          + dimsXY * x[2]          ]
          //  , b = xd < dimsD-1 && volume[x[0]+q[0] + dimsX * x[1] + qdimsX + dimsXY * x[2] + qdimsXY]
          var a = xd >= 0      && volume[x[2]      + dimsX * x[1]          + dimsXY * x[0]          ]
            , b = xd < dimsD-1 && volume[x[2]+q[2] + dimsX * x[1] + qdimsX + dimsXY * x[0] + qdimsXY]
          if (a ? b : !b) {
            mask[n] = 0;
            maskDirection[n] = 1;
            continue;
          }
          //mask[n] = a ? a : -b;
          // Color is now uint32.
          mask[n] = a ? a : b;
          maskDirection[n] = a ? 1: -1;
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
            // Store mask[n] rather than c. Because now mask[n] is Uint32.
            //c = -c;
            du[v] = h; du[u] = 0;
            dv[u] = w; dv[v] = 0;
          }
          var vertex_count = vertices.length;
          vertices.push([x[2],             x[1],             x[0]            ]);
          vertices.push([x[2]+du[2],       x[1]+du[1],       x[0]+du[0]      ]);
          vertices.push([x[2]+du[2]+dv[2], x[1]+du[1]+dv[1], x[0]+du[0]+dv[0]]);
          vertices.push([x[2]      +dv[2], x[1]      +dv[1], x[0]      +dv[0]]);
          
          //faces.push([vertex_count, vertex_count+1, vertex_count+2, vertex_count+3, c);
          faces.push([vertex_count, vertex_count+1, vertex_count+2, vertex_count+3, mask[n]]);
          
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

},{}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
//The stupidest possible way to generate a Minecraft mesh (I think)
function StupidMesh(volume, dims) {
  var vertices = [], faces = [], x = [0,0,0], n = 0;

  for(x[0]=0; x[0]<dims[0]; ++x[0])
  for(x[1]=0; x[1]<dims[1]; ++x[1])
  for(x[2]=0; x[2]<dims[2]; ++x[2], ++n)
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

},{}],7:[function(require,module,exports){
var GreedyMesh = (function greedyLoader() {
    
// contains all forward faces (in terms of scan direction)
var mask = new Int32Array(4096);
// and all backwards faces. needed when there are two transparent blocks
// next to each other.
var invMask = new Int32Array(4096);

// setting 16th bit if transparent
var kTransparentMask    = 0x3f;
//var kTransparentMask    = 0x8000;
var kNoFlagsMask        = 0x7FFF;
var kTransparentTypes   = [];

kTransparentTypes[16] = true

function isTransparent(v) {
  return ((v & kTransparentMask) !== kTransparentMask) && (v < 0x40000);
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
                  // both are transparent, add to both directions
                  mask[n] = a;
                  invMask[n] = b;
              }
              else {
                  // both are transparent, add to both directions
                  mask[n] = 0;
                  invMask[n] = 0;
              }
          } else if (a && (!b || isTransparent(b))) {
            mask[n] = a;
            invMask[n] = 0
          // if b is solid and a is not there or transparent
          } else if (b && (!a || isTransparent(a))) {
            mask[n] = 0
            invMask[n] = b;
          // dont draw this face
          } else {
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
            
            // ## enable code to ensure that transparent faces are last in the list
            var vertex_count
            if (!isTransparent(c)) {
              vertex_count = vertices.length;
              vertices.push([x[0],             x[1],             x[2]            ]);
              vertices.push([x[0]+du[0],       x[1]+du[1],       x[2]+du[2]      ]);
              vertices.push([x[0]+du[0]+dv[0], x[1]+du[1]+dv[1], x[2]+du[2]+dv[2]]);
              vertices.push([x[0]      +dv[0], x[1]      +dv[1], x[2]      +dv[2]]);
              //faces.push([vertex_count, vertex_count+1, vertex_count+2, vertex_count+3, removeFlags(c)]);
              faces.push([vertex_count, vertex_count+1, vertex_count+2, vertex_count+3, c]);
            } else {
               vertex_count = tVertices.length;
               tVertices.push([x[0],             x[1],             x[2]            ]);
               tVertices.push([x[0]+du[0],       x[1]+du[1],       x[2]+du[2]      ]);
               tVertices.push([x[0]+du[0]+dv[0], x[1]+du[1]+dv[1], x[2]+du[2]+dv[2]]);
               tVertices.push([x[0]      +dv[0], x[1]      +dv[1], x[2]      +dv[2]]);
               //tFaces.push([vertex_count, vertex_count+1, vertex_count+2, vertex_count+3, removeFlags(c)]);
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
  
  // ## enable code to ensure that transparent faces are last in the list
  //var vertex_count = vertices.length;
  //var newFaces = tFaces.map(function(v) {
  //   return [vertex_count+v[0], vertex_count+v[1], vertex_count+v[2], vertex_count+v[3], v[4]]
  //})
   
  return { vertices:vertices, tVertices: tVertices, faces:faces, tFaces: tFaces };
  //return { vertices:vertices.concat(tVertices), faces:faces.concat(newFaces) };
  
  // TODO: Try sorting by texture to see if we can reduce draw calls.
  // faces.sort(function sortFaces(a, b) {
  //   return b[4] - a[4];
  // })
  //return { vertices:vertices, faces:faces };
}
})();

if(exports) {
  exports.mesher = GreedyMesh;
}

},{}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
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

},{"iota-array":10,"is-buffer":11}],10:[function(require,module,exports){
"use strict"

function iota(n) {
  var result = new Array(n)
  for(var i=0; i<n; ++i) {
    result[i] = i
  }
  return result
}

module.exports = iota
},{}],11:[function(require,module,exports){
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

},{}],12:[function(require,module,exports){
voxel = require('voxel');

},{"voxel":2}],13:[function(require,module,exports){
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

},{}]},{},[12])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIm5vZGVfbW9kdWxlcy92b3hlbC9jaHVua2VyLmpzIiwibm9kZV9tb2R1bGVzL3ZveGVsL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3ZveGVsL21lc2hlcnMvY3VsbGVkLmpzIiwibm9kZV9tb2R1bGVzL3ZveGVsL21lc2hlcnMvZ3JlZWR5LmpzIiwibm9kZV9tb2R1bGVzL3ZveGVsL21lc2hlcnMvbW9ub3RvbmUuanMiLCJub2RlX21vZHVsZXMvdm94ZWwvbWVzaGVycy9zdHVwaWQuanMiLCJub2RlX21vZHVsZXMvdm94ZWwvbWVzaGVycy90cmFuc2dyZWVkeS5qcyIsIm5vZGVfbW9kdWxlcy92b3hlbC9ub2RlX21vZHVsZXMvaW5oZXJpdHMvaW5oZXJpdHMuanMiLCJub2RlX21vZHVsZXMvdm94ZWwvbm9kZV9tb2R1bGVzL25kYXJyYXkvbmRhcnJheS5qcyIsIm5vZGVfbW9kdWxlcy92b3hlbC9ub2RlX21vZHVsZXMvbmRhcnJheS9ub2RlX21vZHVsZXMvaW90YS1hcnJheS9pb3RhLmpzIiwibm9kZV9tb2R1bGVzL3ZveGVsL25vZGVfbW9kdWxlcy9uZGFycmF5L25vZGVfbW9kdWxlcy9pcy1idWZmZXIvaW5kZXguanMiLCJ2b3hlbC5qcyIsIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGV2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpXG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0cykge1xuICByZXR1cm4gbmV3IENodW5rZXIob3B0cylcbn1cblxubW9kdWxlLmV4cG9ydHMuQ2h1bmtlciA9IENodW5rZXJcblxuZnVuY3Rpb24gQ2h1bmtlcihvcHRzKSB7XG4gIHRoaXMuZGlzdGFuY2UgPSBvcHRzLmNodW5rRGlzdGFuY2UgfHwgMlxuICB0aGlzLmNodW5rU2l6ZSA9IG9wdHMuY2h1bmtTaXplIHx8IDMyXG4gIHRoaXMuY2h1bmtQYWQgPSBvcHRzLmNodW5rUGFkICE9PSB1bmRlZmluZWQgPyBvcHRzLmNodW5rUGFkIDogMFxuICB0aGlzLmN1YmVTaXplID0gb3B0cy5jdWJlU2l6ZSB8fCAyNVxuICB0aGlzLmdlbmVyYXRlVm94ZWxDaHVuayA9IG9wdHMuZ2VuZXJhdGVWb3hlbENodW5rXG4gIHRoaXMuY2h1bmtzID0ge31cbiAgdGhpcy5tZXNoZXMgPSB7fVxuXG4gIGlmICh0aGlzLmNodW5rU2l6ZSAmIHRoaXMuY2h1bmtTaXplLTEgIT09IDApXG4gICAgdGhyb3cgbmV3IEVycm9yKCdjaHVua1NpemUgbXVzdCBiZSBhIHBvd2VyIG9mIDInKVxuICB2YXIgYml0cyA9IDA7XG4gIGZvciAodmFyIHNpemUgPSB0aGlzLmNodW5rU2l6ZTsgc2l6ZSA+IDA7IHNpemUgPj49IDEpIGJpdHMrKztcbiAgdGhpcy5jaHVua0JpdHMgPSBiaXRzIC0gMTtcbiAgdGhpcy5jaHVua01hc2sgPSAoMSA8PCB0aGlzLmNodW5rQml0cykgLSAxXG4gIHRoaXMuY2h1bmtQYWRIYWxmID0gdGhpcy5jaHVua1BhZCA+PiAxXG59XG5cbmluaGVyaXRzKENodW5rZXIsIGV2ZW50cy5FdmVudEVtaXR0ZXIpXG5cbkNodW5rZXIucHJvdG90eXBlLm5lYXJieUNodW5rcyA9IGZ1bmN0aW9uKHBvc2l0aW9uLCBkaXN0YW5jZSkge1xuICB2YXIgY3VycmVudCA9IHRoaXMuY2h1bmtBdFBvc2l0aW9uKHBvc2l0aW9uKVxuICB2YXIgeCA9IGN1cnJlbnRbMF1cbiAgdmFyIHkgPSBjdXJyZW50WzFdXG4gIHZhciB6ID0gY3VycmVudFsyXVxuICB2YXIgZGlzdCA9IGRpc3RhbmNlIHx8IHRoaXMuZGlzdGFuY2VcbiAgdmFyIG5lYXJieSA9IFtdXG4gIGZvciAodmFyIGN4ID0gKHggLSBkaXN0KTsgY3ggIT09ICh4ICsgZGlzdCk7ICsrY3gpIHtcbiAgICBmb3IgKHZhciBjeSA9ICh5IC0gZGlzdCk7IGN5ICE9PSAoeSArIGRpc3QpOyArK2N5KSB7XG4gICAgICBmb3IgKHZhciBjeiA9ICh6IC0gZGlzdCk7IGN6ICE9PSAoeiArIGRpc3QpOyArK2N6KSB7XG4gICAgICAgIG5lYXJieS5wdXNoKFtjeCwgY3ksIGN6XSlcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIG5lYXJieVxufVxuXG5DaHVua2VyLnByb3RvdHlwZS5yZXF1ZXN0TWlzc2luZ0NodW5rcyA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuICB0aGlzLm5lYXJieUNodW5rcyhwb3NpdGlvbikubWFwKGZ1bmN0aW9uKGNodW5rKSB7XG4gICAgaWYgKCFzZWxmLmNodW5rc1tjaHVuay5qb2luKCd8JyldKSB7XG4gICAgICBzZWxmLmVtaXQoJ21pc3NpbmdDaHVuaycsIGNodW5rKVxuICAgIH1cbiAgfSlcbn1cblxuQ2h1bmtlci5wcm90b3R5cGUuZ2V0Qm91bmRzID0gZnVuY3Rpb24oeCwgeSwgeikge1xuICB2YXIgYml0cyA9IHRoaXMuY2h1bmtCaXRzXG4gIHZhciBsb3cgPSBbeCA8PCBiaXRzLCB5IDw8IGJpdHMsIHogPDwgYml0c11cbiAgdmFyIGhpZ2ggPSBbKHgrMSkgPDwgYml0cywgKHkrMSkgPDwgYml0cywgKHorMSkgPDwgYml0c11cbiAgcmV0dXJuIFtsb3csIGhpZ2hdXG59XG5cbkNodW5rZXIucHJvdG90eXBlLmdlbmVyYXRlQ2h1bmsgPSBmdW5jdGlvbih4LCB5LCB6KSB7XG4gIHZhciBzZWxmID0gdGhpc1xuICB2YXIgYm91bmRzID0gdGhpcy5nZXRCb3VuZHMoeCwgeSwgeilcbiAgdmFyIGNodW5rID0gdGhpcy5nZW5lcmF0ZVZveGVsQ2h1bmsoYm91bmRzWzBdLCBib3VuZHNbMV0sIHgsIHksIHopXG4gIHZhciBwb3NpdGlvbiA9IFt4LCB5LCB6XVxuICBjaHVuay5wb3NpdGlvbiA9IHBvc2l0aW9uXG4gIHRoaXMuY2h1bmtzW3Bvc2l0aW9uLmpvaW4oJ3wnKV0gPSBjaHVua1xuICByZXR1cm4gY2h1bmtcbn1cblxuQ2h1bmtlci5wcm90b3R5cGUuY2h1bmtBdENvb3JkaW5hdGVzID0gZnVuY3Rpb24oeCwgeSwgeikge1xuICB2YXIgYml0cyA9IHRoaXMuY2h1bmtCaXRzO1xuICB2YXIgY3ggPSB4ID4+IGJpdHM7XG4gIHZhciBjeSA9IHkgPj4gYml0cztcbiAgdmFyIGN6ID0geiA+PiBiaXRzO1xuICB2YXIgY2h1bmtQb3MgPSBbY3gsIGN5LCBjel07XG4gIHJldHVybiBjaHVua1Bvcztcbn1cblxuQ2h1bmtlci5wcm90b3R5cGUuY2h1bmtBdFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgdmFyIGN1YmVTaXplID0gdGhpcy5jdWJlU2l6ZTtcbiAgdmFyIHggPSBNYXRoLmZsb29yKHBvc2l0aW9uWzBdIC8gY3ViZVNpemUpXG4gIHZhciB5ID0gTWF0aC5mbG9vcihwb3NpdGlvblsxXSAvIGN1YmVTaXplKVxuICB2YXIgeiA9IE1hdGguZmxvb3IocG9zaXRpb25bMl0gLyBjdWJlU2l6ZSlcbiAgdmFyIGNodW5rUG9zID0gdGhpcy5jaHVua0F0Q29vcmRpbmF0ZXMoeCwgeSwgeilcbiAgcmV0dXJuIGNodW5rUG9zXG59O1xuXG5DaHVua2VyLnByb3RvdHlwZS52b3hlbEluZGV4RnJvbUNvb3JkaW5hdGVzID0gZnVuY3Rpb24oeCwgeSwgeikge1xuICB0aHJvdyBuZXcgRXJyb3IoJ0NodW5rZXIucHJvdG90eXBlLnZveGVsSW5kZXhGcm9tQ29vcmRpbmF0ZXMgcmVtb3ZlZCwgdXNlIHZveGVsQXRDb29yZGluYXRlcycpXG59XG5cbkNodW5rZXIucHJvdG90eXBlLnZveGVsQXRDb29yZGluYXRlcyA9IGZ1bmN0aW9uKHgsIHksIHosIHZhbCkge1xuICB2YXIgY2tleSA9IHRoaXMuY2h1bmtBdENvb3JkaW5hdGVzKHgsIHksIHopLmpvaW4oJ3wnKVxuICB2YXIgY2h1bmsgPSB0aGlzLmNodW5rc1tja2V5XVxuICBpZiAoIWNodW5rKSByZXR1cm4gZmFsc2VcbiAgdmFyIG1hc2sgPSB0aGlzLmNodW5rTWFza1xuICB2YXIgaCA9IHRoaXMuY2h1bmtQYWRIYWxmXG4gIHZhciBteCA9IHggJiBtYXNrXG4gIHZhciBteSA9IHkgJiBtYXNrXG4gIHZhciBteiA9IHogJiBtYXNrXG4gIHZhciB2ID0gY2h1bmsuZ2V0KG14K2gsIG15K2gsIG16K2gpXG4gIGlmICh0eXBlb2YgdmFsICE9PSAndW5kZWZpbmVkJykge1xuICAgIGNodW5rLnNldChteCtoLCBteStoLCBteitoLCB2YWwpXG4gIH1cbiAgcmV0dXJuIHZcbn1cblxuQ2h1bmtlci5wcm90b3R5cGUudm94ZWxBdFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zLCB2YWwpIHtcbiAgdmFyIGN1YmVTaXplID0gdGhpcy5jdWJlU2l6ZTtcbiAgdmFyIHggPSBNYXRoLmZsb29yKHBvc1swXSAvIGN1YmVTaXplKVxuICB2YXIgeSA9IE1hdGguZmxvb3IocG9zWzFdIC8gY3ViZVNpemUpXG4gIHZhciB6ID0gTWF0aC5mbG9vcihwb3NbMl0gLyBjdWJlU2l6ZSlcbiAgdmFyIHYgPSB0aGlzLnZveGVsQXRDb29yZGluYXRlcyh4LCB5LCB6LCB2YWwpXG4gIHJldHVybiB2O1xufVxuXG4iLCJ2YXIgY2h1bmtlciA9IHJlcXVpcmUoJy4vY2h1bmtlcicpXG52YXIgbmRhcnJheSA9IHJlcXVpcmUoJ25kYXJyYXknKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdHMpIHtcbiAgaWYgKCFvcHRzLmdlbmVyYXRlVm94ZWxDaHVuaykgb3B0cy5nZW5lcmF0ZVZveGVsQ2h1bmsgPSBmdW5jdGlvbihsb3csIGhpZ2gpIHtcbiAgICByZXR1cm4gZ2VuZXJhdGUobG93LCBoaWdoLCBtb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ1ZhbGxleSddKVxuICB9XG4gIHJldHVybiBjaHVua2VyKG9wdHMpXG59XG5cbm1vZHVsZS5leHBvcnRzLm1lc2hlcnMgPSB7XG4gIGN1bGxlZDogcmVxdWlyZSgnLi9tZXNoZXJzL2N1bGxlZCcpLm1lc2hlcixcbiAgZ3JlZWR5OiByZXF1aXJlKCcuL21lc2hlcnMvZ3JlZWR5JykubWVzaGVyLFxuICB0cmFuc2dyZWVkeTogcmVxdWlyZSgnLi9tZXNoZXJzL3RyYW5zZ3JlZWR5JykubWVzaGVyLFxuICBtb25vdG9uZTogcmVxdWlyZSgnLi9tZXNoZXJzL21vbm90b25lJykubWVzaGVyLFxuICBzdHVwaWQ6IHJlcXVpcmUoJy4vbWVzaGVycy9zdHVwaWQnKS5tZXNoZXJcbn1cblxubW9kdWxlLmV4cG9ydHMuQ2h1bmtlciA9IGNodW5rZXIuQ2h1bmtlclxubW9kdWxlLmV4cG9ydHMuZ2VvbWV0cnkgPSB7fVxubW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yID0ge31cbm1vZHVsZS5leHBvcnRzLmdlbmVyYXRlID0gZ2VuZXJhdGVcblxuZnVuY3Rpb24gZ2VuZXJhdGUobG8sIGhpLCBmbiwgZ2FtZSkge1xuICAvLyBUbyBmaXggdGhlIGRpc3BsYXkgZ2Fwcywgd2UgbmVlZCB0byBwYWQgdGhlIGJvdW5kc1xuICBsb1swXS0tXG4gIGxvWzFdLS1cbiAgbG9bMl0tLVxuICBoaVswXSsrXG4gIGhpWzFdKytcbiAgaGlbMl0rK1xuICB2YXIgZGltcyA9IFtoaVsyXS1sb1syXSwgaGlbMV0tbG9bMV0sIGhpWzBdLWxvWzBdXVxuICB2YXIgZGF0YSA9IG5kYXJyYXkobmV3IFVpbnQxNkFycmF5KGRpbXNbMl0gKiBkaW1zWzFdICogZGltc1swXSksIGRpbXMpXG4gIGZvciAodmFyIGsgPSBsb1syXTsgayA8IGhpWzJdOyBrKyspXG4gICAgZm9yICh2YXIgaiA9IGxvWzFdOyBqIDwgaGlbMV07IGorKylcbiAgICAgIGZvcih2YXIgaSA9IGxvWzBdOyBpIDwgaGlbMF07IGkrKykge1xuICAgICAgICBkYXRhLnNldChrLWxvWzJdLCBqLWxvWzFdLCBpLWxvWzBdLCBmbihpLCBqLCBrKSlcbiAgICAgIH1cbiAgcmV0dXJuIGRhdGFcbn1cblxuLy8gc2hhcGUgYW5kIHRlcnJhaW4gZ2VuZXJhdG9yIGZ1bmN0aW9uc1xubW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydTcGhlcmUnXSA9IGZ1bmN0aW9uKGksaixrKSB7XG4gIHJldHVybiBpKmkraipqK2sqayA8PSAxNioxNiA/IDEgOiAwXG59XG5cbm1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnTm9pc2UnXSA9IGZ1bmN0aW9uKGksaixrKSB7XG4gIHJldHVybiBNYXRoLnJhbmRvbSgpIDwgMC4xID8gTWF0aC5yYW5kb20oKSAqIDB4ZmZmZmZmIDogMDtcbn1cblxubW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydEZW5zZSBOb2lzZSddID0gZnVuY3Rpb24oaSxqLGspIHtcbiAgcmV0dXJuIE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIDB4ZmZmZmZmKTtcbn1cblxubW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydDaGVja2VyJ10gPSBmdW5jdGlvbihpLGosaykge1xuICByZXR1cm4gISEoKGkraitrKSYxKSA/ICgoKGleal5rKSYyKSA/IDEgOiAweGZmZmZmZikgOiAwO1xufVxuXG5tb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ0hpbGwnXSA9IGZ1bmN0aW9uKGksaixrKSB7XG4gIHJldHVybiBqIDw9IDE2ICogTWF0aC5leHAoLShpKmkgKyBrKmspIC8gNjQpID8gMSA6IDA7XG59XG5cbm1vZHVsZS5leHBvcnRzLmdlbmVyYXRvclsnVmFsbGV5J10gPSBmdW5jdGlvbihpLGosaykge1xuICByZXR1cm4gaiA8PSAoaSppICsgayprKSAqIDMxIC8gKDMyKjMyKjIpICsgMSA/IDEgKyAoMTw8MTUpIDogMDtcbn1cblxubW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydIaWxseSBUZXJyYWluJ10gPSBmdW5jdGlvbihpLGosaykge1xuICB2YXIgaDAgPSAzLjAgKiBNYXRoLnNpbihNYXRoLlBJICogaSAvIDEyLjAgLSBNYXRoLlBJICogayAqIDAuMSkgKyAyNzsgICAgXG4gIGlmKGogPiBoMCsxKSB7XG4gICAgcmV0dXJuIDA7XG4gIH1cbiAgaWYoaDAgPD0gaikge1xuICAgIHJldHVybiAxO1xuICB9XG4gIHZhciBoMSA9IDIuMCAqIE1hdGguc2luKE1hdGguUEkgKiBpICogMC4yNSAtIE1hdGguUEkgKiBrICogMC4zKSArIDIwO1xuICBpZihoMSA8PSBqKSB7XG4gICAgcmV0dXJuIDI7XG4gIH1cbiAgaWYoMiA8IGopIHtcbiAgICByZXR1cm4gTWF0aC5yYW5kb20oKSA8IDAuMSA/IDB4MjIyMjIyIDogMHhhYWFhYWE7XG4gIH1cbiAgcmV0dXJuIDM7XG59XG5cbm1vZHVsZS5leHBvcnRzLnNjYWxlID0gZnVuY3Rpb24gKCB4LCBmcm9tTG93LCBmcm9tSGlnaCwgdG9Mb3csIHRvSGlnaCApIHtcbiAgcmV0dXJuICggeCAtIGZyb21Mb3cgKSAqICggdG9IaWdoIC0gdG9Mb3cgKSAvICggZnJvbUhpZ2ggLSBmcm9tTG93ICkgKyB0b0xvd1xufVxuXG4vLyBjb252ZW5pZW5jZSBmdW5jdGlvbiB0aGF0IHVzZXMgdGhlIGFib3ZlIGZ1bmN0aW9ucyB0byBwcmViYWtlIHNvbWUgc2ltcGxlIHZveGVsIGdlb21ldHJpZXNcbm1vZHVsZS5leHBvcnRzLmdlbmVyYXRlRXhhbXBsZXMgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHtcbiAgICAnU3BoZXJlJzogZ2VuZXJhdGUoWy0xNiwtMTYsLTE2XSwgWzE2LDE2LDE2XSwgbW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydTcGhlcmUnXSksXG4gICAgJ05vaXNlJzogZ2VuZXJhdGUoWzAsMCwwXSwgWzE2LDE2LDE2XSwgbW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydOb2lzZSddKSxcbiAgICAnRGVuc2UgTm9pc2UnOiBnZW5lcmF0ZShbMCwwLDBdLCBbMTYsMTYsMTZdLCBtb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ0RlbnNlIE5vaXNlJ10pLFxuICAgICdDaGVja2VyJzogZ2VuZXJhdGUoWzAsMCwwXSwgWzgsOCw4XSwgbW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydDaGVja2VyJ10pLFxuICAgICdIaWxsJzogZ2VuZXJhdGUoWy0xNiwgMCwgLTE2XSwgWzE2LDE2LDE2XSwgbW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydIaWxsJ10pLFxuICAgICdWYWxsZXknOiBnZW5lcmF0ZShbMCwwLDBdLCBbMzIsMzIsMzJdLCBtb2R1bGUuZXhwb3J0cy5nZW5lcmF0b3JbJ1ZhbGxleSddKSxcbiAgICAnSGlsbHkgVGVycmFpbic6IGdlbmVyYXRlKFswLCAwLCAwXSwgWzMyLDMyLDMyXSwgbW9kdWxlLmV4cG9ydHMuZ2VuZXJhdG9yWydIaWxseSBUZXJyYWluJ10pXG4gIH1cbn1cblxuIiwiLy9OYWl2ZSBtZXNoaW5nICh3aXRoIGZhY2UgY3VsbGluZylcbmZ1bmN0aW9uIEN1bGxlZE1lc2godm9sdW1lLCBkaW1zKSB7XG4gIC8vUHJlY2FsY3VsYXRlIGRpcmVjdGlvbiB2ZWN0b3JzIGZvciBjb252ZW5pZW5jZVxuICB2YXIgZGlyID0gbmV3IEFycmF5KDMpO1xuICBmb3IodmFyIGk9MDsgaTwzOyArK2kpIHtcbiAgICBkaXJbaV0gPSBbWzAsMCwwXSwgWzAsMCwwXV07XG4gICAgZGlyW2ldWzBdWyhpKzEpJTNdID0gMTtcbiAgICBkaXJbaV1bMV1bKGkrMiklM10gPSAxO1xuICB9XG4gIC8vTWFyY2ggb3ZlciB0aGUgdm9sdW1lXG4gIHZhciB2ZXJ0aWNlcyA9IFtdXG4gICAgLCBmYWNlcyA9IFtdXG4gICAgLCB4ID0gWzAsMCwwXVxuICAgICwgQiA9IFtbZmFsc2UsdHJ1ZV0gICAgLy9JbmNyZW1lbnRhbGx5IHVwZGF0ZSBib3VuZHMgKHRoaXMgaXMgYSBiaXQgdWdseSlcbiAgICAgICAgICAsW2ZhbHNlLHRydWVdXG4gICAgICAgICAgLFtmYWxzZSx0cnVlXV1cbiAgICAsIG4gPSAtZGltc1swXSpkaW1zWzFdO1xuICBmb3IoICAgICAgICAgICBCWzJdPVtmYWxzZSx0cnVlXSx4WzJdPS0xOyB4WzJdPGRpbXNbMl07IEJbMl09W3RydWUsKCsreFsyXTxkaW1zWzJdLTEpXSlcbiAgZm9yKG4tPWRpbXNbMF0sQlsxXT1bZmFsc2UsdHJ1ZV0seFsxXT0tMTsgeFsxXTxkaW1zWzFdOyBCWzFdPVt0cnVlLCgrK3hbMV08ZGltc1sxXS0xKV0pXG4gIGZvcihuLT0xLCAgICAgIEJbMF09W2ZhbHNlLHRydWVdLHhbMF09LTE7IHhbMF08ZGltc1swXTsgQlswXT1bdHJ1ZSwoKyt4WzBdPGRpbXNbMF0tMSldLCArK24pIHtcbiAgICAvL1JlYWQgY3VycmVudCB2b3hlbCBhbmQgMyBuZWlnaGJvcmluZyB2b3hlbHMgdXNpbmcgYm91bmRzIGNoZWNrIHJlc3VsdHNcbiAgICB2YXIgcCA9ICAgKEJbMF1bMF0gJiYgQlsxXVswXSAmJiBCWzJdWzBdKSA/IHZvbHVtZVtuXSAgICAgICAgICAgICAgICAgOiAwXG4gICAgICAsIGIgPSBbIChCWzBdWzFdICYmIEJbMV1bMF0gJiYgQlsyXVswXSkgPyB2b2x1bWVbbisxXSAgICAgICAgICAgICAgIDogMFxuICAgICAgICAgICAgLCAoQlswXVswXSAmJiBCWzFdWzFdICYmIEJbMl1bMF0pID8gdm9sdW1lW24rZGltc1swXV0gICAgICAgICA6IDBcbiAgICAgICAgICAgICwgKEJbMF1bMF0gJiYgQlsxXVswXSAmJiBCWzJdWzFdKSA/IHZvbHVtZVtuK2RpbXNbMF0qZGltc1sxXV0gOiAwXG4gICAgICAgICAgXTtcbiAgICAvL0dlbmVyYXRlIGZhY2VzXG4gICAgZm9yKHZhciBkPTA7IGQ8MzsgKytkKVxuICAgIGlmKCghIXApICE9PSAoISFiW2RdKSkge1xuICAgICAgdmFyIHMgPSAhcCA/IDEgOiAwO1xuICAgICAgdmFyIHQgPSBbeFswXSx4WzFdLHhbMl1dXG4gICAgICAgICwgdSA9IGRpcltkXVtzXVxuICAgICAgICAsIHYgPSBkaXJbZF1bc14xXTtcbiAgICAgICsrdFtkXTtcbiAgICAgIFxuICAgICAgdmFyIHZlcnRleF9jb3VudCA9IHZlcnRpY2VzLmxlbmd0aDtcbiAgICAgIHZlcnRpY2VzLnB1c2goW3RbMF0sICAgICAgICAgICB0WzFdLCAgICAgICAgICAgdFsyXSAgICAgICAgICBdKTtcbiAgICAgIHZlcnRpY2VzLnB1c2goW3RbMF0rdVswXSwgICAgICB0WzFdK3VbMV0sICAgICAgdFsyXSt1WzJdICAgICBdKTtcbiAgICAgIHZlcnRpY2VzLnB1c2goW3RbMF0rdVswXSt2WzBdLCB0WzFdK3VbMV0rdlsxXSwgdFsyXSt1WzJdK3ZbMl1dKTtcbiAgICAgIHZlcnRpY2VzLnB1c2goW3RbMF0gICAgICt2WzBdLCB0WzFdICAgICArdlsxXSwgdFsyXSAgICAgK3ZbMl1dKTtcbiAgICAgIGZhY2VzLnB1c2goW3ZlcnRleF9jb3VudCwgdmVydGV4X2NvdW50KzEsIHZlcnRleF9jb3VudCsyLCB2ZXJ0ZXhfY291bnQrMywgcyA/IGJbZF0gOiBwXSk7XG4gICAgfVxuICB9XG4gIHJldHVybiB7IHZlcnRpY2VzOnZlcnRpY2VzLCBmYWNlczpmYWNlcyB9O1xufVxuXG5cbmlmKGV4cG9ydHMpIHtcbiAgZXhwb3J0cy5tZXNoZXIgPSBDdWxsZWRNZXNoO1xufVxuIiwidmFyIEdyZWVkeU1lc2ggPSAoZnVuY3Rpb24oKSB7XG4vL0NhY2hlIGJ1ZmZlciBpbnRlcm5hbGx5XG52YXIgbWFzayA9IG5ldyBJbnQzMkFycmF5KDQwOTYpO1xuXG5yZXR1cm4gZnVuY3Rpb24odm9sdW1lLCBkaW1zKSB7XG4gIHZhciB2ZXJ0aWNlcyA9IFtdLCBmYWNlcyA9IFtdXG4gICAgLCBkaW1zWCA9IGRpbXNbMF1cbiAgICAsIGRpbXNZID0gZGltc1sxXVxuICAgICwgZGltc1hZID0gZGltc1ggKiBkaW1zWTtcblxuICAvL1N3ZWVwIG92ZXIgMy1heGVzXG4gIGZvcih2YXIgZD0wOyBkPDM7ICsrZCkge1xuICAgIHZhciBpLCBqLCBrLCBsLCB3LCBXLCBoLCBuLCBjXG4gICAgICAsIHUgPSAoZCsxKSUzXG4gICAgICAsIHYgPSAoZCsyKSUzXG4gICAgICAsIHggPSBbMCwwLDBdXG4gICAgICAsIHEgPSBbMCwwLDBdXG4gICAgICAsIGR1ID0gWzAsMCwwXVxuICAgICAgLCBkdiA9IFswLDAsMF1cbiAgICAgICwgZGltc0QgPSBkaW1zW2RdXG4gICAgICAsIGRpbXNVID0gZGltc1t1XVxuICAgICAgLCBkaW1zViA9IGRpbXNbdl1cbiAgICAgICwgcWRpbXNYLCBxZGltc1hZXG4gICAgICAsIHhkXG5cbiAgICBpZiAobWFzay5sZW5ndGggPCBkaW1zVSAqIGRpbXNWKSB7XG4gICAgICBtYXNrID0gbmV3IEludDMyQXJyYXkoZGltc1UgKiBkaW1zVik7XG4gICAgfVxuXG4gICAgcVtkXSA9ICAxO1xuICAgIHhbZF0gPSAtMTtcblxuICAgIHFkaW1zWCAgPSBkaW1zWCAgKiBxWzFdXG4gICAgcWRpbXNYWSA9IGRpbXNYWSAqIHFbMl1cblxuICAgIC8vIENvbXB1dGUgbWFza1xuICAgIHdoaWxlICh4W2RdIDwgZGltc0QpIHtcbiAgICAgIHhkID0geFtkXVxuICAgICAgbiA9IDA7XG5cbiAgICAgIGZvcih4W3ZdID0gMDsgeFt2XSA8IGRpbXNWOyArK3hbdl0pIHtcbiAgICAgICAgZm9yKHhbdV0gPSAwOyB4W3VdIDwgZGltc1U7ICsreFt1XSwgKytuKSB7XG4gICAgICAgICAgdmFyIGEgPSB4ZCA+PSAwICAgICAgJiYgdm9sdW1lW3hbMF0gICAgICArIGRpbXNYICogeFsxXSAgICAgICAgICArIGRpbXNYWSAqIHhbMl0gICAgICAgICAgXVxuICAgICAgICAgICAgLCBiID0geGQgPCBkaW1zRC0xICYmIHZvbHVtZVt4WzBdK3FbMF0gKyBkaW1zWCAqIHhbMV0gKyBxZGltc1ggKyBkaW1zWFkgKiB4WzJdICsgcWRpbXNYWV1cbiAgICAgICAgICBpZiAoYSA/IGIgOiAhYikge1xuICAgICAgICAgICAgbWFza1tuXSA9IDA7IGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBtYXNrW25dID0gYSA/IGEgOiAtYjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICArK3hbZF07XG5cbiAgICAgIC8vIEdlbmVyYXRlIG1lc2ggZm9yIG1hc2sgdXNpbmcgbGV4aWNvZ3JhcGhpYyBvcmRlcmluZ1xuICAgICAgbiA9IDA7XG4gICAgICBmb3IgKGo9MDsgaiA8IGRpbXNWOyArK2opIHtcbiAgICAgICAgZm9yIChpPTA7IGkgPCBkaW1zVTsgKSB7XG4gICAgICAgICAgYyA9IG1hc2tbbl07XG4gICAgICAgICAgaWYgKCFjKSB7XG4gICAgICAgICAgICBpKys7ICBuKys7IGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vQ29tcHV0ZSB3aWR0aFxuICAgICAgICAgIHcgPSAxO1xuICAgICAgICAgIHdoaWxlIChjID09PSBtYXNrW24rd10gJiYgaSt3IDwgZGltc1UpIHcrKztcblxuICAgICAgICAgIC8vQ29tcHV0ZSBoZWlnaHQgKHRoaXMgaXMgc2xpZ2h0bHkgYXdrd2FyZClcbiAgICAgICAgICBmb3IgKGg9MTsgaitoIDwgZGltc1Y7ICsraCkge1xuICAgICAgICAgICAgayA9IDA7XG4gICAgICAgICAgICB3aGlsZSAoayA8IHcgJiYgYyA9PT0gbWFza1tuK2sraCpkaW1zVV0pIGsrK1xuICAgICAgICAgICAgaWYgKGsgPCB3KSBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBBZGQgcXVhZFxuICAgICAgICAgIC8vIFRoZSBkdS9kdiBhcnJheXMgYXJlIHJldXNlZC9yZXNldFxuICAgICAgICAgIC8vIGZvciBlYWNoIGl0ZXJhdGlvbi5cbiAgICAgICAgICBkdVtkXSA9IDA7IGR2W2RdID0gMDtcbiAgICAgICAgICB4W3VdICA9IGk7ICB4W3ZdID0gajtcblxuICAgICAgICAgIGlmIChjID4gMCkge1xuICAgICAgICAgICAgZHZbdl0gPSBoOyBkdlt1XSA9IDA7XG4gICAgICAgICAgICBkdVt1XSA9IHc7IGR1W3ZdID0gMDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYyA9IC1jO1xuICAgICAgICAgICAgZHVbdl0gPSBoOyBkdVt1XSA9IDA7XG4gICAgICAgICAgICBkdlt1XSA9IHc7IGR2W3ZdID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIHZlcnRleF9jb3VudCA9IHZlcnRpY2VzLmxlbmd0aDtcbiAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt4WzBdLCAgICAgICAgICAgICB4WzFdLCAgICAgICAgICAgICB4WzJdICAgICAgICAgICAgXSk7XG4gICAgICAgICAgdmVydGljZXMucHVzaChbeFswXStkdVswXSwgICAgICAgeFsxXStkdVsxXSwgICAgICAgeFsyXStkdVsyXSAgICAgIF0pO1xuICAgICAgICAgIHZlcnRpY2VzLnB1c2goW3hbMF0rZHVbMF0rZHZbMF0sIHhbMV0rZHVbMV0rZHZbMV0sIHhbMl0rZHVbMl0rZHZbMl1dKTtcbiAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt4WzBdICAgICAgK2R2WzBdLCB4WzFdICAgICAgK2R2WzFdLCB4WzJdICAgICAgK2R2WzJdXSk7XG4gICAgICAgICAgZmFjZXMucHVzaChbdmVydGV4X2NvdW50LCB2ZXJ0ZXhfY291bnQrMSwgdmVydGV4X2NvdW50KzIsIHZlcnRleF9jb3VudCszLCBjXSk7XG5cbiAgICAgICAgICAvL1plcm8tb3V0IG1hc2tcbiAgICAgICAgICBXID0gbiArIHc7XG4gICAgICAgICAgZm9yKGw9MDsgbDxoOyArK2wpIHtcbiAgICAgICAgICAgIGZvcihrPW47IGs8VzsgKytrKSB7XG4gICAgICAgICAgICAgIG1hc2tbaytsKmRpbXNVXSA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy9JbmNyZW1lbnQgY291bnRlcnMgYW5kIGNvbnRpbnVlXG4gICAgICAgICAgaSArPSB3OyBuICs9IHc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHsgdmVydGljZXM6dmVydGljZXMsIGZhY2VzOmZhY2VzIH07XG59XG59KSgpO1xuXG5pZihleHBvcnRzKSB7XG4gIGV4cG9ydHMubWVzaGVyID0gR3JlZWR5TWVzaDtcbn1cbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgTW9ub3RvbmVNZXNoID0gKGZ1bmN0aW9uKCl7XG5cbmZ1bmN0aW9uIE1vbm90b25lUG9seWdvbihjLCB2LCB1bCwgdXIpIHtcbiAgdGhpcy5jb2xvciAgPSBjO1xuICB0aGlzLmxlZnQgICA9IFtbdWwsIHZdXTtcbiAgdGhpcy5yaWdodCAgPSBbW3VyLCB2XV07XG59O1xuXG5Nb25vdG9uZVBvbHlnb24ucHJvdG90eXBlLmNsb3NlX29mZiA9IGZ1bmN0aW9uKHYpIHtcbiAgdGhpcy5sZWZ0LnB1c2goWyB0aGlzLmxlZnRbdGhpcy5sZWZ0Lmxlbmd0aC0xXVswXSwgdiBdKTtcbiAgdGhpcy5yaWdodC5wdXNoKFsgdGhpcy5yaWdodFt0aGlzLnJpZ2h0Lmxlbmd0aC0xXVswXSwgdiBdKTtcbn07XG5cbk1vbm90b25lUG9seWdvbi5wcm90b3R5cGUubWVyZ2VfcnVuID0gZnVuY3Rpb24odiwgdV9sLCB1X3IpIHtcbiAgdmFyIGwgPSB0aGlzLmxlZnRbdGhpcy5sZWZ0Lmxlbmd0aC0xXVswXVxuICAgICwgciA9IHRoaXMucmlnaHRbdGhpcy5yaWdodC5sZW5ndGgtMV1bMF07IFxuICBpZihsICE9PSB1X2wpIHtcbiAgICB0aGlzLmxlZnQucHVzaChbIGwsIHYgXSk7XG4gICAgdGhpcy5sZWZ0LnB1c2goWyB1X2wsIHYgXSk7XG4gIH1cbiAgaWYociAhPT0gdV9yKSB7XG4gICAgdGhpcy5yaWdodC5wdXNoKFsgciwgdiBdKTtcbiAgICB0aGlzLnJpZ2h0LnB1c2goWyB1X3IsIHYgXSk7XG4gIH1cbn07XG5cblxucmV0dXJuIGZ1bmN0aW9uKHZvbHVtZSwgZGltcykge1xuICBmdW5jdGlvbiBmKGksaixrKSB7XG4gICAgcmV0dXJuIHZvbHVtZVtpICsgZGltc1swXSAqIChqICsgZGltc1sxXSAqIGspXTtcbiAgfVxuICAvL1N3ZWVwIG92ZXIgMy1heGVzXG4gIHZhciB2ZXJ0aWNlcyA9IFtdLCBmYWNlcyA9IFtdO1xuICBmb3IodmFyIGQ9MDsgZDwzOyArK2QpIHtcbiAgICB2YXIgaSwgaiwga1xuICAgICAgLCB1ID0gKGQrMSklMyAgIC8vdSBhbmQgdiBhcmUgb3J0aG9nb25hbCBkaXJlY3Rpb25zIHRvIGRcbiAgICAgICwgdiA9IChkKzIpJTNcbiAgICAgICwgeCA9IG5ldyBJbnQzMkFycmF5KDMpXG4gICAgICAsIHEgPSBuZXcgSW50MzJBcnJheSgzKVxuICAgICAgLCBydW5zID0gbmV3IEludDMyQXJyYXkoMiAqIChkaW1zW3VdKzEpKVxuICAgICAgLCBmcm9udGllciA9IG5ldyBJbnQzMkFycmF5KGRpbXNbdV0pICAvL0Zyb250aWVyIGlzIGxpc3Qgb2YgcG9pbnRlcnMgdG8gcG9seWdvbnNcbiAgICAgICwgbmV4dF9mcm9udGllciA9IG5ldyBJbnQzMkFycmF5KGRpbXNbdV0pXG4gICAgICAsIGxlZnRfaW5kZXggPSBuZXcgSW50MzJBcnJheSgyICogZGltc1t2XSlcbiAgICAgICwgcmlnaHRfaW5kZXggPSBuZXcgSW50MzJBcnJheSgyICogZGltc1t2XSlcbiAgICAgICwgc3RhY2sgPSBuZXcgSW50MzJBcnJheSgyNCAqIGRpbXNbdl0pXG4gICAgICAsIGRlbHRhID0gW1swLDBdLCBbMCwwXV07XG4gICAgLy9xIHBvaW50cyBhbG9uZyBkLWRpcmVjdGlvblxuICAgIHFbZF0gPSAxO1xuICAgIC8vSW5pdGlhbGl6ZSBzZW50aW5lbFxuICAgIGZvcih4W2RdPS0xOyB4W2RdPGRpbXNbZF07ICkge1xuICAgICAgLy8gLS0tIFBlcmZvcm0gbW9ub3RvbmUgcG9seWdvbiBzdWJkaXZpc2lvbiAtLS1cbiAgICAgIHZhciBuID0gMFxuICAgICAgICAsIHBvbHlnb25zID0gW11cbiAgICAgICAgLCBuZiA9IDA7XG4gICAgICBmb3IoeFt2XT0wOyB4W3ZdPGRpbXNbdl07ICsreFt2XSkge1xuICAgICAgICAvL01ha2Ugb25lIHBhc3Mgb3ZlciB0aGUgdS1zY2FuIGxpbmUgb2YgdGhlIHZvbHVtZSB0byBydW4tbGVuZ3RoIGVuY29kZSBwb2x5Z29uXG4gICAgICAgIHZhciBuciA9IDAsIHAgPSAwLCBjID0gMDtcbiAgICAgICAgZm9yKHhbdV09MDsgeFt1XTxkaW1zW3VdOyArK3hbdV0sIHAgPSBjKSB7XG4gICAgICAgICAgLy9Db21wdXRlIHRoZSB0eXBlIGZvciB0aGlzIGZhY2VcbiAgICAgICAgICB2YXIgYSA9ICgwICAgIDw9IHhbZF0gICAgICA/IGYoeFswXSwgICAgICB4WzFdLCAgICAgIHhbMl0pICAgICAgOiAwKVxuICAgICAgICAgICAgLCBiID0gKHhbZF0gPCAgZGltc1tkXS0xID8gZih4WzBdK3FbMF0sIHhbMV0rcVsxXSwgeFsyXStxWzJdKSA6IDApO1xuICAgICAgICAgIGMgPSBhO1xuICAgICAgICAgIGlmKCghYSkgPT09ICghYikpIHtcbiAgICAgICAgICAgIGMgPSAwO1xuICAgICAgICAgIH0gZWxzZSBpZighYSkge1xuICAgICAgICAgICAgYyA9IC1iO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvL0lmIGNlbGwgdHlwZSBkb2Vzbid0IG1hdGNoLCBzdGFydCBhIG5ldyBydW5cbiAgICAgICAgICBpZihwICE9PSBjKSB7XG4gICAgICAgICAgICBydW5zW25yKytdID0geFt1XTtcbiAgICAgICAgICAgIHJ1bnNbbnIrK10gPSBjO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvL0FkZCBzZW50aW5lbCBydW5cbiAgICAgICAgcnVuc1tucisrXSA9IGRpbXNbdV07XG4gICAgICAgIHJ1bnNbbnIrK10gPSAwO1xuICAgICAgICAvL1VwZGF0ZSBmcm9udGllciBieSBtZXJnaW5nIHJ1bnNcbiAgICAgICAgdmFyIGZwID0gMDtcbiAgICAgICAgZm9yKHZhciBpPTAsIGo9MDsgaTxuZiAmJiBqPG5yLTI7ICkge1xuICAgICAgICAgIHZhciBwICAgID0gcG9seWdvbnNbZnJvbnRpZXJbaV1dXG4gICAgICAgICAgICAsIHBfbCAgPSBwLmxlZnRbcC5sZWZ0Lmxlbmd0aC0xXVswXVxuICAgICAgICAgICAgLCBwX3IgID0gcC5yaWdodFtwLnJpZ2h0Lmxlbmd0aC0xXVswXVxuICAgICAgICAgICAgLCBwX2MgID0gcC5jb2xvclxuICAgICAgICAgICAgLCByX2wgID0gcnVuc1tqXSAgICAvL1N0YXJ0IG9mIHJ1blxuICAgICAgICAgICAgLCByX3IgID0gcnVuc1tqKzJdICAvL0VuZCBvZiBydW5cbiAgICAgICAgICAgICwgcl9jICA9IHJ1bnNbaisxXTsgLy9Db2xvciBvZiBydW5cbiAgICAgICAgICAvL0NoZWNrIGlmIHdlIGNhbiBtZXJnZSBydW4gd2l0aCBwb2x5Z29uXG4gICAgICAgICAgaWYocl9yID4gcF9sICYmIHBfciA+IHJfbCAmJiByX2MgPT09IHBfYykge1xuICAgICAgICAgICAgLy9NZXJnZSBydW5cbiAgICAgICAgICAgIHAubWVyZ2VfcnVuKHhbdl0sIHJfbCwgcl9yKTtcbiAgICAgICAgICAgIC8vSW5zZXJ0IHBvbHlnb24gaW50byBmcm9udGllclxuICAgICAgICAgICAgbmV4dF9mcm9udGllcltmcCsrXSA9IGZyb250aWVyW2ldO1xuICAgICAgICAgICAgKytpO1xuICAgICAgICAgICAgaiArPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvL0NoZWNrIGlmIHdlIG5lZWQgdG8gYWR2YW5jZSB0aGUgcnVuIHBvaW50ZXJcbiAgICAgICAgICAgIGlmKHJfciA8PSBwX3IpIHtcbiAgICAgICAgICAgICAgaWYoISFyX2MpIHtcbiAgICAgICAgICAgICAgICB2YXIgbl9wb2x5ID0gbmV3IE1vbm90b25lUG9seWdvbihyX2MsIHhbdl0sIHJfbCwgcl9yKTtcbiAgICAgICAgICAgICAgICBuZXh0X2Zyb250aWVyW2ZwKytdID0gcG9seWdvbnMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHBvbHlnb25zLnB1c2gobl9wb2x5KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBqICs9IDI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvL0NoZWNrIGlmIHdlIG5lZWQgdG8gYWR2YW5jZSB0aGUgZnJvbnRpZXIgcG9pbnRlclxuICAgICAgICAgICAgaWYocF9yIDw9IHJfcikge1xuICAgICAgICAgICAgICBwLmNsb3NlX29mZih4W3ZdKTtcbiAgICAgICAgICAgICAgKytpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvL0Nsb3NlIG9mZiBhbnkgcmVzaWR1YWwgcG9seWdvbnNcbiAgICAgICAgZm9yKDsgaTxuZjsgKytpKSB7XG4gICAgICAgICAgcG9seWdvbnNbZnJvbnRpZXJbaV1dLmNsb3NlX29mZih4W3ZdKTtcbiAgICAgICAgfVxuICAgICAgICAvL0FkZCBhbnkgZXh0cmEgcnVucyB0byBmcm9udGllclxuICAgICAgICBmb3IoOyBqPG5yLTI7IGorPTIpIHtcbiAgICAgICAgICB2YXIgcl9sICA9IHJ1bnNbal1cbiAgICAgICAgICAgICwgcl9yICA9IHJ1bnNbaisyXVxuICAgICAgICAgICAgLCByX2MgID0gcnVuc1tqKzFdO1xuICAgICAgICAgIGlmKCEhcl9jKSB7XG4gICAgICAgICAgICB2YXIgbl9wb2x5ID0gbmV3IE1vbm90b25lUG9seWdvbihyX2MsIHhbdl0sIHJfbCwgcl9yKTtcbiAgICAgICAgICAgIG5leHRfZnJvbnRpZXJbZnArK10gPSBwb2x5Z29ucy5sZW5ndGg7XG4gICAgICAgICAgICBwb2x5Z29ucy5wdXNoKG5fcG9seSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vU3dhcCBmcm9udGllcnNcbiAgICAgICAgdmFyIHRtcCA9IG5leHRfZnJvbnRpZXI7XG4gICAgICAgIG5leHRfZnJvbnRpZXIgPSBmcm9udGllcjtcbiAgICAgICAgZnJvbnRpZXIgPSB0bXA7XG4gICAgICAgIG5mID0gZnA7XG4gICAgICB9XG4gICAgICAvL0Nsb3NlIG9mZiBmcm9udGllclxuICAgICAgZm9yKHZhciBpPTA7IGk8bmY7ICsraSkge1xuICAgICAgICB2YXIgcCA9IHBvbHlnb25zW2Zyb250aWVyW2ldXTtcbiAgICAgICAgcC5jbG9zZV9vZmYoZGltc1t2XSk7XG4gICAgICB9XG4gICAgICAvLyAtLS0gTW9ub3RvbmUgc3ViZGl2aXNpb24gb2YgcG9seWdvbiBpcyBjb21wbGV0ZSBhdCB0aGlzIHBvaW50IC0tLVxuICAgICAgXG4gICAgICB4W2RdKys7XG4gICAgICBcbiAgICAgIC8vTm93IHdlIGp1c3QgbmVlZCB0byB0cmlhbmd1bGF0ZSBlYWNoIG1vbm90b25lIHBvbHlnb25cbiAgICAgIGZvcih2YXIgaT0wOyBpPHBvbHlnb25zLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBwID0gcG9seWdvbnNbaV1cbiAgICAgICAgICAsIGMgPSBwLmNvbG9yXG4gICAgICAgICAgLCBmbGlwcGVkID0gZmFsc2U7XG4gICAgICAgIGlmKGMgPCAwKSB7XG4gICAgICAgICAgZmxpcHBlZCA9IHRydWU7XG4gICAgICAgICAgYyA9IC1jO1xuICAgICAgICB9XG4gICAgICAgIGZvcih2YXIgaj0wOyBqPHAubGVmdC5sZW5ndGg7ICsraikge1xuICAgICAgICAgIGxlZnRfaW5kZXhbal0gPSB2ZXJ0aWNlcy5sZW5ndGg7XG4gICAgICAgICAgdmFyIHkgPSBbMC4wLDAuMCwwLjBdXG4gICAgICAgICAgICAsIHogPSBwLmxlZnRbal07XG4gICAgICAgICAgeVtkXSA9IHhbZF07XG4gICAgICAgICAgeVt1XSA9IHpbMF07XG4gICAgICAgICAgeVt2XSA9IHpbMV07XG4gICAgICAgICAgdmVydGljZXMucHVzaCh5KTtcbiAgICAgICAgfVxuICAgICAgICBmb3IodmFyIGo9MDsgajxwLnJpZ2h0Lmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgcmlnaHRfaW5kZXhbal0gPSB2ZXJ0aWNlcy5sZW5ndGg7XG4gICAgICAgICAgdmFyIHkgPSBbMC4wLDAuMCwwLjBdXG4gICAgICAgICAgICAsIHogPSBwLnJpZ2h0W2pdO1xuICAgICAgICAgIHlbZF0gPSB4W2RdO1xuICAgICAgICAgIHlbdV0gPSB6WzBdO1xuICAgICAgICAgIHlbdl0gPSB6WzFdO1xuICAgICAgICAgIHZlcnRpY2VzLnB1c2goeSk7XG4gICAgICAgIH1cbiAgICAgICAgLy9Ucmlhbmd1bGF0ZSB0aGUgbW9ub3RvbmUgcG9seWdvblxuICAgICAgICB2YXIgYm90dG9tID0gMFxuICAgICAgICAgICwgdG9wID0gMFxuICAgICAgICAgICwgbF9pID0gMVxuICAgICAgICAgICwgcl9pID0gMVxuICAgICAgICAgICwgc2lkZSA9IHRydWU7ICAvL3RydWUgPSByaWdodCwgZmFsc2UgPSBsZWZ0XG4gICAgICAgIFxuICAgICAgICBzdGFja1t0b3ArK10gPSBsZWZ0X2luZGV4WzBdO1xuICAgICAgICBzdGFja1t0b3ArK10gPSBwLmxlZnRbMF1bMF07XG4gICAgICAgIHN0YWNrW3RvcCsrXSA9IHAubGVmdFswXVsxXTtcbiAgICAgICAgXG4gICAgICAgIHN0YWNrW3RvcCsrXSA9IHJpZ2h0X2luZGV4WzBdO1xuICAgICAgICBzdGFja1t0b3ArK10gPSBwLnJpZ2h0WzBdWzBdO1xuICAgICAgICBzdGFja1t0b3ArK10gPSBwLnJpZ2h0WzBdWzFdO1xuICAgICAgICBcbiAgICAgICAgd2hpbGUobF9pIDwgcC5sZWZ0Lmxlbmd0aCB8fCByX2kgPCBwLnJpZ2h0Lmxlbmd0aCkge1xuICAgICAgICAgIC8vQ29tcHV0ZSBuZXh0IHNpZGVcbiAgICAgICAgICB2YXIgbl9zaWRlID0gZmFsc2U7XG4gICAgICAgICAgaWYobF9pID09PSBwLmxlZnQubGVuZ3RoKSB7XG4gICAgICAgICAgICBuX3NpZGUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSBpZihyX2kgIT09IHAucmlnaHQubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgbCA9IHAubGVmdFtsX2ldXG4gICAgICAgICAgICAgICwgciA9IHAucmlnaHRbcl9pXTtcbiAgICAgICAgICAgIG5fc2lkZSA9IGxbMV0gPiByWzFdO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgaWR4ID0gbl9zaWRlID8gcmlnaHRfaW5kZXhbcl9pXSA6IGxlZnRfaW5kZXhbbF9pXVxuICAgICAgICAgICAgLCB2ZXJ0ID0gbl9zaWRlID8gcC5yaWdodFtyX2ldIDogcC5sZWZ0W2xfaV07XG4gICAgICAgICAgaWYobl9zaWRlICE9PSBzaWRlKSB7XG4gICAgICAgICAgICAvL09wcG9zaXRlIHNpZGVcbiAgICAgICAgICAgIHdoaWxlKGJvdHRvbSszIDwgdG9wKSB7XG4gICAgICAgICAgICAgIGlmKGZsaXBwZWQgPT09IG5fc2lkZSkge1xuICAgICAgICAgICAgICAgIGZhY2VzLnB1c2goWyBzdGFja1tib3R0b21dLCBzdGFja1tib3R0b20rM10sIGlkeCwgY10pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZhY2VzLnB1c2goWyBzdGFja1tib3R0b20rM10sIHN0YWNrW2JvdHRvbV0sIGlkeCwgY10pOyAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYm90dG9tICs9IDM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vU2FtZSBzaWRlXG4gICAgICAgICAgICB3aGlsZShib3R0b20rMyA8IHRvcCkge1xuICAgICAgICAgICAgICAvL0NvbXB1dGUgY29udmV4aXR5XG4gICAgICAgICAgICAgIGZvcih2YXIgaj0wOyBqPDI7ICsrailcbiAgICAgICAgICAgICAgZm9yKHZhciBrPTA7IGs8MjsgKytrKSB7XG4gICAgICAgICAgICAgICAgZGVsdGFbal1ba10gPSBzdGFja1t0b3AtMyooaisxKStrKzFdIC0gdmVydFtrXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB2YXIgZGV0ID0gZGVsdGFbMF1bMF0gKiBkZWx0YVsxXVsxXSAtIGRlbHRhWzFdWzBdICogZGVsdGFbMF1bMV07XG4gICAgICAgICAgICAgIGlmKG5fc2lkZSA9PT0gKGRldCA+IDApKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYoZGV0ICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgaWYoZmxpcHBlZCA9PT0gbl9zaWRlKSB7XG4gICAgICAgICAgICAgICAgICBmYWNlcy5wdXNoKFsgc3RhY2tbdG9wLTNdLCBzdGFja1t0b3AtNl0sIGlkeCwgYyBdKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgZmFjZXMucHVzaChbIHN0YWNrW3RvcC02XSwgc3RhY2tbdG9wLTNdLCBpZHgsIGMgXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHRvcCAtPSAzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICAvL1B1c2ggdmVydGV4XG4gICAgICAgICAgc3RhY2tbdG9wKytdID0gaWR4O1xuICAgICAgICAgIHN0YWNrW3RvcCsrXSA9IHZlcnRbMF07XG4gICAgICAgICAgc3RhY2tbdG9wKytdID0gdmVydFsxXTtcbiAgICAgICAgICAvL1VwZGF0ZSBsb29wIGluZGV4XG4gICAgICAgICAgaWYobl9zaWRlKSB7XG4gICAgICAgICAgICArK3JfaTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgKytsX2k7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNpZGUgPSBuX3NpZGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHsgdmVydGljZXM6dmVydGljZXMsIGZhY2VzOmZhY2VzIH07XG59XG59KSgpO1xuXG5pZihleHBvcnRzKSB7XG4gIGV4cG9ydHMubWVzaGVyID0gTW9ub3RvbmVNZXNoO1xufVxuIiwiLy9UaGUgc3R1cGlkZXN0IHBvc3NpYmxlIHdheSB0byBnZW5lcmF0ZSBhIE1pbmVjcmFmdCBtZXNoIChJIHRoaW5rKVxuZnVuY3Rpb24gU3R1cGlkTWVzaCh2b2x1bWUsIGRpbXMpIHtcbiAgdmFyIHZlcnRpY2VzID0gW10sIGZhY2VzID0gW10sIHggPSBbMCwwLDBdLCBuID0gMDtcbiAgZm9yKHhbMl09MDsgeFsyXTxkaW1zWzJdOyArK3hbMl0pXG4gIGZvcih4WzFdPTA7IHhbMV08ZGltc1sxXTsgKyt4WzFdKVxuICBmb3IoeFswXT0wOyB4WzBdPGRpbXNbMF07ICsreFswXSwgKytuKVxuICBpZighIXZvbHVtZVtuXSkge1xuICAgIGZvcih2YXIgZD0wOyBkPDM7ICsrZCkge1xuICAgICAgdmFyIHQgPSBbeFswXSwgeFsxXSwgeFsyXV1cbiAgICAgICAgLCB1ID0gWzAsMCwwXVxuICAgICAgICAsIHYgPSBbMCwwLDBdO1xuICAgICAgdVsoZCsxKSUzXSA9IDE7XG4gICAgICB2WyhkKzIpJTNdID0gMTtcbiAgICAgIGZvcih2YXIgcz0wOyBzPDI7ICsrcykge1xuICAgICAgICB0W2RdID0geFtkXSArIHM7XG4gICAgICAgIHZhciB0bXAgPSB1O1xuICAgICAgICB1ID0gdjtcbiAgICAgICAgdiA9IHRtcDtcbiAgICAgICAgdmFyIHZlcnRleF9jb3VudCA9IHZlcnRpY2VzLmxlbmd0aDtcbiAgICAgICAgdmVydGljZXMucHVzaChbdFswXSwgICAgICAgICAgIHRbMV0sICAgICAgICAgICB0WzJdICAgICAgICAgIF0pO1xuICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt0WzBdK3VbMF0sICAgICAgdFsxXSt1WzFdLCAgICAgIHRbMl0rdVsyXSAgICAgXSk7XG4gICAgICAgIHZlcnRpY2VzLnB1c2goW3RbMF0rdVswXSt2WzBdLCB0WzFdK3VbMV0rdlsxXSwgdFsyXSt1WzJdK3ZbMl1dKTtcbiAgICAgICAgdmVydGljZXMucHVzaChbdFswXSAgICAgK3ZbMF0sIHRbMV0gICAgICt2WzFdLCB0WzJdICAgICArdlsyXV0pO1xuICAgICAgICBmYWNlcy5wdXNoKFt2ZXJ0ZXhfY291bnQsIHZlcnRleF9jb3VudCsxLCB2ZXJ0ZXhfY291bnQrMiwgdmVydGV4X2NvdW50KzMsIHZvbHVtZVtuXV0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4geyB2ZXJ0aWNlczp2ZXJ0aWNlcywgZmFjZXM6ZmFjZXMgfTtcbn1cblxuXG5pZihleHBvcnRzKSB7XG4gIGV4cG9ydHMubWVzaGVyID0gU3R1cGlkTWVzaDtcbn1cbiIsInZhciBHcmVlZHlNZXNoID0gKGZ1bmN0aW9uIGdyZWVkeUxvYWRlcigpIHtcbiAgICBcbi8vIGNvbnRhaW5zIGFsbCBmb3J3YXJkIGZhY2VzIChpbiB0ZXJtcyBvZiBzY2FuIGRpcmVjdGlvbilcbnZhciBtYXNrID0gbmV3IEludDMyQXJyYXkoNDA5Nik7XG4vLyBhbmQgYWxsIGJhY2t3YXJkcyBmYWNlcy4gbmVlZGVkIHdoZW4gdGhlcmUgYXJlIHR3byB0cmFuc3BhcmVudCBibG9ja3Ncbi8vIG5leHQgdG8gZWFjaCBvdGhlci5cbnZhciBpbnZNYXNrID0gbmV3IEludDMyQXJyYXkoNDA5Nik7XG5cbi8vIHNldHRpbmcgMTZ0aCBiaXQgaWYgdHJhbnNwYXJlbnRcbnZhciBrVHJhbnNwYXJlbnRNYXNrICAgID0gMHg4MDAwO1xudmFyIGtOb0ZsYWdzTWFzayAgICAgICAgPSAweDdGRkY7XG52YXIga1RyYW5zcGFyZW50VHlwZXMgICA9IFtdO1xuXG5rVHJhbnNwYXJlbnRUeXBlc1sxNl0gPSB0cnVlXG5cbmZ1bmN0aW9uIGlzVHJhbnNwYXJlbnQodikge1xuICByZXR1cm4gKHYgJiBrVHJhbnNwYXJlbnRNYXNrKSA9PT0ga1RyYW5zcGFyZW50TWFzaztcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRmxhZ3Modikge1xuICByZXR1cm4gKHYgJiBrTm9GbGFnc01hc2spO1xufVxuXG5yZXR1cm4gZnVuY3Rpb24gb2hTb0dyZWVkeU1lc2hlcih2b2x1bWUsIGRpbXMsIG1lc2hlckV4dHJhRGF0YSkge1xuICB2YXIgdmVydGljZXMgPSBbXSwgZmFjZXMgPSBbXVxuICAgICwgZGltc1ggPSBkaW1zWzBdXG4gICAgLCBkaW1zWSA9IGRpbXNbMV1cbiAgICAsIGRpbXNYWSA9IGRpbXNYICogZGltc1k7XG5cbiAgdmFyIHRWZXJ0aWNlcyA9IFtdLCB0RmFjZXMgPSBbXVxuXG4gIHZhciB0cmFuc3BhcmVudFR5cGVzID0gbWVzaGVyRXh0cmFEYXRhID8gKG1lc2hlckV4dHJhRGF0YS50cmFuc3BhcmVudFR5cGVzIHx8IHt9KSA6IHt9O1xuICB2YXIgZ2V0VHlwZSA9IGZ1bmN0aW9uKHZveGVscywgb2Zmc2V0KSB7XG4gICAgdmFyIHR5cGUgPSB2b3hlbHNbb2Zmc2V0XTtcbiAgICByZXR1cm4gdHlwZSB8ICh0eXBlIGluIHRyYW5zcGFyZW50VHlwZXMgPyBrVHJhbnNwYXJlbnRNYXNrIDogMCk7XG4gIH1cblxuXG4gIC8vU3dlZXAgb3ZlciAzLWF4ZXNcbiAgZm9yKHZhciBkPTA7IGQ8MzsgKytkKSB7XG4gICAgdmFyIGksIGosIGssIGwsIHcsIFcsIGgsIG4sIGNcbiAgICAgICwgdSA9IChkKzEpJTNcbiAgICAgICwgdiA9IChkKzIpJTNcbiAgICAgICwgeCA9IFswLDAsMF1cbiAgICAgICwgcSA9IFswLDAsMF1cbiAgICAgICwgZHUgPSBbMCwwLDBdXG4gICAgICAsIGR2ID0gWzAsMCwwXVxuICAgICAgLCBkaW1zRCA9IGRpbXNbZF1cbiAgICAgICwgZGltc1UgPSBkaW1zW3VdXG4gICAgICAsIGRpbXNWID0gZGltc1t2XVxuICAgICAgLCBxZGltc1gsIHFkaW1zWFlcbiAgICAgICwgeGRcblxuICAgIGlmIChtYXNrLmxlbmd0aCA8IGRpbXNVICogZGltc1YpIHtcbiAgICAgIG1hc2sgPSBuZXcgSW50MzJBcnJheShkaW1zVSAqIGRpbXNWKTtcbiAgICAgIGludk1hc2sgPSBuZXcgSW50MzJBcnJheShkaW1zVSAqIGRpbXNWKTtcbiAgICB9XG5cbiAgICBxW2RdID0gIDE7XG4gICAgeFtkXSA9IC0xO1xuXG4gICAgcWRpbXNYICA9IGRpbXNYICAqIHFbMV1cbiAgICBxZGltc1hZID0gZGltc1hZICogcVsyXVxuXG4gICAgLy8gQ29tcHV0ZSBtYXNrXG4gICAgd2hpbGUgKHhbZF0gPCBkaW1zRCkge1xuICAgICAgeGQgPSB4W2RdXG4gICAgICBuID0gMDtcblxuICAgICAgZm9yKHhbdl0gPSAwOyB4W3ZdIDwgZGltc1Y7ICsreFt2XSkge1xuICAgICAgICBmb3IoeFt1XSA9IDA7IHhbdV0gPCBkaW1zVTsgKyt4W3VdLCArK24pIHtcbiAgICAgICAgICAvLyBNb2RpZmllZCB0byByZWFkIHRocm91Z2ggZ2V0VHlwZSgpXG4gICAgICAgICAgdmFyIGEgPSB4ZCA+PSAwICAgICAgJiYgZ2V0VHlwZSh2b2x1bWUsIHhbMF0gICAgICArIGRpbXNYICogeFsxXSAgICAgICAgICArIGRpbXNYWSAqIHhbMl0gICAgICAgICAgKVxuICAgICAgICAgICAgLCBiID0geGQgPCBkaW1zRC0xICYmIGdldFR5cGUodm9sdW1lLCB4WzBdK3FbMF0gKyBkaW1zWCAqIHhbMV0gKyBxZGltc1ggKyBkaW1zWFkgKiB4WzJdICsgcWRpbXNYWSlcblxuICAgICAgICAgIC8vIGJvdGggYXJlIHRyYW5zcGFyZW50LCBhZGQgdG8gYm90aCBkaXJlY3Rpb25zXG4gICAgICAgICAgaWYgKGlzVHJhbnNwYXJlbnQoYSkgJiYgaXNUcmFuc3BhcmVudChiKSkge1xuICAgICAgICAgICAgbWFza1tuXSA9IGE7XG4gICAgICAgICAgICBpbnZNYXNrW25dID0gYjtcbiAgICAgICAgICAvLyBpZiBhIGlzIHNvbGlkIGFuZCBiIGlzIG5vdCB0aGVyZSBvciB0cmFuc3BhcmVudFxuICAgICAgICAgIH0gZWxzZSBpZiAoYSAmJiAoIWIgfHwgaXNUcmFuc3BhcmVudChiKSkpIHtcbiAgICAgICAgICAgIG1hc2tbbl0gPSBhO1xuICAgICAgICAgICAgaW52TWFza1tuXSA9IDBcbiAgICAgICAgICAvLyBpZiBiIGlzIHNvbGlkIGFuZCBhIGlzIG5vdCB0aGVyZSBvciB0cmFuc3BhcmVudFxuICAgICAgICAgIH0gZWxzZSBpZiAoYiAmJiAoIWEgfHwgaXNUcmFuc3BhcmVudChhKSkpIHtcbiAgICAgICAgICAgIG1hc2tbbl0gPSAwXG4gICAgICAgICAgICBpbnZNYXNrW25dID0gYjtcbiAgICAgICAgICAvLyBkb250IGRyYXcgdGhpcyBmYWNlXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hc2tbbl0gPSAwXG4gICAgICAgICAgICBpbnZNYXNrW25dID0gMFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICArK3hbZF07XG5cbiAgICAgIC8vIEdlbmVyYXRlIG1lc2ggZm9yIG1hc2sgdXNpbmcgbGV4aWNvZ3JhcGhpYyBvcmRlcmluZ1xuICAgICAgZnVuY3Rpb24gZ2VuZXJhdGVNZXNoKG1hc2ssIGRpbXNWLCBkaW1zVSwgdmVydGljZXMsIGZhY2VzLCBjbG9ja3dpc2UpIHtcbiAgICAgICAgY2xvY2t3aXNlID0gY2xvY2t3aXNlID09PSB1bmRlZmluZWQgPyB0cnVlIDogY2xvY2t3aXNlO1xuICAgICAgICB2YXIgbiwgaiwgaSwgYywgdywgaCwgaywgZHUgPSBbMCwwLDBdLCBkdiA9IFswLDAsMF07XG4gICAgICAgIG4gPSAwO1xuICAgICAgICBmb3IgKGo9MDsgaiA8IGRpbXNWOyArK2opIHtcbiAgICAgICAgICBmb3IgKGk9MDsgaSA8IGRpbXNVOyApIHtcbiAgICAgICAgICAgIGMgPSBtYXNrW25dO1xuICAgICAgICAgICAgaWYgKCFjKSB7XG4gICAgICAgICAgICAgIGkrKzsgIG4rKzsgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vQ29tcHV0ZSB3aWR0aFxuICAgICAgICAgICAgdyA9IDE7XG4gICAgICAgICAgICB3aGlsZSAoYyA9PT0gbWFza1tuK3ddICYmIGkrdyA8IGRpbXNVKSB3Kys7XG5cbiAgICAgICAgICAgIC8vQ29tcHV0ZSBoZWlnaHQgKHRoaXMgaXMgc2xpZ2h0bHkgYXdrd2FyZClcbiAgICAgICAgICAgIGZvciAoaD0xOyBqK2ggPCBkaW1zVjsgKytoKSB7XG4gICAgICAgICAgICAgIGsgPSAwO1xuICAgICAgICAgICAgICB3aGlsZSAoayA8IHcgJiYgYyA9PT0gbWFza1tuK2sraCpkaW1zVV0pIGsrK1xuICAgICAgICAgICAgICBpZiAoayA8IHcpIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBZGQgcXVhZFxuICAgICAgICAgICAgLy8gVGhlIGR1L2R2IGFycmF5cyBhcmUgcmV1c2VkL3Jlc2V0XG4gICAgICAgICAgICAvLyBmb3IgZWFjaCBpdGVyYXRpb24uXG4gICAgICAgICAgICBkdVtkXSA9IDA7IGR2W2RdID0gMDtcbiAgICAgICAgICAgIHhbdV0gID0gaTsgIHhbdl0gPSBqO1xuXG4gICAgICAgICAgICBpZiAoY2xvY2t3aXNlKSB7XG4gICAgICAgICAgICAvLyBpZiAoYyA+IDApIHtcbiAgICAgICAgICAgICAgZHZbdl0gPSBoOyBkdlt1XSA9IDA7XG4gICAgICAgICAgICAgIGR1W3VdID0gdzsgZHVbdl0gPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gYyA9IC1jO1xuICAgICAgICAgICAgICBkdVt2XSA9IGg7IGR1W3VdID0gMDtcbiAgICAgICAgICAgICAgZHZbdV0gPSB3OyBkdlt2XSA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vICMjIGVuYWJsZSBjb2RlIHRvIGVuc3VyZSB0aGF0IHRyYW5zcGFyZW50IGZhY2VzIGFyZSBsYXN0IGluIHRoZSBsaXN0XG4gICAgICAgICAgICAvLyBpZiAoIWlzVHJhbnNwYXJlbnQoYykpIHtcbiAgICAgICAgICAgICAgdmFyIHZlcnRleF9jb3VudCA9IHZlcnRpY2VzLmxlbmd0aDtcbiAgICAgICAgICAgICAgdmVydGljZXMucHVzaChbeFswXSwgICAgICAgICAgICAgeFsxXSwgICAgICAgICAgICAgeFsyXSAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKFt4WzBdK2R1WzBdLCAgICAgICB4WzFdK2R1WzFdLCAgICAgICB4WzJdK2R1WzJdICAgICAgXSk7XG4gICAgICAgICAgICAgIHZlcnRpY2VzLnB1c2goW3hbMF0rZHVbMF0rZHZbMF0sIHhbMV0rZHVbMV0rZHZbMV0sIHhbMl0rZHVbMl0rZHZbMl1dKTtcbiAgICAgICAgICAgICAgdmVydGljZXMucHVzaChbeFswXSAgICAgICtkdlswXSwgeFsxXSAgICAgICtkdlsxXSwgeFsyXSAgICAgICtkdlsyXV0pO1xuICAgICAgICAgICAgICBmYWNlcy5wdXNoKFt2ZXJ0ZXhfY291bnQsIHZlcnRleF9jb3VudCsxLCB2ZXJ0ZXhfY291bnQrMiwgdmVydGV4X2NvdW50KzMsIHJlbW92ZUZsYWdzKGMpXSk7XG4gICAgICAgICAgICAvLyB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gICB2YXIgdmVydGV4X2NvdW50ID0gdFZlcnRpY2VzLmxlbmd0aDtcbiAgICAgICAgICAgIC8vICAgdFZlcnRpY2VzLnB1c2goW3hbMF0sICAgICAgICAgICAgIHhbMV0sICAgICAgICAgICAgIHhbMl0gICAgICAgICAgICBdKTtcbiAgICAgICAgICAgIC8vICAgdFZlcnRpY2VzLnB1c2goW3hbMF0rZHVbMF0sICAgICAgIHhbMV0rZHVbMV0sICAgICAgIHhbMl0rZHVbMl0gICAgICBdKTtcbiAgICAgICAgICAgIC8vICAgdFZlcnRpY2VzLnB1c2goW3hbMF0rZHVbMF0rZHZbMF0sIHhbMV0rZHVbMV0rZHZbMV0sIHhbMl0rZHVbMl0rZHZbMl1dKTtcbiAgICAgICAgICAgIC8vICAgdFZlcnRpY2VzLnB1c2goW3hbMF0gICAgICArZHZbMF0sIHhbMV0gICAgICArZHZbMV0sIHhbMl0gICAgICArZHZbMl1dKTtcbiAgICAgICAgICAgIC8vICAgdEZhY2VzLnB1c2goW3ZlcnRleF9jb3VudCwgdmVydGV4X2NvdW50KzEsIHZlcnRleF9jb3VudCsyLCB2ZXJ0ZXhfY291bnQrMywgcmVtb3ZlRmxhZ3MoYyldKTtcbiAgICAgICAgICAgIC8vIH1cblxuICAgICAgICAgICAgLy9aZXJvLW91dCBtYXNrXG4gICAgICAgICAgICBXID0gbiArIHc7XG4gICAgICAgICAgICBmb3IobD0wOyBsPGg7ICsrbCkge1xuICAgICAgICAgICAgICBmb3Ioaz1uOyBrPFc7ICsraykge1xuICAgICAgICAgICAgICAgIG1hc2tbaytsKmRpbXNVXSA9IDA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9JbmNyZW1lbnQgY291bnRlcnMgYW5kIGNvbnRpbnVlXG4gICAgICAgICAgICBpICs9IHc7IG4gKz0gdztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGdlbmVyYXRlTWVzaChtYXNrLCBkaW1zViwgZGltc1UsIHZlcnRpY2VzLCBmYWNlcywgdHJ1ZSlcbiAgICAgIGdlbmVyYXRlTWVzaChpbnZNYXNrLCBkaW1zViwgZGltc1UsIHZlcnRpY2VzLCBmYWNlcywgZmFsc2UpXG4gICAgfVxuICB9XG4gIFxuICAvLyAjIyBlbmFibGUgY29kZSB0byBlbnN1cmUgdGhhdCB0cmFuc3BhcmVudCBmYWNlcyBhcmUgbGFzdCBpbiB0aGUgbGlzdFxuICAvLyB2YXIgdmVydGV4X2NvdW50ID0gdmVydGljZXMubGVuZ3RoO1xuICAvLyB2YXIgbmV3RmFjZXMgPSB0RmFjZXMubWFwKGZ1bmN0aW9uKHYpIHtcbiAgLy8gICByZXR1cm4gW3ZlcnRleF9jb3VudCt2WzBdLCB2ZXJ0ZXhfY291bnQrdlsxXSwgdmVydGV4X2NvdW50K3ZbMl0sIHZlcnRleF9jb3VudCt2WzNdLCB2WzRdXVxuICAvLyB9KVxuICAvLyBcbiAgLy8gcmV0dXJuIHsgdmVydGljZXM6dmVydGljZXMuY29uY2F0KHRWZXJ0aWNlcyksIGZhY2VzOmZhY2VzLmNvbmNhdChuZXdGYWNlcykgfTtcbiAgXG4gIC8vIFRPRE86IFRyeSBzb3J0aW5nIGJ5IHRleHR1cmUgdG8gc2VlIGlmIHdlIGNhbiByZWR1Y2UgZHJhdyBjYWxscy5cbiAgLy8gZmFjZXMuc29ydChmdW5jdGlvbiBzb3J0RmFjZXMoYSwgYikge1xuICAvLyAgIHJldHVybiBiWzRdIC0gYVs0XTtcbiAgLy8gfSlcbiAgcmV0dXJuIHsgdmVydGljZXM6dmVydGljZXMsIGZhY2VzOmZhY2VzIH07XG59XG59KSgpO1xuXG5pZihleHBvcnRzKSB7XG4gIGV4cG9ydHMubWVzaGVyID0gR3JlZWR5TWVzaDtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gaW5oZXJpdHNcblxuZnVuY3Rpb24gaW5oZXJpdHMgKGMsIHAsIHByb3RvKSB7XG4gIHByb3RvID0gcHJvdG8gfHwge31cbiAgdmFyIGUgPSB7fVxuICA7W2MucHJvdG90eXBlLCBwcm90b10uZm9yRWFjaChmdW5jdGlvbiAocykge1xuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHMpLmZvckVhY2goZnVuY3Rpb24gKGspIHtcbiAgICAgIGVba10gPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHMsIGspXG4gICAgfSlcbiAgfSlcbiAgYy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHAucHJvdG90eXBlLCBlKVxuICBjLnN1cGVyID0gcFxufVxuXG4vL2Z1bmN0aW9uIENoaWxkICgpIHtcbi8vICBDaGlsZC5zdXBlci5jYWxsKHRoaXMpXG4vLyAgY29uc29sZS5lcnJvcihbdGhpc1xuLy8gICAgICAgICAgICAgICAgLHRoaXMuY29uc3RydWN0b3Jcbi8vICAgICAgICAgICAgICAgICx0aGlzLmNvbnN0cnVjdG9yID09PSBDaGlsZFxuLy8gICAgICAgICAgICAgICAgLHRoaXMuY29uc3RydWN0b3Iuc3VwZXIgPT09IFBhcmVudFxuLy8gICAgICAgICAgICAgICAgLE9iamVjdC5nZXRQcm90b3R5cGVPZih0aGlzKSA9PT0gQ2hpbGQucHJvdG90eXBlXG4vLyAgICAgICAgICAgICAgICAsT2JqZWN0LmdldFByb3RvdHlwZU9mKE9iamVjdC5nZXRQcm90b3R5cGVPZih0aGlzKSlcbi8vICAgICAgICAgICAgICAgICA9PT0gUGFyZW50LnByb3RvdHlwZVxuLy8gICAgICAgICAgICAgICAgLHRoaXMgaW5zdGFuY2VvZiBDaGlsZFxuLy8gICAgICAgICAgICAgICAgLHRoaXMgaW5zdGFuY2VvZiBQYXJlbnRdKVxuLy99XG4vL2Z1bmN0aW9uIFBhcmVudCAoKSB7fVxuLy9pbmhlcml0cyhDaGlsZCwgUGFyZW50KVxuLy9uZXcgQ2hpbGRcbiIsInZhciBpb3RhID0gcmVxdWlyZShcImlvdGEtYXJyYXlcIilcbnZhciBpc0J1ZmZlciA9IHJlcXVpcmUoXCJpcy1idWZmZXJcIilcblxudmFyIGhhc1R5cGVkQXJyYXlzICA9ICgodHlwZW9mIEZsb2F0NjRBcnJheSkgIT09IFwidW5kZWZpbmVkXCIpXG5cbmZ1bmN0aW9uIGNvbXBhcmUxc3QoYSwgYikge1xuICByZXR1cm4gYVswXSAtIGJbMF1cbn1cblxuZnVuY3Rpb24gb3JkZXIoKSB7XG4gIHZhciBzdHJpZGUgPSB0aGlzLnN0cmlkZVxuICB2YXIgdGVybXMgPSBuZXcgQXJyYXkoc3RyaWRlLmxlbmd0aClcbiAgdmFyIGlcbiAgZm9yKGk9MDsgaTx0ZXJtcy5sZW5ndGg7ICsraSkge1xuICAgIHRlcm1zW2ldID0gW01hdGguYWJzKHN0cmlkZVtpXSksIGldXG4gIH1cbiAgdGVybXMuc29ydChjb21wYXJlMXN0KVxuICB2YXIgcmVzdWx0ID0gbmV3IEFycmF5KHRlcm1zLmxlbmd0aClcbiAgZm9yKGk9MDsgaTxyZXN1bHQubGVuZ3RoOyArK2kpIHtcbiAgICByZXN1bHRbaV0gPSB0ZXJtc1tpXVsxXVxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cblxuZnVuY3Rpb24gY29tcGlsZUNvbnN0cnVjdG9yKGR0eXBlLCBkaW1lbnNpb24pIHtcbiAgdmFyIGNsYXNzTmFtZSA9IFtcIlZpZXdcIiwgZGltZW5zaW9uLCBcImRcIiwgZHR5cGVdLmpvaW4oXCJcIilcbiAgaWYoZGltZW5zaW9uIDwgMCkge1xuICAgIGNsYXNzTmFtZSA9IFwiVmlld19OaWxcIiArIGR0eXBlXG4gIH1cbiAgdmFyIHVzZUdldHRlcnMgPSAoZHR5cGUgPT09IFwiZ2VuZXJpY1wiKVxuXG4gIGlmKGRpbWVuc2lvbiA9PT0gLTEpIHtcbiAgICAvL1NwZWNpYWwgY2FzZSBmb3IgdHJpdmlhbCBhcnJheXNcbiAgICB2YXIgY29kZSA9XG4gICAgICBcImZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIihhKXt0aGlzLmRhdGE9YTt9O1xcXG52YXIgcHJvdG89XCIrY2xhc3NOYW1lK1wiLnByb3RvdHlwZTtcXFxucHJvdG8uZHR5cGU9J1wiK2R0eXBlK1wiJztcXFxucHJvdG8uaW5kZXg9ZnVuY3Rpb24oKXtyZXR1cm4gLTF9O1xcXG5wcm90by5zaXplPTA7XFxcbnByb3RvLmRpbWVuc2lvbj0tMTtcXFxucHJvdG8uc2hhcGU9cHJvdG8uc3RyaWRlPXByb3RvLm9yZGVyPVtdO1xcXG5wcm90by5sbz1wcm90by5oaT1wcm90by50cmFuc3Bvc2U9cHJvdG8uc3RlcD1cXFxuZnVuY3Rpb24oKXtyZXR1cm4gbmV3IFwiK2NsYXNzTmFtZStcIih0aGlzLmRhdGEpO307XFxcbnByb3RvLmdldD1wcm90by5zZXQ9ZnVuY3Rpb24oKXt9O1xcXG5wcm90by5waWNrPWZ1bmN0aW9uKCl7cmV0dXJuIG51bGx9O1xcXG5yZXR1cm4gZnVuY3Rpb24gY29uc3RydWN0X1wiK2NsYXNzTmFtZStcIihhKXtyZXR1cm4gbmV3IFwiK2NsYXNzTmFtZStcIihhKTt9XCJcbiAgICB2YXIgcHJvY2VkdXJlID0gbmV3IEZ1bmN0aW9uKGNvZGUpXG4gICAgcmV0dXJuIHByb2NlZHVyZSgpXG4gIH0gZWxzZSBpZihkaW1lbnNpb24gPT09IDApIHtcbiAgICAvL1NwZWNpYWwgY2FzZSBmb3IgMGQgYXJyYXlzXG4gICAgdmFyIGNvZGUgPVxuICAgICAgXCJmdW5jdGlvbiBcIitjbGFzc05hbWUrXCIoYSxkKSB7XFxcbnRoaXMuZGF0YSA9IGE7XFxcbnRoaXMub2Zmc2V0ID0gZFxcXG59O1xcXG52YXIgcHJvdG89XCIrY2xhc3NOYW1lK1wiLnByb3RvdHlwZTtcXFxucHJvdG8uZHR5cGU9J1wiK2R0eXBlK1wiJztcXFxucHJvdG8uaW5kZXg9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5vZmZzZXR9O1xcXG5wcm90by5kaW1lbnNpb249MDtcXFxucHJvdG8uc2l6ZT0xO1xcXG5wcm90by5zaGFwZT1cXFxucHJvdG8uc3RyaWRlPVxcXG5wcm90by5vcmRlcj1bXTtcXFxucHJvdG8ubG89XFxcbnByb3RvLmhpPVxcXG5wcm90by50cmFuc3Bvc2U9XFxcbnByb3RvLnN0ZXA9ZnVuY3Rpb24gXCIrY2xhc3NOYW1lK1wiX2NvcHkoKSB7XFxcbnJldHVybiBuZXcgXCIrY2xhc3NOYW1lK1wiKHRoaXMuZGF0YSx0aGlzLm9mZnNldClcXFxufTtcXFxucHJvdG8ucGljaz1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfcGljaygpe1xcXG5yZXR1cm4gVHJpdmlhbEFycmF5KHRoaXMuZGF0YSk7XFxcbn07XFxcbnByb3RvLnZhbHVlT2Y9cHJvdG8uZ2V0PWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9nZXQoKXtcXFxucmV0dXJuIFwiKyh1c2VHZXR0ZXJzID8gXCJ0aGlzLmRhdGEuZ2V0KHRoaXMub2Zmc2V0KVwiIDogXCJ0aGlzLmRhdGFbdGhpcy5vZmZzZXRdXCIpK1xuXCJ9O1xcXG5wcm90by5zZXQ9ZnVuY3Rpb24gXCIrY2xhc3NOYW1lK1wiX3NldCh2KXtcXFxucmV0dXJuIFwiKyh1c2VHZXR0ZXJzID8gXCJ0aGlzLmRhdGEuc2V0KHRoaXMub2Zmc2V0LHYpXCIgOiBcInRoaXMuZGF0YVt0aGlzLm9mZnNldF09dlwiKStcIlxcXG59O1xcXG5yZXR1cm4gZnVuY3Rpb24gY29uc3RydWN0X1wiK2NsYXNzTmFtZStcIihhLGIsYyxkKXtyZXR1cm4gbmV3IFwiK2NsYXNzTmFtZStcIihhLGQpfVwiXG4gICAgdmFyIHByb2NlZHVyZSA9IG5ldyBGdW5jdGlvbihcIlRyaXZpYWxBcnJheVwiLCBjb2RlKVxuICAgIHJldHVybiBwcm9jZWR1cmUoQ0FDSEVEX0NPTlNUUlVDVE9SU1tkdHlwZV1bMF0pXG4gIH1cblxuICB2YXIgY29kZSA9IFtcIid1c2Ugc3RyaWN0J1wiXVxuXG4gIC8vQ3JlYXRlIGNvbnN0cnVjdG9yIGZvciB2aWV3XG4gIHZhciBpbmRpY2VzID0gaW90YShkaW1lbnNpb24pXG4gIHZhciBhcmdzID0gaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkgeyByZXR1cm4gXCJpXCIraSB9KVxuICB2YXIgaW5kZXhfc3RyID0gXCJ0aGlzLm9mZnNldCtcIiArIGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgICAgcmV0dXJuIFwidGhpcy5zdHJpZGVbXCIgKyBpICsgXCJdKmlcIiArIGlcbiAgICAgIH0pLmpvaW4oXCIrXCIpXG4gIHZhciBzaGFwZUFyZyA9IGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBcImJcIitpXG4gICAgfSkuam9pbihcIixcIilcbiAgdmFyIHN0cmlkZUFyZyA9IGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBcImNcIitpXG4gICAgfSkuam9pbihcIixcIilcbiAgY29kZS5wdXNoKFxuICAgIFwiZnVuY3Rpb24gXCIrY2xhc3NOYW1lK1wiKGEsXCIgKyBzaGFwZUFyZyArIFwiLFwiICsgc3RyaWRlQXJnICsgXCIsZCl7dGhpcy5kYXRhPWFcIixcbiAgICAgIFwidGhpcy5zaGFwZT1bXCIgKyBzaGFwZUFyZyArIFwiXVwiLFxuICAgICAgXCJ0aGlzLnN0cmlkZT1bXCIgKyBzdHJpZGVBcmcgKyBcIl1cIixcbiAgICAgIFwidGhpcy5vZmZzZXQ9ZHwwfVwiLFxuICAgIFwidmFyIHByb3RvPVwiK2NsYXNzTmFtZStcIi5wcm90b3R5cGVcIixcbiAgICBcInByb3RvLmR0eXBlPSdcIitkdHlwZStcIidcIixcbiAgICBcInByb3RvLmRpbWVuc2lvbj1cIitkaW1lbnNpb24pXG5cbiAgLy92aWV3LnNpemU6XG4gIGNvZGUucHVzaChcIk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywnc2l6ZScse2dldDpmdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfc2l6ZSgpe1xcXG5yZXR1cm4gXCIraW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkgeyByZXR1cm4gXCJ0aGlzLnNoYXBlW1wiK2krXCJdXCIgfSkuam9pbihcIipcIiksXG5cIn19KVwiKVxuXG4gIC8vdmlldy5vcmRlcjpcbiAgaWYoZGltZW5zaW9uID09PSAxKSB7XG4gICAgY29kZS5wdXNoKFwicHJvdG8ub3JkZXI9WzBdXCIpXG4gIH0gZWxzZSB7XG4gICAgY29kZS5wdXNoKFwiT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCdvcmRlcicse2dldDpcIilcbiAgICBpZihkaW1lbnNpb24gPCA0KSB7XG4gICAgICBjb2RlLnB1c2goXCJmdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfb3JkZXIoKXtcIilcbiAgICAgIGlmKGRpbWVuc2lvbiA9PT0gMikge1xuICAgICAgICBjb2RlLnB1c2goXCJyZXR1cm4gKE1hdGguYWJzKHRoaXMuc3RyaWRlWzBdKT5NYXRoLmFicyh0aGlzLnN0cmlkZVsxXSkpP1sxLDBdOlswLDFdfX0pXCIpXG4gICAgICB9IGVsc2UgaWYoZGltZW5zaW9uID09PSAzKSB7XG4gICAgICAgIGNvZGUucHVzaChcblwidmFyIHMwPU1hdGguYWJzKHRoaXMuc3RyaWRlWzBdKSxzMT1NYXRoLmFicyh0aGlzLnN0cmlkZVsxXSksczI9TWF0aC5hYnModGhpcy5zdHJpZGVbMl0pO1xcXG5pZihzMD5zMSl7XFxcbmlmKHMxPnMyKXtcXFxucmV0dXJuIFsyLDEsMF07XFxcbn1lbHNlIGlmKHMwPnMyKXtcXFxucmV0dXJuIFsxLDIsMF07XFxcbn1lbHNle1xcXG5yZXR1cm4gWzEsMCwyXTtcXFxufVxcXG59ZWxzZSBpZihzMD5zMil7XFxcbnJldHVybiBbMiwwLDFdO1xcXG59ZWxzZSBpZihzMj5zMSl7XFxcbnJldHVybiBbMCwxLDJdO1xcXG59ZWxzZXtcXFxucmV0dXJuIFswLDIsMV07XFxcbn19fSlcIilcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29kZS5wdXNoKFwiT1JERVJ9KVwiKVxuICAgIH1cbiAgfVxuXG4gIC8vdmlldy5zZXQoaTAsIC4uLiwgdik6XG4gIGNvZGUucHVzaChcblwicHJvdG8uc2V0PWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9zZXQoXCIrYXJncy5qb2luKFwiLFwiKStcIix2KXtcIilcbiAgaWYodXNlR2V0dGVycykge1xuICAgIGNvZGUucHVzaChcInJldHVybiB0aGlzLmRhdGEuc2V0KFwiK2luZGV4X3N0citcIix2KX1cIilcbiAgfSBlbHNlIHtcbiAgICBjb2RlLnB1c2goXCJyZXR1cm4gdGhpcy5kYXRhW1wiK2luZGV4X3N0citcIl09dn1cIilcbiAgfVxuXG4gIC8vdmlldy5nZXQoaTAsIC4uLik6XG4gIGNvZGUucHVzaChcInByb3RvLmdldD1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfZ2V0KFwiK2FyZ3Muam9pbihcIixcIikrXCIpe1wiKVxuICBpZih1c2VHZXR0ZXJzKSB7XG4gICAgY29kZS5wdXNoKFwicmV0dXJuIHRoaXMuZGF0YS5nZXQoXCIraW5kZXhfc3RyK1wiKX1cIilcbiAgfSBlbHNlIHtcbiAgICBjb2RlLnB1c2goXCJyZXR1cm4gdGhpcy5kYXRhW1wiK2luZGV4X3N0citcIl19XCIpXG4gIH1cblxuICAvL3ZpZXcuaW5kZXg6XG4gIGNvZGUucHVzaChcbiAgICBcInByb3RvLmluZGV4PWZ1bmN0aW9uIFwiK2NsYXNzTmFtZStcIl9pbmRleChcIiwgYXJncy5qb2luKCksIFwiKXtyZXR1cm4gXCIraW5kZXhfc3RyK1wifVwiKVxuXG4gIC8vdmlldy5oaSgpOlxuICBjb2RlLnB1c2goXCJwcm90by5oaT1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfaGkoXCIrYXJncy5qb2luKFwiLFwiKStcIil7cmV0dXJuIG5ldyBcIitjbGFzc05hbWUrXCIodGhpcy5kYXRhLFwiK1xuICAgIGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBbXCIodHlwZW9mIGlcIixpLFwiIT09J251bWJlcid8fGlcIixpLFwiPDApP3RoaXMuc2hhcGVbXCIsIGksIFwiXTppXCIsIGksXCJ8MFwiXS5qb2luKFwiXCIpXG4gICAgfSkuam9pbihcIixcIikrXCIsXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwidGhpcy5zdHJpZGVbXCIraSArIFwiXVwiXG4gICAgfSkuam9pbihcIixcIikrXCIsdGhpcy5vZmZzZXQpfVwiKVxuXG4gIC8vdmlldy5sbygpOlxuICB2YXIgYV92YXJzID0gaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkgeyByZXR1cm4gXCJhXCIraStcIj10aGlzLnNoYXBlW1wiK2krXCJdXCIgfSlcbiAgdmFyIGNfdmFycyA9IGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHsgcmV0dXJuIFwiY1wiK2krXCI9dGhpcy5zdHJpZGVbXCIraStcIl1cIiB9KVxuICBjb2RlLnB1c2goXCJwcm90by5sbz1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfbG8oXCIrYXJncy5qb2luKFwiLFwiKStcIil7dmFyIGI9dGhpcy5vZmZzZXQsZD0wLFwiK2FfdmFycy5qb2luKFwiLFwiKStcIixcIitjX3ZhcnMuam9pbihcIixcIikpXG4gIGZvcih2YXIgaT0wOyBpPGRpbWVuc2lvbjsgKytpKSB7XG4gICAgY29kZS5wdXNoKFxuXCJpZih0eXBlb2YgaVwiK2krXCI9PT0nbnVtYmVyJyYmaVwiK2krXCI+PTApe1xcXG5kPWlcIitpK1wifDA7XFxcbmIrPWNcIitpK1wiKmQ7XFxcbmFcIitpK1wiLT1kfVwiKVxuICB9XG4gIGNvZGUucHVzaChcInJldHVybiBuZXcgXCIrY2xhc3NOYW1lK1wiKHRoaXMuZGF0YSxcIitcbiAgICBpbmRpY2VzLm1hcChmdW5jdGlvbihpKSB7XG4gICAgICByZXR1cm4gXCJhXCIraVxuICAgIH0pLmpvaW4oXCIsXCIpK1wiLFwiK1xuICAgIGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBcImNcIitpXG4gICAgfSkuam9pbihcIixcIikrXCIsYil9XCIpXG5cbiAgLy92aWV3LnN0ZXAoKTpcbiAgY29kZS5wdXNoKFwicHJvdG8uc3RlcD1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfc3RlcChcIithcmdzLmpvaW4oXCIsXCIpK1wiKXt2YXIgXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwiYVwiK2krXCI9dGhpcy5zaGFwZVtcIitpK1wiXVwiXG4gICAgfSkuam9pbihcIixcIikrXCIsXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwiYlwiK2krXCI9dGhpcy5zdHJpZGVbXCIraStcIl1cIlxuICAgIH0pLmpvaW4oXCIsXCIpK1wiLGM9dGhpcy5vZmZzZXQsZD0wLGNlaWw9TWF0aC5jZWlsXCIpXG4gIGZvcih2YXIgaT0wOyBpPGRpbWVuc2lvbjsgKytpKSB7XG4gICAgY29kZS5wdXNoKFxuXCJpZih0eXBlb2YgaVwiK2krXCI9PT0nbnVtYmVyJyl7XFxcbmQ9aVwiK2krXCJ8MDtcXFxuaWYoZDwwKXtcXFxuYys9YlwiK2krXCIqKGFcIitpK1wiLTEpO1xcXG5hXCIraStcIj1jZWlsKC1hXCIraStcIi9kKVxcXG59ZWxzZXtcXFxuYVwiK2krXCI9Y2VpbChhXCIraStcIi9kKVxcXG59XFxcbmJcIitpK1wiKj1kXFxcbn1cIilcbiAgfVxuICBjb2RlLnB1c2goXCJyZXR1cm4gbmV3IFwiK2NsYXNzTmFtZStcIih0aGlzLmRhdGEsXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwiYVwiICsgaVxuICAgIH0pLmpvaW4oXCIsXCIpK1wiLFwiK1xuICAgIGluZGljZXMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiBcImJcIiArIGlcbiAgICB9KS5qb2luKFwiLFwiKStcIixjKX1cIilcblxuICAvL3ZpZXcudHJhbnNwb3NlKCk6XG4gIHZhciB0U2hhcGUgPSBuZXcgQXJyYXkoZGltZW5zaW9uKVxuICB2YXIgdFN0cmlkZSA9IG5ldyBBcnJheShkaW1lbnNpb24pXG4gIGZvcih2YXIgaT0wOyBpPGRpbWVuc2lvbjsgKytpKSB7XG4gICAgdFNoYXBlW2ldID0gXCJhW2lcIitpK1wiXVwiXG4gICAgdFN0cmlkZVtpXSA9IFwiYltpXCIraStcIl1cIlxuICB9XG4gIGNvZGUucHVzaChcInByb3RvLnRyYW5zcG9zZT1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfdHJhbnNwb3NlKFwiK2FyZ3MrXCIpe1wiK1xuICAgIGFyZ3MubWFwKGZ1bmN0aW9uKG4saWR4KSB7IHJldHVybiBuICsgXCI9KFwiICsgbiArIFwiPT09dW5kZWZpbmVkP1wiICsgaWR4ICsgXCI6XCIgKyBuICsgXCJ8MClcIn0pLmpvaW4oXCI7XCIpLFxuICAgIFwidmFyIGE9dGhpcy5zaGFwZSxiPXRoaXMuc3RyaWRlO3JldHVybiBuZXcgXCIrY2xhc3NOYW1lK1wiKHRoaXMuZGF0YSxcIit0U2hhcGUuam9pbihcIixcIikrXCIsXCIrdFN0cmlkZS5qb2luKFwiLFwiKStcIix0aGlzLm9mZnNldCl9XCIpXG5cbiAgLy92aWV3LnBpY2soKTpcbiAgY29kZS5wdXNoKFwicHJvdG8ucGljaz1mdW5jdGlvbiBcIitjbGFzc05hbWUrXCJfcGljayhcIithcmdzK1wiKXt2YXIgYT1bXSxiPVtdLGM9dGhpcy5vZmZzZXRcIilcbiAgZm9yKHZhciBpPTA7IGk8ZGltZW5zaW9uOyArK2kpIHtcbiAgICBjb2RlLnB1c2goXCJpZih0eXBlb2YgaVwiK2krXCI9PT0nbnVtYmVyJyYmaVwiK2krXCI+PTApe2M9KGMrdGhpcy5zdHJpZGVbXCIraStcIl0qaVwiK2krXCIpfDB9ZWxzZXthLnB1c2godGhpcy5zaGFwZVtcIitpK1wiXSk7Yi5wdXNoKHRoaXMuc3RyaWRlW1wiK2krXCJdKX1cIilcbiAgfVxuICBjb2RlLnB1c2goXCJ2YXIgY3Rvcj1DVE9SX0xJU1RbYS5sZW5ndGgrMV07cmV0dXJuIGN0b3IodGhpcy5kYXRhLGEsYixjKX1cIilcblxuICAvL0FkZCByZXR1cm4gc3RhdGVtZW50XG4gIGNvZGUucHVzaChcInJldHVybiBmdW5jdGlvbiBjb25zdHJ1Y3RfXCIrY2xhc3NOYW1lK1wiKGRhdGEsc2hhcGUsc3RyaWRlLG9mZnNldCl7cmV0dXJuIG5ldyBcIitjbGFzc05hbWUrXCIoZGF0YSxcIitcbiAgICBpbmRpY2VzLm1hcChmdW5jdGlvbihpKSB7XG4gICAgICByZXR1cm4gXCJzaGFwZVtcIitpK1wiXVwiXG4gICAgfSkuam9pbihcIixcIikrXCIsXCIrXG4gICAgaW5kaWNlcy5tYXAoZnVuY3Rpb24oaSkge1xuICAgICAgcmV0dXJuIFwic3RyaWRlW1wiK2krXCJdXCJcbiAgICB9KS5qb2luKFwiLFwiKStcIixvZmZzZXQpfVwiKVxuXG4gIC8vQ29tcGlsZSBwcm9jZWR1cmVcbiAgdmFyIHByb2NlZHVyZSA9IG5ldyBGdW5jdGlvbihcIkNUT1JfTElTVFwiLCBcIk9SREVSXCIsIGNvZGUuam9pbihcIlxcblwiKSlcbiAgcmV0dXJuIHByb2NlZHVyZShDQUNIRURfQ09OU1RSVUNUT1JTW2R0eXBlXSwgb3JkZXIpXG59XG5cbmZ1bmN0aW9uIGFycmF5RFR5cGUoZGF0YSkge1xuICBpZihpc0J1ZmZlcihkYXRhKSkge1xuICAgIHJldHVybiBcImJ1ZmZlclwiXG4gIH1cbiAgaWYoaGFzVHlwZWRBcnJheXMpIHtcbiAgICBzd2l0Y2goT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGRhdGEpKSB7XG4gICAgICBjYXNlIFwiW29iamVjdCBGbG9hdDY0QXJyYXldXCI6XG4gICAgICAgIHJldHVybiBcImZsb2F0NjRcIlxuICAgICAgY2FzZSBcIltvYmplY3QgRmxvYXQzMkFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJmbG9hdDMyXCJcbiAgICAgIGNhc2UgXCJbb2JqZWN0IEludDhBcnJheV1cIjpcbiAgICAgICAgcmV0dXJuIFwiaW50OFwiXG4gICAgICBjYXNlIFwiW29iamVjdCBJbnQxNkFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJpbnQxNlwiXG4gICAgICBjYXNlIFwiW29iamVjdCBJbnQzMkFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJpbnQzMlwiXG4gICAgICBjYXNlIFwiW29iamVjdCBVaW50OEFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJ1aW50OFwiXG4gICAgICBjYXNlIFwiW29iamVjdCBVaW50MTZBcnJheV1cIjpcbiAgICAgICAgcmV0dXJuIFwidWludDE2XCJcbiAgICAgIGNhc2UgXCJbb2JqZWN0IFVpbnQzMkFycmF5XVwiOlxuICAgICAgICByZXR1cm4gXCJ1aW50MzJcIlxuICAgICAgY2FzZSBcIltvYmplY3QgVWludDhDbGFtcGVkQXJyYXldXCI6XG4gICAgICAgIHJldHVybiBcInVpbnQ4X2NsYW1wZWRcIlxuICAgIH1cbiAgfVxuICBpZihBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgcmV0dXJuIFwiYXJyYXlcIlxuICB9XG4gIHJldHVybiBcImdlbmVyaWNcIlxufVxuXG52YXIgQ0FDSEVEX0NPTlNUUlVDVE9SUyA9IHtcbiAgXCJmbG9hdDMyXCI6W10sXG4gIFwiZmxvYXQ2NFwiOltdLFxuICBcImludDhcIjpbXSxcbiAgXCJpbnQxNlwiOltdLFxuICBcImludDMyXCI6W10sXG4gIFwidWludDhcIjpbXSxcbiAgXCJ1aW50MTZcIjpbXSxcbiAgXCJ1aW50MzJcIjpbXSxcbiAgXCJhcnJheVwiOltdLFxuICBcInVpbnQ4X2NsYW1wZWRcIjpbXSxcbiAgXCJidWZmZXJcIjpbXSxcbiAgXCJnZW5lcmljXCI6W11cbn1cblxuOyhmdW5jdGlvbigpIHtcbiAgZm9yKHZhciBpZCBpbiBDQUNIRURfQ09OU1RSVUNUT1JTKSB7XG4gICAgQ0FDSEVEX0NPTlNUUlVDVE9SU1tpZF0ucHVzaChjb21waWxlQ29uc3RydWN0b3IoaWQsIC0xKSlcbiAgfVxufSk7XG5cbmZ1bmN0aW9uIHdyYXBwZWROREFycmF5Q3RvcihkYXRhLCBzaGFwZSwgc3RyaWRlLCBvZmZzZXQpIHtcbiAgaWYoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdmFyIGN0b3IgPSBDQUNIRURfQ09OU1RSVUNUT1JTLmFycmF5WzBdXG4gICAgcmV0dXJuIGN0b3IoW10pXG4gIH0gZWxzZSBpZih0eXBlb2YgZGF0YSA9PT0gXCJudW1iZXJcIikge1xuICAgIGRhdGEgPSBbZGF0YV1cbiAgfVxuICBpZihzaGFwZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgc2hhcGUgPSBbIGRhdGEubGVuZ3RoIF1cbiAgfVxuICB2YXIgZCA9IHNoYXBlLmxlbmd0aFxuICBpZihzdHJpZGUgPT09IHVuZGVmaW5lZCkge1xuICAgIHN0cmlkZSA9IG5ldyBBcnJheShkKVxuICAgIGZvcih2YXIgaT1kLTEsIHN6PTE7IGk+PTA7IC0taSkge1xuICAgICAgc3RyaWRlW2ldID0gc3pcbiAgICAgIHN6ICo9IHNoYXBlW2ldXG4gICAgfVxuICB9XG4gIGlmKG9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgb2Zmc2V0ID0gMFxuICAgIGZvcih2YXIgaT0wOyBpPGQ7ICsraSkge1xuICAgICAgaWYoc3RyaWRlW2ldIDwgMCkge1xuICAgICAgICBvZmZzZXQgLT0gKHNoYXBlW2ldLTEpKnN0cmlkZVtpXVxuICAgICAgfVxuICAgIH1cbiAgfVxuICB2YXIgZHR5cGUgPSBhcnJheURUeXBlKGRhdGEpXG4gIHZhciBjdG9yX2xpc3QgPSBDQUNIRURfQ09OU1RSVUNUT1JTW2R0eXBlXVxuICB3aGlsZShjdG9yX2xpc3QubGVuZ3RoIDw9IGQrMSkge1xuICAgIGN0b3JfbGlzdC5wdXNoKGNvbXBpbGVDb25zdHJ1Y3RvcihkdHlwZSwgY3Rvcl9saXN0Lmxlbmd0aC0xKSlcbiAgfVxuICB2YXIgY3RvciA9IGN0b3JfbGlzdFtkKzFdXG4gIHJldHVybiBjdG9yKGRhdGEsIHNoYXBlLCBzdHJpZGUsIG9mZnNldClcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB3cmFwcGVkTkRBcnJheUN0b3JcbiIsIlwidXNlIHN0cmljdFwiXG5cbmZ1bmN0aW9uIGlvdGEobikge1xuICB2YXIgcmVzdWx0ID0gbmV3IEFycmF5KG4pXG4gIGZvcih2YXIgaT0wOyBpPG47ICsraSkge1xuICAgIHJlc3VsdFtpXSA9IGlcbiAgfVxuICByZXR1cm4gcmVzdWx0XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW90YSIsIi8qKlxuICogRGV0ZXJtaW5lIGlmIGFuIG9iamVjdCBpcyBCdWZmZXJcbiAqXG4gKiBBdXRob3I6ICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIExpY2Vuc2U6ICBNSVRcbiAqXG4gKiBgbnBtIGluc3RhbGwgaXMtYnVmZmVyYFxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaikge1xuICByZXR1cm4gISEob2JqICE9IG51bGwgJiZcbiAgICAob2JqLl9pc0J1ZmZlciB8fCAvLyBGb3IgU2FmYXJpIDUtNyAobWlzc2luZyBPYmplY3QucHJvdG90eXBlLmNvbnN0cnVjdG9yKVxuICAgICAgKG9iai5jb25zdHJ1Y3RvciAmJlxuICAgICAgdHlwZW9mIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlciA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyKG9iaikpXG4gICAgKSlcbn1cbiIsInZveGVsID0gcmVxdWlyZSgndm94ZWwnKTtcblxudmFyIGdlbmVyYXRlZFZveGVsID0gdm94ZWwuZ2VuZXJhdGUoWzAsMCwwXSwgWzE2LDE2LDE2XSwgdm94ZWwuZ2VuZXJhdG9yWydTcGhlcmUnXSk7XG5jb25zb2xlLmxvZyhcImdlbmVyYXRlZFZveGVsXCIpO1xuY29uc29sZS5sb2coZ2VuZXJhdGVkVm94ZWwpO1xuICAgICAgICAgICAgXG52YXIgZ2VuZXJhdGVkTWVzaCA9IHZveGVsLm1lc2hlcnMuZ3JlZWR5KGdlbmVyYXRlZFZveGVsLmRhdGEsIGdlbmVyYXRlZFZveGVsLnNoYXBlKTtcbmNvbnNvbGUubG9nKFwiZ2VuZXJhdGVkTWVzaFwiKTtcbmNvbnNvbGUubG9nKGdlbmVyYXRlZE1lc2gpO1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0aGlzLl9ldmVudHMpIHtcbiAgICB2YXIgZXZsaXN0ZW5lciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKVxuICAgICAgcmV0dXJuIDE7XG4gICAgZWxzZSBpZiAoZXZsaXN0ZW5lcilcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aDtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpO1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIl19
