pc.script.attribute('copyTarget', 'entity', null);
pc.script.attribute('interval', 'number', 1);
pc.script.attribute('impulse', 'number', 5);

pc.script.create('duplicateOneself', function (app) {
    // Creates a new DuplicateOneself instance
    var DuplicateOneself = function (entity) {
        this.entity = entity;
    };

    DuplicateOneself.prototype = {
        // Called once after all resources are loaded and before the first update
        initialize: function () {
            this.fromLastUpdate = 1.0;
            this.mouseDown = false;
        },
        
        // Called every frame, dt is time in seconds since last update
        update: function (dt) {
            this.fromLastUpdate += dt;            
            // If the left mouse button is pressed, change the cube color to red
            if (this.fromLastUpdate >= this.interval) {
                var newEntity = this.copyTarget.clone();
                pos = this.entity.getPosition();
                newEntity.setPosition(pos);
                newEntity.rigidbody.syncEntityToBody();
                newEntity.rigidbody.applyImpulse(new pc.Vec3(Math.random(), Math.random(), Math.random()).scale(this.impulse));
                newEntity.enabled = true;
                this.entity.addChild(newEntity);
                this.fromLastUpdate = 0;
                
                if (newEntity.script.buildBullet) {
                    if (app.mouse.isPressed(pc.MOUSEBUTTON_RIGHT) === true) {
                        newEntity.script.buildBullet.eraseFlag = true;
                    }
                }
            }
        }
    };

    return DuplicateOneself;
});