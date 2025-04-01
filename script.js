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
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let isRainbow = false;
let currentTool = "pencil";
let layers = [];
let activeLayerIndex = 0;
let zoom = 1;
let offsetX = 0;
let offsetY = 0;
let isPanning = false;
let lastPanX = 0;
let lastPanY = 0;

// Debounce function for resize events
function debounce(func, timeout = 100) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

// Initialize the app
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

// Zoom functions
function zoomCanvas(newZoom, centerX = canvas.width/2, centerY = canvas.height/2) {
  const oldZoom = zoom;
  zoom = Math.max(0.1, Math.min(5, newZoom)); // Limit zoom between 10% and 500%
  
  // Adjust offset to zoom toward the center point
  offsetX -= (centerX - offsetX) * (zoom/oldZoom - 1);
  offsetY -= (centerY - offsetY) * (zoom/oldZoom - 1);
  
  updateZoomDisplay();
  renderCanvas();
}

function zoomIn() {
  zoomCanvas(zoom * 1.2, canvas.width/2, canvas.height/2);
}

function zoomOut() {
  zoomCanvas(zoom / 1.2, canvas.width/2, canvas.height/2);
}

function resetZoom() {
  zoom = 1;
  offsetX = 0;
  offsetY = 0;
  updateZoomDisplay();
  renderCanvas();
}

function updateZoomDisplay() {
  if (zoomLevelDisplay) {
    zoomLevelDisplay.textContent = `${Math.round(zoom * 100)}%`;
  }
}

// Modified renderCanvas to handle zoom
function renderCanvas() {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Apply zoom and pan transformations
  ctx.translate(offsetX, offsetY);
  ctx.scale(zoom, zoom);
  
  // Draw all visible layers
  layers.forEach(layer => {
    if (layer.visible) {
      ctx.drawImage(layer.canvas, 0, 0);
    }
  });
  
  ctx.restore();
}

// Modified getCoordinates to account for zoom and pan
function getCoordinates(e) {
  let x, y;
  
  if (e.type.includes("touch")) {
    const rect = canvas.getBoundingClientRect();
    x = e.touches[0].clientX - rect.left;
    y = e.touches[0].clientY - rect.top;
  } else {
    x = e.offsetX;
    y = e.offsetY;
  }
  
  // Convert screen coordinates to canvas coordinates with zoom and pan
  return {
    offsetX: (x - offsetX) / zoom,
    offsetY: (y - offsetY) / zoom
  };
}

// Panning functionality
function startPan(e) {
  if (currentTool === "pan" || (e.ctrlKey && currentTool !== "eyedropper")) {
    isPanning = true;
    const coords = getCoordinates(e);
    lastPanX = coords.offsetX;
    lastPanY = coords.offsetY;
    canvas.style.cursor = "grabbing";
    e.preventDefault();
  }
}

function pan(e) {
  if (!isPanning) return;
  
  const coords = getCoordinates(e);
  offsetX += (coords.offsetX - lastPanX) * zoom;
  offsetY += (coords.offsetY - lastPanY) * zoom;
  
  lastPanX = coords.offsetX;
  lastPanY = coords.offsetY;
  
  renderCanvas();
  e.preventDefault();
}

function stopPan() {
  isPanning = false;
  canvas.style.cursor = "";
}

// Eyedropper tool (previous implementation remains the same)
function useEyedropper(e) {
  const { offsetX, offsetY } = getCoordinates(e);
  
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCanvas.width = 1;
  tempCanvas.height = 1;
  
  // Draw the visible content at the sampled position
  tempCtx.drawImage(canvas, 
    offsetX * zoom + offsetX, offsetY * zoom + offsetY, 1, 1, 
    0, 0, 1, 1);
  
  const pixelData = tempCtx.getImageData(0, 0, 1, 1).data;
  
  const rgbToHex = (r, g, b) => {
    return "#" + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("");
  };
  
  const hexColor = rgbToHex(pixelData[0], pixelData[1], pixelData[2]);
  colorPicker.value = hexColor;
  
  if (mobileColorBtn) {
    mobileColorBtn.style.backgroundColor = hexColor;
  }
}

