import { useEffect, useRef, useState } from "react";
import "@arcgis/core/assets/esri/themes/light/main.css";
import ArcGISMap from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import Graphic from "@arcgis/core/Graphic";
import Polygon from "@arcgis/core/geometry/Polygon.js";

export default function MapViewComponent() {
  const divRef = useRef(null);
  const layerRef = useRef(null);
  const viewRef = useRef(null);

  // Selection storage and UI count
  const selectionRef = useRef({ byId: new Map() });
  const [selCount, setSelCount] = useState(0);

  // Box-select UI state + a ref for handlers (so we don't rebuild map)
  const [boxMode, setBoxMode] = useState(false);
  const boxModeRef = useRef(false);

  const dragRectRef = useRef(null);
  const shiftDownRef = useRef(false);

  // keep ref in sync with state
  useEffect(() => { boxModeRef.current = boxMode; }, [boxMode]);

  // Initialize the map ONCE (no dependency on boxMode)
  useEffect(() => {
    const map = new ArcGISMap({ basemap: "osm" });
    const view = new MapView({
      map,
      container: divRef.current,
      center: [-80.27, 26.65],
      zoom: 12,
      constraints: { snapToZoom: false }
    });
    viewRef.current = view;

    const renderer = {
      type: "simple",
      symbol: { type: "simple-fill", color: [0,0,0,0], outline: { color: [0,122,255,1], width: 1.25 } }
    };

    const labelingInfo = [{
      labelExpressionInfo: { expression: "$feature.parcel_id" },
      symbol: { type: "text", color: "#374151", haloColor: "#fff", haloSize: 1, font: { size: 9, family: "Avenir Next" } }
    }];

    const parcels = new GeoJSONLayer({
      url: "/data/parcels.geojson",
      title: "Parcels (sample)",
      renderer, labelingInfo, outFields: ["*"]
    });
    layerRef.current = parcels;
    map.add(parcels);

    parcels.when(async () => {
      try {
        const ext = await parcels.queryExtent();
        if (ext.extent) view.goTo(ext.extent.expand(1.2));
      } catch {}
    });

    // Track Shift for additive selection
    function onKeyDown(e){ if (e.key === "Shift") shiftDownRef.current = true; }
    function onKeyUp(e){ if (e.key === "Shift") shiftDownRef.current = false; }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Click-to-toggle selection (ignore while box mode active)
    const clickHandle = view.on("click", async (evt) => {
      if (boxModeRef.current) return;
      try {
        const q = parcels.createQuery();
        q.geometry = evt.mapPoint;
        q.spatialRelationship = "intersects";
        q.distance = 10;
        q.units = "meters";
        q.returnGeometry = true;
        q.outFields = ["*"];
        const { features } = await parcels.queryFeatures(q);
        if (!features.length) return;

        const f = features[0];
        const pid = String(f.getAttribute("parcel_id") || "");
        toggleSelection(pid, f.geometry, view);
        updateCountAndDispatch();
      } catch (err) {
        console.error("[Map click] query error:", err);
      }
    });

    // Drag rectangle (Shift = add, no Shift = replace)
    const dragHandle = view.on("drag", async (evt) => {
      if (!boxModeRef.current) return;
      evt.stopPropagation();

      const p1 = evt.origin;
      const p2 = evt;
      const map1 = view.toMap({ x: p1.x, y: p1.y });
      const map2 = view.toMap({ x: p2.x, y: p2.y });
      if (!map1 || !map2) return;

      const xmin = Math.min(map1.x, map2.x);
      const xmax = Math.max(map1.x, map2.x);
      const ymin = Math.min(map1.y, map2.y);
      const ymax = Math.max(map1.y, map2.y);

      const poly = new Polygon({
        spatialReference: view.spatialReference,
        rings: [[[xmin,ymin],[xmax,ymin],[xmax,ymax],[xmin,ymax],[xmin,ymin]]]
      });

      drawDragRect(poly, view);

      if (evt.action === "end") {
        try {
          const q = parcels.createQuery();
          q.geometry = poly;
          q.spatialRelationship = "intersects";
          q.returnGeometry = true;
          q.outFields = ["*"];
          const { features } = await parcels.queryFeatures(q);

          if (!shiftDownRef.current) clearSelection(view); // replace unless Shift held

          for (const f of features) {
            const pid = String(f.getAttribute("parcel_id") || "");
            addSelectionGraphic(pid, f.geometry, view);
          }

          if (features.length) {
            let ext = features[0].geometry.extent.clone();
            for (let i = 1; i < features.length; i++) ext = ext.union(features[i].geometry.extent);
            view.goTo(ext.expand(1.2));
          }

          updateCountAndDispatch();
        } finally {
          clearDragRect(view);
          // turn off box mode but DO NOT recreate the map (effect doesn't depend on boxMode)
          setBoxMode(false);
        }
      }
    });

    // External events (search/zoom integration)
    function onZoomTo(e) {
      const d = e.detail || {};
      if (d.extent) view.goTo(d.extent);
      else if (d.center && d.zoom) view.goTo({ center: d.center, zoom: d.zoom });
    }

    async function onSelectParcels(e) {
      const ids = (e.detail?.ids || []).map(String);
      if (!ids.length) { clearSelection(view); updateCountAndDispatch(); return; }
      const q = parcels.createQuery();
      q.where = "parcel_id IN (" + ids.map(id => `'${id.replace(/'/g, "''")}'`).join(",") + ")";
      q.outFields = ["*"];
      q.returnGeometry = true;
      const { features } = await parcels.queryFeatures(q);

      clearSelection(view);
      for (const f of features) addSelectionGraphic(String(f.getAttribute("parcel_id") || ""), f.geometry, view);

      if (features.length) {
        let ext = features[0].geometry.extent.clone();
        for (let i = 1; i < features.length; i++) ext = ext.union(features[i].geometry.extent);
        view.goTo(ext.expand(1.5));
      }
      updateCountAndDispatch();
    }

    window.addEventListener("myzone:zoomTo", onZoomTo);
    window.addEventListener("myzone:selectParcels", onSelectParcels);

    // Cleanup (destroy map ONCE)
    return () => {
      window.removeEventListener("myzone:zoomTo", onZoomTo);
      window.removeEventListener("myzone:selectParcels", onSelectParcels);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      clickHandle?.remove();
      dragHandle?.remove();
      view?.destroy();
    };
  }, []); // IMPORTANT: initialize ONCE only

  // --- Selection helpers (update count + fire event) ---

  function updateCountAndDispatch(){
    setSelCount(selectionRef.current.byId.size);
    window.dispatchEvent(new CustomEvent("myzone:selectionChanged", {
      detail: { ids: Array.from(selectionRef.current.byId.keys()) }
    }));
  }

  function addSelectionGraphic(pid, geometry, view){
    if (selectionRef.current.byId.has(pid)) return;
    const g = new Graphic({
      geometry,
      symbol: { type: "simple-fill", color: [29,78,216,0.2], outline: { color: [29,78,216,1], width: 2 } },
      attributes: { parcel_id: pid }
    });
    selectionRef.current.byId.set(pid, g);
    view.graphics.add(g);
  }

  function toggleSelection(pid, geometry, view){
    if (selectionRef.current.byId.has(pid)) {
      const g = selectionRef.current.byId.get(pid);
      view.graphics.remove(g);
      selectionRef.current.byId.delete(pid);
    } else {
      addSelectionGraphic(pid, geometry, view);
    }
  }

  function clearSelection(view){
    for (const g of selectionRef.current.byId.values()) view.graphics.remove(g);
    selectionRef.current.byId.clear();
  }

  function drawDragRect(poly, view){
    clearDragRect(view);
    const rectG = new Graphic({
      geometry: poly,
      symbol: { type: "simple-fill", color: [29,78,216,0.12], outline: { color: [29,78,216,1], width: 1.5 } }
    });
    dragRectRef.current = rectG;
    view.graphics.add(rectG);
  }

  function clearDragRect(view){
    if (dragRectRef.current){
      view.graphics.remove(dragRectRef.current);
      dragRectRef.current = null;
    }
  }

  // Clear all (button)
  function clearAll(){
    const view = viewRef.current;
    if (!view) return;
    clearSelection(view);
    updateCountAndDispatch();
  }

  return (
    <div style={{ position:"relative" }}>
      <div className="map-toolbar">
        <span className="count-badge">{selCount}</span>
        <button onClick={() => setBoxMode(v => !v)} className={boxMode ? "primary" : ""}>
          {boxMode ? "Drag to Select…" : "Box Select"}
        </button>
        <button onClick={clearAll}>Clear</button>
        <div style={{ marginLeft:8, fontSize:12, color:"#6b7280" }}>Hold <b>Shift</b> to add to selection</div>
      </div>
      <div ref={divRef} className="map" />
    </div>
  );
}
