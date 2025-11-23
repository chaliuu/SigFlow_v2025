const baseUrl = window.location.origin;

const circuitId = sessionStorage.getItem('circuitId');

let [simplify_mode, node1, node2] = [false, null, null];
let [highlight_mode, hlt_src, hlt_tgt] = [false, null, null];

const SYMBOLIC_LABEL_BASE_FONT = 24;
const EDGE_BASE_CURVE_DISTANCE = 220;
const EDGE_CURVE_SPACING = 150;
const EDGE_MIN_CURVE_MAGNITUDE = 130;
const EDGE_WEIGHT_SHIFT = 0.22;
const EDGE_CURVE_LENGTH_BASE = 260;
const EDGE_CURVE_LENGTH_SCALE = 280;
const EDGE_CENTER_EXPANSION = 340;
const EDGE_LABEL_OFFSET_BASE = -18;
const EDGE_LABEL_OFFSET_STEP = 26;
const EDGE_LABEL_WIDTH_PADDING = 72;
const EDGE_LABEL_CHAR_FACTOR = 0.62;
const EDGE_LABEL_WIDTH_SCALE = 0.45;

let pendingCurveUpdate = false;

function scheduleEdgeCurveUpdate(cy) {
    if (!cy || cy.destroyed()) {
        return;
    }

    if (pendingCurveUpdate) {
        return;
    }

    pendingCurveUpdate = true;

    requestAnimationFrame(() => {
        pendingCurveUpdate = false;
        applyEdgeCurves(cy);
        syncSymbolicLabelOffsets(cy);
    });
}

