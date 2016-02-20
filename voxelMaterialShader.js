/*jshint multistr: true */
pc.script.attribute('textureChipNum', 'number', 1, {
    max: 32,
    min: 1
});

pc.script.attribute('material', 'asset', [], {
    displayName: "Target material",
    max: 1,
    type: 'material'
});

var basePSExt = '\
#extension GL_EXT_shader_texture_lod : enable\n\
#extension GL_OES_standard_derivatives : enable\n';

var emissiveTexPS = '\
vec3 getEmission(inout psInternalData data) {\n\
    return vec3(0.0, 0.0, 0.0);\n\
}\n';

var diffuseVertPS = '\
uniform float uTextureChipNum;\n\
uniform sampler2D texture_emissiveMap;\n\
void getAlbedo(inout psInternalData data) {\n\
    float voxelID = vVertexColor.a * 255.0;\n\
    float voxelX = floor(voxelID / uTextureChipNum + 0.5);\n\
    float voxelY = floor(mod(voxelID, uTextureChipNum) + 0.5);\n\
    float textureChipSize = 1.0 / uTextureChipNum;\n\
    float u = fract(vUv0.x) * textureChipSize + textureChipSize * voxelX;\n\
    float v = fract(vUv0.y) * textureChipSize + textureChipSize * voxelY;\n\
    //data.albedo = texture2DGradEXT(texture_emissiveMap, mod(vUv0, vec2(textureChipSize, textureChipSize)), dFdx(vUv0), dFdy(vUv0));\n\
    data.albedo = texture2DSRGB(texture_emissiveMap, vec2(u, v)).$CH;\n\
}\n';

pc.script.create('voxelMaterialShader', function (app) {
    // Creates a new VoxelMaterialShader instance
    var VoxelMaterialShader = function (entity) {
        this.entity = entity;
    };

    VoxelMaterialShader.prototype = {
        // Called once after all resources are loaded and before the first update
        initialize: function () {
            // Initialize plasma shader chunk
            var material = app.assets.get(this.material).resource;
            //material.chunks.basePS = basePSExt + material.chunks.basePS;
            material.chunks.emissiveTexPS = emissiveTexPS;
            material.chunks.diffuseVertPS = diffuseVertPS;
            material.setParameter('uTextureChipNum', this.textureChipNum);
            material.update();
            this.time = 0;
        },

        // Called every frame, dt is time in seconds since last update
        update: function (dt) {
            this.time += dt;
            var material = app.assets.get(this.material).resource;
            material.setParameter('uTextureChipNum', this.textureChipNum);
        }
    };

    return VoxelMaterialShader;
});