// Update setupEventListeners for zoom and pan
function setupEventListeners() {
  // Window events
  window.addEventListener("resize", debounce(resizeCanvas));
  window.addEventListener("orientationchange", handleOrientationChange);
  
  // Canvas events
  canvas.addEventListener("mousedown", (e) => {
    if (currentTool === "eyedropper") {
      useEyedropper(e);
    } else if (e.button === 1 || (e.ctrlKey && e.button === 0)) { // Middle mouse or Ctrl+Left for pan
      startPan(e);
    } else {
      startDrawing(e);
    }
  });
  
  canvas.addEventListener("mousemove", (e) => {
    if (isPanning) {
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
    if (currentTool === "eyedropper") {
      useEyedropper(e);
      e.preventDefault();
    } else if (e.touches.length === 2) {
      // Handle pinch zoom
      e.preventDefault();
    } else {
      startDrawing(e);
    }
  }, { passive: false });
  
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2) {
      // Handle pinch zoom
      e.preventDefault();
    } else if (isDrawing) {
      draw(e);
      e.preventDefault();
    }
  }, { passive: false });
  
  canvas.addEventListener("touchend", stopPan);
  
  // Zoom buttons
  if (zoomInBtn) zoomInBtn.addEventListener("click", zoomIn);
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", zoomOut);
  if (zoomResetBtn) zoomResetBtn.addEventListener("click", resetZoom);
  
  // Handle mouse wheel for zoom
  function handleWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      if (e.deltaY < 0) {
        zoomCanvas(zoom * 1.1, mouseX, mouseY);
      } else {
        zoomCanvas(zoom / 1.1, mouseX, mouseY);
      }
    }
  }

// Eyedropper tool functionality
function useEyedropper(e) {
  const { offsetX, offsetY } = getCoordinates(e);
  
  // Create a temporary canvas to get the pixel data
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCanvas.width = 1;
  tempCanvas.height = 1;
  
  // Draw the visible layers to get the composite color
  renderCanvas(); // Ensure main canvas is up to date
  tempCtx.drawImage(canvas, offsetX, offsetY, 1, 1, 0, 0, 1, 1);
  
  // Get the pixel data
  const pixelData = tempCtx.getImageData(0, 0, 1, 1).data;
  
  // Convert to hex
  const rgbToHex = (r, g, b) => {
    return "#" + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("");
  };
  
  const hexColor = rgbToHex(pixelData[0], pixelData[1], pixelData[2]);
  
  // Update the color picker
  colorPicker.value = hexColor;
  
  // If using mobile, update the color display
  if (mobileColorBtn) {
    mobileColorBtn.style.backgroundColor = hexColor;
  }

  currentTool = "pencil";
  toolSelect.value = "pencil";
  updateCursor();
}

// Modify the startDrawing function to include eyedropper
function startDrawing(e) {
  if (currentTool === "eyedropper") {
    useEyedropper(e);
    return;
  }
  
  isDrawing = true;
  const { offsetX, offsetY } = getCoordinates(e);
  [lastX, lastY] = [offsetX, offsetY];
  getActiveLayer().ctx.beginPath();
  getActiveLayer().ctx.moveTo(lastX, lastY);
}

// Update cursor for eyedropper
function updateCursor() {
  if (currentTool === "pencil") {
    canvas.className = "pencil-cursor";
  } else if (currentTool === "eraser") {
    canvas.className = "eraser-cursor";
  } else if (currentTool === "eyedropper") {
    canvas.className = "eyedropper-cursor";
  } else {
    canvas.className = "";
  }
}
  
  // Add resize observer with debouncing
  const resizeObserver = new ResizeObserver(debounce(() => {
    resizeCanvas();
    renderCanvas();
  }));
  resizeObserver.observe(canvasContainer);
}

