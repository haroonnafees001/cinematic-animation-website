import { ReactNode, useEffect, useState } from 'react';
import { ArrowRight, ArrowDown, ChevronUp, Info, X } from 'lucide-react';
import { useVideoScrub } from '@/useVideoScrub';

const DARK = '#1D3045';
const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260821_114821_a8ca298f-be2c-4613-a4dd-51b69e16bbde.mp4';

const NAV_LINKS = [
  'VECTRUS ENERGY',
  'VECTRUS UPSTREAM',
  'VECTRUS MARKETS',
  'VECTRUS SYSTEMS',
  'VECTRUS+',
];

const EASE = 'cubic-bezier(0.16,1,0.3,1)';

function Stagger({
  visible,
  delay = 0,
  className = '',
  children,
}: {
  visible: boolean;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0px)' : 'translateY(24px)',
        transition: `opacity 0.8s ${EASE} ${delay}ms, transform 0.8s ${EASE} ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function Section({
  opacity,
  className = '',
  children,
}: {
  opacity: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`absolute inset-0 ${className}`}
      style={{ opacity, transition: 'opacity 0.1s ease-out' }}
    >
      {children}
    </div>
  );
}

export default function App() {
  const { containerRef, videoRef, canvasRef, scrollProgress: p, canvasLive } =
    useVideoScrub(VIDEO_SRC);

  const [navIn, setNavIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setNavIn(true), 200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // Sequential section opacities
  const s1Opacity = p < 0.2 ? 1 : Math.max(0, 1 - (p - 0.2) / 0.08);
  const s2Opacity =
    p < 0.32
      ? 0
      : p < 0.4
        ? (p - 0.32) / 0.08
        : p < 0.55
          ? 1
          : Math.max(0, 1 - (p - 0.55) / 0.08);
  const s3Opacity = p < 0.67 ? 0 : p < 0.75 ? (p - 0.67) / 0.08 : 1;

  const v1 = s1Opacity > 0.3;
  const v2 = s2Opacity > 0.3;
  const v3 = s3Opacity > 0.3;

  const isLight = p > 0.55;
  const navColor = isLight ? '#ffffff' : DARK;

  return (
    <div ref={containerRef} className="relative h-[500vh]">
      <div className="sticky top-0 w-full h-screen overflow-hidden">
        {/* Video: never autoplayed, position driven by scroll (fallback path) */}
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Decoded-frame canvas: fades in once the frame bank is live */}
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          style={{ opacity: canvasLive ? 1 : 0 }}
        />

        <div className="absolute inset-0 pointer-events-none">
          {/* NAVBAR */}
          <nav
            className="absolute top-0 left-0 right-0 z-50 pointer-events-auto px-6 sm:px-8 md:px-12 pt-8 sm:pt-12 pb-6 flex items-center justify-between transition-colors duration-500"
            style={{ color: navColor }}
          >
            {/* Mobile hamburger */}
            <button
              className="lg:hidden flex flex-col gap-[5px]"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <span className="block w-6 h-0.5" style={{ backgroundColor: navColor }} />
              <span className="block w-6 h-0.5" style={{ backgroundColor: navColor }} />
              <span className="block w-4 h-0.5" style={{ backgroundColor: navColor }} />
            </button>

            {/* Desktop links */}
            <div className="hidden lg:flex items-center gap-8 xl:gap-10">
              {NAV_LINKS.map((label, i) => (
                <div
                  key={label}
                  style={{
                    opacity: navIn ? 1 : 0,
                    transform: navIn ? 'translateY(0px)' : 'translateY(-12px)',
                    transition: `opacity 0.6s ${EASE} ${i * 80 + 100}ms, transform 0.6s ${EASE} ${i * 80 + 100}ms`,
                  }}
                >
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="relative block text-xs tracking-[0.15em] uppercase font-medium hover:opacity-70 transition-opacity"
                  >
                    {label}
                    {i === 0 && (
                      <span
                        className="absolute left-0 right-0 -bottom-3 h-[2px]"
                        style={{ backgroundColor: navColor }}
                      />
                    )}
                  </a>
                </div>
              ))}
            </div>

            {/* Right cluster */}
            <div
              className="hidden sm:flex items-center gap-8"
              style={{
                opacity: navIn ? 1 : 0,
                transform: navIn ? 'translateY(0px)' : 'translateY(-12px)',
                transition: `opacity 0.6s ${EASE} 500ms, transform 0.6s ${EASE} 500ms`,
              }}
            >
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="flex items-center gap-3 text-xs tracking-[0.2em] uppercase font-medium hover:opacity-70 transition-opacity"
              >
                NEWS
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-500"
                  style={{ backgroundColor: navColor }}
                >
                  <Info size={10} color={isLight ? DARK : '#ffffff'} />
                </span>
              </a>
              <span className="hidden lg:inline text-xs tracking-[0.2em] uppercase font-medium">
                MENU
              </span>
              <button
                className="lg:hidden text-xs tracking-[0.2em] uppercase font-medium hover:opacity-70 transition-opacity"
                onClick={() => setMenuOpen(true)}
              >
                MENU
              </button>
            </div>
          </nav>

          {/* SECTION 1 — hero */}
          <Section opacity={s1Opacity} className="flex items-center">
            <div className="px-6 sm:px-8 md:px-20 lg:px-32">
              <Stagger visible={v1} delay={0}>
                <h1
                  className="font-light uppercase leading-[1.2]"
                  style={{ color: DARK, fontSize: 'clamp(2rem,5vw,5rem)' }}
                >
                  Advancing resources for a cleaner future
                </h1>
              </Stagger>
              <Stagger visible={v1} delay={150}>
                <p
                  className="mt-6 text-sm tracking-[0.3em] uppercase"
                  style={{ color: '#1D304590' }}
                >
                  Sustainable power with purpose
                </p>
              </Stagger>
            </div>
            <div className="absolute bottom-12 right-6 sm:right-8 md:right-12">
              <Stagger visible={v1} delay={300}>
                <button
                  aria-label="Next"
                  className="pointer-events-auto w-12 h-12 rounded-full border flex items-center justify-center hover:opacity-70 transition-opacity"
                  style={{ borderColor: '#1D304580', color: DARK }}
                >
                  <ArrowRight size={18} />
                </button>
              </Stagger>
            </div>
          </Section>

          {/* SECTION 2 — center statement */}
          <Section opacity={s2Opacity} className="flex items-center justify-center px-6 sm:px-8">
            <div className="max-w-[900px]">
              <Stagger visible={v2} delay={0}>
                <h2
                  className="font-extralight tracking-wide leading-[1.3] text-center uppercase"
                  style={{ color: DARK, fontSize: 'clamp(1.5rem,4.5vw,4.5rem)' }}
                >
                  We build lasting partnerships with vision{' '}
                  <span style={{ color: '#1D3045CC' }}>and precision</span>{' '}
                  <span style={{ color: '#1D304580' }}>across every frontier</span>
                </h2>
              </Stagger>
            </div>
            <div className="absolute bottom-16 right-6 sm:right-8 md:right-12 flex flex-col items-center gap-4">
              <Stagger visible={v2} delay={200}>
                <div
                  className="w-12 h-12 rounded-full border flex items-center justify-center"
                  style={{ borderColor: '#1D304566', color: DARK }}
                >
                  <ArrowDown size={18} />
                </div>
              </Stagger>
              <Stagger visible={v2} delay={350}>
                <div className="mt-4 flex flex-col items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DARK }} />
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#1D304566' }} />
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#1D304566' }} />
                </div>
              </Stagger>
              <Stagger visible={v2} delay={500}>
                <div
                  className="mt-2 w-10 h-10 rounded-full border flex items-center justify-center"
                  style={{ borderColor: '#1D30454D', color: '#1D3045CC' }}
                >
                  <ChevronUp size={16} />
                </div>
              </Stagger>
            </div>
          </Section>

          {/* SECTION 3 — right aligned, white type */}
          <Section
            opacity={s3Opacity}
            className="flex items-center justify-end px-6 sm:px-8 md:px-20 lg:px-32"
          >
            <div className="max-w-2xl text-left">
              <Stagger visible={v3} delay={0}>
                <p className="text-white/60 text-lg tracking-wide mb-4">Halder | Nordvik</p>
              </Stagger>
              <Stagger visible={v3} delay={150}>
                <h2
                  className="font-light text-white leading-[1.2] uppercase tracking-wide mb-8"
                  style={{ fontSize: 'clamp(2rem,4vw,4rem)' }}
                >
                  Fueling ambition,
                  <br />
                  shaping tomorrow.
                </h2>
              </Stagger>
              <Stagger visible={v3} delay={300}>
                <div className="flex items-center gap-4">
                  <span className="text-sm tracking-[0.3em] text-white/80 uppercase">
                    Contact Nordvik
                  </span>
                  <button
                    aria-label="Contact Nordvik"
                    className="pointer-events-auto w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 hover:scale-110 transition-transform duration-300"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </Stagger>
            </div>
          </Section>
        </div>
      </div>

      {/* MOBILE MENU OVERLAY */}
      <div
        className={`fixed inset-0 z-[100] transition-opacity duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          menuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        style={{ backgroundColor: DARK }}
      >
        <div
          className={`h-full flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            menuOpen ? 'translate-y-0' : '-translate-y-8'
          }`}
        >
          <div className="flex justify-end px-6 sm:px-8 pt-8 sm:pt-12">
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="w-10 h-10 rounded-full border border-white/30 hover:border-white flex items-center justify-center text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 flex flex-col justify-center px-8 sm:px-12">
            {NAV_LINKS.map((label, i) => (
              <a
                key={label}
                href="#"
                onClick={(e) => e.preventDefault()}
                className={`py-3 text-2xl sm:text-3xl font-light tracking-wide uppercase transition-all duration-500 ${
                  i === 0 ? 'text-white' : 'text-white/60 hover:text-white'
                }`}
                style={{
                  transitionDelay: `${i * 60}ms`,
                  transform: menuOpen ? 'translateY(0px)' : 'translateY(20px)',
                  opacity: menuOpen ? 1 : 0,
                }}
              >
                {label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-8 px-8 sm:px-12 pb-10">
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-xs tracking-[0.2em] uppercase text-white/60 hover:text-white transition-colors"
            >
              NEWS
            </a>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-xs tracking-[0.2em] uppercase text-white/60 hover:text-white transition-colors"
            >
              CONTACT
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
