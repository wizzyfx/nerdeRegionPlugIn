chrome.devtools.panels.create(
  "NerdeRegion",
  null,
  "src/panel/panel.html",
  (panel) => {
    panel.onShown.addListener((currentPanel) => {
      currentPanel.panelShown();
    });
  }
);
