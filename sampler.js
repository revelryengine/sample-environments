import { parseHDR          } from './hdrpng.js';
import { write as writeKTX } from 'https://cdn.skypack.dev/ktx-parse';
import { VK_FORMATS } from './constants.js';

const fullscreenVert = /* wgsl */ `
    struct VertexInput {
        [[builtin(vertex_index)]]   vertexID: u32;
        [[builtin(instance_index)]] instanceID: u32;
    };

    struct VertexOutput {
        [[builtin(position)]] position: vec4<f32>;
        [[location(0)]] texCoord: vec2<f32>;
        [[location(1)]] instanceID: u32;
    };

    [[stage(vertex)]]
    fn vs_main(in: VertexInput) -> VertexOutput {
        var x = f32((in.vertexID & 1u) << 2u);
        var y = f32((in.vertexID & 2u) << 1u);

        var out : VertexOutput;
        out.texCoord = vec2<f32>(x * 0.5, y * 0.5);
        out.position = vec4<f32>(x - 1.0, 1.0 - y, 0.0, 1.0);
        out.instanceID = in.instanceID;
        return out;
    }
`;

const downsampleFrag = /* wgsl */`
    [[group(0), binding(0)]] var colorSampler: sampler;
    [[group(0), binding(1)]] var colorTexture: texture_2d<f32>;

    struct VertexOutput {
        [[builtin(position)]] position: vec4<f32>;
        [[location(0)]] texCoord: vec2<f32>;
        [[location(1)]] instanceID: u32;
    };

    struct FragmentOutput {
        [[location(0)]] color: vec4<f32>;
    };

    [[stage(fragment)]]
    fn fs_main(in: VertexOutput) -> FragmentOutput {
        var out: FragmentOutput;
        out.color = textureSample(colorTexture, colorSampler, in.texCoord);
        return out;
    }
`;

const panoramaToCubemapFrag = /* wgsl */ `
    ${fullscreenVert}
    
    [[group(0), binding(0)]] var panoramaSampler: sampler;
    [[group(0), binding(1)]] var panoramaTexture: texture_2d<f32>;

    fn uvToXYZ(face: u32, uv: vec2<f32>) -> vec3<f32> {
        if(face == 0u) {
            return vec3<f32>(    1.0,  uv.y, -uv.x);
        } elseif(face == 1u) {
            return vec3<f32>(   -1.0,  uv.y,  uv.x);
        } elseif(face == 2u) {
            return vec3<f32>(   uv.x,  -1.0,  uv.y);
        } elseif(face == 3u) {
            return vec3<f32>(   uv.x,   1.0, -uv.y);
        } elseif(face == 4u) {
            return vec3<f32>(   uv.x,  uv.y,   1.0);
        } elseif(face == 5u) {
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

    fn panoramaToCubemap(face: u32, texCoord: vec2<f32>) -> vec3<f32> {
        var scan      = uvToXYZ(face, texCoord * 2.0 - 1.0);
        var direction = normalize(scan);
        var src       = dirToUV(direction);

        return textureSample(panoramaTexture, panoramaSampler, src).rgb;
    }

    [[stage(fragment)]]
    fn fs_main(in: VertexOutput) -> [[location(0)]] vec4<f32> {
        return vec4<f32>(panoramaToCubemap(in.instanceID, in.texCoord), 1.0); 
    }
`;

export class EnvironmentSampler {
    constructor({ width = 512, height = 512, format = 'VK_FORMAT_R8G8B8_UNORM' } = {}){
        this.width  = width;
        this.height = height;
        this.format = format;

        this.bytesPerElement = VK_FORMATS[this.format].TypedArray.BYTES_PER_ELEMENT;
        this.gpuFormat       = VK_FORMATS[this.format].gpuFormat;
    }

