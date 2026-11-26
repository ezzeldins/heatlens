import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { BBox, Feature, FeatureCollection } from "@/lib/types";

interface Props {
  bbox: BBox | null;
  onBBox: (b: BBox) => void;
  drawing: boolean;
  onDrawEnd: () => void;
  data: FeatureCollection | null;
  layerKey: string;
  style: (f: Feature) => L.PathOptions;
  tip: (f: Feature) => string;
  fit: { key: number; box: BBox | null };
}

export function MapView({ bbox, onBBox, drawing, onDrawEnd, data, layerKey, style, tip, fit }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const rect = useRef<L.Rectangle | null>(null);
  const layer = useRef<L.GeoJSON | null>(null);
  const latest = useRef({ style, tip, onBBox, onDrawEnd });
  latest.current = { style, tip, onBBox, onDrawEnd };

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([34.05, -118.25], 12);
    L.control.zoom({ position: "bottomright" }).addTo(m);

    // Free OpenStreetMap tile server with clean monochrome filter
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
      className: "basemap",
    }).addTo(m);

    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Selected area outline
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    rect.current?.remove();
    rect.current = null;
    if (bbox) {
      rect.current = L.rectangle(
        [
          [bbox[1], bbox[0]],
          [bbox[3], bbox[2]],
        ],
        {
          color: "#ffffff",
          weight: 1.5,
          dashArray: "4 4",
          fillColor: "#ffffff",
          fillOpacity: 0.08,
          interactive: false,
        },
      ).addTo(m);
    }
  }, [bbox]);

  // Result tiles
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layer.current?.remove();
    layer.current = null;
    if (!data) return;
    layer.current = L.geoJSON(data as unknown as GeoJSON.FeatureCollection, {
      style: (f) => latest.current.style(f as unknown as Feature),
      onEachFeature: (f, l) => l.bindTooltip(latest.current.tip(f as unknown as Feature), { sticky: true }),
    }).addTo(m);
    layer.current.bringToBack();
  }, [data, layerKey]);

  // Fly to a requested box
  useEffect(() => {
    const m = map.current;
    if (!m || !fit.box) return;
    const [w, s, e, n] = fit.box;
    const wide = window.innerWidth > 900;
    m.fitBounds(
      [
        [s, w],
        [n, e],
      ],
      {
        paddingTopLeft: [wide ? 400 : 24, 40],
        paddingBottomRight: [40, 40],
        animate: true,
        duration: 0.8,
      },
    );
  }, [fit.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag-to-draw rectangle
  useEffect(() => {
    const m = map.current;
    if (!m || !drawing) return;
    const c = m.getContainer();
    c.style.cursor = "crosshair";
    m.dragging.disable();

    // Prevent loaded vector tiles from intercepting mouse clicks during drawing
    const overlayPane = m.getPanes().overlayPane;
    overlayPane.style.pointerEvents = "none";

    let start: L.LatLng | null = null;
    let tmp: L.Rectangle | null = null;

    const onMouseDown = (ev: L.LeafletMouseEvent) => {
      start = ev.latlng;
      if (tmp) {
        tmp.remove();
        tmp = null;
      }
      tmp = L.rectangle(L.latLngBounds(start, start), {
        color: "#ffffff",
        weight: 1.5,
        fillColor: "#ffffff",
        fillOpacity: 0.15,
        interactive: false,
      }).addTo(m);
    };

    const onMouseMove = (ev: L.LeafletMouseEvent) => {
      if (start && tmp) {
        tmp.setBounds(L.latLngBounds(start, ev.latlng));
      }
    };

    const onMouseUp = (ev: L.LeafletMouseEvent) => {
      if (!start) return;
      const b = L.latLngBounds(start, ev.latlng);
      if (tmp) {
        tmp.remove();
        tmp = null;
      }
      start = null;
      const dLon = Math.abs(b.getEast() - b.getWest());
      const dLat = Math.abs(b.getNorth() - b.getSouth());
      if (dLon > 1e-5 && dLat > 1e-5) {
        latest.current.onBBox([
          Math.min(b.getWest(), b.getEast()),
          Math.min(b.getSouth(), b.getNorth()),
          Math.max(b.getWest(), b.getEast()),
          Math.max(b.getSouth(), b.getNorth()),
        ]);
      }
      latest.current.onDrawEnd();
    };

    m.on("mousedown", onMouseDown);
    m.on("mousemove", onMouseMove);
    m.on("mouseup", onMouseUp);

    return () => {
      m.off("mousedown", onMouseDown);
      m.off("mousemove", onMouseMove);
      m.off("mouseup", onMouseUp);
      if (tmp) tmp.remove();
      m.dragging.enable();
      c.style.cursor = "";
      overlayPane.style.pointerEvents = "";
    };
  }, [drawing]);

  return <div ref={el} className="absolute inset-0 bg-[#050505]" />;
}
