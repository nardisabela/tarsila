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
const uploadBtn = document.getElementById("upload-btn");

// Mobile buttons
const mobileColorBtn = document.getElementById("mobile-color");
const mobileBrushBtn = document.getElementById("mobile-brush");
const mobileEraserBtn = document.getElementById("mobile-eraser");
const mobileLayersBtn = document.getElementById("mobile-layers");
const mobileEyedropperBtn = document.getElementById("mobile-eyedropper");
const mobileMoveBtn = document.getElementById("mobile-move");

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
    pinchDistance: 0,
    isMovingLayer: false,
    dragStartY: 0,
    draggedLayerIndex: -1,
    isDraggingLayerContent: false,
    dragLayerStartX: 0,
    dragLayerStartY: 0
};

// Utility Functions
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

// Image Upload Functionality
function setupImageUpload() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                createLayerFromImage(img, file.name.replace(/\.[^/.]+$/, ""));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function createLayer(name) {
    const layerCanvas = document.createElement("canvas");
    layerCanvas.width = canvas.width;
    layerCanvas.height = canvas.height;
    const layerCtx = layerCanvas.getContext("2d");

    const layer = {
        name: name || `Layer ${state.layers.length + 1}`,
        canvas: layerCanvas,
        ctx: layerCtx,
        visible: true,
        opacity: 100, // Default to fully opaque
        x: 0,
        y: 0,
        isDraggable: true
    };

    state.layers.push(layer);
    state.activeLayerIndex = state.layers.length - 1;
    renderLayersList();
    renderCanvas();
    return layer;
}

// Layer Dragging Functionality
function startLayerDrag(e) {
    if (state.currentTool !== "move") return;
    
    const { x, y } = getEventCoordinates(e);
    const layer = getActiveLayer();
    
    // Only start dragging if not clicking on the opacity slider
    const target = e.target;
    if (target && target.classList.contains("layer-opacity")) return;
    
    state.isDraggingLayerContent = true;
    state.dragLayerStartX = x - layer.x;
    state.dragLayerStartY = y - layer.y;
    canvas.style.cursor = "grabbing";
}

function dragLayerContent(e) {
    if (!state.isDraggingLayerContent) return;
    
    const { x, y } = getEventCoordinates(e);
    const layer = getActiveLayer();
    
    layer.x = x - state.dragLayerStartX;
    layer.y = y - state.dragLayerStartY;
    
    renderCanvas();
}

function stopLayerDrag() {
    state.isDraggingLayerContent = false;
    updateCursor();
}

// Layer Management
function createLayer(name) {
    const layerCanvas = document.createElement("canvas");
    layerCanvas.width = canvas.width;
    layerCanvas.height = canvas.height;
    const layerCtx = layerCanvas.getContext("2d");

    const layer = {
        name: name || `Layer ${state.layers.length + 1}`,
        canvas: layerCanvas,
        ctx: layerCtx,
        visible: true,
        opacity: 100, // Initialize with 100% opacity
        x: 0,
        y: 0,
        isDraggable: true
    };

    state.layers.push(layer);
    state.activeLayerIndex = state.layers.length - 1;
    renderLayersList();
    renderCanvas();
    return layer; // Return the created layer
}


function getActiveLayer() {
    return state.layers[state.activeLayerIndex];
}

