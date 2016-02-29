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
			self.$canvas = $('<canvas class="texture" width=512 height=512>');
			self.$canvas.css({ "position": "absolute", "top": 128, "left": 0, "z-index": 100 });
			self.context2D = this.$canvas.get(0).getContext("2d");
    		$('body').append(self.$canvas);
    		
    		self.$img = [];
    		$("<img src='files/resourcePack/John Smith Legacy 1.8.9 v1.3.26/assets/minecraft/textures/blocks/stone.png'>").one("load", function() {
					self.context2D.drawImage(this, 32, 0);    			
					console.log("ResourcePack");
    			}).each(function() {
    				if(this.complete) $(this).load();
    			});
    		$("<img src='files/resourcePack/John Smith Legacy 1.8.9 v1.3.26/assets/minecraft/textures/blocks/grass_side.png'>").one("load", function() {
					self.context2D.drawImage(this, 64, 0);    			
					console.log("ResourcePack");
    			}).each(function() {
    				if(this.complete) $(this).load();
    			});
    		$("<img src='files/resourcePack/John Smith Legacy 1.8.9 v1.3.26/assets/minecraft/textures/blocks/dirt.png'>").one("load", function() {
					self.context2D.drawImage(this, 96, 0);    			
					console.log("ResourcePack");
    			}).each(function() {
    				if(this.complete) $(this).load();
    			});
    		$("<img src='files/resourcePack/John Smith Legacy 1.8.9 v1.3.26/assets/minecraft/textures/blocks/cobblestone.png'>").one("load", function() {
					self.context2D.drawImage(this, 128, 0);    			
					console.log("ResourcePack");
    			}).each(function() {
    				if(this.complete) $(this).load();
    			});
		},
    };

    return MineCraftResourece;
});