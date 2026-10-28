import { useEffect, useRef } from "react";
import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

import type { Investor } from "@/data/types";
import { cn } from "@/lib/utils";
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

const PILL = "vc-pill";
const PILL_SELECTED = "vc-pill-selected";
const PILL_W = 32;
const PILL_H = 24;
const PILL_R = 8;

// A stretchable rounded rectangle: icon-text-fit grows the straight middle around the firm name
// while the corners keep their radius.
function addPillImage(
  m: MapLibreMap,
  id: string,
  fill: string,
  stroke: string,
  strokeWidth: number,
) {
  const ratio = Math.max(2, Math.ceil(window.devicePixelRatio));
  const canvas = document.createElement("canvas");
  canvas.width = PILL_W * ratio;
  canvas.height = PILL_H * ratio;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  const inset = strokeWidth / 2;
  ctx.beginPath();
  ctx.roundRect(inset, inset, PILL_W - strokeWidth, PILL_H - strokeWidth, PILL_R - inset);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  const px = (n: number) => n * ratio;
  if (m.hasImage(id)) m.removeImage(id);
  m.addImage(id, ctx.getImageData(0, 0, canvas.width, canvas.height), {
    pixelRatio: ratio,
    stretchX: [[px(PILL_R), px(PILL_W - PILL_R)]],
    stretchY: [[px(PILL_R), px(PILL_H - PILL_R)]],
    content: [px(PILL_R), px(PILL_R), px(PILL_W - PILL_R), px(PILL_H - PILL_R)],
  });
}

interface Props {
  investors: Investor[];
  selectedId: string | null;
  hoveredId?: string | null;
  /** Match rank (1 = best) by investor id; ranked pins show their number. */
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
  return {
    type: "FeatureCollection" as const,
    features: investors.map((v) => {
      const rank = ranks?.get(v.id);
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [v.lng, v.lat] },
        properties: {
          id: v.id,
          name: rank ? `${rank}. ${v.name}` : v.name,
          kind: v.type,
          approximate: v.approximateLocation === true,
          selected: v.id === selectedId,
          // Selected, hovered and ranked pins always get a label, even when only near their office.
          emphasised: v.id === selectedId || v.id === hoveredId || rank !== undefined,
          rank: rank ?? 0,
        },
      };
    }),
  };
}

// Pin colour by investor type, so a founder can tell funds from angels at a glance.
const typeColour = (pin: MapView["pin"]) =>
  [
    "match",
    ["get", "kind"],
    "angel",
    pin.angel,
    "angel-network",
    pin.network,
    pin.fill,
  ] as unknown as string;

function addInvestorLayers(m: MapLibreMap, data: ReturnType<typeof toGeoJSON>, view: MapView) {
  const { pin } = view;
  addPillImage(m, PILL, pin.fill, pin.stroke, 1.5);
  addPillImage(m, PILL_SELECTED, pin.cluster, pin.stroke, 2.5);
  m.addSource("investors", {
    type: "geojson",
    data,
    cluster: true,
    clusterRadius: 40,
    clusterMaxZoom: 14,
  });
  m.addLayer({
    id: "clusters",
    type: "circle",
    source: "investors",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": pin.cluster,
      "circle-radius": ["step", ["get", "point_count"], 16, 5, 20, 10, 26],
      "circle-stroke-width": 3,
      "circle-stroke-color": pin.stroke,
    },
  });
  m.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "investors",
    filter: ["has", "point_count"],
    layout: { "text-field": "{point_count_abbreviated}", "text-size": 12, "text-font": FONT },
    paint: { "text-color": pin.stroke },
  });
  // Pins that are not at a known office are drawn hollow: the type colour shows as the ring.
  m.addLayer({
    id: "points",
    type: "circle",
    source: "investors",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": ["case", ["get", "approximate"], pin.stroke, typeColour(pin)],
      "circle-radius": ["case", ["get", "selected"], 13, ["get", "emphasised"], 11, 8],
      "circle-stroke-width": ["case", ["get", "selected"], 4, ["get", "approximate"], 3, 2],
      "circle-stroke-color": ["case", ["get", "approximate"], typeColour(pin), pin.stroke],
    },
  });
  m.addLayer(
    {
      id: "labels",
      type: "symbol",
      source: "investors",
      // Only pins at a known office get a name by default; the rest show it when picked.
      filter: [
        "all",
        ["!", ["has", "point_count"]],
        ["any", ["!", ["get", "approximate"]], ["get", "emphasised"]],
      ],
      minzoom: 12.5,
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT,
        "text-size": ["case", ["get", "selected"], 13, 12],
        // Try below, then either side, then above, so neighbours stop covering each other.
        "text-variable-anchor": ["top", "left", "right", "bottom"],
        "text-radial-offset": ["case", ["get", "selected"], 1.6, 1.3],
        "text-justify": "auto",
        // Flat to the screen: on the tilted map, near labels would otherwise grow huge.
        "text-pitch-alignment": "viewport",
        "icon-pitch-alignment": "viewport",
        "icon-image": ["case", ["get", "selected"], PILL_SELECTED, PILL],
        "icon-text-fit": "both",
        "icon-text-fit-padding": [2, 7, 2, 7],
        "symbol-sort-key": [
          "case",
          ["get", "selected"],
          0,
          ["get", "emphasised"],
          ["+", 1, ["get", "rank"]],
          1000,
        ],
      },
      paint: { "text-color": pin.stroke },
    },
    // Below the pins so a pill never hides a neighbouring firm's pin.
    "points",
  );
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

      m.on("style.load", () => addInvestorLayers(m, dataRef.current, viewRef.current));

      m.once("load", () => {
        // Compact attribution opens expanded by default, which covers half the map on a phone.
        container.current
          ?.querySelector(".maplibregl-ctrl-attrib")
          ?.classList.remove("maplibregl-compact-show");
        m.on("click", "points", (e: MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.["id"];
          if (typeof id === "string") onSelectRef.current(id);
        });
        m.on("click", "clusters", async (e: MapLayerMouseEvent) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const source = m.getSource("investors") as GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(feature.properties["cluster_id"]);
          const [lng, lat] = (feature.geometry as { coordinates: [number, number] }).coordinates;
          m.easeTo({ center: [lng, lat], zoom });
        });
        for (const layer of ["points", "clusters"]) {
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
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    for (const v of shown) {
      west = Math.min(west, v.lng);
      east = Math.max(east, v.lng);
      south = Math.min(south, v.lat);
      north = Math.max(north, v.lat);
    }
    m.fitBounds(
      [
        [west, south],
        [east, north],
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
  const solid = (colour: string) => ({ background: colour, borderColor: pin.stroke });
  const rows = [
    { label: "VC fund", style: solid(pin.fill) },
    { label: "Angel network", style: solid(pin.network) },
    { label: "Angel", style: solid(pin.angel) },
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
