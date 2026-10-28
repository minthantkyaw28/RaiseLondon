import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";

export type MapViewId = "pixel" | "chalk" | "night";

interface Look {
  land: string;
  water: string;
  park: string;
  wood: string;
  road: string;
  roadMajor: string;
  rail: string;
  buildingLow: string;
  buildingMid: string;
  buildingHigh: string;
  label: string;
  halo: string;
  lightIntensity: number;
  roadGlow?: string;
}

export interface MapView {
  id: MapViewId;
  label: string;
  // Rendering below device resolution and upscaling with hard edges gives the pixel-art look.
  pixelRatio?: number;
  pin: { warm: string; cold: string; cluster: string; stroke: string; label: string; halo: string };
  look: Look;
}

export const MAP_VIEWS: MapView[] = [
  {
    id: "pixel",
    label: "Pixel",
    pixelRatio: 0.5,
    pin: {
      warm: "#ff5a36",
      cold: "#5b4bdb",
      cluster: "#3b2f4a",
      stroke: "#ffffff",
      label: "#3b2f4a",
      halo: "#ffffff",
    },
    look: {
      land: "#f6f1e4",
      water: "#5ec8f2",
      park: "#8fd46a",
      wood: "#5fb85a",
      road: "#ffffff",
      roadMajor: "#ffd166",
      rail: "#c9b9a6",
      buildingLow: "#ffd2b0",
      buildingMid: "#f9b48c",
      buildingHigh: "#f08a8a",
      label: "#3b2f4a",
      halo: "#ffffff",
      lightIntensity: 0.18,
    },
  },
  {
    // An architectural white model: everything one material, depth comes from the light.
    id: "chalk",
    label: "Chalk",
    pin: {
      warm: "#ff5a36",
      cold: "#1f2937",
      cluster: "#1f2937",
      stroke: "#ffffff",
      label: "#1f2937",
      halo: "#ffffff",
    },
    look: {
      land: "#efeee9",
      water: "#d5e2ea",
      park: "#e3e8dc",
      wood: "#dbe2d3",
      road: "#fbfbf8",
      roadMajor: "#ffffff",
      rail: "#d4d2cb",
      buildingLow: "#ffffff",
      buildingMid: "#fbfaf6",
      buildingHigh: "#f4f2ec",
      label: "#4b5563",
      halo: "#f7f6f2",
      lightIntensity: 0.45,
    },
  },
  {
    id: "night",
    label: "Night",
    pin: {
      warm: "#ff8a3d",
      cold: "#a78bfa",
      cluster: "#70f0d3",
      stroke: "#07121d",
      label: "#e6fffa",
      halo: "#07121d",
    },
    look: {
      land: "#07121d",
      water: "#0b2638",
      park: "#0c2620",
      wood: "#0b231d",
      road: "#173247",
      roadMajor: "#70f0d3",
      rail: "#22405a",
      buildingLow: "#10263a",
      buildingMid: "#1b3a5a",
      buildingHigh: "#3d5f9e",
      label: "#9fe9d9",
      halo: "#07121d",
      lightIntensity: 0.3,
      roadGlow: "#70f0d3",
    },
  },
];

const FONT = ["Noto Sans Bold"];
const MAJOR: ExpressionSpecification = [
  "in",
  ["get", "class"],
  ["literal", ["primary", "secondary", "trunk", "motorway"]],
];
const HEIGHT: ExpressionSpecification = ["coalesce", ["get", "render_height"], 10];

function roadLayers(look: Look): LayerSpecification[] {
  const glow: LayerSpecification[] = look.roadGlow
    ? [
        {
          id: "roads-glow",
          type: "line",
          source: "omt",
          "source-layer": "transportation",
          filter: MAJOR,
          paint: {
            "line-color": look.roadGlow,
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4, 16, 22],
            "line-blur": ["interpolate", ["linear"], ["zoom"], 10, 4, 16, 16],
            "line-opacity": 0.35,
          },
        },
      ]
    : [];
  return [
    {
      id: "rail",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["==", ["get", "class"], "rail"],
      paint: { "line-color": look.rail, "line-width": 2, "line-dasharray": [2, 2] },
    },
    {
      id: "roads-minor",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["in", ["get", "class"], ["literal", ["minor", "service", "tertiary"]]],
      layout: { "line-cap": "square", "line-join": "miter" },
      paint: {
        "line-color": look.road,
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 6],
      },
    },
    ...glow,
    {
      id: "roads-major",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: MAJOR,
      layout: { "line-cap": "square", "line-join": "miter" },
      paint: {
        "line-color": look.roadMajor,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 16, 10],
      },
    },
  ];
}

export type StylePart = "base" | "labels";

// The base can be drawn at low resolution for the pixel look; labels sit on a full-resolution
// map stacked on top so text stays sharp.
export function buildStyle(view: MapView, part: StylePart): StyleSpecification {
  const style = buildFullStyle(view);
  const isLabel = (l: LayerSpecification) => l.type === "symbol";
  return { ...style, layers: style.layers.filter((l) => (part === "labels") === isLabel(l)) };
}

function buildFullStyle(view: MapView): StyleSpecification {
  const { look } = view;
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    light: { anchor: "viewport", color: "#ffffff", intensity: look.lightIntensity },
    sources: { omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
    layers: [
      { id: "land", type: "background", paint: { "background-color": look.land } },
      {
        id: "park",
        type: "fill",
        source: "omt",
        "source-layer": "park",
        paint: { "fill-color": look.park },
      },
      {
        id: "landcover",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        paint: { "fill-color": ["match", ["get", "class"], "wood", look.wood, look.park] },
      },
      {
        id: "landuse-green",
        type: "fill",
        source: "omt",
        "source-layer": "landuse",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["cemetery", "pitch", "playground", "stadium"]],
        ],
        paint: { "fill-color": look.park },
      },
      {
        id: "water",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        paint: { "fill-color": look.water },
      },
      ...roadLayers(look),
      {
        id: "buildings",
        type: "fill-extrusion",
        source: "omt",
        "source-layer": "building",
        minzoom: 14.5,
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            HEIGHT,
            0,
            look.buildingLow,
            60,
            look.buildingMid,
            150,
            look.buildingHigh,
          ],
          "fill-extrusion-height": HEIGHT,
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        },
      },
      {
        id: "place-labels",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        filter: ["in", ["get", "class"], ["literal", ["suburb", "neighbourhood", "quarter"]]],
        layout: {
          "text-field": ["upcase", ["get", "name"]],
          "text-font": FONT,
          "text-size": 11,
          "text-letter-spacing": 0.12,
        },
        paint: { "text-color": look.label, "text-halo-color": look.halo, "text-halo-width": 2 },
      },
    ],
  };
}
