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

// Mobile buttons
const mobileColorBtn = document.getElementById("mobile-color");
const mobileBrushBtn = document.getElementById("mobile-brush");
const mobileEraserBtn = document.getElementById("mobile-eraser");
const mobileLayersBtn = document.getElementById("mobile-layers");

// App State
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let isRainbow = false;
let currentTool = "pencil";
let layers = [];
let activeLayerIndex = 0;

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
