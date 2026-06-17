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
};

type DrillLevel = "country" | "province" | "city" | "district";

interface DrillEntry {
  name: string;
  adcode: string;
  level: DrillLevel;
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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Globe({
  places,
  selectedPlaceId,
  onSelectPlace,
}: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const AMapRef = useRef<any>(null);
  const polygonsRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
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
  /*  Sync markers for places                                            */
  /* ------------------------------------------------------------------ */

  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    const AMap = AMapRef.current;
    if (!map || !AMap) return;

    // clear old
    for (const m of markersRef.current) {
      map.remove(m);
    }
    markersRef.current = [];

    // add new
    for (const place of places) {
      const isSelected = place.id === selectedPlaceId;
      const content = `<div style="
        width:${isSelected ? '16' : '11'}px;
        height:${isSelected ? '16' : '11'}px;
        background:${isSelected ? '#f59e0b' : '#4a90d9'};
        border:${isSelected ? '3px solid #d97706' : '2px solid #fff'};
        border-radius:50%;
        box-shadow:0 1px 4px rgba(0,0,0,0.2);
        cursor:pointer;
      "></div>`;

      const marker = new AMap.Marker({
        map,
        position: [place.longitude, place.latitude],
        content,
        offset: new AMap.Pixel(isSelected ? -8 : -5, isSelected ? -8 : -5),
        title: place.name,
        zIndex: isSelected ? 200 : 100,
      });

      marker.on("click", () => onSelectPlace(place.id));
      markersRef.current.push(marker);
    }
  }, [places, selectedPlaceId, onSelectPlace]);

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
      plugins: ["AMap.DistrictSearch"],
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
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0 }}
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
