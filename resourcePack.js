/*jshint multistr: true */
pc.script.attribute('textureChipNum', 'number', 1, {
    max: 32,
    min: 1
});

pc.script.create('mineCraftResourece', function (app) {
    // Creates a new MineCraftResourece instance
    var MineCraftResourece = function (entity) {
    };

    MineCraftResourece.prototype = {
        // Called once after all resources are loaded and before the first update
        initialize: function () {
			var self = this;
			self.$canvas = $('<canvas width=4096 height=4096>');
			self.context2D = this.$canvas.get(0).getContext("2d");
			self.context2D.fillStyle = "rgb(255, 255, 255)";
			self.context2D.fillRect(0, 0, this.$canvas.width(), this.$canvas.height());
    		$('body').append(self.$canvas);
    		
    		self.$img = [];
    		self.$img[0] = $('<img src="files/resourcePack/John Smith Legacy 1.8.9 v1.3.26/assets/minecraft/textures/blocks/stone.png">');
    		self.$img[1] = $('<img src="files/resourcePack/John Smith Legacy 1.8.9 v1.3.26/assets/minecraft/textures/blocks/grass_side.png">');
    		self.$img[2] = $('<img src="files/resourcePack/John Smith Legacy 1.8.9 v1.3.26/assets/minecraft/textures/blocks/dirt.png">');
    		self.$img[3] = $('<img src="files/resourcePack/John Smith Legacy 1.8.9 v1.3.26/assets/minecraft/textures/blocks/cobblestone.png">');
    		self.$img[0].ready(function () {
				self.context2D.drawImage(self.$img[0].get(0), 32, 0);    			
				console.log("ResourcePack");
    		});
    		self.$img[1].ready(function () {
				self.context2D.drawImage(self.$img[1].get(0), 32 * 2, 0);    			
				console.log("ResourcePack");
    		});
    		self.$img[2].ready(function () {
				self.context2D.drawImage(self.$img[2].get(0), 32 * 3, 0);    			
				console.log("ResourcePack");
    		});
    		self.$img[3].ready(function () {
				self.context2D.drawImage(self.$img[3].get(0), 32 * 4, 0);    			
				console.log("ResourcePack");
    		});
    		
		},
    };

    return MineCraftResourece;
});