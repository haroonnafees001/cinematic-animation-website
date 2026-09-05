declare module 'mp4box' {
  export class DataStream {
    constructor(arrayBuffer?: ArrayBuffer, byteOffset?: number, endianness?: boolean);
    static BIG_ENDIAN: boolean;
    static LITTLE_ENDIAN: boolean;
    buffer: ArrayBuffer;
  }

  export interface MP4Sample {
    data: Uint8Array;
    dts: number;
    cts: number;
    duration: number;
    timescale: number;
    is_sync: boolean;
  }

  export interface MP4File {
    onReady?: (info: any) => void;
    onSamples?: (id: number, user: unknown, samples: MP4Sample[]) => void;
    onError?: (error: unknown) => void;
    appendBuffer(data: ArrayBuffer & { fileStart?: number }): void;
    flush(): void;
    start(): void;
    stop(): void;
    setExtractionOptions(id: number, user: unknown, options?: { nbSamples?: number }): void;
    getTrackById(id: number): any;
  }

  export function createFile(): MP4File;

  const MP4Box: {
    createFile: typeof createFile;
    DataStream: typeof DataStream;
  };

  export default MP4Box;
}
