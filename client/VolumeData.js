import { Vector3 } from "./math/Vector3.js"

export class VolumeData
{
    constructor()
    {
        this.texture = null;        
        this.size = new Vector3(0.0, 0.0, 0.0);
        this.spacing = new Vector3(0.001, 0.001, 0.001);
    }

    GetMinMax()
    {
        let dims = this.size.clone();
        dims.multiply(this.spacing);
        let min_pos = dims.clone();
        min_pos.multiplyScalar(0.5);
        let max_pos = min_pos.clone();
        min_pos.negate();
        return {min_pos, max_pos};
    }
}

