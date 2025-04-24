// frontend/static/js/script.js

// 1) Load CMDB and render the D3 tree
async function loadCMDB() {
  try {
    const url = `${window.location.origin}/api/cmdb`;
    console.log('Fetching CMDB from', url);
    const res = await fetch(url);
    console.log('CMDB HTTP status:', res.status, res.statusText);
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${res.statusText}`);
    const cmdb = await res.json();
    renderTree(cmdb);
  } catch (err) {
    console.error("CMDB load failed:", err);
    const container = document.getElementById('tree-container');
    container.innerHTML = `
      <div class="error-message">
        <strong>Error loading CMDB:</strong> ${err.message}
      </div>
    `;
  }
}

function renderTree(cmdb, impactedSet) {
  // Build hierarchical data as before...
  const root = { name: 'web01', children: [] };
  (function build(node, id) {
    const deps = cmdb[id]?.depends_on || [];
    node.name = id;
    node.children = deps.map(childId => {
      const childNode = {};
      build(childNode, childId);
      return childNode;
    });
  })(root, 'web01');

  // D3 tree layout
  const width = 500, height = 300;
  const treeLayout = d3.tree().size([height, width - 100]);
  const hierarchy = d3.hierarchy(root);
  treeLayout(hierarchy);

  // Clear and create new SVG
  const svg = d3.select("#tree-container").html("")
    .append("svg")
      .attr("width", width)
      .attr("height", height + 20)
    .append("g")
      .attr("transform", "translate(50,10)");
      
  // Draw nodes with dynamic fill and hover
  const node = svg.selectAll('circle')
    .data(hierarchy.descendants())
    .join('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', 8)
      .attr('fill', d => impactedSet.has(d.data.name) ? '#e74c3c' : '#69b3a2')
      .attr('stroke', '#333')
      .attr('stroke-width', 1)
    .on('mouseover', function(event, d) {
      d3.select(this)
        .transition().duration(100)
        .attr('r', 12);
      showTooltip(event.pageX, event.pageY, d.data.name);
    })
    .on('mouseout', function(event, d) {
      d3.select(this)
        .transition().duration(100)
        .attr('r', 8);
      hideTooltip();
    });



  // Draw links
  svg.selectAll('line')
    .data(hierarchy.links())
    .join('line')
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y)
      .attr('stroke', '#999');

  // Draw nodes with dynamic fill
  svg.selectAll('circle')
    .data(hierarchy.descendants())
    .join('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', 8)
      .attr('fill', d => impactedSet.has(d.data.name) ? '#e74c3c' /* red */ : '#69b3a2' /* green */)
      .attr('stroke', '#333')
      .attr('stroke-width', 1);

  // Draw labels
  svg.selectAll('text')
    .data(hierarchy.descendants())
    .join('text')
      .attr('x', d => d.x)
      .attr('y', d => d.y + 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(d => d.data.name);
}

// 2) Load RCA & alerts, update summary and timeline
async function loadRCA() {
  try {
    const res = await fetch('/api/rca');
    if (!res.ok) throw new Error(res.statusText);
    const { root_cause, timeline } = await res.json();

    // update summary
    document.getElementById('rca-output').innerText = root_cause;

    // render alerts
    const list = document.getElementById("alert-list");
    list.innerHTML = '';
    timeline.forEach(alert => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="timestamp">${alert.timestamp}</span>
                      <strong>${alert.ci}</strong>: ${alert.message}`;
      list.appendChild(li);
    });
  } catch (err) {
    console.error("RCA load failed:", err);
    document.getElementById('rca-output').innerText = "Error loading RCA";
  }
}

async function init() {
  const cmdbData = await loadCMDB();
  const rcaData  = await loadRCA();

  // 1) Extract the set of impacted CIs from the timeline
  const impactedSet = new Set(rcaData.timeline.map(alert => alert.ci));

  renderTree(cmdbData, impactedSet);
  document.getElementById("rca-output").innerText = rcaData.root_cause;
  renderAlerts(rcaData.timeline);
}
// 3) Wire up initial load
window.addEventListener("DOMContentLoaded", () => {
  loadCMDB();
  loadRCA();
  // traces are handled by trace-visualizer.js on its own
});

// Tooltip element
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
    .transition().duration(100)
    .style("opacity", 1);
}

function hideTooltip() {
  tooltip.transition().duration(100).style("opacity", 0);
}