function setupLayerDragAndDrop() {
    layersList.addEventListener('mousedown', (e) => {
        const layerItem = e.target.closest('.layer-item');
        if (!layerItem) return;

        const index = Array.from(layersList.children).indexOf(layerItem);
        if (index === -1) return;

        state.isMovingLayer = true;
        state.draggedLayerIndex = index;
        state.dragStartY = e.clientY;
        layerItem.classList.add('dragging');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!state.isMovingLayer) return;

        const layerItems = Array.from(layersList.children);
        const draggedItem = layerItems[state.draggedLayerIndex];
        if (!draggedItem) return;

        const deltaY = e.clientY - state.dragStartY;
        draggedItem.style.transform = `translateY(${deltaY}px)`;

        const hoveredItem = document.elementFromPoint(e.clientX, e.clientY)?.closest('.layer-item');
        if (!hoveredItem || hoveredItem === draggedItem) return;

        const hoverIndex = layerItems.indexOf(hoveredItem);
        if (hoverIndex === -1) return;

        if (hoverIndex !== state.draggedLayerIndex) {
            const [movedLayer] = state.layers.splice(state.draggedLayerIndex, 1);
            state.layers.splice(hoverIndex, 0, movedLayer);
            
            if (state.activeLayerIndex === state.draggedLayerIndex) {
                state.activeLayerIndex = hoverIndex;
            } else if (state.draggedLayerIndex < hoverIndex && state.activeLayerIndex > state.draggedLayerIndex && state.activeLayerIndex <= hoverIndex) {
                state.activeLayerIndex--;
            } else if (state.draggedLayerIndex > hoverIndex && state.activeLayerIndex < state.draggedLayerIndex && state.activeLayerIndex >= hoverIndex) {
                state.activeLayerIndex++;
            }

            state.draggedLayerIndex = hoverIndex;
            renderLayersList();
        }
    });

    document.addEventListener('mouseup', () => {
        if (state.isMovingLayer) {
            state.isMovingLayer = false;
            const layerItems = Array.from(layersList.children);
            if (state.draggedLayerIndex >= 0 && state.draggedLayerIndex < layerItems.length) {
                layerItems[state.draggedLayerIndex].classList.remove('dragging');
                layerItems[state.draggedLayerIndex].style.transform = '';
            }
            state.draggedLayerIndex = -1;
        }
    });
}

function renderLayersList() {
    layersList.innerHTML = "";
    state.layers.forEach((layer, index) => {
        const layerItem = document.createElement("div");
        layerItem.className = `layer-item ${index === state.activeLayerIndex ? "active" : ""}`;
        
        // Preview thumbnail
        const preview = document.createElement("div");
        preview.className = "layer-preview";
        preview.style.backgroundImage = `url(${layer.canvas.toDataURL()})`;
        
        // Layer name
        const nameSpan = document.createElement("span");
        nameSpan.className = "layer-name";
        nameSpan.textContent = layer.name;
        
        // Opacity control
        const opacityControl = document.createElement("input");
        opacityControl.type = "range";
        opacityControl.min = "0";
        opacityControl.max = "100";
        opacityControl.value = layer.opacity;
        opacityControl.className = "layer-opacity";
        opacityControl.addEventListener("input", (e) => {
            layer.opacity = parseInt(e.target.value);
            renderCanvas();
        });
        
        // Prevent opacity slider from triggering layer drag
        opacityControl.addEventListener("mousedown", (e) => {
            e.stopPropagation();
        });
        
        // Actions
        const actions = document.createElement("div");
        actions.className = "layer-actions";
        
        const visibilityBtn = document.createElement("button");
        visibilityBtn.innerHTML = `<i class="fas fa-eye${layer.visible ? "" : "-slash"}"></i>`;
        visibilityBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            layer.visible = !layer.visible;
            renderLayersList();
            renderCanvas();
        });
        
        const deleteBtn = document.createElement("button");
        deleteBtn.innerHTML = `<i class="fas fa-trash"></i>`;
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (state.layers.length > 1) {
                state.layers.splice(index, 1);
                if (state.activeLayerIndex >= index) state.activeLayerIndex--;
                renderLayersList();
                renderCanvas();
            }
        });
        
        actions.append(visibilityBtn, deleteBtn);
        layerItem.append(preview, nameSpan, opacityControl, actions);
        
        layerItem.addEventListener("click", (e) => {
            // Don't change active layer if clicking on controls
            if (e.target.classList.contains("layer-actions") || 
                e.target.classList.contains("layer-opacity")) {
                return;
            }
            state.activeLayerIndex = index;
            renderLayersList();
        });
        
        layersList.appendChild(layerItem);
    });
}

// Drawing Tools
function applySmoothBrush(layer, x, y, radius, pressure = 1) {
    const ctx = layer.ctx;
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = radius * 2;
    tempCanvas.height = radius * 2;

    tempCtx.drawImage(
        layer.canvas, 
        x - radius, y - radius, 
        radius * 2, radius * 2, 
        0, 0, 
        radius * 2, radius * 2
    );

    const imageData = tempCtx.getImageData(0, 0, radius * 2, radius * 2);
    const data = imageData.data;
    
    const blurRadius = Math.max(1, Math.floor(radius * 0.3 * pressure));
    for (let i = 0; i < blurRadius; i++) {
        boxBlur(imageData.data, radius * 2, radius * 2, 1);
    }

    tempCtx.putImageData(imageData, 0, 0);

    ctx.save();
    ctx.globalAlpha = opacitySlider.value / 100 * pressure;
    ctx.drawImage(
        tempCanvas, 
        0, 0, 
        radius * 2, radius * 2, 
        x - radius, y - radius, 
        radius * 2, radius * 2
    );
    ctx.restore();
}

