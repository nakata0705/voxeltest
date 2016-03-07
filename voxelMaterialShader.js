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

var extensionPS = '\
#extension GL_EXT_shader_texture_lod : enable\n\
#extension GL_OES_standard_derivatives : enable\n';

var emissiveTexPS = '\
vec3 getEmission(inout psInternalData data) {\n\
    return vec3(0.0, 0.0, 0.0);\n\
}\n';

var diffuseVertPSExt = '\
uniform float uTextureChipNum;\n\
uniform sampler2D texture_emissiveMap;\n\
void getAlbedo(inout psInternalData data) {\n\
    float textureID = floor(vVertexColor.a * 256.0);\n\
    float offsetU = floor(mod(textureID, uTextureChipNum)) / uTextureChipNum;\n\
    float offsetV = floor(textureID / uTextureChipNum) / uTextureChipNum;\n\
    float textureChipSize = 1.0 / uTextureChipNum;\n\
    float u = fract(vUv0.x) * textureChipSize + offsetU;\n\
    float v = 1.0 - ((1.0 - fract(vUv0.y)) * textureChipSize + offsetV);\n\
    vec2 wrappedUv = vec2(min(u, 1.0), min(v, 1.0));\n\
    data.albedo = texture2DGradEXT(texture_emissiveMap, wrappedUv, dFdx(vUv0), dFdy(vUv0)).rgb;\n\
}\n';

var diffuseVertPSNoExt = '\
uniform float uTextureChipNum;\n\
uniform sampler2D texture_emissiveMap;\n\
void getAlbedo(inout psInternalData data) {\n\
    float voxelID = floor(vVertexColor.a * 256.0);\n\
    float voxelX = floor(voxelID / uTextureChipNum) / uTextureChipNum;\n\
    float voxelY = floor(mod(voxelID, uTextureChipNum)) / uTextureChipNum;\n\
    float textureChipSize = 1.0 / uTextureChipNum;\n\
    vec2 wrappedUv = vec2(fract(vUv0.x) * textureChipSize + voxelX, 1.0 - ((1.0 - fract(vUv0.y)) * textureChipSize + voxelY));\n\
    data.albedo = texture2DSRGB(texture_emissiveMap, wrappedUv).$CH;\n\
}\n';

var fogLinearPS = '\
uniform vec3 fog_color;\n\
uniform float fog_start;\n\
uniform float fog_end;\n\
vec3 addFog(inout psInternalData data, vec3 color) {\n\
    float depth = gl_FragCoord.z / gl_FragCoord.w;\n\
    float fogFactor = (fog_end - depth) / (fog_end - fog_start);\n\
    fogFactor = clamp(fogFactor, 0.0, 1.0);\n\
    fogFactor = gammaCorrectInput(fogFactor);\n\
    vec3 fog_color_with_light = data.diffuseLight;\n\
    fog_color_with_light.r = clamp(fog_color_with_light.r, 0.0, 1.0);\n\
    fog_color_with_light.g = clamp(fog_color_with_light.g, 0.0, 1.0);\n\
    fog_color_with_light.b = clamp(fog_color_with_light.b, 0.0, 1.0);\n\
    fog_color_with_light = fog_color * fog_color_with_light;\n\
    return mix(fog_color_with_light, color, fogFactor);\n\
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
            if (app.graphicsDevice.extTextureLod) {
            	material.chunks.extensionPS = extensionPS;
            	material.chunks.diffuseVertPS = diffuseVertPSExt;
            }
            else {
            	material.chunks.diffuseVertPS = diffuseVertPSNoExt;
          	}
            material.chunks.emissiveTexPS = emissiveTexPS;
            material.chunks.fogLinearPS = fogLinearPS;
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