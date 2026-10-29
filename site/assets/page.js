/* h2o.ai/benchmarks: theme toggle, section filter, JevBench sort, one-time motion and the cookie's footer control. A
   classic script loaded in <head> (inlined in h2o-benchmarks.html), so it runs from file:// with no modules and no fetch.
   Without it the page still reads in full: the theme follows the system, every section shows, bars are drawn, and the
   controls that need it stay hidden. */
(function () {
  "use strict";
  var root = document.documentElement;
  var KEY = "h2o-benchmarks-theme";
  var CONSENT_KEY = "h2o-benchmarks-consent-saved";
  var CONSENT_CLASS = "consent-saved";
  var stored = null;
  try {
    stored = window.localStorage.getItem(KEY);
  } catch (err) {
    stored = null; // private window, file:// in some browsers, or storage blocked: follow the system
  }
  if (stored === "light" || stored === "dark") {
    root.setAttribute("data-theme", stored);
  }
  root.className = root.className.replace(/\bno-js\b/, "js");
  // A visitor who saved their cookie preferences on an earlier visit: the class that hides Osano's cookie (styles.css) is on
  // <html> before <body> is parsed, like the stored theme, so the cookie is never drawn.
  try {
    if (window.localStorage.getItem(CONSENT_KEY) === "1") {
      root.classList.add(CONSENT_CLASS);
    }
  } catch (err) {
    // storage blocked: the cookie shows until a Save in this visit
  }

  // Osano (landing/analytics.py) draws a cookie button that stays on every page, by design, as the way back to its
  // preferences panel. Once the visitor has saved their preferences in that panel the page hides it (styles.css, under
  // .consent-saved) and the footer's "Cookie settings" button opens the panel instead, for this visit and later ones.
  // Only a Save in the panel counts. Osano also records an "accept all" by itself some 200 ms after load, and replays it on
  // every visit, with the panel closed (a US visitor's consent is implicit); the notice's x and its 8-second timer change no
  // consent. Osano emits the visitor's osano-cm-consent-saved while the panel is open and closes the panel after it, so the
  // event counts only while Osano.cm.drawerOpen, a documented property, says the panel is open (checked against CMP
  // 2026.10.22, configuration revision 54). Listening for the event, not for a click on Osano's Save button, keeps this
  // independent of its class names. Osano shows the cookie again after each Save, which is why a rule hides it and
  // Osano.cm.hideWidget() could not.
  // The page remembers a Save for as long as Osano remembers its choice. That lapses (after about a year, or at once when
  // marketing publishes a reconsent) and Osano then starts over with the visitor: it shows its notice again, and the page
  // forgets the Save with it, since a visitor who accepted the old terms has not accepted the new ones. Osano shows its notice
  // only when it has no current choice, so ["dialog", "show"] is the signal. It comes some 240 ms into the load, so the page
  // listens here, in <head>, where Osano's synchronous script has already run, and not at DOMContentLoaded.
  var listening = false;

  function remember() {
    root.classList.add(CONSENT_CLASS);
    try {
      window.localStorage.setItem(CONSENT_KEY, "1");
    } catch (err) {
      // the cookie stays hidden for this visit only
    }
  }

  function forget() {
    root.classList.remove(CONSENT_CLASS);
    try {
      window.localStorage.removeItem(CONSENT_KEY);
    } catch (err) {
      // storage blocked: nothing was kept
    }
  }

  function listen(cm) {
    if (listening || !cm || typeof cm.addEventListener !== "function") {
      return;
    }
    cm.addEventListener("osano-cm-consent-saved", function () {
      if (cm.drawerOpen) {
        remember();
      }
    });
    cm.addEventListener("osano-cm-ui-changed", function (component, state) {
      if (component === "dialog" && state === "show") {
        forget();
      }
    });
    listening = true;
    if (cm.dialogOpen) {
      forget(); // Osano came after <head> and its notice is open already
    }
  }

  try {
    listen(window.Osano && window.Osano.cm);
  } catch (err) {
    // Osano is a third party and this is <head>: whatever its API does, the rest of this script must still be set up.
    // DOMContentLoaded tries once more, outside anything else.
  }

  var media = function (query) {
    return window.matchMedia ? window.matchMedia(query) : { matches: false };
  };
  var systemDark = media("(prefers-color-scheme: dark)");
  var reduced = media("(prefers-reduced-motion: reduce)").matches;
  // Bars start empty and grow the first time their chart is in view; without IntersectionObserver, or with
  // reduced motion, they are simply drawn.
  var motion = "IntersectionObserver" in window && !reduced;
  if (motion) {
    root.classList.add("js-motion");
  }

  function each(list, fn) {
    Array.prototype.forEach.call(list, fn);
  }

  // A role="radiogroup" of role="radio" buttons: one tab stop, arrows (and Home/End) move and select.
  function radiogroup(group, onSelect) {
    var radios = Array.prototype.slice.call(group.querySelectorAll('[role="radio"]'));
    function select(radio, focus) {
      radios.forEach(function (r) {
        r.setAttribute("aria-checked", r === radio ? "true" : "false");
        r.tabIndex = r === radio ? 0 : -1;
      });
      if (focus) {
        radio.focus();
      }
      onSelect(radio);
    }
    radios.forEach(function (radio) {
      radio.addEventListener("click", function () {
        if (radio.getAttribute("aria-checked") !== "true") {
          select(radio, false);
        }
      });
    });
    group.addEventListener("keydown", function (event) {
      var i = radios.indexOf(document.activeElement);
      var moves = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: radios.length - 1 };
      if (i < 0 || !(event.key in moves)) {
        return;
      }
      event.preventDefault();
      select(radios[(moves[event.key] + radios.length) % radios.length], true);
    });
  }

  // Draw a chart again from empty bars (after a filter change).
  function redraw(chart) {
    if (!motion) {
      return;
    }
    chart.classList.remove("is-sorting");
    chart.classList.add("is-resetting");
    chart.classList.remove("is-drawn");
    void chart.offsetWidth; // commit the empty state before the bars grow again
    chart.classList.remove("is-resetting");
    chart.classList.add("is-drawn");
  }

  function setUpTheme() {
    var toggle = document.querySelector(".theme-toggle");
    if (!toggle) {
      return;
    }
    function current() {
      return root.getAttribute("data-theme") || (systemDark.matches ? "dark" : "light");
    }
    function label() {
      toggle.setAttribute("aria-label", toggle.getAttribute("data-" + current() + "-label"));
    }
    label();
    toggle.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        window.localStorage.setItem(KEY, next);
      } catch (err) {
        // the choice lasts for this visit only
      }
      label();
    });
    if (systemDark.addEventListener) {
      systemDark.addEventListener("change", label);
    }
  }

  function setUpFilter() {
    var group = document.querySelector(".filters");
    if (!group) {
      return;
    }
    radiogroup(group, function (radio) {
      var kind = radio.getAttribute("data-kind");
      var shown = [];
      each(document.querySelectorAll("section.bench[data-kind]"), function (section) {
        section.hidden = kind !== "all" && section.getAttribute("data-kind") !== kind;
        if (!section.hidden) {
          shown.push(section);
        }
      });
      each(document.querySelectorAll(".jumps li[data-kind]"), function (item) {
        item.hidden = kind !== "all" && item.getAttribute("data-kind") !== kind;
      });
      shown.forEach(function (section, i) {
        section.classList.toggle("alt", i % 2 === 1);
        each(section.querySelectorAll("[data-chart].is-drawn"), redraw);
      });
      var explore = document.querySelector("[data-explore]");
      if (explore && shown.length) {
        explore.setAttribute("href", "#" + shown[0].id);
      }
    });
    // Each hero tile (on phones, also each row of the list card) links to its benchmark's section. When the filter
    // hides that section, the click first sets the filter back to All; the link then lands on the section as any
    // anchor does.
    // A click that opens the link elsewhere (a modifier key) leaves this page's filter alone.
    var all = group.querySelector('[data-kind="all"]');
    each(document.querySelectorAll(".tile a"), function (link) {
      link.addEventListener("click", function (event) {
        var target = document.getElementById(link.getAttribute("href").slice(1));
        if (target && target.hidden && !(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) {
          all.click();
        }
      });
    });
  }

  function setUpSort() {
    each(document.querySelectorAll(".jev-chart"), function (chart) {
      var group = chart.querySelector('[role="radiogroup"]');
      var list = chart.querySelector(".jev-rows");
      if (!group || !list) {
        return;
      }
      var reorder = null;
      radiogroup(group, function (radio) {
        var sort = radio.getAttribute("data-sort");
        var column = radio.getAttribute("data-column") || sort;
        var items = Array.prototype.slice.call(list.children);
        // The list holds rows and the ellipses that stand in the place of the ranks a set skips (.jev-gap).
        function isGap(item) {
          return item.classList.contains("jev-gap");
        }
        var rows = items.filter(function (item) { return !isGap(item); });
        var gaps = items.filter(isGap);
        // A row has a place in the order of each sort whose set of rows it is in (Capability has its own set, the
        // other sorts share one): where it has none, the sort leaves the row out. An ellipsis has one too, the number
        // of rows above it, as the row below it has.
        function place(item) {
          var pos = item.getAttribute("data-pos-" + sort);
          return pos === null ? null : Number(pos);
        }
        // The places of the ellipses this sort shows, top to bottom. An item stands --above of them lower: the stylesheet
        // adds half a row for each, and the list is that much taller (--seps).
        var stops = gaps.map(place).filter(function (pos) { return pos !== null; }).sort(function (a, b) { return a - b; });
        function stand(item) {
          var pos = place(item);
          var above = stops.filter(function (stop) { return isGap(item) ? stop < pos : stop <= pos; }).length;
          item.style.setProperty("--pos", pos);
          item.style.setProperty("--above", above);
        }
        // Rows that join stand where they will be, transparent, before anything moves; they fade in below.
        items.forEach(function (item) {
          if (item.hidden && place(item) !== null) {
            item.classList.add("is-out");
            stand(item);
            item.hidden = false;
          }
        });
        void list.offsetWidth; // commit that state before the rows move, fade and resize
        chart.setAttribute("data-sort", sort);
        chart.classList.add("is-sorting");
        // The list is as tall as the set it shows: Capability's can be a row taller (H2O's, below the top ten) and
        // half a row taller for each ellipsis.
        list.style.setProperty("--rows", rows.filter(function (row) { return place(row) !== null; }).length);
        list.style.setProperty("--seps", stops.length);
        gaps.forEach(function (gap) {
          if (place(gap) !== null) {
            stand(gap);
          }
          gap.classList.toggle("is-out", place(gap) === null);
        });
        // Each row carries its place and its number for every sort whose set it is in; the reference row has no number
        // and no cell text.
        rows.forEach(function (row) {
          if (place(row) !== null) {
            stand(row);
          }
          row.classList.toggle("is-out", place(row) === null);
          // The number of this sort, where the row has one: a row that leaves the set has none for it, and keeps
          // its own while it fades out.
          var number = row.querySelector(".rank .num");
          if (number && row.hasAttribute("data-rank-" + sort)) {
            number.textContent = row.getAttribute("data-rank-" + sort);
          }
        });
        chart.querySelector(".sort-measure").textContent = radio.getAttribute("data-label");
        chart.querySelector(".sort-direction").textContent = radio.getAttribute("data-direction");
        each(chart.querySelectorAll(".jev-cols .col"), function (col) {
          col.classList.toggle("on", col.classList.contains("col-" + column));
        });
        // Rows slide to their new place and the ones leaving fade out; once that is done the leavers are hidden
        // and the list itself takes the new order, so a screen reader reads it as sorted too.
        window.clearTimeout(reorder);
        reorder = window.setTimeout(function () {
          items.forEach(function (item) {
            item.hidden = place(item) === null;
          });
          rows.sort(function (a, b) {
            var pa = place(a);
            var pb = place(b);
            return pa === null || pb === null ? (pa === null) - (pb === null) : pa - pb;
          }).forEach(function (row) {
            list.appendChild(row);
          });
          gaps.forEach(function (gap) { // aria-hidden, so only the stylesheet places them: they follow the rows
            list.appendChild(gap);
          });
        }, motion ? 650 : 0);
      });
    });
  }

  function setUpCharts() {
    if (!motion) {
      return;
    }
    var observer = new window.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-drawn");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    each(document.querySelectorAll("[data-chart]"), function (chart) {
      observer.observe(chart);
    });
  }

  // The footer's "Cookie settings" opens Osano's panel, so it is shown only where Osano is.
  function setUpConsent() {
    var cm = window.Osano && window.Osano.cm;
    var button = document.querySelector(".cookie-settings");
    if (!cm || !button) {
      return; // no Osano (blocked, or none on this page): the button stays hidden, as without script
    }
    listen(cm); // already listening, unless Osano only came after <head>
    button.addEventListener("click", function () {
      cm.showDrawer();
    });
    button.hidden = false;
  }

  function init() {
    try {
      setUpTheme();
      setUpFilter();
      setUpSort();
      setUpCharts();
    } catch (err) {
      root.classList.remove("js-motion"); // whatever failed, never leave the bars empty
      throw err;
    } finally {
      // Last, so that whatever Osano (a third party) does, the page's own controls are set up; and still run when one of them
      // fails, since a visitor who saved has no cookie and this button is the way back to the panel.
      setUpConsent();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
