import {Object3D} from "./core/Object3D.js"
import { VolumeData } from "./VolumeData.js"

export class VolumeIsosurfaceModel extends Object3D
{
    constructor(data)
    {
        super();
        this.data = data;
        this.isovalue = 0.4;  
        
        const const_size = (16*3 + 4*2 + 4)*4;
        this.constant = engine_ctx.createBuffer0(const_size, GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
        this.sampler = engine_ctx.device.createSampler({ magFilter: "linear", minFilter:"linear"});
        
        if (!("isosurface" in engine_ctx.cache.bindGroupLayouts))
        {
            engine_ctx.cache.bindGroupLayouts.isosurface = engine_ctx.device.createBindGroupLayout({
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.FRAGMENT,
                        buffer:{
                            type: "uniform"
                        }
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.FRAGMENT,
                        sampler:{}
                    },
                    {
                        binding: 2,
                        visibility: GPUShaderStage.FRAGMENT,
                        texture:{
                            viewDimension: "3d"
                        }
                    }
                ]
            });
        }
        
        const bindGroupLayout = engine_ctx.cache.bindGroupLayouts.isosurface;
        this.bind_group = engine_ctx.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource:{
                        buffer: this.constant
                    }
                },
                {
                    binding: 1,
                    resource: this.sampler
                },
                {
                    binding: 2,
                    resource: this.data.texture.createView()
                }
            ]
        });
    }
    
    updateConstant()
    {
        let matrixWorld = this.matrixWorld;
        let invModelMat = matrixWorld.clone();        
        invModelMat.invert();
        let NormalMat = invModelMat.clone();
        NormalMat.transpose();
        const uniform = new Float32Array(16*3 + 4*2 + 4);
        const iuniform = new Int32Array(uniform.buffer);
        for (let i=0; i<16; i++)
        {
            uniform[i] = invModelMat.elements[i];
        }
        for (let i=0; i<16; i++)
        {
            uniform[16+i] = matrixWorld.elements[i];
        }
        for (let i=0; i<16; i++)
        {
            uniform[32+i] = NormalMat.elements[i];
        }
        for (let i=0; i<3; i++)
        {
            iuniform[48+i] = this.data.size.getComponent(i);
        }
        for (let i=0; i<3; i++)
        {
            uniform[52+i] = this.data.spacing.getComponent(i);
        }
        uniform[56] = this.data.spacing.length()/2.0;
        uniform[57] = this.isovalue;
        engine_ctx.queue.writeBuffer(this.constant, 0, uniform.buffer, uniform.byteOffset, uniform.byteLength);
    }
}
