/* Page behaviour: countdown / "where are we now", day buttons that drive the chapter map,
   experience carousels, the active chapter in the sticky bar, language links that keep the section.
   ?today=2026-10-18 in the URL pretends it is that day (for checking the "now" state). */
(function () {
  "use strict";
  var DATA = JSON.parse(document.getElementById("page-data").textContent);
  var UI = DATA.ui;
  var smooth = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function daysBetween(a, b) { return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5); }
  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k]; }); }

  var today = isoDate(new Date());
  var forced = new URLSearchParams(location.search).get("today");
  if (forced && /^\d{4}-\d{2}-\d{2}$/.test(forced)) today = forced;

  // ---- countdown and "we're here now"
  (function () {
    var el = document.getElementById("count");
    var trip = DATA.trip;
    var current = null;
    DATA.chapters.forEach(function (c) { if (!current && c.start <= today && today < c.end) current = c; });
    var before = daysBetween(today, trip.start);
    if (before > 0) {
      el.textContent = before === 1 ? UI.count_1 : fill(before <= 4 ? UI.count_few : UI.count_many, { n: before });
    } else if (before === 0) {
      el.textContent = UI.count_0;
    } else if (today <= trip.end && current) {
      el.textContent = fill(UI.count_on, { n: daysBetween(trip.start, today) + 1, total: trip.days, place: current.short });
    } else if (today > trip.end) {
      el.textContent = UI.count_done;
    }
    if (current && before <= 0 && today <= trip.end) {
      document.querySelectorAll('[data-ch="' + current.id + '"]').forEach(function (n) {
        n.classList.add(n.tagName === "A" ? "now" : "is-now");
      });
    }
    document.querySelectorAll(".day[data-from]").forEach(function (b) {
      if (b.dataset.from <= today && today <= b.dataset.to) b.classList.add("is-today");
    });
  })();

  // ---- day buttons → chapter map
  document.querySelectorAll(".chapter").forEach(function (sec) {
    var buttons = Array.prototype.slice.call(sec.querySelectorAll(".day"));
    var whole = sec.querySelector(".whole");
    var hasMap = !!sec.querySelector(".mapbox");
    function select(btn) {
      buttons.forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
      if (whole) whole.hidden = !btn;
      if (hasMap && window.TripMap) window.TripMap.focus(sec.id, btn ? +btn.dataset.i : null);
    }
    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        select(b.getAttribute("aria-pressed") === "true" ? null : b);
      });
    });
    if (whole) whole.addEventListener("click", function () { select(null); });
  });

  // ---- carousels
  document.querySelectorAll(".carousel").forEach(function (car) {
    var track = car.querySelector(".car-track");
    var prev = car.querySelector(".car-btn.prev");
    var next = car.querySelector(".car-btn.next");
    var count = car.querySelector(".car-count");
    var cards = track.children;
    var n = cards.length;
    function step() { return n > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth; }
    function update() {
      var s = step() || 1;
      var first = Math.min(n - 1, Math.max(0, Math.round(track.scrollLeft / s)));
      var visible = Math.max(1, Math.floor((track.clientWidth + 14) / s));
      var atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      if (atEnd) first = Math.max(0, n - visible);
      var last = Math.min(n, first + visible);
      count.textContent = fill(UI.of, { i: visible > 1 && last > first + 1 ? (first + 1) + "–" + last : first + 1, n: n });
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = atEnd;
    }
    prev.addEventListener("click", function () { track.scrollBy({ left: -step(), behavior: smooth }); });
    next.addEventListener("click", function () { track.scrollBy({ left: step(), behavior: smooth }); });
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); next.click(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev.click(); }
    });
    var raf = 0;
    track.addEventListener("scroll", function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  });

  // ---- active chapter in the sticky bar
  (function () {
    var list = document.querySelector(".tn-list");
    if (!list || !("IntersectionObserver" in window)) return;
    var links = {};
    list.querySelectorAll("a[data-ch]").forEach(function (a) { links[a.dataset.ch] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.toggle("on", k === e.target.id); });
        var a = links[e.target.id];
        if (a) list.scrollTo({ left: a.offsetLeft - 8, behavior: smooth });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll("section.chapter").forEach(function (s) { io.observe(s); });
  })();

  // ---- language links keep the current section
  document.querySelectorAll(".langs a").forEach(function (a) {
    a.addEventListener("click", function () {
      var href = a.getAttribute("href").split("#")[0];
      var hash = location.hash;
      if (!hash) {
        var on = document.querySelector(".tn-list a.on");
        if (on && window.scrollY > window.innerHeight * 0.8) hash = "#" + on.dataset.ch;
      }
      if (hash) a.setAttribute("href", href + hash);
    });
  });
})();