function sanitizeLatexText(text) {
    if (!text) {
        return '';
    }

    return String(text)
        .replace(/\\frac/g, 'frac')
        .replace(/\\[a-zA-Z]+/g, 'A')
        .replace(/[{}^_]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function approximateLabelWidth(text, fontSize) {
    if (!text) {
        return 0;
    }

    const normalized = text.trim();

    if (!normalized) {
        return 0;
    }

    const baseSize = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : SYMBOLIC_LABEL_BASE_FONT;
    const length = normalized.length;

    return length * baseSize * EDGE_LABEL_CHAR_FACTOR + EDGE_LABEL_WIDTH_PADDING;
}

function measureEdgeLabelWidth(edge) {
    if (!edge || edge.destroyed()) {
        return 0;
    }

    const measuredWidth = edge.scratch('_labelWidthPx');

    if (measuredWidth && measuredWidth > 0) {
        return measuredWidth + EDGE_LABEL_WIDTH_PADDING * 0.5;
    }

    const numericText = edge.data('weight') || '';
    const numericFont = parseFloat(edge.style ? edge.style('font-size') : SYMBOLIC_LABEL_BASE_FONT) || SYMBOLIC_LABEL_BASE_FONT;
    const numericWidth = approximateLabelWidth(String(numericText), numericFont);

    const symbolicIndex = edge.data('symbolicIndex');
    let symbolicText = '';

    if (symbolicIndex !== undefined && symbolicIndex !== null && edge_symbolic_label && edge_symbolic_label[symbolicIndex]) {
        symbolicText = sanitizeLatexText(edge_symbolic_label[symbolicIndex]);
    }

    const symbolicWidth = approximateLabelWidth(symbolicText, SYMBOLIC_LABEL_BASE_FONT * 1.05);

    return Math.max(numericWidth, symbolicWidth);
}

function syncSymbolicLabelOffsets(cy) {
    if (!symbolic_flag || !cy || cy.destroyed()) {
        return;
    }

    cy.edges().forEach(edge => {
        const labelEl = document.getElementById(`edge-label-${edge.id()}`);

        if (labelEl) {
            labelEl.style.marginTop = `${edge.data('labelOffset') || 0}px`;
        }
    });
}

function applyEdgeLabelVisibility(cyInstance = window.cy) {
    if (!cyInstance || cyInstance.destroyed()) {
        return;
    }

    const edgeStyle = cyInstance.style().selector('edge');

    if (!symbolic_flag) {
        edgeStyle.css({'content': edgeLabelsVisible ? 'data(weight)' : ''}).update();
        return;
    }

    edgeStyle.css({'content': ''}).update();
    const container = document.querySelector('.sfg-section');
    if (!container) {
        return;
    }

    const symbolicLabels = container.querySelectorAll('.label');
    symbolicLabels.forEach(label => {
        label.style.display = edgeLabelsVisible ? '' : 'none';
    });
}

function toggleEdgeLabels() {
    edgeLabelsVisible = !edgeLabelsVisible;
    applyEdgeLabelVisibility(window.cy);
}

function removeSymbolicLabels() {
    const container = document.querySelector('.sfg-section');
    if (!container) {
        return;
    }

    container.querySelectorAll('.label').forEach(label => {
        label.remove();
    });
}

function renderSymbolicLabels() {
    if (!symbolic_flag) {
        removeSymbolicLabels();
        return;
    }

    const cyInstance = window.cy;
    if (!cyInstance || cyInstance.destroyed()) {
        return;
    }

    removeSymbolicLabels();
    display_mag_sfg();
}

function renderNumericLabels() {
    const cyInstance = window.cy;
    if (!cyInstance || cyInstance.destroyed()) {
        removeSymbolicLabels();
        return;
    }

    removeSymbolicLabels();
    applyEdgeLabelVisibility(cyInstance);
}

function renderCurrentLabelMode() {
    const cyInstance = window.cy;
    if (!cyInstance || cyInstance.destroyed()) {
        return;
    }

    if (symbolic_flag) {
        renderSymbolicLabels();
    } else {
        renderNumericLabels();
    }
}

function updateSymbolicUIState() {
    const frequencySlider = document.getElementById('frequency-slider');
    const removeBtn = document.getElementById('rmv-branch-btn');
    const editBtn = document.getElementById('edit-branch-btn');
    const toggle = document.getElementById('feature-toggle');

    if (frequencySlider) {
        frequencySlider.disabled = symbolic_flag;
    }

    if (removeBtn) {
        removeBtn.disabled = !symbolic_flag;
    }

    if (editBtn) {
        editBtn.disabled = !symbolic_flag;
    }

    if (toggle) {
        toggle.checked = symbolic_flag;
    }
}

let stack_len = 0
let redo_len = 0

if (!circuitId) {
    window.location.replace('./landing.html');
}

var symbolic_flag = true //feature toggle
var tf_flag = false //transfer function toggle
var lg_flag = false //loop gain toggle
var tf = {}
let current_data = null //session data
let edge_symbolic_label;
let transfer_bode_plot_history = [];
let loop_gain_bode_plot_history = [];
let edgeLabelsVisible = true;

// Function to convert float to exponential
function expo(x, f) {
  return Number.parseFloat(x).toExponential(f);
}

// Status of undo button for simplification
function disable_undo_btn(status){
    document.getElementById("undo-btn").disabled = status;
}

// status of redo button for simplification
function disable_redo_btn(status){
    document.getElementById("redo-btn").disabled = status;
}

// Function that parses the graph sent as a JSON from the backend
// into a cytoscape graph
function edge_helper(sample_data, flag) {
    if (!sample_data || !sample_data.sfg || !sample_data.sfg.elements) {
        throw new Error('Invalid sample data');
    }
    
    let sfg_elements = JSON.parse(JSON.stringify(sample_data.sfg.elements))
    let edge_length = sample_data.sfg.elements.edges.length
    let sfg_edges = []
    edge_symbolic_label = new Array(edge_length)

    // TODO MARK
    for (i = 0; i < edge_length; i++) {
        let new_edge = JSON.parse(JSON.stringify(sample_data.sfg.elements.edges[i])) // make sample_data.sfg.elements.edges[i] get the new edited branch from edge_symbolic_label[i] ==> sdf_patch_request_without_rendering to see updates
        edge_symbolic_label[i] = new_edge.data.weight.symbolic
        // TODO MARK
        // call sfg_patch_request (with or without rerendering) to send to backend
        
        // Represent magnitude with 2 decimal points exponent
        let magnitude = expo((new_edge.data.weight.magnitude), 2).toString()
        let phase = new_edge.data.weight.phase.toFixed(2).toString()
        // Transmittance in polar form
        let result = magnitude.concat("∠", phase);
        new_edge.data.weight = result
        new_edge.data.controlPointDistance = -EDGE_BASE_CURVE_DISTANCE
        new_edge.data.controlPointWeight = 0.5
        new_edge.data.labelOffset = EDGE_LABEL_OFFSET_BASE
        sfg_edges.push(new_edge)
    }

    sfg_elements.edges = JSON.parse(JSON.stringify(sfg_edges))
    return sfg_elements
}

// log sfg module loading time
const time1 = new Date()


// Shared SFG style so sfg-section and overlay-section look identical
function getSfgStyles() {
  return [
    {
      selector: 'node[name]',
      style: {
        'content': 'data(name)',
        'font-size': '26px',
        'text-outline-width': '8',
        'text-outline-color': '#E8E8E8',
        'width': '84px',
        'height': '84px',
        'background-color': '#5aa5ff',
        'border-width': '4px',
        'border-color': '#4a90e2',
        'background-fill': 'radial-gradient',
        'background-gradient-stop-colors': '#ffffff #5aa5ff',
        'background-gradient-stop-positions': '0% 100%',
        'shadow-blur': 18,
        'shadow-color': '#2d5aa0',
        'shadow-opacity': 0.25,
        'shadow-offset-x': 0,
        'shadow-offset-y': 4,
        'text-valign': 'center',
        'text-halign': 'center'
      }
    },
    {
      selector: 'node[Vin]',
      style: {
        'background-color': 'red'
      }
    },
    {
      selector: 'edge',
      style: {
        'curve-style': 'unbundled-bezier',
        'control-point-distance': 'data(controlPointDistance)',
        'control-point-weight': 'data(controlPointWeight)',
        'control-point-step-size': EDGE_CURVE_SPACING,
        'width': 5,
        'line-color': '#4a90e2',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 1.2,
        'target-arrow-color': '#4a90e2',
        'source-arrow-color': '#4a90e2',
        'content': 'data(weight)',
        'font-size': '24px',
        'edge-text-rotation': 'autorotate',
        'text-margin-y': 'data(labelOffset)',
        'text-outline-width': 8,
        'text-outline-color': '#E8E8E8'
      }
    },

    // --- existing highlight / path styles to keep behaviour ---
    {
      selector: ':selected',
      style: {
        'background-color': '#0069d9'
      }
    },
    {
      selector: '.highlighted',
      style: {
        'background-color': 'red',
        'line-color': 'red',
        'target-arrow-color': 'red',
        'transition-property': 'background-color, line-color, target-arrow-color',
        'transition-duration': '0.1s'
      }
    },
    {
      selector: '.cycle',
      style: {
        'background-color': 'blue',
        'line-color': 'blue',
        'target-arrow-color': 'blue',
        'transition-property': 'background-color, line-color, target-arrow-color',
        'transition-duration': '0.1s'
      }
    },
    {
      selector: '.weak_path',
      style: {
        'background-color': 'yellow',
        'line-color': 'yellow',
        'target-arrow-color': 'yellow',
        'transition-property': 'background-color, line-color, target-arrow-color',
        'transition-duration': '0.1s'
      }
    },
    {
      selector: '.common_edge',
      style: {
        'background-color': 'purple',
        'line-color': 'purple',
        'target-arrow-color': 'purple',
        'transition-property': 'background-color, line-color, target-arrow-color',
        'transition-duration': '0.1s'
      }
    },
    {
      selector: '.pink',
      style: {
        'background-color': '#d90069',
        'line-color': '#d90069',
        'target-arrow-color': '#d90069',
        'transition-property': 'background-color, line-color, target-arrow-color',
        'transition-duration': '0.1s'
      }
    },
    {
      selector: '.green',
      style: {
        'background-color': '#2E8B57',
        'line-color': '#2E8B57',
        'target-arrow-color': '#2E8B57',
        'transition-property': 'background-color, line-color, target-arrow-color',
        'transition-duration': '0.1s'
      }
    }
  ];
}



// Reusable factory to create an SFG Cytoscape instance
function createSfgInstance(container, elements, extraOptions = {}) {
  return cytoscape(Object.assign({
    container,
    layout: {
      name: 'dagre',
      nodeSep: 200,
      edgeSep: 220,
      rankSep: 120,
      rankDir: 'LR',
      fit: true,
      minLen: function(edge){ return 2; }
    },
    wheelSensitivity: 0.4,
    style: getSfgStyles(),
    elements
  }, extraOptions));
}

function make_sfg(elements) {
  const container = document.getElementById('cy');
  if (!container) {
    console.warn('make_sfg: #cy container not found');
    return;
  }

  var cy = window.cy = createSfgInstance(container, elements);
  setupEdgeCurveCurvature(cy);

  // make lines straight when aligned
  cy.edges().forEach((edge, idx) => {
    if (
      (edge.sourceEndpoint().x === edge.targetEndpoint().x ||
       edge.sourceEndpoint().y === edge.targetEndpoint().y) &&
      edge.source().edgesWith(edge.target()).length === 1
    ) {
      edge.data('controlPointDistance', 0);
      edge.data('controlPointWeight', 0.5);
    }
  });

  // log all nodes and edges of sfg
  console.log("nodes:", cy.nodes());
  console.log("node ids:", cy.nodes().map(node => node.id()));
  console.log("edges:", cy.edges());

  cy.on('tap', 'node', function(evt){
    if (simplify_mode) {
      let node = evt.target;
      console.log('tapped ' + node.id());
      if (node === node1) {
        cy.$('#' + node.id()).css({ 'background-color': '' });
        node1 = null;
      }
      else if (node === node2) {
        cy.$('#' + node.id()).css({ 'background-color': '' });
        node2 = null;
      }
      else if (node1 === null) {
        cy.$('#' + node.id()).css({ 'background-color': '#03af03' });
        node1 = node;
      }
      else if (node2 === null) {
        cy.$('#' + node.id()).css({ 'background-color': '#f8075a' });
        node2 = node;
      }
    }
    if (highlight_mode) {
      let node = evt.target;
      console.log('tapped ' + node.id());
      if (node === hlt_src) {
        cy.$('#' + node.id()).css({ 'background-color': '' });
        hlt_src = null;
      }
      else if (node === hlt_tgt) {
        cy.$('#' + node.id()).css({ 'background-color': '' });
        hlt_tgt = null;
      }
      else if (hlt_src === null) {
        cy.$('#' + node.id()).css({ 'background-color': '#03af03' });
        hlt_src = node;
      }
      else if (hlt_tgt === null) {
        cy.$('#' + node.id()).css({ 'background-color': '#f8075a' });
        hlt_tgt = node;
      }
      if (hlt_src != null & hlt_tgt != null) {
        console.log("Time to highlight:)");
        HighlightPath();
      } else {
        removeHighlightPrevious();
      }
    }
  });

  // Initialize edge hover functionality
  initializeEdgeHover();

  renderCurrentLabelMode();

  try {
        autoRelocateIVNodesPrefix({
            animate: false,
            duration: 350,
            iscOffsetPx: 50
        });
    } catch (e) {
        console.warn('autoRelocateIVNodesPrefix after simplification/branch removal failed:', e);
    }

  const time2 = new Date();
  let time_elapse = (time2 - time1)/1000;
  console.log("elements:", elements);
  console.log("make_sfg SFG loading time: " + time_elapse + " seconds");
}

function setupEdgeCurveCurvature(cy) {
  if (!cy || cy.destroyed()) {
    return;
  }

  const scheduleUpdate = () => scheduleEdgeCurveUpdate(cy);

  scheduleUpdate();
  cy.on('layoutstop', scheduleUpdate);
  cy.on('add remove', 'edge', scheduleUpdate);
  cy.on('position', 'node', scheduleUpdate);
}

function applyEdgeCurves(cy) {
  if (!cy || cy.destroyed()) {
    return;
  }

  cy.edges().forEach((edge, idx) => {
    if (!edge || !edge.isEdge() || edge.destroyed()) {
      return;
    }

    edge.data('symbolicIndex', idx);

    if (edge.data('labelOffset') === undefined || edge.data('labelOffset') === null) {
      edge.data('labelOffset', EDGE_LABEL_OFFSET_BASE);
    }
  });

  const groupedOutgoing = new Map();
  const groupedIncoming = new Map();
  const pairedEdges = new Map();

  cy.edges().forEach(edge => {
    if (!edge.isEdge() || edge.destroyed()) {
      return;
    }

    const sourceEndpoint = edge.sourceEndpoint();
    const targetEndpoint = edge.targetEndpoint();

    if (!sourceEndpoint || !targetEndpoint) {
      return;
    }

    const isVertical = Math.abs(sourceEndpoint.x - targetEndpoint.x) < 1;
    const isHorizontal = Math.abs(sourceEndpoint.y - targetEndpoint.y) < 1;
    const isSingleConnection = edge.source().edgesWith(edge.target()).length === 1;

    if ((isVertical || isHorizontal) && isSingleConnection) {
      edge.scratch('_forceStraight', true);
      edge.data('controlPointDistance', 0);
      edge.data('controlPointWeight', 0.5);
      return;
    }

    edge.removeScratch('_forceStraight');

    const outKey = edge.source().id();
    const inKey = edge.target().id();

    if (!groupedOutgoing.has(outKey)) {
      groupedOutgoing.set(outKey, []);
    }
    if (!groupedIncoming.has(inKey)) {
      groupedIncoming.set(inKey, []);
    }

    groupedOutgoing.get(outKey).push(edge);
    groupedIncoming.get(inKey).push(edge);

    const pairKey = `${edge.source().id()}->${edge.target().id()}`;

    if (!pairedEdges.has(pairKey)) {
      pairedEdges.set(pairKey, []);
    }

    pairedEdges.get(pairKey).push(edge);
  });

  const assignRank = (collection, accessor, rankKey, sizeKey) => {
    if (!collection || collection.length === 0) {
      return;
    }

    collection.forEach(edge => edge.scratch(sizeKey, collection.length));

    if (collection.length === 1) {
      collection[0].scratch(rankKey, 0);
      return;
    }

    collection
      .sort((a, b) => accessor(a) - accessor(b))
      .forEach((edge, idx) => {
        const offset = idx - (collection.length - 1) / 2;
        edge.scratch(rankKey, offset);
      });
  };

  groupedOutgoing.forEach(edges => {
    assignRank(edges, edge => edge.target().position('y'), '_outRank', '_outSize');
  });

  groupedIncoming.forEach(edges => {
    assignRank(edges, edge => edge.source().position('y'), '_inRank', '_inSize');
  });

  pairedEdges.forEach(edges => {
    edges
      .sort((a, b) => {
        const targetDiff = a.target().position('y') - b.target().position('y');

        if (targetDiff !== 0) {
          return targetDiff;
        }

        const sourceDiff = a.source().position('y') - b.source().position('y');

        if (sourceDiff !== 0) {
          return sourceDiff;
        }

        return a.id().localeCompare(b.id());
      })
      .forEach((edge, idx) => {
        edge.scratch('_pairIndex', idx);
        edge.scratch('_pairSize', edges.length);
      });
  });

  const positions = cy.nodes().map(node => node.position());
  const center = positions.reduce((acc, pos) => {
    acc.x += pos.x;
    acc.y += pos.y;
    return acc;
  }, { x: 0, y: 0 });

  if (positions.length) {
    center.x /= positions.length;
    center.y /= positions.length;
  }

  const bbox = cy.elements().boundingBox();
  const maxRadius = Math.max(bbox.w, bbox.h) / 2;
  const safeRadius = Math.max(maxRadius, 1);

  cy.edges().forEach(edge => {
    if (!edge.isEdge() || edge.destroyed()) {
      return;
    }

    const forceStraight = edge.scratch('_forceStraight');
    const outRank = edge.scratch('_outRank') || 0;
    const inRank = edge.scratch('_inRank') || 0;
    const outSize = edge.scratch('_outSize') || 1;
    const inSize = edge.scratch('_inSize') || 1;
    const pairIndex = edge.scratch('_pairIndex') || 0;
    const pairSize = edge.scratch('_pairSize') || 1;

    const cleanupScratch = () => {
      edge.removeScratch('_outRank');
      edge.removeScratch('_inRank');
      edge.removeScratch('_outSize');
      edge.removeScratch('_inSize');
      edge.removeScratch('_pairIndex');
      edge.removeScratch('_pairSize');
    };

    const sourcePos = edge.source().position();
    const targetPos = edge.target().position();
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const spanLength = Math.hypot(dx, dy);
    const midX = (sourcePos.x + targetPos.x) / 2;
    const midY = (sourcePos.y + targetPos.y) / 2;
    const toCenterX = midX - center.x;
    const toCenterY = midY - center.y;
    const centerDistance = Math.hypot(toCenterX, toCenterY);
    const norm = spanLength === 0 ? 1 : spanLength;
    const perpX = -dy / norm;
    const perpY = dx / norm;
    const outward = perpX * toCenterX + perpY * toCenterY;
    const combinedOffset = outRank - inRank;
    let directionSign = outward >= 0 ? 1 : -1;

    if (Math.abs(outward) < 0.01) {
      if (combinedOffset !== 0) {
        directionSign = combinedOffset > 0 ? 1 : -1;
      } else if (dy !== 0) {
        directionSign = dy > 0 ? 1 : -1;
      }
    }

    const outSpread = outSize > 1 ? outRank / ((outSize - 1) / 2) : 0;
    const inSpread = inSize > 1 ? inRank / ((inSize - 1) / 2) : 0;
    const spreadMagnitude = Math.abs(outRank) + Math.abs(inRank);
    const pairSpread = pairSize > 1 ? pairIndex - (pairSize - 1) / 2 : 0;
    const normalizedPairSpread = pairSize > 1 ? pairSpread / ((pairSize - 1) / 2) : 0;

    const labelWidth = measureEdgeLabelWidth(edge);
    const labelRatio = spanLength > 0 ? labelWidth / spanLength : 1;
    const labelDirectionBias = directionSign * EDGE_LABEL_OFFSET_STEP * 0.55;
    const labelCrowdingBias = combinedOffset * EDGE_LABEL_OFFSET_STEP * 0.35;
    const pairLaneBias = normalizedPairSpread * EDGE_LABEL_OFFSET_STEP * 1.15;
    const rawLabelOffset = EDGE_LABEL_OFFSET_BASE + labelDirectionBias + labelCrowdingBias + pairLaneBias;
    const labelOffset = Math.max(-220, Math.min(220, rawLabelOffset));

    edge.data('labelOffset', labelOffset);

    if (forceStraight) {
      cleanupScratch();
      return;
    }

    let magnitude = EDGE_BASE_CURVE_DISTANCE;
    magnitude += spreadMagnitude * (EDGE_CURVE_SPACING * 0.6);
    magnitude += Math.abs(combinedOffset) * (EDGE_CURVE_SPACING * 0.4);
    magnitude += Math.abs(pairSpread) * (EDGE_CURVE_SPACING * 1.1);
    magnitude += labelWidth * EDGE_LABEL_WIDTH_SCALE;

    if (labelRatio > 0.85) {
      magnitude += (labelRatio - 0.85) * EDGE_CURVE_SPACING * 2.1;
    }

    if (spanLength > EDGE_CURVE_LENGTH_BASE) {
      magnitude += ((spanLength - EDGE_CURVE_LENGTH_BASE) / EDGE_CURVE_LENGTH_SCALE) * EDGE_CURVE_SPACING;
    }

    if (spanLength < labelWidth * 0.9) {
      magnitude += (labelWidth * 0.9 - spanLength) * 0.9;
    }

    if (centerDistance <= safeRadius) {
      const centerRatio = 1 - Math.min(centerDistance / safeRadius, 1);
      magnitude += centerRatio * EDGE_CENTER_EXPANSION;
    }

    magnitude = Math.max(EDGE_MIN_CURVE_MAGNITUDE, magnitude);

    let distance = directionSign * magnitude;

    if (distance === 0) {
      distance = directionSign >= 0 ? EDGE_MIN_CURVE_MAGNITUDE : -EDGE_MIN_CURVE_MAGNITUDE;
    }

    const weightBase = (outSpread - inSpread) * EDGE_WEIGHT_SHIFT;
    const pairBias = normalizedPairSpread * 0.18;
    const outwardBias = directionSign * 0.08;
    const labelBias = Math.max(-0.15, Math.min(0.15, (labelRatio - 1) * 0.12));
    const weight = Math.max(0.12, Math.min(0.88, 0.5 + weightBase + outwardBias + pairBias + labelBias));

    edge.data('controlPointDistance', distance);
    edge.data('controlPointWeight', weight);

    cleanupScratch();
  });
}



//SCALING WORKING
//ALIGNMENT NOT FULLY CORRECT

function alignLayers(svgLayer, sfgLayer) {
    const svgBounds = svgLayer.getBoundingClientRect();
    const sfgBounds = sfgLayer.getBoundingClientRect();

    if (!svgBounds.width || !svgBounds.height) {
        return;
    }

    const scaleX = sfgBounds.width / svgBounds.width;
    const scaleY = sfgBounds.height / svgBounds.height;
    const offsetX = sfgBounds.left - svgBounds.left;
    const offsetY = sfgBounds.top - svgBounds.top;

    svgLayer.style.transformOrigin = "top left";
    svgLayer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scaleX}, ${scaleY})`;

    svgLayer.style.opacity = 0.5;
    sfgLayer.style.opacity = 1;

    console.log("SVG aligned with SFG:", { scaleX, scaleY, offsetX, offsetY });
}


function renderOverlay(data) {
  const svgLayer = document.getElementById('svg-layer');
  const sfgLayer = document.getElementById('cy');

  if (!svgLayer || !sfgLayer) {
    console.warn('renderOverlay: missing #svg-layer or #cy containers');
    return;
  }

  svgLayer.innerHTML = data.svg;

  const svgElement = svgLayer.querySelector('svg');
  if (svgElement) {
    const boundingBox = svgElement.getBBox();
    const viewBoxValue =
      `${boundingBox.x} ${boundingBox.y} ${boundingBox.width} ${boundingBox.height}`;
    svgElement.setAttribute('viewBox', viewBoxValue);
    svgElement.style.width = '100%';
    svgElement.style.height = '100%';
  }

  requestAnimationFrame(() => {
    alignLayers(svgLayer, sfgLayer);

    try {
      if (window.cy) {
        autoRelocateIVNodesPrefix({
          animate: false,
          iscOffsetPx: 50,
        });
        scheduleEdgeCurveUpdate(window.cy);
      }
    } catch (e) {
      console.warn('Auto placement failed while syncing overlay:', e);
    }
  });
}




let isSVGVisible = true; 

function toggleSVG() {
    const svgLayer = document.getElementById('svg-layer');

    if (isSVGVisible) {
        // hiding
        svgLayer.style.display = 'none';
    } else {
        svgLayer.style.display = 'block';
    }

    isSVGVisible = !isSVGVisible;
}



function HighlightPath(){
    var node = hlt_src;
    var target = hlt_tgt
    var paths_found = 0;
    var elementsToSearch = cy.elements;
    var searchedAlready = [];
    var MakesPath = [];
    paths = []
    cycle_edge_in_path = []
    actual_cycles = []
    removeHighlightPrevious()

    // source is a node
    // destination is a node
    const findPathsToTarget = function(source, destination, searchedAlready, path){
          let connected = source.outgoers().edges()
          searchedAlready.push(source.id())
          let new_path = [...path];
          var result = false;
          if(connected.length != 0){
            // find direct connections
            connected.forEach(this_edge => {
                if(this_edge.target().id() == destination.id()){
                    // concatenate edge
                    const found_path = new_path.concat([this_edge]);
                    paths_found = paths_found + 1
                    paths.push(found_path)
                    result = true
                }
                else{
                    // check if node already visited within path
                    visited = false
                    var edge_index = 0
                    // changed to source and checked if it came back to itself
                    new_path.forEach(e => {
                        if(e.source().id() == this_edge.target().id() || this_edge.target().id() == this_edge.source().id()){
                            visited = true;
                            let new_cycle = new_path.slice(edge_index)
                            new_cycle.push(this_edge)
                            actual_cycles.push(new_cycle)
                            console.log("In here!")
                            console.log(new_cycle)
                            cycle_edge_in_path.push(e)
                        }
                        edge_index = edge_index + 1
                    })

                    if(visited == false){
                        const explore_path = new_path.concat([this_edge]);
                        if(findPathsToTarget(this_edge.target(), destination, searchedAlready, explore_path)){
                            result = true;
                            MakesPath.push(this_edge.target().id())
                        }
                    }
                }
            });
          }
          if(result == true){
            return true;
          }else{
            return false;
          }
    };

    if(findPathsToTarget(node, target, searchedAlready, [])){
        MakesPath.push(node.id())
        let index = 0;
        let min_index = -1;
        let max_index = -1;
        let max_gain = 0;
        let min_gain = Infinity;
        console.log("Paths found = " + paths_found)
        gains = []
        paths.forEach(path => {
            let total_gain = 1.0
            path.forEach(gain=>{
                let weight = gain.data('weight')
                weight = weight.split('∠');
                total_gain = total_gain * Number(weight[0])
            })
            gains.push(total_gain)
            if(total_gain < min_gain){
                min_index = index;
                min_gain = total_gain;
            }
            if(total_gain > max_gain){
                max_index = index;
                max_gain = total_gain;
            }
            index = index + 1;
      })
        if(min_index != -1){
            paths[min_index].forEach(gain=>{
                gain.addClass('weak_path')
                if(gain.target().id() != target.id() & gain.target().id() != node.id()){
                    gain.target().addClass('weak_path')
                }
                if(gain.source().id() != node.id() & gain.source().id() != target.id()){
                    gain.source().addClass('weak_path')
                }
            })
        }
        if(max_index != -1){
            paths[max_index].forEach(gain=>{
                gain.addClass('highlighted')
                if(gain.target().id() != target.id() & gain.target().id() != node.id()){
                    gain.target().addClass('highlighted')
                }
                if(gain.source().id() != node.id() & gain.source().id() != target.id()){
                    gain.source().addClass('highlighted')
                }
          })
      }
        if(max_index != -1 & min_index != -1){
             const filteredArray = paths[max_index].filter(value => paths[min_index].includes(value));
             filteredArray.forEach(path=>{
                 path.addClass('common_edge')
                 if(path.target().id() != target.id())
                    path.target().addClass('common_edge')
                 if(path.source().id() != node.id())
                    path.source().addClass('common_edge')
             })
        }
        var cycle_index = 0
        cycle_edge_in_path.forEach(cycle=>{
            if(MakesPath.includes(cycle.target().id()) && MakesPath.includes(cycle.source().id())){
                console.log('Cycle found: ')
                console.log(actual_cycles[cycle_index])
                actual_cycles[cycle_index].forEach(cycle_edge=>{
                    cycle_edge.removeClass('weak_path')
                    cycle_edge.removeClass('common_edge')
                    cycle_edge.removeClass('highlighted')
                    cycle_edge.addClass('cycle')
                })
            }
            cycle_index = cycle_index + 1
        })
        console.log('Paths found: ')
        console.log(paths)
        console.log('Gains: ')
        console.log(gains)
        document.getElementById("dominant").textContent = expo(max_gain,2);
        document.getElementById("weak").textContent = expo(min_gain,2);
      }
}

function removeHighlightPrevious(){
    let cy = window.cy;
    document.getElementById("dominant").textContent = "N/A";
    document.getElementById("weak").textContent = "N/A";
    cy.elements().forEach((element,idx) => {
            element.removeClass('highlighted');
            element.removeClass('cycle');
            element.removeClass('weak_path');
            element.removeClass('pink');
            element.removeClass('green');
            element.removeClass('common_edge');
      })
}

function removeHighlight(){
    let cy = window.cy;
    document.getElementById("dominant").textContent = "N/A";
    document.getElementById("weak").textContent = "N/A";
    if(hlt_tgt){
        cy.$('#'+hlt_tgt.id()).css({'background-color': ''});
        hlt_tgt = null
    }
    if(hlt_src){
        cy.$('#'+hlt_src.id()).css({'background-color': ''});
        hlt_src = null
    }
    cy.elements().forEach((element,idx) => {
            element.removeClass('highlighted');
            element.removeClass('cycle');
            element.removeClass('weak_path');
            element.removeClass('pink');
            element.removeClass('green');
            element.removeClass('common_edge');
      })
}





// function dum2_editBranch() {
//     console.log("editBranch is called");

//     let cy = window.cy;
//     // let updates = new Array(cy.edges().length)
//     // let edges = new Array(cy.edges().length)

//     console.log("printing all edges: ", cy.edges())
//     // console.log("print edges: ", edges)

//     // Event listener for right-click on edges
//     cy.edges().forEach((edge, idx) => {
//         edge.on('cxttap', function(evt) {
//             console.log("evt target: ", evt.target)
//             console.log("evt: ", evt)

//             // Retrieve the LaTeX code for the selected edge
//             let latexCode = edge_symbolic_label[idx];
//             console.log("LaTeX code for selected edge:", latexCode);
//             console.log("Idx:", idx);

//             // Display popup window for editing LaTeX code
//             let modifiedLatexCode = editLatexCode(latexCode, idx);

//             // Check if the user made any modifications
//             if (modifiedLatexCode !== null) {
//                 // Update the LaTeX content of the Edge
//                 console.log("Modified LaTeX code:", modifiedLatexCode);
//                 // updateEdgeLabel(edge, modifiedLatexCode, idx);
//             }
//         });
        
//     });

//     // MathJax.typeset();

//     cy.style().selector('edge').css({ 'content': '' }).update();
//     const time2 = new Date();
//     let time_elapse = (time2 - time1) / 1000;
//     console.log("editBranch SFG loading time: " + time_elapse + " seconds");
// }


// function dum_editBranch() {
//     console.log("editBranch is called");

//     let cy = window.cy;
//     let updates = new Array(cy.edges().length)
//     let edges = new Array(cy.edges().length)

//     console.log("printing all edges: ", cy.edges())
//     console.log("print edges: ", edges)

//     // Event listener for right-click on edges
//     cy.edges().forEach((edge, idx) => {
//         edge.on('cxttap', function(evt) {
//             console.log("evt target: ", evt.target)
//             console.log("evt: ", evt)

//             // Retrieve the LaTeX code for the selected edge
//             let latexCode = edge_symbolic_label[idx];
//             console.log("LaTeX code for selected edge:", latexCode);
//             console.log("Idx:", idx);

//             // Display popup window for editing LaTeX code
//             let modifiedLatexCode = editLatexCode(latexCode, idx);

//             // Check if the user made any modifications
//             if (modifiedLatexCode !== null) {
//                 // Update the LaTeX content of the Edge
//                 console.log("Modified LaTeX code:", modifiedLatexCode);
//                 updateEdgeLabel(edge, modifiedLatexCode, idx);
//             }
//         });
//     });

//     // Function to update the LaTeX content of the edge
//     function updateEdgeLabel(edge, latexCode) {
//         console.log("Updating edge label:", edge, latexCode);
        
//         // Find the index of the edge in the edges array
//         let index = edges.findIndex(item => item.edge === edge);

//         // If the edge is found in the edges array
//         if (index !== -1) {
//             // Destroy the existing popper
//             edges[index].popper.destroy();

//             // Create a new popper with the modified LaTeX code
//             let newPopper = edge.popper({
//                 content: () => {
//                     let div = document.createElement('div');
//                     div.classList.add('label');
//                     div.innerHTML = '$$' + latexCode + '$$';
//                     console.log("Inside edge.popper content:()");
//                     return div;
//                 },
//                 popper: {
//                     modifiers: {
//                         preventOverflow: {
//                             enabled: true,
//                             boundariesElement: document.getElementsByClassName('sfg-section')[0],
//                             padding: 5
//                         },
//                         hide: {
//                             enabled: true,
//                         }
//                     }
//                 }
//             });

//             // Update the popper reference in the edges array
//             edges[index].popper = newPopper;
//         } else {
//             // Create a new popper and add it to the edges array
//             let newPopper = edge.popper({
//                 content: () => {
//                     let div = document.createElement('div');
//                     div.classList.add('label');
//                     div.innerHTML = '$$' + latexCode + '$$';
//                     console.log("Inside edge.popper content:()");
//                     return div;
//                 },
//                 popper: {
//                     modifiers: {
//                         preventOverflow: {
//                             enabled: true,
//                             boundariesElement: document.getElementsByClassName('sfg-section')[0],
//                             padding: 5
//                         },
//                         hide: {
//                             enabled: true,
//                         }
//                     }
//                 }
//             });

//             edges.push({ edge: edge, popper: newPopper });
//         }
//     }

//     MathJax.typeset();

//     cy.style().selector('edge').css({ 'content': '' }).update();
//     const time2 = new Date();
//     let time_elapse = (time2 - time1) / 1000;
//     console.log("editBranch SFG loading time: " + time_elapse + " seconds");
// }


// ------------------------------------------------------------------------------------------------

// // Function to display popup window with LaTeX code for editing
// function editLatexCode(latexCode) {
//     // Open a popup window or modal dialog
//     let userInput = prompt("Edit LaTeX code:", latexCode);

//     // Return the modified LaTeX code entered by the user
//     return userInput;
// }

// // edit the selected branch on the SFG
// function editBranch() {
//     console.log("editBranch is called");

//     let cy = window.cy;

//     let updates = new Array(cy.edges().length)
//     let edges = new Array(cy.edges().length)



//     // Event listener for right-click on edges
//     cy.edges().forEach((edge, idx) => {
//         edge.on('cxttap', function(evt){
//             // Retrieve the LaTeX code for the selected edge
//             let latexCode = edge_symbolic_label[idx];
//             console.log("LaTeX code for selected edge:", latexCode);

//             // Display popup window for editing LaTeX code
//             let modifiedLatexCode = editLatexCode(latexCode);

//             // Check if the user made any modifications
//             if (modifiedLatexCode !== null) {
//                 // Send the modified LaTeX code back to the circuit
//                 // Replace this line with the appropriate code to send the modified LaTeX code back to the circuit
//                 console.log("Modified LaTeX code:", modifiedLatexCode);
//             }
//         });
        
//         edges[idx] = edge.popper({
//             content: () => {
//             let div = document.createElement('div');

//             //div.classList.add('popper-div');
//             div.id = 'edge-' + idx;
//             div.style.cssText = `font-size:${cy.zoom()*16 + 'px'};font-weight:400;`
            
//             div.classList.add('label')
        
//             div.innerHTML = '$$' + modifiedLatexCode + '$$';
//             //div.innerHTML = '$$\\frac{y}{2x} + C$$';


        
//             //document.getElementById('magnitudes').appendChild(div);
//             //document.body.appendChild(div);
//             document.getElementsByClassName('sfg-section')[0].appendChild(div);
//             return div;
//             },
//             popper: {
//                 modifiers: {
//                     preventOverflow: {
//                         enabled: true,
//                         boundariesElement: document.getElementsByClassName('sfg-section')[0],
//                         padding: 5
//                     },
//                     hide:  {
//                         enabled: true,
//                     }
//             }
//         }})

//         updates[idx] = () => {
//             edges[idx].update();
//             edge = document.querySelector(`#edge-${idx}`);
//             if (edge) {
//                 edge.style.fontSize = cy.zoom()*16 + 'px';
//             }
//         }
          
//         edge.connectedNodes().on('position', updates[idx]);
        
//         cy.on('pan zoom resize', updates[idx]);

//     });

//     MathJax.typeset();

//     cy.style().selector('edge').css({'content': ''}).update()
//     const time2 = new Date()
//     let time_elapse = (time2 - time1)/1000
//     console.log("editBranch SFG loading time: " + time_elapse + " seconds")
// }


    // --------------------------------------------------------------------------------------------------------------------


    // cy.on('cxttap', 'edge', function(evt) {
    //     var edge = evt.target;
    //     var edgeData = edge.data(); // Get edge data, which includes the value

    //     // print the edge
    //     console.log('editing Edge:', edge);
    //     // print the edge data
    //     console.log('editing Original Edge Data:', edgeData);
    //     // print the latex data
    //     console.log('editing Original Edge Latex:', edgeData.latex);

    //     // Create a custom HTML prompt
    //     // Create a multiline message for the prompt
    //     var message = `Original LaTeX:\n${edgeData.latex}\n\nEnter new LaTeX:`;

    //     // Display prompt with original LaTeX and input field for new LaTeX
    //     var newLatex = prompt(message);

    //     // Check if user entered a new LaTeX content
    //     if (newLatex !== null && newLatex.trim() !== '') {
    //         // Update edge's data with new LaTeX content
    //         edge.data('latex', newLatex);
    //         console.log('Edge LaTeX updated:', newLatex);
    //     }
    // });
// }


function removeLatexCode(latexCode, idx) {
    edge_symbolic_label[idx] = '';
}


// Function to initialize event listeners for edges
function initializeEdgeHover() {
    console.log("********** initializeEdgeHover is called **********")
    let cy = window.cy; // Assuming `cy` is your Cytoscape instance

    // Ensure `cy` is initialized
    if (typeof cy === 'undefined' || cy === null) {
        console.error('Cytoscape instance is not initialized.');
        return;
    }

    // Attach mouseover event listener to edges
    cy.on('mouseover', 'edge', function(event) {
        let edge = event.target;
        let edge_id = edge.id();
        let edge_index = cy.edges().indexOf(edge);
        let edgeData = edge.data();

        // Display edge information in a designated HTML element
        displayEdgeInfo(edgeData, edge_id, edge_index);

        // Show the edge-info box
        // document.getElementById('edge-info').style.display = 'block';

        // Show the edge-info box
        let edgeInfoBox = document.getElementById('edge-info');
        edgeInfoBox.style.display = 'block';
    });

    // Attach mouseout event listener to clear the information
    cy.on('mouseout', 'edge', function(event) {
        clearEdgeInfo();

        // Hide the edge-info box
        // document.getElementById('edge-info').style.display = 'none';

        //  // Hide the edge-info box
        //  let edgeInfoBox = document.getElementById('edge-info');
        //  edgeInfoBox.style.display = 'none';
    });

    // Attach mousemove event listener to update position of edge-info box
    cy.on('mousemove', 'edge', function(event) {
        updateEdgeInfoPosition(event.originalEvent);
    });
}

// Function to display edge information in an HTML element
function displayEdgeInfo(edgeData, edge_id, edge_index) {
    // console.log("********** displayEdgeInfo is called **********")
    let edgeInfoElement = document.getElementById('edge-info');

    // // Clear any existing content and force repaint by removing and re-adding the element
    // edgeInfoElement.style.display = 'none'; // Hide element
    // edgeInfoElement.innerHTML = ''; // Clear content
    // void edgeInfoElement.offsetWidth; // Force repaint
    // edgeInfoElement.style.display = 'block'; // Show element again

    // Clear any existing content and force repaint by removing and re-adding the element
    edgeInfoElement.innerHTML = ''; // Clear content
    if (edgeInfoElement.parentNode) {
        edgeInfoElement.parentNode.removeChild(edgeInfoElement);
        document.body.appendChild(edgeInfoElement);
    }

    if (edgeInfoElement) {
        edgeInfoElement.innerHTML = `
            <strong>Source:</strong> ${edgeData.source} <br>
            <strong>Target:</strong> ${edgeData.target} <br>
            <strong>Weight:</strong> ${edgeData.weight || 'N/A'} <br>
            <strong>Edge Index:</strong> ${edge_index} <br>
            <strong>Edge ID:</strong> ${edge_id} <br>
        `;
    }
}

// Function to clear the edge information display
function clearEdgeInfo() {
    // console.log("********** clearEdgeInfo is called **********");
    let edgeInfoElement = document.getElementById('edge-info');
    // edgeInfoElement.style.display = 'none'; // Hide element
    edgeInfoElement.innerHTML = ''; // Clear content
    // void edgeInfoElement.offsetWidth; // Force repaint
    // edgeInfoElement.style.display = 'block'; // Show element again
    // Hide the edge-info box
    let edgeInfoBox = document.getElementById('edge-info');
    edgeInfoBox.style.display = 'none';
}

// Function to update the position of the edge-info element based on mouse event
function updateEdgeInfoPosition(event) {
    let edgeInfoElement = document.getElementById('edge-info');

    // Set the position of the edge-info element to follow the mouse cursor
    edgeInfoElement.style.left = (event.clientX + 15) + 'px'; // Offset to avoid cursor overlap
    edgeInfoElement.style.top = (event.clientY + 15) + 'px';  // Offset to avoid cursor overlap
}


function removeBranchLikeSimplify() {
    console.log("removeBranch is called");
    let cy = window.cy;
    function edgeTapHandler(evt){
        let edge = evt.target;
        edge.style('display', 'none');

        console.log("requesting branch removal")
        
        // ensure matching content format as in the server side
        // for example: source and target
        let form_data = {}
        form_data.source = edge.data('source'); // Get source node ID
        form_data.target = edge.data('target'); // Get target node ID

        console.log("edge id:", edge.id());
        console.log("edge data:", edge.data());
        console.log("form_data:", form_data);

        // Remove the edge from Cytoscape
        edge.remove();

        // Update the backend with the removed branch
        removeBranchLikeSimplify_request(form_data)

        document.getElementById("rmv-branch-btn").disabled = false;
        console.log('edge (edge id) removed:', edge.id());
        cy.off('tap', 'edge', edgeTapHandler);
        console.log("edge_symbolic_label:", edge_symbolic_label);
        reset_mag_labels();
    }

    // Attach the event listener to edges for click
    cy.on('tap', 'edge', edgeTapHandler);
    document.getElementById("rmv-branch-btn").disabled = true;

    // Update cy style and log loading time
    cy.style().selector('edge').css({ 'content': '' }).update();
    const time2 = new Date();
    let time_elapse = (time2 - time1) / 1000;
    console.log("editBranch SFG loading time: " + time_elapse + " seconds");
}

function removeBranchLikeSimplify_request(params) {
    // ensure url matches with the server route
    let url = new URL(`${baseUrl}/circuits/${circuitId}/remove_branch`);
    console.log("sending PATCH request to:", url);

    fetch(url, {
        // ensure meta instructions match with server
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        mode: 'cors',
        credentials: 'same-origin',
        body: JSON.stringify(params)
    })
    .then(response => {
        // ensure response is in readable JSON format
        console.log("received PATCH response from server");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("data", data);
        if (stack_len == 0) {
            disable_undo_btn(false);
        }
        if (redo_len > 0) {
            redo_len = 0;
            disable_redo_btn(true);
        }
        stack_len = stack_len < 5 ? stack_len + 1 : 5;
        
        console.log("remove_edge_request received data: ", data);

        // Rebuild SFG + params
        update_frontend(data);

        // additional: like the sfg_simplify_request() funciton
        simplify_mode_toggle()
        reset_mag_labels()
    })
    .catch(error => {
        console.log(error)
        // console.error('Error during DELETE request:', error);
        // alert('An error occurred while removing the edge. Please check the server logs.');
    });
}


function getEdgeInfo() {
    console.log("getEdgeInfo is called");
    let cy = window.cy;
    function edgeTapHandler(evt) {
        let edge = evt.target;
        console.log("requesting edge info")
        let form_data = {
            source: edge.data('source'),
            target: edge.data('target')
        };
        console.log("form_data:", form_data);
        getEdgeInfo_request(form_data);

        document.getElementById("edit-branch-btn").disabled = false;
        cy.off('tap', 'edge', edgeTapHandler);
        console.log("edge_symbolic_label:", edge_symbolic_label);
        reset_mag_labels();
    }
    // Attach the event listener to edges for click
    cy.on('tap', 'edge', edgeTapHandler);
    document.getElementById("edit-branch-btn").disabled = true;

    // Update cy style and log loading time
    cy.style().selector('edge').css({ 'content': '' }).update();
    const time2 = new Date();
    let time_elapse = (time2 - time1) / 1000;
    console.log("getEdgeInfo SFG loading time: " + time_elapse + " seconds");
}

function getEdgeInfo_request(params) {
    let url = new URL(`${baseUrl}/circuits/${circuitId}/get_edge_info`)
    url.search = new URLSearchParams(params).toString();
    console.log("sending GET request to:", url.toString());
    fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        mode: 'cors',
        credentials: 'same-origin',
        // body: JSON.stringify(params)
    })
    .then(response => {
        console.log("received GET response from server");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('server\'s response data:', data);
        openEditModal(data);
    })
    .catch(error => {
        console.error('Error during GET request:', error);
        // console.error('Error during DELETE request:', error);
        // alert('An error occurred while removing the edge. Please check the server logs.');
    });
}    

