pc.script.attribute('radius', 'number', 3, {
    displayName: "Radius"
});

pc.script.attribute('lifetime', 'number', 3, {
    displayName: "Lifetime"
});

pc.script.create('buildBullet', function (app) {
    // Creates a new DeleteAfter5sec instance
    var BuildBullet = function (entity) {
        this.entity = entity;
    };

    BuildBullet.prototype = {
        // Called once after all resources are loaded and before the first update
        initialize: function () {
            this.fromGenerated = 0;
        },
        
        // Called every frame, dt is time in seconds since last update
        update: function (dt) {
            this.fromGenerated += dt;
            if (this.fromGenerated > this.lifetime) {
                this.entity.destroy();
            }
        }
    };

    return BuildBullet;
});