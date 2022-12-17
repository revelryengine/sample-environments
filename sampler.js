import { parseHDR } from './hdrpng.js';
import { rgbeToRGBA32, deriveIrradianceCoefficients } from './utils.js';

const fullscreenVert = /* wgsl */`
    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) texCoord: vec2<f32>,
        @location(1) @interpolate(flat) texLayer: i32,
    };

    @vertex
    fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
        var vertexID = i32(VertexIndex);
        var id = vertexID % 3;
        var x  = f32(u32(id & 1) << 2u);
        var y  = f32(u32(id & 2) << 1u);

        var result : VertexOutput;
        result.texCoord = vec2<f32>(x * 0.5, y * 0.5);
        result.texLayer = i32((vertexID - (vertexID % 3)) / 3);

        result.position = vec4<f32>(x - 1.0, 1.0 - y, 1.0, 1.0);
        
        return result;
    }
`;

const downsampleFrag = /* wgsl */`
    @group(0) @binding(0) var colorSampler: sampler;
    @group(0) @binding(1) var colorTexture: texture_2d<f32>;

    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) texCoord: vec2<f32>,
        @location(1) @interpolate(flat) texLayer: i32,
    };

    struct FragmentOutput {
        @location(0) color: vec4<f32>,
    };

    @fragment
    fn fs_main(vertex: VertexOutput) -> FragmentOutput {
        var result: FragmentOutput;
        result.color = textureSample(colorTexture, colorSampler, vertex.texCoord);
        return result;
    }
`;

const panoramaToCubemapFrag = /* wgsl */ `
    ${fullscreenVert}
    
    @group(0) @binding(0) var panoramaSampler: sampler;
    @group(0) @binding(1) var panoramaTexture: texture_2d<f32>;

    fn uvToXYZ(face: i32, uv: vec2<f32>) -> vec3<f32> {
        if(face == 0) {
            return vec3<f32>(    1.0,  uv.y, -uv.x);
        } else if(face == 1) {
            return vec3<f32>(   -1.0,  uv.y,  uv.x);
        } else if(face == 2) {
            return vec3<f32>(   uv.x,  -1.0,  uv.y);
        } else if(face == 3) {
            return vec3<f32>(   uv.x,   1.0, -uv.y);
        } else if(face == 4) {
            return vec3<f32>(   uv.x,  uv.y,   1.0);
        } else if(face == 5) {
            return vec3<f32>(  -uv.x,  uv.y,  -1.0);
        }
        return vec3<f32>(0.0);
    }

    fn dirToUV(dir: vec3<f32>) -> vec2<f32> {
        return vec2<f32>(
            0.5 + 0.5 * atan2(dir.z, dir.x) / ${Math.PI},
            1.0 - acos(dir.y) / ${Math.PI}
        );
    }

    fn panoramaToCubemap(texCoord: vec2<f32>, face: i32) -> vec3<f32> {
        var scan      = uvToXYZ(face, texCoord * 2.0 - 1.0);
        var direction = normalize(scan);
        var src       = dirToUV(direction);

        return textureSample(panoramaTexture, panoramaSampler, src).rgb;
    }

    @fragment
    fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
        return vec4<f32>(panoramaToCubemap(in.texCoord, in.texLayer), 1.0); 
    }
`;

async function createShaderModule(device, code) {
    const module = device.createShaderModule({ code });
    // const info = await module.compilationInfo(); //not implemented yet in deno webgpu https://github.com/gfx-rs/wgpu/issues/2130
    // for(const msg of info.messages) {
    //     if(msg.type === 'error') {
    //         console.warn('Shader compilation error', `${msg.lineNum}:${msg.linePos} - ${msg.message}`);
    //         if(msg.src) console.warn(msg.src.split(`\n`).map((line, i) => `${i + 1}: ${line}`).join('\n'));
    //         return;
    //     }
    // }
    return module;
}

export class HDRISampler {
    constructor({ width = 512, height = 512 } = {}){
        this.width  = width;
        this.height = height;
        this.bytesPerElement = Float32Array.BYTES_PER_ELEMENT;
    }

