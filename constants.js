const KHR_DF_PRIMARIES_BT709     = 1;
const KHR_DF_MODEL_RGBSDA        = 1;
const KHR_DF_TRANSFER_LINEAR     = 1;
const KHR_DF_TRANSFER_SRGB       = 2;

import { rgba32ToB10G11R11, rgba32ToRGB9E5, rgba32ToRGB16, rgba32ToRGB8, rgba32ToSRGB8 } from './utils.js';

export const VK_FORMATS = {
    VK_FORMAT_R8G8B8_UNORM : {
        conversion: (view) => new Uint8Array(rgba32ToRGB8(view).buffer),
        vkFormat: 23,
        typeSize: 1,
        dataFormatDescriptor: [
            {
                vendorId: 0,
                descriptorType: 0,
                versionNumber: 2,
                descriptorBlockSize: 72,
                colorModel:       KHR_DF_MODEL_RGBSDA,
                colorPrimaries:   KHR_DF_PRIMARIES_BT709,
                transferFunction: KHR_DF_TRANSFER_LINEAR,
                flags: 0,
                texelBlockDimension: [0, 0, 0, 0],
                bytesPlane: [
                    3, 0, 0, 0,
                    0, 0, 0, 0
                ],
                samples: [
                    {
                        bitOffset: 0,
                        bitLength: 7,
                        channelType: 0,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 255
                    },
                    {
                        bitOffset: 8,
                        bitLength: 7,
                        channelType: 1,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 255
                    },
                    {
                        bitOffset: 16,
                        bitLength: 7,
                        channelType: 2,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 255
                    }
                ]
            }
        ],
    },
    VK_FORMAT_R8G8B8_SRGB : {
        conversion: (view) => new Uint8Array(rgba32ToSRGB8(view).buffer),
        vkFormat: 29,
        typeSize: 1,
        dataFormatDescriptor: [
            {
                vendorId: 0,
                descriptorType: 0,
                versionNumber: 2,
                descriptorBlockSize: 72,
                colorModel:       KHR_DF_MODEL_RGBSDA,
                colorPrimaries:   KHR_DF_PRIMARIES_BT709,
                transferFunction: KHR_DF_TRANSFER_SRGB,
                flags: 0,
                texelBlockDimension:  [0, 0, 0, 0],
                bytesPlane: [
                    3, 0, 0, 0,
                    0, 0, 0, 0
                ],
                samples: [
                    {
                        bitOffset: 0,
                        bitLength: 7,
                        channelType: 0,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 255
                    },
                    {
                        bitOffset: 8,
                        bitLength: 7,
                        channelType: 1,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 255
                    },
                    {
                        bitOffset: 16,
                        bitLength: 7,
                        channelType: 2,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 255
                    }
                ]
            }
        ],
    },
    VK_FORMAT_R16G16B16_SFLOAT : {
        conversion: (view) => new Uint8Array(rgba32ToRGB16(view).buffer),
        vkFormat: 90,
        typeSize: 2,
        dataFormatDescriptor: [
            {
                vendorId: 0,
                descriptorType: 0,
                versionNumber: 2,
                descriptorBlockSize: 72,
                colorModel:       KHR_DF_MODEL_RGBSDA,
                colorPrimaries:   KHR_DF_PRIMARIES_BT709,
                transferFunction: KHR_DF_TRANSFER_LINEAR,
                flags: 0,
                texelBlockDimension:  [0, 0, 0, 0],
                bytesPlane: [
                    6, 0, 0, 0,
                    0, 0, 0, 0
                ],
                samples: [
                    {
                        bitOffset: 0,
                        bitLength: 15,
                        channelType: 0,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 65536
                    },
                    {
                        bitOffset: 16,
                        bitLength: 15,
                        channelType: 1,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 65536
                    },
                    {
                        bitOffset: 32,
                        bitLength: 15,
                        channelType: 2,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 65536
                    }
                ]
            }
        ],
    },
    VK_FORMAT_E5B9G9R9_UFLOAT_PACK32: {
        conversion: (view) => new Uint8Array(rgba32ToRGB9E5(view).buffer),
        vkFormat: 123,
        typeSize: 4,
        dataFormatDescriptor: [
            {
                vendorId: 0,
                descriptorType: 0,
                versionNumber: 2,
                descriptorBlockSize: 88,
                colorModel:       KHR_DF_MODEL_RGBSDA,
                colorPrimaries:   KHR_DF_PRIMARIES_BT709,
                transferFunction: KHR_DF_TRANSFER_LINEAR,
                flags: 0, 
                texelBlockDimension:  [0, 0, 0, 0],
                bytesPlane: [
                    4, 0, 0, 0,
                    0, 0, 0, 0
                ],
                samples: [
                    {
                        bitOffset: 0,
                        bitLength: 8,
                        channelType: 0,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 511
                    },
                    {
                        bitOffset: 9,
                        bitLength: 8,
                        channelType: 1,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 511
                    },
                    {
                        bitOffset: 18,
                        bitLength: 8,
                        channelType: 2,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 511
                    },
                    {
                        bitOffset: 27,
                        bitLength: 4,
                        channelType: 3,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 31
                    }
                ]
            }
        ],
    },
    VK_FORMAT_B10G11R11_UFLOAT_PACK32 : {
        conversion: (view) => new Uint8Array(rgba32ToB10G11R11(view).buffer),
        vkFormat: 122,
        dataFormatDescriptor: [
            {
                vendorId: 0,
                descriptorType: 0,
                versionNumber: 2,
                descriptorBlockSize: 72,
                colorModel:       KHR_DF_MODEL_RGBSDA,
                colorPrimaries:   KHR_DF_PRIMARIES_BT709,
                transferFunction: KHR_DF_TRANSFER_LINEAR,
                flags: 0,
                texelBlockDimension:  [0, 0, 0, 0],
                bytesPlane: [
                    4, 0, 0, 0,
                    0, 0, 0, 0
                ],
                samples: [
                    {
                        bitOffset: 0,
                        bitLength: 11,
                        channelType: 0,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 2047
                    },
                    {
                        bitOffset: 11,
                        bitLength: 11,
                        channelType: 1,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 2047
                    },
                    {
                        bitOffset: 22,
                        bitLength: 10,
                        channelType: 2,
                        samplePosition: [0, 0, 0, 0],
                        sampleLower: 0,
                        sampleUpper: 2047
                    }
                ]
            }
        ],
    },
}