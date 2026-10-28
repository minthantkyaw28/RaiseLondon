import { useEffect, useRef } from "react";
import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

import type { Investor } from "@/data/types";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const LONDON: [number, number] = [-0.11, 51.515];
const FONT = ["Noto Sans Regular"];

interface Props {
  investors: Investor[];
  selectedId: string | null;
  warmIds: Set<string>;
  onSelect: (id: string) => void;
}

function toGeoJSON(investors: Investor[], warmIds: Set<string>, selectedId: string | null) {
  return {
    type: "FeatureCollection" as const,
    features: investors.map((v) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [v.lng, v.lat] },
      properties: {
        id: v.id,
        name: v.name,
        warm: warmIds.has(v.id),
        selected: v.id === selectedId,
      },
    })),
  };
}

// maplibre touches `window` on import, so it is loaded inside the effect to keep SSR happy.
export function VcMap({ investors, selectedId, warmIds, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const dataRef = useRef(toGeoJSON(investors, warmIds, selectedId));
  dataRef.current = toGeoJSON(investors, warmIds, selectedId);

  useEffect(() => {
    let cancelled = false;
    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !container.current) return;
      // Vite's dep pre-bundling moves maplibre away from its worker file, so point at it explicitly.
      maplibregl.setWorkerUrl(workerUrl);
      const m = new maplibregl.Map({
        container: container.current,
        style: STYLE_URL,
        center: LONDON,
        zoom: 12.3,
        attributionControl: { compact: true },
      });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      map.current = m;

      m.on("load", () => {
        m.addSource("investors", {
          type: "geojson",
          data: dataRef.current,
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
            "circle-color": "#1e293b",
            "circle-radius": ["step", ["get", "point_count"], 16, 5, 20, 10, 26],
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff",
          },
        });
        m.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "investors",
          filter: ["has", "point_count"],
          layout: { "text-field": "{point_count_abbreviated}", "text-size": 12, "text-font": FONT },
          paint: { "text-color": "#ffffff" },
        });
        m.addLayer({
          id: "points",
          type: "circle",
          source: "investors",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["case", ["get", "warm"], "#ea580c", "#334155"],
            "circle-radius": ["case", ["get", "selected"], 11, 7],
            "circle-stroke-width": ["case", ["get", "selected"], 4, 2],
            "circle-stroke-color": "#ffffff",
          },
        });
        m.addLayer({
          id: "labels",
          type: "symbol",
          source: "investors",
          filter: ["!", ["has", "point_count"]],
          minzoom: 13,
          layout: {
            "text-field": ["get", "name"],
            "text-font": FONT,
            "text-size": 11,
            "text-offset": [0, 1.3],
            "text-anchor": "top",
          },
          paint: { "text-color": "#0f172a", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
        });

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
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const source = map.current?.getSource("investors") as GeoJSONSource | undefined;
    source?.setData(dataRef.current);
  }, [investors, warmIds, selectedId]);

  useEffect(() => {
    const v = investors.find((i) => i.id === selectedId);
    if (v && map.current) map.current.easeTo({ center: [v.lng, v.lat], zoom: 14.5 });
    // Only re-centre when the selection changes, not when filters reshuffle the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return <div ref={container} className="h-full w-full" />;
}
