pc.script.create('resetPosition', function (app) {
    // Creates a new ResetPosition instance
    var ResetPosition = function (entity) {
        this.entity = entity;
    };

    ResetPosition.prototype = {
        // Called once after all resources are loaded and before the first update
        initialize: function () {
            // Save initial location
            this.originalPos = this.entity.getPosition().clone();
            this.originalAngle = this.entity.getEulerAngles().clone();
        },

        // Called every frame, dt is time in seconds since last update
        update: function (dt) {
            // Reset location
            if (app.keyboard.isPressed(pc.KEY_0)) {
                this.entity.rigidbody.teleport(this.originalPos, this.originalAngle);
                this.entity.rigidbody.entity.linearVelocity = pc.Vec3(0, 0, 0);
                return;
            }
        }
    };

    return ResetPosition;
});