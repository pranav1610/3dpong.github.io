import {defs, tiny} from './examples/common.js';
import { Many_Lights_Demo } from './examples/many-lights-demo.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

function map (number, inMin, inMax, outMin, outMax) {
    return (number - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

function lerp(a, b, t) {
    return (1 - Math.sqrt(t)) * a + Math.sqrt(t) * b;
}

function randrange(min, max) { // min and max included 
    return (Math.random() * (max - min + 1) + min)
}

function mag(v){
    return Math.sqrt(v[0] * v[0] + v[1] * v[1])
}

const gravity = 22

export class Paddle{
    constructor(z, c){
        this.constZ = z;
        this.paddleResponsiveness = 0.1

        this.pos = vec3(0,2,this.constZ)
        this.transform = Mat4.identity().times(Mat4.translation(this.pos[0], this.pos[1], this.pos[2]))
        this.transform2 = Mat4.identity().times(Mat4.translation(this.pos[0], this.pos[1]-.8, this.pos[2]))

        this.shape = new (defs.Rounded_Capped_Cylinder.prototype.make_flat_shaded_version())(30,20)
        this.shape2 = new defs.Cube()
        this.material = new Material(new defs.Phong_Shader(),
                                    {ambient: .4, diffusivity: .6, specularity: .3, color: hex_color(c)})  
        this.material2 = new Material(new defs.Phong_Shader(),
                                    {ambient: .4, diffusivity: .6, specularity: .1,color: hex_color("#111122")})  
    }

    update(p){
        this.pos = vec3(lerp(this.pos[0], p[0], this.paddleResponsiveness), lerp(this.pos[1], p[1], this.paddleResponsiveness), this.constZ)

        this.transform = Mat4.identity().times(Mat4.translation(this.pos[0], this.pos[1], this.pos[2])).times(Mat4.rotation(map(p[0], -5,5, 1,-1),0,0,1)).times(Mat4.scale(.8,.8,.1))
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
        this.vel = vec3(1,0,13)
        this.acc = vec3(0,0,0)

        this.r = .125

        this.transform = Mat4.identity()

        this.shape = new defs.Subdivision_Sphere(3)
        this.material = new Material(new defs.Phong_Shader(),
                                    {ambient: .4, diffusivity: .6, color: hex_color("#eeffff")})       
                                    
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
        this.dt = dt;
    }

    dist(x1,y1, x2,y2){
        return Math.sqrt((x2-x1) * (x2-x1) + (y2-y1) * (y2-y1))
    }

    calcVel(maxHeight, targetPos, x0){
        let m = maxHeight
        let h = this.pos[1]

        let d = this.dist(this.pos[0], this.pos[2], targetPos[0], targetPos[1])
        
        let k = (1/gravity) - 1/(2*gravity)
        let vy0 = Math.sqrt((m-h)/k)

        let td = (-vy0 - Math.sqrt((vy0*vy0) - 4 * (-gravity/2) * h)) / (-gravity)
        //if (td < .0005 || td > -.0005) td = .0005
        let vx0 = (d) / td

        let theta = Math.atan(vy0/vx0)
        let temp = targetPos.minus(vec(this.pos[0], this.pos[2])).normalized()
        temp = temp.times(Math.cos(theta))
        let dir = vec3(temp[0], Math.sin(theta), temp[1]).normalized()

        console.log(m-h)
        return dir.times(Math.sqrt(vx0*vx0 + vy0*vy0))
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
            // player paddle's collision check
            playerCollide = (this.pos[2] >= 7.8) && this.dist(x,y,x_,y_) <= 1
        }else {
            // ai paddle's collision check
            playerCollide = (this.pos[2] <= -7.9) && this.dist(x,y,x_,y_) <= 1
        }

        if (playerCollide){
            this.pos = vec3(this.pos[0], this.pos[1], (player) ? 7.9 : -7.9)

            if(player){
                this.pos = vec3(this.pos[0], this.pos[1], this.pos[2]-.125)
                this.vel = this.calcVel(this.pos[1] + .3, vec(r,-2.5), 8)
            }else{
                this.pos = vec3(this.pos[0], this.pos[1], this.pos[2]+.125)
                this.vel = this.calcVel(this.pos[1] + .3, vec(r,2.5), -8)
            }

            console.log("hit")
        }

        //checking collision with the table
        let cubeConstraint = (this.pos[0] >= -5 && this.pos[0] <= 5) && (this.pos[2] >= -9 && this.pos[2] <= 9) 

        if(this.pos[1] - .25 <= 0 && cubeConstraint){
            this.pos = vec3(this.pos[0], .1 + .25, this.pos[2])
            this.vel = vec3(this.vel[0], -.96*this.vel[1], this.vel[2])
        }
    }

    // Displays the ball
    show(context, program_state) {  
        this.shape.draw(context, program_state, this.transform, this.material);     
    }
}

export class Table{
    constructor(){
        this.pos = vec3(0,0,0)

        this.transform = Mat4.identity().times(Mat4.translation(0,-0.1,0)).times(Mat4.scale(5,0.2,9))

        this.shape = new defs.Cube()
        this.material = new Material(new defs.Phong_Shader(),
                                    {ambient: .4, diffusivity: .8, specularity: .3, color: hex_color("#0b518a")})        
    }

    // Displays the table
    show(context, program_state) {  
        this.shape.draw(context, program_state, this.transform, this.material);     
    }
}

export class Net{
    constructor(){
        this.transform = Mat4.identity().times(Mat4.translation(0,.35,0)).times(Mat4.scale(5,0.7,.05))

        this.shape = new defs.Cube()
        this.material = new Material(new Net_Shader());
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
        this.targetPoint = vec3(0,2,0);

        this.ai = new Paddle(-8,"#1122ee");

        this.mousePos = vec3(0,0,0)
        this.initial_camera_location = Mat4.look_at(vec3(0, 4.5, 15), vec3(0, .5, 0), vec3(0, 1, 0));

        this.cube = new defs.Cube()

        this.cubemat = new Material(new defs.Phong_Shader(),
            {ambient: .4, diffusivity: .6, specularity: .1,color: hex_color("#ffefcb")})  
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
        let y = map(mousePos[1], 0, 600, 5, .5)

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

    clamp(p){
        return vec3(Math.min(Math.max(p[0], -7), 7), Math.min(Math.max(p[1], 1), 5), p[2])
    }

    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        // TODO: Lighting (Requirement 2)
        const light_position = vec4(0, 5, 5, 1);
        // The parameters of the Light are: position, color, size
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        // TODO:  Fill in matrix operations and drawing code to draw the solar system scene (Requirements 3 and 4)
        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;

        //this.shapes.sphere.draw(context, program_state, model_transform, this.materials.test.override({color: yellow}));
        
        //this.cube.draw(context, program_state, Mat4.identity().times(Mat4.translation(0,-10,0)), this.cubemat)

        context.canvas.addEventListener("mousemove", e => {
            e.preventDefault();
            this.mousePos = this.getMousePos(context.canvas, e);
        });

        
        this.targetPoint = vec3(0,2,0)
        if(this.ball.pos[2] < -6){
            this.targetPoint = this.rayPlaneIntersection(this.ball.pos, this.ball.vel, -8)
        }

        this.player.update(this.mouseToWorldPos(this.mousePos))
        this.player.show(context, program_state)

        this.ai.update(this.clamp(this.targetPoint))
        this.ai.show(context, program_state)

        
        
        this.ball.applyForce(vec3(0,-gravity,0))
        this.ball.applyForce(/*Apply any vector as a force*/vec3(0,0,0))
        this.ball.update(dt)
        this.ball.checkCollison(this.player)
        this.ball.checkCollison(this.ai)
        this.ball.show(context, program_state)
        
        this.table.show(context, program_state)

        this.cube.draw(context, program_state, Mat4.identity()
        .times(Mat4.scale(.1,.55,.1))
        .times(Mat4.translation(-5*10,1,0))
        , this.cubemat.override({color:color(.12,.12,.12,1)}))

        this.cube.draw(context, program_state, Mat4.identity()
        .times(Mat4.scale(.1,.55,.1))
        .times(Mat4.translation(5*10,1,0))
        , this.cubemat.override({color:color(.12,.12,.12,1)}))
        
        let trans = Mat4.identity()
        
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


        this.net.show(context, program_state)
    }
}


class Net_Shader extends Shader {
    constructor() {
        super();
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return ` 
        precision mediump float;
        
        varying vec4 position_OCS; // <---
        `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
            attribute vec3 position, normal;       
            
            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;
    
            void main(){                                                                   
                // The vertex's final resting place (in NDCS):
                gl_Position = projection_camera_model_transform * vec4( position, 1.0 ); 
                position_OCS = vec4( position, 1.0 ); // <---
            } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        return this.shared_glsl_code() + `
            uniform vec4 shape_color; 
        
            void main(){           
                float factor = 0.0;
                float refx = position_OCS.x + 1.0;
                float refy = position_OCS.y + 1.0;

                float densityX = 35.0;
                float densityY = 5.6;
                if(position_OCS.y >.9|| position_OCS.y < -.24 || (mod(refx, 1.0 / densityX) < 0.5 / densityX) && (mod(refx, 1.0 / densityX) > 0.2 / densityX) || mod(refy, 1.0 / densityY) < 0.5 / densityY && (mod(refy, 1.0 / densityY) > 0.1 / densityY) ){
                    factor = .9;
                    if(position_OCS.y > .9 || position_OCS.y < -.3){
                        factor = 1.0;
                    }
                }
                vec3 col = vec3(0.8,0.8,0.8);
                if(position_OCS.y < .9 ){
                    col = vec3(.0,.0,.0);
                }
                //vec4 mixed_color =  vec4(col, factor);
                gl_FragColor = vec4(col, factor);
            } `;
    }

    update_GPU(context, gpu_addresses, graphics_state, model_transform, material) {
        // update_GPU():  Defining how to synchronize our JavaScript's variables to the GPU's:
        const [P, C, M] = [graphics_state.projection_transform, graphics_state.camera_inverse, model_transform],
            PCM = P.times(C).times(M);
        context.uniformMatrix4fv(gpu_addresses.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        context.uniformMatrix4fv(gpu_addresses.projection_camera_model_transform, false,
            Matrix.flatten_2D_to_1D(PCM.transposed()));

        // Set uniform parameters
        context.uniform4fv(gpu_addresses.shape_color, color(.85,.85,.85,1));
    }

}