// Create a new layer
function createLayer(name) {
  const layerCanvas = document.createElement("canvas");
  layerCanvas.width = canvas.width;
  layerCanvas.height = canvas.height;
  const layerCtx = layerCanvas.getContext("2d");

  const layer = {
    name: name || `Layer ${layers.length + 1}`,
    canvas: layerCanvas,
    ctx: layerCtx,
    visible: true
  };

  layers.push(layer);
  activeLayerIndex = layers.length - 1;
  renderLayersList();
  renderCanvas();
}

// Render layers list
function renderLayersList() {
  layersList.innerHTML = "";
  layers.forEach((layer, index) => {
    const layerItem = document.createElement("div");
    layerItem.className = `layer-item ${index === activeLayerIndex ? "active" : ""}`;
    
    // Preview thumbnail
    const preview = document.createElement("div");
    preview.className = "layer-preview";
    preview.style.backgroundImage = `url(${layer.canvas.toDataURL()})`;
    
    // Layer name
    const nameSpan = document.createElement("span");
    nameSpan.className = "layer-name";
    nameSpan.textContent = layer.name;
    
    // Actions
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
      if (layers.length > 1) {
        layers.splice(index, 1);
        if (activeLayerIndex >= index) activeLayerIndex--;
        renderLayersList();
        renderCanvas();
      }
    };
    
    actions.append(visibilityBtn, deleteBtn);
    layerItem.append(preview, nameSpan, actions);
    
    layerItem.onclick = () => {
      activeLayerIndex = index;
      renderLayersList();
    };
    
    layersList.appendChild(layerItem);
  });
}

// Render all visible layers to main canvas
function renderCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  layers.forEach(layer => {
    if (layer.visible) {
      ctx.drawImage(layer.canvas, 0, 0);
    }
  });
}

// Get currently active layer
function getActiveLayer() {
  return layers[activeLayerIndex];
}

// Drawing functions
function startDrawing(e) {
  isDrawing = true;
  const { offsetX, offsetY } = getCoordinates(e);
  [lastX, lastY] = [offsetX, offsetY];
  getActiveLayer().ctx.beginPath();
  getActiveLayer().ctx.moveTo(lastX, lastY);
}

function draw(e) {
  if (!isDrawing) return;
  
  const layer = getActiveLayer();
  const { offsetX, offsetY } = getCoordinates(e);
  
  // Set tool properties
  if (currentTool === "eraser") {
    layer.ctx.globalCompositeOperation = "destination-out";
    layer.ctx.strokeStyle = "rgba(0,0,0,1)";
  } else if (currentTool === "blur") {
    layer.ctx.filter = `blur(${lineWidth.value / 4}px)`;
    layer.ctx.globalCompositeOperation = "source-over";
    layer.ctx.strokeStyle = colorPicker.value;
  } else {
    layer.ctx.filter = "none";
    layer.ctx.globalCompositeOperation = "source-over";
    layer.ctx.strokeStyle = isRainbow 
      ? `hsl(${(Date.now() / 50) % 360}, 100%, 50%)` 
      : colorPicker.value;
  }
  
  layer.ctx.globalAlpha = opacitySlider.value / 100;
  layer.ctx.lineWidth = lineWidth.value;
  layer.ctx.lineCap = "round";
  layer.ctx.lineJoin = "round";
  
  layer.ctx.lineTo(offsetX, offsetY);
  layer.ctx.stroke();
  
  [lastX, lastY] = [offsetX, offsetY];
  renderCanvas();
}

function stopDrawing() {
  isDrawing = false;
}

// Helper to get coordinates for both mouse and touch events
function getCoordinates(e) {
  if (e.type.includes("touch")) {
    const rect = canvas.getBoundingClientRect();
    return {
      offsetX: e.touches[0].clientX - rect.left,
      offsetY: e.touches[0].clientY - rect.top
    };
  }
  return {
    offsetX: e.offsetX,
    offsetY: e.offsetY
  };
}

// Update cursor based on current tool
function updateCursor() {
  if (currentTool === "pencil") {
    canvas.className = "pencil-cursor";
  } else if (currentTool === "eraser") {
    canvas.className = "eraser-cursor";
  } else {
    canvas.className = "";
  }
}

