// frontend/static/js/script.js

// 1) Load CMDB and render the D3 tree
async function loadCMDB() {
  try {
    const res = await fetch('/api/cmdb');
    if (!res.ok) throw new Error(res.statusText);
    const cmdb = await res.json();
    renderTree(cmdb);
  } catch (err) {
    console.error("CMDB load failed:", err);
    document.getElementById('tree-container').innerText = "Error loading CMDB";
  }
}

function renderTree(cmdb) {
  // clear any existing SVG
  d3.select("#tree-container").html("");

  // build the same simple tree from 'web01'
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

  const width = 400, height = 250;
  const treeLayout = d3.tree().size([width, height]);
  const hierarchy = d3.hierarchy(root);
  treeLayout(hierarchy);

  const svg = d3.select("#tree-container")
    .append("svg")
    .attr("width", width + 100)
    .attr("height", height + 40)
    .append("g")
    .attr("transform", "translate(50,20)");

  // links
  svg.selectAll('line')
    .data(hierarchy.links())
    .join('line')
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y)
    .attr('stroke', '#999');

  // nodes
  svg.selectAll('circle')
    .data(hierarchy.descendants())
    .join('circle')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('r', 6)
    .attr('fill', '#69b3a2');

  // labels
  svg.selectAll('text')
    .data(hierarchy.descendants())
    .join('text')
    .attr('x', d => d.x)
    .attr('y', d => d.y + 15)
    .attr('text-anchor', 'middle')
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

// 3) Wire up initial load
window.addEventListener("DOMContentLoaded", () => {
  loadCMDB();
  loadRCA();
  // traces are handled by trace-visualizer.js on its own
});