import { EngineContext } from "./EngineContext.js"
import { CanvasContext } from "./CanvasContext.js"
import { GLTFLoader } from "./GLTFLoader.js"
import { PerspectiveCameraEx } from "./PerspectiveCameraEx.js"
import { OrbitControls } from "./controls/OrbitControls.js"

export async function test()
{
    const canvas = document.getElementById('gfx');
    canvas.width = 640;
    canvas.height = 640;

    const engine_ctx = new EngineContext();
    const canvas_ctx = new CanvasContext(canvas);
    await canvas_ctx.initialize();

    let loader = new GLTFLoader();
    let model = await loader.load("shaderBall.glb");
    model.translateY(-1.0);
    model.rotateY(-Math.PI * 0.5);
    model.rotateX(-Math.PI * 0.5);
    model.updateWorldMatrix(false, false);
    model.updateMeshConstants();   

    let camera = new PerspectiveCameraEx(45.0, canvas.width/canvas.height, 0.1, 100.0);
    camera.position.set(1.0, 2.0, 5.0);    

    let controls = new OrbitControls(camera, canvas);    
    controls.target.set(0.0, 0.0, 0.0); 
    controls.enableDamping = true;    

    const pipelineLayoutDesc = { bindGroupLayouts: [engine_ctx.cache.bindGroupLayouts.camera, engine_ctx.cache.bindGroupLayouts.model] };
    const layout = engine_ctx.device.createPipelineLayout(pipelineLayoutDesc);
    
    let vertModule = engine_ctx.device.createShaderModule({
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
    modelMat: mat4x4f,
    normalMat: mat4x4f
};

@group(1) @binding(0)
var<uniform> uModel: Model;

struct VSOut 
{
    @builtin(position) Position: vec4<f32>,
    @location(0) norm: vec3<f32>,
    @location(1) worldPos: vec3<f32>,
};

@vertex
fn main(@location(0) aPos: vec3<f32>,
        @location(1) aNorm: vec3<f32>) -> VSOut 
{
    var vsOut: VSOut;
    let world_pos = uModel.modelMat * vec4(aPos, 1.0);
    vsOut.Position = uCamera.projMat * (uCamera.viewMat * world_pos);
    vsOut.worldPos = world_pos.xyz;
    let world_norm = uModel.normalMat * vec4(aNorm, 0.0);
    vsOut.norm = world_norm.xyz;
    return vsOut;
}`
    });

    let fragModule = engine_ctx.device.createShaderModule({
        code: `
@fragment      
fn main(@location(0) vNorm: vec3<f32>, @location(1) vWorldPos: vec3<f32>) -> @location(0) vec4<f32> 
{
    let k = vNorm.y * 0.5 + 0.5;    
    let col = mix(vec3<f32>(0.1, 0.1, 0.1), vec3<f32>(0.6, 0.6, 0.8), k);
    return vec4<f32>(col, 1.0);
}`     
    });

    const positionAttribDesc = {
        shaderLocation: 0, // [[attribute(0)]]
        offset: 0,
        format: 'float32x3'
    };

    const normalAttribDesc = {
        shaderLocation: 1, // [[attribute(1)]]
        offset: 0,
        format: 'float32x3'
    };

    const positionBufferDesc = {
        attributes: [positionAttribDesc],
        arrayStride: 4 * 3, // sizeof(float) * 3
        stepMode: 'vertex'
    };

    const normalBufferDesc = {
        attributes: [normalAttribDesc],
        arrayStride: 4 * 3, // sizeof(float) * 3
        stepMode: 'vertex'
    };

    const depthStencil = {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth32float'
    };

    const vertex = {
        module: vertModule,
        entryPoint: 'main',
        buffers: [positionBufferDesc, normalBufferDesc]
    };

    const colorState = {
        format: 'bgra8unorm-srgb',
        writeMask: GPUColorWrite.ALL
    };

    const fragment = {
        module: fragModule,
        entryPoint: 'main',
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

    const render = () =>{
        controls.update();
        camera.updateConstant();

        let colorTexture = canvas_ctx.context.getCurrentTexture();
        let colorTextureView = colorTexture.createView({ format: "bgra8unorm-srgb"});

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

        let commandEncoder = engine_ctx.device.createCommandEncoder();

        let passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, camera.bind_group);        
        passEncoder.setViewport(
            0,
            0,
            canvas.width,
            canvas.height,
            0,
            1
        );
        passEncoder.setScissorRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        let index_type_map = {"ubyte": 'uint8', "ushort": 'uint16', "uint": 'uint32'};

        for (let mesh of model.meshes)
        {
            passEncoder.setBindGroup(1, mesh.model_bind_group);
            for (let prim of mesh.primitives)
            {
                passEncoder.setVertexBuffer(0, prim.pos_buf);
                passEncoder.setVertexBuffer(1, prim.norm_buf);
                if (prim.type_indices=="none")
                {
                    passEncoder.draw(prim.num_verts, 1);    
                }
                else
                {
                    passEncoder.setIndexBuffer(prim.index_buf, index_type_map[prim.type_indices]);
                    passEncoder.drawIndexed(prim.num_faces * 3, 1);
                }
            }
        }
      
        passEncoder.end();

        let cmdBuf = commandEncoder.finish();

        engine_ctx.queue.submit([cmdBuf]);
        requestAnimationFrame(render);

    };

    render();
}



