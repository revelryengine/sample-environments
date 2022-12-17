import { vec3 } from 'https://cdn.skypack.dev/gl-matrix';

export function rgbeToRGBA32(source){
    const length = source.byteLength >> 2;
    const result = new Float32Array(length * 4);

    for (let i = 0; i < length; i++) {
        const s = Math.pow(2, source[i * 4 + 3] - (128 + 8));

        result[i * 4 + 0] = source[i * 4 + 0] * s;
        result[i * 4 + 1] = source[i * 4 + 1] * s;
        result[i * 4 + 2] = source[i * 4 + 2] * s;
        result[i * 4 + 3] = 1;
    }
    return result;
}

/**
 * Adapted from https://stackoverflow.com/questions/41532085/how-to-pack-unpack-11-and-10-bit-floats-in-javascript-for-webgl2
 */
const to11uf = (function () {
    const F11_EXPONENT_BITS  = 0x1F;
    const F11_EXPONENT_SHIFT = 6;
    const F11_EXPONENT_BIAS  = 15;
    const F11_MANTISSA_BITS  = 0x3f;
    const F11_MANTISSA_SHIFT = (23 - F11_EXPONENT_SHIFT);
    const F11_MAX_EXPONENT   = (F11_EXPONENT_BITS << F11_EXPONENT_SHIFT);

    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);

    return function (val) {
        floatView[0] = val;
        let f32 = int32View[0];
        let f11 = 0;
        /* Decode IEEE 754 little-endian 32-bit floating-point value */
        if (f32 & 0x80000000) {
            // negative values go to 0
            return 0;
        }
        /* Map exponent to the range [-127,128] */
        let exponent = ((f32 >> 23) & 0xff) - 127;
        let mantissa = f32 & 0x007fffff;
        if (exponent == 128) {
            /* Infinity or NaN */
            f11 = F11_MAX_EXPONENT;
            if (mantissa) {
                f11 |= (mantissa & F11_MANTISSA_BITS);
            }
        } else if (exponent > 15) {
            /* Overflow - flush to Infinity */
            f11 = F11_MAX_EXPONENT;
        } else if (exponent > -15) {
            /* Representable value */
            exponent += F11_EXPONENT_BIAS;
            mantissa >>= F11_MANTISSA_SHIFT;
            f11 = exponent << F11_EXPONENT_SHIFT | mantissa;
        } else {
            f11 = 0;
        }
        return f11;
    }
})();

/**
 * Adapted from https://stackoverflow.com/questions/41532085/how-to-pack-unpack-11-and-10-bit-floats-in-javascript-for-webgl2
 */
const to10uf = (function to10uf() {
    const F10_EXPONENT_BITS  = 0x1F
    const F10_EXPONENT_SHIFT = 5
    const F10_EXPONENT_BIAS  = 15
    const F10_MANTISSA_BITS  = 0x1f
    const F10_MANTISSA_SHIFT = (23 - F10_EXPONENT_SHIFT)
    const F10_MAX_EXPONENT   = (F10_EXPONENT_BITS << F10_EXPONENT_SHIFT)

    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);

    return function (val) {
        floatView[0] = val;
        let f32 = int32View[0];
        let f10 = 0;
        /* Decode IEEE 754 little-endian 32-bit floating-point value */
        if (f32 & 0x80000000) {
            // negative values go to 0
            return 0;
        }
        /* Map exponent to the range [-127,128] */
        let exponent = ((f32 >> 23) & 0xff) - 127;
        let mantissa = f32 & 0x007fffff;
        if (exponent == 128) {
            /* Infinity or NaN */
            f10 = F10_MAX_EXPONENT;
            if (mantissa) {
                f10 |= (mantissa & F10_MANTISSA_BITS);
            }
        } else if (exponent > 15) {
            /* Overflow - flush to Infinity */
            f10 = F10_MAX_EXPONENT;
        } else if (exponent > -15) {
            /* Representable value */
            exponent += F10_EXPONENT_BIAS;
            mantissa >>= F10_MANTISSA_SHIFT;
            f10 = exponent << F10_EXPONENT_SHIFT | mantissa;
        } else {
            f10 = 0;
        }
        return f10;
    }
}());



function rgb101111(r, g, b) {
    return (to11uf(r) << 0) | (to11uf(g) << 11) | (to10uf(b) << 22);
}

export function rgba32ToB10G11R11(source) {
    return new Uint32Array(source.length / 4).map((_,i) => rgb101111(source[i * 4], source[i * 4 + 1], source[i * 4 + 2]));
}

/**
 * https://registry.khronos.org/OpenGL/extensions/EXT/EXT_texture_shared_exponent.txt
 */

function rgb9e5(red, green, blue) {
    const N = 9, Emax = 31, B = 15;
    const sharedexp_max = (2**N - 1) / 2**N * 2**(Emax - B);

    const red_c   = Math.max(0, Math.min(sharedexp_max, red));
    const green_c = Math.max(0, Math.min(sharedexp_max, green));
    const blue_c  = Math.max(0, Math.min(sharedexp_max, blue));
    const max_c   = Math.max(red_c, Math.max(green_c, blue_c));

    const exp_shared_p = Math.max(-B-1, Math.floor(Math.log2(max_c))) + 1 + B;
    const max_s        = Math.floor(max_c   / 2**(exp_shared_p - B - N) + 0.5)
    const exp_shared   = max_s === 2**N ? exp_shared_p + 1 : exp_shared_p;

    const red_s   = Math.floor(red_c   / 2**(exp_shared - B - N) + 0.5);
    const green_s = Math.floor(green_c / 2**(exp_shared - B - N) + 0.5);
    const blue_s  = Math.floor(blue_c  / 2**(exp_shared - B - N) + 0.5);

    return (red_s << 0) | (green_s << 9) | (blue_s << 18) | ((exp_shared | 0) << 27);
}

