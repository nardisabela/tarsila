// DOM Elements
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const canvasContainer = canvas.parentElement;
const toolSelect = document.getElementById("tool-select");
const colorPicker = document.getElementById("color");
const opacitySlider = document.getElementById("opacity");
const lineWidth = document.getElementById("line-width");
const rainbowBtn = document.getElementById("rainbow-btn");
const addLayerBtn = document.getElementById("add-layer");
const clearBtn = document.getElementById("clear-btn");
const downloadBtn = document.getElementById("download-btn");
const layersList = document.getElementById("layers-list");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");
const zoomResetBtn = document.getElementById("zoom-reset");
const zoomLevelDisplay = document.getElementById("zoom-level");

// Mobile buttons
const mobileColorBtn = document.getElementById("mobile-color");
const mobileBrushBtn = document.getElementById("mobile-brush");
const mobileEraserBtn = document.getElementById("mobile-eraser");
const mobileLayersBtn = document.getElementById("mobile-layers");
const mobileEyedropperBtn = document.getElementById("mobile-eyedropper");

// App State
const state = {
  isDrawing: false,
  lastX: 0,
  lastY: 0,
  isRainbow: false,
  currentTool: "pencil",
  layers: [],
  activeLayerIndex: 0,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  isPanning: false,
  lastPanX: 0,
  lastPanY: 0,
  pinchDistance: 0
};

// ========================
// UTILITY FUNCTIONS
// ========================

function debounce(func, timeout = 100) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

// ========================
// ZOOM/PAN FUNCTIONALITY
// ========================

function zoomCanvas(newZoom, centerX = canvas.width/2, centerY = canvas.height/2) {
  const oldZoom = state.zoom;
  state.zoom = Math.max(0.1, Math.min(5, newZoom)); // Limit zoom between 10% and 500%
  
  // Adjust offset to zoom toward the center point
  state.offsetX -= (centerX - state.offsetX) * (state.zoom/oldZoom - 1);
  state.offsetY -= (centerY - state.offsetY) * (state.zoom/oldZoom - 1);
  
  updateZoomDisplay();
  renderCanvas();
}

function zoomIn() {
  zoomCanvas(state.zoom * 1.2, canvas.width/2, canvas.height/2);
}

function zoomOut() {
  zoomCanvas(state.zoom / 1.2, canvas.width/2, canvas.height/2);
}

function resetZoom() {
  state.zoom = 1;
  state.offsetX = 0;
  state.offsetY = 0;
  updateZoomDisplay();
  renderCanvas();
}

function updateZoomDisplay() {
  if (zoomLevelDisplay) {
    zoomLevelDisplay.textContent = `${Math.round(state.zoom * 100)}%`;
  }
}

function getTransformedCoordinates(x, y) {
  return {
    x: (x - state.offsetX) / state.zoom,
    y: (y - state.offsetY) / state.zoom
  };
}

function handleWheel(e) {
  if (e.ctrlKey) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (e.deltaY < 0) {
      zoomCanvas(state.zoom * 1.1, mouseX, mouseY);
    } else {
      zoomCanvas(state.zoom / 1.1, mouseX, mouseY);
    }
  }
}

function startPan(e) {
  if (state.currentTool === "pan" || (e.ctrlKey && state.currentTool !== "eyedropper")) {
    state.isPanning = true;
    const coords = getEventCoordinates(e);
    state.lastPanX = coords.x;
    state.lastPanY = coords.y;
    canvas.style.cursor = "grabbing";
    e.preventDefault();
  }
}

function pan(e) {
  if (!state.isPanning) return;
  
  const coords = getEventCoordinates(e);
  state.offsetX += (coords.x - state.lastPanX) * state.zoom;
  state.offsetY += (coords.y - state.lastPanY) * state.zoom;
  
  state.lastPanX = coords.x;
  state.lastPanY = coords.y;
  
  renderCanvas();
  e.preventDefault();
}

function stopPan() {
  state.isPanning = false;
  updateCursor();
}

// ========================
// LAYER MANAGEMENT
// ========================

