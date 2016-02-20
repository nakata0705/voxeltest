pc.script.attribute("camera", "entity", null); // optional, assign a camera entity, otherwise one is created
pc.script.attribute("moveForce", "number", 1);
pc.script.attribute("jumpForce", "number", 1);
pc.script.attribute("lookSpeed", "number", 0.5);
pc.script.attribute("groundCheckRayLength", "number", 0.2);
pc.script.attribute("allowFly", "boolean", true);
pc.script.attribute("kinematicMoveMaxSpeed", "number", 12);
pc.script.attribute("kinematicMoveGroundDamping", "number", 0.5);
pc.script.attribute("flyingSpeedScale", "number", 2);

pc.script.create('firstPersonMovement', function (app) {
    var forceVector = new pc.Vec3();
    var velocityVector = new pc.Vec3();
    var rayEndVector = new pc.Vec3();
    var jumpVector = new pc.Vec3();
    var antiGravityVector = new pc.Vec3(0, 98, 0);
    
    // Creates a new First_person-movement instance
    var FirstPersonMovement = function (entity) {
        this.entity = entity;        
        this.camera = null;
    };

    FirstPersonMovement.prototype = {
        // Called once after all resources are loaded and before the first update
        initialize: function () {
            // Listen for mouse move events
            app.mouse.on("mousemove", this.onMouseMove, this);
            
            // Check for required components
            if (!this.entity.collision) {
                console.error("First Person Movement script needs to have a 'collision' component");
            }
            
            if (!this.entity.rigidbody || this.entity.rigidbody.type !== pc.BODYTYPE_DYNAMIC) {
                console.error("First Person Movement script needs to have a DYNAMIC 'rigidbody' component");
            }
            
            this.eulers = this.entity.getEulerAngles().clone();            
            this.oneVoxelSize = this.entity.getLocalScale().clone().x * vx2.meshScale;
            this.groundCheckRay = this.entity.up.scale(-this.groundCheckRayLength).clone();
            this.onGround = false;
            this.isFlying = false;
        },
        
        checkGround: function () {
            var self = this;
            var pos = self.entity.getPosition();
            rayEndVector.add2(pos, this.groundCheckRay);
            self.onGround = false;

            app.systems.rigidbody.raycastFirst(pos, rayEndVector, function (result) {
                self.onGround = true;
                self.isFlying = false;
            });
        },

        // Called every frame, dt is time in seconds since last update
        update: function (dt) {
            // If a camera isn't assigned from the Editor, create one
            if (!this.camera) {
                this.createCamera();
            }
            //this.camera.lookAt(this.entity.getPosition().add(this.entity.up.scale(this.oneVoxelSize * 16)));
            
            // Check if this entity is on the ground
            this.checkGround();

            // Get camera directions to determine movement directions
            var forward = this.entity.forward;
            var right = this.entity.right;
            var up = this.entity.up;

            // movement
            var x = 0;
            var y = 0;
            var z = 0;
            
            // Use W-A-S-D keys to move player
            // Check for key presses
            if (app.keyboard.isPressed(pc.KEY_A) || app.keyboard.isPressed(pc.KEY_Q)) {
                x -= right.x;
                z -= right.z;
            }
            if (app.keyboard.isPressed(pc.KEY_D)) {
                x += right.x;
                z += right.z;
            }
            if (app.keyboard.isPressed(pc.KEY_W)) {
                x += forward.x;
                z += forward.z;
            }            
            if (app.keyboard.isPressed(pc.KEY_S)) {
                x -= forward.x;
                z -= forward.z;
            }
            if (app.keyboard.isPressed(pc.KEY_SPACE) && this.isFlying === true) {
                    y += up.y;
            }
            if (app.keyboard.isPressed(pc.KEY_SHIFT) && this.isFlying === true) {
                    y -= up.y;
            }
                        
            // Jump!
            if (app.keyboard.wasPressed(pc.KEY_SPACE)) {
                if (this.onGround === true) {
                    jumpVector.set(0, this.jumpForce, 0);
                    this.entity.rigidbody.applyImpulse(jumpVector, pc.Vec3.ZERO);
                    this.onGround = false;
                }
                else {
                    // Fly!
                    this.isFlying = true;
                }
            }
            
            // If flying, apply anti gravity
            if (this.isFlying === true) {
                this.entity.rigidbody.applyForce(antiGravityVector, pc.Vec3.ZERO);
            }
            
            // use direction from keypresses to apply a force to the character
            if ((x !== 0 ||y !== 0 || z !== 0)) {
                var efficient = this.moveForce;
                //if (this.onGround !== true) {
                //    // Reduce power
                //    efficient *= 0.5;
                //}
                velocityVector.set(x, y, z).normalize().scale(this.kinematicMoveMaxSpeed);
                if (this.isFlying === true) {
                    velocityVector.scale(this.flyingSpeedScale);
                }
                else {
                    velocityVector.y = this.entity.rigidbody.linearVelocity.y;
                }
                this.entity.rigidbody.linearVelocity = velocityVector;
            }
            else {
                // Apply damping
                velocityVector = this.entity.rigidbody.linearVelocity.clone();
                velocityVector.scale(0);
                //velocityVector.scale(Math.min(0, 1 - this.kinematicMoveGroundDamping * dt));
                if (this.isFlying === false) velocityVector.y = this.entity.rigidbody.linearVelocity.y;
                this.entity.rigidbody.linearVelocity = velocityVector;
            }
            
            // update camera angle from mouse events
            if (this.eulers.x !== 0 || this.eulers.y !== 0) {
                var pos = this.entity.getPosition();
                this.entity.setEulerAngles(this.eulers);
            }
            this.entity.rigidbody.syncEntityToBody();
        },
        
        onMouseMove: function (e) {
            // If pointer is disabled
            // If the left mouse button is down update the camera from mouse movement
            if (pc.Mouse.isPointerLocked() || e.buttons[0]) {
                this.eulers.x -= this.lookSpeed * e.dy;
                if (this.eulers.x > 85) {
                    this.eulers.x = 85;
                }
                else if (this.eulers.x < -85) {
                    this.eulers.x = -85;
                }
                this.eulers.y -= this.lookSpeed * e.dx;
            }            
        },
        
        createCamera: function () {
            // If user hasn't assigned a camera, create a new one
            this.camera = new pc.Entity();
            this.camera.setName("First Person Camera");
            this.camera.addComponent("camera");
            this.entity.addChild(this.camera);
        }
    };

    return FirstPersonMovement;
});