    async init() {
        const { width, height, bytesPerElement } = this;

        this.adapter = await navigator.gpu.requestAdapter();
        this.device  = await this.adapter?.requestDevice();

        this.device.onuncapturederror = (event) => {
            console.error('A WebGPU error was not captured:', event.error);
        };

        this.cubemapBuffer = this.device.createBuffer({
            size: width * height * 6 * 4 * bytesPerElement,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        this.cubemapTexture = this.device.createTexture({
            size: { width, height, depthOrArrayLayers: 6 },
            dimension: '2d',
            format: 'rgba32float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });


        this.cubemapViews = [];
        for (let i = 0; i < 6; i++) {
            this.cubemapViews[i] = this.cubemapTexture.createView({ dimension: '2d', baseArrayLayer: i, arrayLayerCount: 1 });
        }

        this.downsampleLayout = this.device.createBindGroupLayout({
            entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {
                        type: 'non-filtering'
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: 'unfilterable-float'
                    },
                },
            ],
        });

        this.downsamplePipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.downsampleLayout],
            }),
            vertex: {
                module: await createShaderModule(this.device, fullscreenVert),
                entryPoint: 'vs_main',
            },
            fragment: {
                module: await createShaderModule(this.device, downsampleFrag),
                entryPoint: 'fs_main',
                targets: [
                    { format: 'rgba16float' },
                ],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });

        this.panoramaToCubemapLayout = this.device.createBindGroupLayout({
            entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {},
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
            ],
        });

        this.panoramaToCubemapPipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.panoramaToCubemapLayout],
            }),
            vertex: {
                module: await createShaderModule(this.device, fullscreenVert),
                entryPoint: 'vs_main',
            },
            fragment: {
                module: await createShaderModule(this.device, panoramaToCubemapFrag),
                entryPoint: 'fs_main',
                targets: [
                    { format: 'rgba32float' },
                ],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });
    }

    async loadHDR(hdrBuffer) {
        const { rgbe, width, height } = parseHDR(new Uint8Array(hdrBuffer));

        const data = rgbeToRGBA32(rgbe);

        const sampler   = this.device.createSampler({ minFilter: 'linear', magFilter: 'linear', });
        const texture32 = this.device.createTexture({
            size: { width, height },
            format: 'rgba32float',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        const texture16 = this.device.createTexture({
            size: { width, height },
            format: 'rgba16float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        this.device.queue.writeTexture({ texture: texture32 }, data, { offset: 0, bytesPerRow: width * 16, rowsPerImage: height }, { width, height });

        const bindGroup = this.device.createBindGroup({
            layout: this.downsamplePipeline.getBindGroupLayout(0),
            entries: [{
                    binding: 0,
                    resource: this.device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' }),
                },
                {
                    binding: 1,
                    resource: texture32.createView(),
                },
            ],
        })

        const commandEncoder = this.device.createCommandEncoder();

        //render texture32 to texture16 so that we can use linear sampler later
        const renderEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: texture16.createView(),
                clearValue: [0, 0, 0, 0],
                storeOp: 'store',
                loadOp: 'clear'
            }],
        });

        renderEncoder.setPipeline(this.downsamplePipeline);
        renderEncoder.setBindGroup(0, bindGroup);
        renderEncoder.draw(3, 1, 0, 0);
        renderEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);

        return { sampler, texture: texture16, data, width, height };
    }

    convertPanoramaToCubemap(hdr) {
        const { sampler, texture } = hdr;

        const { width, height, bytesPerElement } = this;

        const bytesPerRow = width * 4 * bytesPerElement;

        const bindGroup = this.device.createBindGroup({
            layout: this.panoramaToCubemapPipeline.getBindGroupLayout(0),
            entries: [{
                    binding: 0,
                    resource: sampler,
                },
                {
                    binding: 1,
                    resource: texture.createView({ dimension: '2d' }),
                },
            ],
        })

        const commandEncoder = this.device.createCommandEncoder();

        for (let i = 0; i < 6; i++) {
            const renderEncoder = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: this.cubemapViews[i],
                    clearValue: [0, 0, 0, 0],
                    storeOp: 'store',
                    loadOp: 'clear'
                }],
            });
            renderEncoder.setPipeline(this.panoramaToCubemapPipeline);
            renderEncoder.setBindGroup(0, bindGroup);
            renderEncoder.draw(3, 1, i * 3, 0);
            renderEncoder.end();
        }

        commandEncoder.copyTextureToBuffer(
            { texture: this.cubemapTexture },
            { buffer: this.cubemapBuffer, bytesPerRow, rowsPerImage: height },
            { width, height, depthOrArrayLayers: 6 }
        );

        this.device.queue.submit([commandEncoder.finish()]);
    }

    async sample(hdrBuffer) {
        const { width, height, bytesPerElement } = this;

        const hdr = await this.loadHDR(hdrBuffer);
        
        this.convertPanoramaToCubemap(hdr);

        await this.cubemapBuffer.mapAsync(GPUMapMode.READ);
        const sample     = new Float32Array(this.cubemapBuffer.getMappedRange());
        const irradiance = deriveIrradianceCoefficients(sample, width);

        this.cubemapBuffer.unmap();
   
        return { sample, irradiance };
    }
}