function boxBlur(data, width, height, radius) {
    const temp = new Uint8ClampedArray(data.length);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, a = 0, count = 0;
            
            for (let kx = -radius; kx <= radius; kx++) {
                const px = Math.min(width - 1, Math.max(0, x + kx));
                const i = (y * width + px) * 4;
                
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                a += data[i + 3];
                count++;
            }
            
            const i = (y * width + x) * 4;
            temp[i] = r / count;
            temp[i + 1] = g / count;
            temp[i + 2] = b / count;
            temp[i + 3] = a / count;
        }
    }
    
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            let r = 0, g = 0, b = 0, a = 0, count = 0;
            
            for (let ky = -radius; ky <= radius; ky++) {
                const py = Math.min(height - 1, Math.max(0, y + ky));
                const i = (py * width + x) * 4;
                
                r += temp[i];
                g += temp[i + 1];
                b += temp[i + 2];
                a += temp[i + 3];
                count++;
            }
            
            const i = (y * width + x) * 4;
            data[i] = r / count;
            data[i + 1] = g / count;
            data[i + 2] = b / count;
            data[i + 3] = a / count;
        }
    }
}

function useEyedropper(e) {
    const { x, y } = getEventCoordinates(e);
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = 1;
    tempCanvas.height = 1;
    
    tempCtx.drawImage(canvas, x, y, 1, 1, 0, 0, 1, 1);
    
    const pixelData = tempCtx.getImageData(0, 0, 1, 1).data;
    const hexColor = rgbToHex(pixelData[0], pixelData[1], pixelData[2]);
    
    colorPicker.value = hexColor;
    
    if (mobileColorBtn) {
        mobileColorBtn.style.backgroundColor = hexColor;
    }

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
    const pressure = e.pressure || 0.5;
    
    layer.ctx.globalAlpha = opacitySlider.value / 100;
    layer.ctx.lineCap = "round";
    layer.ctx.lineJoin = "round";
    
    if (state.currentTool === "eraser") {
        layer.ctx.globalCompositeOperation = "destination-out";
        layer.ctx.strokeStyle = "rgba(0,0,0,1)";
        layer.ctx.lineWidth = lineWidth.value;
        layer.ctx.lineTo(x, y);
        layer.ctx.stroke();
    } 
    else if (state.currentTool === "blur") {
        applySmoothBrush(layer, x, y, lineWidth.value / 2, pressure);
    } 
    else if (state.currentTool === "smooth") {
        layer.ctx.globalCompositeOperation = "source-over";
        layer.ctx.lineWidth = lineWidth.value;
        
        if (state.isRainbow) {
            layer.ctx.strokeStyle = `hsl(${(Date.now() / 50) % 360}, 100%, 50%)`;
        } else {
            layer.ctx.strokeStyle = colorPicker.value;
        }
        
        layer.ctx.globalAlpha = (opacitySlider.value / 100) * 0.3;
        layer.ctx.lineTo(x, y);
        layer.ctx.stroke();
    } 
    else {
        layer.ctx.globalCompositeOperation = "source-over";
        layer.ctx.lineWidth = lineWidth.value;
        layer.ctx.strokeStyle = state.isRainbow 
            ? `hsl(${(Date.now() / 50) % 360}, 100%, 50%)` 
            : colorPicker.value;
        layer.ctx.lineTo(x, y);
        layer.ctx.stroke();
    }
    
    [state.lastX, state.lastY] = [x, y];
    renderCanvas();
}

function stopDrawing() {
    state.isDrawing = false;
}

