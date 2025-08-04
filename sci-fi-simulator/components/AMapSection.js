"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";

/* -----------------------------------------------------------
 * CONSTANTS
 * --------------------------------------------------------- */
const soldierColors = [
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#FFA500",
  "#800080",
  "#FFFFFF",
  "#000000",
];

/* ===========================================================
 *  COMPONENT
 * ========================================================= */
export default function MapSection({
  soldiers = [],
  selectedSoldierId,
  isReplayMode = false,
}) {
  /* ---------- refs ---------- */
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const outOfBoundsMarkersRef = useRef({});
  const distanceLinesRef = useRef({});
  const distanceLabelsRef = useRef({});
  const mapInitializedRef = useRef(false);
  const mbTilesLayerRef = useRef(null);
  const mapContainerRef = useRef(null);

  /* ---------- previous soldiers snapshot ---------- */
  const prevSoldiersDataRef = useRef({});

  /* ---------- state ---------- */
  const [trailsData, setTrailsData] = useState({});
  const [colorMap, setColorMap] = useState({});
  const [loader, setLoader] = useState("");
  const [progress, setProgress] = useState(0);
  const [mapBounds, setMapBounds] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [mapMetadataBounds, setMapMetadataBounds] = useState(null);
  const [outOfBoundsSoldiers, setOutOfBoundsSoldiers] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPathTracking, setShowPathTracking] = useState(true);

  /* ===========================================================
   *  PURE HELPERS
   * ========================================================= */
  const generateColorFromId = useCallback((id) => {
    if (!id || typeof id !== "string") return soldierColors[0];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash &= hash;
    }
    return soldierColors[Math.abs(hash) % soldierColors.length];
  }, []);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const isWithinBounds = (lat, lng, bounds) =>
    !bounds ||
    (lat >= bounds.south &&
      lat <= bounds.north &&
      lng >= bounds.west &&
      lng <= bounds.east);

  const parseBounds = (boundsString) => {
    if (!boundsString) return null;
    const c = boundsString.split(",").map(Number);
    return c.length === 4
      ? { west: c[0], south: c[1], east: c[2], north: c[3] }
      : null;
  };

  /* ---------- change‑detection utilities ---------- */
  const hasSoldierChanged = (s, p) =>
    !p ||
    s.gps?.latitude !== p.gps?.latitude ||
    s.gps?.longitude !== p.gps?.longitude ||
    s.hit_status !== p.hit_status ||
    s.imu?.yaw !== p.imu?.yaw;

  const getChangedSoldiers = useCallback(() => {
    const changed = [];
    const currentIds = new Set();

    soldiers.forEach((s) => {
      if (s?.soldier_id) {
        currentIds.add(s.soldier_id);
        if (hasSoldierChanged(s, prevSoldiersDataRef.current[s.soldier_id]))
          changed.push(s);
      }
    });

    const removed = Object.keys(prevSoldiersDataRef.current).filter(
      (id) => !currentIds.has(id)
    );

    return { changedSoldiers: changed, removedSoldierIds: removed };
  }, [soldiers]);

  const updatePrevSoldiersData = useCallback(() => {
    const snap = {};
    soldiers.forEach((s) => {
      if (s?.soldier_id) {
        snap[s.soldier_id] = {
          gps: { ...s.gps },
          hit_status: s.hit_status,
          imu: { ...s.imu },
        };
      }
    });
    prevSoldiersDataRef.current = snap;
  }, [soldiers]);

  /* ===========================================================
   *  UI TOGGLES
   * ========================================================= */
  const toggleFullscreen = () => {
    const c = document.querySelector(".map-container");
    if (!document.fullscreenElement) {
      c?.requestFullscreen().then(() => {
        setIsFullscreen(true);
        setTimeout(() => mapRef.current?.invalidateSize(), 100);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        setTimeout(() => mapRef.current?.invalidateSize(), 100);
      });
    }
  };
  const togglePathTracking = () => setShowPathTracking((v) => !v);

  /* -------- debug -------- */
  useEffect(() => console.log("Soldiers prop:", soldiers), [soldiers]);
  useEffect(() => {
    const h = () =>
      setIsFullscreen(!!document.fullscreenElement) ||
      setTimeout(() => mapRef.current?.invalidateSize(), 100);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  /* ===========================================================
   *  MAP INITIALISATION
   * ========================================================= */
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = document.getElementById("mapid");
      if (
        !container ||
        mapInitializedRef.current ||
        container._leaflet_id ||
        container.hasChildNodes()
      ) {
        if (!container) setLoader("Error: Map container not found");
        return;
      }

      mapContainerRef.current = container;

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "/leaflet.css";
        document.head.appendChild(link);
      }

      setLoader("Initializing map…");

      try {
        mapRef.current = L.map(container, {
          center: [28.5471399, 77.1945754],
          zoom: 15,
          minZoom: 10,
          maxZoom: 21,
          preferCanvas: true,
          attributionControl: false,
        });

        class MBTilesLayer extends L.TileLayer {
          _db = null;

          loadMBTilesFromArrayBuffer = (buf) => {
            try {
              this._db = new window.SQL.Database(new Uint8Array(buf));
              this._getMetadata();
              setLoader("");
              setProgress(100);
              setMapLoaded(true);
              setShowControls(false);
              this.redraw();
            } catch (e) {
              console.error(e);
              setLoader(`Error loading MBTiles: ${e.message}`);
              setProgress(0);
            }
          };

          _getMetadata = () => {
            if (!this._db) return;
            try {
              const meta = {};
              const mStmt = this._db.prepare(
                "SELECT name,value FROM metadata"
              );
              while (mStmt.step()) {
                const r = mStmt.getAsObject();
                meta[r.name] = r.value;
              }
              mStmt.free();

              if (meta.bounds) setMapMetadataBounds(parseBounds(meta.bounds));

              const zStmt = this._db.prepare(
                "SELECT DISTINCT zoom_level FROM tiles ORDER BY zoom_level"
              );
              const zooms = [];
              while (zStmt.step()) zooms.push(zStmt.getAsObject().zoom_level);
              zStmt.free();

              const minZ = Math.min(...zooms);
              const maxZ = Math.max(...zooms);
              this.options.minZoom = minZ;
              this.options.maxZoom = Math.min(maxZ, 21);
              mapRef.current.setMinZoom(minZ);
              mapRef.current.setMaxZoom(Math.min(maxZ, 21));

              if (meta.bounds) {
                const b = meta.bounds.split(",").map(Number);
                const leafletBounds = L.latLngBounds(
                  [b[1], b[0]],
                  [b[3], b[2]]
                );
                setMapBounds(leafletBounds);
                const idealZ =
                  mapRef.current.getBoundsZoom(leafletBounds);
                const z = Math.max(minZ, Math.min(idealZ, maxZ - 1));
                setTimeout(
                  () =>
                    mapRef.current.fitBounds(leafletBounds, {
                      maxZoom: z,
                      padding: [10, 10],
                    }),
                  100
                );
              }
            } catch (e) {
              console.error("Metadata error:", e);
            }
          };

          loadMBTilesFromPath = (path) => {
            setLoader(`Loading ${path}…`);
            setProgress(0);
            setMapLoaded(false);

            fetch(path)
              .then(async (res) => {
                if (!res.ok)
                  throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                const total = +res.headers.get("Content-Length") || 0;
                const r = res.body.getReader();
                const chunks = [];
                let loaded = 0;

                while (true) {
                  const { done, value } = await r.read();
                  if (done) break;
                  chunks.push(value);
                  loaded += value.length;
                  if (total) {
                    const pct = Math.round((loaded / total) * 100);
                    setProgress(pct);
                    setLoader(`Loading map: ${pct}%`);
                  } else {
                    setLoader(
                      `Loading map: ${Math.round(loaded / 1048576)} MB`
                    );
                  }
                }

                const buf = new Uint8Array(loaded);
                let off = 0;
                chunks.forEach((c) => {
                  buf.set(c, off);
                  off += c.length;
                });
                this.loadMBTilesFromArrayBuffer(buf.buffer);
              })
              .catch((e) => {
                console.error(e);
                setLoader(`Error: ${e.message}`);
                setProgress(0);
              });
          };

          createTile(coords, done) {
            const img = document.createElement("img");
            img.crossOrigin = "anonymous";
            img.style.background = "#0a0a0a";
            img.style.imageRendering = "pixelated";

            if (!this._db) {
              img.src =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII=";
              setTimeout(() => done(null, img), 100);
              return img;
            }

            const { z, x } = coords;
            const y = Math.pow(2, z) - coords.y - 1;

            try {
              const stmt = this._db.prepare(
                "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?"
              );
              stmt.bind([z, x, y]);

              if (stmt.step()) {
                const data = stmt.getAsObject().tile_data;
                if (data?.length) {
                  const url = URL.createObjectURL(
                    new Blob([new Uint8Array(data)], { type: "image/png" })
                  );
                  img.onload = () => {
                    URL.revokeObjectURL(url);
                    done(null, img);
                  };
                  img.onerror = () => {
                    URL.revokeObjectURL(url);
                    img.src =
                      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII=";
                    done(null, img);
                  };
                  img.src = url;
                } else {
                  img.src =
                    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII=";
                  done(null, img);
                }
              } else {
                img.src =
                  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII=";
                done(null, img);
              }
              stmt.free();
            } catch (e) {
              console.error(e);
              img.src =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII=";
              done(null, img);
            }
            return img;
          }
        }

        mbTilesLayerRef.current = new MBTilesLayer({ tms: true }).addTo(
          mapRef.current
        );

        setLoader("Please load Map file");
        mapInitializedRef.current = true;

        const s = document.createElement("script");
        s.src = "/sqljs/sql-wasm.js";
        s.onload = () =>
          window
            .initSqlJs({ locateFile: () => "/sqljs/sql-wasm.wasm" })
            .then((SQL) => (window.SQL = SQL))
            .catch((e) => setLoader(`SQL.js Error: ${e.message}`));
        s.onerror = () => setLoader("Error: Failed to load SQL.js");
        document.body.appendChild(s);
      } catch (e) {
        console.error("Map Error:", e);
        setLoader(`Map Error: ${e.message}`);
      }
    }, 0);

    return () => {
      clearTimeout(timer);
      try {
        mapRef.current?.remove();
      } catch {}
      if (mapContainerRef.current?._leaflet_id)
        delete mapContainerRef.current._leaflet_id;

      markersRef.current = {};
      outOfBoundsMarkersRef.current = {};
      distanceLinesRef.current = {};
      distanceLabelsRef.current = {};
      mbTilesLayerRef.current = null;
      mapInitializedRef.current = false;
      mapContainerRef.current = null;
      setMapLoaded(false);
      setProgress(0);
    };
  }, []);

  /* ===========================================================
   *  COLOUR MAP
   * ========================================================= */
  useEffect(() => {
    const { changedSoldiers } = getChangedSoldiers();
    if (!changedSoldiers.length) return;
    setColorMap((prev) => {
      const next = { ...prev };
      let added = false;
      changedSoldiers.forEach((s) => {
        if (!next[s.soldier_id]) {
          next[s.soldier_id] = generateColorFromId(s.soldier_id);
          added = true;
        }
      });
      return added ? next : prev;
    });
  }, [soldiers, getChangedSoldiers, generateColorFromId]);

  /* ===========================================================
   *  TRAILS
   * ========================================================= */
  useEffect(() => {
    if (!mapInitializedRef.current) return;
    const { changedSoldiers } = getChangedSoldiers();
    if (!changedSoldiers.length) return;

    setTrailsData((prev) => {
      const next = { ...prev };
      let upd = false;
      changedSoldiers.forEach((s) => {
        if (typeof s.gps?.latitude === "number") {
          const id = s.soldier_id;
          const pt = [s.gps.latitude, s.gps.longitude];
          if (!next[id]) next[id] = [];
          const last = next[id][next[id].length - 1];
          if (!last || last[0] !== pt[0] || last[1] !== pt[1]) {
            next[id] = [...next[id], pt];
            upd = true;
          }
        }
      });
      return upd ? next : prev;
    });
  }, [soldiers, getChangedSoldiers]);

  /* ===========================================================
   *  OUT‑OF‑BOUNDS TRACKING
   * ========================================================= */
  useEffect(() => {
    if (!mapMetadataBounds) return setOutOfBoundsSoldiers({});
    const { changedSoldiers, removedSoldierIds } = getChangedSoldiers();
    if (!changedSoldiers.length && !removedSoldierIds.length) return;

    setOutOfBoundsSoldiers((prev) => {
      const next = { ...prev };
      let changed = false;

      removedSoldierIds.forEach((id) => {
        if (next[id]) {
          delete next[id];
          changed = true;
        }
      });

      changedSoldiers.forEach((s) => {
        if (typeof s.gps?.latitude === "number") {
          const id = s.soldier_id;
          const oob = !isWithinBounds(
            s.gps.latitude,
            s.gps.longitude,
            mapMetadataBounds
          );
          const already = !!next[id];

          if (oob && !already) {
            next[id] = {
              originalLat: s.gps.latitude,
              originalLng: s.gps.longitude,
              soldier: s,
            };
            changed = true;
          } else if (!oob && already) {
            delete next[id];
            changed = true;
          } else if (oob && already) {
            next[id].originalLat = s.gps.latitude;
            next[id].originalLng = s.gps.longitude;
            next[id].soldier = s;
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [soldiers, mapMetadataBounds, getChangedSoldiers]);

  /* ===========================================================
   *  MARKERS
   * ========================================================= */
  useEffect(() => {
    if (!mapInitializedRef.current || !mapRef.current) return;
    const map = mapRef.current;
    const { changedSoldiers, removedSoldierIds } = getChangedSoldiers();

    removedSoldierIds.forEach((id) => {
      if (markersRef.current[id]) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
      if (outOfBoundsMarkersRef.current[id]) {
        map.removeLayer(outOfBoundsMarkersRef.current[id]);
        delete outOfBoundsMarkersRef.current[id];
      }
    });

    changedSoldiers.forEach((s) => {
      if (outOfBoundsMarkersRef.current[s.soldier_id]) {
        map.removeLayer(outOfBoundsMarkersRef.current[s.soldier_id]);
        delete outOfBoundsMarkersRef.current[s.soldier_id];
      }
    });

    /* ----- OOB markers ----- */
    Object.entries(outOfBoundsSoldiers).forEach(([id, data]) => {
      const soldierChanged = changedSoldiers.some((s) => s.soldier_id === id);
      if (!soldierChanged && outOfBoundsMarkersRef.current[id]) return;

      const { soldier } = data;
      const base = colorMap[id] || generateColorFromId(id);
      const color = soldier.hit_status ? "#ff4444" : base;
      const yaw = soldier.imu?.yaw || 0;

      const svg = `
        <svg width="30" height="30">
          <circle cx="15" cy="15" r="12" fill="${color}" opacity="0.8"
                  stroke="#ff0000" stroke-width="3" stroke-dasharray="2,2">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite"/>
          </circle>
          <circle cx="15" cy="15" r="8" fill="${color}" opacity="0.9"/>
          <line x1="15" y1="15" x2="15" y2="3"
                stroke="#000" stroke-width="2"
                transform="rotate(${yaw},15,15)"/>
          <text x="15" y="25" text-anchor="middle" fill="#ff0000" font-size="8" font-weight="bold">OUT</text>
        </svg>`;

      const icon = L.divIcon({
        className: "out-of-bounds-marker",
        html: svg,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const m = L.marker(map.getCenter(), { icon }).bindPopup(
        `<b>${id} - OUT OF BOUNDS</b><br/>
         Original Lat: ${data.originalLat}<br/>
         Original Lng: ${data.originalLng}<br/>
         Color: ${base}<br/>
         <span style="color:#ff0000;font-weight:bold;">Location outside map area!</span>`
      );
      m.addTo(map);
      outOfBoundsMarkersRef.current[id] = m;
    });

    /* ----- in‑bounds ----- */
    changedSoldiers.forEach((s) => {
      if (typeof s.gps?.latitude !== "number") return;
      const id = s.soldier_id;
      if (outOfBoundsSoldiers[id]) {
        if (markersRef.current[id]) {
          map.removeLayer(markersRef.current[id]);
          delete markersRef.current[id];
        }
        return;
      }

      const base = colorMap[id] || generateColorFromId(id);
      const color = s.hit_status ? "#ff4444" : base;
      const yaw = s.imu?.yaw || 0;

      const svg = `
        <svg width="20" height="20">
          <circle cx="10" cy="10" r="8" fill="${color}" opacity="0.8"/>
          <line x1="10" y1="10" x2="10" y2="0"
                stroke="#000" stroke-width="2"
                transform="rotate(${yaw},10,10)"/>
        </svg>`;

      const icon = L.divIcon({
        className: "custom-marker",
        html: svg,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      if (!markersRef.current[id]) {
        markersRef.current[id] = L.marker(
          [s.gps.latitude, s.gps.longitude],
          { icon }
        )
          .bindPopup(
            `<b>${id}</b><br/>Lat: ${s.gps.latitude}<br/>Lng: ${s.gps.longitude}<br/>Color: ${base}`
          )
          .addTo(map);
      } else {
        markersRef.current[id]
          .setLatLng([s.gps.latitude, s.gps.longitude])
          .setIcon(icon)
          .setPopupContent(
            `<b>${id}</b><br/>Lat: ${s.gps.latitude}<br/>Lng: ${s.gps.longitude}<br/>Color: ${base}`
          );
      }
    });

    updatePrevSoldiersData();
  }, [
    soldiers,
    colorMap,
    outOfBoundsSoldiers,
    generateColorFromId,
    getChangedSoldiers,
    updatePrevSoldiersData,
  ]);

  /* ===========================================================
   *  DISTANCE LINES + TRAILS
   * ========================================================= */
  useEffect(() => {
    if (!mapInitializedRef.current || !mapRef.current) return;
    const map = mapRef.current;

    Object.values(distanceLinesRef.current).forEach((l) => map.removeLayer(l));
    Object.values(distanceLabelsRef.current).forEach((m) => map.removeLayer(m));
    distanceLinesRef.current = {};
    distanceLabelsRef.current = {};

    if (showPathTracking) {
      const cc = soldiers.find(
        (s) =>
          s?.soldier_id === "1" &&
          typeof s.gps?.latitude === "number" &&
          typeof s.gps?.longitude === "number"
      );
      if (cc) {
        const ccPos = [cc.gps.latitude, cc.gps.longitude];
        soldiers.forEach((s) => {
          if (
            s?.soldier_id &&
            s.soldier_id !== "1" &&
            typeof s.gps?.latitude === "number" &&
            typeof s.gps?.longitude === "number" &&
            !outOfBoundsSoldiers[s.soldier_id]
          ) {
            const dist = calculateDistance(
              ccPos[0],
              ccPos[1],
              s.gps.latitude,
              s.gps.longitude
            );
            const col = colorMap[s.soldier_id] || generateColorFromId(s.soldier_id);

            distanceLinesRef.current[s.soldier_id] = L.polyline(
              [ccPos, [s.gps.latitude, s.gps.longitude]],
              { color: col, weight: 2, opacity: 0.5, dashArray: "2,4" }
            ).addTo(map);

            const label = dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(2)} km`;
            const mid = [
              (ccPos[0] + s.gps.latitude) / 2,
              (ccPos[1] + s.gps.longitude) / 2,
            ];
            distanceLabelsRef.current[s.soldier_id] = L.marker(mid, {
              icon: L.divIcon({
                className: "distance-label",
                html: `<div style="background:rgba(0,20,40,.8);color:#66fcf1;font-family:'Courier New',monospace;font-size:12px;font-weight:bold;padding:8px 18px;border:1px solid #00ffff;border-radius:4px;white-space:nowrap;min-width:60px;text-align:center">${label}</div>`,
                iconSize: [60, 24],
                iconAnchor: [30, 12],
              }),
            }).addTo(map);
          }
        });
      }
    }

    Object.values(markersRef.current).forEach((m) => {
      if (m.trail) {
        map.removeLayer(m.trail);
        delete m.trail;
      }
    });

    if (showPathTracking) {
      if (!selectedSoldierId) {
        Object.entries(trailsData).forEach(([id, coords]) => {
          if (coords.length < 2 || outOfBoundsSoldiers[id]) return;
          const col = colorMap[id] || generateColorFromId(id);
          const pl = L.polyline(coords, {
            color: col,
            weight: 2,
            opacity: 1,
            dashArray: "4,6",
          }).addTo(map);
          if (markersRef.current[id]) markersRef.current[id].trail = pl;
        });
        Object.values(markersRef.current).forEach((m) => m.setOpacity(1));
        Object.values(outOfBoundsMarkersRef.current).forEach((m) =>
          m.setOpacity(1)
        );
      } else {
        const coords = trailsData[selectedSoldierId] || [];
        if (coords.length > 1 && !outOfBoundsSoldiers[selectedSoldierId]) {
          const col =
            colorMap[selectedSoldierId] || generateColorFromId(selectedSoldierId);
          const pl = L.polyline(coords, {
            color: col,
            weight: 3,
            opacity: 1,
            dashArray: "4,2",
          }).addTo(map);
          if (markersRef.current[selectedSoldierId])
            markersRef.current[selectedSoldierId].trail = pl;
        }
        Object.entries(markersRef.current).forEach(([id, m]) =>
          m.setOpacity(id === selectedSoldierId ? 1 : 0.3)
        );
        Object.entries(outOfBoundsMarkersRef.current).forEach(([id, m]) =>
          m.setOpacity(id === selectedSoldierId ? 1 : 0.3)
        );

        const sel =
          markersRef.current[selectedSoldierId] ||
          outOfBoundsMarkersRef.current[selectedSoldierId];
        if (sel) {
          map.setView(sel.getLatLng(), map.getZoom());
        }
      }
    } else {
      Object.values(markersRef.current).forEach((m) => m.setOpacity(1));
      Object.values(outOfBoundsMarkersRef.current).forEach((m) =>
        m.setOpacity(1)
      );
    }
  }, [
    soldiers,
    trailsData,
    selectedSoldierId,
    colorMap,
    outOfBoundsSoldiers,
    showPathTracking,
    generateColorFromId,
  ]);

  /* ===========================================================
   *  HANDLERS
   * ========================================================= */
  const onPath = () => {
    const path = document.getElementById("filepath")?.value;
    if (path && mbTilesLayerRef.current) {
      mbTilesLayerRef.current.loadMBTilesFromPath(path);
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || !mbTilesLayerRef.current) return;

    setLoader(`Loading ${file.name}…`);
    setProgress(0);

    const r = new FileReader();
    r.onprogress = ({ loaded, total }) => {
      if (total) {
        const pct = Math.round((loaded / total) * 100);
        setProgress(pct);
        setLoader(`Loading ${file.name}: ${pct}%`);
      } else {
        setLoader(
          `Loading ${file.name}: ${Math.round(loaded / 1048576)} MB processed`
        );
      }
    };
    r.onload = () =>
      mbTilesLayerRef.current.loadMBTilesFromArrayBuffer(r.result);
    r.onerror = () => {
      setLoader(`Error loading ${file.name}`);
      setProgress(0);
    };
    r.readAsArrayBuffer(file);
  };

  const onFitBounds = () => {
    if (mapBounds && mapRef.current) {
      mapRef.current.fitBounds(mapBounds, { maxZoom: 18, padding: [20, 20] });
    }
  };

  /* ===========================================================
   *  RENDER
   * ========================================================= */
  return (
    <div
      className="map-container"
      style={{ position: "relative", height: "100%", width: "100%" }}
    >
      {/* Leaflet CSS overrides */}
      <style jsx global>{`
        .leaflet-tile {
          image-rendering: crisp-edges !important;
          image-rendering: pixelated !important;
          background: #0a0a0a !important;
        }
        .leaflet-container,
        #mapid {
          background: #0a0a0a !important;
        }
      `}</style>

      {loader && (
        <div className="loader-panel">
          <span
            style={{
              animation: loader.includes("Error")
                ? "none"
                : "pulse 1.5s ease-in-out infinite",
            }}
          >
            {loader}
          </span>
          {progress > 0 && progress < 100 && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}

      {isReplayMode && <div className="aar-mode-indicator">AAR MODE</div>}

      {showControls && !mapLoaded && (
        <div className="scifi-panel">
          <button
            className="close-button"
            onClick={() => setShowControls(false)}
            title="Close Panel"
          >
            ×
          </button>

          <div className="scifi-title">
            {isReplayMode ? "SELECT AAR MAP" : "SELECT MAP"}
          </div>

          <div className="scifi-input-group">
            <label className="scifi-label">Map File Path</label>
            <input
              id="filepath"
              className="scifi-input"
              placeholder="Enter path to .mbtiles file"
            />
          </div>

          <button className="scifi-button" onClick={onPath}>
            Load From Path
          </button>

          <div className="scifi-input-group">
            <label className="scifi-label">Upload Map File</label>
            <div className="scifi-file-input">
              <input type="file" accept=".mbtiles" onChange={onFile} />
              Select .mbtiles file from device
            </div>
          </div>

          {mapBounds && (
            <button className="scifi-button" onClick={onFitBounds}>
              Fit to Map Bounds
            </button>
          )}
        </div>
      )}

      {!showControls && !mapLoaded && (
        <button
          className="toggle-controls"
          onClick={() => setShowControls(true)}
          title="Open Map Controls"
        >
          ⚙
        </button>
      )}

      <button
        className="fullscreen-button"
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      >
        {isFullscreen ? "⬜" : "⛶"}
      </button>

      <button
        className="path-tracking-button"
        onClick={togglePathTracking}
        title={
          showPathTracking
            ? "Disable Path Tracking & Distance"
            : "Enable Path Tracking & Distance"
        }
      >
        {showPathTracking ? "🛤" : "📍"}
      </button>

      <div className="path-tracking-status">
        Path Tracking: {showPathTracking ? "ON" : "OFF"}
      </div>

      {soldiers.length > 0 && (
        <div className="status-panel">
          <div className="status-title">Active Units: {soldiers.length}</div>
          {Object.entries(colorMap).map(([id, col]) => (
            <div key={id} className="soldier-item">
              <div
                className="soldier-dot"
                style={{
                  backgroundColor: col,
                  border: outOfBoundsSoldiers[id]
                    ? "2px solid #ff0000"
                    : "1px solid #00ffff",
                }}
              />
              <span>{id}</span>
              {outOfBoundsSoldiers[id] && (
                <span className="out-of-bounds-indicator">OUT</span>
              )}
              <span style={{ color: "#888", fontSize: 10 }}>
                ({trailsData[id]?.length || 0} pts)
              </span>
            </div>
          ))}
        </div>
      )}

      {mapMetadataBounds && Object.keys(outOfBoundsSoldiers).length > 0 && (
        <div className="bounds-info">
          <div className="bounds-title">Map Bounds</div>
          <div>N: {mapMetadataBounds.north.toFixed(6)}</div>
          <div>S: {mapMetadataBounds.south.toFixed(6)}</div>
          <div>E: {mapMetadataBounds.east.toFixed(6)}</div>
          <div>W: {mapMetadataBounds.west.toFixed(6)}</div>
          <div
            style={{
              color: "#ff4444",
              marginTop: 4,
              fontWeight: "bold",
            }}
          >
            {Object.keys(outOfBoundsSoldiers).length} OUT OF BOUNDS
          </div>
        </div>
      )}

      <div
        id="mapid"
        style={{
          height: "100%",
          width: "100%",
          border: "1px solid #66fcf1",
          borderRadius: 8,
          background: "#0a0a0a",
        }}
      />
    </div>
  );
}