function openEditModal(data) {
    clearEdgeInfo();
    // Get the modal element
    var modal = document.getElementById("edge-edit-modal");

    // Get the form and input elements
    var form = document.getElementById("edge-edit-form");
    var symbolicInput = document.getElementById("symbolic");
    //// Not using the magnitude and phase inputs for now
    // var magnitudeInput = document.getElementById("magnitude");
    // var phaseInput = document.getElementById("phase");
    var magnitudeDisplay = document.getElementById("magnitude-value");
    var phaseDisplay = document.getElementById("phase-value");

    console.log('Data:', data);

    // Populate the input fields with data
    symbolicInput.value = data.data.weight.symbolic;
    // magnitudeInput.value = data.data.weight.magnitude;
    // phaseInput.value = data.data.weight.phase;
    magnitudeDisplay.textContent = data.data.weight.magnitude;
    phaseDisplay.textContent = data.data.weight.phase;

    // Show the modal
    modal.style.display = "block";

    // When the user clicks on <span> (x), close the modal
    var span = document.getElementsByClassName("close")[0];
    span.onclick = function() {
        modal.style.display = "none";
    }

    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // Handle form submission
    form.onsubmit = function(event) {
        event.preventDefault();
        // var updatedData = {
        //     symbolic: symbolicInput.value,
        //     magnitude: parseFloat(magnitudeInput.value),
        //     phase: parseFloat(phaseInput.value)
        // };
        // console.log('Updated data:', updatedData);

        data.data.weight.symbolic = symbolicInput.value;
        // data.data.weight.magnitude = parseFloat(magnitudeInput.value);
        // data.data.weight.phase = parseFloat(phaseInput.value);
        console.log('Updated data:', data);
        
        // Send updated data to the server or handle it
        // TODO
        console.log('----------Next Step: send src, tgt, and new symbolic data to server----------');
        console.log('src:', data.data.source);
        console.log('tgt:', data.data.target);
        console.log('symbolic:', data.data.weight.symbolic);

        new_editBranchLikeSimplify(data.data.source, data.data.target, data.data.weight.symbolic);

        modal.style.display = "none";
    };
}


// Function to validate user input against valid keys
function validateInput(userInput) {
    // console.log("keys: ", keys);
    // console.log("latex_keys: ", latex_keys);
    // userInput = userInput.toLowerCase();
    for (let latex_key of latex_keys) {
        // return false if userinput does not include a valid key or is not an integer
        if (userInput.includes(latex_key) || Number.isInteger(parseInt(userInput))) {
            return true;
        }
    }
    return false;
}

// Function to display popup window for editing LaTeX code
function editLatexCode(latexCode, idx) {
    // Open a prompt dialog with the current LaTeX code
    let userInput = prompt("Edit LaTeX code:", latexCode);
    console.log("Edited latex code:", userInput);
    // check if any element in global keys appear in userInput
    if (userInput === null) {
        console.log("editBranch prompt cancelled");
        return latexCode;
    } else if (validateInput(userInput) && userInput !== null && userInput !== '') {
        console.log('editBranch Input is valid');
        edge_symbolic_label[idx] = userInput;
        return userInput;
    } else {
        console.log('Input is invalid');
        alert('Input is invalid\nPlease enter a valid LaTeX code.\nRefer to the list of valid circuit parameters.');
        return latexCode;
    }
}

function editBranchLikeSimplify() {
    console.log("editBranch is called");
    let cy = window.cy;
    function edgeTapHandler(evt){
        let edge = evt.target;

        console.log("requesting branch edit")

        let form_data = {}
        form_data.source = edge.data('source');
        form_data.target = edge.data('target');
        form_data.symbolic = 1;
        console.log("edge id:", edge.id());
        console.log("edge data:", edge.data());
        console.log("form_data:", form_data);


        update_edge_new(form_data);

        document.getElementById("edit-branch-btn").disabled = false;
        console.log('edge (edge id) removed:', edge.id());
        cy.off('tap', 'edge', edgeTapHandler);
        console.log("edge_symbolic_label:", edge_symbolic_label);
        reset_mag_labels();
    }

    // Attach the event listener to edges for click
    cy.on('tap', 'edge', edgeTapHandler);
    document.getElementById("edit-branch-btn").disabled = true;

    // Update cy style and log loading time
    cy.style().selector('edge').css({ 'content': '' }).update();
    const time2 = new Date();
    let time_elapse = (time2 - time1) / 1000;
    console.log("editBranch SFG loading time: " + time_elapse + " seconds");
}

