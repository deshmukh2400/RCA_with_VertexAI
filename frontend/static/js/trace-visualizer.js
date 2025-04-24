async function loadTraces() {
  const res = await fetch('/api/traces');
  if (!res.ok) {
    console.error('Failed to load traces', res.statusText);
    return;
  }
  console.log("▶️ loadTraces()");
  const res = await fetch('/api/traces');
  console.log("fetch /api/traces status:", res.status);
  if (!res.ok) {
    console.error('Failed to load traces', res.statusText);
    return;
  }
  const data = await res.json();
  console.log("traces payload:", data);
  // … renderTraceGraph & renderTraceTimeline …
  
  renderTraceGraph(data);
  renderTraceTimeline(data);
}

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

  const svg = d3.select(".trace-graph").html("")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const simulation = d3.forceSimulation(Object.values(nodes))
    .force("link", d3.forceLink(links).id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2));

  svg.selectAll('line')
    .data(links).enter()
    .append('line')
    .attr('stroke', '#999');

  svg.selectAll('circle')
    .data(Object.values(nodes)).enter()
    .append('circle')
    .attr('r', 12)
    .attr('fill', '#69b3a2')
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