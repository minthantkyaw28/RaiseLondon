import type { StyleSpecification } from "maplibre-gl";

// Bright, flat palette in the spirit of isometric pixel-art city maps.
export const PALETTE = {
  land: "#f6f1e4",
  water: "#5ec8f2",
  waterEdge: "#3aa6db",
  park: "#8fd46a",
  wood: "#5fb85a",
  sand: "#f3dd9a",
  road: "#ffffff",
  roadMajor: "#ffd166",
  rail: "#c9b9a6",
  building: "#f9b48c",
  buildingTop: "#ffd2b0",
  label: "#3b2f4a",
  halo: "#ffffff",
};

const FONT = ["Noto Sans Bold"];

export const pixelStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  light: { anchor: "viewport", color: "#ffffff", intensity: 0.18 },
  sources: {
    omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
  },
  layers: [
    { id: "land", type: "background", paint: { "background-color": PALETTE.land } },
    {
      id: "park",
      type: "fill",
      source: "omt",
      "source-layer": "park",
      paint: { "fill-color": PALETTE.park },
    },
    {
      id: "landcover",
      type: "fill",
      source: "omt",
      "source-layer": "landcover",
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "wood",
          PALETTE.wood,
          "sand",
          PALETTE.sand,
          PALETTE.park,
        ],
      },
    },
    {
      id: "landuse-green",
      type: "fill",
      source: "omt",
      "source-layer": "landuse",
      filter: ["in", ["get", "class"], ["literal", ["cemetery", "pitch", "playground", "stadium"]]],
      paint: { "fill-color": PALETTE.park },
    },
    {
      id: "water",
      type: "fill",
      source: "omt",
      "source-layer": "water",
      paint: { "fill-color": PALETTE.water, "fill-outline-color": PALETTE.waterEdge },
    },
    {
      id: "rail",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["==", ["get", "class"], "rail"],
      paint: { "line-color": PALETTE.rail, "line-width": 2, "line-dasharray": [2, 2] },
    },
    {
      id: "roads-minor",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["in", ["get", "class"], ["literal", ["minor", "service", "tertiary"]]],
      layout: { "line-cap": "square", "line-join": "miter" },
      paint: {
        "line-color": PALETTE.road,
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 6],
      },
    },
    {
      id: "roads-major",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["in", ["get", "class"], ["literal", ["primary", "secondary", "trunk", "motorway"]]],
      layout: { "line-cap": "square", "line-join": "miter" },
      paint: {
        "line-color": PALETTE.roadMajor,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 16, 10],
      },
    },
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
          ["coalesce", ["get", "render_height"], 10],
          0,
          PALETTE.buildingTop,
          60,
          PALETTE.building,
          150,
          "#f08a8a",
        ],
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 10],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 1,
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
      paint: { "text-color": PALETTE.label, "text-halo-color": PALETTE.halo, "text-halo-width": 2 },
    },
  ],
};
