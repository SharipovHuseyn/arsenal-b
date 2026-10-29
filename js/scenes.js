(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var STEP_MS = 4600;
  var RESUME_MS = 8000;

  function sizeTags(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".tag"), function (tag) {
      var text = tag.querySelector("text");
      var rect = tag.querySelector("rect");
      var w = Math.ceil(text.getComputedTextLength()) + 32;
      rect.setAttribute("width", w);
      var x = Number(tag.getAttribute("data-x"));
      var y = Number(tag.getAttribute("data-y"));
      if (tag.getAttribute("data-anchor") === "end") x -= w;
      x = Math.max(8, Math.min(x, 392 - w));
      tag.setAttribute("transform", "translate(" + x + " " + y + ")");
    });
  }

  function init(root) {
    var buttons = Array.prototype.slice.call(root.querySelectorAll("[data-step]"));
    var n = buttons.length;
    var box = root.querySelector(".fire-step");
    var num = root.querySelector(".fire-num");
    var title = root.querySelector(".fire-step strong");
    var text = root.querySelector(".fire-step p");
    var active = -1;
    var startedAt = 0;
    var resumeAt = reduce ? Infinity : 0;
    var visible = true;
    var running = false;

    function go(i, byUser) {
      i = (i + n) % n;
      var now = performance.now();
      startedAt = now;
      if (byUser) {
        root.classList.add("used");
        if (!reduce) resumeAt = now + RESUME_MS;
      }
      if (i === active) return;
      active = i;
      root.setAttribute("data-active", i);
      for (var k = 0; k < n; k++) root.classList.toggle("r" + k, k <= i);
      var b = buttons[i];
      num.textContent = (i < 9 ? "0" : "") + (i + 1);
      title.textContent = b.getAttribute("data-title");
      text.textContent = b.getAttribute("data-text");
      buttons.forEach(function (btn, k) { btn.setAttribute("aria-current", k === i ? "step" : "false"); });
      box.classList.remove("swap");
      void box.offsetWidth;
      box.classList.add("swap");
    }

    function frame() {
      if (!visible || document.hidden) {
        running = false;
        return;
      }
      requestAnimationFrame(frame);
      var now = performance.now();
      var p;
      if (now < resumeAt) {
        startedAt = now;
        p = 1;
      } else {
        p = Math.min(1, (now - startedAt) / STEP_MS);
        if (p >= 1) {
          go(active + 1);
          p = 0;
        }
      }
      buttons.forEach(function (btn, k) {
        btn.style.setProperty("--p", k < active ? 1 : k > active ? 0 : p.toFixed(3));
      });
    }

    function kick() {
      root.classList.toggle("paused", !visible || document.hidden);
      if (running || !visible || document.hidden) return;
      running = true;
      startedAt = performance.now();
      requestAnimationFrame(frame);
    }

    buttons.forEach(function (btn, i) {
      btn.addEventListener("click", function () { go(i, true); });
    });

    root.addEventListener("keydown", function (event) {
      if (event.target !== root) return;
      if (event.key === "ArrowRight") { event.preventDefault(); go(active + 1, true); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); go(active - 1, true); }
    });

    var startX = 0;
    var startY = 0;
    var tracking = false;
    root.addEventListener("pointerdown", function (event) {
      if (event.target.closest("button")) return;
      tracking = true;
      startX = event.clientX;
      startY = event.clientY;
    });
    root.addEventListener("pointerup", function (event) {
      if (!tracking) return;
      tracking = false;
      var dx = event.clientX - startX;
      var dy = event.clientY - startY;
      if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.2) go(active + (dx < 0 ? 1 : -1), true);
    });
    root.addEventListener("pointercancel", function () { tracking = false; });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        kick();
      }, { threshold: 0.01 }).observe(root);
    }
    document.addEventListener("visibilitychange", kick);

    sizeTags(root);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { sizeTags(root); });
    go(0);
    root.classList.add("is-live");
    kick();
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-scene]"), init);
})();
