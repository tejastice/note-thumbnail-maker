(() => {
  const EVENT_NAME = "note-thumbnail-maker:block-file-picker";
  let blockUntil = 0;

  const inputProto = HTMLInputElement.prototype;
  const originalInputClick = inputProto.click;
  const originalShowPicker = inputProto.showPicker;
  const originalWindowShowOpenFilePicker = window.showOpenFilePicker;

  function shouldBlockFilePicker(target) {
    return Date.now() <= blockUntil &&
      target instanceof HTMLInputElement &&
      target.type === "file";
  }

  inputProto.click = function patchedInputClick(...args) {
    if (shouldBlockFilePicker(this)) {
      return;
    }
    return originalInputClick.apply(this, args);
  };

  if (typeof originalShowPicker === "function") {
    inputProto.showPicker = function patchedShowPicker(...args) {
      if (shouldBlockFilePicker(this)) {
        return;
      }
      return originalShowPicker.apply(this, args);
    };
  }

  if (typeof originalWindowShowOpenFilePicker === "function") {
    window.showOpenFilePicker = async function patchedWindowShowOpenFilePicker(...args) {
      if (Date.now() <= blockUntil) {
        return [];
      }
      return originalWindowShowOpenFilePicker.apply(this, args);
    };
  }

  window.addEventListener(EVENT_NAME, (event) => {
    const durationMs = Number(event.detail?.durationMs) || 1500;
    blockUntil = Date.now() + durationMs;
  });
})();
