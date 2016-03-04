/*jshint multistr: true */
pc.script.attribute('textureChipSize', 'number', 32, {
    max: 32,
    min: 1
});

pc.script.attribute('material', 'asset', [], {
    displayName: "Material",
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
			self.textureUvDictionary = {};
			
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
		
		loadTexture: function(textureName, x, y, resourceObj, type) {
			var self = this;
			var textureFilePath = self.resourcePath + "textures/" + textureName + ".png";
			self.loading++;
			
			$("<img src='" + textureFilePath + "'>").one("load", { x: x, y: y, resourceObj: resourceObj, type: type },
				function(event) {
					self.context2D.drawImage(this, event.data.x * self.textureChipSize, event.data.y * self.textureChipSize);
					
					event.data.resourceObj[event.data.type] = self.textureUvDictionary[textureName];
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
			var textureIndex = 0;
			
			var x, y;
			
			self.resourceJson = data;
			
			for (var i = 0; i < len; i++) {				
				if (data[i].all) {
					x = textureIndex % this.textureChipNum;
					y = Math.floor(textureIndex / this.textureChipNum);
					this.textureUvDictionary[data[i].all] = [x * self.textureChipSize / self.canvasSize, y * self.textureChipSize / self.canvasSize, (x + 1) * self.textureChipSize / self.canvasSize, (y + 1) * self.textureChipSize / self.canvasSize];
					this.loadTexture(data[i].all, x, y, data[i], "all");
					textureIndex++;
				}
				if (data[i].top) {
					x = textureIndex % this.textureChipNum;
					y = Math.floor(textureIndex / this.textureChipNum);
					this.textureUvDictionary[data[i].top] = [x * self.textureChipSize / self.canvasSize, y * self.textureChipSize / self.canvasSize, (x + 1) * self.textureChipSize / self.canvasSize, (y + 1) * self.textureChipSize / self.canvasSize];
					this.loadTexture(data[i].top, x, y, data[i], "top");
					textureIndex++;
				}
				if (data[i].bottom) {
					x = textureIndex % this.textureChipNum;
					y = Math.floor(textureIndex / this.textureChipNum);
					this.textureUvDictionary[data[i].bottom] = [x * self.textureChipSize / self.canvasSize, y * self.textureChipSize / self.canvasSize, (x + 1) * self.textureChipSize / self.canvasSize, (y + 1) * self.textureChipSize / self.canvasSize];
					this.loadTexture(data[i].bottom, x, y, data[i], "bottom");
					textureIndex++;
				}
				if (data[i].side) {
					x = textureIndex % this.textureChipNum;
					y = Math.floor(textureIndex / this.textureChipNum);
					this.textureUvDictionary[data[i].side] = [x * self.textureChipSize / self.canvasSize, y * self.textureChipSize / self.canvasSize, (x + 1) * self.textureChipSize / self.canvasSize, (y + 1) * self.textureChipSize / self.canvasSize];
					this.loadTexture(data[i].side, x, y, data[i], "side");
					textureIndex++;
				}
			}
    		// ここで引き算することで0になるはず
			self.loading--;			
		},
		
        // Called every frame, dt is time in seconds since last update
		update: function(dt) {
		}
    };

    return ResourcePack;
});