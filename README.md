# Revelry Engine Sample Environments

This repository is used to aggergate environment IBLs for demonstration purposes with the Revelry Engine GLTF Renderer.

The output format follows the [KHR_lights_environment](https://github.com/KhronosGroup/glTF/tree/KHR_lights_environment/extensions/2.0/Khronos/KHR_lights_environment) extension.

This script borrows concepts and shader logic from [KhronosGroup/glTF-Sample-Viewer](https://github.com/KhronosGroup/glTF-Sample-Viewer/blob/d0f2769/source/ibl_sampler.js)

### To generate environment IBLs and index

### Prequisites

- deno

##### Generate KTX2 textures and index

```
deno run -A --unstable generate.js
```