function createLayer(name) {
  const layerCanvas = document.createElement("canvas");
  layerCanvas.width = canvas.width;
  layerCanvas.height = canvas.height;
  const layerCtx = layerCanvas.getContext("2d");

  const layer = {
    name: name || `Layer ${state.layers.length + 1}`,
    canvas: layerCanvas,
    ctx: layerCtx,
    visible: true
  };

  state.layers.push(layer);
  state.activeLayerIndex = state.layers.length - 1;
  renderLayersList();
  renderCanvas();
}

function getActiveLayer() {
  return state.layers[state.activeLayerIndex];
}

function renderLayersList() {
  layersList.innerHTML = "";
  state.layers.forEach((layer, index) => {
    const layerItem = document.createElement("div");
    layerItem.className = `layer-item ${index === state.activeLayerIndex ? "active" : ""}`;
    
    const preview = document.createElement("div");
    preview.className = "layer-preview";
    preview.style.backgroundImage = `url(${layer.canvas.toDataURL()})`;
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "layer-name";
    nameSpan.textContent = layer.name;
    
    const actions = document.createElement("div");
    actions.className = "layer-actions";
    
    const visibilityBtn = document.createElement("button");
    visibilityBtn.innerHTML = `<i class="fas fa-eye${layer.visible ? "" : "-slash"}"></i>`;
    visibilityBtn.onclick = (e) => {
      e.stopPropagation();
      layer.visible = !layer.visible;
      renderLayersList();
      renderCanvas();
    };
    
    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = `<i class="fas fa-trash"></i>`;
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (state.layers.length > 1) {
        state.layers.splice(index, 1);
        if (state.activeLayerIndex >= index) state.activeLayerIndex--;
        renderLayersList();
        renderCanvas();
      }
    };
    
    actions.append(visibilityBtn, deleteBtn);
    layerItem.append(preview, nameSpan, actions);
    
    layerItem.onclick = () => {
      state.activeLayerIndex = index;
      renderLayersList();
    };
    
    layersList.appendChild(layerItem);
  });
}

// ========================
// DRAWING TOOLS
// ========================

function useEyedropper(e) {
  const { x, y } = getEventCoordinates(e);
  
  // Create temporary canvas to sample color
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCanvas.width = 1;
  tempCanvas.height = 1;
  
  // Draw the visible content at the sampled position
  tempCtx.drawImage(canvas, x, y, 1, 1, 0, 0, 1, 1);
  
  const pixelData = tempCtx.getImageData(0, 0, 1, 1).data;
  const hexColor = rgbToHex(pixelData[0], pixelData[1], pixelData[2]);
  
  colorPicker.value = hexColor;
  
  if (mobileColorBtn) {
    mobileColorBtn.style.backgroundColor = hexColor;
  }

  // Switch back to pencil after picking color
  state.currentTool = "pencil";
  toolSelect.value = "pencil";
  updateCursor();
}

function startDrawing(e) {
  if (state.currentTool === "eyedropper") {
    useEyedropper(e);
    return;
  }
  
  state.isDrawing = true;
  const { x, y } = getEventCoordinates(e);
  [state.lastX, state.lastY] = [x, y];
  
  const layer = getActiveLayer();
  layer.ctx.beginPath();
  layer.ctx.moveTo(state.lastX, state.lastY);
}

function draw(e) {
  if (!state.isDrawing) return;
  
  const layer = getActiveLayer();
  const { x, y } = getEventCoordinates(e);
  
  // Set tool properties
  layer.ctx.globalAlpha = opacitySlider.value / 100;
  layer.ctx.lineWidth = lineWidth.value;
  layer.ctx.lineCap = "round";
  layer.ctx.lineJoin = "round";
  
  if (state.currentTool === "eraser") {
    layer.ctx.globalCompositeOperation = "destination-out";
    layer.ctx.strokeStyle = "rgba(0,0,0,1)";
  } else if (state.currentTool === "blur") {
    layer.ctx.filter = `blur(${lineWidth.value / 4}px)`;
    layer.ctx.globalCompositeOperation = "source-over";
    layer.ctx.strokeStyle = colorPicker.value;
  } else {
    layer.ctx.filter = "none";
    layer.ctx.globalCompositeOperation = "source-over";
    layer.ctx.strokeStyle = state.isRainbow 
      ? `hsl(${(Date.now() / 50) % 360}, 100%, 50%)` 
      : colorPicker.value;
  }
  
  layer.ctx.lineTo(x, y);
  layer.ctx.stroke();
  
  [state.lastX, state.lastY] = [x, y];
  renderCanvas();
}

