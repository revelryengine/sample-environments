import { exists, ensureDir  } from 'https://deno.land/std/fs/mod.ts';
import { writeAll           } from 'https://deno.land/std@0.122.0/streams/conversion.ts';
import { write as writeKTX  } from 'https://cdn.skypack.dev/ktx-parse';
import { VK_FORMATS         } from './constants.js';
import { HDRISampler        } from './sampler.js';

const environments = [
    { name: 'Chinese Garden',     path: 'chinese_garden'    },
    { name: 'Fireplace',          path: 'fireplace'         },
    { name: 'Goegap',             path: 'goegap'            },
    { name: 'Green Sanctuary',    path: 'green_sanctuary'   },
    { name: 'Large Corridor',     path: 'large_corridor'    },
    { name: 'Leadenhall Market',  path: 'leadenhall_market' },
    { name: 'Lebombo',            path: 'lebombo'           },
    { name: 'Lilienstein',        path: 'lilienstein'       },
    { name: 'Music Hall 01',      path: 'music_hall_01'     },
    { name: 'Preller Drive',      path: 'preller_drive'     },
    { name: 'Quattro Canti',      path: 'quattro_canti'     },
    { name: 'Round Platform',     path: 'round_platform'    },
    { name: 'Royal Esplanade',    path: 'royal_esplanade'   },
    { name: 'Studio Small 02',    path: 'studio_small_02'   },
];

const formats = [
    { name: 'rgb8unorm',      vkFormat: 'VK_FORMAT_R8G8B8_UNORM'            },
    { name: 'rgb8unorm-srgb', vkFormat: 'VK_FORMAT_R8G8B8_SRGB'             },
    { name: 'rgb16float',     vkFormat: 'VK_FORMAT_R16G16B16_SFLOAT'        },
    { name: 'rgb9e5ufloat',   vkFormat: 'VK_FORMAT_E5B9G9R9_UFLOAT_PACK32'  },
    { name: 'rg11b10ufloat',  vkFormat: 'VK_FORMAT_B10G11R11_UFLOAT_PACK32' },
    //{ name: 'rgb16unorm',     vkFormat: 'VK_FORMAT_R16G16B16_UNORM'         }, not supported until webgpu supports it
];

const width = 512, height = 512;

const template = await Deno.readTextFile('./template.gltf');

async function downloadFile(url, dest) {
    if(await exists(dest)){
        console.log('File already exists', dest);
        return;
    }
    
    console.log('Downloading', url);
    const res    = await fetch(url);
    const file   = await Deno.open(dest, { create: true, write: true });
    for await(const chunk of res.body) {
        await writeAll(file, chunk);
    }
    file.close();
}

async function generateReadme(name, path) {
    const dest = `./${path}/README.md`;
    console.log(`Generating ${dest}`);
    const contents = `# ${name}

The image for this texture is provided by [polyhaven](https://polyhaven.com/a/${path}).

![image info](./${path}.png)`;

    await Deno.writeTextFile(dest, contents);
}

async function generateGLTF(path, format, irradiance) {
    let dest = `./${path}/${path}_${format.name}.gltf`;
    
    console.log(`Generating ${dest}`);

    const gltf = JSON.parse(template);
    gltf.extensions.KHR_lights_environment.images[0].uri = `specular_${format.name}.ktx2`;
    gltf.extensions.KHR_lights_environment.lights[0].irradianceCoefficients = irradiance.map(v => [...v]);
    await Deno.writeTextFile(dest, JSON.stringify(gltf, null, 2));
}

async function generateKTX(path, format, sample) {
    const dest = `./${path}/specular_${format.name}.ktx2`;
    console.log(`Generating ${dest}`);
    
    const { conversion, vkFormat, dataFormatDescriptor, typeSize } = VK_FORMATS[format.vkFormat];

    const bytesPerRow   = width * 4 * Float32Array.BYTES_PER_ELEMENT;
    const bytesPerLayer = bytesPerRow * height;

    const data = [];
    for (let i = 0; i < 6; i++) {
        const view = new Float32Array(sample.buffer, i * bytesPerLayer, width * height * 4);
        data[i] = conversion(view);
    }

    const uncompressedByteLength = data[0].byteLength * 6;
    const levels = [{
        levelData: new Uint8Array(uncompressedByteLength),
        uncompressedByteLength
    }];

    for(let i = 0; i < data.length; i++) {
        levels[0].levelData.set(data[i], i * data[i].byteLength, data[i].byteLength);
    }
    
    const ktxFile = writeKTX({
        vkFormat,
        typeSize,
        pixelWidth: width,
        pixelHeight: height,
        pixelDepth: 0,
        layerCount: 0,
        faceCount: 6,
        supercompressionScheme: 0,
        levels,
        dataFormatDescriptor,
    });
        

    await Deno.writeFile(dest, ktxFile);
}


await Promise.all(environments.map(async ({ name, path }) => {
    await ensureDir(`./${path}`);
    await Promise.all([
        downloadFile(`https://dl.polyhaven.com/file/ph-assets/HDRIs/hdr/2k/${path}_2k.hdr`, `./${path}/${path}.hdr`),
        downloadFile(`https://cdn.polyhaven.com/asset_img/primary/${path}.png?height=780`, `./${path}/${path}.png`),
        generateReadme(name, path),
    ]);
}));


const sampler = new HDRISampler({ width, height });
await sampler.init();

for (const { path } of environments) {
    // We should do this sequentially to avoid overloading the GPU
    const { sample, irradiance } = await sampler.sample(await Deno.readFile(`./${path}/${path}.hdr`));
    for (const format of formats) {
        const dest = `./${path}/specular_${format.name}.ktx2`;
        if(!await exists(dest)){
            await generateKTX(path, format, sample);
            await generateGLTF(path, format, irradiance);
        }
    }
}

console.log(`Generating ./index.js`);
const index = `function link(path, root = import.meta.url) { return new URL(path, root).toString(); }

export default [
${environments.map(({ name, path }) => 
`    { 
        name: '${name}', source: 'https://polyhaven.com/a/${path}',
        formats: {
${formats.map(({ name }) => `            '${name}': link('./${path}/${path}_${name}.gltf'),`).join('\n')}
        },
        screenshot: link('./${path}/${path}.png'),
    },`).join('\n')}
];`;

await Deno.writeTextFile(`./index.js`, index);







