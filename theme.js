(() => {
  const storageKey = "koops-games-theme";
  let savedTheme = "dark";
  try {
    const stored = localStorage.getItem(storageKey) || localStorage.getItem("koopsfood-theme");
    if (stored === "light" || stored === "dark") savedTheme = stored;
  } catch (_) { /* The theme toggle still works when storage is unavailable. */ }

  function applyTheme(theme, persist = true) {
    const selected = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = selected;
    document.documentElement.style.colorScheme = selected;
    document.querySelectorAll(".theme-toggle").forEach((button) => {
      button.textContent = selected === "dark" ? "☼ Light mode" : "☾ Dark mode";
      button.setAttribute("aria-label", `Switch to ${selected === "dark" ? "light" : "dark"} mode`);
      button.setAttribute("aria-pressed", String(selected === "dark"));
    });
    if (persist) {
      try { localStorage.setItem(storageKey, selected); } catch (_) { /* Optional persistence. */ }
    }
    window.dispatchEvent(new CustomEvent("koops-games-theme-change", { detail: { theme: selected } }));
  }

  document.querySelectorAll(".theme-toggle").forEach((button) => {
    button.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  });
  applyTheme(savedTheme, false);
})();
