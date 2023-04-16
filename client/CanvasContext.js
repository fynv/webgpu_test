export class CanvasContext
{
    constructor(canvas)
    {        
        this.canvas = canvas;
        this.context = null;
        this.depthTexture = null;
        this.depthTextureView = null;
        this.resized = false;
    }

    async initialize()
    {
        if (this.context!=null) return;
        await engine_ctx.initialize();

        this.context = this.canvas.getContext('webgpu');
        const canvasConfig = {
            device: engine_ctx.device,
            alphaMode: "opaque",
            format: 'rgba8unorm',
            viewFormats: ['rgba8unorm-srgb'],
            usage:  GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
        };
        this.context.configure(canvasConfig);
        this.resize();
    }

    resize()
    {
        const depthTextureDesc = {
            size: [this.canvas.width, this.canvas.height, 1],
            dimension: '2d',
            format: 'depth32float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
        };
        this.depthTexture = engine_ctx.device.createTexture(depthTextureDesc);
        this.depthTextureView = this.depthTexture.createView();
        this.resized = true;
    }
}