// Canvas Rendering
function renderCanvas() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply zoom and pan transformations
    ctx.translate(state.offsetX, state.offsetY);
    ctx.scale(state.zoom, state.zoom);
    
    // Draw all visible layers with their opacity and position
    state.layers.forEach(layer => {
        if (layer.visible) {
            ctx.save();
            ctx.globalAlpha = layer.opacity / 100; // Convert 0-100 to 0-1
            ctx.drawImage(layer.canvas, layer.x || 0, layer.y || 0);
            ctx.restore();
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

// Event Handling
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
    
    return {
        x: (clientX - state.offsetX) / state.zoom,
        y: (clientY - state.offsetY) / state.zoom
    };
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
    } else if (state.currentTool === "move" || state.isDraggingLayerContent) {
        canvas.style.cursor = "grab";
    } else if (state.isPanning) {
        canvas.style.cursor = "grabbing";
    } else {
        canvas.className = "";
    }
}

function setupEventListeners() {
    window.addEventListener("resize", debounce(resizeCanvas));
    window.addEventListener("orientationchange", handleOrientationChange);
    
    canvas.addEventListener("mousedown", (e) => {
        if (state.currentTool === "eyedropper") {
            useEyedropper(e);
        } else if (state.currentTool === "move") {
            startLayerDrag(e);
        } else if (e.button === 1 || (e.ctrlKey && e.button === 0)) {
            startPan(e);
        } else {
            startDrawing(e);
        }
    });
    
    canvas.addEventListener("mousemove", (e) => {
        if (state.isDraggingLayerContent) {
            dragLayerContent(e);
        } else if (state.isPanning) {
            pan(e);
        } else if (state.isDrawing) {
            draw(e);
        }
    });
    
    canvas.addEventListener("mouseup", () => {
        stopDrawing();
        stopPan();
        stopLayerDrag();
    });
    
    canvas.addEventListener("mouseout", () => {
        stopDrawing();
        stopPan();
        stopLayerDrag();
    });
    
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    
    canvas.addEventListener("touchstart", (e) => {
        if (state.currentTool === "eyedropper") {
            useEyedropper(e);
            e.preventDefault();
        } else if (state.currentTool === "move") {
            startLayerDrag(e);
            e.preventDefault();
        } else if (e.touches.length === 2) {
            state.pinchDistance = getPinchDistance(e);
            e.preventDefault();
        } else {
            startDrawing(e);
        }
    }, { passive: false });
    
    canvas.addEventListener("touchmove", (e) => {
        if (e.touches.length === 2) {
            const newDistance = getPinchDistance(e);
            const center = getPinchCenter(e);
            
            if (state.pinchDistance > 0) {
                const scale = newDistance / state.pinchDistance;
                zoomCanvas(state.zoom * scale, center.x, center.y);
            }
            
            state.pinchDistance = newDistance;
            e.preventDefault();
        } else if (state.isDraggingLayerContent) {
            dragLayerContent(e);
            e.preventDefault();
        } else if (state.isDrawing) {
            draw(e);
            e.preventDefault();
        }
    }, { passive: false });
    
    canvas.addEventListener("touchend", () => {
        stopDrawing();
        stopPan();
        stopLayerDrag();
    });
    
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
            : "#3498db";
        updateCursor();
    });
    
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
            document.querySelector(".toolbar").classList.toggle("mobile-visible");
        });
    }
    
    if (mobileEyedropperBtn) {
        mobileEyedropperBtn.addEventListener("click", () => {
            state.currentTool = "eyedropper";
            toolSelect.value = "eyedropper";
            updateCursor();
        });
    }
    
    if (mobileMoveBtn) {
        mobileMoveBtn.addEventListener("click", () => {
            state.currentTool = "move";
            toolSelect.value = "move";
            updateCursor();
        });
    }
}

function downloadCanvas() {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext("2d");
    
    state.layers.forEach(layer => {
        if (layer.visible) {
            exportCtx.save();
            exportCtx.globalAlpha = (layer.opacity || 100) / 100;
            exportCtx.translate(layer.x || 0, layer.y || 0);
            exportCtx.drawImage(layer.canvas, 0, 0);
            exportCtx.restore();
        }
    });
    
    const link = document.createElement("a");
    link.download = `drawing-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
}

// Zoom/Pan Functions
function zoomCanvas(newZoom, centerX = canvas.width/2, centerY = canvas.height/2) {
    const oldZoom = state.zoom;
    state.zoom = Math.max(0.1, Math.min(5, newZoom));
    
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

// Initialization
function init() {
    resizeCanvas();
    createLayer("Background");
    setupEventListeners();
    setupImageUpload();
    setupLayerDragAndDrop();
    updateCursor();
    updateZoomDisplay();
    
    // Add resize observer
    const resizeObserver = new ResizeObserver(debounce(() => {
        resizeCanvas();
        renderCanvas();
    }));
    resizeObserver.observe(canvasContainer);
}

// Start the app
document.addEventListener("DOMContentLoaded", init);