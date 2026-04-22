"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  tone?: "good" | "attention" | "urgent" | "neutral";
  href?: string;
}

/**
 * Thin react-leaflet wrapper centred on Lagos. Use `next/dynamic` on the
 * parent page with `ssr: false` — Leaflet touches `window` at import time.
 */
export function MapView({
  markers,
  height = 420,
  center = [6.465, 3.406], // Lagos (Victoria Island-ish)
  zoom = 11,
}: {
  markers: MapMarker[];
  height?: number;
  center?: [number, number];
  zoom?: number;
}) {
  useEffect(() => {
    // Leaflet's default icon path assumes webpack magic that doesn't work in
    // Next. Point the icon URLs at a CDN so markers actually render.
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
      ._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-navy-100">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height, width: "100%" }}
      >
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]}>
            <Popup>
              <div className="space-y-1">
                <div className="font-semibold">{m.label}</div>
                {m.href ? (
                  <a
                    href={m.href}
                    className="text-xs font-medium text-blue-600 underline"
                  >
                    View site →
                  </a>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
