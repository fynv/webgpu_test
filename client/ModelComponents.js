export class Mesh
{
    constructor()
    {
        this.primitives = [];
        this.model_constant = engine_ctx.createBuffer0(4 * 16 + 4*16, GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);

        if (!("model" in engine_ctx.cache.bindGroupLayouts))
        {
            engine_ctx.cache.bindGroupLayouts.model = engine_ctx.device.createBindGroupLayout({
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.VERTEX,
                        buffer:{
                            type: "uniform"
                        }
                    }
                ]
            });
        }

        const bindGroupLayout = engine_ctx.cache.bindGroupLayouts.model;

        this.model_bind_group = engine_ctx.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource:{
                        buffer: this.model_constant
                    }
                }
            ]
        });
    }
}