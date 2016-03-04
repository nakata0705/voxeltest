/*jshint multistr: true */
pc.script.attribute('textureChipSize', 'number', 32, {
    max: 32,
    min: 1
});

pc.script.attribute('material', 'asset', [], {
    displayName: "opaqueMaterial",
    max: 1,
    type: 'material'
});

pc.script.attribute('transparentMaterial', 'asset', [], {
    displayName: "transparentMaterial",
    max: 1,
    type: 'material'
});

pc.script.create('resourcePack', function (app) {
    // Creates a new MineCraftResourece instance
    var ResourcePack = function (entity) {
    	this.entity = entity;
    };
    
    ResourcePack.prototype = {
        // Called once after all resources are loaded and before the first update
        initialize: function () {
			var self = this;
			
			self.textureChipSize = 32;
			self.canvasSize = 512;
			self.textureChipNum = self.canvasSize / self.textureChipSize;
			
			self.resourceJson = undefined;
			
			self.$canvas = $('<canvas class="texture" width=' + self.canvasSize + ' height=' + self.canvasSize + '>');
			self.$canvas.css({ "position": "absolute", "top": 128, "left": 0, "z-index": 100 });
			self.context2D = self.$canvas.get(0).getContext("2d");
			var gradation = self.context2D.createLinearGradient(0, 0, 511, 256);
			gradation.addColorStop(0,"blue");
			gradation.addColorStop(0.5,"red");
			gradation.addColorStop(1,"green");
			self.context2D.fillStyle = gradation;
			self.context2D.fillRect(0, 0, 511, 511);
    		$('body').append(self.$canvas);
    		
           	self.playCanvasTexture = new pc.Texture(app.graphicsDevice, {
                format: pc.PIXELFORMAT_R8_G8_B8,
                autoMipmap: false
            });
            
            self.playCanvasTexture.minFilter = pc.FILTER_NEAREST;
            self.playCanvasTexture.magFilter = pc.FILTER_NEAREST;
            self.playCanvasTexture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
            self.playCanvasTexture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
    		
    		self.loading = 1;
			self.resourcePath = "./files/resourcePack/voxelTest/";
			$.getJSON(self.resourcePath + "blocks.json" , self.loadTextures.bind(self));			
		},
		
		// ロード中のファイル数を返す
		isLoading: function() {
			return this.loading;
		},
		
		loadTexture: function(textureName, textureIndex, resourceObj, type) {
			var self = this;
			var textureFilePath = self.resourcePath + "textures/" + textureName + ".png";
			self.loading++;
			
			$("<img src='" + textureFilePath + "'>").one("load", { textureIndex: textureIndex, resourceObj: resourceObj, type: type },
				function(event) {
					var x = textureIndex % self.textureChipNum;
					var y = Math.floor(textureIndex / self.textureChipNum);
					self.context2D.drawImage(this, x * self.textureChipSize, y * self.textureChipSize);					
					event.data.resourceObj[event.data.type] = textureIndex;
					self.loading--;
					
					if (self.loading === 0) {
            			self.playCanvasTexture.setSource(self.$canvas.get(0));
            			self.playCanvasTexture.upload();
            			var source = self.playCanvasTexture.getSource();
            			console.log("height = " + self.playCanvasTexture.height);
						var material = app.assets.get(self.material).resource;
    					material.emissiveMap = self.playCanvasTexture;
                		material.update();
					}
				});	
		},
		
		loadTextures: function(data) {
			var self = this;
			var len = data.length;
			var textureIndex = 1;
			
			var x, y;
			
			self.resourceJson = data;
			
			for (var i = 0; i < len; i++) {				
				if (data[i].all) {
					this.loadTexture(data[i].all, textureIndex, self.resourceJson[i], "all");
					textureIndex++;
				}
				if (data[i].top) {
					this.loadTexture(data[i].top, textureIndex, self.resourceJson[i], "top");
					textureIndex++;
				}
				if (data[i].bottom) {
					this.loadTexture(data[i].bottom, textureIndex, self.resourceJson[i], "bottom");
					textureIndex++;
				}
				if (data[i].side) {
					this.loadTexture(data[i].side, textureIndex, self.resourceJson[i], "side");
					textureIndex++;
				}
			}
    		// ここで引き算することで0になるはず
			self.loading--;			
		},
		
		getTextureId: function(voxelID, face) {
			if (this.loading !== 0) {
				// ロード中なので-1を返す
				return -1;
			}
			if (this.resourceJson[voxelID] === undefined) {
				// voxelIDに相当するデータがないので-1を返す
				return -1;
			}
			
			if (this.resourceJson[voxelId][face]) {
				return this.resourceJson[voxelId][face];
			}
			
			switch(face) {
				case "left":
				case "right":
				case "front":
				case "back":
					if (this.resourcenJson[voxelId]["side"]) {
						return this.resourceJson[voxelId]["side"]
					}
					break;				
			}
			
			if (this.resourceJson[voxelId]["all"]) {
				return this.resourceJson[voxelId]["all"];
			}
			return -1;
		},
		
        // Called every frame, dt is time in seconds since last update
		update: function(dt) {
		}
    };

    return ResourcePack;
});