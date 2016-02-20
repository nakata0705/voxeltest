pc.script.attribute('position', 'curve', null, {
    curves: ['forward', 'up']
});

pc.script.attribute('stepInterval', 'number', 1);

pc.script.create('rainWalk', function (app) {
    // Creates a new RainWalk instance
    var RainWalk = function (entity) {
        this.entity = entity;
    };

    RainWalk.prototype = {
        // Called once after all resources are loaded and before the first update
        initialize: function () {
            this.currentTime = 0;
        },

        // Called every frame, dt is time in seconds since last update
        update: function (dt) {
            this.currentTime += dt;
            var scale = this.entity.getLocalScale().x;
            var currentCurveTime = this.currentTime % this.stepInterval / this.stepInterval;
            var value = this.position.value(currentCurveTime);
            
            var pos = this.entity.getPosition();
            pos.z += value[0];
            pos.y = value[1];
            this.entity.setPosition(pos);
        }
    };

    return RainWalk;
});
