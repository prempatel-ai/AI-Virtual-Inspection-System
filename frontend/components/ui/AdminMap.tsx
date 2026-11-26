"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapShopItem } from "../../lib/api";

interface AdminMapProps {
  shops: MapShopItem[];
  selectedShopId?: string | null;
  onSelectShop?: (shop: MapShopItem) => void;
  className?: string;
}

export default function AdminMap({
  shops,
  selectedShopId,
  onSelectShop,
  className = "w-full h-[650px]",
}: AdminMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markersMapRef = useRef<Map<string, L.CircleMarker>>(new Map());

  // 1. Initialize Map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Gujarat bounding box and centroid
    const gujaratCenter: [number, number] = [22.8, 71.7];
    const map = L.map(containerRef.current, {
      center: gujaratCenter,
      zoom: 7,
      minZoom: 6,
      maxZoom: 16,
      maxBounds: [
        [19.5, 67.0], // Southwest bounds (including Kutch & coastal Saurashtra)
        [24.9, 75.0], // Northeast bounds
      ],
      maxBoundsViscosity: 0.85,
      zoomControl: true,
      attributionControl: true,
    });

    // CartoDB Voyager basemap with verified API key for crisp government-grade rendering
    const cartoApiKey =
      process.env.NEXT_PUBLIC_CARTO_API_KEY || "cb1_5gnv_1_5066a35bc2c5d5cf2138d413";
    const tileUrl = cartoApiKey
      ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    L.tileLayer(tileUrl, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Sync shop pins whenever shops list changes
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markersMapRef.current.clear();

    shops.forEach((shop) => {
      const isHigh = shop.band === "high";
      const isMedium = shop.band === "medium";

      // Color tokens matching project accessible theme
      const color = isHigh ? "#B42318" : isMedium ? "#93370D" : "#067647";
      const badgeBg = isHigh ? "#FEF3F2" : isMedium ? "#FFFAEB" : "#ECFDF3";
      const badgeBorder = isHigh ? "#FECDCA" : isMedium ? "#FEDF89" : "#A6F4C5";
      const radius = isHigh ? 8 : isMedium ? 6 : 5;

      const marker = L.circleMarker([shop.lat, shop.lng], {
        radius,
        fillColor: color,
        color: "#FFFFFF",
        weight: 1.5,
        opacity: 1,
        fillOpacity: isHigh ? 0.95 : 0.85,
      });

      const signalsHtml = (shop.top_signals || [])
        .slice(0, 3)
        .map(
          (s) =>
            `<li style="display:flex; justify-content:space-between; margin-bottom:2px; font-size:11px;">` +
            `<span style="color:#5B636E;">${s.label}</span>` +
            `<strong style="color:${color};">+${s.points}</strong></li>`
        )
        .join("");

      const popupHtml = `
        <div style="font-family: inherit; font-size: 13px; min-width: 220px; max-width: 270px; color: #20242A; line-height: 1.35;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
            <div>
              <div style="font-weight: 700; font-size: 13px;">${shop.name}</div>
              <div style="font-size: 11px; font-family: monospace; color: #5B636E; margin-top: 1px;">ID: ${shop.shop_id}</div>
            </div>
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${badgeBg}; color: ${color}; border: 1px solid ${badgeBorder}; white-space: nowrap;">
              ${shop.band} (${shop.risk_score.toFixed(1)})
            </span>
          </div>

          <div style="font-size: 11px; color: #5B636E; margin-bottom: 6px; border-bottom: 1px solid #DDE1E6; padding-bottom: 4px;">
            ${shop.taluka} Taluka, ${shop.district} District
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #5B636E; margin-bottom: 6px;">
            <span>Cards: <strong style="color: #20242A;">${shop.cards_count}</strong></span>
            <span>Vulnerability: <strong style="color: #20242A;">${(shop.vulnerability_index * 100).toFixed(0)}%</strong></span>
          </div>

          ${
            signalsHtml
              ? `<div style="margin-bottom: 6px;">
                  <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #5B636E; margin-bottom: 2px;">Top Risk Signals</div>
                  <ul style="list-style: none; padding: 0; margin: 0;">${signalsHtml}</ul>
                </div>`
              : ""
          }

          <div style="margin-top: 8px; display: flex; gap: 6px;">
            ${
              shop.case_id
                ? `<a href="/cases/${encodeURIComponent(shop.case_id)}" style="display: inline-block; width: 100%; text-align: center; background: #1B5E4B; color: #FFFFFF; padding: 6px 8px; font-size: 11px; font-weight: 600; border-radius: 4px; text-decoration: none;">View Active Case</a>`
                : `<a href="/flags" style="display: inline-block; width: 100%; text-align: center; background: #F6F7F8; color: #20242A; border: 1px solid #DDE1E6; padding: 6px 8px; font-size: 11px; font-weight: 600; border-radius: 4px; text-decoration: none;">Inspect Flags</a>`
            }
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 290 });
      marker.bindTooltip(
        `${shop.name} (${shop.band.toUpperCase()}: ${shop.risk_score.toFixed(1)})`,
        { direction: "top", offset: [0, -6] }
      );

      marker.on("click", () => {
        onSelectShop?.(shop);
      });

      marker.addTo(layer);
      markersMapRef.current.set(shop.shop_id, marker);
    });
  }, [shops, onSelectShop]);

  // 3. Highlight / Fly to selected shop when selectedShopId changes
  useEffect(() => {
    if (!selectedShopId || !mapRef.current) return;
    const marker = markersMapRef.current.get(selectedShopId);
    if (marker) {
      const latLng = marker.getLatLng();
      mapRef.current.flyTo(latLng, 12, { duration: 1.2 });
      marker.openPopup();
    }
  }, [selectedShopId]);

  return (
    <div className={`relative ${className} border border-border rounded-md overflow-hidden bg-surface`}>
      <div ref={containerRef} className="w-full h-full" style={{ zIndex: 0 }} />

      {/* Map Legend (Bottom-Left) */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-bg/95 backdrop-blur-sm border border-border rounded-md px-3 py-2 shadow-sm pointer-events-auto">
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
          Risk Classification
        </div>
        <div className="flex flex-col space-y-1 text-meta">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-risk-high inline-block border border-white" />
            <span className="text-text font-medium">High Risk (Red &middot; Score &ge; 60)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-risk-medium inline-block border border-white" />
            <span className="text-text-muted">Medium Risk (Score 30&ndash;59)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-risk-low inline-block border border-white" />
            <span className="text-text-muted">Low Risk (Score &lt; 30)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
