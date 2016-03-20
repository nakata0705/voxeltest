// ResourcePackクラス定義
function ResourcePack() {
	this.textureChipSize = 32;
	this.canvasSize = 512;
	this.textureChipNum = this.canvasSize / this.textureChipSize;
	
	this.resourceJson = undefined;
	
	this.faceReferenceArray = [ ["front", "back"], ["left", "right"], ["bottom", "top"] ];
	
	// Canvasを作成する
	this.$canvas = $('<canvas class="texture" width=' + this.canvasSize + ' height=' + this.canvasSize + '>');
	this.$canvas.css({ "position": "absolute", "top": -65536, "left": -65536 });
	this.context2D = this.$canvas.get(0).getContext("2d");
	
	// Canvasをテクスチャを正常に参照できているかを確認するグラデーションで塗りつぶす
	var gradation = this.context2D.createLinearGradient(0, 0, 511, 256);
	gradation.addColorStop(0,"blue");
	gradation.addColorStop(0.5,"red");
	gradation.addColorStop(1,"green");
	this.context2D.fillStyle = gradation;
	this.context2D.fillRect(0, 0, 513, 513);
	
	// CanvasをHTML本体に追加
	$('body').append(this.$canvas);
	
	// PlayCanvasのテクスチャをCanvasから生成
	var app = pc.Application.getApplication();
   	this.playCanvasTexture = new pc.Texture(app.graphicsDevice, {
        format: pc.PIXELFORMAT_R8_G8_B8,
        autoMipmap: false
    });
    
    this.playCanvasTexture.minFilter = pc.FILTER_LINEAR;
    this.playCanvasTexture.magFilter = pc.FILTER_LINEAR;
    this.playCanvasTexture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
    this.playCanvasTexture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
	
	this.isLoaded = false;
	this.allImgLoading = false;
	this.imgLoading = 0;
	this.resourcePath = "./files/resourcePack/voxelTest/";
	
	// プリロード済みのJSONをセットし、テクスチャをロード
	this.resourceJson = app.assets.find("blocks.json").resource;
    this.loadTextures();
};
    
ResourcePack.prototype = {
	loadTextures: function() {
		var x, y;
		
		// テクスチャをロードする
		for (var name in this.resourceJson.textures) {
			if (name === "void") continue;
			var textureIndex = this.resourceJson.textures[name];
			this.loadTexture(name, textureIndex);
		}
		this.allImgLoading = true;
	},
	
	loadTexture: function(textureName, textureIndex) {
		var self = this;
		var textureFilePath = self.resourcePath + "textures/" + textureName + ".png";
		
		this.imgLoading++;
		
		$("<img src='" + textureFilePath + "'>").one("load", { textureIndex: textureIndex },
			function(event) {
				var textureIndex = event.data.textureIndex;
				var x = textureIndex % self.textureChipNum;
				var y = Math.floor(textureIndex / self.textureChipNum);
				self.context2D.drawImage(this, x * self.textureChipSize, y * self.textureChipSize);					
				self.imgLoading--;
				
				if (self.imgLoading === 0 && self.allImgLoading === true) {
        			self.playCanvasTexture.setSource(self.$canvas.get(0));
        			self.playCanvasTexture.upload();
        			var source = self.playCanvasTexture.getSource();
        			var app = pc.Application.getApplication();
					var material = app.assets.find("Non-Transparent", "material").resource;
					material.emissiveMap = self.playCanvasTexture;
            		material.update();
            		this.isLoaded = true;
            		if (self.callback) self.callback();
				}
			});	
	},
		
	getTextureId: function(voxelId, face) {
		var textureName, textureId;
		var targetFace = face;
		
		if (this.resourceJson.blocks[voxelId] === undefined) {
			// voxelIDに相当するデータがないので255を返す
			return 128;
		}
		
		// 指定のVoxelIdの面の名前(あるいはTextureId)を取得
		if (this.resourceJson.blocks[voxelId][targetFace]) {
			textureName = this.resourceJson.blocks[voxelId][targetFace];
		}
		else {
			switch(face) {
				case "left":
				case "right":
				case "front":
				case "back":
					if (this.resourceJson.blocks[voxelId]["side"]) {
						targetFace = "side";
					}
					break;				
			}
				
			if (this.resourceJson.blocks[voxelId]["all"]) {
				targetFace = "all";
			}
			textureName = this.resourceJson.blocks[voxelId][targetFace];
		}
		
		if (!textureName) return 128;
		
		if (typeof textureName === "string") {
			// テクスチャ名を取得したのでテクスチャIDに変換
			var textureId = this.resourceJson.textures[textureName];
			this.resourceJson.blocks[voxelId][targetFace] = textureId;
		}
		
		return this.resourceJson.blocks[voxelId][targetFace];		
	},
	
	getFace: function(u, clockwise) {
		if (clockwise === true) clockwise = 0;
		else clockwise = 1;
		return this.faceReferenceArray[u][clockwise];
	}
};

// グローバルなクラスインスタンス
var resourcePack = new ResourcePack();