// Resize canvas to fit container
function resizeCanvas() {
  const container = canvas.parentElement;
  const oldWidth = canvas.width;
  const oldHeight = canvas.height;
  const newWidth = container.clientWidth;
  const newHeight = container.clientHeight;
  
  if (oldWidth === newWidth && oldHeight === newHeight) return;
  
  canvas.width = newWidth;
  canvas.height = newHeight;
  
  if (layers.length > 0) {
    layers.forEach(layer => {
      // Create a temporary canvas to preserve content
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = oldWidth;
      tempCanvas.height = oldHeight;
      tempCtx.drawImage(layer.canvas, 0, 0);
      
      // Resize the layer canvas
      layer.canvas.width = newWidth;
      layer.canvas.height = newHeight;
      
      // Redraw the content scaled to new size
      layer.ctx.drawImage(tempCanvas, 0, 0, oldWidth, oldHeight, 0, 0, newWidth, newHeight);
    });
    renderCanvas();
  }
}

// Handle device orientation changes
function handleOrientationChange() {
  setTimeout(() => {
    resizeCanvas();
    renderCanvas();
  }, 100);
}

// Setup event listeners
function setupEventListeners() {
  // Window events
  window.addEventListener("resize", debounce(resizeCanvas));
  window.addEventListener("orientationchange", handleOrientationChange);
  
  // Canvas events
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseout", stopDrawing);
  
  // Touch events
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    startDrawing(e);
  }, { passive: false });
  
  canvas.addEventListener("touchmove", (e) => {
    if (isDrawing) {
      e.preventDefault();
      draw(e);
    }
  }, { passive: false });
  
  canvas.addEventListener("touchend", stopDrawing);
  
  // Tool events
  toolSelect.addEventListener("change", (e) => {
    currentTool = e.target.value;
    updateCursor();
  });
  
  colorPicker.addEventListener("input", () => {
    if (currentTool === "pencil") updateCursor();
  });
  
  lineWidth.addEventListener("input", updateCursor);
  
  rainbowBtn.addEventListener("click", () => {
    isRainbow = !isRainbow;
    rainbowBtn.style.background = isRainbow 
      ? "linear-gradient(45deg, #FF6B6B, #FFD166, #06D6A0, #118AB2, #9B59B6)" 
      : "var(--primary)";
    updateCursor();
  });

    // Add eyedropper to tool selection
  toolSelect.addEventListener("change", (e) => {
    currentTool = e.target.value;
    updateCursor();
  });

  // Mobile eyedropper button
  if (mobileEyedropperBtn) {
    mobileEyedropperBtn.addEventListener("click", () => {
      currentTool = "eyedropper";
      toolSelect.value = "eyedropper";
      updateCursor();
    });
  }
  
  addLayerBtn.addEventListener("click", () => createLayer());
  
  clearBtn.addEventListener("click", () => {
    if (confirm("Clear current layer?")) {
      getActiveLayer().ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderCanvas();
    }
  });
  
  downloadBtn.addEventListener("click", downloadCanvas);
  
  // Mobile tool buttons
  mobileBrushBtn.addEventListener("click", () => {
    currentTool = "pencil";
    toolSelect.value = "pencil";
    updateCursor();
  });
  
  mobileEraserBtn.addEventListener("click", () => {
    currentTool = "eraser";
    toolSelect.value = "eraser";
    updateCursor();
  });
  
  mobileColorBtn.addEventListener("click", () => {
    colorPicker.click();
  });
  
  mobileLayersBtn.addEventListener("click", () => {
    document.querySelector(".layers-panel").classList.toggle("mobile-visible");
  });
}

// Download canvas as PNG
function downloadCanvas() {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const exportCtx = exportCanvas.getContext("2d");
  
  // Draw all visible layers
  layers.forEach(layer => {
    if (layer.visible) {
      exportCtx.drawImage(layer.canvas, 0, 0);
    }
  });
  
  const link = document.createElement("a");
  link.download = `tarsila-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", init);
