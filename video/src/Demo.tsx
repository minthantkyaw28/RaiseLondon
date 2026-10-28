import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadSilkscreen } from "@remotion/google-fonts/Silkscreen";
import { loadFont as loadHostGrotesk } from "@remotion/google-fonts/HostGrotesk";

const { fontFamily: pixelFont } = loadSilkscreen("normal", { weights: ["400", "700"], subsets: ["latin"] });
const { fontFamily: bodyFont } = loadHostGrotesk("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

const PLUM = "#2A2140";
const CREAM = "#FAF6EC";
const VIOLET = "#5B4BDB";
const ORANGE = "#FF5A36";

const FADE = 15;
export const DEMO_DURATION = 720;

const fadeIn = (frame: number) =>
  interpolate(frame, [0, FADE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const FullImage: React.FC<{ src: string; style?: React.CSSProperties }> = ({ src, style }) => (
  <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", ...style }} />
);

const Caption: React.FC<{ text: string; delay?: number }> = ({ text, delay = 10 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, delay, config: { damping: 200 } });
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        bottom: 80,
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "22px 40px",
        borderRadius: 999,
        background: PLUM,
        color: CREAM,
        fontFamily: bodyFont,
        fontWeight: 500,
        fontSize: 40,
        lineHeight: 1.1,
        boxShadow: "0 18px 40px rgba(42,33,64,0.35)",
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
      }}
    >
      <span style={{ width: 14, height: 14, borderRadius: 999, background: ORANGE, flexShrink: 0 }} />
      {text}
    </div>
  );
};

const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = spring({ frame, fps, delay: 5, config: { damping: 200 } });
  const sub = spring({ frame, fps, delay: 18, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: PLUM }}>
      <FullImage src="map-pixel.jpg" style={{ filter: "blur(18px)", transform: "scale(1.08)" }} />
      <AbsoluteFill style={{ background: "rgba(42,33,64,0.6)" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 36 }}>
        <div
          style={{
            fontFamily: pixelFont,
            fontWeight: 700,
            fontSize: 220,
            letterSpacing: 12,
            color: CREAM,
            lineHeight: 1,
            opacity: title,
            transform: `translateY(${interpolate(title, [0, 1], [30, 0])}px)`,
          }}
        >
          RAISE
        </div>
        <div
          style={{
            fontFamily: bodyFont,
            fontWeight: 500,
            fontSize: 52,
            color: CREAM,
            opacity: sub,
            transform: `translateY(${interpolate(sub, [0, 1], [20, 0])}px)`,
          }}
        >
          Every London investor on one map, matched to your pitch.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const MapScene: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, duration], [1, 1.08], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  return (
    <AbsoluteFill style={{ opacity: fadeIn(frame), overflow: "hidden" }}>
      <FullImage src="map-pixel.jpg" style={{ transform: `scale(${scale})` }} />
      <Caption text="Every London investor, on one map" />
    </AbsoluteFill>
  );
};

const ViewsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const nightOpacity = interpolate(frame, [55, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ opacity: fadeIn(frame) }}>
      <FullImage src="map-chalk.jpg" />
      <AbsoluteFill style={{ opacity: nightOpacity }}>
        <FullImage src="map-night.jpg" />
      </AbsoluteFill>
      <Caption text="Three views: Pixel, Chalk, Night" />
    </AbsoluteFill>
  );
};

const FramedScene: React.FC<{ src: string; caption: string }> = ({ src, caption }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, delay: 4, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ opacity: fadeIn(frame), background: PLUM }}>
      <FullImage src={src} style={{ filter: "blur(24px)", transform: "scale(1.1)" }} />
      <AbsoluteFill style={{ background: "rgba(42,33,64,0.45)" }} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
        <div
          style={{
            width: 1440,
            height: 810,
            borderRadius: 28,
            overflow: "hidden",
            boxShadow: "0 40px 90px rgba(0,0,0,0.45), 0 0 0 1px rgba(250,246,236,0.18)",
            transform: `translateY(${interpolate(rise, [0, 1], [260, 0])}px)`,
            opacity: interpolate(rise, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <FullImage src={src} />
        </div>
      </AbsoluteFill>
      <Caption text={caption} delay={16} />
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, delay: 8, config: { damping: 200 } });
  return (
    <AbsoluteFill
      style={{
        opacity: fadeIn(frame),
        background: VIOLET,
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      <div
        style={{
          fontFamily: pixelFont,
          fontWeight: 700,
          fontSize: 200,
          letterSpacing: 12,
          color: CREAM,
          lineHeight: 1,
          transform: `scale(${interpolate(s, [0, 1], [0.92, 1])})`,
          opacity: s,
        }}
      >
        RAISE
      </div>
      <div
        style={{
          fontFamily: bodyFont,
          fontWeight: 600,
          fontSize: 48,
          color: PLUM,
          background: CREAM,
          padding: "18px 44px",
          borderRadius: 999,
          opacity: s,
        }}
      >
        [demo link]
      </div>
    </AbsoluteFill>
  );
};

export const Demo: React.FC = () => (
  <AbsoluteFill style={{ background: PLUM }}>
    <Sequence from={0} durationInFrames={90 + FADE}>
      <TitleCard />
    </Sequence>
    <Sequence from={90} durationInFrames={180 + FADE}>
      <MapScene duration={180 + FADE} />
    </Sequence>
    <Sequence from={270} durationInFrames={120 + FADE}>
      <ViewsScene />
    </Sequence>
    <Sequence from={390} durationInFrames={150 + FADE}>
      <FramedScene src="matcher.jpg" caption="Say your pitch. Get ranked investors, with reasons." />
    </Sequence>
    <Sequence from={540} durationInFrames={90 + FADE}>
      <FramedScene src="profile.jpg" caption="Verified founder ratings and meeting debriefs" />
    </Sequence>
    <Sequence from={630} durationInFrames={90}>
      <EndCard />
    </Sequence>
  </AbsoluteFill>
);
