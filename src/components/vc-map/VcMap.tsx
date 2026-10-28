import { useEffect, useRef } from "react";
import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

import type { Investor } from "@/data/types";
import { cn } from "@/lib/utils";
import { buildStyle, type MapView } from "./map-styles";

const LONDON: [number, number] = [-0.11, 51.515];
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
  view: MapView;
  onSelect: (id: string) => void;
}

function toGeoJSON(investors: Investor[], selectedId: string | null) {
  return {
    type: "FeatureCollection" as const,
    features: investors.map((v) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [v.lng, v.lat] },
      properties: {
        id: v.id,
        name: v.name,
        selected: v.id === selectedId,
      },
    })),
  };
}

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
  m.addLayer({
    id: "points",
    type: "circle",
    source: "investors",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": pin.fill,
      "circle-radius": ["case", ["get", "selected"], 13, 9],
      "circle-stroke-width": ["case", ["get", "selected"], 4, 2],
      "circle-stroke-color": pin.stroke,
    },
  });
  m.addLayer(
    {
      id: "labels",
      type: "symbol",
      source: "investors",
      filter: ["!", ["has", "point_count"]],
      minzoom: 13,
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT,
        "text-size": ["case", ["get", "selected"], 13, 12],
        "text-offset": ["case", ["get", "selected"], ["literal", [0, 1.9]], ["literal", [0, 1.6]]],
        "text-anchor": "top",
        "icon-image": ["case", ["get", "selected"], PILL_SELECTED, PILL],
        "icon-text-fit": "both",
        "icon-text-fit-padding": [2, 7, 2, 7],
        "symbol-sort-key": ["case", ["get", "selected"], 0, 1],
      },
      paint: { "text-color": pin.stroke },
    },
    // Below the pins so a pill never hides a neighbouring firm's pin.
    "points",
  );
}

// maplibre touches `window` on import, so it is loaded inside the effect to keep SSR happy.
export function VcMap({ investors, selectedId, view, onSelect }: Props) {
  const baseContainer = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const baseMap = useRef<MapLibreMap | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const dataRef = useRef(toGeoJSON(investors, selectedId));
  dataRef.current = toGeoJSON(investors, selectedId);
  const viewRef = useRef(view);

  useEffect(() => {
    let cancelled = false;
    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !container.current || !baseContainer.current) return;
      // Vite's dep pre-bundling moves maplibre away from its worker file, so point at it explicitly.
      maplibregl.setWorkerUrl(workerUrl);
      const camera = { center: LONDON, zoom: 13.2, pitch: 55, bearing: -30, maxPitch: 60 };
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
  }, [investors, selectedId]);

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
    </div>
  );
}
