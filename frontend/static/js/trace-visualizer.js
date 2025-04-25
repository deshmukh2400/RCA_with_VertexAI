// Load and visualize trace data with CMDB-based RAG status
async function loadTraces() {
  console.log("▶️ loadTraces() called");
  try {
    const [traceRes, cmdb] = await Promise.all([
      fetch('/api/traces').then(r => r.json()),
      fetch('/api/cmdb').then(r => r.json())
    ]);

    if (!traceRes || traceRes.length === 0) {
      d3.select(".trace-graph").html("<div class='error-message'>No trace spans to display.</div>");
      document.getElementById("traceTimeline").innerText = "No trace data available.";
      return;
    }

    renderTraceGraph(traceRes, cmdb);
    renderTraceTimeline(traceRes);

  } catch (err) {
    console.error("Trace load failed:", err);
    d3.select(".trace-graph").html(`<div class="error-message">Error loading trace graph: ${err.message}</div>`);
    document.getElementById("traceTimeline").innerText = `Error loading traces: ${err.message}`;
  }
}

// Graph rendering with CMDB RAG status and arrows
function renderTraceGraph(traces, cmdb) {
  const nodes = {}, links = [];

  traces.forEach(span => {
    if (!nodes[span.service]) {
      nodes[span.service] = { id: span.service };
    }

    if (span.parent_span_id) {
      const parent = traces.find(s => s.span_id === span.parent_span_id);
      if (parent && parent.service && parent.service !== span.service) {
        links.push({ source: parent.service, target: span.service });
      }
    }
  });

  const width = document.querySelector('.trace-graph').clientWidth;
  const height = document.querySelector('.trace-graph').clientHeight;

  const svg = d3.select(".trace-graph").html("")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  svg.append("defs").append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 22)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#999");

  const simulation = d3.forceSimulation(Object.values(nodes))
    .force("link", d3.forceLink(links).id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2));

  const statusColor = (name) => {
    const ci = cmdb[name];
    if (!ci) return "#bdc3c7"; // gray if no CMDB data
    switch (ci.rag) {
      case "red": return "#e74c3c";
      case "amber": return "#f1c40f";
      case "green": return "#2ecc71";
      default: return "#bdc3c7";
    }
  };

  const link = svg.selectAll('line')
    .data(links)
    .enter().append('line')
    .attr('stroke', '#999')
    .attr('stroke-width', 1.5)
    .attr("marker-end", "url(#arrow)");

  const node = svg.selectAll('circle')
    .data(Object.values(nodes))
    .enter().append('circle')
    .attr('r', 12)
    .attr('fill', d => statusColor(d.id))
    .attr('stroke', '#333')
    .attr('stroke-width', 1)
    .call(d3.drag()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      })
    )
    .on("mouseover", (event, d) => {
      d3.select(event.currentTarget).transition().duration(100).attr("r", 16);
      showTooltip(event.pageX, event.pageY, d.id, cmdb[d.id]?.rag);
    })
    .on("mouseout", () => {
      d3.selectAll("circle").transition().duration(100).attr("r", 12);
      hideTooltip();
    });

  const label = svg.selectAll('text')
    .data(Object.values(nodes))
    .enter().append('text')
    .text(d => d.id)
    .attr('dx', 14)
    .attr('dy', 4);

  simulation.on("tick", () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

    label
      .attr('x', d => d.x)
      .attr('y', d => d.y);
  });
}

// Timeline below the graph
function renderTraceTimeline(traces) {
  const grouped = traces.reduce((acc, span) => {
    (acc[span.trace_id] = acc[span.trace_id] || []).push(span);
    return acc;
  }, {});

  const container = document.getElementById("traceTimeline");
  container.innerHTML = '';

  for (const [traceId, spans] of Object.entries(grouped)) {
    const title = document.createElement('h4');
    title.textContent = traceId;
    container.appendChild(title);

    const ul = document.createElement('ul');
    spans.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .forEach(span => {
        const li = document.createElement('li');
        li.textContent = `${span.timestamp} — ${span.service} (${span.operation}) [${span.duration_ms}ms]`;
        if (span.status === 'error') {
          li.classList.add('error');
        }
        ul.appendChild(li);
      });
    container.appendChild(ul);
  }
}

// Tooltip setup (shared with script.js)
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

function showTooltip(x, y, name, rag = "unknown") {
  tooltip
    .style("left", `${x + 10}px`)
    .style("top", `${y + 10}px`)
    .html(`<strong>${name}</strong><br>Status: ${rag}`)
    .transition().duration(100).style("opacity", 1);
}

function hideTooltip() {
  tooltip.transition().duration(100).style("opacity", 0);
}

// Setup on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('refresh-traces');
  if (btn) {
    btn.addEventListener('click', loadTraces);
  }
  loadTraces();
});