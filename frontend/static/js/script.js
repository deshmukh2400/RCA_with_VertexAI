// Utility to fetch JSON with error handling
async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${res.statusText}`);
  return res.json();
}

// Render alerts in a simple timeline format
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

// Render dependency tree with arrows, tooltip, and RAG coloring
function renderTree(cmdb, impactedSet) {
  // Build hierarchical structure starting from root node
  const root = { name: 'web01', children: [] };
  const visited = new Set();

  (function build(node, id) {
    if (visited.has(id)) return; // prevent cycles
    visited.add(id);

    const deps = cmdb[id]?.depends_on || [];
    node.name = id;
    node.children = deps.map(childId => {
      const child = {};
      build(child, childId);
      return child;
    });
  })(root, 'web01');

  // Calculate dynamic tree size
  const maxDepth = (function getMaxDepth(node) {
    if (!node.children || node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(getMaxDepth));
  })(root);

  const width = 180 * maxDepth;
  const height = 1000;

  const treeLayout = d3.tree().size([height, width - 100]);
  const hierarchy = d3.hierarchy(root);
  treeLayout(hierarchy);

  // Clear old content and setup SVG
  const container = d3.select("#tree-container").html("");
  const svg = container.append("svg")
    .attr("width", width + 200)
    .attr("height", height + 100)
    .append("g")
    .attr("transform", "translate(100,50)");

  // Arrow marker
  svg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 15)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#999");

  // Draw links with arrow markers
  svg.selectAll("line")
    .data(hierarchy.links())
    .join("line")
    .attr("stroke", "#999")
    .attr("stroke-width", 1.5)
    .attr("x1", d => d.source.y)
    .attr("y1", d => d.source.x)
    .attr("x2", d => d.target.y)
    .attr("y2", d => d.target.x)
    .attr("marker-end", "url(#arrowhead)");

  // Define color based on impact status (RAG)
  const statusColor = (name) => {
    if (impactedSet.has(name)) return "#e74c3c";  // Red
    if (name.includes("db") || name.includes("cache")) return "#f1c40f";  // Amber-like
    return "#2ecc71"; // Green
  };

  // Draw nodes
  const nodes = svg.selectAll("circle")
    .data(hierarchy.descendants())
    .join("circle")
    .attr("cx", d => d.y)
    .attr("cy", d => d.x)
    .attr("r", 10)
    .attr("fill", d => statusColor(d.data.name))
    .attr("stroke", "#333")
    .attr("stroke-width", 1.5)
    .on("mouseover", (event, d) => {
      d3.select(event.currentTarget).transition().duration(100).attr("r", 14);
      showTooltip(event.pageX, event.pageY, d.data.name);
    })
    .on("mouseout", (event, d) => {
      d3.select(event.currentTarget).transition().duration(100).attr("r", 10);
      hideTooltip();
    });

  // Add labels
  svg.selectAll("text")
    .data(hierarchy.descendants())
    .join("text")
    .attr("x", d => d.y)
    .attr("y", d => d.x - 14)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text(d => d.data.name);
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
    .style("top", `${y + 10}px`)
    .html(`<strong>${text}</strong>`)
    .transition().duration(100).style("opacity", 1);
}

function hideTooltip() {
  tooltip.transition().duration(100).style("opacity", 0);
}

// Main app initialization
async function init() {
  try {
    // Load RCA and alerts
    const { root_cause, timeline } = await fetchJSON("/api/rca");
    document.getElementById("rca-output").innerText = root_cause;
    renderAlerts(timeline);

    // Build impacted CI set
    const impactedSet = new Set(timeline.map(a => a.ci));

    // Load CMDB and draw the tree
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