import { dlopen } from "node:ffi";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getSystemErrorMessage } from "node:util";

const libraryNames = {
	arm: "libspi-armhf.so",
	arm64: "libspi-aarch64.so",
	x64: "libspi-x64.so",
} as const;

const MAX_TRANSFER_LENGTH = 0x7fffffff;

type SupportedArchitecture = keyof typeof libraryNames;

interface SpiFunctions {
	spi_open(device: string): number;
	spi_get_last_error(): number;
	spi_close(fd: number): void;
	spi_set_mode(fd: number, mode: number): number;
	spi_set_speed(fd: number, speed: number): number;
	spi_set_bits_per_word(fd: number, bits: number): number;
	spi_transfer(fd: number, tx: Buffer, rx: Buffer, length: number): number;
	spi_transfer_multiple(
		fd: number,
		tx: Buffer,
		rx: Buffer,
		lengths: Buffer,
		count: number,
	): number;
	spi_write(fd: number, data: Buffer, length: number): number;
	spi_read(fd: number, data: Buffer, length: number): number;
}

const isSupportedArchitecture = (architecture: string): architecture is SupportedArchitecture =>
	architecture in libraryNames;

const nativeLibrary = process.platform === "linux" && isSupportedArchitecture(process.arch)
	? dlopen(join(
		dirname(fileURLToPath(import.meta.url)),
		"spi_bindings",
		"libs",
		libraryNames[process.arch],
	), {
		spi_open: { arguments: ["string"], return: "i32" },
		spi_get_last_error: { arguments: [], return: "i32" },
		spi_close: { arguments: ["i32"], return: "void" },
		spi_set_mode: { arguments: ["i32", "u32"], return: "i32" },
		spi_set_speed: { arguments: ["i32", "u32"], return: "i32" },
		spi_set_bits_per_word: { arguments: ["i32", "u8"], return: "i32" },
		spi_transfer: { arguments: ["i32", "buffer", "buffer", "i32"], return: "i32" },
		spi_transfer_multiple: {
			arguments: ["i32", "buffer", "buffer", "buffer", "u32"],
			return: "i32",
		},
		spi_write: { arguments: ["i32", "buffer", "u32"], return: "i32" },
		spi_read: { arguments: ["i32", "buffer", "u32"], return: "i32" },
	})
	: undefined;

const lib = nativeLibrary?.functions as SpiFunctions | undefined;

const nativeError = (message: string): Error => {
	const errorNumber = lib?.spi_get_last_error() ?? 0;
	if (!errorNumber) return new Error(message);

	return new Error(`${message}: ${getSystemErrorMessage(-errorNumber)} (errno ${errorNumber}).`);
};

export const SPI_MODES = {
	MODE_0: 0b00,
	MODE_1: 0b01,
	MODE_2: 0b10,
	MODE_3: 0b11,
} as const;

export const SPI_MODE_FLAGS = {
	CS_HIGH: 1 << 2,
	LSB_FIRST: 1 << 3,
	THREE_WIRE: 1 << 4,
	LOOP: 1 << 5,
	NO_CS: 1 << 6,
	READY: 1 << 7,
	TX_DUAL: 1 << 8,
	TX_QUAD: 1 << 9,
	RX_DUAL: 1 << 10,
	RX_QUAD: 1 << 11,
	CS_WORD: 1 << 12,
	TX_OCTAL: 1 << 13,
	RX_OCTAL: 1 << 14,
	THREE_WIRE_HIZ: 1 << 15,
	RX_CPHA_FLIP: 1 << 16,
	MOSI_IDLE_LOW: 1 << 17,
} as const;

export const SPI_MODE_PRESETS = {
	MODE_0_MSB: SPI_MODES.MODE_0,
	MODE_1_MSB: SPI_MODES.MODE_1,
	MODE_2_MSB: SPI_MODES.MODE_2,
	MODE_3_MSB: SPI_MODES.MODE_3,
	MODE_0_LSB: SPI_MODES.MODE_0 | SPI_MODE_FLAGS.LSB_FIRST,
	MODE_1_LSB: SPI_MODES.MODE_1 | SPI_MODE_FLAGS.LSB_FIRST,
	MODE_2_LSB: SPI_MODES.MODE_2 | SPI_MODE_FLAGS.LSB_FIRST,
	MODE_3_LSB: SPI_MODES.MODE_3 | SPI_MODE_FLAGS.LSB_FIRST,
} as const;

export interface SPI_settings {
	mode?: number;
	speed?: number;
	bits?: number;
	path?: string;
}

export class SPIdevice {
	private static readonly usedDevices = new Set<string>();

	private device = "";
	private deviceId = -1;
	private settings: Required<Omit<SPI_settings, "path">> = {
		mode: SPI_MODES.MODE_0,
		speed: 500_000,
		bits: 8,
	};

