export const VK_FORMATS = {
    VK_FORMAT_R8G8B8_UNORM : {
        TypedArray: Uint8Array,
        gpuFormat: 'rgba8unorm',
        vkFormat: 23,
        dataFormatDescriptor: [
            {
                vendorId: 0,
                descriptorType: 0,
                versionNumber: 2,
                descriptorBlockSize: 72,
                colorModel: 1,
                colorPrimaries: 1,
                transferFunction: 1,
                flags: 0,
                texelBlockDimension: { x: 1, y: 1, z: 1, w: 1 },
                bytesPlane: [
                    3, 0, 0, 0,
                    0, 0, 0, 0
                ],
                samples: [
                    {
                        bitOffset: 0,
                        bitLength: 7,
                        channelID: 0,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 255
                    },
                    {
                        bitOffset: 8,
                        bitLength: 7,
                        channelID: 1,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 255
                    },
                    {
                        bitOffset: 16,
                        bitLength: 7,
                        channelID: 2,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 255
                    }
                ]
            }
        ],
    },
    VK_FORMAT_R8G8B8_SRGB : {
        TypedArray: Uint8Array,
        gpuFormat: 'rgba8unorm-srgb',
        vkFormat: 29,
        dataFormatDescriptor: [
            {
                vendorId: 0,
                descriptorType: 0,
                versionNumber: 2,
                descriptorBlockSize: 72,
                colorModel: 1,
                colorPrimaries: 1,
                transferFunction: 2,
                flags: 0,
                texelBlockDimension: { x: 1, y: 1, z: 1, w: 1 },
                bytesPlane: [
                    3, 0, 0, 0,
                    0, 0, 0, 0
                ],
                samples: [
                    {
                        bitOffset: 0,
                        bitLength: 7,
                        channelID: 0,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 255
                    },
                    {
                        bitOffset: 8,
                        bitLength: 7,
                        channelID: 1,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 255
                    },
                    {
                        bitOffset: 16,
                        bitLength: 7,
                        channelID: 2,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 255
                    }
                ]
            }
        ],
    },
    VK_FORMAT_R16G16B16_SFLOAT : {
        TypedArray: Uint16Array,
        gpuFormat: 'rgba16float',
        vkFormat: 90,
        dataFormatDescriptor: [
            {
                vendorId: 0,
                descriptorType: 0,
                versionNumber: 2,
                descriptorBlockSize: 72,
                colorModel: 1,
                colorPrimaries: 1,
                transferFunction: 1,
                flags: 0,
                texelBlockDimension: { x: 1, y: 1, z: 1, w: 1 },
                bytesPlane: [
                    6, 0, 0, 0,
                    0, 0, 0, 0
                ],
                samples: [
                    {
                        bitOffset: 0,
                        bitLength: 15,
                        channelID: 0,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 65536
                    },
                    {
                        bitOffset: 16,
                        bitLength: 15,
                        channelID: 1,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 65536
                    },
                    {
                        bitOffset: 32,
                        bitLength: 15,
                        channelID: 2,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 65536
                    }
                ]
            }
        ],
    },
}