    async init() {
        const { width, height, bytesPerElement, gpuFormat } = this;

        this.adapter = await navigator.gpu.requestAdapter();
        this.device  = await this.adapter?.requestDevice();

        this.cubemapBuffer = this.device.createBuffer({
            size: width * height * 6 * 4 * bytesPerElement,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        this.cubemapTexture = this.device.createTexture({
            size: { width, height, depthOrArrayLayers: 6 },
            dimension: '2d',
            format: gpuFormat,
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
                module: this.device.createShaderModule({ code: fullscreenVert }),
                entryPoint: 'vs_main',
            },
            fragment: {
                module: this.device.createShaderModule({ code: downsampleFrag }),
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
                module: this.device.createShaderModule({ code: fullscreenVert }),
                entryPoint: 'vs_main',
            },
            fragment: {
                module: this.device.createShaderModule({ code: panoramaToCubemapFrag }),
                entryPoint: 'fs_main',
                targets: [
                    { format: gpuFormat },
                ],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });
    }

    async loadHDR(hdrBuffer) {
        const { data, width, height } = parseHDR(new Uint8Array(hdrBuffer));

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
                loadValue: [0, 0, 0, 0],
                storeOp: 'store',
            }],
        });

        renderEncoder.setPipeline(this.downsamplePipeline);
        renderEncoder.setBindGroup(0, bindGroup);
        renderEncoder.draw(3, 1, 0, 0);
        renderEncoder.endPass();

        this.device.queue.submit([commandEncoder.finish()]);

        return { sampler, texture: texture16, data, width, height };
    }

    async convertPanoramaToCubemap(hdr) {
        const { sampler, texture } = hdr;

        const { width, height, bytesPerElement } = this;

        const bytesPerRow   = width * 4 * bytesPerElement;
        const bytesPerLayer = bytesPerRow * height;

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
                    loadValue: [0, 0, 0, 0],
                    storeOp: 'store',
                }],
            });
            renderEncoder.setPipeline(this.panoramaToCubemapPipeline);
            renderEncoder.setBindGroup(0, bindGroup);
            renderEncoder.draw(3, 1, 0, i);
            renderEncoder.endPass();
        }

        commandEncoder.copyTextureToBuffer(
            { texture: this.cubemapTexture },
            { buffer: this.cubemapBuffer, bytesPerRow, rowsPerImage: height },
            { width, height, depthOrArrayLayers: 6 }
        );

        this.device.queue.submit([commandEncoder.finish()]);

        await this.cubemapBuffer.mapAsync(GPUMapMode.READ);

        const cubemapBuffer = this.cubemapBuffer.getMappedRange();

        const { TypedArray } = VK_FORMATS[this.format];
        
        const data = [];
        for (let i = 0; i < 6; i++) {
            //strip alpha component
            const view = new TypedArray(cubemapBuffer, i * bytesPerLayer, width * height * 4);
            data[i]    = new Uint8Array(TypedArray.from(view.filter((_,i) => !((i + 1) % 4 === 0))).buffer);
        }

        this.cubemapBuffer.unmap();
        return { data, width, height, hdr };
    }

    async sample(hdrBuffer) {
        const hdr = await this.loadHDR(hdrBuffer);
    
        const { data, width, height } = await this.convertPanoramaToCubemap(hdr);

        const uncompressedByteLength = data[0].byteLength * 6;
        const levels = [{
            levelData: new Uint8Array(uncompressedByteLength),
            uncompressedByteLength
        }];

        for(let i = 0; i < data.length; i++) {
            levels[0].levelData.set(data[i], i * data[i].byteLength, data[i].byteLength);
        }
        
        const { vkFormat, dataFormatDescriptor } = VK_FORMATS[this.format];

        return { hdr, ktxFile: writeKTX({
            vkFormat,
            typeSize: 1,
            pixelWidth: width,
            pixelHeight: height,
            pixelDepth: 0,
            layerCount: 0,
            faceCount: 6,
            supercompressionScheme: 0,
            levels,
            dataFormatDescriptor,
        }) }
    }
}