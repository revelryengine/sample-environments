import { exists, ensureDir  } from 'https://deno.land/std/fs/mod.ts';
import { writeAll           } from 'https://deno.land/std@0.122.0/streams/conversion.ts';
import { EnvironmentSampler } from './sampler.js';

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
    // { name: 'rgb8unorm',      vkFormat: 'VK_FORMAT_R8G8B8_UNORM'     },
    // { name: 'rgb8unorm-srgb', vkFormat: 'VK_FORMAT_R8G8B8_SRGB'      },
    { name: 'rgb16float',     vkFormat: 'VK_FORMAT_R16G16B16_SFLOAT' },
];

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

async function generateGLTF(path, format) {
    const dest = `./${path}/${path}_${format}.gltf`;
    if(await exists(dest)){
        console.log('File already exists', dest);
        return;
    }
    console.log(`Generating ${dest}`);
    return Deno.writeTextFile(dest, template.replaceAll('${format}', format));
}

async function generateKTX(path, format, sampler) {
    const dest = `./${path}/specular_${format}.ktx2`;
    if(await exists(dest)){
        console.log('File already exists', dest);
        return;
    }
    console.log(`Generating ${dest}`);
    const { ktxFile } = await sampler.sample(await Deno.readFile(`./${path}/${path}.hdr`));
    return Deno.writeFile(dest, ktxFile)
}


await Promise.all(environments.map(async ({ name, path }) => {
    await ensureDir(`./${path}`);
    await Promise.all([
        downloadFile(`https://dl.polyhaven.com/file/ph-assets/HDRIs/hdr/2k/${path}_2k.hdr`, `./${path}/${path}.hdr`),
        downloadFile(`https://cdn.polyhaven.com/asset_img/primary/${path}.png?height=780`, `./${path}/${path}.png`),
        generateReadme(name, path),
    ]);
}));

const entries = [];
for (const format of formats) {
    const sampler = new EnvironmentSampler({ width: 512, height: 512, format: format.vkFormat });
    await sampler.init();
    for (const { name, path } of environments) {
        entries.push({ name, path, format });
        // We should do this sequentially to avoid overloading the GPU
        await generateKTX(path, format.name, sampler);
        await generateGLTF(path, format.name);
    }
}

console.log(`Generating ./index.js`);
const index = `function link(path, root = import.meta.url) { return new URL(path, root).toString(); }

export default [
${entries.map(({ name, path, format }) => 
`    { 
        name: '${name}', source: 'https://polyhaven.com/a/${path}', format: '${format.name}',
        gltf: link('./${path}/${path}_${format.name}.gltf'),
        screenshot: link('./${path}/${path}.png'),
    },`).join('\n')}
];`;

await Deno.writeTextFile(`./index.js`, index);







