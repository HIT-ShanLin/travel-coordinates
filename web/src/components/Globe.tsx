import { useCallback, useEffect, useRef, useState } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import type { Place } from "../lib/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type GlobeProps = {
  places: Place[];
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
  onMapClick?: (pos: { lat: number; lng: number }) => void;
};

type DrillLevel = "country" | "province" | "city" | "district";

interface DrillEntry {
  name: string;
  adcode: string;
  level: DrillLevel;
}

/* ------------------------------------------------------------------ */
/*  Point-in-polygon (ray casting)                                     */
/* ------------------------------------------------------------------ */

function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  let inside = false;
  const [px, py] = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/* ------------------------------------------------------------------ */
/*  Style tokens                                                       */
/* ------------------------------------------------------------------ */

const STYLE = {
  polygonFill: "rgba(200,212,224,0.22)",
  polygonStroke: "#8b96a3",
  polygonStrokeWidth: 1.2,
  hoverFill: "rgba(74,144,217,0.18)",
  hoverStroke: "#4a90d9",
};

const PIN_SIZE = 40;
const PIN_SIZE_SELECTED = 48;

/* ------------------------------------------------------------------ */
/*  Pin HTML builder                                                    */
/* ------------------------------------------------------------------ */

function buildPinHTML(place: Place, isSelected: boolean): string {
  const photoUrl = place.photos?.[0]?.url;
  const size = isSelected ? PIN_SIZE_SELECTED : PIN_SIZE;
  const borderColor = isSelected ? "#4a90d9" : "#fff";
  const borderWidth = isSelected ? 3 : 2;
  const bg = isSelected ? "#4a90d9" : "#64748b";
  const letter = place.name?.charAt(0) ?? "?";

  const fallbackHTML = `<div style="
    width:${size}px;height:${size}px;
    border-radius:50%;
    border:${borderWidth}px solid ${borderColor};
    background:${bg};color:#fff;
    display:flex;align-items:center;justify-content:center;
    font-size:${isSelected ? "1.1rem" : "0.95rem"};font-weight:700;
    box-shadow:0 2px 12px rgba(0,0,0,0.28);
    cursor:pointer;
    font-family:Inter,'PingFang SC',sans-serif;
  ">${letter}</div>`;

  if (!photoUrl) return fallbackHTML;

  // use <img> tag with onerror fallback to the letter circle
  return `<div style="
    width:${size}px;height:${size}px;
    border-radius:50%;
    border:${borderWidth}px solid ${borderColor};
    box-shadow:0 2px 12px rgba(0,0,0,0.28);
    cursor:pointer;overflow:hidden;
    position:relative;
    background:${bg};
  ">
    <img src="${photoUrl}" alt="${place.name}"
      style="width:100%;height:100%;object-fit:cover;display:block;"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
    />
    <div style="
      display:none;width:100%;height:100%;
      align-items:center;justify-content:center;
      color:#fff;font-size:${isSelected ? "1.1rem" : "0.95rem"};font-weight:700;
      font-family:Inter,'PingFang SC',sans-serif;
      position:absolute;top:0;left:0;
    ">${letter}</div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Globe({
  places,
  selectedPlaceId,
  onSelectPlace,
  onMapClick,
}: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const tempMarkerRef = useRef<any>(null);
  const AMapRef = useRef<any>(null);
  const polygonsRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  const labelsRef = useRef<any[]>([]);
  const placesRef = useRef<Place[]>(places);
  placesRef.current = places;
  const clusterRef = useRef<any>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const drillStackRef = useRef<DrillEntry[]>([]);
  const [drillLabel, setDrillLabel] = useState("中国");
  const [ready, setReady] = useState(false);
  const initRef = useRef(false);

  /* ------------------------------------------------------------------ */
  /*  Helper: clear current polygons                                    */
  /* ------------------------------------------------------------------ */

  const clearPolygons = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const p of polygonsRef.current) {
      map.remove(p);
    }
    polygonsRef.current = [];
    for (const l of labelsRef.current) {
      map.remove(l);
    }
    labelsRef.current = [];
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Helper: render district boundaries as polygons                    */
  /* ------------------------------------------------------------------ */

  const renderDistrict = useCallback(
    (districtList: any[], parentName: string) => {
      const map = mapRef.current;
      const AMap = AMapRef.current;
      if (!map || !AMap) return;

      clearPolygons();

      for (const d of districtList) {
        if (!d.boundaries || d.boundaries.length === 0) continue;
        for (const bound of d.boundaries) {
          const poly = new AMap.Polygon({
            map,
            path: bound,
            fillColor: STYLE.polygonFill,
            fillOpacity: 1,
            strokeColor: STYLE.polygonStroke,
            strokeWeight: STYLE.polygonStrokeWidth,
            strokeStyle: "solid",
            strokeDasharray: undefined,
            cursor: "pointer",
          });

          // store district info on polygon
          (poly as any)._districtName = d.name;
          (poly as any)._districtAdcode = d.adcode;
          (poly as any)._districtLevel = d.level;

          // hover
          poly.on("mouseover", () => {
            poly.setOptions({
              fillColor: STYLE.hoverFill,
              strokeColor: STYLE.hoverStroke,
            });
          });
          poly.on("mouseout", () => {
            poly.setOptions({
              fillColor: STYLE.polygonFill,
              strokeColor: STYLE.polygonStroke,
            });
          });

          // click to drill down
          poly.on("click", () => {
            drillDown(d.name, d.adcode || "", d.level || "province");
          });

          polygonsRef.current.push(poly);
        }
      }

      map.setFitView(polygonsRef.current);

      // add place count labels
      const currentPlaces = placesRef.current;
      for (const poly of polygonsRef.current) {
        const districtName = (poly as any)._districtName as string;
        const boundary = poly.getPath() as [number, number][];
        if (!boundary || boundary.length === 0) continue;

        // count places inside this polygon
        const count = currentPlaces.filter((p) =>
          pointInPolygon([p.longitude, p.latitude], boundary),
        ).length;
        if (count === 0) continue;

        // calculate center of polygon for label position
        let cx = 0,
          cy = 0;
        for (const [x, y] of boundary) {
          cx += x;
          cy += y;
        }
        cx /= boundary.length;
        cy /= boundary.length;

        const label = new AMap.Text({
          map,
          text: `${districtName} ${count}`,
          position: [cx, cy],
          style: {
            "background": "rgba(74,144,217,0.85)",
            "border": "none",
            "border-radius": "8px",
            "padding": "2px 8px",
            "color": "#fff",
            "font-size": "11px",
            "font-weight": "600",
            "font-family": "Inter, PingFang SC, sans-serif",
            "white-space": "nowrap",
            "pointer-events": "none",
          },
        });
        labelsRef.current.push(label);
      }
    },
    [clearPolygons],
  );

  /* ------------------------------------------------------------------ */
  /*  Drill down                                                         */
  /* ------------------------------------------------------------------ */

  const drillDown = useCallback(
    (name: string, adcode: string, level: string) => {
      const AMap = AMapRef.current;
      if (!AMap) return;

      const ds = new AMap.DistrictSearch({
        extensions: "all",
        subdistrict: 1,
        level,
      });

      ds.search(adcode || name, (_status: string, result: any) => {
        if (!result?.districtList?.[0]) return;

        const parent = result.districtList[0];
        const children = parent.districtList ?? [];

        if (children.length === 0) return;

        drillStackRef.current.push({
          name: parent.name,
          adcode: parent.adcode ?? adcode,
          level: level as DrillLevel,
        });
        setDrillLabel(children[0]?.level === "street" ? name : `${name} · ${children.length} 个下级区域`);
        renderDistrict(children, parent.name);
      });
    },
    [renderDistrict],
  );

  /* ------------------------------------------------------------------ */
  /*  Drill up                                                           */
  /* ------------------------------------------------------------------ */

  const drillUp = useCallback(() => {
    const stack = drillStackRef.current;
    if (stack.length <= 1) {
      // back to top (China provinces)
      drillStackRef.current = [];
      setDrillLabel("中国");
      drillDown("中国", "100000", "country");
      return;
    }

    // pop current level
    stack.pop();
    const parent = stack[stack.length - 1];

    const AMap = AMapRef.current;
    if (!AMap) return;

    const ds = new AMap.DistrictSearch({
      extensions: "all",
      subdistrict: 1,
      level: parent.level,
    });

    ds.search(parent.adcode || parent.name, (_status: string, result: any) => {
      if (!result?.districtList?.[0]) return;
      const p = result.districtList[0];
      const children = p.districtList ?? [];
      setDrillLabel(`${p.name} · ${children.length} 个下级区域`);
      renderDistrict(children, p.name);
    });
  }, [drillDown, renderDistrict]);

  /* ------------------------------------------------------------------ */
  /*  Tooltip helpers                                                    */
  /* ------------------------------------------------------------------ */

  const showTooltip = useCallback((position: [number, number], place: Place) => {
    const map = mapRef.current;
    if (!map) return;
    const pixel = map.lngLatToContainer(position);
    const el = tooltipRef.current;
    if (!el) return;

    el.innerHTML = `
      <strong>${place.name}</strong>
      <span>${[place.country, place.city].filter(Boolean).join(" · ") || "未知地点"}</span>
    `;
    el.style.display = "block";
    el.style.left = `${pixel.x}px`;
    el.style.top = `${pixel.y - PIN_SIZE / 2 - 44}px`;
  }, []);

  const hideTooltip = useCallback(() => {
    const el = tooltipRef.current;
    if (!el) return;
    el.style.display = "none";
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Sync markers for places                                            */
  /* ------------------------------------------------------------------ */

  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    const AMap = AMapRef.current;
    if (!map || !AMap) return;

    // clear old cluster
    if (clusterRef.current) {
      try { clusterRef.current.setMap(null); } catch (e) { /* ignore */ }
      clusterRef.current = null;
    }

    // clear old markers
    for (const m of markersRef.current) {
      map.remove(m);
    }
    markersRef.current = [];

    if (places.length === 0) return;

    // build new markers
    const newMarkers: any[] = [];
    for (const place of places) {
      const isSelected = place.id === selectedPlaceId;
      const content = buildPinHTML(place, isSelected);

      const marker = new AMap.Marker({
        position: [place.longitude, place.latitude],
        content,
        offset: new AMap.Pixel(
          isSelected ? -PIN_SIZE_SELECTED / 2 : -PIN_SIZE / 2,
          isSelected ? -PIN_SIZE_SELECTED / 2 : -PIN_SIZE / 2,
        ),
        title: place.name,
        zIndex: isSelected ? 200 : 100,
      });

      // hover → tooltip (PC only)
      marker.on("mouseover", () => {
        showTooltip([place.longitude, place.latitude], place);
        // scale up effect via DOM
        const contentEl = marker.getContent?.();
        if (contentEl) {
          contentEl.style.transform = "scale(1.1)";
        }
      });
      marker.on("mouseout", () => {
        hideTooltip();
        const contentEl = marker.getContent?.();
        if (contentEl) {
          contentEl.style.transform = "scale(1)";
        }
      });

      // click → flyTo + select
      marker.on("click", () => {
        hideTooltip();
        map.setZoomAndCenter(12, [place.longitude, place.latitude], true, 800);
        onSelectPlace(place.id);
      });

      newMarkers.push(marker);
    }

    markersRef.current = newMarkers;

    // clustering — guarded against AMap API differences
    if (AMap.MarkerClusterer) {
      try {
        const cluster = new AMap.MarkerClusterer(map, newMarkers, {
          gridSize: 80,
          minClusterSize: 2,
          maxZoom: 13,
          averageCenter: true,
          clusterByZoomChange: false,
          styles: [
            {
              url: "",
              size: { width: 44, height: 44 },
              textColor: "#fff",
              textSize: 13,
            },
          ],
          renderClusterMarker: (context: any) => {
            const count = context.count;
            const html = `<div style="
              width:44px;height:44px;
              border-radius:50%;
              background:linear-gradient(135deg,#4a90d9,#2563eb);
              color:#fff;
              display:flex;align-items:center;justify-content:center;
              font-size:${count >= 100 ? "0.75rem" : "0.85rem"};font-weight:700;
              box-shadow:0 2px 12px rgba(37,99,235,0.4);
              cursor:pointer;
              border:2px solid #fff;
              font-family:Inter,'PingFang SC',sans-serif;
            ">+${count}</div>`;
            context.marker.setContent(html);
            context.marker.setOffset(new AMap.Pixel(-22, -22));
          },
        });
        clusterRef.current = cluster;
      } catch (e) {
        console.warn("聚类初始化失败，使用独立标记:", e);
        clusterRef.current = null;
        for (const m of newMarkers) {
          m.setMap(map);
        }
      }
    } else {
      // no cluster plugin — add markers directly to map
      for (const m of newMarkers) {
        m.setMap(map);
      }
    }
  }, [places, selectedPlaceId, onSelectPlace, showTooltip, hideTooltip]);

  /* ------------------------------------------------------------------ */
  /*  Init Amap                                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const key = import.meta.env.VITE_AMAP_KEY;
    const secret = import.meta.env.VITE_AMAP_SECRET;

    if (!key || !secret) {
      console.warn("请在 web/.env 中设置 VITE_AMAP_KEY 和 VITE_AMAP_SECRET");
      return;
    }

    // security config must be set before Amap loads
    (window as any)._AMapSecurityConfig = {
      securityJsCode: secret,
    };

    AMapLoader.load({
      key,
      version: "2.0",
      plugins: ["AMap.DistrictSearch", "AMap.MarkerClusterer"],
    })
      .then((AMap: any) => {
        AMapRef.current = AMap;

        const map = new AMap.Map(containerRef.current, {
          zoom: 4,
          center: [108, 35],
          viewMode: "2D",
          showLabel: true,
          labelzIndex: 50,
          resizeEnable: true,
          dragEnable: true,
          zoomEnable: true,
          scrollWheel: true,
          doubleClickZoom: false,
          keyboardEnable: false,
        });

        mapRef.current = map;

        // load initial China province boundaries
        drillDown("中国", "100000", "country");
        setReady(true);

        // Map click → create temporary pin + notify parent
        map.on('click', (e: any) => {
          const { lng, lat } = e.lnglat;
          if (tempMarkerRef.current) {
            map.remove(tempMarkerRef.current);
          }
          const marker = new AMap.Marker({
            position: [lng, lat],
            anchor: 'center',
            content: '<div class="temp-pin"></div>',
          });
          map.add(marker);
          tempMarkerRef.current = marker;
          if (onMapClick) {
            onMapClick({ lat, lng });
          }
        });
      })
      .catch((e: any) => console.error("Amap load failed", e));

    return () => {
      mapRef.current?.destroy();
    };
  }, []); // eslint-disable-line

  /* ------------------------------------------------------------------ */
  /*  Sync markers when places/selection changes                         */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!ready) return;
    syncMarkers();
  }, [ready, syncMarkers]);

  /* ------------------------------------------------------------------ */
  /*  Listen for locate event from App.tsx                               */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    function handleLocate(e: Event) {
      const map = mapRef.current;
      const AMap = AMapRef.current;
      if (!map || !AMap) return;
      const { latitude, longitude } = (e as CustomEvent).detail;
      map.setZoomAndCenter(14, [longitude, latitude], true, 1200);
      // add a temporary "you are here" marker
      const marker = new AMap.Marker({
        map,
        position: [longitude, latitude],
        content: `<div style="
          width:16px;height:16px;
          border-radius:50%;
          background:#3b82f6;
          border:3px solid #fff;
          box-shadow:0 0 0 6px rgba(59,130,246,0.3),0 2px 8px rgba(0,0,0,0.3);
        "></div>`,
        offset: new AMap.Pixel(-8, -8),
        zIndex: 300,
      });
      // remove after 3 seconds
      setTimeout(() => {
        map.remove(marker);
      }, 3000);
    }
    window.addEventListener("locate", handleLocate);
    return () => window.removeEventListener("locate", handleLocate);
  }, [ready]);

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0 }}
      />

      {/* tooltip */}
      <div
        ref={tooltipRef}
        className="pin-tooltip"
        style={{
          display: "none",
          position: "absolute",
          zIndex: 30,
          transform: "translateX(-50%)",
          pointerEvents: "none",
        }}
      />

      {!ready && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 5,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#e8f0f6",
        }}>
          <span style={{ padding: "10px 20px", borderRadius: 10, background: "#fff", color: "#4a90d9", fontWeight: 600 }}>
            {import.meta.env.VITE_AMAP_KEY ? "加载地图中..." : "请配置高德 API Key"}
          </span>
        </div>
      )}

      {ready && null}

      <div className="globe-hint" style={{ position: "absolute", left: 14, bottom: 72, zIndex: 5, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.8)", color: "#9ca6b0", fontSize: "0.72rem" }}>
        点击区域下钻 · 滚轮缩放
      </div>
    </div>
  );
}
