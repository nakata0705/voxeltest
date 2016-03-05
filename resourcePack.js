// ResourcePackクラス定義
function ResourcePack() {
	this.textureChipSize = 32;
	this.canvasSize = 512;
	this.textureChipNum = this.canvasSize / this.textureChipSize;
	
	this.resourceJson = undefined;
	
	// Canvasを作成する
	this.$canvas = $('<canvas class="texture" width=' + this.canvasSize + ' height=' + this.canvasSize + '>');
	this.$canvas.css({ "position": "absolute", "top": 128, "left": 0, "z-index": 100 });
	this.context2D = this.$canvas.get(0).getContext("2d");
	
	// Canvasをテクスチャを正常に参照できているかを確認するグラデーションで塗りつぶす
	var gradation = this.context2D.createLinearGradient(0, 0, 511, 256);
	gradation.addColorStop(0,"blue");
	gradation.addColorStop(0.5,"red");
	gradation.addColorStop(1,"green");
	this.context2D.fillStyle = gradation;
	this.context2D.fillRect(0, 0, 511, 511);
	
	// CanvasをHTML本体に追加
	$('body').append(this.$canvas);
	
	// PlayCanvasのテクスチャをCanvasから生成
	var app = pc.Application.getApplication();
   	this.playCanvasTexture = new pc.Texture(app.graphicsDevice, {
        format: pc.PIXELFORMAT_R8_G8_B8,
        autoMipmap: false
    });
    
    this.playCanvasTexture.minFilter = pc.FILTER_NEAREST;
    this.playCanvasTexture.magFilter = pc.FILTER_NEAREST;
    this.playCanvasTexture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
    this.playCanvasTexture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
	
	this.loading = 1;
	this.resourcePath = "./files/resourcePack/voxelTest/";
	$.getJSON(this.resourcePath + "blocks.json" , this.loadTextures.bind(this));	
};
    
ResourcePack.prototype = {
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
        			var app = pc.Application.getApplication();
					var material = app.assets.find("Non-Transparent", "material").resource;
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
	}
};

var resourcePack = new ResourcePack();