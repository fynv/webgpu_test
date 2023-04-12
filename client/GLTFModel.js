import {Object3D} from "./core/Object3D.js"

export class GLTFModel extends Object3D
{
    constructor()
    {
        super();
        this.meshes = [];
    }

    updateMeshConstants()
    {
        for (let mesh of this.meshes)
        {
            let matrix = this.matrixWorld;
            let normMatrix = matrix.clone();
            normMatrix.invert();
            normMatrix.transpose();
            const uniform = new Float32Array(16*2);
            for (let i=0; i<16; i++)
            {
                uniform[i] = matrix.elements[i];
            }
            for (let i=0; i<16; i++)
            {
                uniform[16+i] = normMatrix.elements[i];
            }            
            engine_ctx.queue.writeBuffer(mesh.model_constant, 0, uniform.buffer, uniform.byteOffset, uniform.byteLength);
        }
    }

    
}

