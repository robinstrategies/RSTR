(function () {
  const storageKey = "robinStrategyDimmer";
  const body = document.body;

  if (!body || !body.classList.contains("scene-page")) {
    return;
  }

  const saved = window.localStorage.getItem(storageKey);
  const isDimmed = saved === "dimmed";

  const overlay = document.createElement("div");
  overlay.className = "site-dimmer-overlay";
  overlay.setAttribute("aria-hidden", "true");
  body.appendChild(overlay);

  const button = document.createElement("button");
  button.className = "site-dimmer-toggle";
  button.type = "button";
  button.setAttribute("aria-pressed", String(isDimmed));
  body.appendChild(button);

  function render(nextIsDimmed) {
    body.classList.toggle("site-dimmed", nextIsDimmed);
    button.setAttribute("aria-pressed", String(nextIsDimmed));
    button.innerHTML = '<span class="dimmer-bulb" aria-hidden="true"></span>';
    button.setAttribute(
      "aria-label",
      nextIsDimmed ? "Turn brightness up" : "Dim the page brightness"
    );
  }

  button.addEventListener("click", () => {
    const nextIsDimmed = !body.classList.contains("site-dimmed");
    window.localStorage.setItem(storageKey, nextIsDimmed ? "dimmed" : "bright");
    render(nextIsDimmed);
  });

  render(isDimmed);
})();