function stopDrawing() {
  state.isDrawing = false;
}

// ========================
// CANVAS RENDERING
// ========================

function renderCanvas() {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Apply zoom and pan transformations
  ctx.translate(state.offsetX, state.offsetY);
  ctx.scale(state.zoom, state.zoom);
  
  // Draw all visible layers
  state.layers.forEach(layer => {
    if (layer.visible) {
      ctx.drawImage(layer.canvas, 0, 0);
    }
  });
  
  ctx.restore();
}

function resizeCanvas() {
  const container = canvas.parentElement;
  const oldWidth = canvas.width;
  const oldHeight = canvas.height;
  const newWidth = container.clientWidth;
  const newHeight = container.clientHeight;
  
  if (oldWidth === newWidth && oldHeight === newHeight) return;
  
  canvas.width = newWidth;
  canvas.height = newHeight;
  
  if (state.layers.length > 0) {
    state.layers.forEach(layer => {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = oldWidth;
      tempCanvas.height = oldHeight;
      tempCtx.drawImage(layer.canvas, 0, 0);
      
      layer.canvas.width = newWidth;
      layer.canvas.height = newHeight;
      layer.ctx.drawImage(tempCanvas, 0, 0, oldWidth, oldHeight, 0, 0, newWidth, newHeight);
    });
    renderCanvas();
  }
}

// ========================
// EVENT HANDLING
// ========================

function getEventCoordinates(e) {
  let clientX, clientY;
  
  if (e.type.includes("touch")) {
    const rect = canvas.getBoundingClientRect();
    clientX = e.touches[0].clientX - rect.left;
    clientY = e.touches[0].clientY - rect.top;
  } else {
    clientX = e.offsetX;
    clientY = e.offsetY;
  }
  
  return getTransformedCoordinates(clientX, clientY);
}

function handleOrientationChange() {
  setTimeout(() => {
    resizeCanvas();
    renderCanvas();
  }, 100);
}

function updateCursor() {
  if (state.currentTool === "pencil") {
    canvas.className = "pencil-cursor";
  } else if (state.currentTool === "eraser") {
    canvas.className = "eraser-cursor";
  } else if (state.currentTool === "eyedropper") {
    canvas.className = "eyedropper-cursor";
  } else if (state.isPanning) {
    canvas.style.cursor = "grabbing";
  } else {
    canvas.className = "";
  }
}

