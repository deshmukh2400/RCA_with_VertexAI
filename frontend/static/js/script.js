// frontend/static/js/script.js

// Utility to fetch JSON and throw on non-OK
async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${res.statusText}`);
  return res.json();
}

// Render the alert timeline
function renderAlerts(timeline) {
  const list = document.getElementById("alert-list");
  list.innerHTML = "";
  timeline.forEach(alert => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="timestamp">${alert.timestamp}</span>
      <strong>${alert.ci}</strong>: ${alert.message}
    `;
    list.appendChild(li);
  });
}

// Draw the dependency tree, coloring impacted CIs red
function renderTree(cmdb, impactedSet) {
  // Build hierarchical data (starting from 'web01' or adjust as needed)
  const root = { name: 'web01', children: [] };
  (function build(node, id) {
    const deps = cmdb[id]?.depends_on || [];
    node.name = id;
    node.children = deps.map(childId => {
      const child = {};
      build(child, childId);
      return child;
    });
  })(root, 'web01');

  const width = 500, height = 300;
  const treeLayout = d3.tree().size([height, width - 100]);
  const hierarchy = d3.hierarchy(root);
  treeLayout(hierarchy);

  // Clear old tree
  
  const container = d3.select("#tree-container").html("");
  const svgBase = container.append("svg")
    .attr("width", width + 200)
    .attr("height", height + 200)
    .call(d3.zoom().on("zoom", (event) => {
      svg.attr("transform", event.transform);
    }));

  const svg = svgBase.append("g")
    .attr("transform", "translate(50,50)");
    
  const nodeCount = hierarchy.descendants().length;
  const width = Math.max(600, nodeCount * 30);
  const height = Math.max(400, nodeCount * 20);
  
  // Links
  svg.selectAll("line")
    .data(hierarchy.links())
    .join("line")
      .attr("stroke", "#999")
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

  // Nodes with hover & tooltip
  const nodes = svg.selectAll("circle")
    .data(hierarchy.descendants())
    .join("circle")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", 8)
      .attr("fill", d => impactedSet.has(d.data.name) ? "#e74c3c" : "#69b3a2")
      .attr("stroke", "#333")
      .attr("stroke-width", 1)
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget).transition().duration(100).attr("r", 12);
        showTooltip(event.pageX, event.pageY, d.data.name);
      })
      .on("mouseout", (event, d) => {
        d3.select(event.currentTarget).transition().duration(100).attr("r", 8);
        hideTooltip();
      });

  // Labels
  svg.selectAll("text")
    .data(hierarchy.descendants())
    .join("text")
      .attr("x", d => d.x)
      .attr("y", d => d.y + 18)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text(d => d.data.name);
      
  // Auto-center and scale to fit
  const bounds = svg.node().getBBox();
  const fullWidth = svgBase.attr("width");
  const fullHeight = svgBase.attr("height");
  
  const scale = Math.min(
    fullWidth / (bounds.width + 100),
    fullHeight / (bounds.height + 100)
  );
  
  const translateX = (fullWidth - bounds.width * scale) / 2 - bounds.x * scale;
  const translateY = (fullHeight - bounds.height * scale) / 2 - bounds.y * scale;
  
  svg.transition()
    .duration(500)
    .attr("transform", `translate(${translateX}, ${translateY}) scale(${scale})`);
}

// Tooltip setup
const tooltip = d3.select("body")
  .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("padding", "6px 10px")
    .style("background", "rgba(0,0,0,0.7)")
    .style("color", "#fff")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("opacity", 0);

function showTooltip(x, y, text) {
  tooltip
    .style("left", `${x + 10}px`)
    .style("top",  `${y + 10}px`)
    .html(`<strong>${text}</strong>`)
    .transition().duration(100).style("opacity", 1);
}

function hideTooltip() {
  tooltip.transition().duration(100).style("opacity", 0);
}

// Main init: fetch RCA → alerts/timeline → impactedSet → CMDB → tree
async function init() {
  try {
    // 1. Get RCA result
    const { root_cause, timeline } = await fetchJSON("/api/rca");
    document.getElementById("rca-output").innerText = root_cause;
    renderAlerts(timeline);

    // 2. Build set of impacted CIs
    const impactedSet = new Set(timeline.map(a => a.ci));

    // 3. Fetch CMDB and draw tree with impact coloring
    const cmdb = await fetchJSON("/api/cmdb");
    renderTree(cmdb, impactedSet);

  } catch (err) {
    console.error("Initialization failed:", err);
    document.getElementById("rca-output").innerText = "Error loading data";
    document.getElementById("alert-list").innerText = "";
    d3.select("#tree-container").html(`
      <div class="error-message">
        <strong>Error loading tree:</strong> ${err.message}
      </div>
    `);
  }
}

window.addEventListener("DOMContentLoaded", init);