# devices

Emulated devices for the preview width picker: name, group (phones, foldables, tablets, laptops and displays), CSS width and height, device pixel ratio.

`data/devices.json` is generated from Chrome DevTools' emulated-device list (`front_end/models/emulation/EmulatedDevices.ts` in [ChromeDevTools/devtools-frontend](https://github.com/ChromeDevTools/devtools-frontend), BSD-3-Clause) and records the source URL and commit. `pnpm devices:import [ref]` regenerates it (network access required; the ref defaults to `main` and is resolved to a commit). The script reads the TypeScript source with the compiler API and accepts plain data only, so no upstream code is executed. Foldables get an extra "(unfolded)" entry from the spanned size. Devices narrower than the preview minimum (320px) are skipped at run time.

Review the diff after an import and commit it as `chore(devices): ...`.
