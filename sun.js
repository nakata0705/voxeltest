pc.script.attribute('sunDistance', 'number', 256);
pc.script.attribute('dayInSec', 'number', 10);
pc.script.attribute('maxSkyboxIntensity', 'number', 4);
pc.script.attribute('minSkyboxIntensity', 'number', 0.1);

pc.script.create('sun', function (app) {
    // Creates a new Sun instance
    var Sun = function (entity) {
        this.entity = entity;
        this.time = 0;
    };

    Sun.prototype = {
        // Called once after all resources are loaded and before the first update
        initialize: function () {
        	this.distanceVec = new pc.Vec3(this.sunDistance, 0, 0);
        	this.light = this.entity.findByName("Light").light;
        },

        // Called every frame, dt is time in seconds since last update
        update: function (dt) {
        	this.time += dt;
        	
        	var quat = new pc.Quat();
        	quat.setFromEulerAngles(0, 0, -360 * this.time / this.dayInSec);        	
        	var position = new pc.Vec3(this.sunDistance, 0, 0);
        	position = quat.transformVector(position);
        	quat.setFromEulerAngles(30, 0, 0);        	
        	position = quat.transformVector(position);
        	this.entity.setPosition(position);
        	
        	if (position.y < 0) {
        		this.light.enabled = false;
				app.scene.skyboxIntensity = this.minSkyboxIntensity;
        	}
        	else {
        		this.light.enabled = true;
				app.scene.skyboxIntensity = (this.maxSkyboxIntensity - this.minSkyboxIntensity) * position.y / this.sunDistance * Math.sqrt(3) / 2 + this.minSkyboxIntensity;
        	}
        	this.entity.lookAt(0, 0, 0);
        }
    };

    return Sun;
});