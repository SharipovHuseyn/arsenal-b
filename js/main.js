(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;
  var themeKey = "arsenal-theme";
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var themeToggles = document.querySelectorAll("[data-theme-toggle]");

  var applyTheme = function (theme) {
    if (theme !== "light") theme = "dark";
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem(themeKey, theme); } catch (e) {}
    if (themeMeta) themeMeta.setAttribute("content", theme === "light" ? "#f4efe6" : "#131209");
    var label = theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему";
    themeToggles.forEach(function (btn) { btn.setAttribute("aria-label", label); });
  };

  var savedTheme = null;
  try { savedTheme = localStorage.getItem(themeKey); } catch (e) {}
  applyTheme(savedTheme);

  themeToggles.forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyTheme(root.getAttribute("data-theme") === "light" ? "dark" : "light");
    });
  });

  var toggle = document.querySelector("[data-menu-toggle]");
  var menu = document.querySelector("[data-menu]");
  if (toggle && menu) {
    menu.setAttribute("inert", "");
    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
      menu.classList.toggle("is-open", open);
      document.body.classList.toggle("menu-open", open);
      if (open) menu.removeAttribute("inert");
      else menu.setAttribute("inert", "");
    };
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { setOpen(false); });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });
  }

  var reveals = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window)) {
    reveals.forEach(function (node) { node.classList.add("in"); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (node) { observer.observe(node); });
  }

  var words = [];
  document.querySelectorAll("[data-words]").forEach(function (block) {
    var accent = (block.getAttribute("data-accent") || "").split("|");
    var parts = block.textContent.trim().split(/\s+/);
    block.textContent = "";
    parts.forEach(function (part, index) {
      var span = document.createElement("span");
      span.className = "w";
      if (accent.indexOf(part.replace(/[.,]/g, "")) !== -1) span.className += " accent";
      span.textContent = part;
      block.appendChild(span);
      if (index < parts.length - 1) block.appendChild(document.createTextNode(" "));
      words.push(span);
    });
  });

  if (!words.length) return;
  if (reduce) {
    words.forEach(function (word) { word.classList.add("on"); });
    return;
  }
  var ticking = false;
  var update = function () {
    ticking = false;
    var line = window.innerHeight * 0.72;
    var queued = 0;
    words.forEach(function (word) {
      if (word.dataset.queued) return;
      if (word.getBoundingClientRect().top >= line) return;
      word.dataset.queued = "1";
      window.setTimeout(function () { word.classList.add("on"); }, queued * 70);
      queued += 1;
    });
  };
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }, { passive: true });
  update();
})();
