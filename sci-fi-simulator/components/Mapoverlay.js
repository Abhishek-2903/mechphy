"use client";

import { useEffect, useRef, useState } from "react";
import {
  Pencil,
  Eraser,
  Trash2,
  Save,
  Minus,
  Move,
  Navigation,
} from "lucide-react";

// Leaflet CSS is loaded via _document.js from /public/leaflet/leaflet.css

export default function TacticalMap() {
  /* ------------------------------------------------------------------
   * REFS
   * ---------------------------------------------------------------- */
  const mapRef = useRef(null);
  const drawingLayerRef = useRef(null);
  const drawingRef = useRef(false);
  const currentPathRef = useRef(null);
  const mapInitializedRef = useRef(false);
  const mbTilesLayerRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markersRef = useRef({});
  const pathsRef = useRef([]); // stores drawn paths

  /* ------------------------------------------------------------------
   * STATE
   * ---------------------------------------------------------------- */
  const [loader, setLoader] = useState("");
  const [progress, setProgress] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /* ---------- drawing UI ---------- */
  const [drawingMode, setDrawingMode] = useState("pan"); // pan | draw | eraser
  const [lineWidth, setLineWidth] = useState(3);
  const [drawingColor, setDrawingColor] = useState("#ff0000");
  const [opacity, setOpacity] = useState(0.8);

  /* ---------- keep refs in sync ---------- */
  const drawingModeRef = useRef(drawingMode);
  const drawingColorRef = useRef(drawingColor);
  const lineWidthRef = useRef(lineWidth);
  const opacityRef = useRef(opacity);
  useEffect(() => {
    drawingModeRef.current = drawingMode;
  }, [drawingMode]);
  useEffect(() => {
    drawingColorRef.current = drawingColor;
  }, [drawingColor]);
  useEffect(() => {
    lineWidthRef.current = lineWidth;
  }, [lineWidth]);
  useEffect(() => {
    opacityRef.current = opacity;
  }, [opacity]);

  /* ------------------------------------------------------------------
   * CONSTANTS
   * ---------------------------------------------------------------- */
  const palette = [
    { color: "#ff0000", name: "Red" },
    { color: "#00ff00", name: "Green" },
    { color: "#0000ff", name: "Blue" },
    { color: "#ffff00", name: "Yellow" },
    { color: "#ff00ff", name: "Magenta" },
    { color: "#00ffff", name: "Cyan" },
    { color: "#ffffff", name: "White" },
    { color: "#000000", name: "Black" },
    { color: "#ff8000", name: "Orange" },
    { color: "#8000ff", name: "Purple" },
  ];
  const widths = [1, 2, 3, 5, 8, 12, 16, 20];
  const fallbackTile =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII=";

  /* ------------------------------------------------------------------
   * MAP INITIALISATION
   * ---------------------------------------------------------------- */
  useEffect(() => {
    const container = document.getElementById("mapid");
    if (
      !container ||
      mapInitializedRef.current ||
      mapRef.current ||
      container._leaflet_id ||
      container.hasChildNodes()
    ) {
      if (!container) setLoader("Error: Map container not found");
      return;
    }
    mapContainerRef.current = container;

    if (!window.L) {
      setLoader("Error: Leaflet library not loaded (leaflet.js).");
      return;
    }
    if (!window.initSqlJs) {
      setLoader("Error: SQL.js not loaded (sql-wasm.js).");
      return;
    }

    setLoader("Initializing tactical map…");

    window
      .initSqlJs({ locateFile: () => "/sqljs/sql-wasm.wasm" })
      .then((SQL) => {
        if (mapInitializedRef.current) return;

        /* ---------------- Leaflet map ---------------- */
        mapRef.current = L.map("mapid", {
          center: [28.5471399, 77.1945754],
          zoom: 15,
          minZoom: 8,
          maxZoom: 21,
          preferCanvas: true,
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          scrollWheelZoom: true,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          tap: false,
          touchZoom: false,
        });
        L.control.zoom({ position: "topright" }).addTo(mapRef.current);
        drawingLayerRef.current = L.layerGroup().addTo(mapRef.current);

        /* ---------------- MBTiles layer ---------------- */
        class MBTilesLayer extends L.TileLayer {
          _db = null;
          _metadata = null;

          /* ---------- load from buffer ---------- */
          loadMBTilesFromArrayBuffer = (buf) => {
            try {
              this._db = new SQL.Database(new Uint8Array(buf));
              this._readMetadata();
              this._configureZooms();
              this._applyBounds();
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

          /* ---------- helpers ---------- */
          _readMetadata = () => {
            const meta = {};
            const s = this._db.prepare("SELECT name,value FROM metadata");
            while (s.step()) {
              const { name, value } = s.getAsObject();
              meta[name] = value;
            }
            s.free();
            this._metadata = meta;
          };

          _configureZooms = () => {
            const zs = [];
            const zStmt = this._db.prepare(
              "SELECT DISTINCT zoom_level FROM tiles"
            );
            while (zStmt.step()) zs.push(zStmt.getAsObject().zoom_level);
            zStmt.free();
            if (!zs.length) return;
            const minZ = Math.min(...zs);
            const maxZ = Math.max(...zs);
            this.options.minZoom = minZ;
            this.options.maxZoom = Math.min(maxZ, 21);
            mapRef.current.setMinZoom(Math.max(minZ, 8));
            mapRef.current.setMaxZoom(Math.min(maxZ, 21));
          };

          _applyBounds = () => {
            if (!this._metadata?.bounds) return;
            const b = this._metadata.bounds.split(",").map(Number);
            if (b.length !== 4) return;
            const bounds = L.latLngBounds([b[1], b[0]], [b[3], b[2]]);
            setTimeout(() => {
              const ideal = mapRef.current.getBoundsZoom(bounds);
              const z = Math.max(
                mapRef.current.getMinZoom(),
                Math.min(ideal, mapRef.current.getMaxZoom())
              );
              mapRef.current.fitBounds(bounds, { maxZoom: z, padding: [20, 20] });
            }, 100);
          };

          /* ---------- load from path ---------- */
          loadMBTilesFromPath = (path) => {
            setLoader(`Loading ${path}…`);
            setMapLoaded(false);
            setProgress(0);

            fetch(path)
              .then(async (r) => {
                if (!r.ok) throw new Error(`HTTP Error ${r.status}`);
                const total = +r.headers.get("Content-Length") || 0;
                const reader = r.body.getReader();
                const chunks = [];
                let loaded = 0;

                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  chunks.push(value);
                  loaded += value.length;
                  if (total) {
                    const pct = Math.round((loaded / total) * 100);
                    setProgress(pct);
                    setLoader(`Loading map: ${pct}%`);
                  } else {
                    setLoader(
                      `Loading map: ${Math.round(loaded / 1048576)} MB processed`
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
                setMapLoaded(false);
              });
          };

          /* ---------- tile fetch ---------- */
          createTile(coords, done) {
            const img = document.createElement("img");
            if (!this._db) {
              img.src = fallbackTile;
              setTimeout(() => done(null, img), 100);
              return img;
            }

            const { z, x } = coords;
            const y = Math.pow(2, z) - coords.y - 1;

            try {
              const st = this._db.prepare(
                "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?"
              );
              st.bind([z, x, y]);
              if (st.step()) {
                const data = st.getAsObject().tile_data;
                if (data?.length) {
                  const blob = new Blob([new Uint8Array(data)], {
                    type: "image/png",
                  });
                  const url = URL.createObjectURL(blob);
                  img.onload = () => {
                    URL.revokeObjectURL(url);
                    done(null, img);
                  };
                  img.onerror = () => {
                    URL.revokeObjectURL(url);
                    img.src = fallbackTile;
                    done(null, img);
                  };
                  img.src = url;
                } else {
                  img.src = fallbackTile;
                  done(null, img);
                }
              } else {
                img.src = fallbackTile;
                done(null, img);
              }
              st.free();
            } catch (e) {
              console.error(e);
              img.src = fallbackTile;
              done(null, img);
            }
            return img;
          }
        }

        /* add layer */
        mbTilesLayerRef.current = new MBTilesLayer({
          minZoom: 1,
          maxZoom: 21,
          tms: true,
          errorTileUrl: fallbackTile,
          keepBuffer: 2,
        }).addTo(mapRef.current);

        setLoader("Please load Map file");
        mapInitializedRef.current = true;
      })
      .catch((e) => {
        console.error(e);
        setLoader(`SQL.js Error: ${e.message}`);
      });

    /* cleanup */
    return () => {
      mapRef.current?.remove();
      markersRef.current = {};
      mbTilesLayerRef.current = null;
      drawingLayerRef.current = null;
      mapInitializedRef.current = false;
    };
  }, []);

  /* ------------------------------------------------------------------
   * DRAWING EVENT SETUP (runs after map is loaded)
   * ---------------------------------------------------------------- */
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !drawingLayerRef.current) return;

    const map = mapRef.current;

    /* helper to convert mouse/touch event to LatLng */
    const getEventLatLng = (e) => {
      const rect = map.getContainer().getBoundingClientRect();
      let clientX, clientY;
      if (e.type.startsWith("touch")) {
        const t = e.touches[0] || e.changedTouches[0];
        if (!t) return null;
        clientX = t.clientX;
        clientY = t.clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const point = L.point(clientX - rect.left, clientY - rect.top);
      return map.containerPointToLatLng(point);
    };

    /* start drawing */
    const start = (e) => {
      if (drawingModeRef.current === "pan") return;
      e.preventDefault();
      e.stopPropagation();
      const latlng = getEventLatLng(e);
      if (!latlng) return;

      drawingRef.current = true;
      if (drawingModeRef.current === "draw") {
        currentPathRef.current = L.polyline([latlng], {
          color: drawingColorRef.current,
          weight: lineWidthRef.current,
          opacity: opacityRef.current,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(drawingLayerRef.current);
        pathsRef.current.push(currentPathRef.current);
      } else if (drawingModeRef.current === "eraser") {
        // simple point‑erase: remove nearest path if within threshold
        let nearest = null;
        let minDist = Infinity;
        pathsRef.current.forEach((p) => {
          p.getLatLngs().forEach((pt) => {
            const d = latlng.distanceTo(pt);
            if (d < minDist) {
              minDist = d;
              nearest = p;
            }
          });
        });
        if (nearest && minDist < 1000 / Math.pow(2, map.getZoom())) {
          drawingLayerRef.current.removeLayer(nearest);
          pathsRef.current = pathsRef.current.filter((p) => p !== nearest);
        }
      }
    };

    /* draw move */
    const move = (e) => {
      if (!drawingRef.current || drawingModeRef.current !== "draw") return;
      e.preventDefault();
      e.stopPropagation();
      const latlng = getEventLatLng(e);
      if (latlng && currentPathRef.current) {
        currentPathRef.current.addLatLng(latlng);
      }
    };

    /* stop drawing */
    const stop = (e) => {
      if (!drawingRef.current) return;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      drawingRef.current = false;
      currentPathRef.current = null;
    };

    /* attach listeners */
    const c = map.getContainer();
    ["mousedown", "touchstart"].forEach((ev) =>
      c.addEventListener(ev, start, { passive: false })
    );
    ["mousemove", "touchmove"].forEach((ev) =>
      c.addEventListener(ev, move, { passive: false })
    );
    ["mouseup", "mouseleave", "touchend"].forEach((ev) =>
      c.addEventListener(ev, stop, { passive: false })
    );

    return () => {
      ["mousedown", "touchstart", "mousemove", "touchmove", "mouseup", "mouseleave", "touchend"].forEach(
        (ev) => c.removeEventListener(ev, () => {})
      );
    };
  }, [mapLoaded]);

  /* ------------------------------------------------------------------
   * FILE UPLOAD
   * ---------------------------------------------------------------- */
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f || !mbTilesLayerRef.current) return;
    setLoader(`Loading ${f.name}…`);
    setProgress(0);

    const reader = new FileReader();
    reader.onprogress = ({ loaded, total }) => {
      if (total) {
        const pct = Math.round((loaded / total) * 100);
        setProgress(pct);
        setLoader(`Loading ${f.name}: ${pct}%`);
      } else {
        setLoader(
          `Loading ${f.name}: ${Math.round(loaded / 1048576)} MB processed`
        );
      }
    };
    reader.onload = () =>
      mbTilesLayerRef.current.loadMBTilesFromArrayBuffer(reader.result);
    reader.onerror = () => {
      setLoader(`Error loading ${f.name}`);
      setProgress(0);
    };
    reader.readAsArrayBuffer(f);
  };

  /* ------------------------------------------------------------------
   * DRAWING TOOL HANDLERS
   * ---------------------------------------------------------------- */
  const setTool = (tool) => {
    setDrawingMode(tool);
    if (!mapRef.current) return;
    if (tool === "pan") {
      mapRef.current.dragging.enable();
      mapRef.current.scrollWheelZoom.enable();
      mapRef.current.doubleClickZoom.enable();
      mapRef.current.boxZoom.enable();
      mapRef.current.keyboard.enable();
      mapRef.current.getContainer().style.cursor = "grab";
    } else {
      mapRef.current.dragging.disable();
      mapRef.current.scrollWheelZoom.disable();
      mapRef.current.doubleClickZoom.disable();
      mapRef.current.boxZoom.disable();
      mapRef.current.keyboard.disable();
      mapRef.current.getContainer().style.cursor = "crosshair";
    }
  };

  const clearCanvas = () => {
    drawingLayerRef.current?.clearLayers();
    pathsRef.current = [];
  };

  const saveDrawing = () => {
    if (!drawingLayerRef.current) return;
    const canvas = document.createElement("canvas");
    const bounds = mapRef.current.getBounds();
    const tl = mapRef.current.latLngToContainerPoint(bounds.getNorthWest());
    const br = mapRef.current.latLngToContainerPoint(bounds.getSouthEast());
    canvas.width = br.x - tl.x;
    canvas.height = br.y - tl.y;
    const ctx = canvas.getContext("2d");
    pathsRef.current.forEach((p) => {
      const pts = p.getLatLngs();
      const { color, weight, opacity: op } = p.options;
      ctx.strokeStyle = color;
      ctx.lineWidth = weight;
      ctx.globalAlpha = op;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach((latlng, i) => {
        const pt = mapRef.current.latLngToContainerPoint(latlng);
        if (i === 0) ctx.moveTo(pt.x - tl.x, pt.y - tl.y);
        else ctx.lineTo(pt.x - tl.x, pt.y - tl.y);
      });
      ctx.stroke();
    });
    const link = document.createElement("a");
    link.download = "tactical-plan.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  /* simple test line */
  const testDraw = () => {
    if (!drawingLayerRef.current) return;
    const c = mapRef.current.getCenter();
    const d = 0.001;
    const line = L.polyline(
      [
        [c.lat - d, c.lng - d],
        [c.lat + d, c.lng + d],
      ],
      { color: "#ff0000", weight: 5, opacity: 0.8 }
    ).addTo(drawingLayerRef.current);
    pathsRef.current.push(line);
  };

  /* debug helper */
  const debugTiles = () => {
    if (!mbTilesLayerRef.current?._db) return;
    const db = mbTilesLayerRef.current._db;
    const zStmt = db.prepare(
      "SELECT zoom_level, COUNT(*) as cnt FROM tiles GROUP BY zoom_level"
    );
    while (zStmt.step()) {
      const { zoom_level, cnt } = zStmt.getAsObject();
      console.log(`Zoom ${zoom_level}: ${cnt} tiles`);
    }
    zStmt.free();
  };

  /* ------------------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------------- */
  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        width: "100%",
        background: "#0a0a0a",
        display: "flex",
      }}
    >
      {/* ----- loader ----- */}
      {loader && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            color: "#66fcf1",
            background: "rgba(0,0,0,0.9)",
            padding: "8px 16px",
            borderRadius: 6,
            zIndex: 1001,
            border: "1px solid #00ffff",
          }}
        >
          {loader}{" "}
          {progress > 0 && progress < 100 && (
            <>({progress}%)</>
          )}
        </div>
      )}

      {/* ----- upload panel ----- */}
      {showControls && !mapLoaded && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1001,
            background: "rgba(0,0,0,0.95)",
            padding: "20px 30px",
            borderRadius: 8,
            border: "1px solid #00ffff",
            boxShadow: "0 0 20px rgba(0,255,255,0.3)",
          }}
        >
          <label
            style={{
              display: "block",
              color: "#00ffff",
              fontFamily: "monospace",
              marginBottom: 15,
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            📍 Upload MBTiles Map for Tactical Planning
          </label>
          <input
            type="file"
            accept=".mbtiles"
            onChange={onFile}
            style={{
              padding: 10,
              color: "#66fcf1",
              background: "#001122",
              border: "1px solid #00ffff",
              borderRadius: 4,
              cursor: "pointer",
              width: "100%",
            }}
          />
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "#66fcf1",
              fontFamily: "monospace",
            }}
          >
            Supports offline MBTiles format maps with enhanced loading
          </div>
        </div>
      )}

      {/* ----- sidebar ----- */}
      {mapLoaded && (
        <div
          style={{
            width: sidebarCollapsed ? 50 : 280,
            background: "rgba(0,0,0,0.95)",
            border: "1px solid #00ffff",
            boxShadow: "0 0 20px rgba(0,255,255,0.3)",
            zIndex: 1000,
            transition: "width 0.3s ease",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: 15,
              borderBottom: "1px solid #333",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3
              style={{
                color: "#00ffff",
                margin: 0,
                fontSize: 16,
                fontFamily: "monospace",
                display: sidebarCollapsed ? "none" : "block",
              }}
            >
              Tactical Tools
            </h3>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                background: "transparent",
                border: "1px solid #00ffff",
                color: "#00ffff",
                padding: 5,
                borderRadius: 3,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {sidebarCollapsed ? <Navigation size={16} /> : <Minus size={16} />}
            </button>
          </div>

          {!sidebarCollapsed && (
            <div style={{ padding: 15, flex: 1, overflowY: "auto" }}>
              {/* -- tool buttons -- */}
              <div style={{ marginBottom: 20 }}>
                <h4
                  style={{
                    color: "#66fcf1",
                    fontSize: 14,
                    marginBottom: 10,
                    fontFamily: "monospace",
                  }}
                >
                  Drawing Tools
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 8,
                    marginBottom: 15,
                  }}
                >
                  {[
                    { mode: "pan", label: "Pan", icon: <Move size={16} /> },
                    { mode: "draw", label: "Draw", icon: <Pencil size={16} /> },
                    { mode: "eraser", label: "Erase", icon: <Eraser size={16} /> },
                  ].map((b) => (
                    <button
                      key={b.mode}
                      onClick={() => setTool(b.mode)}
                      style={{
                        background: drawingMode === b.mode ? "#00ffff" : "transparent",
                        color: drawingMode === b.mode ? "#000" : "#00ffff",
                        border: "1px solid #00ffff",
                        padding: 8,
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        fontSize: 12,
                      }}
                    >
                      {b.icon}
                      {b.label}
                    </button>
                  ))}
                  <button
                    onClick={testDraw}
                    style={{
                      background: "transparent",
                      color: "#66fcf1",
                      border: "1px solid #66fcf1",
                      padding: 8,
                      borderRadius: 4,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      fontSize: 12,
                    }}
                  >
                    Test
                  </button>
                </div>

                {/* -- color palette -- */}
                <div style={{ marginBottom: 15 }}>
                  <label
                    style={{
                      color: "#66fcf1",
                      fontSize: 12,
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    Color:
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(5, 1fr)",
                      gap: 4,
                    }}
                  >
                    {palette.map((c) => (
                      <button
                        key={c.color}
                        onClick={() => setDrawingColor(c.color)}
                        title={c.name}
                        style={{
                          width: 30,
                          height: 30,
                          background: c.color,
                          border:
                            drawingColor === c.color
                              ? "2px solid #00ffff"
                              : "1px solid #333",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* -- line width -- */}
                <div style={{ marginBottom: 15 }}>
                  <label
                    style={{
                      color: "#66fcf1",
                      fontSize: 12,
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    Line Width: {lineWidth}px
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 4,
                    }}
                  >
                    {widths.map((w) => (
                      <button
                        key={w}
                        onClick={() => setLineWidth(w)}
                        style={{
                          background: lineWidth === w ? "#00ffff" : "transparent",
                          color: lineWidth === w ? "#000" : "#66fcf1",
                          border: "1px solid #66fcf1",
                          padding: 6,
                          borderRadius: 3,
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>

                {/* -- opacity slider -- */}
                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      color: "#66fcf1",
                      fontSize: 12,
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    Opacity: {Math.round(opacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#00ffff" }}
                  />
                </div>

                {/* -- clear / save -- */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <button
                    onClick={clearCanvas}
                    style={{
                      background: "transparent",
                      color: "#ff6b6b",
                      border: "1px solid #ff6b6b",
                      padding: 8,
                      borderRadius: 4,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      fontSize: 12,
                    }}
                  >
                    <Trash2 size={14} /> Clear
                  </button>
                  <button
                    onClick={saveDrawing}
                    style={{
                      background: "transparent",
                      color: "#51cf66",
                      border: "1px solid #51cf66",
                      padding: 8,
                      borderRadius: 4,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      fontSize: 12,
                    }}
                  >
                    <Save size={14} /> Save
                  </button>
                </div>

                <button
                  onClick={debugTiles}
                  style={{
                    background: "transparent",
                    color: "#ffd43b",
                    border: "1px solid #ffd43b",
                    padding: 8,
                    borderRadius: 4,
                    cursor: "pointer",
                    width: "100%",
                    marginTop: 10,
                    fontSize: 12,
                  }}
                >
                  Debug Tiles
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----- map container ----- */}
      <div
        id="mapid"
        style={{ flex: 1, position: "relative", background: "#0a0a0a" }}
      />

      {/* ----- status bar ----- */}
      {mapLoaded && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            background: "rgba(0,0,0,0.8)",
            padding: 10,
            borderRadius: 6,
            border: "1px solid #333",
            color: "#66fcf1",
            fontSize: 12,
            fontFamily: "monospace",
            zIndex: 1000,
          }}
        >
          Mode: {drawingMode} | Color: {drawingColor} | Width: {lineWidth}px |
          Opacity: {Math.round(opacity * 100)}%
        </div>
      )}
    </div>
  );
}