function setupEventListeners() {
  // Window events
  window.addEventListener("resize", debounce(resizeCanvas));
  window.addEventListener("orientationchange", handleOrientationChange);
  
  // Canvas events
  canvas.addEventListener("mousedown", (e) => {
    if (state.currentTool === "eyedropper") {
      useEyedropper(e);
    } else if (e.button === 1 || (e.ctrlKey && e.button === 0)) {
      startPan(e);
    } else {
      startDrawing(e);
    }
  });
  
  canvas.addEventListener("mousemove", (e) => {
    if (state.isPanning) {
      pan(e);
    } else {
      draw(e);
    }
  });
  
  canvas.addEventListener("mouseup", stopPan);
  canvas.addEventListener("mouseout", stopPan);
  canvas.addEventListener("wheel", handleWheel, { passive: false });
  
  // Touch events
  canvas.addEventListener("touchstart", (e) => {
    if (state.currentTool === "eyedropper") {
      useEyedropper(e);
      e.preventDefault();
    } else if (e.touches.length === 2) {
      // Handle pinch zoom
      state.pinchDistance = getPinchDistance(e);
      e.preventDefault();
    } else {
      startDrawing(e);
    }
  }, { passive: false });
  
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2) {
      // Handle pinch zoom
      const newDistance = getPinchDistance(e);
      const center = getPinchCenter(e);
      
      if (state.pinchDistance > 0) {
        const scale = newDistance / state.pinchDistance;
        zoomCanvas(state.zoom * scale, center.x, center.y);
      }
      
      state.pinchDistance = newDistance;
      e.preventDefault();
    } else if (state.isDrawing) {
      draw(e);
      e.preventDefault();
    }
  }, { passive: false });
  
  canvas.addEventListener("touchend", stopPan);
  
  // Tool events
  toolSelect.addEventListener("change", (e) => {
    state.currentTool = e.target.value;
    updateCursor();
  });
  
  colorPicker.addEventListener("input", () => {
    if (mobileColorBtn) {
      mobileColorBtn.style.backgroundColor = colorPicker.value;
    }
    if (state.currentTool === "pencil") updateCursor();
  });
  
  lineWidth.addEventListener("input", updateCursor);
  
  rainbowBtn.addEventListener("click", () => {
    state.isRainbow = !state.isRainbow;
    rainbowBtn.style.background = state.isRainbow 
      ? "linear-gradient(45deg, #FF6B6B, #FFD166, #06D6A0, #118AB2, #9B59B6)" 
      : "var(--primary)";
    updateCursor();
  });
  
  // Button events
  if (zoomInBtn) zoomInBtn.addEventListener("click", zoomIn);
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", zoomOut);
  if (zoomResetBtn) zoomResetBtn.addEventListener("click", resetZoom);
  
  addLayerBtn.addEventListener("click", () => createLayer());
  
  clearBtn.addEventListener("click", () => {
    if (confirm("Clear current layer?")) {
      getActiveLayer().ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderCanvas();
    }
  });
  
  downloadBtn.addEventListener("click", downloadCanvas);
  
  // Mobile tool buttons
  if (mobileBrushBtn) {
    mobileBrushBtn.addEventListener("click", () => {
      state.currentTool = "pencil";
      toolSelect.value = "pencil";
      updateCursor();
    });
  }
  
  if (mobileEraserBtn) {
    mobileEraserBtn.addEventListener("click", () => {
      state.currentTool = "eraser";
      toolSelect.value = "eraser";
      updateCursor();
    });
  }
  
  if (mobileColorBtn) {
    mobileColorBtn.addEventListener("click", () => {
      colorPicker.click();
    });
  }
  
  if (mobileLayersBtn) {
    mobileLayersBtn.addEventListener("click", () => {
      document.querySelector(".layers-panel").classList.toggle("mobile-visible");
    });
  }
  
  if (mobileEyedropperBtn) {
    mobileEyedropperBtn.addEventListener("click", () => {
      state.currentTool = "eyedropper";
      toolSelect.value = "eyedropper";
      updateCursor();
    });
  }
}

// ========================
// TOUCH GESTURE HELPERS
// ========================

function getPinchDistance(e) {
  const touch1 = e.touches[0];
  const touch2 = e.touches[1];
  return Math.hypot(
    touch2.clientX - touch1.clientX,
    touch2.clientY - touch1.clientY
  );
}

function getPinchCenter(e) {
  const touch1 = e.touches[0];
  const touch2 = e.touches[1];
  const rect = canvas.getBoundingClientRect();
  
  return {
    x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
    y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
  };
}

// ========================
// INITIALIZATION
// ========================

function init() {
  resizeCanvas();
  createLayer("Background");
  setupEventListeners();
  updateCursor();
  updateZoomDisplay();
  
  // Add resize observer with debouncing
  const resizeObserver = new ResizeObserver(debounce(() => {
    resizeCanvas();
    renderCanvas();
  }));
  resizeObserver.observe(canvasContainer);
}

// Start the app when DOM is loaded
document.addEventListener("DOMContentLoaded", init);
