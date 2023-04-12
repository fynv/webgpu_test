import get_module from './tinygltf.js'
import {GLTFModel} from "./GLTFModel.js"
import {Mesh} from "./ModelComponents.js"

function decode_f32(heapu8, offset, size)
{
    let u8view= heapu8.subarray(offset, offset + size);
    let arrBuf = new ArrayBuffer(size);
    let u8view2 = new Uint8Array(arrBuf);
    u8view2.set(u8view);
    return new Float32Array(arrBuf);
}

function decode_i32(heapu8, offset, size)
{
    let u8view= heapu8.subarray(offset, offset + size);
    let arrBuf = new ArrayBuffer(size);
    let u8view2 = new Uint8Array(arrBuf);
    u8view2.set(u8view);
    return new Int32Array(arrBuf);
}

export class GLTFLoader
{
    constructor()
    {        
        this.tinygltf = null;        
    }

    async initialize()
    {
        if (this.tinygltf !=null) return;
        await engine_ctx.initialize();
        this.tinygltf = await get_module();
    }

    async load(url)
    {
        await this.initialize();
        let model_out = new GLTFModel();
        
        let res = await fetch(url);
        let blob = await res.blob();
        let arrBuf = await blob.arrayBuffer();
        let size = arrBuf.byteLength;

        let ptr = this.tinygltf.ccall("alloc", "number", ["number"], [size]);                                
        this.tinygltf.HEAPU8.set(new Uint8Array(arrBuf), ptr);
        let p_model = this.tinygltf.ccall("load_glb", "number", ["number", "number"], [ptr, size]);
        this.tinygltf.ccall("dealloc", null, ["number"], [ptr]);

        let bytes_map = {"ubyte": 1, "ushort": 2, "uint": 4};

        let num_meshes = this.tinygltf.ccall("model_number_of_meshes", "number", ["number"], [p_model]);
        for (let i=0; i<num_meshes; i++)
        {
            let p_mesh = this.tinygltf.ccall("model_get_mesh", "number", ["number", "number"], [p_model, i]);
            let num_prims = this.tinygltf.ccall("mesh_number_of_primitives", "number", ["number"], [p_mesh]);
            let mesh_out = new Mesh();       
            for (let j=0; j<num_prims; j++)
            {
                let p_prim = this.tinygltf.ccall("mesh_get_primitive", "number", ["number", "number"], [p_mesh, j]);                
                //let material_id = this.tinygltf.ccall("prim_material_id", "number", ["number"], [p_prim]);
                let num_verts = this.tinygltf.ccall("prim_number_of_vertices", "number", ["number", "number"], [p_model, p_prim]);
                let p_pos = this.tinygltf.ccall("prim_get_positions", "number", ["number", "number"], [p_model, p_prim]);
                let type_indices = this.tinygltf.ccall("prim_get_index_type", "string", ["number", "number"], [p_model, p_prim]);
                let num_faces = this.tinygltf.ccall("prim_get_num_faces", "number", ["number", "number"], [p_model, p_prim]);
                let p_norm = this.tinygltf.ccall("prim_get_normals", "number", ["number", "number"], [p_model, p_prim]);          
                
                let prim_out = {};
                prim_out.num_verts = num_verts;      
                prim_out.num_faces = num_faces;
                prim_out.type_indices = type_indices;
                prim_out.index_bytes = bytes_map[prim_out.type_indices];
                prim_out.pos_buf = engine_ctx.createBuffer(this.tinygltf.HEAPU8.buffer, GPUBufferUsage.VERTEX, p_pos, num_verts*4*3);
                prim_out.norm_buf = engine_ctx.createBuffer(this.tinygltf.HEAPU8.buffer, GPUBufferUsage.VERTEX, p_norm, num_verts*4*3);
                if (type_indices == "none")
                {
                    prim_out.index_buf = null;
                }
                else
                {
                    let p_indices = this.tinygltf.ccall("prim_get_indices", "number", ["number", "number"], [p_model, p_prim]);
                    prim_out.index_buf = engine_ctx.createBuffer(this.tinygltf.HEAPU8.buffer, GPUBufferUsage.INDEX, p_indices, num_faces*prim_out.index_bytes*3);                    
                }                
                mesh_out.primitives.push(prim_out);

            }
            model_out.meshes.push(mesh_out);
        }

        this.tinygltf.ccall("delete_model", null, ["number"], [p_model]);

        return model_out;

    }


}