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

// Draw the dependency tree with impact and RAG coloring
function renderTree(cmdb, impactedSet) {
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

  const width = 800, height = 600;
  const treeLayout = d3.tree().size([width, height - 100]);
  const hierarchy = d3.hierarchy(root);
  treeLayout(hierarchy);

  const container = d3.select("#tree-container").html("");
  const svg = container.append("svg")
    .attr("width", width + 100)
    .attr("height", height + 40)
    .append("g")
    .attr("transform", "translate(50,20)");

  // Draw links
  svg.selectAll("line")
    .data(hierarchy.links())
    .join("line")
    .attr("stroke", "#999")
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y);

  // Node colors: impacted or based on RAG
  const nodes = svg.selectAll("circle")
    .data(hierarchy.descendants())
    .join("circle")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", 10)
    .attr("fill", d => {
      const ci = cmdb[d.data.name];
      const rag = ci?.rag || "unknown";

      if (impactedSet.has(d.data.name)) {
        return "#e67e22"; // Orange for impacted
      }

      switch (rag.toLowerCase()) {
        case "red": return "#e74c3c";
        case "amber": return "#f1c40f";
        case "green": return "#2ecc71";
        default: return "#bdc3c7"; // Default gray
      }
    })
    .attr("stroke", "#333")
    .attr("stroke-width", 1)
    .on("mouseover", (event, d) => {
      d3.select(event.currentTarget).transition().duration(100).attr("r", 14);
      showTooltip(event.pageX, event.pageY, d.data.name);
    })
    .on("mouseout", (event, d) => {
      d3.select(event.currentTarget).transition().duration(100).attr("r", 10);
      hideTooltip();
    });

  // Labels
  svg.selectAll("text")
    .data(hierarchy.descendants())
    .join("text")
    .attr("x", d => d.x)
    .attr("y", d => d.y + 20)
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

// Main init
async function init() {
  try {
    const { root_cause, timeline } = await fetchJSON("/api/rca");
    document.getElementById("rca-output").innerText = root_cause;
    renderAlerts(timeline);

    const impactedSet = new Set(timeline.map(a => a.ci));
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