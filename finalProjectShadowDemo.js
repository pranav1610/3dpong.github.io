import {defs, tiny} from './examples/common.js';
import { Many_Lights_Demo } from './examples/many-lights-demo.js';
import {Color_Phong_Shader, Shadow_Textured_Phong_Shader,
    Depth_Texture_Shader_2D, Buffered_Texture, LIGHT_DEPTH_TEX_SIZE} from './examples/shadow-demo-shaders.js'

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

const {Cube, Axis_Arrows, Textured_Phong, Phong_Shader, Basic_Shader, Subdivision_Sphere} = defs


function map (number, inMin, inMax, outMin, outMax) {
    return (number - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

function lerp(a, b, t) {
    return (1 - Math.sqrt(t)) * a + Math.sqrt(t) * b;
}

// 2D shape, to display the texture buffer
const Square =
    class Square extends tiny.Vertex_Buffer {
        constructor() {
            super("position", "normal", "texture_coord");
            this.arrays.position = [
                vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0),
                vec3(1, 1, 0), vec3(1, 0, 0), vec3(0, 1, 0)
            ];
            this.arrays.normal = [
                vec3(0, 0, 1), vec3(0, 0, 1), vec3(0, 0, 1),
                vec3(0, 0, 1), vec3(0, 0, 1), vec3(0, 0, 1),
            ];
            this.arrays.texture_coord = [
                vec(0, 0), vec(1, 0), vec(0, 1),
                vec(1, 1), vec(1, 0), vec(0, 1)
            ]
        }
    }


export class Paddle{
    constructor(z, c){
        this.constZ = z;
        this.paddleResponsiveness = 0.1

        this.pos = vec3(0,2,this.constZ)
        this.transform = Mat4.identity().times(Mat4.translation(this.pos[0], this.pos[1], this.pos[2]))
        this.transform2 = Mat4.identity().times(Mat4.translation(this.pos[0], this.pos[1]-.8, this.pos[2]))

        this.shape = new defs.Subdivision_Sphere(3)
        this.shape2 = new defs.Cube()
        this.material = new Material(new defs.Phong_Shader(),
                                    {ambient: .4, diffusivity: .6, specularity: .3, color: hex_color(c)})  
        this.material2 = new Material(new defs.Phong_Shader(),
                                    {ambient: .4, diffusivity: .6, specularity: .1,color: hex_color("#111122")})  
    }

    update(p){
        this.pos = vec3(lerp(this.pos[0], p[0], this.paddleResponsiveness), lerp(this.pos[1], p[1], this.paddleResponsiveness), this.constZ)

        this.transform = Mat4.identity().times(Mat4.translation(this.pos[0], this.pos[1], this.pos[2])).times(Mat4.scale(.8,.8,.1)).times(Mat4.rotation(map(p[0], -5,5, 1,-1),0,0,1))
        this.transform2 = this.transform.times(Mat4.translation(0,-1,0)).times(Mat4.scale(.2,.8,.3))
    }

    show(context, program_state) {  
        this.shape.draw(context, program_state, this.transform, this.material);     
        this.shape2.draw(context, program_state, this.transform2, this.material2);     
    }

}

export class Ball{
    constructor(){
        this.pos = vec3(0,3,-7)
        this.vel = vec3(1,0,7)
        this.acc = vec3(0,0,0)

        this.r = .125

        this.transform = Mat4.identity()

        this.shape = new defs.Subdivision_Sphere(3)
        this.material = new Material(new defs.Phong_Shader(),
                                    {ambient: .4, diffusivity: .6, color: hex_color("#f5a42a")})       
                                    
        this.hit = []
    }

    applyForce(f){
        this.acc = this.acc.plus(f)
    }

    // Updates the position, velocity, and acceleration by euler's method
    update(dt) {    
        this.vel = this.vel.plus(this.acc.times(dt))
        this.pos = this.pos.plus(this.vel.times(dt))
        this.acc = this.acc.times(.1)

        this.transform = Mat4.identity().times(Mat4.translation(this.pos[0], this.pos[1], this.pos[2])).times(Mat4.scale(this.r,this.r,this.r))
        
        //drag
        //this.vel = this.vel.times(0.99)
    }

    dist(x1,y1, x2,y2){
        return Math.sqrt((x2-x1) * (x2-x1) + (y2-y1) * (y2-y1))
    }

    checkCollison(paddle){
        // check collision with the player paddle
        let x = this.pos[0]
        let y = this.pos[1]

        let x_ = paddle.pos[0]
        let y_ = paddle.pos[1]

        let playerCollide = false
        let player = paddle.constZ > 0

        if (player) {
            playerCollide = (this.pos[2] >= 7.8 && this.pos[2] <= 8.0) && this.dist(x,y,x_,y_) <= 1
        }else {
            playerCollide = (this.pos[2] <= -7.9 && this.pos[2] >= -8.3) && this.dist(x,y,x_,y_) <= 1
        }

        if (playerCollide){
            this.pos = vec3(this.pos[0], this.pos[1], (player) ? 7.9 : -7.9)
            this.vel = vec3(player ? 6*(Math.random()-.5) : -this.vel[0], this.vel[1], player ? -15:-1 * this.vel[2])

            console.log("hit")
        }

        //checking collision with the table
        let cubeConstraint = (this.pos[0] >= -5 && this.pos[0] <= 5) && (this.pos[2] >= -9 && this.pos[2] <= 9) 

        if(this.pos[1] - .25 <= 0 && cubeConstraint){
            this.pos = vec3(this.pos[0], .1 + .25, this.pos[2])
            this.vel = vec3(this.vel[0], -this.vel[1], this.vel[2])
        }
    }

    // Displays the ball
    show(context, program_state, material) {  
        this.shape.draw(context, program_state, this.transform, material);     
    }
}

export class Table{
    constructor(){
        this.pos = vec3(0,0,0)

        this.transform = Mat4.identity().times(Mat4.translation(0,-0.1,0)).times(Mat4.scale(5,0.2,9))

        this.shape = new defs.Cube()
        // this.material = new Material(new defs.Phong_Shader(),
        //                             {ambient: .4, diffusivity: .8, specularity: .3, color: hex_color("#0b518a")})        
    }

    // Displays the table

    show(context, program_state, material) {  
        this.shape.draw(context, program_state, this.transform, material);  
    
    }
}

export class Net{
    constructor(){
        this.pos = vec3(0,0,0)

        this.transform = Mat4.identity().times(Mat4.translation(0,.35,0)).times(Mat4.scale(5,0.7,.05))

        this.shape = new defs.Cube()
        this.material = new Material(new defs.Phong_Shader(),
                                    {ambient: .4, diffusivity: .6, color: hex_color("bbccdd")})        
    }

    // Displays the table
    show(context, program_state) {  
        this.shape.draw(context, program_state, this.transform, this.material);     
    }
}

export class FinalProject extends Scene {
    constructor() {
        super();

        this.ball = new Ball();
        this.table = new Table();
        this.net = new Net();

        this.player = new Paddle(8,"#ff2233");

        this.ai = new Paddle(-8,"#1122ee");

        this.mousePos = vec3(0,0,0)
        this.initial_camera_location = Mat4.look_at(vec3(0, 4.5, 15), vec3(0, 0, 0), vec3(0, 1, 0));

        this.cube = new defs.Cube()

        this.cubemat = new Material(new defs.Phong_Shader(),
            {ambient: .4, diffusivity: .6, specularity: .1,color: hex_color("#ffefcb")}) 
            
        // Load the model file:
        this.shapes = {
            "sphere": new Subdivision_Sphere(6),
            "cube": new Cube(),
            "square_2d": new Square(),
        };

        // For the floor or other plain objects
        this.floor = new Material(new Shadow_Textured_Phong_Shader(1), {
            color: color(1, 1, 1, 1), ambient: .3, diffusivity: 0.6, specularity: 0.4, smoothness: 64,
            color_texture: null,
            light_depth_texture: null
        })
        // For the first pass
        this.pure = new Material(new Color_Phong_Shader(), {
        })
        // For light source
        this.light_src = new Material(new Phong_Shader(), {
            color: color(1, 1, 1, 1), ambient: 1, diffusivity: 0, specularity: 0
        });
        // For depth texture display
        this.depth_tex =  new Material(new Depth_Texture_Shader_2D(), {
            color: color(0, 0, .0, 1),
            ambient: 1, diffusivity: 0, specularity: 0, texture: null
        });
    }

    getMousePos(canvas, evt) {
        var rect = canvas.getBoundingClientRect();
        return vec(evt.clientX - rect.left, evt.clientY - rect.top)
    }

    mouseToWorldPos(mousePos) {
        //mouse x goes from 0 to 1080
        //mouse y goes from 0 to 600
        //world x -> -5 to 5
        //world y -> 1 to 3

        let x = map(mousePos[0], 0, 1080, -5, 5)
        let y = map(mousePos[1], 0, 600, 3, 1)

        return vec(x,y)
    }

    rayPlaneIntersection(p, v, z_){
        // plane func -> z = z_
        // (x,y,z) = (px,py,pz) + (vx,vy,vz) t
        // ( px + vx*t , py + vx*t , pz + vz * t )
        // z = pz + vz * t
        // pz + vz * t = z_
        // t = (z_ - pz) / vz
        let t = (z_ - p[2]) / p[2]
        return vec3( p[0] + v[0]*t , p[1] + v[1]*t , p[2] + v[2] * t )
        
    }

    texture_buffer_init(gl) {
        // Depth Texture
        this.lightDepthTexture = gl.createTexture();
        // Bind it to TinyGraphics
        this.light_depth_texture = new Buffered_Texture(this.lightDepthTexture);
        //this.stars.light_depth_texture = this.light_depth_texture
        this.floor.light_depth_texture = this.light_depth_texture

        this.lightDepthTextureSize = LIGHT_DEPTH_TEX_SIZE;
        gl.bindTexture(gl.TEXTURE_2D, this.lightDepthTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,      // target
            0,                  // mip level
            gl.DEPTH_COMPONENT, // internal format
            this.lightDepthTextureSize,   // width
            this.lightDepthTextureSize,   // height
            0,                  // border
            gl.DEPTH_COMPONENT, // format
            gl.UNSIGNED_INT,    // type
            null);              // data
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Depth Texture Buffer
        this.lightDepthFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightDepthFramebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,       // target
            gl.DEPTH_ATTACHMENT,  // attachment point
            gl.TEXTURE_2D,        // texture target
            this.lightDepthTexture,         // texture
            0);                   // mip level
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // create a color texture of the same size as the depth texture
        // see article why this is needed_
        this.unusedTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.unusedTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            this.lightDepthTextureSize,
            this.lightDepthTextureSize,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // attach it to the framebuffer
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,        // target
            gl.COLOR_ATTACHMENT0,  // attachment point
            gl.TEXTURE_2D,         // texture target
            this.unusedTexture,         // texture
            0);                    // mip level
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    render_scene(context, program_state, shadow_pass, draw_light_source=false, draw_shadow=false) {
        // shadow_pass: true if this is the second pass that draw the shadow.
        // draw_light_source: true if we want to draw the light source.
        // draw_shadow: true if we want to draw the shadow

        let light_position = this.light_position;
        let light_color = this.light_color;
        const t = program_state.animation_time / 1000;

        program_state.draw_shadow = draw_shadow;

        // if (draw_light_source && shadow_pass) {
        //     this.shapes.sphere.draw(context, program_state,
        //         Mat4.translation(light_position[0], light_position[1], light_position[2]).times(Mat4.scale(.5,.5,.5)),
        //         this.light_src.override({color: light_color}));
        // }

        let model_trans_floor = Mat4.scale(8, 0.1, 5);
        let model_trans_ball_0 = Mat4.translation(0, 1, 0);
        // let model_trans_ball_1 = Mat4.translation(5, 1, 0);
        // let model_trans_ball_2 = Mat4.translation(-5, 1, 0);
        // let model_trans_ball_3 = Mat4.translation(0, 1, 3);
        // let model_trans_ball_4 = Mat4.translation(0, 1, -3);
        //let model_trans_wall_1 = Mat4.translation(-8, 2 - 0.1, 0).times(Mat4.scale(0.33, 2, 5));
        // let model_trans_wall_2 = Mat4.translation(+8, 2 - 0.1, 0).times(Mat4.scale(0.33, 2, 5));
        // let model_trans_wall_3 = Mat4.translation(0, 2 - 0.1, -5).times(Mat4.scale(8, 2, 0.33));
        //this.shapes.cube.draw(context, program_state, model_trans_floor, shadow_pass? this.floor : this.pure);
       //this.table.show(context, program_state, shadow_pass? this.floor : this.pure)

        //this.shapes.cube.draw(context, program_state, model_trans_wall_1, shadow_pass? this.floor : this.pure);
        //this.shapes.cube.draw(context, program_state, model_trans_wall_2, shadow_pass? this.floor : this.pure);
        //this.shapes.cube.draw(context, program_state, model_trans_wall_3, shadow_pass? this.floor : this.pure);
        model_trans_ball_0 = model_trans_ball_0.times(Mat4.translation(0,t,0));
        this.shapes.sphere.draw(context, program_state, model_trans_ball_0, shadow_pass? this.floor : this.pure);
        // this.shapes.sphere.draw(context, program_state, model_trans_ball_1, shadow_pass? this.floor : this.pure);
        // this.shapes.sphere.draw(context, program_state, model_trans_ball_2, shadow_pass? this.floor : this.pure);
        // this.shapes.sphere.draw(context, program_state, model_trans_ball_3, shadow_pass? this.floor : this.pure);
        // this.shapes.sphere.draw(context, program_state, model_trans_ball_4, shadow_pass? this.floor : this.pure);
    }

    display(context, program_state) {
        
        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
        
        const gl = context.context;

        if (!this.init_ok) {
            const ext = gl.getExtension('WEBGL_depth_texture');
            if (!ext) {
                return alert('need WEBGL_depth_texture');  // eslint-disable-line
            }
            this.texture_buffer_init(gl);

            this.init_ok = true;
        }

        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(Mat4.look_at(
                vec3(0, 12, 12),
                vec3(0, 2, 0),
                vec3(0, 1, 0)
            )); // Locate the camera here
        }

        // The position of the light
        this.light_position = Mat4.rotation(t / 1500, 0, 1, 0).times(vec4(3, 6, 0, 1));
        // The color of the light
        this.light_color = color(
            0.667 + Math.sin(t/500) / 3,
            0.667 + Math.sin(t/1500) / 3,
            0.667 + Math.sin(t/3500) / 3,
            1
        );

        // This is a rough target of the light.
        // Although the light is point light, we need a target to set the POV of the light
        this.light_view_target = vec4(0, 0, 0, 1);
        this.light_field_of_view = 130 * Math.PI / 180; // 130 degree

        program_state.lights = [new Light(this.light_position, this.light_color, 1000)];

        // Step 1: set the perspective and camera to the POV of light
        const light_view_mat = Mat4.look_at(
            vec3(this.light_position[0], this.light_position[1], this.light_position[2]),
            vec3(this.light_view_target[0], this.light_view_target[1], this.light_view_target[2]),
            vec3(0, 1, 0), // assume the light to target will have a up dir of +y, maybe need to change according to your case
        );
        const light_proj_mat = Mat4.perspective(this.light_field_of_view, 1, 0.5, 500);
        // Bind the Depth Texture Buffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightDepthFramebuffer);
        gl.viewport(0, 0, this.lightDepthTextureSize, this.lightDepthTextureSize);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // Prepare uniforms
        program_state.light_view_mat = light_view_mat;
        program_state.light_proj_mat = light_proj_mat;
        program_state.light_tex_mat = light_proj_mat;
        program_state.view_mat = light_view_mat;
        program_state.projection_transform = light_proj_mat;
        this.render_scene(context, program_state, false,false, false);

        // Step 2: unbind, draw to the canvas
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        program_state.view_mat = program_state.camera_inverse;
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 0.5, 500);
        this.render_scene(context, program_state, true,true, true);

        

        // iske niche se
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        // if (!context.scratchpad.controls) {
        //     //this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
        //     // Define the global camera and projection matrices, which are stored in program_state.
        //     program_state.set_camera(this.initial_camera_location);
        // }

        // program_state.projection_transform = Mat4.perspective(
        //     Math.PI / 4, context.width / context.height, .1, 1000);

        // TODO: Lighting (Requirement 2)
        // const light_position = vec4(0, 5, 5, 1);
        // The parameters of the Light are: position, color, size
        // program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        // TODO:  Fill in matrix operations and drawing code to draw the solar system scene (Requirements 3 and 4)
        //const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;

        
        //this.shapes.sphere.draw(context, program_state, model_transform, this.materials.test.override({color: yellow}));
        
        //this.cube.draw(context, program_state, Mat4.identity().times(Mat4.translation(0,-10,0)), this.cubemat)

        context.canvas.addEventListener("mousemove", e => {
            e.preventDefault();
            this.mousePos = this.getMousePos(context.canvas, e);
        });

        let targetPoint = vec3(0,2,0)

        if(this.ball.pos[2] < -6){
            targetPoint = this.rayPlaneIntersection(this.ball.pos, this.ball.vel, -8)
        }

        this.player.update(this.mouseToWorldPos(this.mousePos))
        this.player.show(context, program_state)

        this.ai.update(targetPoint)
        this.ai.show(context, program_state)

        const gravity = 22
        
        this.ball.applyForce(vec3(0,-gravity,0))
        this.ball.applyForce(/*Apply any vector as a force*/vec3(0,0,0))
        this.ball.update(dt)
        this.ball.checkCollison(this.player)
        this.ball.checkCollison(this.ai)
        //this.ball.show(context, program_state)
        

        this.ball.show(context, program_state, this.pure)
        
        // context, program_state, model_trans_floor, shadow_pass? this.floor : this.pure
        this.table.show(context, program_state, this.floor)

        this.net.show(context, program_state)

        let trans = Mat4.identity()
        // context, program_state, model_trans_floor, shadow_pass? this.floor : this.pure
        this.cube.draw(context, program_state, trans.times(Mat4.translation(0,-.89,0))
        .times(Mat4.scale(.05,1,9.01))
        , this.cubemat.override({color:color(1,1,1,1)}))

        trans = trans.times(Mat4.translation(0,0,-20)).times(Mat4.scale(10,10,1))
        this.cube.draw(context, program_state, trans, this.cubemat)
        let trans1 = trans.times(Mat4.scale(0.1,0.1,1)).times(Mat4.rotation(Math.PI/2,0,1,0)).times(Mat4.scale(20,10,1)).times(Mat4.translation(-1,0,10))
        this.cube.draw(context, program_state, trans1, this.cubemat)
        //let trans2 = trans.times(Mat4.scale(0.1,0.1,1)).times(Mat4.rotation(Math.PI/2,0,1,0)).times(Mat4.scale(20,10,1)).times(Mat4.translation(-1,0,-10))
        //this.cube.draw(context, program_state, trans2, this.cubemat)
        let trans2 = trans.times(Mat4.scale(0.1,0.1,1)).times(Mat4.rotation(Math.PI/2,0,1,0)).times(Mat4.scale(5,10,1)).times(Mat4.translation(-1,0,-10));
        this.cube.draw(context, program_state, trans2, this.cubemat);
        let trans3 = trans.times(Mat4.translation(0.15,0,0)).times(Mat4.scale(0.1,0.1,1)).times(Mat4.rotation(Math.PI/2,0,1,0)).times(Mat4.scale(5,10,1)).times(Mat4.translation(-5,0,-10));
        this.cube.draw(context, program_state, trans3, this.cubemat);
        let model_transform = Mat4.identity();
        let trans4 =model_transform.times(Mat4.translation(-0.7,6,-7)).times(Mat4.scale(0.1,0.1,2)).times(Mat4.rotation(Math.PI/2,0,1,0)).times(Mat4.scale(1.7,15,8)).times(Mat4.translation(-1,0,-10));
        this.cube.draw(context, program_state, trans4, this.cubemat);
        let trans5 = model_transform.times(Mat4.translation(-0.7,-2,-7)).times(Mat4.scale(0.1,0.1,2)).times(Mat4.rotation(Math.PI/2,0,1,0)).times(Mat4.scale(1.7,15,8)).times(Mat4.translation(-1,0,-10));
        this.cube.draw(context, program_state, trans5, this.cubemat);

    }
}