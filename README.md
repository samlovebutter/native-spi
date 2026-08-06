# ffi-spi

A synchronous Node.js wrapper around Linux SPI (`spidev`) using the built-in `node:ffi` API.

## Requirements

- Node.js 26.1 or newer;
- Linux `arm`, `arm64`, or `x64`;
- Node.js started with `--experimental-ffi`;
- user access to the required `/dev/spidev*` device.

## Running

```sh
npm run check
npm start
```

## Building native libraries

Building all supported architectures requires `gcc`,
`aarch64-linux-gnu-gcc`, and `arm-linux-gnueabihf-gcc`:

```sh
make
make verify
```

On Windows, run these commands inside WSL.

When the Node.js permission model is enabled, `--allow-ffi` is also required.

Native library paths are resolved relative to `index.ts`, so loading does not depend on the process working directory.

## Usage

The base mode and additional flags are combined into one bit field:

```ts
import { SPIdevice, SPI_MODE_FLAGS, SPI_MODE_PRESETS } from "./index.ts";

using spi = new SPIdevice({
	path: "/dev/spidev0.0",
	mode: SPI_MODE_PRESETS.MODE_1_LSB | SPI_MODE_FLAGS.CS_HIGH,
	speed: 1_000_000,
	bits: 8,
});

const response = spi.transfer(Buffer.from([0x9f, 0x00, 0x00, 0x00]));
```

A compound transaction accepts an array of requests and returns responses of the same sizes in the same order:

```ts
const responses = spi.transferMultiple([
	Buffer.from([0x9f]),
	Buffer.alloc(3),
]);
```

All segments are executed in one `SPI_IOC_MESSAGE`, without releasing CS between them.
