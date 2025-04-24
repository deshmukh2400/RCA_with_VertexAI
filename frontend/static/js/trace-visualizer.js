async function loadTraces() {
  console.log("▶️ loadTraces() called");
  try {
    const res = await fetch('/api/traces');
    console.log("fetch /api/traces →", res.status, res.statusText);
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${res.statusText}`);
    const data = await res.json();
    console.log("trace data:", data);

    // Handle empty data
    if (!data || data.length === 0) {
      d3.select(".trace-graph")
        .html("<div class='error-message'>No trace spans to display.</div>");
      document.getElementById("traceTimeline")
        .innerText = "No trace data available.";
      return;
    }

    renderTraceGraph(data);
    renderTraceTimeline(data);

  } catch (err) {
    console.error("Trace load failed:", err);
    d3.select(".trace-graph")
      .html(`<div class="error-message">Error loading trace graph: ${err.message}</div>`);
    document.getElementById("traceTimeline")
      .innerText = `Error loading traces: ${err.message}`;
  }
}

// Attach events after DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("refresh-traces");
  if (btn) {
    btn.addEventListener("click", loadTraces);
  } else {
    console.warn("Refresh-traces button not found in DOM");
  }

  // Also call it once after everything else has rendered
  loadTraces();
});



function renderTraceGraph(traces) {
  const nodes = {}, links = [];

  traces.forEach(span => {
    nodes[span.service] = { id: span.service };
    if (span.parent_span_id) {
      const parent = traces.find(s => s.span_id === span.parent_span_id);
      if (parent && parent.service && parent.service !== span.service) {
        links.push({ source: parent.service, target: span.service });
      }
    }
  });

  const width = document.querySelector('.trace-graph').clientWidth;
  const height = document.querySelector('.trace-graph').clientHeight;
    
  const svgBase = d3.select(".trace-graph").html("")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(d3.zoom().on("zoom", (event) => {
      svg.attr("transform", event.transform);
    }));

  const svg = svgBase.append("g");

  const simulation = d3.forceSimulation(Object.values(nodes))
    .force("link", d3.forceLink(links).id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2));

  svg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "-0 -5 10 10")
    .attr("refX", 25) // adjust depending on node size
    .attr("refY", 0)
    .attr("orient", "auto")
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("xoverflow", "visible")
    .append("svg:path")
    .attr("d", "M 0,-5 L 10 ,0 L 0,5")
    .attr("fill", "#999")
    .style("stroke", "none");
    
  svg.selectAll('line')
    .data(links).enter()
    .append('line')
    .attr('stroke', '#999')
    .attr('stroke-width', 1.5)
    .attr('marker-end', 'url(#arrowhead)');

  svg.selectAll('circle')
    .data(Object.values(nodes)).enter()
    .append('circle')
    .attr('r', 12)
    .attr("fill", d => {
      const span = traces.find(s => s.service === d.id);
      switch (span?.ci_state) {
        case 'red': return '#e74c3c';
        case 'amber':
        case 'yellow': return '#f39c12';
        case 'green': return '#2ecc71';
        default: return '#69b3a2'; // fallback
      }
    })
    .call(d3.drag()
      .on("start", (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on("end", (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

  svg.selectAll('text')
    .data(Object.values(nodes)).enter()
    .append('text')
    .text(d => d.id)
    .attr('dx', 14)
    .attr('dy', 4);

  simulation.on("tick", () => {
    svg.selectAll('line')
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    svg.selectAll('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

    svg.selectAll('text')
      .attr('x', d => d.x)
      .attr('y', d => d.y);
  });
  // Auto-center and scale the trace graph
  const bbox = svg.node().getBBox();
  const svgBase = d3.select(".trace-graph svg"); // outer SVG element
  const fullWidth = +svgBase.attr("width");
  const fullHeight = +svgBase.attr("height");
  
  const scale = Math.min(
    fullWidth / (bbox.width + 100),
    fullHeight / (bbox.height + 100)
  );
  
  const translateX = (fullWidth - bbox.width * scale) / 2 - bbox.x * scale;
  const translateY = (fullHeight - bbox.height * scale) / 2 - bbox.y * scale;
  
  svg.transition()
    .duration(500)
    .attr("transform", `translate(${translateX}, ${translateY}) scale(${scale})`);
}

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

// Wire up the button
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('refresh-traces');
  if (btn) {
    btn.addEventListener('click', loadTraces);
  } else {
    console.warn("Refresh button not found");
  }
  // Kick off an initial load
  loadTraces();
});

// Initial fetch of traces and RCA/alerts on page load
window.addEventListener('DOMContentLoaded', () => {
  loadTraces();
  // other init logic in script.js...
});