import { Vector3 } from "./math/Vector3.js"
import { VolumeData } from "./VolumeData.js"

export class VolumeDataLoader
{
    static async LoadRawVolumeFile(filename, size, spacing =  new Vector3(0.001, 0.001, 0.001))
    {  
        let res = await fetch("cthead.raw");
        let blob = await res.blob();
        let arrBuf = await blob.arrayBuffer();              
        
        let data = new VolumeData();
        data.size = size;
        data.spacing = spacing;
        data.texture = engine_ctx.device.createTexture({
            size: size,
            dimension: "3d",
            format: 'r8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });      
        
        engine_ctx.queue.writeTexture(
            { texture: data.texture },
            arrBuf,
            { bytesPerRow: size.x, rowsPerImage: size.y },
            { width: size.x, height: size.y, depthOrArrayLayers: size.z },
        );
        
        return data;
    }
}
