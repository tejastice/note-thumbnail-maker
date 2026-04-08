(function () {
  const CONTROLS_ID = "note-thumbnail-maker-controls";
  const BUTTON_ID = "note-thumbnail-maker-button";
  const DOWNLOAD_BUTTON_ID = "note-thumbnail-maker-download-button";
  const FONT_SELECT_ID = "note-thumbnail-maker-font";
  const FONT_SIZE_INPUT_ID = "note-thumbnail-maker-font-size";
  const FONT_COLOR_INPUT_ID = "note-thumbnail-maker-font-color";
  const BACKGROUND_UPLOAD_BUTTON_ID = "note-thumbnail-maker-background-upload";
  const BACKGROUND_REMOVE_BUTTON_ID = "note-thumbnail-maker-background-remove";
  const BACKGROUND_INPUT_ID = "note-thumbnail-maker-background-input";
  const BACKGROUND_PREVIEW_ID = "note-thumbnail-maker-background-preview";
  const BACKGROUND_PREVIEW_IMAGE_ID = "note-thumbnail-maker-background-preview-image";
  const BACKGROUND_PREVIEW_LABEL_ID = "note-thumbnail-maker-background-preview-label";
  const BACKGROUND_PREVIEW_HINT_ID = "note-thumbnail-maker-background-preview-hint";
  const BACKGROUND_PREVIEW_STATUS_ID = "note-thumbnail-maker-background-preview-status";
  const PRIMARY_ROW_ID = "note-thumbnail-maker-primary-row";
  const BACKGROUND_ROW_ID = "note-thumbnail-maker-background-row";
  const TOAST_ID = "note-thumbnail-maker-toast";
  const BUTTON_LABEL = "タイトルからサムネイルを生成";
  const DOWNLOAD_BUTTON_LABEL = "サムネをDL";
  const TEMPLATE_PATH = "template/background.jpg";
  const PAGE_HOOK_PATH = "page-hook.js";
  const UPLOAD_LABEL = "画像をアップロード";
  const TITLE_SELECTOR = 'textarea[placeholder="記事タイトル"]';
  const IMAGE_ADD_BUTTON_SELECTOR = 'button[aria-label="画像を追加"]';
  const BLOCK_PICKER_EVENT = "note-thumbnail-maker:block-file-picker";
  const DEFAULT_FONT_SIZE = 140;
  const MIN_FONT_SIZE = 40;
  const MAX_FONT_SIZE = 240;
  const TEXT_MARGIN = 80;
  const LINE_SPACING = 24;
  const TEXT_COLOR = "#1e1e1e";
  const CONTROLS_ROW_HEIGHT = 34;
  const STORAGE_KEY = "noteThumbnailMaker.settings";
  const BACKGROUND_STORAGE_KEY = "noteThumbnailMaker.backgroundImage";
  const FONT_LIST_MESSAGE = "note-thumbnail-maker:get-font-list";
  const ACCEPTED_BACKGROUND_TYPES = new Set(["image/jpeg", "image/png"]);
  const BACKGROUND_EXPORT_QUALITY = 0.9;
  const MAX_BACKGROUND_EDGE = 1920;
  const FONT_OPTIONS = [
    {
      key: "sans",
      label: "Hiragino Sans",
      family: '"Hiragino Sans", "Yu Gothic", sans-serif'
    },
    {
      key: "serif",
      label: "Yu Mincho",
      family: '"Yu Mincho", "Hiragino Mincho ProN", serif'
    }
  ];
  let isGenerateFlowRunning = false;
  let lastSeenUrl = location.href;
  let pageHookInjected = false;
  let cachedFontOptions = null;
  let fontOptionsRequest = null;

  const observer = new MutationObserver(() => {
    if (!isGenerateFlowRunning) {
      ensureGenerateButton();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.addEventListener("resize", () => {
    if (!isGenerateFlowRunning) {
      ensureGenerateButton();
    }
  }, { passive: true });

  window.addEventListener("scroll", () => {
    if (!isGenerateFlowRunning) {
      ensureGenerateButton();
    }
  }, { passive: true });

  window.setInterval(() => {
    if (!isGenerateFlowRunning) {
      if (location.href !== lastSeenUrl) {
        lastSeenUrl = location.href;
        removeGenerateButton();
      }
      ensureGenerateButton();
    }
  }, 1000);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bootstrapGenerateButton();
    }, { once: true });
  } else {
    bootstrapGenerateButton();
  }

  function bootstrapGenerateButton() {
    ensurePageHookInjected();
    ensureGenerateButton();
    window.setTimeout(ensureGenerateButton, 1000);
    window.setTimeout(ensureGenerateButton, 2500);
  }

  function ensureGenerateButton() {
    if (!location.href.match(/^https:\/\/editor\.note\.com\/notes\/[^/]+\/edit\/?$/)) {
      return;
    }

    if (isCropDialogOpen()) {
      removeGenerateButton();
      return;
    }

    const imageAddButton = findImageAddButton();
    if (!imageAddButton) {
      removeGenerateButton();
      return;
    }

    const existingControls = document.getElementById(CONTROLS_ID);
    if (existingControls) {
      syncControlsStyle(existingControls, imageAddButton);
      applyControlFonts(existingControls);
      return;
    }

    const settings = readSettings();
    const controls = document.createElement("div");
    controls.id = CONTROLS_ID;
    controls.setAttribute("data-note-thumbnail-maker", "true");

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = BUTTON_LABEL;
    button.setAttribute("data-note-thumbnail-maker", "true");
    button.addEventListener("click", handleGenerateClick);

    const downloadButton = document.createElement("button");
    downloadButton.id = DOWNLOAD_BUTTON_ID;
    downloadButton.type = "button";
    downloadButton.textContent = DOWNLOAD_BUTTON_LABEL;
    downloadButton.setAttribute("data-note-thumbnail-maker", "true");
    downloadButton.addEventListener("click", handleDownloadClick);

    const fontSelect = document.createElement("select");
    fontSelect.id = FONT_SELECT_ID;
    fontSelect.setAttribute("aria-label", "フォント選択");
    populateFontSelect(fontSelect, getAvailableFontOptions(), settings.fontKey);
    fontSelect.addEventListener("change", saveCurrentSettings);

    const fontSizeInput = document.createElement("input");
    fontSizeInput.id = FONT_SIZE_INPUT_ID;
    fontSizeInput.type = "number";
    fontSizeInput.min = String(MIN_FONT_SIZE);
    fontSizeInput.max = String(MAX_FONT_SIZE);
    fontSizeInput.step = "2";
    fontSizeInput.value = String(settings.fontSize);
    fontSizeInput.setAttribute("aria-label", "フォントサイズ");
    fontSizeInput.addEventListener("change", saveCurrentSettings);

    const sizeSuffix = document.createElement("span");
    sizeSuffix.textContent = "pt";
    sizeSuffix.setAttribute("data-note-thumbnail-maker", "true");

    const fontColorInput = document.createElement("input");
    fontColorInput.id = FONT_COLOR_INPUT_ID;
    fontColorInput.type = "color";
    fontColorInput.value = settings.textColor;
    fontColorInput.setAttribute("aria-label", "フォントカラー");
    fontColorInput.addEventListener("change", saveCurrentSettings);

    const backgroundUploadButton = document.createElement("button");
    backgroundUploadButton.id = BACKGROUND_UPLOAD_BUTTON_ID;
    backgroundUploadButton.type = "button";
    backgroundUploadButton.innerHTML = "背景をアップロード<br>クリック / ドロップ";
    backgroundUploadButton.setAttribute("data-note-thumbnail-maker", "true");
    backgroundUploadButton.title = "PNG/JPG をクリックまたはドラッグ&ドロップで設定";
    backgroundUploadButton.addEventListener("click", openBackgroundFilePicker);
    backgroundUploadButton.addEventListener("dragover", handleBackgroundDragOver);
    backgroundUploadButton.addEventListener("dragleave", handleBackgroundDragLeave);
    backgroundUploadButton.addEventListener("drop", handleBackgroundDrop);

    const backgroundRemoveButton = document.createElement("button");
    backgroundRemoveButton.id = BACKGROUND_REMOVE_BUTTON_ID;
    backgroundRemoveButton.type = "button";
    backgroundRemoveButton.textContent = "背景を削除";
    backgroundRemoveButton.setAttribute("data-note-thumbnail-maker", "true");
    backgroundRemoveButton.addEventListener("click", removeUploadedBackground);

    const backgroundInput = document.createElement("input");
    backgroundInput.id = BACKGROUND_INPUT_ID;
    backgroundInput.type = "file";
    backgroundInput.accept = "image/png,image/jpeg";
    backgroundInput.style.display = "none";
    backgroundInput.addEventListener("change", handleBackgroundFileSelection);

    const backgroundPreview = document.createElement("div");
    backgroundPreview.id = BACKGROUND_PREVIEW_ID;
    backgroundPreview.setAttribute("data-note-thumbnail-maker", "true");

    const backgroundPreviewImage = document.createElement("img");
    backgroundPreviewImage.id = BACKGROUND_PREVIEW_IMAGE_ID;
    backgroundPreviewImage.alt = "背景プレビュー";

    const backgroundPreviewLabel = document.createElement("span");
    backgroundPreviewLabel.id = BACKGROUND_PREVIEW_LABEL_ID;
    backgroundPreviewLabel.textContent = "デフォルト背景";

    const backgroundPreviewStatus = document.createElement("span");
    backgroundPreviewStatus.id = BACKGROUND_PREVIEW_STATUS_ID;
    backgroundPreviewStatus.textContent = "使用中";

    const backgroundPreviewHint = document.createElement("span");
    backgroundPreviewHint.id = BACKGROUND_PREVIEW_HINT_ID;
    backgroundPreviewHint.textContent = "推奨 1920x1006 / 1280x670";

    const primaryRow = document.createElement("div");
    primaryRow.id = PRIMARY_ROW_ID;
    primaryRow.setAttribute("data-note-thumbnail-maker", "true");

    const backgroundRow = document.createElement("div");
    backgroundRow.id = BACKGROUND_ROW_ID;
    backgroundRow.setAttribute("data-note-thumbnail-maker", "true");

    primaryRow.appendChild(button);
    primaryRow.appendChild(downloadButton);
    primaryRow.appendChild(fontSelect);
    primaryRow.appendChild(fontSizeInput);
    primaryRow.appendChild(sizeSuffix);
    primaryRow.appendChild(fontColorInput);
    controls.appendChild(primaryRow);
    backgroundPreview.appendChild(backgroundPreviewImage);
    backgroundPreview.appendChild(backgroundPreviewStatus);
    backgroundPreview.appendChild(backgroundPreviewLabel);
    backgroundRow.appendChild(backgroundUploadButton);
    backgroundRow.appendChild(backgroundRemoveButton);
    backgroundRow.appendChild(backgroundPreview);
    backgroundRow.appendChild(backgroundPreviewHint);
    controls.appendChild(backgroundRow);
    controls.appendChild(backgroundInput);
    syncControlsStyle(controls, imageAddButton);
    applyControlFonts(controls);
    insertControlsNearButton(controls, imageAddButton);
    hydrateInstalledFonts(fontSelect);
    syncBackgroundControlsState();
  }

  function removeGenerateButton() {
    const controls = document.getElementById(CONTROLS_ID);
    if (!controls) {
      return;
    }
    controls.remove();
  }

  async function handleGenerateClick(event) {
    const button = event.currentTarget;
    const restore = setButtonState(button);
    isGenerateFlowRunning = true;

    try {
      const file = await makeThumbnailFileFromCurrentTitle();
      let uploadButton = findButtonByText(UPLOAD_LABEL);
      if (!uploadButton) {
        const imageAddButton = findImageAddButton();
        if (!imageAddButton) {
          throw new Error("画像を追加ボタンが見つかりません");
        }

        imageAddButton.click();
        uploadButton = await waitFor(() => findButtonByText(UPLOAD_LABEL), 4000);
      }
      await uploadFileThroughNativeInput(uploadButton, file);

      setButtonState(button, undefined, 2000, restore);
    } catch (error) {
      console.error("[Note Thumbnail Maker] failed:", error);
      showErrorToast(error instanceof Error ? error.message : "サムネイル生成に失敗しました");
      setButtonState(button, undefined, 2500, restore);
    } finally {
      isGenerateFlowRunning = false;
      ensureGenerateButton();
    }
  }

  async function handleDownloadClick(event) {
    const button = event.currentTarget;
    const restore = setButtonState(button);

    try {
      const file = await makeThumbnailFileFromCurrentTitle();
      downloadFile(file, buildDownloadFileName());
      setButtonState(button, undefined, 1500, restore);
    } catch (error) {
      console.error("[Note Thumbnail Maker] download failed:", error);
      showErrorToast(error instanceof Error ? error.message : "サムネイルのダウンロードに失敗しました");
      setButtonState(button, undefined, 2500, restore);
    }
  }

  function syncControlsStyle(controls, sourceButton) {
    const sourceStyle = window.getComputedStyle(sourceButton);
    const controlHeight = `${CONTROLS_ROW_HEIGHT}px`;
    const button = controls.querySelector(`#${BUTTON_ID}`);
    const downloadButton = controls.querySelector(`#${DOWNLOAD_BUTTON_ID}`);
    const fontSelect = controls.querySelector(`#${FONT_SELECT_ID}`);
    const fontSizeInput = controls.querySelector(`#${FONT_SIZE_INPUT_ID}`);
    const fontColorInput = controls.querySelector(`#${FONT_COLOR_INPUT_ID}`);
    const backgroundUploadButton = controls.querySelector(`#${BACKGROUND_UPLOAD_BUTTON_ID}`);
    const backgroundRemoveButton = controls.querySelector(`#${BACKGROUND_REMOVE_BUTTON_ID}`);
    const backgroundPreview = controls.querySelector(`#${BACKGROUND_PREVIEW_ID}`);
    const backgroundPreviewImage = controls.querySelector(`#${BACKGROUND_PREVIEW_IMAGE_ID}`);
    const backgroundPreviewLabel = controls.querySelector(`#${BACKGROUND_PREVIEW_LABEL_ID}`);
    const backgroundPreviewStatus = controls.querySelector(`#${BACKGROUND_PREVIEW_STATUS_ID}`);
    const backgroundPreviewHint = controls.querySelector(`#${BACKGROUND_PREVIEW_HINT_ID}`);
    const primaryRow = controls.querySelector(`#${PRIMARY_ROW_ID}`);
    const backgroundRow = controls.querySelector(`#${BACKGROUND_ROW_ID}`);
    const sizeSuffix = controls.querySelector('span[data-note-thumbnail-maker="true"]');

    controls.style.display = "flex";
    controls.style.flexDirection = "column";
    controls.style.alignItems = "flex-start";
    controls.style.gap = "6px";
    controls.style.position = "relative";
    controls.style.maxWidth = "420px";
    controls.style.marginTop = "8px";

    primaryRow.style.display = "flex";
    primaryRow.style.alignItems = "center";
    primaryRow.style.gap = "8px";
    primaryRow.style.width = "100%";

    button.style.display = "inline-flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.padding = "0 12px";
    button.style.height = controlHeight;
    button.style.minHeight = controlHeight;
    button.style.border = "1px solid rgba(0, 0, 0, 0.12)";
    button.style.borderRadius = "4px";
    button.style.background = "#ffffff";
    button.style.backgroundColor = "#ffffff";
    button.style.color = "#222222";
    button.style.font = sourceStyle.font || "500 14px sans-serif";
    button.style.fontSize = "13px";
    button.style.fontWeight = "500";
    button.style.lineHeight = "1";
    button.style.cursor = "pointer";
    button.style.whiteSpace = "nowrap";
    button.style.boxShadow = "none";

    downloadButton.style.display = "inline-flex";
    downloadButton.style.alignItems = "center";
    downloadButton.style.justifyContent = "center";
    downloadButton.style.padding = "0 12px";
    downloadButton.style.height = controlHeight;
    downloadButton.style.minHeight = controlHeight;
    downloadButton.style.border = button.style.border;
    downloadButton.style.borderRadius = button.style.borderRadius;
    downloadButton.style.background = "#ffffff";
    downloadButton.style.backgroundColor = "#ffffff";
    downloadButton.style.color = "#222222";
    downloadButton.style.font = sourceStyle.font || "500 14px sans-serif";
    downloadButton.style.fontSize = "13px";
    downloadButton.style.fontWeight = "500";
    downloadButton.style.lineHeight = "1";
    downloadButton.style.cursor = "pointer";
    downloadButton.style.whiteSpace = "nowrap";
    downloadButton.style.boxShadow = "none";

    fontSelect.style.height = controlHeight;
    fontSelect.style.padding = "0 8px";
    fontSelect.style.border = button.style.border;
    fontSelect.style.borderRadius = button.style.borderRadius;
    fontSelect.style.background = "#ffffff";
    fontSelect.style.color = "#222222";
    fontSelect.style.font = sourceStyle.font || "500 14px sans-serif";

    fontSizeInput.style.width = "64px";
    fontSizeInput.style.height = controlHeight;
    fontSizeInput.style.padding = "0 8px";
    fontSizeInput.style.border = button.style.border;
    fontSizeInput.style.borderRadius = button.style.borderRadius;
    fontSizeInput.style.background = "#ffffff";
    fontSizeInput.style.color = "#222222";
    fontSizeInput.style.font = sourceStyle.font || "500 14px sans-serif";

    fontColorInput.style.width = controlHeight;
    fontColorInput.style.minWidth = controlHeight;
    fontColorInput.style.height = controlHeight;
    fontColorInput.style.padding = "3px";
    fontColorInput.style.border = button.style.border;
    fontColorInput.style.borderRadius = button.style.borderRadius;
    fontColorInput.style.background = "#ffffff";
    fontColorInput.style.cursor = "pointer";
    fontColorInput.style.boxSizing = "border-box";
    fontColorInput.style.appearance = "auto";

    [backgroundUploadButton, backgroundRemoveButton].forEach((controlButton) => {
      controlButton.style.display = "inline-flex";
      controlButton.style.alignItems = "center";
      controlButton.style.justifyContent = "center";
      controlButton.style.padding = "0 10px";
      controlButton.style.height = controlHeight;
      controlButton.style.border = button.style.border;
      controlButton.style.borderRadius = button.style.borderRadius;
      controlButton.style.background = "#ffffff";
      controlButton.style.color = "#222222";
      controlButton.style.font = sourceStyle.font || "500 14px sans-serif";
      controlButton.style.fontSize = "12px";
      controlButton.style.cursor = "pointer";
      controlButton.style.whiteSpace = "nowrap";
    });

    backgroundUploadButton.style.minWidth = "124px";
    backgroundUploadButton.style.lineHeight = "1.2";
    backgroundUploadButton.style.textAlign = "center";
    backgroundUploadButton.style.borderStyle = "dashed";

    backgroundRow.style.display = "flex";
    backgroundRow.style.alignItems = "center";
    backgroundRow.style.gap = "8px";
    backgroundRow.style.width = "100%";

    backgroundPreview.style.display = "inline-flex";
    backgroundPreview.style.alignItems = "center";
    backgroundPreview.style.gap = "8px";
    backgroundPreview.style.height = controlHeight;
    backgroundPreview.style.padding = "0 8px";
    backgroundPreview.style.border = "1px solid rgba(0, 0, 0, 0.12)";
    backgroundPreview.style.borderRadius = button.style.borderRadius;
    backgroundPreview.style.background = "#ffffff";
    backgroundPreview.style.maxWidth = "220px";

    backgroundPreviewImage.style.width = "42px";
    backgroundPreviewImage.style.height = `calc(${controlHeight} - 10px)`;
    backgroundPreviewImage.style.minWidth = "42px";
    backgroundPreviewImage.style.objectFit = "cover";
    backgroundPreviewImage.style.borderRadius = "3px";
    backgroundPreviewImage.style.background = "#f2f2f2";
    backgroundPreviewImage.style.border = "1px solid rgba(0, 0, 0, 0.08)";

    backgroundPreviewStatus.style.display = "inline-flex";
    backgroundPreviewStatus.style.alignItems = "center";
    backgroundPreviewStatus.style.justifyContent = "center";
    backgroundPreviewStatus.style.height = "18px";
    backgroundPreviewStatus.style.padding = "0 6px";
    backgroundPreviewStatus.style.borderRadius = "999px";
    backgroundPreviewStatus.style.background = "#eef6ee";
    backgroundPreviewStatus.style.color = "#2f6f44";
    backgroundPreviewStatus.style.font = sourceStyle.font || "500 14px sans-serif";
    backgroundPreviewStatus.style.fontSize = "10px";
    backgroundPreviewStatus.style.fontWeight = "600";
    backgroundPreviewStatus.style.whiteSpace = "nowrap";

    backgroundPreviewLabel.style.color = "#444444";
    backgroundPreviewLabel.style.font = sourceStyle.font || "500 14px sans-serif";
    backgroundPreviewLabel.style.fontSize = "12px";
    backgroundPreviewLabel.style.lineHeight = "1.2";
    backgroundPreviewLabel.style.whiteSpace = "nowrap";
    backgroundPreviewLabel.style.overflow = "hidden";
    backgroundPreviewLabel.style.textOverflow = "ellipsis";

    backgroundPreviewHint.style.color = "#777777";
    backgroundPreviewHint.style.font = sourceStyle.font || "500 14px sans-serif";
    backgroundPreviewHint.style.fontSize = "11px";
    backgroundPreviewHint.style.lineHeight = "1.2";
    backgroundPreviewHint.style.whiteSpace = "nowrap";

    sizeSuffix.style.color = "#666666";
    sizeSuffix.style.font = sourceStyle.font || "500 14px sans-serif";
    sizeSuffix.style.whiteSpace = "nowrap";
  }

  function insertControlsNearButton(controls, sourceButton) {
    const host = sourceButton.parentElement;
    if (!host) {
      document.body.appendChild(controls);
      return;
    }

    host.insertAdjacentElement("afterend", controls);
  }

  async function makeThumbnailFile(title) {
    const settings = readSettings();
    const fontOption = getFontOption(settings.fontKey);

    const url = await resolveBackgroundImageUrl();
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`テンプレート画像の読み込みに失敗しました: ${response.status}`);
    }

    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);

    const lines = buildLines(ctx, title, canvas.width, canvas.height);
    const fontSize = calcAutoFontSize(ctx, lines, canvas.width, canvas.height, settings.fontSize, fontOption.family);
    const metrics = measureLines(ctx, lines, fontSize, fontOption.family);
    drawLines(ctx, lines, metrics, canvas.width, canvas.height, fontSize, fontOption.family, settings.textColor);

    const outputBlob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error("画像の生成に失敗しました"));
      }, "image/jpeg", 0.95);
    });

    return new File([outputBlob], "thumbnail.jpg", { type: "image/jpeg" });
  }

  async function makeThumbnailFileFromCurrentTitle() {
    const title = getTitleText();
    if (!title) {
      throw new Error("記事タイトルが空です");
    }

    return makeThumbnailFile(title);
  }

  function getExtensionUrl(path) {
    const browserRuntimeUrl = globalThis.browser?.runtime?.getURL?.(path);
    if (browserRuntimeUrl) {
      return browserRuntimeUrl;
    }

    const runtimeUrl = globalThis.chrome?.runtime?.getURL?.(path);
    if (runtimeUrl) {
      return runtimeUrl;
    }

    const extensionUrl = globalThis.chrome?.extension?.getURL?.(path);
    if (extensionUrl) {
      return extensionUrl;
    }

    const runtimeId = globalThis.chrome?.runtime?.id || globalThis.browser?.runtime?.id;
    if (runtimeId) {
      return `chrome-extension://${runtimeId}/${path}`;
    }

    throw new Error(`拡張ファイルURLを解決できません: ${path}`);
  }

  async function resolveBackgroundImageUrl() {
    const customBackground = await getStoredBackgroundImage();
    if (customBackground) {
      return customBackground;
    }

    return getExtensionUrl(TEMPLATE_PATH);
  }

  async function uploadFileThroughNativeInput(uploadButton, file) {
    const knownInputs = new Set(document.querySelectorAll('input[type="file"]'));
    const inputPromise = waitForNewFileInput(knownInputs, 4000);

    requestFilePickerBlock();
    uploadButton.click();
    const input = await inputPromise;
    assignFileToInput(input, file);
  }

  function ensurePageHookInjected() {
    if (pageHookInjected || document.documentElement.hasAttribute("data-note-thumbnail-maker-hook")) {
      pageHookInjected = true;
      return;
    }

    const script = document.createElement("script");
    script.src = getExtensionUrl(PAGE_HOOK_PATH);
    script.dataset.noteThumbnailMakerHook = "true";
    script.addEventListener("load", () => {
      pageHookInjected = true;
      document.documentElement.setAttribute("data-note-thumbnail-maker-hook", "true");
      script.remove();
    }, { once: true });
    script.addEventListener("error", () => {
      script.remove();
    }, { once: true });
    (document.head || document.documentElement).appendChild(script);
  }

  function requestFilePickerBlock() {
    ensurePageHookInjected();
    window.dispatchEvent(new CustomEvent(BLOCK_PICKER_EVENT, {
      detail: { durationMs: 1500 }
    }));
  }

  function waitForNewFileInput(knownInputs, timeoutMs) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.querySelectorAll('input[type="file"]'))
        .find((candidate) => !knownInputs.has(candidate));
      if (existing) {
        resolve(existing);
        return;
      }

      const observer = new MutationObserver(() => {
        const freshInput = Array.from(document.querySelectorAll('input[type="file"]'))
          .find((candidate) => !knownInputs.has(candidate));
        if (!freshInput) {
          return;
        }

        observer.disconnect();
        window.clearTimeout(timerId);
        resolve(freshInput);
      });

      const timerId = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error("file input が見つかりません"));
      }, timeoutMs);

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    });
  }

  function getTitleText() {
    const titleInput = document.querySelector(TITLE_SELECTOR);
    return normalizeText(titleInput?.value || "");
  }

  function findImageAddButton() {
    return document.querySelector(IMAGE_ADD_BUTTON_SELECTOR);
  }

  function isCropDialogOpen() {
    return Boolean(document.querySelector('[role="dialog"]'));
  }

  function readSettings() {
    const defaults = {
      fontKey: FONT_OPTIONS[0].key,
      fontSize: DEFAULT_FONT_SIZE,
      textColor: TEXT_COLOR
    };

    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const fontKey = getAvailableFontOptions().some((option) => option.key === parsed.fontKey)
        ? parsed.fontKey
        : defaults.fontKey;
      const fontSize = clampFontSize(parsed.fontSize);
      const textColor = normalizeColor(parsed.textColor);
      return {
        fontKey,
        fontSize,
        textColor
      };
    } catch {
      return defaults;
    }
  }

  function saveCurrentSettings() {
    const fontSelect = document.getElementById(FONT_SELECT_ID);
    const fontSizeInput = document.getElementById(FONT_SIZE_INPUT_ID);
    const fontColorInput = document.getElementById(FONT_COLOR_INPUT_ID);
    if (!fontSelect || !fontSizeInput || !fontColorInput) {
      return;
    }

    const settings = {
      fontKey: getAvailableFontOptions().some((option) => option.key === fontSelect.value)
        ? fontSelect.value
        : FONT_OPTIONS[0].key,
      fontSize: clampFontSize(fontSizeInput.value),
      textColor: normalizeColor(fontColorInput.value)
    };

    fontSizeInput.value = String(settings.fontSize);
    fontColorInput.value = settings.textColor;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    const controls = document.getElementById(CONTROLS_ID);
    if (controls) {
      applyControlFonts(controls);
    }
  }

  function openBackgroundFilePicker() {
    const input = document.getElementById(BACKGROUND_INPUT_ID);
    if (!input) {
      return;
    }

    input.click();
  }

  function handleBackgroundDragOver(event) {
    event.preventDefault();
    const button = event.currentTarget;
    if (button instanceof HTMLElement) {
      button.innerHTML = "ここにドロップ<br>PNG / JPG";
      button.style.background = "#eef4ff";
      button.style.borderColor = "#3f6ed8";
      button.style.color = "#2448a8";
    }
  }

  function handleBackgroundDragLeave(event) {
    resetBackgroundUploadButtonState(event.currentTarget);
  }

  async function handleBackgroundDrop(event) {
    event.preventDefault();
    resetBackgroundUploadButtonState(event.currentTarget);

    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }

    await saveBackgroundFile(file);
  }

  async function handleBackgroundFileSelection(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }

    await saveBackgroundFile(file);
  }

  function resetBackgroundUploadButtonState(target) {
    if (target instanceof HTMLElement) {
      target.innerHTML = "背景をアップロード<br>クリック / ドロップ";
      target.style.background = "#ffffff";
      target.style.borderColor = "rgba(0, 0, 0, 0.12)";
      target.style.color = "#222222";
    }
  }

  async function saveBackgroundFile(file) {
    try {
      validateBackgroundFile(file);
      const dataUrl = await convertImageFileToJpegDataUrl(file);
      await setStorageValue(BACKGROUND_STORAGE_KEY, dataUrl);
      await syncBackgroundControlsState();
    } catch (error) {
      console.error("[Note Thumbnail Maker] background upload failed:", error);
      showErrorToast(error instanceof Error ? error.message : "背景画像の保存に失敗しました");
    }
  }

  async function removeUploadedBackground() {
    try {
      await removeStorageValue(BACKGROUND_STORAGE_KEY);
      await syncBackgroundControlsState();
    } catch (error) {
      console.error("[Note Thumbnail Maker] background removal failed:", error);
      showErrorToast(error instanceof Error ? error.message : "背景画像の削除に失敗しました");
    }
  }

  function validateBackgroundFile(file) {
    const fileName = String(file.name || "").toLowerCase();
    const isAcceptedType = ACCEPTED_BACKGROUND_TYPES.has(file.type) ||
      fileName.endsWith(".png") ||
      fileName.endsWith(".jpg") ||
      fileName.endsWith(".jpeg");

    if (!isAcceptedType) {
      throw new Error("背景画像は PNG か JPEG を選んでください");
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("画像ファイルを読み込めませんでした"));
      reader.readAsDataURL(file);
    });
  }

  async function convertImageFileToJpegDataUrl(file) {
    const sourceUrl = await readFileAsDataUrl(file);
    const image = await loadImage(sourceUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const resized = resizeToMaxEdge(sourceWidth, sourceHeight, MAX_BACKGROUND_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = resized.width;
    canvas.height = resized.height;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", BACKGROUND_EXPORT_QUALITY);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("背景画像をデコードできませんでした"));
      image.src = src;
    });
  }

  function resizeToMaxEdge(width, height, maxEdge) {
    const longestEdge = Math.max(width, height);
    if (longestEdge <= maxEdge) {
      return { width, height };
    }

    const ratio = maxEdge / longestEdge;
    return {
      width: Math.max(1, Math.round(width * ratio)),
      height: Math.max(1, Math.round(height * ratio))
    };
  }

  async function syncBackgroundControlsState() {
    const removeButton = document.getElementById(BACKGROUND_REMOVE_BUTTON_ID);
    const previewImage = document.getElementById(BACKGROUND_PREVIEW_IMAGE_ID);
    const previewStatus = document.getElementById(BACKGROUND_PREVIEW_STATUS_ID);
    const previewLabel = document.getElementById(BACKGROUND_PREVIEW_LABEL_ID);
    const previewBox = document.getElementById(BACKGROUND_PREVIEW_ID);
    if (!removeButton || !previewImage || !previewStatus || !previewLabel || !previewBox) {
      return;
    }

    const backgroundImage = await getStoredBackgroundImage();
    const hasCustomBackground = Boolean(backgroundImage);
    removeButton.disabled = !hasCustomBackground;
    removeButton.style.opacity = hasCustomBackground ? "1" : "0.45";
    removeButton.style.cursor = hasCustomBackground ? "pointer" : "default";
    previewImage.src = backgroundImage || getExtensionUrl(TEMPLATE_PATH);
    previewLabel.textContent = hasCustomBackground ? "カスタム背景" : "デフォルト背景";
    previewStatus.textContent = hasCustomBackground ? "使用中" : "既定";
    previewStatus.style.background = hasCustomBackground ? "#eef6ee" : "#f1f3f5";
    previewStatus.style.color = hasCustomBackground ? "#2f6f44" : "#5f6368";
    previewBox.style.borderColor = hasCustomBackground ? "rgba(47, 111, 68, 0.28)" : "rgba(0, 0, 0, 0.12)";
    previewBox.style.boxShadow = hasCustomBackground ? "0 0 0 1px rgba(47, 111, 68, 0.08)" : "none";
  }

  async function getStoredBackgroundImage() {
    const result = await getStorageValue(BACKGROUND_STORAGE_KEY);
    return typeof result === "string" && result.startsWith("data:image/")
      ? result
      : null;
  }

  function getStorageValue(key) {
    return new Promise((resolve, reject) => {
      if (!chrome?.storage?.local) {
        resolve(null);
        return;
      }

      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(result?.[key] ?? null);
      });
    });
  }

  function setStorageValue(key, value) {
    return new Promise((resolve, reject) => {
      if (!chrome?.storage?.local) {
        reject(new Error("chrome.storage.local が利用できません"));
        return;
      }

      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve();
      });
    });
  }

  function removeStorageValue(key) {
    return new Promise((resolve, reject) => {
      if (!chrome?.storage?.local) {
        reject(new Error("chrome.storage.local が利用できません"));
        return;
      }

      chrome.storage.local.remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve();
      });
    });
  }

  function getFontOption(fontKey) {
    return getAvailableFontOptions().find((option) => option.key === fontKey) || FONT_OPTIONS[0];
  }

  function applyControlFonts(controls) {
    const fontSelect = controls.querySelector(`#${FONT_SELECT_ID}`);
    if (!fontSelect) {
      return;
    }

    const selectedOption = getFontOption(fontSelect.value);
    fontSelect.style.fontFamily = selectedOption.family;
  }

  function getAvailableFontOptions() {
    return cachedFontOptions || FONT_OPTIONS;
  }

  function populateFontSelect(fontSelect, options, selectedKey) {
    fontSelect.textContent = "";

    options.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option.key;
      optionElement.textContent = option.label;
      optionElement.style.fontFamily = option.family;
      if (option.key === selectedKey) {
        optionElement.selected = true;
      }
      fontSelect.appendChild(optionElement);
    });
  }

  async function hydrateInstalledFonts(fontSelect) {
    try {
      const options = await fetchInstalledFontOptions();
      cachedFontOptions = options;

      if (!fontSelect.isConnected) {
        return;
      }

      const settings = readSettings();
      populateFontSelect(fontSelect, options, settings.fontKey);
      const controls = document.getElementById(CONTROLS_ID);
      if (controls) {
        applyControlFonts(controls);
      }
    } catch (error) {
      console.warn("[Note Thumbnail Maker] font list unavailable:", error);
    }
  }

  async function fetchInstalledFontOptions() {
    if (cachedFontOptions) {
      return cachedFontOptions;
    }

    if (!fontOptionsRequest) {
      fontOptionsRequest = requestInstalledFonts()
        .then((fonts) => mergeInstalledFontOptions(fonts))
        .catch((error) => {
          fontOptionsRequest = null;
          throw error;
        });
    }

    const options = await fontOptionsRequest;
    fontOptionsRequest = null;
    return options;
  }

  function requestInstalledFonts() {
    return new Promise((resolve, reject) => {
      if (!chrome?.runtime?.sendMessage) {
        resolve([]);
        return;
      }

      chrome.runtime.sendMessage({ type: FONT_LIST_MESSAGE }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response?.ok) {
          reject(new Error(response?.error || "フォント一覧を取得できません"));
          return;
        }

        resolve(Array.isArray(response.fonts) ? response.fonts : []);
      });
    });
  }

  function mergeInstalledFontOptions(fonts) {
    const seenKeys = new Set(FONT_OPTIONS.map((option) => option.key));
    const seenFamilies = new Set(FONT_OPTIONS.map((option) => normalizeText(option.label).toLowerCase()));
    const installedOptions = fonts
      .map((font) => normalizeInstalledFont(font))
      .filter((font) => {
        if (!font) {
          return false;
        }

        if (seenFamilies.has(font.family.toLowerCase())) {
          return false;
        }

        seenFamilies.add(font.family.toLowerCase());
        seenKeys.add(font.key);
        return true;
      })
      .sort((a, b) => a.label.localeCompare(b.label, "ja"));

    return [...FONT_OPTIONS, ...installedOptions];
  }

  function normalizeInstalledFont(font) {
    const fontId = normalizeText(font?.fontId || "");
    if (!fontId) {
      return null;
    }

    return {
      key: `local:${fontId}`,
      label: fontId,
      family: `"${fontId.replace(/"/g, '\\"')}"`
    };
  }

  function clampFontSize(value) {
    const numeric = Number.parseInt(String(value), 10);
    if (Number.isNaN(numeric)) {
      return DEFAULT_FONT_SIZE;
    }

    return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, numeric));
  }

  function normalizeColor(value) {
    const normalized = String(value || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      return normalized.toLowerCase();
    }

    return TEXT_COLOR;
  }

  function showErrorToast(message) {
    const existing = document.getElementById(TOAST_ID);
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.top = "24px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.padding = "12px 18px";
    toast.style.borderRadius = "8px";
    toast.style.background = "#d93025";
    toast.style.color = "#ffffff";
    toast.style.font = '600 14px/1.4 "Hiragino Sans", "Yu Gothic", sans-serif';
    toast.style.boxShadow = "0 12px 28px rgba(0, 0, 0, 0.2)";
    toast.style.zIndex = "2147483647";
    toast.style.pointerEvents = "none";
    document.body.appendChild(toast);

    window.setTimeout(() => {
      if (toast.isConnected) {
        toast.remove();
      }
    }, 3000);
  }

  function assignFileToInput(input, file) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function downloadFile(file, fileName) {
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 1000);
  }

  function buildDownloadFileName() {
    const title = getTitleText() || "thumbnail";
    const safeTitle = title
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    return `${safeTitle || "thumbnail"}.jpg`;
  }

  function buildLines(ctx, text, imageWidth, imageHeight) {
    const explicitLines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (explicitLines.length >= 2) {
      return explicitLines;
    }

    const singleLine = explicitLines[0] || text.trim();
    if (singleLine.includes(" ")) {
      return singleLine
        .split(" ")
        .map((part) => part.trim())
        .filter(Boolean);
    }

    return [singleLine];
  }

  function calcAutoFontSize(ctx, lines, imageWidth, imageHeight, maxSize, fontFamily) {
    let size = maxSize;
    while (size >= MIN_FONT_SIZE) {
      const metrics = measureLines(ctx, lines, size, fontFamily);
      const maxLineWidth = Math.max(...metrics.map((line) => line.width), 0);
      const totalHeight = metrics.reduce((sum, line) => sum + line.height, 0) + LINE_SPACING * (lines.length - 1);

      if (maxLineWidth <= imageWidth - TEXT_MARGIN * 2 && totalHeight <= imageHeight * 0.6) {
        return size;
      }
      size -= 4;
    }
    return MIN_FONT_SIZE;
  }

  function measureLines(ctx, lines, fontSize, fontFamily) {
    ctx.font = `400 ${fontSize}px ${fontFamily}`;
    return lines.map((line) => {
      const metrics = ctx.measureText(line);
      const width = metrics.width;
      const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
      const descent = metrics.actualBoundingBoxDescent || fontSize * 0.2;
      return {
        width,
        ascent,
        descent,
        height: ascent + descent
      };
    });
  }

  function drawLines(ctx, lines, metrics, imageWidth, imageHeight, fontSize, fontFamily, textColor) {
    ctx.font = `400 ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = normalizeColor(textColor);
    ctx.textBaseline = "alphabetic";

    const totalHeight = metrics.reduce((sum, line) => sum + line.height, 0) + LINE_SPACING * (lines.length - 1);
    let currentY = Math.floor((imageHeight - totalHeight) / 2);

    lines.forEach((line, index) => {
      const metric = metrics[index];
      const x = Math.floor((imageWidth - metric.width) / 2);
      const baselineY = currentY + metric.ascent;
      ctx.fillText(line, x, baselineY);
      currentY += metric.height + LINE_SPACING;
    });
  }

  function findButtonByText(label, options = {}) {
    const root = options.withinDialog ? document.querySelector('[role="dialog"]') || document : document;

    return Array.from(root.querySelectorAll("button")).find((button) => {
      if (button.id === BUTTON_ID) {
        return false;
      }

      const candidates = [
        button.textContent || "",
        button.getAttribute("aria-label") || "",
        button.title || ""
      ]
        .map(normalizeText)
        .filter(Boolean);

      return candidates.some((text) => (options.exact ? text === label : text.includes(label)));
    });
  }

  function normalizeText(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  function waitFor(factory, timeoutMs) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();

      const tick = () => {
        const result = factory();
        if (result) {
          resolve(result);
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error("timeout"));
          return;
        }

        window.setTimeout(tick, 100);
      };

      tick();
    });
  }

  function setButtonState(button, text, autoRestoreMs, restore) {
    const original = restore || {
      text: button.textContent,
      disabled: button.disabled,
      opacity: button.style.opacity
    };

    if (text) {
      button.textContent = text;
    }
    button.disabled = true;
    button.style.opacity = "0.7";

    if (autoRestoreMs) {
      window.setTimeout(() => {
        button.textContent = original.text;
        button.disabled = original.disabled;
        button.style.opacity = original.opacity;
      }, autoRestoreMs);
    }

    return original;
  }
})();
