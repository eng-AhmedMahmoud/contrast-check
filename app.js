/* contrast-check — vanilla, zero dependencies.
 * WCAG 2.1 relative-luminance contrast ratio + conformance matrix + fix suggestion.
 * License: GPL-3.0-or-later. Built by Devya (https://devya.dev).
 */
(function () {
  "use strict";

  /* ---------- Color math (pure) ---------- */

  // "#abc" | "#aabbcc" | "abc" | "aabbcc" -> {r,g,b} or null.
  function parseHex(input) {
    if (typeof input !== "string") return null;
    var hex = input.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      hex = hex.split("").map(function (c) { return c + c; }).join("");
    }
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    var n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(rgb) {
    var to2 = function (v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length === 1 ? "0" + s : s;
    };
    return "#" + to2(rgb.r) + to2(rgb.g) + to2(rgb.b);
  }

  // sRGB channel -> linear (WCAG 0.03928 threshold).
  function linearize(channel) {
    var c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  // Relative luminance per WCAG 2.1.
  function relativeLuminance(rgb) {
    return (
      0.2126 * linearize(rgb.r) +
      0.7152 * linearize(rgb.g) +
      0.0722 * linearize(rgb.b)
    );
  }

  // Contrast ratio between two hex colors: (Llighter + 0.05) / (Ldarker + 0.05).
  function contrastRatio(fgHex, bgHex) {
    var fg = parseHex(fgHex);
    var bg = parseHex(bgHex);
    if (!fg || !bg) return null;
    var l1 = relativeLuminance(fg);
    var l2 = relativeLuminance(bg);
    var hi = Math.max(l1, l2);
    var lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* ---------- HSL helpers for the fix suggester ---------- */

  function rgbToHsl(rgb) {
    var r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    var d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h, s: s, l: l };
  }

  function hslToRgb(hsl) {
    var h = hsl.h, s = hsl.s, l = hsl.l;
    var r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      var hue2rgb = function (p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
  }

  // Step foreground lightness (keeping hue/sat) toward whichever direction
  // raises contrast against bg until it reaches `target`. Returns hex or null.
  function suggestForeground(fgHex, bgHex, target) {
    var fg = parseHex(fgHex);
    var bg = parseHex(bgHex);
    if (!fg || !bg) return null;

    var bgLum = relativeLuminance(bg);
    // Move away from the background: darker bg -> lighten fg, lighter bg -> darken fg.
    var dir = bgLum < 0.5 ? +1 : -1;
    var base = rgbToHsl(fg);
    var STEP = 0.02;

    for (var i = 1; i <= 100; i++) {
      var l = base.l + dir * STEP * i;
      if (l < 0 || l > 1) break;
      var candidate = rgbToHex(hslToRgb({ h: base.h, s: base.s, l: l }));
      if (contrastRatio(candidate, bgHex) >= target) return candidate;
    }
    // Fallback: pure black or white, whichever contrasts more.
    var white = contrastRatio("#ffffff", bgHex);
    var black = contrastRatio("#000000", bgHex);
    var best = white >= black ? "#ffffff" : "#000000";
    return contrastRatio(best, bgHex) >= target ? best : null;
  }

  /* ---------- Conformance thresholds ---------- */

  var LEVELS = {
    "aa-normal": 4.5,
    "aa-large": 3,
    "aaa-normal": 7,
    "aaa-large": 4.5,
    "ui": 3
  };

  /* ---------- DOM wiring ---------- */

  var $ = function (id) { return document.getElementById(id); };

  var fgColor = $("fg-color");
  var fgHex = $("fg-hex");
  var bgColor = $("bg-color");
  var bgHex = $("bg-hex");
  var ratioValue = $("ratio-value");
  var ratioNote = $("ratio-note");
  var matrix = $("matrix");
  var preview = $("preview");
  var suggest = $("suggest");
  var suggestSwatch = $("suggest-swatch");
  var suggestHex = $("suggest-hex");
  var suggestRatio = $("suggest-ratio");
  var applyBtn = $("apply-btn");
  var swapBtn = $("swap-btn");
  var toast = $("toast");

  // Canonical current colors (always valid 6-digit hex).
  var state = { fg: "#8A94A2", bg: "#16181B" };

  /* ---- Toast ---- */
  var toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 1600);
  }

  /* ---- Hash sharing (#fg=xxxxxx&bg=yyyyyy) ---- */
  function readHash() {
    var h = window.location.hash.replace(/^#/, "");
    if (!h) return;
    var params = new URLSearchParams(h);
    var fg = params.get("fg");
    var bg = params.get("bg");
    if (fg && parseHex(fg)) state.fg = rgbToHex(parseHex(fg));
    if (bg && parseHex(bg)) state.bg = rgbToHex(parseHex(bg));
  }
  var hashTimer = null;
  function writeHash() {
    if (hashTimer) clearTimeout(hashTimer);
    hashTimer = setTimeout(function () {
      var params = new URLSearchParams();
      params.set("fg", state.fg.replace("#", ""));
      params.set("bg", state.bg.replace("#", ""));
      history.replaceState(null, "", "#" + params.toString());
    }, 250);
  }

  /* ---- Sync inputs from state ---- */
  function syncInputs() {
    fgColor.value = state.fg.toLowerCase();
    bgColor.value = state.bg.toLowerCase();
    if (document.activeElement !== fgHex) fgHex.value = state.fg.toUpperCase();
    if (document.activeElement !== bgHex) bgHex.value = state.bg.toUpperCase();
    fgHex.setAttribute("aria-invalid", "false");
    bgHex.setAttribute("aria-invalid", "false");
  }

  /* ---- Render everything ---- */
  function render() {
    var ratio = contrastRatio(state.fg, state.bg);
    var rounded = Math.round(ratio * 100) / 100;
    ratioValue.textContent = rounded.toFixed(2);

    var passAaNormal = ratio >= LEVELS["aa-normal"];
    ratioNote.textContent = passAaNormal
      ? "Passes AA for normal text. Solid, readable contrast."
      : "Below the 4.5 : 1 minimum for AA normal text. See the suggested fix.";

    // Matrix badges.
    var rows = matrix.querySelectorAll(".matrix-row");
    rows.forEach(function (row) {
      var level = row.getAttribute("data-level");
      var pass = ratio >= LEVELS[level];
      var badge = row.querySelector("[data-badge]");
      badge.setAttribute("data-state", pass ? "pass" : "fail");
      row.setAttribute("data-pass", String(pass));
      var reqTxt = row.querySelector(".matrix-label").textContent.trim();
      badge.setAttribute("role", "img");
      badge.setAttribute(
        "aria-label",
        (pass ? "Pass — " : "Fail — ") + reqTxt
      );
    });

    // Preview in user colors.
    preview.style.backgroundColor = state.bg;
    preview.style.color = state.fg;

    // Suggested fix (only when AA normal fails).
    if (!passAaNormal) {
      var fix = suggestForeground(state.fg, state.bg, LEVELS["aa-normal"]);
      if (fix) {
        var fixRatio = Math.round(contrastRatio(fix, state.bg) * 100) / 100;
        suggestSwatch.style.backgroundColor = fix;
        suggestHex.textContent = fix.toUpperCase();
        suggestRatio.textContent = fixRatio.toFixed(2) + " : 1";
        applyBtn.setAttribute("data-fix", fix);
        suggest.hidden = false;
      } else {
        suggest.hidden = true;
      }
    } else {
      suggest.hidden = true;
    }
  }

  function update() {
    syncInputs();
    render();
    writeHash();
  }

  /* ---- Handlers ---- */

  function onHexInput(which, el) {
    var rgb = parseHex(el.value);
    if (rgb) {
      state[which] = rgbToHex(rgb);
      el.setAttribute("aria-invalid", "false");
      // Live-update swatch + preview without stealing caret from the text field.
      (which === "fg" ? fgColor : bgColor).value = state[which].toLowerCase();
      render();
      writeHash();
    } else {
      el.setAttribute("aria-invalid", "true");
    }
  }

  fgHex.addEventListener("input", function () { onHexInput("fg", fgHex); });
  bgHex.addEventListener("input", function () { onHexInput("bg", bgHex); });
  fgHex.addEventListener("blur", update);
  bgHex.addEventListener("blur", update);

  fgColor.addEventListener("input", function () {
    state.fg = rgbToHex(parseHex(fgColor.value));
    update();
  });
  bgColor.addEventListener("input", function () {
    state.bg = rgbToHex(parseHex(bgColor.value));
    update();
  });

  swapBtn.addEventListener("click", function () {
    var t = state.fg; state.fg = state.bg; state.bg = t;
    update();
    showToast("Swapped colors");
  });

  applyBtn.addEventListener("click", function () {
    var fix = applyBtn.getAttribute("data-fix");
    if (fix) {
      state.fg = fix;
      update();
      showToast("Applied " + fix.toUpperCase());
    }
  });

  // Copy buttons.
  document.querySelectorAll(".copy-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = $(btn.getAttribute("data-copy"));
      var text = target.value.toUpperCase();
      var done = function () { showToast("Copied " + text); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          fallbackCopy(target); done();
        });
      } else {
        fallbackCopy(target); done();
      }
    });
  });

  function fallbackCopy(input) {
    input.focus();
    input.select();
    try { document.execCommand("copy"); } catch (e) { /* no-op */ }
  }

  window.addEventListener("hashchange", function () {
    readHash();
    update();
  });

  /* ---- Init ---- */
  readHash();
  update();
})();
