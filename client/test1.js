import { EngineContext } from "./EngineContext.js"
import { CanvasContext } from "./CanvasContext.js"

export async function test()
{
    const canvas = document.getElementById('gfx');
    canvas.width = 640;
    canvas.height = 640;

    const engine_ctx = new EngineContext();
    const canvas_ctx = new CanvasContext(canvas);
    await canvas_ctx.initialize();

    // initializeResources
    const positions = new Float32Array([
        1.0, -1.0, 0.0,
        -1.0, -1.0, 0.0,
        0.0,  1.0, 0.0
    ]);
    let positionBuffer = engine_ctx.createBuffer(positions.buffer, GPUBufferUsage.VERTEX);

    const colors = new Float32Array([
        1.0, 0.0, 0.0, // 🔴
        0.0, 1.0, 0.0, // 🟢
        0.0, 0.0, 1.0  // 🔵
    ]);
    let colorBuffer = engine_ctx.createBuffer(colors.buffer, GPUBufferUsage.VERTEX);

    const indices = new Uint16Array([ 0, 1, 2 ]);
    let indexBuffer = engine_ctx.createBuffer(indices.buffer, GPUBufferUsage.INDEX);

    const uniform = new Float32Array([1.0]);
    let uni_buf = engine_ctx.createBuffer(uniform.buffer, GPUBufferUsage.UNIFORM);

    let vertModule = engine_ctx.device.createShaderModule({
        code: `
struct VSOut 
{
    @builtin(position) Position: vec4<f32>,
    @location(0) color: vec3<f32>,
};

@vertex
fn main(@location(0) inPos: vec3<f32>,
        @location(1) inColor: vec3<f32>) -> VSOut 
{
    var vsOut: VSOut;
    vsOut.Position = vec4<f32>(inPos, 1.0);
    vsOut.color = inColor;
    return vsOut;
}`
    });

    let fragModule = engine_ctx.device.createShaderModule({
        code: `
@group(0) @binding(0)
var<uniform> k: f32;

@fragment
fn main(@location(0) inColor: vec3<f32>) -> @location(0) vec4<f32> 
{
    return vec4<f32>(inColor * k, 1.0);
}`                    
    });

    const positionAttribDesc = {
        shaderLocation: 0, // [[attribute(0)]]
        offset: 0,
        format: 'float32x3'
    };

    const colorAttribDesc = {
        shaderLocation: 1, // [[attribute(1)]]
        offset: 0,
        format: 'float32x3'
    };

    const positionBufferDesc = {
        attributes: [positionAttribDesc],
        arrayStride: 4 * 3, // sizeof(float) * 3
        stepMode: 'vertex'
    };

    const colorBufferDesc = {
        attributes: [colorAttribDesc],
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
        buffers: [positionBufferDesc, colorBufferDesc]
    };

    const colorState = {
        format: 'rgba8unorm-srgb',
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
        layout: 'auto',

        vertex,
        fragment,

        primitive,
        depthStencil
    };
    
    let pipeline = engine_ctx.device.createRenderPipeline(pipelineDesc); 
    
    const bind_group0 = engine_ctx.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource:{
                    buffer: uni_buf
                }
            }
        ]
    });

    const render = () =>{
        let colorTexture = canvas_ctx.context.getCurrentTexture();
        let colorTextureView = colorTexture.createView({ format: "rgba8unorm-srgb"});

        let colorAttachment =  {
            view: colorTextureView,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
        };

        let depthAttachment = {
            view: canvas_ctx.depthTextureView,
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',                  
        };

        let renderPassDesc = {
            colorAttachments: [colorAttachment],
            depthStencilAttachment: depthAttachment
        }; 

        let commandEncoder = engine_ctx.device.createCommandEncoder();

        let passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bind_group0);
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
        passEncoder.setVertexBuffer(0, positionBuffer);
        passEncoder.setVertexBuffer(1, colorBuffer);
        passEncoder.setIndexBuffer(indexBuffer, 'uint16');
        passEncoder.drawIndexed(3, 1);
        passEncoder.end();

        let cmdBuf = commandEncoder.finish();

        engine_ctx.queue.submit([cmdBuf]);
        requestAnimationFrame(render);
    };

    render();
    
}

