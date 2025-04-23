async function loadTraces() {
  const res = await fetch('/api/traces');
  const data = await res.json();
  renderTraceGraph(data);
  renderTraceTimeline(data);
}

function renderTraceGraph(traces) {
  // Build service dependency graph from spans
  const nodes = {}, links = [];

  traces.forEach(span => {
    nodes[span.service] = { id: span.service };
    if (span.parent_span_id && span.service !== traces.find(s => s.span_id === span.parent_span_id)?.service) {
      links.push({
        source: traces.find(s => s.span_id === span.parent_span_id)?.service,
        target: span.service
      });
    }
  });

  const svg = d3.select("#traceGraph").html("").append("svg")
    .attr("width", "100%")
    .attr("height", 400);

  const simulation = d3.forceSimulation(Object.values(nodes))
    .force("link", d3.forceLink(links).id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(500, 200));

  const link = svg.append("g")
    .selectAll("line")
    .data(links).enter()
    .append("line")
    .attr("stroke", "#999");

  const node = svg.append("g")
    .selectAll("circle")
    .data(Object.values(nodes)).enter()
    .append("circle")
    .attr("r", 20)
    .attr("fill", "lightblue")
    .call(drag(simulation));

  const label = svg.append("g")
    .selectAll("text")
    .data(Object.values(nodes)).enter()
    .append("text")
    .text(d => d.id)
    .attr("dy", 4)
    .attr("text-anchor", "middle");

  simulation.on("tick", () => {
    node.attr("cx", d => d.x).attr("cy", d => d.y);
    label.attr("x", d => d.x).attr("y", d => d.y);
    link.attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
  });

  function drag(sim) {
    return d3.drag()
      .on("start", event => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      })
      .on("drag", event => {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      })
      .on("end", event => {
        if (!event.active) sim.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      });
  }
}

function renderTraceTimeline(traces) {
  const grouped = {};
  traces.forEach(span => {
    if (!grouped[span.trace_id]) grouped[span.trace_id] = [];
    grouped[span.trace_id].push(span);
  });

  let html = `<h3>Trace Timelines</h3>`;
  for (const traceId in grouped) {
    html += `<h4>${traceId}</h4><ul>`;
    grouped[traceId].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .forEach(span => {
        const color = span.status === 'error' ? 'red' : 'green';
        html += `<li style="color:${color}">${span.timestamp} - ${span.service} - ${span.operation} (${span.duration_ms}ms)</li>`;
      });
    html += `</ul>`;
  }

  document.getElementById("traceTimeline").innerHTML = html;
}