	static list(): string[] {
		if (process.platform !== "linux") return [];

		return readdirSync("/dev")
			.filter(file => file.startsWith("spidev"))
			.map(file => `/dev/${file}`);
	}

	constructor(settings: SPI_settings = {}) {
		if (!lib)
			throw new Error(`SPI FFI is not supported on ${process.platform}/${process.arch}.`);

		const { path, ...configuration } = settings;
		const selectedDevice = path ?? SPIdevice.list()
			.find(device => !SPIdevice.usedDevices.has(device));

		if (!selectedDevice) throw new Error("No available SPI devices found.");

		const initialSettings = { ...this.settings, ...configuration };
		this.device = selectedDevice;
		this.deviceId = lib.spi_open(selectedDevice);

		if (this.deviceId < 0) throw nativeError(`Failed to open SPI device ${selectedDevice}`);

		try {
			this.updateSettings(initialSettings);
		} catch (error) {
			lib.spi_close(this.deviceId);
			this.deviceId = -1;
			throw error;
		}

		SPIdevice.usedDevices.add(selectedDevice);
	}

	updateSettings(settings: Omit<SPI_settings, "path"> = this.settings): void {
		if (!lib || this.deviceId < 0) throw new Error("SPI device is closed.");

		if (settings.mode !== undefined) {
			if (lib.spi_set_mode(this.deviceId, settings.mode) < 0)
				throw nativeError(`Failed to set SPI mode ${settings.mode}`);
			this.settings.mode = settings.mode;
		}

		if (settings.speed !== undefined) {
			if (lib.spi_set_speed(this.deviceId, settings.speed) < 0)
				throw nativeError(`Failed to set SPI speed ${settings.speed} Hz`);
			this.settings.speed = settings.speed;
		}

		if (settings.bits !== undefined) {
			if (lib.spi_set_bits_per_word(this.deviceId, settings.bits) < 0)
				throw nativeError(`Failed to set ${settings.bits} bits per SPI word`);
			this.settings.bits = settings.bits;
		}
	}

	write(data: Buffer): number {
		if (!lib || this.deviceId < 0) throw new Error("SPI device is closed.");

		const written = lib.spi_write(this.deviceId, data, data.length);
		if (written < 0) throw nativeError("SPI write failed");

		return written;
	}

	read(length: number): Buffer {
		if (!lib || this.deviceId < 0) throw new Error("SPI device is closed.");

		const buffer = Buffer.alloc(length);
		const bytesRead = lib.spi_read(this.deviceId, buffer, length);
		if (bytesRead < 0) throw nativeError("SPI read failed");

		return buffer.subarray(0, bytesRead);
	}

	transfer(data: Buffer): Buffer {
		if (!lib || this.deviceId < 0) throw new Error("SPI device is closed.");

		const rx = Buffer.alloc(data.length);
		const transferred = lib.spi_transfer(this.deviceId, data, rx, data.length);
		if (transferred < 0) throw nativeError("SPI transfer failed");

		return rx.subarray(0, transferred);
	}

	transferMultiple(requests: Buffer[]): Buffer[] {
		if (!lib || this.deviceId < 0) throw new Error("SPI device is closed.");
		if (requests.length === 0) return [];

		const totalLength = requests.reduce((total, request) => total + request.length, 0);
		if (totalLength > MAX_TRANSFER_LENGTH)
			throw new RangeError(`SPI transaction exceeds ${MAX_TRANSFER_LENGTH} bytes.`);

		const lengths = Buffer.alloc(requests.length * Uint32Array.BYTES_PER_ELEMENT);
		for (let index = 0; index < requests.length; index++)
			lengths.writeUInt32LE(requests[index]!.length, index * Uint32Array.BYTES_PER_ELEMENT);

		const tx = Buffer.concat(requests, totalLength);
		const rx = Buffer.alloc(totalLength);
		const transferred = lib.spi_transfer_multiple(
			this.deviceId,
			tx,
			rx,
			lengths,
			requests.length,
		);

		if (transferred < 0) throw nativeError("SPI multi-transfer failed");
		if (transferred !== totalLength)
			throw new Error(`SPI multi-transfer completed ${transferred} of ${totalLength} bytes.`);

		let offset = 0;
		return requests.map(request => {
			const response = rx.subarray(offset, offset + request.length);
			offset += request.length;
			return response;
		});
	}

	close(): void {
		if (!lib || this.deviceId < 0) return;

		lib.spi_close(this.deviceId);
		this.deviceId = -1;
		SPIdevice.usedDevices.delete(this.device);
	}

	[Symbol.dispose](): void {
		this.close();
	}
}
