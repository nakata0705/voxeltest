pc.script.create('fpsRenderer', function (app) {
    // Creates a new FPS renderer instance
    var FpsRenderer = function (entity) {
        this.entity = entity;
    };

    FpsRenderer.prototype = {
        // Called once after all resources are loaded and before the first update
        initialize: function () {
            this.canvas = document.getElementById("application-canvas");
            this.parent = this.canvas.parentNode;
            
            this.div_fps = document.createElement("div");
            this.div_fps.style.position = "fixed";
            this.div_fps.style.left = "1%";
            this.div_fps.style.top = "1%";
            this.div_fps.style.textAlign = "left";
            this.div_fps.style.textShadow = "-1px -1px #000, 1px -1px #000, -1px 1px #000, 1px 1px #000";
            this.div_fps.style.fontSize = "10px";
            this.div_fps.style.fontFamily = '"メイリオ", "Meiryo", "ヒラギノ角ゴ ProN W3", "Hiragino Kaku Gothic ProN", "ＭＳ Ｐゴシック", "MS P Gothic", Verdana, Arial, Helvetica, sans-serif';
            this.div_fps.style.color = "#FFFFFF";
            this.div_fps.style.position.zIndex = 8;
            
            var gl = this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl");
            if (gl) {
                var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    this.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                    this.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                }
                else {
                    this.vendor = gl.getParameter(gl.VENDOR);
                    this.renderer = gl.getParameter(gl.RENDERER);
                }
                this.webglversion = gl.getParameter(gl.VERSION);
                this.shaderversion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
            }

            this.div_fps.innerHTML = "";
            
            this.parent.appendChild(this.div_fps);
            this.fromlastupdate = 1.0;
        },
        
        // Called every frame, dt is time in seconds since last update
        update: function (dt) {
            this.fromlastupdate += dt;
            if (this.fromlastupdate > 0.5) {
                this.div_fps.innerHTML = "FPS : " + (1.0 / dt).toFixed(0) + "<br /><br />WASD: Move<br />SPACE: Jump/Fly<br />Left Click: Voxel edit<br />CTRL+C/X/V/Z: Copy/Cut/Paste/Undo";
                this.fromlastupdate = 0.0;
            }
        }
    };

    return FpsRenderer;
});
