import { useEffect, useRef } from "react";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  MapLayerMouseEvent,
  Map as MapLibreMap,
  SymbolLayerSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

import type { Investor } from "@/data/types";
import { cn } from "@/lib/utils";
import { rankInvestors, type Tier } from "./importance";
import { buildStyle, type MapView } from "./map-styles";

const LONDON: [number, number] = [-0.11, 51.515];
// Greater London plus a margin: Raise is London only, so the map never pans off to the sea.
const LONDON_BOUNDS: [[number, number], [number, number]] = [
  [-0.75, 51.18],
  [0.5, 51.8],
];
const MIN_ZOOM = 9.5;
const FONT = ["Noto Sans Bold"];
const ANTIALIAS = { antialias: true };

const baseRatio = (view: MapView) => window.devicePixelRatio * (view.pixelScale ?? 1);

interface Props {
  investors: Investor[];
  selectedId: string | null;
  hoveredId?: string | null;
  /** Match rank (1 = best) by investor id; ranked firms show their number and always a label. */
  ranks?: Map<string, number> | undefined;
  /** Changes whenever the visible set changes on purpose (filters, a new match), to refit. */
  fitKey?: string;
  view: MapView;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
}

function toGeoJSON(
  investors: Investor[],
  selectedId: string | null,
  hoveredId: string | null,
  ranks: Map<string, number> | undefined,
) {
  const importance = rankInvestors(investors);
  return {
    type: "FeatureCollection" as const,
    features: investors.map((v) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [v.lng, v.lat] },
      properties: {
        id: v.id,
        name: ranks?.has(v.id) ? `${ranks.get(v.id)}. ${v.name}` : v.name,
        // Hovered and matched firms are drawn like the selected one, so they always get a label.
        selected: v.id === selectedId || v.id === hoveredId || ranks?.has(v.id) === true,
        network: v.type === "angel-network",
        approximate: v.approximateLocation === true,
        rank: importance.get(v.id)?.rank ?? investors.length,
        tier: importance.get(v.id)?.tier ?? 3,
      },
    })),
  };
}

const SELECTED: ExpressionSpecification = ["get", "selected"];
const TIER: ExpressionSpecification = ["get", "tier"];

const pinRadius = (tier1: number, tier2: number, tier3: number): ExpressionSpecification => [
  "case",
  SELECTED,
  8,
  ["match", TIER, 1, tier1, 2, tier2, tier3],
];

// Like Google Maps, the busiest firms are named first and smaller ones appear as you zoom in.
// One layer per tier because a ["zoom"] filter on a tiled source only sees whole tile zooms.
const LABEL_TIERS: { id: string; tier: Tier; minzoom: number; size: number }[] = [
  { id: "labels-tier-3", tier: 3, minzoom: 14, size: 11 },
  { id: "labels-tier-2", tier: 2, minzoom: 12.5, size: 12 },
  { id: "labels-tier-1", tier: 1, minzoom: 11, size: 13.5 },
];

function labelLayout(size: number): NonNullable<SymbolLayerSpecification["layout"]> {
  return {
    "text-field": ["get", "name"],
    "text-font": FONT,
    "text-size": size,
    // Right of the pin so the pin stays visible; left of it when the right side is taken.
    "text-variable-anchor-offset": ["literal", ["left", [0.7, 0], "right", [-0.7, 0]]],
    "text-justify": "auto",
    "text-padding": 3,
    "symbol-sort-key": ["get", "rank"],
  };
}

function labelPaint(color: string, halo: string): NonNullable<SymbolLayerSpecification["paint"]> {
  return {
    "text-color": color,
    "text-halo-color": halo,
    "text-halo-width": 2,
    "text-halo-blur": 0.5,
  };
}

function addInvestorLayers(m: MapLibreMap, data: ReturnType<typeof toGeoJSON>, view: MapView) {
  const { pin, look } = view;
  const colour: ExpressionSpecification = ["case", ["get", "network"], pin.network, pin.fill];
  m.addSource("investors", { type: "geojson", data });
  m.addLayer({
    id: "points",
    type: "circle",
    source: "investors",
    layout: { "circle-sort-key": ["case", SELECTED, 1, ["-", 0, ["get", "rank"]]] },
    paint: {
      // Firms without a known office are hollow: their pin is placed near the centre, not at it.
      "circle-color": ["case", ["get", "approximate"], pin.stroke, colour],
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        11,
        pinRadius(4.5, 3.5, 2.5),
        15,
        pinRadius(7, 6, 5),
      ],
      // Unnamed small firms recede until their names appear, so dots never crowd a name.
      "circle-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12.5,
        ["case", SELECTED, 1, ["match", TIER, 3, 0.45, 1]],
        14,
        1,
      ],
      "circle-stroke-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12.5,
        ["case", SELECTED, 1, ["match", TIER, 3, 0.45, 1]],
        14,
        1,
      ],
      "circle-stroke-width": ["case", SELECTED, 2.5, ["match", TIER, 3, 1, 1.5]],
      "circle-stroke-color": ["case", ["get", "approximate"], colour, pin.stroke],
    },
  });
  // Above the pins: in the packed centre a name drawn under the dots would be unreadable.
  // Symbol layers are placed top first, so tier 1 claims space before tier 2 and tier 3.
  for (const { id, tier, minzoom, size } of LABEL_TIERS) {
    m.addLayer({
      id,
      type: "symbol",
      source: "investors",
      filter: ["all", ["==", TIER, tier], ["!", SELECTED]],
      minzoom,
      layout: labelLayout(size),
      paint: labelPaint(pin.label, look.land),
    });
  }
  m.addLayer({
    id: "label-selected",
    type: "symbol",
    source: "investors",
    filter: ["==", SELECTED, true],
    layout: {
      ...labelLayout(15),
      "text-variable-anchor-offset": ["literal", ["left", [0.8, 0]]],
      "text-allow-overlap": true,
    },
    paint: { ...labelPaint(pin.fill, look.land), "text-halo-width": 3 },
  });
}

