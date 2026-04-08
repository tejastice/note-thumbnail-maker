chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "note-thumbnail-maker:get-font-list") {
    return false;
  }

  chrome.fontSettings.getFontList((fonts) => {
    if (chrome.runtime.lastError) {
      sendResponse({
        ok: false,
        error: chrome.runtime.lastError.message
      });
      return;
    }

    sendResponse({
      ok: true,
      fonts: Array.isArray(fonts) ? fonts : []
    });
  });

  return true;
});
