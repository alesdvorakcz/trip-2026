/* Maps for the family trip page: MapLibre GL with a hand-written style in the page palette
   (OpenFreeMap vector tiles, Mapterhorn hillshade, labels in the page language), our routes and
   HTML markers on top. Exposes window.TripMap.focus(chapterId, dayIndex | null) for the day list. */
(function () {
  "use strict";
  var DATA = JSON.parse(document.getElementById("page-data").textContent);
  var UI = DATA.ui;
  var NAME_FIELD = { cs: "name:cs", en: "name:en", zh: "name:zh-Hant" }[DATA.lang] || "name:en";
  var darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var MAPS = {};

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function tokens() {
    var t = {};
    ["land", "water", "wood", "grass", "urban", "park", "road", "road-casing", "road-minor", "rail", "border", "label",
      "label-strong", "label-water", "halo", "shadow", "highlight", "route-halo", "active-halo"].forEach(function (k) {
      t[k] = cssVar("--map-" + k);
    });
    t.hill = parseFloat(cssVar("--map-hill")) || 0.3;
    t.jade = cssVar("--jade");
    t.sea = cssVar("--sea");
    t.lacquer = cssVar("--lacquer");
    return t;
  }

  var NAME = ["coalesce", ["get", NAME_FIELD], ["get", "name:latin"], ["get", "name"]];
  var REGULAR = ["Noto Sans Regular"], BOLD = ["Noto Sans Bold"], ITALIC = ["Noto Sans Italic"];
  var zoomLerp = function (stops) { return ["interpolate", ["linear"], ["zoom"]].concat(stops); };
  var isClass = function (list) { return ["in", ["get", "class"], ["literal", list]]; };

  function baseStyle(t) {
    var halo = { "text-halo-color": t.halo, "text-halo-width": 1.4 };
    function label(id, filter, minzoom, maxzoom, size, color, font, extra) {
      var layout = { "text-field": NAME, "text-font": font || REGULAR, "text-size": size, "text-max-width": 8, "text-padding": 4 };
      Object.keys(extra || {}).forEach(function (k) { layout[k] = extra[k]; });
      return { id: id, type: "symbol", source: "omt", "source-layer": "place", minzoom: minzoom, maxzoom: maxzoom, filter: filter,
        layout: layout, paint: Object.assign({ "text-color": color }, halo) };
    }
    return {
      version: 8,
      glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
      sources: {
        omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
        dem: { type: "raster-dem", url: "https://tiles.mapterhorn.com/tilejson.json", encoding: "terrarium", tileSize: 512 }
      },
      layers: [
        { id: "bg", type: "background", paint: { "background-color": t.land } },
        { id: "wood", type: "fill", source: "omt", "source-layer": "landcover", filter: isClass(["wood"]),
          paint: { "fill-color": t.wood, "fill-opacity": 0.85 } },
        { id: "grass", type: "fill", source: "omt", "source-layer": "landcover", filter: isClass(["grass", "farmland", "wetland"]),
          paint: { "fill-color": t.grass, "fill-opacity": 0.8 } },
        { id: "urban", type: "fill", source: "omt", "source-layer": "landuse", minzoom: 8,
          filter: isClass(["residential", "suburb", "neighbourhood", "commercial", "industrial", "retail"]),
          paint: { "fill-color": t.urban, "fill-opacity": zoomLerp([8, 0.35, 12, 0.8]) } },
        { id: "park", type: "fill", source: "omt", "source-layer": "park", paint: { "fill-color": t.park, "fill-opacity": 0.4 } },
        { id: "hill", type: "hillshade", source: "dem",
          paint: { "hillshade-exaggeration": t.hill, "hillshade-shadow-color": t.shadow, "hillshade-highlight-color": t.highlight,
            "hillshade-accent-color": t.shadow } },
        { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": t.water } },
        { id: "river", type: "line", source: "omt", "source-layer": "waterway", filter: isClass(["river", "canal"]),
          layout: { "line-cap": "round" }, paint: { "line-color": t.water, "line-width": zoomLerp([7, 0.7, 14, 3.5]) } },
        { id: "stream", type: "line", source: "omt", "source-layer": "waterway", minzoom: 12, filter: isClass(["stream"]),
          paint: { "line-color": t.water, "line-width": 0.8 } },
        { id: "border", type: "line", source: "omt", "source-layer": "boundary",
          filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
          paint: { "line-color": t.border, "line-width": zoomLerp([3, 0.8, 10, 1.6]), "line-dasharray": [3, 2] } },
        { id: "road-minor", type: "line", source: "omt", "source-layer": "transportation", minzoom: 11,
          filter: isClass(["minor", "service", "tertiary"]), layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": t["road-minor"], "line-width": zoomLerp([11, 0.6, 15, 4]) } },
        { id: "road-casing", type: "line", source: "omt", "source-layer": "transportation", minzoom: 6,
          filter: isClass(["motorway", "trunk", "primary", "secondary"]), layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": t["road-casing"], "line-width": zoomLerp([6, 1.2, 10, 3, 14, 8]) } },
        { id: "road", type: "line", source: "omt", "source-layer": "transportation", minzoom: 6,
          filter: isClass(["motorway", "trunk", "primary", "secondary"]), layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": t.road, "line-width": zoomLerp([6, 0.5, 10, 1.6, 14, 6]) } },
        { id: "rail", type: "line", source: "omt", "source-layer": "transportation", minzoom: 9, filter: isClass(["rail"]),
          paint: { "line-color": t.rail, "line-width": 1, "line-dasharray": [3, 2] } },
        { id: "ferry", type: "line", source: "omt", "source-layer": "transportation", minzoom: 8, filter: isClass(["ferry"]),
          paint: { "line-color": t["label-water"], "line-opacity": 0.6, "line-width": 1, "line-dasharray": [2, 2] } },
        { id: "water-name", type: "symbol", source: "omt", "source-layer": "water_name",
          filter: isClass(["ocean", "sea", "bay", "lake", "lagoon"]),
          layout: { "text-field": NAME, "text-font": ITALIC, "text-size": zoomLerp([3, 11, 8, 13]), "text-letter-spacing": 0.06,
            "text-max-width": 7 },
          paint: { "text-color": t["label-water"], "text-halo-color": t.halo, "text-halo-width": 1 } },
        label("village", isClass(["village", "hamlet", "suburb", "neighbourhood", "quarter"]), 11, 24, 11.5, t.label),
        label("island", isClass(["island"]), 8, 24, 12, t.label, ITALIC),
        label("town", isClass(["town"]), 8, 24, zoomLerp([8, 11.5, 12, 14]), t.label),
        label("city", isClass(["city"]), 4, 24, zoomLerp([4, 11, 10, 16]), t["label-strong"], BOLD, { "symbol-sort-key": ["get", "rank"] }),
        label("country", isClass(["country"]), 2, 9, zoomLerp([2, 10, 6, 14]), t.label, BOLD,
          { "text-transform": "uppercase", "text-letter-spacing": 0.16, "text-max-width": 7 })
      ]
    };
  }

  // ------------------------------------------------------------------ overlays
  var KIND_FILTER = {
    solid: ["in", ["get", "kind"], ["literal", ["ground", "thai"]]],
    rail: ["==", ["get", "kind"], "rail"],
    optional: ["==", ["get", "kind"], "optional"],
    flight: ["==", ["get", "kind"], "flight"]
  };

  function routeIds(m) {
    var ids = m.cfg.routes.slice();
    (DATA.days[m.id] || []).forEach(function (d) {
      d.routes.forEach(function (r) { if (ids.indexOf(r) < 0) ids.push(r); });
    });
    return ids;
  }

  function addOverlays(m) {
    var t = tokens(), map = m.map;
    var features = routeIds(m).map(function (id) {
      var r = DATA.routes[id];
      return { type: "Feature", properties: { id: id, kind: r.kind, base: m.cfg.routes.indexOf(id) >= 0 },
        geometry: { type: "LineString", coordinates: r.c } };
    });
    map.addSource("trip", { type: "geojson", data: { type: "FeatureCollection", features: features } });
    var round = { "line-cap": "round", "line-join": "round" };
    map.addLayer({ id: "trip-glow", type: "line", source: "trip", layout: round,
      filter: ["in", ["get", "id"], ["literal", []]],
      paint: { "line-color": t["active-halo"], "line-width": 13, "line-opacity": 0.75, "line-blur": 2 } });
    map.addLayer({ id: "trip-halo", type: "line", source: "trip", layout: round, filter: ["!=", ["get", "kind"], "flight"],
      paint: { "line-color": t["route-halo"], "line-width": 7, "line-opacity": 0.85 } });
    map.addLayer({ id: "trip-solid", type: "line", source: "trip", layout: round, filter: KIND_FILTER.solid,
      paint: { "line-color": ["match", ["get", "kind"], "thai", t.sea, t.jade], "line-width": 3.5 } });
    map.addLayer({ id: "trip-rail", type: "line", source: "trip", filter: KIND_FILTER.rail,
      paint: { "line-color": t.jade, "line-width": 3.5, "line-dasharray": [1.6, 1] } });
    map.addLayer({ id: "trip-optional", type: "line", source: "trip", layout: { "line-cap": "round" }, filter: KIND_FILTER.optional,
      paint: { "line-color": t.jade, "line-width": 3, "line-dasharray": [0.1, 2] } });
    map.addLayer({ id: "trip-flight", type: "line", source: "trip", filter: KIND_FILTER.flight,
      paint: { "line-color": t.lacquer, "line-width": 2.5, "line-dasharray": [3, 2.5] } });
    applyFocus(m, false);
  }

  var LINE_LAYERS = { "trip-halo": null, "trip-solid": "solid", "trip-rail": "rail", "trip-optional": "optional", "trip-flight": "flight" };

  // Show the selected day: its routes glow, the rest fade, its places light up; the camera follows
  // when animate is set. Works before the style has loaded (filters are applied again on style.load).
  function applyFocus(m, animate) {
    var map = m.map;
    var day = m.active == null ? null : (DATA.days[m.id] || [])[m.active];
    var ids = day ? day.routes : [];
    if (map.getSource("trip")) {
      var shown = ["any", ["==", ["get", "base"], true], ["in", ["get", "id"], ["literal", ids]]];
      Object.keys(LINE_LAYERS).forEach(function (layer) {
        var kind = LINE_LAYERS[layer];
        var kindFilter = kind ? KIND_FILTER[kind] : ["!=", ["get", "kind"], "flight"];
        map.setFilter(layer, ["all", kindFilter, shown]);
        map.setPaintProperty(layer, "line-opacity", day ? ["case", ["in", ["get", "id"], ["literal", ids]], 1, 0.3] : (layer === "trip-halo" ? 0.85 : 1));
      });
      map.setFilter("trip-glow", ["in", ["get", "id"], ["literal", ids]]);
    }
    var pts = day ? day.pts : [];
    m.markers.forEach(function (mk) {
      var on = pts.indexOf(mk.id) >= 0;
      mk.el.classList.toggle("on", !!day && on);
      mk.el.classList.toggle("dim", !!day && !on);
      if (mk.extra) mk.el.style.display = day && on ? "" : "none";
    });
    if (animate) fitTo(m, day ? dayCoords(day) : m.cfg.fit, true);
    else fixLabels(m);
  }

  function dayCoords(day) {
    var c = day.ll.slice();
    day.routes.forEach(function (r) { if (DATA.routes[r]) c = c.concat(DATA.routes[r].c); });
    return c;
  }

  function bounds(coords) {
    var b = new maplibregl.LngLatBounds(coords[0], coords[0]);
    coords.forEach(function (c) { b.extend(c); });
    return b;
  }

  // Room for the HTML labels around the markers, which fitBounds does not know about.
  function padding(el) {
    var w = el.clientWidth, h = el.clientHeight;
    var p = Math.round(Math.max(24, Math.min(56, Math.min(w, h) * 0.1)));
    var side = Math.round(Math.min(w * 0.18, p + 56));
    return { top: p + 20, bottom: p + 10, left: side, right: side };
  }

  function fitTo(m, coords, animate) {
    if (!coords || !coords.length) return;
    var opts = { padding: padding(m.el), maxZoom: m.id === "hanoj" || m.id === "tayho" ? 13 : 12.5,
      duration: animate && !reducedMotion.matches ? 900 : 0 };
    if (coords.length === 1) {
      m.map.easeTo({ center: coords[0], zoom: 12, duration: opts.duration });
    } else {
      m.map.fitBounds(bounds(coords), opts);
    }
  }

  // ------------------------------------------------------------------ markers
  var THAI_IDS = ["dmk", "krabiairport", "klongdao", "saladan", "kantiang", "klongnin", "oldtown", "lantanp"];

  function markerEl(p) {
    var el = document.createElement("div");
    var dir = { right: "r", left: "l", top: "t", bottom: "b" }[p.dir] || "r";
    var country = p.id === "taipei" || p.id === "tpe" ? " tw" : THAI_IDS.indexOf(p.id) >= 0 ? " th" : "";
    el.className = "mk " + p.kind + " " + dir + country + (p.minor ? " minor" : "");
    if (p.kind === "stop") {
      var pins = document.createElement("span");
      pins.className = "pins";
      p.nums.forEach(function (n) {
        var s = document.createElement("span");
        s.className = "pin";
        s.textContent = n;
        pins.appendChild(s);
      });
      if (p.nudge) {
        // Pins drawn below the real point, joined to it by a short leader line.
        pins.style.top = p.nudge + "px";
        var leader = document.createElement("span");
        leader.className = "leader";
        leader.style.height = (p.nudge - 12) + "px";
        el.appendChild(leader);
        var anchor = document.createElement("span");
        anchor.className = "dot";
        el.appendChild(anchor);
        el.style.setProperty("--dy", p.nudge + "px");
      }
      el.appendChild(pins);
      el.style.setProperty("--pw", (p.nums.length * 31 - 3) + "px");
      el.setAttribute("role", "link");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", p.label);
      var go = function () {
        var target = document.getElementById(p.ch);
        if (target) target.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth" });
      };
      el.addEventListener("click", go);
      el.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    } else {
      var dot = document.createElement("span");
      dot.className = "dot";
      el.appendChild(dot);
    }
    if (p.label) {
      var lbl = document.createElement("span");
      lbl.className = "lbl";
      lbl.textContent = p.label;
      el.appendChild(lbl);
    }
    return el;
  }

  function addMarkers(m) {
    m.markers = [];
    var add = function (p, extra) {
      var el = markerEl(p);
      if (extra) el.style.display = "none";
      new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(p.ll).addTo(m.map);
      m.markers.push({ id: p.id, el: el, extra: extra, dir: { right: "r", left: "l", top: "t", bottom: "b" }[p.dir] || "r" });
    };
    m.cfg.pts.forEach(function (p) { add(p, false); });
    (m.cfg.extra || []).forEach(function (p) { add(p, true); });
  }

  // Flip a label to the other side of its marker when it would stick out of the map.
  var FLIP = { r: "l", l: "r", t: "b", b: "t" };
  function fixLabels(m) {
    var box = m.el.getBoundingClientRect();
    m.markers.forEach(function (mk) {
      var lbl = mk.el.querySelector(".lbl");
      if (!lbl || mk.el.classList.contains("stop")) return;
      var dir = mk.dir;
      mk.el.classList.remove("r", "l", "t", "b");
      mk.el.classList.add(dir);
      if (!lbl.offsetParent) return;  // hidden label
      var r = lbl.getBoundingClientRect();
      var out = (dir === "r" && r.right > box.right - 4) || (dir === "l" && r.left < box.left + 4) ||
        (dir === "t" && r.top < box.top + 4) || (dir === "b" && r.bottom > box.bottom - 4);
      if (out) {
        mk.el.classList.remove(dir);
        mk.el.classList.add(FLIP[dir]);
      }
    });
  }

  // ------------------------------------------------------------------ lifecycle
  function showError(el) {
    if (el.querySelector(".map-error")) return;
    var box = document.createElement("div");
    box.className = "map-error";
    box.textContent = UI.map_error;
    el.appendChild(box);
  }

  function create(el) {
    var id = el.getAttribute("data-map");
    if (MAPS[id]) return MAPS[id];
    var cfg = DATA.maps[id];
    var m = { id: id, el: el, cfg: cfg, active: null, markers: [] };
    MAPS[id] = m;
    if (!window.maplibregl || !cfg) { showError(el); return m; }
    try {
      m.map = new maplibregl.Map({
        container: el,
        style: baseStyle(tokens()),
        bounds: bounds(cfg.fit),
        fitBoundsOptions: { padding: padding(el), maxZoom: 12.5 },
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maxPitch: 0,
        renderWorldCopies: false,
        attributionControl: { compact: true },
        localIdeographFontFamily: "'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif",
        locale: {
          "CooperativeGesturesHandler.WindowsHelpText": UI.coop_windows,
          "CooperativeGesturesHandler.MacHelpText": UI.coop_mac,
          "CooperativeGesturesHandler.MobileHelpText": UI.coop_mobile,
          "NavigationControl.ZoomIn": UI.zoom_in,
          "NavigationControl.ZoomOut": UI.zoom_out
        }
      });
    } catch (err) {
      showError(el);
      return m;
    }
    m.map.touchZoomRotate.disableRotation();
    m.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    addMarkers(m);
    m.map.on("style.load", function () { addOverlays(m); });
    var zoomClass = function () { el.classList.toggle("z-hi", m.map.getZoom() >= 11); };
    m.map.on("zoomend", zoomClass);
    zoomClass();
    m.map.once("load", function () {
      var attrib = el.querySelector(".maplibregl-ctrl-attrib");
      if (attrib) attrib.classList.remove("maplibregl-compact-show");
      fixLabels(m);
    });
    m.map.on("moveend", function () { fixLabels(m); });
    return m;
  }

  function focus(id, i) {
    var el = document.querySelector('.mapbox[data-map="' + id + '"]');
    if (!el) return;
    var m = create(el);
    m.active = i;
    if (m.map) applyFocus(m, true);
  }

  function init() {
    var boxes = Array.prototype.slice.call(document.querySelectorAll(".mapbox[data-map]"));
    if (!("IntersectionObserver" in window)) { boxes.forEach(create); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { io.unobserve(e.target); create(e.target); }
      });
    }, { rootMargin: "600px 0px" });
    boxes.forEach(function (el) { io.observe(el); });
  }

  // Re-style every map when the system switches between light and dark.
  var onScheme = function () {
    Object.keys(MAPS).forEach(function (k) {
      var m = MAPS[k];
      if (m.map) m.map.setStyle(baseStyle(tokens()), { diff: false });
    });
  };
  if (darkQuery.addEventListener) darkQuery.addEventListener("change", onScheme);

  window.TripMap = { focus: focus };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