function new_editBranchLikeSimplify(source, target, symbolic) {
    console.log("---------- new_editBranchLikeSimplify is called");

    let form_data = {}
    form_data.source = source;
    form_data.target = target;
    form_data.symbolic = symbolic;
    console.log("form_data:", form_data);

    update_edge_new(form_data);

    // reset_mag_labels();

    // Update cy style and log loading time
    // cy.style().selector('edge').css({ 'content': '' }).update();
    const time2 = new Date();
    let time_elapse = (time2 - time1) / 1000;
    console.log("editBranch SFG loading time: " + time_elapse + " seconds");
}

// Function to edit the selected branch on the SFG
function editBranch() {
    console.log("editBranch is called");
    let cy = window.cy;
    function edgeTapHandler(evt) {
        // console.log("evt target: ", evt.target)
        // console.log("evt: ", evt)

        console.log("BEFORE EDIT: edge_symbolic_label: ", edge_symbolic_label);


        // Retrieve the LaTeX code for the selected edge
        let edge = evt.target;
        let idx = cy.edges().indexOf(edge);
        let latexCode = edge_symbolic_label[idx];
        console.log("LaTeX code for selected edge:", latexCode);
        console.log("Idx:", idx);

        // print edge input, output, and weight
        console.log("edge source: ", edge.data('source'));
        console.log("edge target: ", edge.data('target'));
        console.log("edge weight: ", edge.data('weight'));
        console.log("edge weight symbolic: ", edge.data('weight_symbolic'))
        console.log("edge id: ", edge.id());
        // print all edge data
        console.log("edge data: ", edge.data());

        // Display popup window for editing LaTeX code
        let modifiedLatexCode = editLatexCode(latexCode, idx);
        document.getElementById("edit-branch-btn").disabled = false;
        // print all edge_symbolic_label
        console.log("AFTER EDIT: edge_symbolic_label: ", edge_symbolic_label);

        // Update the keys on parameters based on the modifiedLatexCode
        

        // sfg_patch_request(idx, latexCode, edge.data('source'), edge.data('target'));

        // most recent edit
        // update_edge(edge.data('source'), edge.data('target'), modifiedLatexCode);

        // try using simplify() method
        let form_data = {}
        form_data.source = edge.data('source');
        form_data.target = edge.data('target');
        update_edge()


        // Check if the user made any modifications
        if (modifiedLatexCode !== null) {
            // Update the LaTeX content of the Edge
            console.log("Modified LaTeX code:", modifiedLatexCode);
            
            // // update the sfg frontend and rerender
            // edge.data('weight', modifiedLatexCode);
            // cy.style().selector('edge').css({ 'content': '' }).update();
            // window.cy.style().selector('edge').css({'content': 'data(weight)'}).update();
            // display_mag_sfg();
            reset_mag_labels();
        }

        // Remove the event listener after it's triggered once
        cy.off('tap', 'edge', edgeTapHandler);
    }

    // Attach the event listener to edges for click
    cy.on('tap', 'edge', edgeTapHandler);
    document.getElementById("edit-branch-btn").disabled = true;

    // Update cy style and log loading time
    cy.style().selector('edge').css({ 'content': '' }).update();
    const time2 = new Date();
    let time_elapse = (time2 - time1) / 1000;
    console.log("editBranch SFG loading time: " + time_elapse + " seconds");
}


function  display_mag_sfg() {
    let cy = window.cy;

    let updates = new Array(cy.edges().length)
    let edges = new Array(cy.edges().length)

    cy.edges().forEach((edge,idx) => {
        
        // print each edge
        // console.log('Edge:', edge);
        // console.log('Edges[idx]: ', edges[idx]);

        edges[idx] = edge.popper({
            content: () => {
            let div = document.createElement('div');

            //div.classList.add('popper-div');
            div.id = 'edge-' + idx;
            div.style.cssText = `font-size:${cy.zoom()*16 + 'px'};font-weight:400;`
            
            div.classList.add('label')
        
            div.innerHTML = '$$' + edge_symbolic_label[idx] + '$$';
            //div.innerHTML = '$$\\frac{y}{2x} + C$$';


        
            //document.getElementById('magnitudes').appendChild(div);
            //document.body.appendChild(div);
            document.getElementsByClassName('sfg-section')[0].appendChild(div);
            return div;
            },
            popper: {
                modifiers: {
                    preventOverflow: {
                        enabled: true,
                        boundariesElement: document.getElementsByClassName('sfg-section')[0],
                        padding: 5
                    },
                    hide:  {
                        enabled: true,
                    }
            }
        }})

        updates[idx] = () => {
            edges[idx].update();
            edge = document.querySelector(`#edge-${idx}`);
            if (edge) {
                edge.style.fontSize = cy.zoom()*16 + 'px';
            }
        }
          
        edge.connectedNodes().on('position', updates[idx]);
        
        cy.on('pan zoom resize', updates[idx]);
    
    });

    if (window.MathJax && typeof MathJax.typeset === 'function') {
        MathJax.typeset();
    }

    cy.style().selector('edge').css({'content': ''}).update()
    applyEdgeLabelVisibility(cy);
    const time2 = new Date()
    let time_elapse = (time2 - time1)/1000
    console.log("display_mag_sfg SFG loading time: " + time_elapse + " seconds")
}

// declare global array of keys
keys = []
latex_keys = []

function convertToLatex(sympyCharacters) {
    console.log("length of sympyCharacters: ", sympyCharacters.length)
    if(sympyCharacters.length == 2){
        // check if the first character is a char and the second is a number
        if(sympyCharacters[0].match(/[a-z]/i) && !isNaN(sympyCharacters[1])){
            // add underscore between the first and second character
            sympyCharacters = sympyCharacters[0] + '_{' + sympyCharacters[1] + '}';
        }
        return sympyCharacters;
    }
    
    
    // Regular expression to match underscores
    const underscoreRegex = /_/g;
    // Convert each sympy character to its LaTeX representation
    // const latexCharacters = sympyCharacters.map(char => char.replace(underscoreRegex, '_{'));
    const latexCharacters = sympyCharacters.replace(underscoreRegex, '_{');
    console.log("latexCharacters: ", latexCharacters);
    return latexCharacters;
}

// input: data.parameters
function make_parameter_panel(parameters) {
    // remove the previous form
    var old_pf = document.getElementById("input-form")
    if (old_pf != null) {
        old_pf.remove()
    }

    var pf = document.createElement("form");
    pf.id = "input-form"

    var br = document.createElement("br");
    var freq = 0
    for (let key in parameters) {
        // console.log("key: " + key + " value: " + parameters[key])
        // keys.push(key)
        // latex_key = convertToLatex(key)
        // latex_keys.push(latex_key)
        // console.log("keys array: " + keys) // iterating
        var parameter = document.createElement("input")
        parameter.type = "number"
        parameter.name = key
        parameter.id = key
        if(key == 'f')
            freq = parameters[key]
        parameter.placeholder = key + ": " + parameters[key].toExponential()
        parameter.step = 0.000000000000001
        
        pf.appendChild(parameter)
        pf.appendChild(br.cloneNode())
    }
    console.log("keys: " + keys) // all final keys
    console.log("latex_keys: " + latex_keys)
    
    var s = document.createElement("input")
    s.setAttribute("type", "submit")
    s.setAttribute("value", "Submit Form")
    pf.appendChild(s)

    console.log("freq: " + freq)
    output.innerHTML = freq
    frequency_slider.value = freq

    //add event listener
    pf.addEventListener("submit", async function (event) {
        event.preventDefault()

        let form_data = {}
        //making input
        console.log("---------- parameters: ", parameters)
        for (let key in parameters) {
            let i = document.querySelector(`#${key}`).value
            console.log("---------- key: " + key + " value: " + i)
            if (i != "") {
                form_data[key] = parseFloat(i)
            }
        }
        console.log("form_data: ", form_data)
        sfg_patch_request(form_data)

    });

    document.getElementById("param-form").appendChild(pf);
}


function sfg_patch_request(params) {

    let fields = "id,name,parameters,sfg,svg"

    let url = new URL(`${baseUrl}/circuits/${circuitId}`)
    url.searchParams.append("fields", fields)

    fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        }, 
        mode: 'cors',
        credentials: 'same-origin',
        body: JSON.stringify(params)
    })
    .then(response => {
        if (!response.ok) {
            // Handle HTTP errors
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        removeHighlight()
        console.log(data)
        update_frontend(data)
    })
    .catch(error => {
        console.error('Error during PATCH request:', error);
        alert('An error occurred while updating the circuit. Please check the server logs.');
    });
}

// Sends a patch request to the backend and updates edge weights
// on the graph without re rendering the entire graph
// same as sfg_patch_request but without update_frontend
function sfg_patch_request_without_rerender(params) {

    let fields = "id,name,parameters,sfg,svg"

    let url = new URL(`${baseUrl}/circuits/${circuitId}`)
    url.searchParams.append("fields", fields)

    fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        mode: 'cors',
        credentials: 'same-origin',
        body: JSON.stringify(params)
    })
    .then(response => response.json())
    .then(data => {
        removeHighlight()
        let cy = window.cy;
        let curr_elements = edge_helper(data, symbolic_flag).edges
        curr_elements.forEach(edge=>{
            let text = 'edge[source = "'
            text = text.concat(edge.data.source)
            text = text.concat('"]')
            text = text.concat('[target = "')
            text = text.concat(edge.data.target)
            text = text.concat('"]')
            value = edge.data.weight
            cy.elements(text).data('weight', value)
        })
    })
    .catch(error => {
        console.log(error)
    })
}

// still need function to collect source and target nodes and send as param to 
// this function
function sfg_simplify_request(params) {

    let url = new URL(`${baseUrl}/circuits/${circuitId}/simplify`);

    fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        }, 
        mode: 'cors',
        credentials: 'same-origin',
        body: JSON.stringify(params)
    })
    .then(response => response.json())
    .then(data => {
        if (stack_len == 0) {
            disable_undo_btn(false);
        }
        if (redo_len > 0) {
            redo_len = 0;
            disable_redo_btn(true);
        }
        stack_len = stack_len < 5 ? stack_len + 1 : 5
        update_frontend(data)
        simplify_mode_toggle()
        reset_mag_labels()
    })
    .catch(error => {
       console.log(error)
    })
}


function load_interface() {

    let fields = "id,name,parameters,sfg,svg"

    var url = new URL(`${baseUrl}/circuits/${circuitId}`)
    url.searchParams.append("fields", fields)

    fetch(url)
        .then(response => {
            return response.json()
        })
        .then(data => {
            render_frontend(data)
        })
        .catch(error => {
            console.log(error)
        })
}

//Initialize frontend DOM tree
function render_frontend(data) {
    let curr_elements = edge_helper(data, symbolic_flag)
    // load SFG panel
    make_sfg(curr_elements)
    // load parameter panel
    make_parameter_panel(data.parameters)
    // load schematic panel
    make_schematics(data)

    // load transfer function
    make_transfer_func_panel()

    // load loop gain
    make_loop_gain_panel()

    // load bode plot
    make_transfer_bode_panel()
    make_loop_gain_bode_panel()

    // load stability plots
    stability_parameter_panel()

    // Frequency bounds form
    make_frequency_bounds()

    // Render the overlay
    renderOverlay(data);
}


// Update SFG and parameter panel
function update_frontend(data) {
    let curr_elements = edge_helper(data, symbolic_flag)
    // load SFG panel
    make_sfg(curr_elements)
    // load parameter panel
    make_parameter_panel(data.parameters)
}


document.addEventListener('DOMContentLoaded', load_interface);


async function sfg_toggle() {
    symbolic_flag = !symbolic_flag
    updateSymbolicUIState();
    try {
        // let url = new URL(`${baseUrl}/circuits/${circuitId}`)
        // const response = await fetch(url)
        // let data = await response.json()

        //remove existing magnitude labels

        const time1 = new Date()


        renderCurrentLabelMode();

        const time2 = new Date()

        let time_elapse = (time2 - time1)/1000
        console.log("SFG loading time (symbolic and magnitude toggle): " + time_elapse + " seconds")
        
        
    } catch {
        alert("error when toggle sfg")
    }
}

let el = document.getElementById("feature-toggle");
if (el) {
    el.addEventListener('click', sfg_toggle)
}

let refresh_button = document.getElementById("refresh-button");
if (refresh_button) {
    refresh_button.addEventListener('click', () => {
        window.location.reload()
    })
}

let return_landing = document.getElementById("return-landing");
if (return_landing) {
    return_landing.addEventListener('click', () => {
        window.location.replace('./landing.html');
    })
}

updateSymbolicUIState();

// HTML Frequency slider element
let frequency_slider = document.getElementById("frequency-slider");

// HTML Element displaying current frequency from slider
var output = document.getElementById("frequency-value");

// Update the display of the frequency value with the current value from the slider
output.innerHTML = frequency_slider.value;

frequency_slider.oninput = function() {
    output.innerHTML = frequency_slider.value;
    let form_data = {}
    form_data['f'] = parseInt(this.value);  // populate form with frequency request
    sfg_patch_request_without_rerender(form_data);      // send patch request to backend,
                                                        // this function receives new values
                                                        // and updates sfg edges
    document.querySelector('input#f').placeholder = 'f' + ": " + expo(this.value,2)
}



//transfer function display helper - load MathJax script
function load_latex() {
    var old_latex = document.getElementById("MathJax-script")
    if (old_latex != null) {
        old_latex.remove()
        console.log("remove old script")
    }

    var head = document.getElementsByTagName("head")[0];
    var latex_script = document.createElement("script");
    latex_script.type = "text/javascript";
    latex_script.id="MathJax-script";
    latex_script.async = true;
    latex_script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js";
    head.appendChild(latex_script);
}

// Auto-fills the transfer function panel when click on desired nodes
function click_node_make_transfer_func_panel() {
    // Track the selected nodes
    let selectedNodes = [];

    // Add click event listener to nodes
    cy.on('click', 'node', function(event) {
        let node = event.target;
        let nodeId = node.id();

        if (selectedNodes.length === 0) {
            // Set the input node
            document.getElementById('input_node').value = nodeId;
            document.getElementById('input_node_bode').value = nodeId;
            selectedNodes.push(nodeId);
        } else if (selectedNodes.length === 1) {
            // Set the output node
            document.getElementById('output_node').value = nodeId;
            document.getElementById('output_node_bode').value = nodeId;
            selectedNodes.push(nodeId);
        } else {
            // Reset the selection if both nodes are already selected
            document.getElementById('input_node').value = '';
            document.getElementById('output_node').value = '';
            document.getElementById('input_node_bode').value = '';
            document.getElementById('output_node_bode').value = '';
            selectedNodes = [];
        }
    });
}


function make_transfer_func_panel() {
    var form = document.createElement("form")
    form.id = "trans-form"

    var br = document.createElement("br");

    var in_node = document.createElement("input")
    in_node.type = "text"
    in_node.name = "input_node"
    in_node.id = "input_node"
    in_node.placeholder = "input node"

    var out_node = document.createElement("input")
    out_node.type = "text"
    out_node.name = "output_node"
    out_node.id = "output_node"
    out_node.placeholder = "output node"

    form.appendChild(in_node)
    form.appendChild(br.cloneNode())
    form.appendChild(out_node)
    form.appendChild(br.cloneNode())

    click_node_make_transfer_func_panel()

    var s = document.createElement("input")
    s.setAttribute("type", "submit")
    s.setAttribute("value", "Submit Form")
    form.appendChild(s)

    form.addEventListener("submit", event => {
        event.preventDefault()

        let input = document.querySelector('#input_node').value
        let output = document.querySelector('#output_node').value

        if (!input || !output) {
            alert("Please fill in all the fields.");
            return;
        }

        const invalidNodes = [input, output].filter(node => !validateNode(node));

        if (invalidNodes.length === 1) {
            alert(`The selected node ${invalidNodes[0]} is not valid.`);
            return;
        } else if (invalidNodes.length === 2) {
            alert(`The selected nodes ${invalidNodes[0]} and ${invalidNodes[1]} are not valid.`);
            return;
        }
    
        make_transfer_func(input, output);
    });

    document.getElementById("transfer-form").appendChild(form);
}

function update_edge_new(params) {
    console.log("********** running update_edge_new **********")
    var url = new URL(`${baseUrl}/circuits/${circuitId}/update_edge_new`);
    // var url = `${baseUrl}/circuits/${circuitId}/update_edge_new`;
    
    console.log("Final URL with parameters:", url.href);
    console.log("sending PATCH request to:", url);

    fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        mode: 'cors',
        credentials: 'same-origin',
        body: JSON.stringify(params)
    })
    .then(response => {
        if (!response.ok) {
            // If response is not ok (i.e., in error status range), reject the promise
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        // If response is ok, return JSON promise
        return response.json();
    })
    .then(data => {
        console.log("success!");
        update_frontend(data);
        reset_mag_labels();
    })
    .catch(error => {
        console.error('update_edge error!:', error);
        console.log('update_edge Full response:', error.response);
    });
}

function update_edge(input_node, output_node, symbolic_value) {
    var url = new URL(`${baseUrl}/circuits/${circuitId}/update_edge`);
    params = {input_node: input_node, output_node: output_node, symbolic_value: symbolic_value}
    console.log("URL before appending parameters:", url.href);
    Object.keys(params).forEach(key => {
        const value = params[key].toString();
        url.searchParams.append(key, value);
    });
    console.log("Final URL with parameters:", url.href);

    fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        mode: 'cors',
        credentials: 'same-origin',
        body: JSON.stringify(params)
    })
    .then(response => {
        if (!response.ok) {
            // If response is not ok (i.e., in error status range), reject the promise
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        // If response is ok, return JSON promise
        return response.json();
    })
    .then(data => {
        console.log("success!");
    })
    .catch(error => {
        console.error('update_edge error!:', error);
        console.log('update_edge Full response:', error.response);
    });
}

