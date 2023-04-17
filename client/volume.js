import { Vector2 } from "./math/Vector2.js"
import { Vector3 } from "./math/Vector3.js"
import { Vector4 } from "./math/Vector4.js"
import { EngineContext } from "./EngineContext.js"
import { CanvasContext } from "./CanvasContext.js"
import { VolumeDataLoader } from "./VolumeDataLoader.js"
import { VolumeIsosurfaceModel } from "./VolumeIsosurfaceModel.js"
import { PerspectiveCameraEx } from "./PerspectiveCameraEx.js"
import { OrbitControls } from "./controls/OrbitControls.js"

export async function test()
{
    const input_isovalue = document.createElement("input");        
    input_isovalue.style.cssText = "position:absolute; left:5%; top: 2%; width: 250px; ";
    input_isovalue.type = "range";
    input_isovalue.min = "0";
    input_isovalue.max = `100`;
    input_isovalue.value="40";        
    document.body.appendChild(input_isovalue);
    
    const canvas = document.getElementById('gfx');
    canvas.style.cssText = "position:absolute; width: 100%; height: 100%;";          

    const engine_ctx = new EngineContext();
    const canvas_ctx = new CanvasContext(canvas);
    await canvas_ctx.initialize();
    
    const size_changed = ()=>{
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        canvas_ctx.resize();
    };
    
    let observer = new ResizeObserver(size_changed);
    observer.observe(canvas);    
    
    let volData = await VolumeDataLoader.LoadRawVolumeFile("cthead.raw", new Vector3(208,256,225));
    let volModel = new VolumeIsosurfaceModel(volData);
    volModel.rotateZ(Math.PI);
    volModel.rotateX(Math.PI*0.5);
    volModel.scale.set(15.0,15.0,15.0);
    volModel.updateWorldMatrix(false, false);
    volModel.updateConstant();   

    input_isovalue.addEventListener("input", () => {
        volModel.isovalue = parseFloat(input_isovalue.value)/100.0;
        volModel.updateConstant();
    });
    
    let camera = new PerspectiveCameraEx(45.0, canvas.width/canvas.height, 0.1, 100.0);
    camera.position.set(0.0, 0.0, 7.0);    

    let controls = new OrbitControls(camera, canvas);    
    controls.target.set(0.0, 0.0, 0.0); 
    controls.enableDamping = true;

    const pipelineLayoutDesc = { bindGroupLayouts: [engine_ctx.cache.bindGroupLayouts.camera, engine_ctx.cache.bindGroupLayouts.isosurface] };
    const layout = engine_ctx.device.createPipelineLayout(pipelineLayoutDesc);
    
    let shaderModule = engine_ctx.device.createShaderModule({
        code: `
struct Camera
{
    projMat: mat4x4f, 
    viewMat: mat4x4f,
    invProjMat: mat4x4f,
    invViewMat: mat4x4f,
    eyePos: vec3f
};

@group(0) @binding(0)
var<uniform> uCamera: Camera;

struct Model
{
    invModelMat: mat4x4f,
    modelMat: mat4x4f,
    normalMat: mat4x4f,
    size: vec4i,
    spacing: vec4f,
    step: f32,
    isovalue: f32
};

@group(1) @binding(0)
var<uniform> uModel: Model;

@group(1) @binding(1) 
var uSampler: sampler;

@group(1) @binding(2)
var uTex: texture_3d<f32>;

struct VSOut 
{
    @builtin(position) Position: vec4f,
    @location(0) posProj: vec2f
};

@vertex
fn vs_main(@builtin(vertex_index) vertId: u32) -> VSOut 
{
    var vsOut: VSOut;
    let grid = vec2(f32((vertId<<1)&2), f32(vertId & 2));
    let pos_proj = grid * vec2(2.0, 2.0) + vec2(-1.0, -1.0);
    vsOut.posProj = pos_proj;
    vsOut.Position = vec4(pos_proj, 0.0, 1.0);
    return vsOut;
}

fn get_norm(pos: vec3f)-> vec3f
{
    let min_pos = -vec3f(uModel.size.xyz) * uModel.spacing.xyz * 0.5;
    let max_pos = vec3f(uModel.size.xyz) * uModel.spacing.xyz * 0.5;

    var delta : vec3f;
    {
        let pos1 = pos + vec3(uModel.spacing.x, 0.0, 0.0);
        let coord1 = (pos1 - min_pos)/(max_pos - min_pos);
        let pos2 = pos - vec3(uModel.spacing.x, 0.0, 0.0);
        let coord2 = (pos2 - min_pos)/(max_pos - min_pos);
        delta.x = textureSampleLevel(uTex, uSampler, coord1, 0.0).x - textureSampleLevel(uTex, uSampler, coord2, 0.0).x;
    }
    {
        let pos1 = pos + vec3(0.0, uModel.spacing.y, 0.0);
        let coord1 = (pos1 - min_pos)/(max_pos - min_pos);
        let pos2 = pos - vec3(0.0, uModel.spacing.y, 0.0);
        let coord2 = (pos2 - min_pos)/(max_pos - min_pos);
        delta.y = textureSampleLevel(uTex, uSampler, coord1, 0.0).x - textureSampleLevel(uTex, uSampler, coord2, 0.0).x;
    }
    {
        let pos1 = pos + vec3(0.0, 0.0, uModel.spacing.z);
        let coord1 = (pos1 - min_pos)/(max_pos - min_pos);
        let pos2 = pos - vec3(0.0, 0.0, uModel.spacing.z);
        let coord2 = (pos2 - min_pos)/(max_pos - min_pos);
        delta.z = textureSampleLevel(uTex, uSampler, coord1, 0.0).x - textureSampleLevel(uTex, uSampler, coord2, 0.0).x;
    }

    let norm = -delta/uModel.spacing.xyz;
    let world_norm = uModel.normalMat * vec4(norm, 0.0);
    return normalize(world_norm.xyz);
}

fn get_shading(pos: vec3f)-> vec3f
{
    let norm = get_norm(pos);
    let k = norm.y * 0.5 + 0.5;    
    return mix(vec3(0.1, 0.1, 0.1), vec3(0.6, 0.6, 0.8), k);
}

@fragment
fn fs_main(@location(0) vPosProj: vec2f) -> @location(0) vec4f
{  
    var pos_view = uCamera.invProjMat * vec4(vPosProj, 1.0, 1.0);
    pos_view *= 1.0/pos_view.w;
    let pos_world = uCamera.invViewMat * pos_view;
    let pos_model = (uModel.invModelMat * pos_world).xyz;
    let eye_pos = (uModel.invModelMat * vec4(uCamera.eyePos, 1.0)).xyz;
    let dir = normalize(pos_model - eye_pos);
   
    let min_pos = -vec3f(uModel.size.xyz) * uModel.spacing.xyz * 0.5;
    let max_pos = vec3f(uModel.size.xyz) * uModel.spacing.xyz * 0.5;

    let t_min = (min_pos - eye_pos)/dir;
    let t_max = (max_pos - eye_pos)/dir;

    let t0_start = min(t_min, t_max);
    let t_start = max(max(t0_start.x, t0_start.y), t0_start.z);

    let t1_stop = max(t_min, t_max);
    let t_stop = min(min(t1_stop.x, t1_stop.y), t1_stop.z);

    if (t_stop < t_start) 
    {
        discard;
    }        
    
    var t = t_start;
    var pos = eye_pos + t*dir;
    var coord = (pos - min_pos)/(max_pos - min_pos);
    let v0 = textureSampleLevel(uTex, uSampler, coord, 0.0).x;
    var hit = false;

    while(t < t_stop)
    {
        t += uModel.step;

        pos = eye_pos + t*dir;
        coord = (pos - min_pos)/(max_pos - min_pos);
        let v1 = textureSampleLevel(uTex, uSampler, coord, 0.0).x;
        if ((v0<=uModel.isovalue && v1>=uModel.isovalue) || (v0>=uModel.isovalue && v1<=uModel.isovalue))
        {
            let k = (uModel.isovalue - v1)/(v1-v0);
            t += k * uModel.step;
            pos = eye_pos + t * dir;
            hit = true;
            break;
        }
    }

    if (!hit)
    {
        discard;
    }
    return vec4(get_shading(pos), 1.0);

}`
    });

    const depthStencil = {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth32float'
    };

    const vertex = {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: []
    };

    const colorState = {
        format: canvas_ctx.view_format,
        writeMask: GPUColorWrite.ALL
    };

    const fragment = {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [colorState]
    };

    const primitive = {
        frontFace: 'cw',
        cullMode: 'none',
        topology: 'triangle-list'
    };

    const pipelineDesc = {
        layout,

        vertex,
        fragment,

        primitive,
        depthStencil
    };

    let pipeline = engine_ctx.device.createRenderPipeline(pipelineDesc); 

    const toViewAABB = (MV, min_pos, max_pos) =>
    {
        let view_pos = [];
        {
            let pos = new Vector4(min_pos.x, min_pos.y, min_pos.z, 1.0);
            pos.applyMatrix4(MV);
            view_pos.push(pos);
        }

        {
            let pos = new Vector4(max_pos.x, min_pos.y, min_pos.z, 1.0);
            pos.applyMatrix4(MV);
            view_pos.push(pos);
        }

        {
            let pos = new Vector4(min_pos.x, max_pos.y, min_pos.z, 1.0);
            pos.applyMatrix4(MV);
            view_pos.push(pos);
        }
        
        {
            let pos = new Vector4(max_pos.x, max_pos.y, min_pos.z, 1.0);
            pos.applyMatrix4(MV);
            view_pos.push(pos);
        }

        {
            let pos = new Vector4(min_pos.x, min_pos.y, max_pos.z, 1.0);
            pos.applyMatrix4(MV);
            view_pos.push(pos);
        }

        {
            let pos = new Vector4(max_pos.x, min_pos.y, max_pos.z, 1.0);
            pos.applyMatrix4(MV);
            view_pos.push(pos);
        }

        {
            let pos = new Vector4(min_pos.x, max_pos.y, max_pos.z, 1.0);
            pos.applyMatrix4(MV);
            view_pos.push(pos);
        }
        
        {
            let pos = new Vector4(max_pos.x, max_pos.y, max_pos.z, 1.0);
            pos.applyMatrix4(MV);
            view_pos.push(pos);
        }

        let min_pos_view = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
        let max_pos_view = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);

        for (let k=0; k<8; k++)
        {
            let pos = view_pos[k];
            if (pos.x < min_pos_view.x) min_pos_view.x = pos.x;
            if (pos.x > max_pos_view.x) max_pos_view.x = pos.x;
            if (pos.y < min_pos_view.y) min_pos_view.y = pos.y;
            if (pos.y > max_pos_view.y) max_pos_view.y = pos.y;
            if (pos.z < min_pos_view.z) min_pos_view.z = pos.z;
            if (pos.z > max_pos_view.z) max_pos_view.z = pos.z;
        }

        return { min_pos_view, max_pos_view };

    }

    const calc_scissor = (camera, model, width, height)=>
    {
        let origin = new Vector2(0,0);
	    let size = new Vector2(0,0);

        let {min_pos, max_pos} = model.data.GetMinMax();

        let MV = camera.matrixWorldInverse.clone();
        MV.multiply(model.matrixWorld);

        let {min_pos_view, max_pos_view }=  toViewAABB(MV, min_pos, max_pos);
        
        let invP = camera.projectionMatrixInverse;
        let view_far = new Vector4(0,0,1,1);
        view_far.applyMatrix4(invP);
        view_far.multiplyScalar(1.0/view_far.w);
        let view_near = new Vector4(0,0,-1,1);
        view_near.applyMatrix4(invP);
        view_near.multiplyScalar(1.0/view_near.w);

        if (min_pos_view.z < view_far.z)
        {
            min_pos_view.z = view_far.z;
        }

        if (max_pos_view.z > view_near.z)
        {
            max_pos_view.z = view_near.z;
        }

        if (min_pos_view.z > max_pos_view.z) return {origin, size};

        let P = camera.projectionMatrix;
        let min_pos_proj = new Vector4(min_pos_view.x, min_pos_view.y, min_pos_view.z, 1.0);
        min_pos_proj.applyMatrix4(P);
        min_pos_proj.multiplyScalar(1.0/min_pos_proj.w);
        
        let max_pos_proj = new Vector4(max_pos_view.x, max_pos_view.y, min_pos_view.z, 1.0);
        max_pos_proj.applyMatrix4(P);
        max_pos_proj.multiplyScalar(1.0/max_pos_proj.w);

        let min_pos_proj2 = new Vector4(min_pos_view.x, min_pos_view.y, max_pos_view.z, 1.0);
        min_pos_proj2.applyMatrix4(P);
        min_pos_proj2.multiplyScalar(1.0/min_pos_proj2.w);
        
        let max_pos_proj2 = new Vector4(max_pos_view.x, max_pos_view.y, max_pos_view.z, 1.0);
        max_pos_proj2.applyMatrix4(P);
        max_pos_proj2.multiplyScalar(1.0/max_pos_proj2.w);

        let min_proj = new Vector2(Math.min( min_pos_proj.x, min_pos_proj2.x), Math.min( min_pos_proj.y, min_pos_proj2.y));
        let max_proj = new Vector2(Math.max( max_pos_proj.x, max_pos_proj2.x), Math.max( max_pos_proj.y, max_pos_proj2.y));

        if (min_proj.x < -1.0) min_proj.x = -1.0
        if (min_proj.y < -1.0) min_proj.y = -1.0;
        if (max_proj.x > 1.0) max_proj.x = 1.0;
        if (max_proj.y > 1.0) max_proj.y = 1.0;

        if (min_proj.x > max_proj.x || min_proj.y > max_proj.y) return {origin, size};

        let min_screen = new Vector2( (min_proj.x  + 1.0) *0.5 * width, (min_proj.y  + 1.0) *0.5 * height);
        let max_screen = new Vector2( (max_proj.x  + 1.0) *0.5 * width, (max_proj.y  + 1.0) *0.5 * height);

        origin.x = Math.round(min_screen.x);
        origin.y = Math.round(min_screen.y);

        size.x = Math.round(max_screen.x) - origin.x;
        size.y = Math.round(max_screen.y) - origin.y;

        return {origin, size};

    }

    const render = () =>{
        controls.update();
        if (canvas_ctx.resized)
        {            
            camera.aspect = canvas.width/canvas.height;
            camera.updateProjectionMatrix();
            canvas_ctx.resized = false;
        }
        camera.updateWorldMatrix(false, false);
        camera.updateConstant();

        let colorTexture = canvas_ctx.context.getCurrentTexture();
        let colorTextureView = colorTexture.createView({ format: canvas_ctx.view_format});

        let colorAttachment =  {
            view: colorTextureView,
            clearValue: { r: 0.6, g: 0.6, b: 0.8, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
        };

        let depthAttachment = {
            view: canvas_ctx.depthTextureView,
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'discard',                  
        };

        let renderPassDesc = {
            colorAttachments: [colorAttachment],
            depthStencilAttachment: depthAttachment
        }; 

        let {origin, size} = calc_scissor(camera, volModel, canvas.width, canvas.height);

        let commandEncoder = engine_ctx.device.createCommandEncoder();

        let passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, camera.bind_group);
        passEncoder.setBindGroup(1, volModel.bind_group);
        passEncoder.setViewport(
            0,
            0,
            canvas.width,
            canvas.height,
            0,
            1
        );
        passEncoder.setScissorRect(
            origin.x,
            origin.y,
            size.x,
            size.y
        );

        passEncoder.draw(3, 1);    
        
        passEncoder.end();

        let cmdBuf = commandEncoder.finish();

        engine_ctx.queue.submit([cmdBuf]);
        requestAnimationFrame(render);
        
    };
    
    render();
    
}



