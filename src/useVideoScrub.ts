import { useEffect, useRef, useState } from 'react';
import MP4Box from 'mp4box';
import type { MP4Sample } from 'mp4box';

const LERP_TAU = 8;
const SNAP = 0.002;
const LRU_MAX = 24;
const LEAD = 24;
const WATCHDOG = 60000;

interface BankFrame {
  ts: number; // microseconds
  blob: Blob; // webp
}

interface ScrubState {
  bank: BankFrame[];
  lru: Map<number, ImageBitmap | null>;
  current: number; // seconds
  target: number; // seconds
  ready: boolean;
  reverted: boolean;
  painted: boolean;
  building: boolean;
  dur: number;
  span: number;
}

function nearestIndex(bank: BankFrame[], tUs: number): number {
  let lo = 0;
  let hi = bank.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bank[mid].ts < tUs) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(bank[lo - 1].ts - tUs) <= Math.abs(bank[lo].ts - tUs)) {
    return lo - 1;
  }
  return lo;
}

export function useVideoScrub(videoSrc: string) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [canvasLive, setCanvasLive] = useState(false);

  const state = useRef<ScrubState>({
    bank: [],
    lru: new Map<number, ImageBitmap | null>(),
    current: 0,
    target: 0,
    ready: false,
    reverted: false,
    painted: false,
    building: false,
    dur: 0,
    span: 1,
  });

  // Keep the scroll span fresh (recomputed on resize + orientationchange)
  useEffect(() => {
    const updateSpan = () => {
      const el = containerRef.current;
      if (el) {
        state.current.span = Math.max(1, el.offsetHeight - window.innerHeight);
      }
    };
    updateSpan();
    window.addEventListener('resize', updateSpan);
    window.addEventListener('orientationchange', updateSpan);
    return () => {
      window.removeEventListener('resize', updateSpan);
      window.removeEventListener('orientationchange', updateSpan);
    };
  }, []);

  // Video duration source of truth
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onMeta = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        state.current.dur = video.duration;
      }
    };
    if (video.readyState >= 1) onMeta();
    video.addEventListener('loadedmetadata', onMeta);
    return () => video.removeEventListener('loadedmetadata', onMeta);
  }, []);

  const getProgress = () => {
    const span = state.current.span > 0 ? state.current.span : 1;
    return Math.min(1, Math.max(0, window.scrollY / span));
  };

  const warmLRU = (i: number) => {
    const s = state.current;
    const from = Math.max(0, i - 1);
    const to = Math.min(s.bank.length - 1, i + 2);
    for (let j = from; j <= to; j++) {
      if (s.lru.has(j)) {
        // refresh recency
        const v = s.lru.get(j);
        s.lru.delete(j);
        s.lru.set(j, v ?? null);
      } else {
        s.lru.set(j, null);
        createImageBitmap(s.bank[j].blob)
          .then((bmp) => {
            if (s.lru.has(j)) {
              s.lru.delete(j);
              s.lru.set(j, bmp);
            } else {
              bmp.close();
            }
          })
          .catch(() => {
            s.lru.delete(j);
          });
      }
    }
    while (s.lru.size > LRU_MAX) {
      const oldest = s.lru.keys().next().value as number;
      const val = s.lru.get(oldest);
      if (val) val.close();
      s.lru.delete(oldest);
    }
  };

  const drawFrame = (tSeconds: number) => {
    const s = state.current;
    const canvas = canvasRef.current;
    if (!canvas || !s.ready || s.bank.length === 0) return;
    const i = nearestIndex(s.bank, tSeconds * 1e6);
    warmLRU(i);
    const bmp = s.lru.get(i);
    if (bmp) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      if (!s.painted) {
        s.painted = true;
        setCanvasLive(true);
      }
    }
  };

  // Main rAF loop: progress -> lerp -> draw / fallback seek
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = state.current;

      const p = getProgress();
      setScrollProgress(p);

      if (s.dur > 0) {
        s.target = p * s.dur;
        if (reduced) {
          s.current = s.target;
        } else {
          s.current += (s.target - s.current) * (1 - Math.exp(-dt * LERP_TAU));
          if (Math.abs(s.target - s.current) < SNAP) s.current = s.target;
        }

        if (s.ready && !s.reverted) {
          drawFrame(s.current);
        } else {
          const video = videoRef.current;
          if (video && !video.seeking && Math.abs(video.currentTime - s.current) > 0.01) {
            video.currentTime = s.current;
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Frame bank: decode the mp4 with WebCodecs into webp blobs
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof VideoDecoder === 'undefined') return;

    const s = state.current;
    let cancelled = false;
    let decoder: VideoDecoder | null = null;
    let watchdogId = 0;

    const revertToVideo = () => {
      if (cancelled) return;
      s.reverted = true;
      s.ready = false;
      s.bank = [];
      setCanvasLive(false);
      if (watchdogId) window.clearTimeout(watchdogId);
      try {
        if (decoder && decoder.state !== 'closed') decoder.close();
      } catch {
        /* noop */
      }
    };

    const frameToBlob = async (frame: VideoFrame): Promise<Blob | null> => {
      const w = frame.codedWidth;
      const h = frame.codedHeight;
      if (typeof OffscreenCanvas !== 'undefined') {
        const oc = new OffscreenCanvas(w, h);
        const octx = oc.getContext('2d');
        if (!octx) return null;
        octx.drawImage(frame, 0, 0);
        return oc.convertToBlob({ type: 'image/webp', quality: 0.82 });
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const cctx = c.getContext('2d');
      if (!cctx) return null;
      cctx.drawImage(frame, 0, 0);
      return new Promise<Blob | null>((resolve) =>
        c.toBlob((b) => resolve(b), 'image/webp', 0.82)
      );
    };

    const buildBank = async (hw: 'prefer-hardware' | 'prefer-software'): Promise<void> => {
      if (cancelled) return;
      s.building = true;

      let failed = false;
      const fail = () => {
        if (failed || cancelled) return;
        failed = true;
        try {
          if (decoder && decoder.state !== 'closed') decoder.close();
        } catch {
          /* noop */
        }
        decoder = null;
        s.bank = [];
        if (hw === 'prefer-hardware') {
          // retry once in software
          void buildBank('prefer-software');
        } else {
          revertToVideo();
        }
      };

      try {
        const res = await fetch(videoSrc, { mode: 'cors' });
        if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        const file = MP4Box.createFile();
        let codec = '';
        let description: Uint8Array | undefined;
        let totalSamples = Infinity;
        let sampleIdx = 0;
        let pending = 0; // decoded frames awaiting blob encoding
        let flushed = false;
        const samples: MP4Sample[] = [];

        const maybeFinish = () => {
          if (flushed || !decoder || cancelled) return;
          if (
            sampleIdx >= totalSamples &&
            decoder.decodeQueueSize === 0 &&
            pending === 0
          ) {
            flushed = true;
            decoder
              .flush()
              .then(() => {
                if (cancelled) return;
                s.bank.sort((a, b) => a.ts - b.ts);
                if (s.bank.length > 0) {
                  s.ready = true;
                  if (watchdogId) window.clearTimeout(watchdogId);
                } else {
                  fail();
                }
              })
              .catch(() => fail());
          }
        };

        const pump = () => {
          if (!decoder || cancelled || failed) return;
          while (sampleIdx < samples.length && decoder.decodeQueueSize + pending < LEAD) {
            const sm = samples[sampleIdx++];
            const chunk = new EncodedVideoChunk({
              type: sm.is_sync ? 'key' : 'delta',
              timestamp: (sm.cts * 1e6) / sm.timescale,
              duration: (sm.duration * 1e6) / sm.timescale,
              data: sm.data,
            });
            try {
              decoder.decode(chunk);
            } catch {
              fail();
              return;
            }
          }
          maybeFinish();
        };

        file.onError = () => fail();

        file.onReady = (info: any) => {
          if (cancelled || failed) return;
          const track = info.videoTracks && info.videoTracks[0];
          if (!track) {
            fail();
            return;
          }
          codec = track.codec;
          totalSamples = track.nb_samples ?? Infinity;
          if (!s.dur && info.duration && info.timescale) {
            s.dur = info.duration / info.timescale;
          }

          const trak = file.getTrackById(track.id);
          for (const entry of trak.mdia.minf.stbl.stsd.entries) {
            const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
            if (box) {
              const stream = new MP4Box.DataStream(
                undefined,
                0,
                MP4Box.DataStream.BIG_ENDIAN
              );
              box.write(stream);
              description = new Uint8Array(stream.buffer, 8); // strip box header
              break;
            }
          }

          try {
            decoder = new VideoDecoder({
              output: (frame: VideoFrame) => {
                pending++;
                void (async () => {
                  try {
                    const blob = await frameToBlob(frame);
                    if (blob && !cancelled) {
                      s.bank.push({ ts: frame.timestamp, blob });
                    }
                  } finally {
                    frame.close();
                    pending--;
                    pump();
                  }
                })();
              },
              error: () => fail(),
            });
            decoder.configure({
              codec,
              description,
              hardwareAcceleration: hw,
            } as VideoDecoderConfig);
          } catch {
            fail();
            return;
          }

          file.setExtractionOptions(track.id, null, { nbSamples: Infinity });
          file.start();
        };

        file.onSamples = (_id: number, _user: unknown, arr: MP4Sample[]) => {
          samples.push(...arr);
          pump();
        };

        (buf as ArrayBuffer & { fileStart?: number }).fileStart = 0;
        file.appendBuffer(buf as ArrayBuffer & { fileStart?: number });
        file.flush();
      } catch {
        fail();
      }
    };

    const start = () => {
      if (cancelled) return;
      watchdogId = window.setTimeout(() => {
        if (!s.ready) revertToVideo();
      }, WATCHDOG);
      void buildBank('prefer-hardware');
    };

    if (document.readyState === 'complete') {
      start();
    } else {
      window.addEventListener('load', start, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('load', start);
      if (watchdogId) window.clearTimeout(watchdogId);
      try {
        if (decoder && decoder.state !== 'closed') decoder.close();
      } catch {
        /* noop */
      }
      s.bank = [];
      s.ready = false;
      s.lru.forEach((v) => v?.close());
      s.lru.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoSrc]);

  return { containerRef, videoRef, canvasRef, scrollProgress, canvasLive };
}