async function tf_toggle() {
    console.log("********** running tf_toggle **********")
    console.log("tf_flag: ", tf_flag)
    console.log("input_node: ", tf.input)
    console.log("output_node: ", tf.output)
    if (tf.input && tf.output){
        tf_flag = !tf_flag
        try{
            const time1 = new Date()
            // TODO Mark
            // copy make_transfer_func fetch logic
            let latex_toggle = true
            let factor_toggle = true
            let params = {input_node: tf.input, output_node: tf.output, latex: latex_toggle,
                factor: factor_toggle, numerical: tf_flag}
            var url = new URL(`${baseUrl}/circuits/${circuitId}/transfer_function`)
    
            // print the base url
            console.log('base url for make_transfer_func: ', baseUrl)
    
            // print the created url
            console.log('url: ', url)
            console.log("URL before appending parameters:", url.href);
            Object.keys(params).forEach(key => {
                const value = params[key].toString();
                url.searchParams.append(key, value);
            });
            console.log("Final URL with parameters:", url.href);
            
            fetch(url)
            .then(response => {
                if (!response.ok) {
                    // If response is not ok (i.e., in error status range), reject the promise
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                // If response is ok, return JSON promise
                console.log("make_transfer_func fetch response: ", response)
                return response.json();
            })
            .then(data => {
                console.log("data");
                console.log(data);
                console.log("transfer function data:", data.transfer_function);
                // Handle the JSON data
                var trans = document.getElementById("trans-funtion")
                let latex_trans = "\\(" + data.transfer_function + "\\)"
                trans.innerHTML = latex_trans
                // print trans.innerHTML
                console.log("trans.innerHTML: " + trans.innerHTML)
                // what does trans.innerHTML do?
    
    
                console.log(data)
                //reset MathJax
                MathJax.typeset()
            })
            .catch(error => {
                console.error('make_transfer_func error:', error);
                console.log('make_transfer_func Full response:', error.response);
            });
    
            const time2 = new Date()
            let time_elapse = (time2 - time1)/1000
            console.log("Transfer function tf_toggle time (numeric <-> symbolic): " + time_elapse + " seconds")
        } catch {
            alert("error when toggle transfer function numeric <-> symbolic")
        }
    } else {
        //  uncheck the checkbox
        let tf_toggle_button = document.getElementById("tf-toggle");
        tf_toggle_button.checked = false
        alert("input field incomplete")
    }
}

let tf_toggle_button = document.getElementById("tf-toggle");
if (tf_toggle_button) {
    tf_toggle_button.addEventListener('click', tf_toggle)
}
    
function make_transfer_func(input_node, output_node) {
    console.log("********** runnning make_transfer_func **********")
    let latex_toggle = true
    let factor_toggle = true
    let numerical_toggle = tf_flag
    let params = {input_node: input_node, output_node: output_node, latex: latex_toggle,
        factor: factor_toggle, numerical: numerical_toggle}
    var url = new URL(`${baseUrl}/circuits/${circuitId}/transfer_function`)
    
    tf.input = input_node
    tf.output = output_node
    console.log("tf.input: ", tf.input)
    console.log("tf.output: ", tf.output)

    // print the base url
    console.log('base url for make_transfer_func: ', baseUrl)

    // print the created url
    console.log('url: ', url)
    console.log("URL before appending parameters:", url.href);
    Object.keys(params).forEach(key => {
        const value = params[key].toString();
        url.searchParams.append(key, value);
    });
    console.log("Final URL with parameters:", url.href);
    
    fetch(url)
    .then(response => {
        if (!response.ok) {
            // If response is not ok (i.e., in error status range), reject the promise
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        // If response is ok, return JSON promise
        console.log("make_transfer_func Fetch response: ", response)
        return response.json();
    })
    .then(data => {
        console.log("data");
        console.log(data);
        console.log("transfer function data:", data.transfer_function);
        // Handle the JSON data
        var trans = document.getElementById("trans-funtion")
        let latex_trans = "\\(" + data.transfer_function + "\\)"
        trans.innerHTML = latex_trans
        // print trans.innerHTML
        console.log("trans.innerHTML: " + trans.innerHTML)
        // what does trans.innerHTML do?


        console.log(data)
        //reset MathJax
        MathJax.typeset()
    })
    .catch(error => {
        console.error('make_transfer_func error:', error);
        console.log('make_transfer_func Full response:', error.response);
    });
}


function make_schematics(data) {
    if (data.svg == null) {
        console.log("no SVG available");
    } else {
        var svg_html = document.getElementById("circuit-svg");
        var svg_html_small = document.getElementById("circuit-svg-small");

        svg_html.innerHTML = data.svg;
        svg_html_small.innerHTML = data.svg;

        const svg = document.querySelector("#circuit-svg > svg");

        //Hiding the smaller one that was not rendering correctly
        //Was also not really needed
        svg_html_small.style.display = "none";

        const bbox = svg.getBBox();
        svg.setAttribute("viewBox", (bbox.x - 10) + " " + (bbox.y - 10) + " " + (bbox.width + 20) + " " + (bbox.height + 20));
        svg.setAttribute("style", "border:1px solid black; width: 1000px; height: 500px;"); 
    }
}

function make_frequency_bounds() {
    var form = document.createElement("form")
    form.id = "frequency-bounds-form"

    var min_range = document.getElementById("min-range")
    var max_range = document.getElementById("max-range")
    var update_range = document.getElementById("update-range")
    form.appendChild(min_range)
    form.appendChild(max_range)
    form.appendChild(update_range)

    form.addEventListener("submit", event => {
        event.preventDefault()

        let min = Number(document.querySelector('#min-range').value)
        let max = Number(document.querySelector('#max-range').value)

        if (min >= 0 && max >= 0 && min < max){
            document.getElementById("frequency-slider").min = min
            document.getElementById("frequency-slider").max = max
            document.getElementById('min-range').placeholder=expo(min,2).toString()
            document.getElementById('max-range').placeholder=expo(max,2).toString()
        }
        else {
            alert("input invalid")
        }
    });

    document.getElementById("frequency-form").appendChild(form)
}


function make_transfer_bode_panel() {
    var form = document.createElement("form")
    form.id = "trans-bode-form"

    var br = document.createElement("br");

    let element_list = []
    let element_type_dict = {
        input_node_bode: "text",
        output_node_bode: "text",
        start_freq_hz: "number",
        end_freq_hz: "number",
        points_per_decade: "number",
        // frequency_unit: "text",
        // gain_unit: "text",
        // phase_unit: "text"
    }

    // create input form
    for (key in element_type_dict) {
        var form_child = document.createElement("input")
        form_child.type = element_type_dict[key]
        if (element_type_dict[key] == "number")
            form_child.step = 0.000000000000001
        form_child.name = key
        form_child.id = key
        let new_str = key.replace(/_/g, " ");
        form_child.placeholder = new_str
        element_list.push(form_child)
    }

    let i;
    for (i=0; i < element_list.length; i++) {
        form.appendChild(element_list[i])
        form.appendChild(br.cloneNode())
    }

    var s = document.createElement("input")
    s.setAttribute("type", "submit")
    s.setAttribute("value", "Submit Form")
    form.appendChild(s)

    form.addEventListener("submit", event => {
        event.preventDefault()

        // required fields ["input_node_bode", "output_node_bode", "start_freq", "end_freq", "points_per_decade"]
        let form_list = ["input_node_bode", "output_node_bode", "start_freq_hz", "end_freq_hz", "points_per_decade"]
        // let form_list = ["input_node_bode", "output_node_bode", "start_freq_hz", "end_freq_hz", "points_per_decade", "frequency_unit", "gain_unit", "phase_unit"]
        
        let form_params = {}

        //default values for optional fields
        // form_params["frequency_unit"] = "hz"
        // form_params["gain_unit"] = "db"
        // form_params["phase_unit"] = "deg"

        let i;
        for (i=0; i < form_list.length; i++) {
            let form_entry = form_list[i]
            let input = document.querySelector(`#${form_entry}`).value
            // append key-value pair into dic
            if (form_params[form_entry] && input == "") {
                continue
            }
            else {
                form_params[form_entry] = input
                if ((form_entry != 'input_node_bode') && (form_entry != "output_node_bode")) {
                    form_params[form_entry] = parseFloat(input);
                }
            }
        }

        if(!form_params.input_node_bode || !form_params.output_node_bode || !form_params.start_freq_hz || !form_params.end_freq_hz || !form_params.points_per_decade) {
            alert("Please fill in all the fields.");
            return;
        }

        const invalidNodes = [form_params.input_node_bode, form_params.output_node_bode].filter(node => !validateNode(node));

        if (invalidNodes.length === 1) {
            alert(`The selected node ${invalidNodes[0]} is not valid.`);
            return;
        } else if (invalidNodes.length === 2) {
            alert(`The selected nodes ${invalidNodes[0]} and ${invalidNodes[1]} are not valid.`);
            return;
        }

        // Check if min_val is less than max_val
        if (form_params.start_freq_hz >= form_params.end_freq_hz) {
            alert("Start frequency must be less than end frequency.");
            return;
        }

        fetch_transfer_bode_data(form_params)
        document.getElementById('bode-plot-section').scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById("transfer-func-bode-form").appendChild(form);
}


function fetch_transfer_bode_data(input_params) {
    let new_params = input_params
    new_params["input_node"] = input_params["input_node_bode"]
    new_params["output_node"] = input_params["output_node_bode"]
    delete new_params["input_node_bode"]
    delete new_params["output_node_bode"]
    
    var url = new URL(`${baseUrl}/circuits/${circuitId}/transfer_function/bode`)
    Object.keys(new_params).forEach(key => url.searchParams.append(key, new_params[key]))

    // fetch(url)
    // .then(response => response.json())
    // .then(data => {
    //     make_bode_plots(data, 'transfer-bode-plot')
    // })

    fetch(url)
    .then(response => {
        if (!response.ok) {
            // If response is not ok (i.e., in error status range), reject the promise
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        // If response is ok, return JSON promise
        console.log("fetch_transfer_bode_data fetch OK.")
        return response.json();
    })
    .then(data => {
        // for user: have a button to save bode plat ("data") ==> in an tuple array or stack somewhere
        // the user should be able to click save at any time (many versions of the bode plot "data")
        // also show a new updated bode plot from the most recent "data"
        make_transfer_bode_plots(data, 'transfer-bode-plot')
        create_transfer_overlay_buttons('transfer-bode-plot', 'transfer-bode');
        console.log("trasfer bode plot data:");
        console.log(data);
    })
    .catch(error => {
        console.error('fetch_transfer_bode_data error:', error);
        console.log('fetch_transfer_bode_data Full response:', error.response);
    });



}

function make_transfer_bode_plots(data, dom_element, overlayData = null) {
    let freq_points = [];
    let gain_points = [];
    let phase_points = [];
    let frequency = data["frequency"];
    let gain = data["gain"];
    let phase = data["phase"];

    // Select the appropriate history array
    let historyArray = dom_element === 'transfer-bode-plot' ? transfer_bode_plot_history : loop_gain_bode_plot_history;

    // Check if the incoming data is different from the last entry in the history
    let isDifferent = true;
    if (historyArray.length > 0) {
        let lastData = historyArray[historyArray.length - 1];
        isDifferent = !(_.isEqual(lastData, data));  // Using lodash to compare objects
    }

    // Push data to history only if it's different and not an overlay
    if (isDifferent && overlayData === null) {
        historyArray.push(data);
        console.log(dom_element + " history:", historyArray);
    }

    for (let i = 0; i < frequency.length; i++) {
        freq_points.push(Number.parseFloat(frequency[i].toExponential(0)).toFixed(0));

        gain_points.push({
            x: frequency[i],
            y: gain[i]
        });

        phase_points.push({
            x: frequency[i],
            y: phase[i]
        });
    }

    let datasets = [{
        label: 'Gain plot',
        borderColor: 'rgb(255, 0, 0)',
        backgroundColor: 'rgb(255, 0, 0)',
        fill: false,
        data: gain_points,
        yAxisID: 'y-axis-1',
    }, {
        label: 'Phase plot',
        borderColor: 'rgb(0, 102, 255)',
        backgroundColor: 'rgb(0, 102, 255)',
        fill: false,
        data: phase_points,
        yAxisID: 'y-axis-2'
    }];

    // Add overlay data if provided
    if (overlayData) {
        let overlay_gain_points = [];
        let overlay_phase_points = [];

        for (let i = 0; i < overlayData.frequency.length; i++) {
            overlay_gain_points.push({
                x: overlayData.frequency[i],
                y: overlayData.gain[i]
            });

            overlay_phase_points.push({
                x: overlayData.frequency[i],
                y: overlayData.phase[i]
            });
        }

        datasets.push({
            label: 'Gain overlay',
            borderColor: 'rgba(255, 0, 0, 0.5)',
            backgroundColor: 'rgba(255, 0, 0, 0.5)',
            fill: false,
            data: overlay_gain_points,
            yAxisID: 'y-axis-1',
            borderDash: [5, 5],  // Dotted line
        }, {
            label: 'Phase overlay',
            borderColor: 'rgba(0, 102, 255, 0.5)',
            backgroundColor: 'rgba(0, 102, 255, 0.5)',
            fill: false,
            data: overlay_phase_points,
            yAxisID: 'y-axis-2',
            borderDash: [5, 5],  // Dotted line
        });
    }

    let ctx = document.getElementById(dom_element).getContext('2d');

    // Clear previous plot if it exists
    if (window.transfer_line) {
        window.transfer_line.destroy();
    }

    window.transfer_line = new Chart(ctx, {
        type: 'line',
        data: {
            labels: freq_points,
            datasets: datasets
        },
        options: {
            responsive: true,
            hoverMode: 'index',
            stacked: false,
            title: {
                display: true,
                text: dom_element === 'transfer-bode-plot' ? 'Transfer Function Bode Plot' : 'Loop Gain Bode Plot'
            },
            scales: {
                xAxes: [{
                    afterTickToLabelConversion: function(data){
                        var xLabels = data.ticks;
                        xLabels.forEach((label, i) => {
                            if (i % 10 != 0) {
                                xLabels[i] = '';
                            }
                        });
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'Hz'
                    }
                }],
                yAxes: [{
                    type: 'linear',
                    display: true,
                    position: 'left',
                    id: 'y-axis-1',
                    scaleLabel: {
                        display: true,
                        labelString: 'db'
                    }
                }, {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    id: 'y-axis-2',
                    ticks: {
                        min: -180,
                        max: 180,
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'deg'
                    }
                }]
            }
        }
    });
}

function make_loop_gain_bode_plots(data, dom_element, overlayData = null) {
    let freq_points = [];
    let gain_points = [];
    let phase_points = [];
    let frequency = data["frequency"];
    let gain = data["gain"];
    let phase = data["phase"];

    // Select the appropriate history array
    let historyArray = dom_element === 'transfer-bode-plot' ? transfer_bode_plot_history : loop_gain_bode_plot_history;

    // Check if the incoming data is different from the last entry in the history
    let isDifferent = true;
    if (historyArray.length > 0) {
        let lastData = historyArray[historyArray.length - 1];
        isDifferent = !(_.isEqual(lastData, data));  // Using lodash to compare objects
    }

    // Push data to history only if it's different and not an overlay
    if (isDifferent && overlayData === null) {
        historyArray.push(data);
        console.log(dom_element + " history:", historyArray);
    }

    for (let i = 0; i < frequency.length; i++) {
        freq_points.push(Number.parseFloat(frequency[i].toExponential(0)).toFixed(0));

        gain_points.push({
            x: frequency[i],
            y: gain[i]
        });

        phase_points.push({
            x: frequency[i],
            y: phase[i]
        });
    }

    let datasets = [{
        label: 'Gain plot',
        borderColor: 'rgb(255, 0, 0)',
        backgroundColor: 'rgb(255, 0, 0)',
        fill: false,
        data: gain_points,
        yAxisID: 'y-axis-1',
    }, {
        label: 'Phase plot',
        borderColor: 'rgb(0, 102, 255)',
        backgroundColor: 'rgb(0, 102, 255)',
        fill: false,
        data: phase_points,
        yAxisID: 'y-axis-2'
    }];

    // Add overlay data if provided
    if (overlayData) {
        let overlay_gain_points = [];
        let overlay_phase_points = [];

        for (let i = 0; i < overlayData.frequency.length; i++) {
            overlay_gain_points.push({
                x: overlayData.frequency[i],
                y: overlayData.gain[i]
            });

            overlay_phase_points.push({
                x: overlayData.frequency[i],
                y: overlayData.phase[i]
            });
        }

        datasets.push({
            label: 'Gain overlay',
            borderColor: 'rgba(255, 0, 0, 0.5)',
            backgroundColor: 'rgba(255, 0, 0, 0.5)',
            fill: false,
            data: overlay_gain_points,
            yAxisID: 'y-axis-1',
            borderDash: [5, 5],  // Dotted line
        }, {
            label: 'Phase overlay',
            borderColor: 'rgba(0, 102, 255, 0.5)',
            backgroundColor: 'rgba(0, 102, 255, 0.5)',
            fill: false,
            data: overlay_phase_points,
            yAxisID: 'y-axis-2',
            borderDash: [5, 5],  // Dotted line
        });
    }

    let ctx = document.getElementById(dom_element).getContext('2d');

    // Clear previous plot if it exists
    if (window.loop_gain_line) {
        window.loop_gain_line.destroy();
    }

    window.loop_gain_line = new Chart(ctx, {
        type: 'line',
        data: {
            labels: freq_points,
            datasets: datasets
        },
        options: {
            responsive: true,
            hoverMode: 'index',
            stacked: false,
            title: {
                display: true,
                text: dom_element === 'transfer-bode-plot' ? 'Transfer Function Bode Plot' : 'Loop Gain Bode Plot'
            },
            scales: {
                xAxes: [{
                    afterTickToLabelConversion: function(data){
                        var xLabels = data.ticks;
                        xLabels.forEach((label, i) => {
                            if (i % 10 != 0) {
                                xLabels[i] = '';
                            }
                        });
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'Hz'
                    }
                }],
                yAxes: [{
                    type: 'linear',
                    display: true,
                    position: 'left',
                    id: 'y-axis-1',
                    scaleLabel: {
                        display: true,
                        labelString: 'db'
                    }
                }, {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    id: 'y-axis-2',
                    ticks: {
                        min: -180,
                        max: 180,
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'deg'
                    }
                }]
            }
        }
    });
}


function mid_make_bode_plots(data, dom_element, overlayData = null) {
    let freq_points = []
    let gain_points = [];
    let phase_points = [];
    let frequency = data["frequency"]
    let gain = data["gain"]
    let phase = data["phase"]

    // save data to global variable to keep track of history
    if (dom_element === 'transfer-bode-plot') {
        transfer_bode_plot_history.push(data)
        console.log("transfer_bode_plot_history: ", transfer_bode_plot_history)
    } else if (dom_element === 'loop-gain-bode-plot') {
        loop_gain_bode_plot_history.push(data)
        console.log("loop_gain_bode_plot_history: ", loop_gain_bode_plot_history)
    }

    for (let i = 0; i < frequency.length; i++) {
        freq_points.push(Number.parseFloat(frequency[i].toExponential(0)).toFixed(0))

        gain_points.push({
            x: frequency[i],
            y: gain[i]
        });

        phase_points.push({
            x: frequency[i],
            y: phase[i]
        });
    }

    let datasets = [{
        label: 'Gain plot',
        borderColor: 'rgb(255, 0, 0)',
        backgroundColor: 'rgb(255, 0, 0)',
        fill: false,
        data: gain_points,
        yAxisID: 'y-axis-1',
    }, {
        label: 'Phase plot',
        borderColor: 'rgb(0, 102, 255)',
        backgroundColor: 'rgb(0, 102, 255)',
        fill: false,
        data: phase_points,
        yAxisID: 'y-axis-2'
    }];

    // Add overlay data if provided
    if (overlayData) {
        console.log("********** overlayData **********")
        let overlay_freq_points = [];
        let overlay_gain_points = [];
        let overlay_phase_points = [];

        for (let i = 0; i < overlayData.frequency.length; i++) {
            overlay_freq_points.push(Number.parseFloat(overlayData.frequency[i].toExponential(0)).toFixed(0))

            overlay_gain_points.push({
                x: overlayData.frequency[i],
                y: overlayData.gain[i]
            });

            overlay_phase_points.push({
                x: overlayData.frequency[i],
                y: overlayData.phase[i]
            });
        }

        datasets.push({
            label: 'New Gain Overlay',
            borderColor: 'rgba(255, 0, 0, 0.5)',
            backgroundColor: 'rgba(255, 0, 0, 0.5)',
            fill: false,
            data: overlay_gain_points,
            yAxisID: 'y-axis-1',
            borderDash: [5, 5],  // Dotted line
        }, {
            label: 'New Phase Overlay',
            borderColor: 'rgba(0, 102, 255, 0.5)',
            backgroundColor: 'rgba(0, 102, 255, 0.5)',
            fill: false,
            data: overlay_phase_points,
            yAxisID: 'y-axis-2',
            borderDash: [5, 5],  // Dotted line
        });
    }

    let ctx = document.getElementById(dom_element).getContext('2d');
    window.myLine = new Chart(ctx, {
        type: 'line',
        data: {
            labels: freq_points,
            datasets: datasets
        },
        options: {
            responsive: true,
            hoverMode: 'index',
            stacked: false,
            title: {
                display: true,
                text: dom_element === 'transfer-bode-plot' ? 'Transfer Function Bode Plot' : 'Loop Gain Bode Plot'
            },
            scales: {
                xAxes: [{
                    afterTickToLabelConversion: function(data){
                        var xLabels = data.ticks;
                        xLabels.forEach((label, i) => {
                            if (i % 10 != 0) {
                                xLabels[i] = '';
                            }
                        });
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'Hz'
                    }
                }],
                yAxes: [{
                    type: 'linear',
                    display: true,
                    position: 'left',
                    id: 'y-axis-1',
                    scaleLabel: {
                        display: true,
                        labelString: 'db'
                    }
                }, {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    id: 'y-axis-2',
                    ticks: {
                        min: -180,
                        max: 180,
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'deg'
                    }
                }]
            }
        }
    });
    // Call this function after the first plot is made
    // if (transfer_bode_plot_history.length > 1) {
    //     createOverlayButtons('transfer-bode-plot', 'transfer-bode');
    // }
    // if (loop_gain_bode_plot_history.length > 1) {
    //     createOverlayButtons('loop-gain-bode-plot', 'loop-gain-bode');
    // }
}

function create_transfer_overlay_buttons (dom_element, targetDivId) {
    console.log("********** running createOverlayButtons **********");
    let historyArray = dom_element === 'transfer-bode-plot' ? transfer_bode_plot_history : loop_gain_bode_plot_history;
    console.log("historyArray: ", historyArray);

    // Check if the buttonContainer already exists
    let targetDiv = document.getElementById(targetDivId);
    let buttonContainer = document.getElementById(`${dom_element}-overlay-buttons`);
    let clear_button = document.createElement('button');
    clear_button.textContent = `Clear History`;
    clear_button.onclick = function() {
        historyArray.length = 0;
        let ctx = document.getElementById(dom_element).getContext('2d');
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        buttonContainer.innerHTML = '';  // Clear the button container
    }
    

    if (!buttonContainer) {
        // Create a new buttonContainer if it doesn't exist
        buttonContainer = document.createElement('div');
        buttonContainer.id = `${dom_element}-overlay-buttons`;

        if (targetDiv) {
            targetDiv.appendChild(buttonContainer);  // Append to the specified target div
        } else {
            console.error(`Target div with id ${targetDivId} not found.`);
            return;
        }
    }

    // Clear existing buttons to avoid duplicates
    buttonContainer.innerHTML = '';

    buttonContainer.appendChild(clear_button);
    
    // Add buttons for each plot in history
    historyArray.forEach((data, index) => {
        let button = document.createElement('button');
        button.textContent = `Overlay Plot ${index}`;
        button.onclick = function() {
            let overlayData = historyArray[index];
            make_transfer_bode_plots(historyArray[0], dom_element, overlayData);  // Overlay selected plot over the original (index 0)
        };
        buttonContainer.appendChild(button);
    });
}

function create_loop_gain_overlay_buttons(dom_element, targetDivId) {
    console.log("********** running createOverlayButtons **********");
    let historyArray = dom_element === 'transfer-bode-plot' ? transfer_bode_plot_history : loop_gain_bode_plot_history;
    console.log("historyArray: ", historyArray);

    // Check if the buttonContainer already exists
    let targetDiv = document.getElementById(targetDivId);
    let buttonContainer = document.getElementById(`${dom_element}-overlay-buttons`);
    let clear_button = document.createElement('button');
    clear_button.textContent = `Clear History`;
    clear_button.onclick = function() {
        historyArray.length = 0;
        let ctx = document.getElementById(dom_element).getContext('2d');
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        buttonContainer.innerHTML = '';  // Clear the button container
    }
    

    if (!buttonContainer) {
        // Create a new buttonContainer if it doesn't exist
        buttonContainer = document.createElement('div');
        buttonContainer.id = `${dom_element}-overlay-buttons`;

        if (targetDiv) {
            targetDiv.appendChild(buttonContainer);  // Append to the specified target div
        } else {
            console.error(`Target div with id ${targetDivId} not found.`);
            return;
        }
    }

    // Clear existing buttons to avoid duplicates
    buttonContainer.innerHTML = '';

    buttonContainer.appendChild(clear_button);
    
    // Add buttons for each plot in history
    historyArray.forEach((data, index) => {
        let button = document.createElement('button');
        button.textContent = `Overlay Plot ${index}`;
        button.onclick = function() {
            let overlayData = historyArray[index];
            make_loop_gain_bode_plots(historyArray[0], dom_element, overlayData);  // Overlay selected plot over the original (index 0)
        };
        buttonContainer.appendChild(button);
    });
}

function old_createOverlayButtons(dom_element, targetDivId) {
    console.log("********** running createOverlayButtons **********")
    let historyArray = dom_element === 'transfer-bode-plot' ? transfer_bode_plot_history : loop_gain_bode_plot_history;
    console.log("historyArray: ", historyArray)

    let buttonContainer = document.createElement('div');
    buttonContainer.id = `${dom_element}-overlay-buttons`;

    historyArray.forEach((data, index) => {
        let button = document.createElement('button');
        button.textContent = `Overlay Plot ${index}`;
        button.onclick = function() {
            let overlayData = historyArray[index];
            make_bode_plots(historyArray[0], dom_element, overlayData);  // Overlay selected plot over the original (index 0)
        };
        buttonContainer.appendChild(button);
    });

    // document.body.appendChild(buttonContainer);  // Add the button container to the body (or any other desired location)
    let targetDiv = document.getElementById(targetDivId);
    if (targetDiv) {
        targetDiv.appendChild(buttonContainer);  // Append buttons to the specified target div
    } else {
        console.error(`Target div with id ${targetDivId} not found.`);
    }
}

function old_make_bode_plots(data, dom_element) {
    let freq_points = []
    let gain_points = [];
    let phase_points = [];
    let frequency = data["frequency"]
    let gain = data["gain"]
    let phase = data["phase"]

    // save data to global variable to keep track of history
    if (dom_element === 'transfer-bode-plot') {
        transfer_bode_plot_history.push(data)
        console.log("transfer_bode_plot_history: ", transfer_bode_plot_history)
    } else if (dom_element === 'loop-gain-bode-plot') {
        loop_gain_bode_plot_history.push(data)
        console.log("loop_gain_bode_plot_history: ", loop_gain_bode_plot_history)
    }
    // bode_plot_history.push(data)
    // console.log("bode_plot_history: ", bode_plot_history)

    let i;
    for (i=0; i < frequency.length; i++) {
        freq_points.push(Number.parseFloat(frequency[i].toExponential(0)).toFixed(0))
 
        let gain_pair = {
            x: frequency[i],
            y: gain[i]
        }
        gain_points.push(gain_pair)

        let phase_pair = {
            x: frequency[i],
            y: phase[i]
        }
        phase_points.push(phase_pair)
    }  

    // console.log(freq_points)
    // console.log(gain_points)
    // console.log(phase_points)

    xs = freq_points

    var lineChartData = {
        labels: xs,
        datasets: [{
            label: 'Gain plot',
            borderColor: 'rgb(255, 0, 0)',
            backgroundColor: 'rgb(255, 0, 0)',
            fill: false,
            data: gain_points,
            yAxisID: 'y-axis-1',
        }, {
            label: 'Phase plot',
            borderColor: 'rgb(0, 102, 255)',
            backgroundColor: 'rgb(0, 102, 255)',
            fill: false,
            data: phase_points,
            yAxisID: 'y-axis-2'
        }]
    };

    let graph_label
    if (dom_element === 'transfer-bode-plot') {
        graph_label = 'Transfer Function Bode Plot'
    } 
    else if (dom_element === 'loop-gain-bode-plot') {
        graph_label = 'Loop Gain Bode Plot'
    }

    var ctx = document.getElementById(dom_element).getContext('2d');
    window.myLine = Chart.Line(ctx, {
        data: lineChartData,
        options: {
            responsive: true,
            hoverMode: 'index',
            stacked: false,
            title: {
                display: true,
                text: graph_label
            },
            scales: {
                xAxes: [{
      
                    afterTickToLabelConversion: function(data){
                        var xLabels = data.ticks;
                        
                        xLabels.forEach((labels, i) => {
                            if (i % 10 != 0) {
                                xLabels[i] = '';
                            }
                        });

                    },             
                    scaleLabel: {
                        display: true,
                        labelString: 'Hz'
                    }
                }],
                yAxes: [{
                    type: 'linear', 
                    display: true,
                    position: 'left',
                    id: 'y-axis-1',
                    scaleLabel: {
                        display: true,
                        labelString: 'db'
                    }
                }, {
                    type: 'linear', 
                    display: true,
                    position: 'right',
                    id: 'y-axis-2',
                    ticks: {
                        min: -180,
                        max: 180,
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'deg'
                    },
                    stepSize: 1
                }],
            }
        }
    });
}

async function lg_toggle() {
    console.log("********** running lg_toggle **********")
    lg_flag = !lg_flag
    console.log("lg_flag: ", lg_flag)
    try {
        const time1 = new Date()
        // TODO Mark
        // copy make_loop_gain fetch logic
        let latex_toggle = true
        let factor_toggle = true
        let params = {latex: latex_toggle, factor: factor_toggle, numerical: lg_flag}
        var url = new URL(`${baseUrl}/circuits/${circuitId}/loop_gain`)

        // print the base url
        console.log('base url for make_loop_gain: ', baseUrl)

        // print the created url
        console.log('url: ', url)
        console.log("URL before appending parameters:", url.href);
        Object.keys(params).forEach(key => {
            const value = params[key].toString();
            url.searchParams.append(key, value);
        });
        console.log("Final URL with parameters:", url.href);
        
        fetch(url)
        .then(response => {
            if (!response.ok) {
                // If response is not ok (i.e., in error status range), reject the promise
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            // If response is ok, return JSON promise
            console.log("make_loop_gain fetch response: ", response)
            return response.json();
        })
        .then(data => {
            console.log("data");
            console.log(data);
            console.log("loop gain data:", data.loop_gain);
            var loop_gain = document.getElementById("loop-gain")
            let latex_loop_gain = "\\(" + data.loop_gain + "\\)"
            loop_gain.innerHTML = latex_loop_gain
            
            console.log(data)
            //reset MathJax
            MathJax.typeset()
        })
        .catch(error => {
            console.error('make_loop_gain Fetch error:', error);
            console.log('make_loop_gain Full response:', error.response);
        });

        const time2 = new Date()
        let time_elapse = (time2 - time1)/1000
        console.log("Loop gain lg_toggle time (numeric <-> symbolic): " + time_elapse + " seconds")
    } catch {
        alert("error when toggle loop gain numeric <-> symbolic")
    }
}

let lg_toggle_button = document.getElementById("lg-toggle");
if (lg_toggle_button) {
    lg_toggle_button.addEventListener('click', lg_toggle)
}

function make_loop_gain() {
    console.log("********** runnning make_loop_gain **********")
    let latex_toggle = true
    let factor_toggle = true
    let numerical_toggle = lg_flag
    let params = {latex: latex_toggle, factor: factor_toggle, numerical: numerical_toggle}
    var url = new URL(`${baseUrl}/circuits/${circuitId}/loop_gain`)

    // print the base url
    console.log("base url for make_loop_gain:", baseUrl);

    // print out the created url
    console.log("url:", url)
    console.log("URL before appending parameters:", url.href);
    Object.keys(params).forEach(key => {
        const value = params[key].toString();
        url.searchParams.append(key, value);
    });
    console.log("Final URL with parameters:", url.href);
    fetch(url)
    .then(response => {
        if (!response.ok) {
            // If response is not ok (i.e., in error status range), reject the promise
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        console.log("make_loop_gain Fetch response:", response);
        // If response is ok, return the JSON promise
        return response.json();
    })
    .then(data => {
        console.log("data");
        console.log(data);
        console.log("loop gain data:", data.loop_gain);
        var loop_gain = document.getElementById("loop-gain")
        let latex_loop_gain = "\\(" + data.loop_gain + "\\)"
        loop_gain.innerHTML = latex_loop_gain
        console.log("loop_gain.innerHTML:", loop_gain.innerHTML)
        console.log(data)
        //reset MathJax
        MathJax.typeset()
    })
    .catch(error => {
        // Handle errors
        console.error('make_loop_gain Fetch error:', error);
        console.log('make_loop_gain Full response:', error.response);
    });
}


function make_loop_gain_panel() {
    var form = document.createElement("form")
    form.id = "lg-form"

    var s = document.createElement("input")
    s.setAttribute("type", "submit")
    s.setAttribute("value", "Display loop gain")
    form.appendChild(s)

    form.addEventListener("submit", event => {
        event.preventDefault()

        make_loop_gain()
       
    });

    document.getElementById("loop-gain-form").appendChild(form);
}

function make_loop_gain_bode_panel() {
    let form = document.createElement("form")
    form.id = "lg-bode-form"

    var br = document.createElement("br");

    let element_list = []
    let element_type_dict = {
        start_freq_hz_lg: "number",
        end_freq_hz_lg: "number",
        points_per_decade_lg: "number",
        // frequency_unit_lg: "text",
        // gain_unit_lg: "text",
        // phase_unit_lg: "text"
    }

    for (key in element_type_dict) {
        var form_child = document.createElement("input")
        form_child.type = element_type_dict[key]
        if (element_type_dict[key] == "number")
            form_child.step = 0.000000000000001
        form_child.name = key
        form_child.id = key
        let new_str = key.replace(/_/g, " ");
        form_child.placeholder = new_str
        element_list.push(form_child)
    }

    let i;
    for (i=0; i < element_list.length; i++) {
        form.appendChild(element_list[i])
        form.appendChild(br.cloneNode())
    }

    var s = document.createElement("input")
    s.setAttribute("type", "submit")
    s.setAttribute("value", "Submit Form")
    form.appendChild(s)

    form.addEventListener("submit", event => {
        event.preventDefault()

        // required fields ["start_freq", "end_freq", "points_per_decade"]
        let form_list = ["start_freq_hz", "end_freq_hz", "points_per_decade"]
        // let form_list = ["start_freq", "end_freq", "points_per_decade", "frequency_unit", "gain_unit", "phase_unit"]
    
        let form_params = {}

        //default values for optional fields
        // form_params["frequency_unit"] = "hz"
        // form_params["gain_unit"] = "db"
        // form_params["phase_unit"] = "deg"

        let i;
        for (i=0; i < form_list.length; i++) {
            // lg stands for loop gain, subject to change
            let form_entry = form_list[i] + "_lg"
            let input = document.querySelector(`#${form_entry}`).value
            // append key-value pair into dic
            if (form_params[form_list[i]] && input == "") {
                continue
            }
            else {
                form_params[form_list[i]] = input
            }
        }

        if(!form_params.start_freq_hz || !form_params.end_freq_hz || !form_params.points_per_decade) {
            alert("Please fill in all the fields.");
            return;
        }

        // Check if min_val is less than max_val
        if (form_params.end_freq_hz >= form_params.start_freq_hz) {
            alert("Start frequency must be less than end frequency.");
            return;
        }

        fetch_loop_gain_bode_data(form_params)
        document.getElementById('loop-gain-bode-plot').scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById("loop-gain-bode-form").appendChild(form);
}


function fetch_loop_gain_bode_data(input_params) {
    var url = new URL(`${baseUrl}/circuits/${circuitId}/loop_gain/bode`)
    Object.keys(input_params).forEach(key => url.searchParams.append(key, parseFloat(input_params[key])))

    // fetch(url)
    // .then(response => response.json())
    // .then(data => {
    //     make_bode_plots(data, 'loop-gain-bode-plot')
    // })

    fetch(url)
    .then(response => {
        if (!response.ok) {
            // If response is not ok (i.e., in error status range), reject the promise
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        // If response is ok, return JSON promise
        console.log("fetch_loop_gain_bode_data OK.")
        return response.json();
    })
    .then(data => {
        make_loop_gain_bode_plots(data, 'loop-gain-bode-plot')
        create_loop_gain_overlay_buttons('loop-gain-bode-plot', 'loop-gain-bode');
        console.log("loop gain bode plot data:");
        console.log(data);
    })
    // .catch(error => {
    //     console.error('fetch_loop_gain_bode_data error:', error);
    //     console.log('fetch_loop_gain_bode_data Full response:', error.response);
    // });
}

function path_highlight_toggle() {
    highlight_mode = !highlight_mode;
    if(!highlight_mode){
        removeHighlight()
        document.getElementById('simplification-toggle').checked = false;
        document.getElementById('simplification-toggle').disabled = false;
    }else{
        node1 = null
        node2 = null
        document.getElementById('simplification-toggle').disabled = true;
    }
}

function simplify_mode_toggle() {
    simplify_btn = document.getElementById('simplify-btn');
    simplify_mode = !simplify_mode;
    

    if(!simplify_mode){
        
        if(node1){
            cy.$('#'+node1.id()).css({'background-color': ''});
            node1 = null;
        }
        if(node2){
            cy.$('#'+node2.id()).css({'background-color': ''});
            node2 = null;
        }
        cy.style().selector(':selected').css({'background-color': '#0069d9'}).update();
        simplify_btn.style.display = 'none';
        document.getElementById('simplification-toggle').checked = false;
        document.getElementById('path-highlight-toggle').disabled = false;
        document.getElementById('rmv-hlt-btn').disabled = false;
    }
    else {
        removeHighlight()
        document.getElementById('path-highlight-toggle').checked = false;
        document.getElementById('path-highlight-toggle').disabled = true;
        document.getElementById('rmv-hlt-btn').disabled = true;

        cy.style().selector(':selected').css({'background-color': '#999999'}).update();
        simplify_btn.style.display = 'inline-block';
        document.getElementById('simplification-toggle').checked = true;
    }
}

function simplify()
{
    if(node1 === null || node2 === null){
        alert('Please select 2 nodes');
        return;
    }

    //find path between the selected nodes
    let aStar = cy.elements().aStar({ root: '#'+node1.id(), goal: '#'+node2.id() , directed: true});

    //check if a path exists
    if(!aStar.path){
        alert('There is no path between the selected nodes');
    }
    //check if the smallest possible path is larger than 2
    else if(aStar.path.edges().length > 2){
        alert('Your path is too long. Pick a path with only 2 edges');
    }
    else {
        console.log("requesting simplification")
        let form_data = {}
        form_data.source = node1.id()
        form_data.target = node2.id()
        sfg_simplify_request(form_data)
    }
}

// This function simplifies the entire graph 
// Removing dead branches and removing unecessary branches if needed 
function sfg_simplification_entire_graph(params) {
    const url = new URL(`${baseUrl}/circuits/${circuitId}/simplification`);

    fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        if (stack_len === 0) {
            disable_undo_btn(false);
        }
        if (redo_len > 0) {
            redo_len = 0;
            disable_redo_btn(true);
        }
        stack_len = Math.min(stack_len + 1, 5);
        update_frontend(data);
        simplify_mode_toggle();
        reset_mag_labels();
    })
    .catch(error => {
        console.error('Error during SFG simplification:', error);
        alert('There was an error simplifying the graph. Please try again.');
    });
}



function simplify_entire_graph() 
{
    console.log("Requesting entire graph simplification");
    
    // Optional: Set up any parameters you want to pass.
    let params = {}; // Add any needed parameters here
    
    // Call the simplification request function
    sfg_simplification_entire_graph(params);
}


// This function simplifies the entire graph 
// Removing dead branches and removing unecessary branches if needed 
function sfg_simplification_entire_graph_trivial(params) {
    const url = new URL(`${baseUrl}/circuits/${circuitId}/simplificationgraph`);

    fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        if (stack_len === 0) {
            disable_undo_btn(false);
        }
        if (redo_len > 0) {
            redo_len = 0;
            disable_redo_btn(true);
        }
        stack_len = Math.min(stack_len + 1, 5);

        // Rebuild SFG
        update_frontend(data);
        simplify_mode_toggle();
        reset_mag_labels();
    })
    .catch(error => {
        console.error('Error during SFG simplification:', error);
        alert('There was an error simplifying the graph. Please try again.');
    });
}



function simplify_entire_graph_trivial() 
{
    console.log("Requesting entire graph simplification");
    
    // Optional: Set up any parameters you want to pass.
    let params = {}; // Add any needed parameters here
    
    // Call the simplification request function
    sfg_simplification_entire_graph_trivial(params);
}


function sfg_undo_request(params) {

    let url = new URL(`${baseUrl}/circuits/${circuitId}/undo`)

    fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        }, 
        mode: 'cors',
        credentials: 'same-origin',
        body: JSON.stringify(params)
    })
    .then(response => response.json())
    .then(data => {
        stack_len--;
        redo_len++;
        if (stack_len === 0) {
            disable_undo_btn(true);
        }
        if (redo_len > 0) {
            disable_redo_btn(false);
        }
        update_frontend(data);
        reset_mag_labels();
        console.log(stack_len);
        console.log(redo_len);
    })
    .catch(error => {
        console.log(error)
    })
}

function sfg_redo_request(params) {

    let url = new URL(`${baseUrl}/circuits/${circuitId}/redo`)

    fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        }, 
        mode: 'cors',
        credentials: 'same-origin',
        body: JSON.stringify(params)
    })
    .then(response => response.json())
    .then(data => {
        stack_len++;
        redo_len--;
        if (redo_len === 0) {
            disable_redo_btn(true);
        }
        if (stack_len > 0) {
            disable_undo_btn(false);
        }
        update_frontend(data);
        reset_mag_labels();
        console.log(stack_len);
        console.log(redo_len);
    })
    .catch(error => {
        console.log(error)
    })
}

