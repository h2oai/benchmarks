/* h2o.ai/benchmarks: theme toggle, section filter, JevBench sort and one-time motion. A classic script loaded
   in <head> (inlined in h2o-benchmarks.html), so it runs from file:// with no modules and no fetch. Without it
   the page still reads in full: the theme follows the system, every section shows, bars are drawn, and the
   controls that need it stay hidden. */
(function () {
  "use strict";
  var root = document.documentElement;
  var KEY = "h2o-benchmarks-theme";
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
    // Each hero tile (on phones, a row of the board) links to its benchmark's section. When the filter hides that
    // section, the click first sets the filter back to All; the link then lands on the section as any anchor does.
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
        var rows = Array.prototype.slice.call(list.children);
        // A row has a place in the order of each sort whose set of rows it is in (Capability has its own set, the
        // other sorts share one): where it has none, the sort leaves the row out.
        function place(row) {
          var pos = row.getAttribute("data-pos-" + sort);
          return pos === null ? null : Number(pos);
        }
        // Rows that join stand where they will be, transparent, before anything moves; they fade in below.
        rows.forEach(function (row) {
          if (row.hidden && place(row) !== null) {
            row.classList.add("is-out");
            row.style.setProperty("--pos", place(row));
            row.hidden = false;
          }
        });
        void list.offsetWidth; // commit that state before the rows move, fade and resize
        chart.setAttribute("data-sort", sort);
        chart.classList.add("is-sorting");
        // Each row carries its place and its number for every sort whose set it is in; the reference row has no number
        // and no cell text.
        rows.forEach(function (row) {
          if (place(row) !== null) {
            row.style.setProperty("--pos", place(row));
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
          rows.forEach(function (row) {
            row.hidden = place(row) === null;
          });
          rows.sort(function (a, b) {
            var pa = place(a);
            var pb = place(b);
            return pa === null || pb === null ? (pa === null) - (pb === null) : pa - pb;
          }).forEach(function (row) {
            list.appendChild(row);
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

  function init() {
    try {
      setUpTheme();
      setUpFilter();
      setUpSort();
      setUpCharts();
    } catch (err) {
      root.classList.remove("js-motion"); // whatever failed, never leave the bars empty
      throw err;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