export function rgba32ToRGB9E5(source) {
    return new Uint32Array(source.length / 4).map((_,i) => rgb9e5(source[i * 4], source[i * 4 + 1], source[i * 4 + 2]));
}

export function deriveIrradianceCoefficients(data, size) {
    const coefficients = [...new Array(9)].map(() => new Float32Array(3));

    const texel = (x, y, f) => {
        const i = ((f * size * size) + ((size * y) + x)) * 4;
        return new Float32Array(data.buffer, data.byteOffset + (i * 4), 3);
    }

    const cubeCoord = (u, v, f) => {
        //+X, -X, +Y, -Y, +Z, -Z 
        let res;
        switch(f) {
            case 0:
                res = [ 1,-v,-u];
                break;
            case 1:
                res = [-1,-v, u];
                break;
            case 2:
                res = [ u, 1, v];
                break;
            case 3:
                res = [ u,-1,-v];
                break;
            case 4:
                res = [ u,-v, 1];
                break;
            case 5:
                res = [-u,-v,-1];
                break;
        }
        return vec3.normalize(res, res);
    }
    
    let weightSum = 0;
    for(let f = 0; f < 6; f++) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const u = ((x + 0.5) / size) * 2.0 - 1.0;
                const v = ((y + 0.5) / size) * 2.0 - 1.0;

                const temp   = 1.0 + u * u + v * v;
                const weight = 4.0 / (Math.sqrt(temp) * temp);
                // const weight = texelSolidAngle(x, y, size, size);

                const [dx, dy, dz] = cubeCoord(u, v, f);
                const color = texel(x, y, f);

                for(let c = 0; c < 3; c++) { //this is faster than vec3 methods
                    const value = color[c] * weight;

                    //band 0
                    coefficients[0][c] += value * 0.282095;

                    //band 1
                    coefficients[1][c] += value * 0.488603 * dy;
                    coefficients[2][c] += value * 0.488603 * dz;
                    coefficients[3][c] += value * 0.488603 * dx;

                    //band 2
                    coefficients[4][c] += value * 1.092548 * dx * dy;
                    coefficients[5][c] += value * 1.092548 * dy * dz;
                    coefficients[6][c] += value * 0.315392 * (3.0 * dz * dz - 1.0);
                    coefficients[7][c] += value * 1.092548 * dx * dz;
                    coefficients[8][c] += value * 0.546274 * (dx * dx - dy * dy);  
                }
                weightSum += weight;
            }
        }
    }

    for(let c = 0; c < 9; c++) {
        vec3.scale(coefficients[c], coefficients[c], 4 * Math.PI / weightSum);
    }

    return coefficients;
}


/**
 * Adapted from https://stackoverflow.com/questions/32633585/how-do-you-convert-to-half-floats-in-javascript
 */
const toHalf = (function () {
    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);

    /* This method is faster than the OpenEXR implementation (very often
        * used, eg. in Ogre), with the additional benefit of rounding, inspired
        * by James Tursa?s half-precision code. */
    return function (val) {

        floatView[0] = val;
        const x = int32View[0];

        let bits = (x >> 16) & 0x8000; /* Get the sign */
        let m = (x >> 12) & 0x07ff; /* Keep one extra bit for rounding */
        let e = (x >> 23) & 0xff; /* Using int is faster here */

        /* If zero, or denormal, or exponent underflows too much for a denormal
        * half, return signed zero. */
        if (e < 103) {
            return bits;
        }

        /* If NaN, return NaN. If Inf or exponent overflow, return Inf. */
        if (e > 142) {
            bits |= 0x7c00;
            /* If exponent was 0xff and one mantissa bit was set, it means NaN,
                    * not Inf, so make sure we set one mantissa bit too. */
            bits |= ((e == 255) ? 0 : 1) && (x & 0x007fffff);
            return bits;
        }

        /* If exponent underflows but not too much, return a denormal */
        if (e < 113) {
            m |= 0x0800;
            /* Extra rounding may overflow and set mantissa to 0 and exponent
                * to 1, which is OK. */
            bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
            return bits;
        }

        bits |= ((e - 112) << 10) | (m >> 1);
        /* Extra rounding. An overflow will set mantissa to 0 and increment
        * the exponent, which is OK. */
        bits += m & 1;
        return bits;
    };

}());

export function rgba32ToRGB16(source) {
    return Uint16Array.from(source.filter((_,i) => !((i + 1) % 4 === 0)).map(v => toHalf(v)));
}

function to8u(v) {
    return Math.max(0, Math.min(Math.round(v * 255), 255));
}

function linearToSRGB(v) {
    return (v < 0.0031308) ?  v * 12.92: Math.pow(v, 1 / 2.4) * 1.055 - 0.055;  
}

function to8uSRGB(v) {
    return to8u(linearToSRGB(v));
}

export function rgba32ToRGB8(source) {
    return Uint8Array.from(source.filter((_,i) => !((i + 1) % 4 === 0)).map(v => to8u(v)));
} 

export function rgba32ToSRGB8(source) {
    return Uint8Array.from(source.filter((_,i) => !((i + 1) % 4 === 0)).map(v => to8uSRGB(v)));
}  