function sfg_undo(){
    if (stack_len > 0){
        sfg_undo_request();
    }
    else {
        disable_undo_btn(true);
    }
}

function sfg_redo(){
    if (redo_len > 0){
        sfg_redo_request();
    }
    else {
        disable_redo_btn(true);
    }
}


function reset_mag_labels(){
    if(symbolic_flag) {
        renderSymbolicLabels();
    }
}

function export_sfg(){
    export_sfg_request();
}

function export_sfg_request() {
    // get current deserialized (non binary) sfg, and export as json

    let url = new URL(`${baseUrl}/circuits/${circuitId}/export`)
    console.log(url)
    fetch(url, {
        method: "get",
        mode: "no-cors",

    })
        .then(response => {
            return response.blob();
        })
        .then(blob => {
            console.log("EXported json obj is: ", blob);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${circuitId}-export.pkl`;
            a.click();
            URL.revokeObjectURL(url);
        })
        .catch(error => {
            console.log('File Download Failed', error)
        })

}

// Function to download data to a file
function download(data, filename, type) {
    var file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);   
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    }
}


function upload_sfg() {
    // TODO add error checking (i.e. is file in correct json format)
    var files = document.getElementById('upload_sfg').files;
    console.log(files);
    if (files.length <= 0) {
        return false;
    }

    var fr = new FileReader();
    var sfg_obj;
    fr.onload = function(e) { 
        console.log(e);
        sfg_obj = JSON.parse(e.target.result);
        // TODO alert() here
        //var res_str = JSON.stringify(result, null, 2);
        console.log("IMPORTED json obj is: ", sfg_obj)
        //console.log(JSON.parse(JSON.stringify(sfg_obj.sfg.elements)))
        // TODO connect to backend to convert sfg JSON to sfg graph and binary field
        import_sfg_request(sfg_obj)
        console.log(sessionStorage.getItem('circuitId'))
    }

    fr.readAsText(files.item(0));
}

function import_sfg_request(sfg_obj) {

    let url = new URL(`${baseUrl}/circuits/${circuitId}/import`)

    fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        }, 
        mode: 'cors',
        credentials: 'same-origin',
        body: JSON.stringify(sfg_obj)
    })
    .then(response => response.json())
    .then(data => {
        update_frontend(sfg_obj, true);
    })
    .catch(error => {
        console.log(error)
    })
}

function upload_dill_sfg() {
    // TODO add error checking (i.e. is file in correct json format)
    var files = document.getElementById('upload_sfg').files;
    console.log(files);
    if (files.length <= 0) {
        return false;
    }
    var dill_sfg = files[0];
    console.log(dill_sfg);
    var fr = new FileReader();
    var sfg_obj;
    fr.onload = function(e) { 
        console.log("IMPORTED dill obj is: ", dill_sfg)
        //console.log(JSON.parse(JSON.stringify(sfg_obj.sfg.elements)))
        // TODO connect to backend to convert sfg JSON to sfg graph and binary field
        import_dill_sfg(dill_sfg)
    }

    fr.readAsText(files.item(0));
}

function import_dill_sfg(dill_sfg) {
    let url = new URL(`${baseUrl}/circuits/${circuitId}/import`)
    console.log(circuitId)
    var formData = new FormData();
    formData.append("file", dill_sfg);

    fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        // TODO update_frontend(data);
        //or update_frontend(sfg_obj, true); ?
       
        
        data_json = JSON.parse(JSON.stringify(data));
        // data_json.sfg = sfg_obj;
        
        console.log("modified data is: ");
        console.log(data_json);
        update_frontend(data_json); //buggy
        
    
        // update_frontend(sfg_obj, true);
    })
    .catch(error => {
        console.log(error)
    })}

function stability_parameter_panel() {

    var form = document.createElement("form");
    form.id = "stability-param-form-fields";

    var br = document.createElement("br");

    // Input for selected capacitor
    var inputNode = document.createElement("input");
    inputNode.type = "text";
    inputNode.name = "input_node";
    inputNode.id = "input_node";
    inputNode.placeholder = "input node";
    form.appendChild(inputNode);
    form.appendChild(br.cloneNode());

    // Input for selected capacitor
    var outputNode = document.createElement("input");
    outputNode.type = "text";
    outputNode.name = "output_node";
    outputNode.id = "output_node";
    outputNode.placeholder = "output node";
    form.appendChild(outputNode);
    form.appendChild(br.cloneNode());

    // Input for selected device
    var selectedDevice = document.createElement("input");
    selectedDevice.type = "text";
    selectedDevice.name = "selected_device";
    selectedDevice.id = "selected_device";
    selectedDevice.placeholder = "Selected device";
    form.appendChild(selectedDevice);
    form.appendChild(br.cloneNode());

    // Input for minimum value
    var minVal = document.createElement("input");
    minVal.type = "number";
    minVal.name = "min_value";
    minVal.id = "min_value";
    minVal.placeholder = "Min value";
    form.appendChild(minVal);
    form.appendChild(br.cloneNode());

    // Input for maximum value
    var maxVal = document.createElement("input");
    maxVal.type = "number";
    maxVal.name = "max_value";
    maxVal.id = "max_value";
    maxVal.placeholder = "Max value";
    form.appendChild(maxVal);
    form.appendChild(br.cloneNode());

    // Input for step size
    var stepSize = document.createElement("input");
    stepSize.type = "number";
    stepSize.name = "step_size";
    stepSize.id = "step_size";
    stepSize.placeholder = "Step size";
    form.appendChild(stepSize);
    form.appendChild(br.cloneNode());

    // Submit button
    var submitButton = document.createElement("input");
    submitButton.type = "submit";
    submitButton.value = "Submit Form";
    form.appendChild(submitButton);

    // Event listener for the form submission
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Collect form data
        let form_params = {
            'input_node': inputNode.value,
            'output_node': outputNode.value,
            'selected_device': selectedDevice.value,
            'min_val': Number(minVal.value),
            'max_val': Number(maxVal.value),
            'step_size': Number(stepSize.value)
        };

        // Check for empty fields
        if (!form_params.input_node || !form_params.output_node || !form_params.selected_device || isNaN(form_params.min_val) || isNaN(form_params.max_val) || isNaN(form_params.step_size)) {
            alert("Please fill in all the fields.");
            return;
        }

        const invalidNodes = [form_params.input_node, form_params.output_node].filter(node => !validateNode(node));

        if (invalidNodes.length === 1) {
            alert(`The selected node ${invalidNodes[0]} is not valid.`);
            return;
        } else if (invalidNodes.length === 2) {
            alert(`The selected nodes ${invalidNodes[0]} and ${invalidNodes[1]} are not valid.`);
            return;
        }

        // Validate device existence
        const deviceExists = await check_if_device_exists(form_params.selected_device);
        if (!deviceExists) {
            alert(`The selected device ${form_params.selected_device} is not valid.`);
            return;
        }

        // Check if min_val is less than max_val
        if (form_params.min_val >= form_params.max_val) {
            alert("Minimum value must be less than maximum value.");
            return;
        }

        // Check if step_size is less than (max_val - min_val)
        if (form_params.step_size >= (form_params.max_val - form_params.min_val)) {
            alert("Step size must be less than the difference between maximum and minimum values.");
            return;
        }

        // Proceed if all checks pass
        fetch_phase_margin_plot_data(form_params);
        fetch_bandwidth_plot_data(form_params);
    });

    // Append form to the div with id "stability-params-form"
    document.getElementById("stability-params-form").appendChild(form);
}

async function check_if_device_exists(deviceName) {
    const url = new URL(`${baseUrl}/circuits/${circuitId}/devices/check`);
    url.searchParams.append('device_name', deviceName);

    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.exists) {
                console.log(`Device ${deviceName} exists.`);
                return true;
            } else {
                console.log(`Device ${deviceName} does not exist.`);
                return false;
            }
        })
        .catch(error => {
            console.error('Error checking device existence:', error);
            return false;
        });
}

function fetch_phase_margin_plot_data(input_params) {
    var url = new URL(`${baseUrl}/circuits/${circuitId}/pm/plot`);
    Object.keys(input_params).forEach(key => url.searchParams.append(key, input_params[key]));

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Phase Margin data received:", data);
            plot_phase_margin(data.device_value, data.phase_margin);
        })
        .catch(error => console.error('Error fetching cap vs PM data:', error));
}

function plot_phase_margin(parameter_values, phase_margins) {
    const ctx = document.getElementById('phase-margin-plot').getContext('2d');
    const selectedDevice = document.getElementById('selected_device').value;

    // Clear previous plot if it exists
    if (window.phaseMarginChart) {
        window.phaseMarginChart.destroy();
    }

    // Create a new chart with axis labels and dynamic title
    window.phaseMarginChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: parameter_values,
            datasets: [{
                label: 'Phase Margin (degrees)',
                data: phase_margins,
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 2,
                fill: false
            }]
        },
        options: {
            responsive: true,
            hoverMode: 'index',
            stacked: false,
            title: {
                display: true,
                text: `${selectedDevice} vs. Phase Margin`
            },
            scales: {
                xAxes:[{
                    scaleLabel: {
                        display: true,
                        labelString: `${selectedDevice}`
                    }
                }],
                yAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: 'Phase Margin (degrees)'
                    }
                }]
            }
        }
    });
}

function fetch_bandwidth_plot_data(input_params) {
    var url = new URL(`${baseUrl}/circuits/${circuitId}/bandwidth/plot`);
    Object.keys(input_params).forEach(key => url.searchParams.append(key, input_params[key]));

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Bandwidth plot data received:", data);
            plot_bandwidth(data.parameter_value, data.bandwidth);
        })
        .catch(error => console.error('Error fetching bandwidth data:', error));
}

function plot_bandwidth(parameter_value, bandwidth) {
    const ctx = document.getElementById('bandwidth-plot').getContext('2d');
    const selectedDevice = document.getElementById('selected_device').value;

    // Clear previous plot if it exists
    if (window.bandwidthChart) {
        window.bandwidthChart.destroy();
    }

    // Create a new chart with axis labels and dynamic title
    window.bandwidthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: parameter_value,
            datasets: [{
                label: 'Bandwidth (hz)',
                data: bandwidth,
                borderColor: 'rgba(120, 50, 194, 1)',
                borderWidth: 2,
                fill: false
            }]
        },
        options: {
            responsive: true,
            hoverMode: 'index',
            stacked: false,
            title: {
                display: true,
                text: `${selectedDevice} vs. Bandwidth`
            },
            scales: {
                xAxes:[{
                    scaleLabel: {
                        display: true,
                        labelString: `${selectedDevice}` // TO BE CHANGED TO PICK APPROPRIATE UNIT
                    }
                }],
                yAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: 'Bandwidth (hz)'
                    }
                }]
            }
        }
    });
}

function validateNode(nodeId) {
    const cy = window.cy; // Cytoscape instance
    const existingNodes = cy.nodes().map(node => node.id()); // Get all node IDs
    return existingNodes.includes(nodeId); // Check if the node exists
}

/* ==========================================================
   SFG↔SVG overlay: accurate markers + relocation + solid reset
   (recomputes live SFG positions; ensures SVG has a viewBox)
   ========================================================== */
(function () {
  const STATE_KEY = '__sfgSvgTools__';

  function state() {
    if (!window[STATE_KEY]) {
      window[STATE_KEY] = {
        savedPositions: null,   // { id: {x,y} }
        savedPan: null,         // {x,y}
        savedZoom: null,        // number
        markerLayer: null
      };
    }
    return window[STATE_KEY];
  }

  // ---------------- DOM / overlay ----------------
  function byId(id){ return document.getElementById(id); }
  function getOverlaySvg(){
    const l = byId('svg-layer');
    return l ? l.querySelector('svg') : null;
  }

  // If the cloned SVG is missing a viewBox, compute one from its bbox.
  function ensureSvgViewBox(svg) {
    if (!svg) return;
    if (svg.hasAttribute('viewBox')) return;
    try {
      const b = svg.getBBox();
      if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.width) || !isFinite(b.height)) return;
      svg.setAttribute('viewBox', `${b.x} ${b.y} ${Math.max(b.width,1)} ${Math.max(b.height,1)}`);
    } catch (_) {
      // Some SVGs may not support getBBox on the root; best effort only.
    }
    // Preserve aspect ratio to match most schematics
    if (!svg.hasAttribute('preserveAspectRatio')) {
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
    // Always stretch to container
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.style.width = '100%'; svg.style.height = '100%';
  }

  function prepareOverlay() {
    const overlay = byId('overlay-container');
    const svgLayer = byId('svg-layer');
    const sfgLayer = byId('cy');
    if (!overlay || !svgLayer || !sfgLayer) {
      console.warn('[overlay] Missing #overlay-container/#svg-layer/#cy');
      return false;
    }
    overlay.style.position = 'relative';
    overlay.style.overflow = 'hidden';
    if ((parseFloat(getComputedStyle(overlay).height) || 0) < 300) {
      overlay.style.height = '600px';
    }
    [svgLayer].forEach(el => {
      el.style.position = 'absolute';
      el.style.top = el.style.left = el.style.right = el.style.bottom = '0';
    });

    // If svg-layer is empty, clone a schematic SVG into it
    if (!svgLayer.querySelector('svg')) {
      const host = document.querySelector('#circuit-svg svg') ||
                   document.querySelector('#circuit-svg-small svg');
      if (host) {
        const clone = host.cloneNode(true);
        svgLayer.innerHTML = '';
        svgLayer.appendChild(clone);
      }
    }

    // normalize SVG sizing
    const svg = getOverlaySvg();
    if (svg) ensureSvgViewBox(svg);

    return true;
  }

  // ---------------- coordinate helpers ----------------
  function svgToClientFactory(svg){
    return function(x,y){
      const pt = svg.createSVGPoint(); pt.x=x; pt.y=y;
      const m = svg.getScreenCTM(); if (!m) return null;
      const p = pt.matrixTransform(m);
      return { x: Math.round(p.x), y: Math.round(p.y) };
    };
  }

  // Convert viewport/client px → Cytoscape model coords (so node lands at that pixel)
  function clientToModel(xc, yc){
    const cy = window.cy;
    const rect = cy.container().getBoundingClientRect();
    const z = cy.zoom(), pan = cy.pan();
    return { x: (xc - rect.left - pan.x)/z, y: (yc - rect.top - pan.y)/z };
  }

  // Live SFG client center for a node id (fresh each time)
  function sfgClientFor(id){
    const cy = window.cy;
    const rect = cy.container().getBoundingClientRect();
    const coll = cy.$id(id);
    if (!coll || !coll.length) return { x:null, y:null };
    const r = coll.renderedPosition();
    return { x: Math.round(rect.left + r.x), y: Math.round(rect.top + r.y) };
  }

  // Center of an SVG <text> by label (case-insensitive) → client px
  function svgClientForLabel(label){
    const svg = getOverlaySvg(); if (!svg) return { x:null, y:null };
    const toClient = svgToClientFactory(svg);
    const needle = String(label||'').trim().toLowerCase();
    const texts = svg.querySelectorAll('text');
    for (let i=0;i<texts.length;i++){
      const t = (texts[i].textContent || '').trim().toLowerCase();
      if (t === needle) {
        try {
          const b = texts[i].getBBox();
          const c = toClient(b.x + b.width/2, b.y + b.height/2);
          if (c) return { x:c.x, y:c.y };
        } catch (_){}
      }
    }
    return { x:null, y:null };
  }

  // ---------------- mapping / rows ----------------
  const DEFAULT_NAME_MAP = {
    Vvin:'vin', Vvout:'vout', Vvd1:'vd1', Vvs1:'vs1', Vn_vdd:'n_VDD', I1:'I1'
  };
  function normalizeMap(m){ // lowercases only for lookup; we preserve original case in labels
    const o={}; Object.keys(m||{}).forEach(k=>{ o[k]=m[k]; }); return o;
  }

  // Build fresh rows every call (no stale coordinates)
  // returns [{ id, svg_label, matched, sfg_client_x, sfg_client_y, svg_client_x, svg_client_y }]
  function mapSfgToSvgByText(overrides){
    if (!prepareOverlay() || !window.cy) return [];
    const MAP = normalizeMap(Object.assign({}, DEFAULT_NAME_MAP, overrides||{}));
    const rows = [];
    window.cy.nodes().forEach(n=>{
      const id = n.id();
      const label = MAP[id] || id;                  // fallback try
      const sfg = sfgClientFor(id);                 // LIVE SFG position
      const svg = svgClientForLabel(label);
      rows.push({
        id,
        svg_label: label,
        matched: Number.isFinite(svg.x) && Number.isFinite(svg.y),
        sfg_client_x: sfg.x, sfg_client_y: sfg.y,
        svg_client_x: svg.x, svg_client_y: svg.y
      });
    });
    return rows;
  }

  // ---------------- markers (always recomputed) ----------------
  function clearMarkers(){
    const st = state();
    if (st.markerLayer) { st.markerLayer.remove(); st.markerLayer = null; }
  }

  function drawSfgSvgMarkers(rows){
    // recompute SFG positions to avoid drift after moves
    const fresh = (rows || []).map(r=>{
      const sfg = sfgClientFor(r.id);
      return Object.assign({}, r, { sfg_client_x: sfg.x, sfg_client_y: sfg.y });
    });

    const overlay = byId('overlay-container');
    if (!overlay) { console.warn('no #overlay-container'); return; }
    clearMarkers();

    const layer = document.createElement('div');
    Object.assign(layer.style, { position:'absolute', inset:'0', pointerEvents:'none', zIndex: 999999 });
    overlay.appendChild(layer);
    state().markerLayer = layer;

    function dot(x,y,color){ if(x==null||y==null) return;
      const d=document.createElement('div');
      Object.assign(d.style,{position:'absolute',left:(x-4)+'px',top:(y-4)+'px',width:'8px',height:'8px',borderRadius:'50%',background:color,outline:'1px solid #000'});
      layer.appendChild(d);
    }
    function label(x,y,text,color){ if(x==null||y==null) return;
      const t=document.createElement('div');
      Object.assign(t.style,{position:'absolute',left:(x+6)+'px',top:(y-6)+'px',font:'11px/1.2 monospace',color});
      t.textContent=text; layer.appendChild(t);
    }

    fresh.forEach(r=>{
      // SFG now (blue)
      dot(r.sfg_client_x, r.sfg_client_y, '#1e90ff');
      label(r.sfg_client_x, r.sfg_client_y, r.id, '#1e90ff');

      // SVG target (red)
      if (r.matched) {
        dot(r.svg_client_x, r.svg_client_y, '#e74c3c');
        label(r.svg_client_x, r.svg_client_y, r.svg_label, '#e74c3c');
      }
    });

    console.log('Markers drawn (blue=SFG id, red=SVG label).');
  }

  // ---------------- relocate & reset ----------------
  function ensureSavedPositions(){
    const st = state();
    if (st.savedPositions) return; // already saved
    if (!window.cy) return;
    st.savedPositions = {};
    window.cy.nodes().forEach(n => { st.savedPositions[n.id()] = { x:n.position('x'), y:n.position('y') }; });
    st.savedPan  = Object.assign({}, window.cy.pan());
    st.savedZoom = window.cy.zoom();
  }

  function relocateSfgNodesToSvg({ rows, animate = true, duration = 350 } = {}){
    if (!window.cy) { console.warn('cy not ready'); return; }
    if (!rows || !rows.length) { console.warn('relocate: pass rows from mapSfgToSvgByText()'); return; }
    ensureSavedPositions();

    const moved = [];
    rows.forEach(r=>{
      if (!r || !r.matched || r.svg_client_x==null || r.svg_client_y==null) return;
      const coll = window.cy.$id(r.id);
      if (!coll || !coll.length) return;
      const model = clientToModel(r.svg_client_x, r.svg_client_y);
      if (animate && typeof coll.animate === 'function') {
        coll.animate({ position: model }, { duration });
      } else {
        coll.position(model);
      }
      moved.push({ id:r.id, to:model });
    });

    console.log(`Relocated ${moved.length} node(s).`, moved);
  }

  function resetSfgRelocation({ restoreView = true, animate = false, duration = 0 } = {}){
    if (!window.cy) { console.warn('cy not ready'); return; }
    const st = state();
    if (!st.savedPositions) { console.warn('No saved positions to restore.'); return; }

    const cy = window.cy;
    Object.keys(st.savedPositions).forEach(id=>{
      const coll = cy.$id(id);
      if (!coll || !coll.length) return;
      const pos = st.savedPositions[id];
      if (animate && typeof coll.animate === 'function') {
        coll.animate({ position: pos }, { duration });
      } else {
        coll.position(pos);
      }
    });

    if (restoreView) {
      if (typeof cy.zoom === 'function' && st.savedZoom != null) cy.zoom(st.savedZoom);
      if (typeof cy.pan  === 'function' && st.savedPan)       cy.pan(st.savedPan);
    }

    st.savedPositions = null;
    st.savedPan = null;
    st.savedZoom = null;
    clearMarkers();
    console.log('SFG node positions (and view) restored.');
  }

  // ---------------- quick inspectors ----------------
  function printOverlayNodeCoords() {
    if (!window.cy) { console.warn('cy not ready'); return []; }
    const rect = window.cy.container().getBoundingClientRect();
    const rows = window.cy.nodes().map(n=>{
      const m = n.position(), r = n.renderedPosition();
      return { id:n.id(), model_x:m.x, model_y:m.y, client_x: Math.round(rect.left+r.x), client_y: Math.round(rect.top+r.y) };
    });
    console.table(rows);
    return rows;
  }

  function printSvgIndex() {
    const svg = getOverlaySvg();
    if (!svg) { console.warn('No SVG found in #svg-layer'); return []; }
    ensureSvgViewBox(svg); // normalize first
    const toClient = svgToClientFactory(svg);
    const out = [];
    svg.querySelectorAll('*').forEach((el, i) => {
      const tag   = el.tagName.toLowerCase();
      const id    = el.id || '';
      const klass = (el.getAttribute('class') || '').trim();
      const text  = (tag === 'text') ? (el.textContent || '').trim() : '';
      let bbStr = '', cx = null, cy = null;
      try {
        const bb = el.getBBox();
        bbStr = `${(+bb.width).toFixed(1)}×${(+bb.height).toFixed(1)}`;
        const c = toClient(bb.x + bb.width/2, bb.y + bb.height/2);
        if (c) { cx = c.x; cy = c.y; }
      } catch (_) { /* some nodes have no bbox */ }
      out.push({ i, tag, id, class: klass, text, bb: bbStr, cx, cy });
    });
    console.table(out);
    return out;
  }

  // ---------------- exports ----------------
  window.mapSfgToSvgByText     = window.mapSfgToSvgByText || mapSfgToSvgByText;
  window.drawSfgSvgMarkers     = drawSfgSvgMarkers;
  window.relocateSfgNodesToSvg = relocateSfgNodesToSvg;
  window.resetSfgRelocation    = resetSfgRelocation;
  window.printOverlayNodeCoords= window.printOverlayNodeCoords || printOverlayNodeCoords;
  window.printSvgIndex         = window.printSvgIndex || printSvgIndex;

  console.log('[SFG/SVG overlay: live markers + viewBox normalization ready]');
})();

/* ===== Fixed-coordinate labeled markers (exact viewport positions) ===== */
(function(){
  // Delete any prior markers (fixed-mode)
  function clearFixedMarkers(){
    document.querySelectorAll('.overlay-marker-fixed,.overlay-marker-label-fixed').forEach(n => n.remove());
  }

  // Live SFG client center for a node id
  function _sfgClientFor(id){
    if (!window.cy) return { x:null, y:null };
    const rect = window.cy.container().getBoundingClientRect();
    const coll = window.cy.$id(id);
    if (!coll || !coll.length) return { x:null, y:null };
    const r = coll.renderedPosition();
    return { x: Math.round(rect.left + r.x), y: Math.round(rect.top + r.y) };
  }

  // Draw markers using position:fixed so client coords land exactly
  function drawSfgSvgMarkersFixed(rows){
    if (!rows || !rows.length) { console.warn('drawSfgSvgMarkersFixed: pass rows'); return; }

    // Recompute SFG positions (avoid stale coords)
    const fresh = rows.map(r => {
      const s = _sfgClientFor(r.id);
      return Object.assign({}, r, { sfg_client_x: s.x, sfg_client_y: s.y });
    });

    clearFixedMarkers();

    function dot(x, y, color, title){
      if (x == null || y == null) return;
      const d = document.createElement('div');
      d.className = 'overlay-marker-fixed';
      Object.assign(d.style, {
        position: 'fixed',
        left: (x - 4) + 'px',
        top:  (y - 4) + 'px',
        width: '8px',
        height:'8px',
        borderRadius:'50%',
        background: color,
        outline: '1px solid #000',
        zIndex: 2147483647
      });
      if (title) d.title = title;
      document.body.appendChild(d);
    }
    function label(x, y, text, color){
      if (x == null || y == null) return;
      const t = document.createElement('div');
      t.className = 'overlay-marker-label-fixed';
      Object.assign(t.style, {
        position: 'fixed',
        left: (x + 6) + 'px',
        top:  (y - 6) + 'px',
        font: '11px/1.2 monospace',
        color: color,
        pointerEvents: 'none',
        zIndex: 2147483647
      });
      t.textContent = text;
      document.body.appendChild(t);
    }

    // Blue = SFG node id; Red = SVG label
    fresh.forEach(r => {
      dot(r.sfg_client_x, r.sfg_client_y, '#1e90ff', `SFG ${r.id}`);
      label(r.sfg_client_x, r.sfg_client_y, r.id, '#1e90ff');

      if (r.matched) {
        dot(r.svg_client_x, r.svg_client_y, '#e74c3c', `SVG ${r.svg_label}`);
        label(r.svg_client_x, r.svg_client_y, r.svg_label, '#e74c3c');
      }
    });

    console.log('Markers (fixed) drawn: blue=SFG, red=SVG.');
  }

  // Expose: keep your old name as a wrapper so existing calls work
  window.drawSfgSvgMarkersFixed = drawSfgSvgMarkersFixed;
  window.drawSfgSvgMarkers = drawSfgSvgMarkersFixed; // override previous implementation
  window.clearSfgSvgMarkers = clearFixedMarkers;
})();


// ---------- Dynamic mapping for prefix style: Iscvin, Vvin, Iscn_vdd, Vn_vdd ----------

// Build overrides like:
//  "Iscvin"   -> "vin"
//  "Vvin"     -> "vin"
//  "Iscn_vdd" -> "n_vdd"
//  "Vn_vdd"   -> "n_vdd"
// If the id doesn't start with V or Isc (e.g. "I1"), we don't override it at all,
// so it maps to the point itself.
function buildPrefixNameOverrides() {
  const overrides = {};
  if (!window.cy) return overrides;

  window.cy.nodes().forEach(n => {
    const id = n.id();
    let base = null;

    // Handle Isc prefix
    if (/^Isc/i.test(id)) {
      base = id.slice(3);  // remove "Isc"
    }
    // Handle V prefix (but not "Isc" which already matched)
    else if (/^V/.test(id)) {
      base = id.slice(1);  // remove leading "V"
    }

    // If it didn't start with Isc or V, we don't touch it
    if (!base) return;

    // Clean up leading separators like "_", "-", or spaces
    base = base.replace(/^[_\-\s]+/, '');

    // Only set an override if there's something left
    if (base) {
      overrides[id] = base;
    }
  });

  return overrides;
}

// Main entrypoint: map & relocate, with Isc nodes shifted left of the point.
function autoRelocateIVNodesPrefix({
  animate = true,
  duration = 350,
  iscOffsetPx = 18   // how far left of the SVG label Isc nodes sit
} = {}) {
  // 1) Build overrides so Isc*/V* map to their base point label
  const overrides = buildPrefixNameOverrides();

  // 2) Use your existing mapping helper
  const rows = mapSfgToSvgByText(overrides);

  // 3) Shift Isc nodes a bit to the left of the SVG point
  rows.forEach(r => {
    if (!r || !r.matched || r.svg_client_x == null) return;

    // Depending on how your row is structured, adjust this if needed
    const nodeId = r.id || r.sfg_id || (r.node && r.node.id && r.node.id()) || "";

    if (/^Isc/i.test(nodeId)) {
      r.svg_client_x -= iscOffsetPx;
    }
  });

  // 4) Move the nodes
  relocateSfgNodesToSvg({ rows, animate, duration });
}