// maplibre touches `window` on import, so it is loaded inside the effect to keep SSR happy.
export function VcMap({
  investors,
  selectedId,
  hoveredId = null,
  ranks,
  fitKey,
  view,
  onSelect,
  onHover,
}: Props) {
  const baseContainer = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const baseMap = useRef<MapLibreMap | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const dataRef = useRef(toGeoJSON(investors, selectedId, hoveredId, ranks));
  dataRef.current = toGeoJSON(investors, selectedId, hoveredId, ranks);
  const investorsRef = useRef(investors);
  investorsRef.current = investors;
  const viewRef = useRef(view);

  useEffect(() => {
    let cancelled = false;
    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !container.current || !baseContainer.current) return;
      // Vite's dep pre-bundling moves maplibre away from its worker file, so point at it explicitly.
      maplibregl.setWorkerUrl(workerUrl);
      const camera = {
        center: LONDON,
        zoom: 13.2,
        pitch: 55,
        bearing: -30,
        maxPitch: 60,
        minZoom: MIN_ZOOM,
        maxBounds: LONDON_BOUNDS,
      };
      const base = new maplibregl.Map({
        ...camera,
        container: baseContainer.current,
        style: buildStyle(viewRef.current, "base"),
        pixelRatio: baseRatio(viewRef.current),
        canvasContextAttributes: ANTIALIAS,
        interactive: false,
        attributionControl: false,
      });
      const m = new maplibregl.Map({
        ...camera,
        container: container.current,
        style: buildStyle(viewRef.current, "labels"),
        canvasContextAttributes: ANTIALIAS,
        attributionControl: { compact: true },
      });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      m.on("move", () =>
        base.jumpTo({
          center: m.getCenter(),
          zoom: m.getZoom(),
          bearing: m.getBearing(),
          pitch: m.getPitch(),
        }),
      );
      m.on("resize", () => base.resize());
      baseMap.current = base;
      map.current = m;
      if (import.meta.env.DEV) Object.assign(window, { __vcMap: m });

      m.on("style.load", () => addInvestorLayers(m, dataRef.current, viewRef.current));

      m.once("load", () => {
        // Compact attribution opens expanded by default, which covers half the map on a phone.
        container.current
          ?.querySelector(".maplibregl-ctrl-attrib")
          ?.classList.remove("maplibregl-compact-show");
        // Small pins are hard to hit, so a firm's name pill selects it too.
        const clickable = ["points", ...LABEL_TIERS.map((t) => t.id)];
        m.on("click", clickable, (e: MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.["id"];
          if (typeof id === "string") onSelectRef.current(id);
        });
        for (const layer of clickable) {
          m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
          m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
        }
        m.on("mousemove", "points", (e: MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.["id"];
          if (typeof id === "string") onHoverRef.current?.(id);
        });
        m.on("mouseleave", "points", () => onHoverRef.current?.(null));
      });
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      baseMap.current?.remove();
      map.current = null;
      baseMap.current = null;
    };
  }, []);

  useEffect(() => {
    const source = map.current?.getSource("investors") as GeoJSONSource | undefined;
    source?.setData(dataRef.current);
  }, [investors, selectedId, hoveredId, ranks]);

  // Zoom to fit what the founder asked for (a filter or a match), keeping the tilted camera.
  useEffect(() => {
    const m = map.current;
    const shown = investorsRef.current;
    if (!m || fitKey === undefined || shown.length === 0) return;
    const lngs = shown.map((v) => v.lng);
    const lats = shown.map((v) => v.lat);
    m.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 60, maxZoom: 14.5, pitch: m.getPitch(), bearing: m.getBearing() },
    );
  }, [fitKey]);

  useEffect(() => {
    const v = investors.find((i) => i.id === selectedId);
    if (v && map.current) map.current.easeTo({ center: [v.lng, v.lat], zoom: 14.5 });
    // Only re-centre when the selection changes, not when filters reshuffle the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (viewRef.current === view) return;
    viewRef.current = view;
    baseMap.current?.setPixelRatio(baseRatio(view));
    baseMap.current?.setStyle(buildStyle(view, "base"));
    map.current?.setStyle(buildStyle(view, "labels"));
  }, [view]);

  // maplibre forces position: relative on its container, so each map sits inside its own layer.
  return (
    <div className="relative h-full w-full">
      <div aria-hidden className={cn("absolute inset-0", view.pixelScale && "pixel-map")}>
        <div ref={baseContainer} className="h-full w-full" />
      </div>
      <div className="absolute inset-0">
        <div ref={container} className="h-full w-full" />
      </div>
      <MapKey pin={view.pin} />
    </div>
  );
}

function MapKey({ pin }: { pin: MapView["pin"] }) {
  const rows = [
    { label: "VC fund", style: { background: pin.fill, borderColor: pin.stroke } },
    { label: "Angel network", style: { background: pin.network, borderColor: pin.stroke } },
    { label: "Office not known", style: { background: pin.stroke, borderColor: pin.fill } },
  ];
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[1] space-y-1 rounded-lg border bg-background/95 px-2.5 py-2 text-[11px] shadow-sm backdrop-blur">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2" style={row.style} />
          {row.label}
        </div>
      ))}
    </div>
  );
}
