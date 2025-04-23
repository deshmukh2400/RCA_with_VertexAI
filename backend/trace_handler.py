from flask import Blueprint, request, jsonify
import datetime

# Blueprint for trace ingestion endpoints
trace_blueprint = Blueprint('traces', __name__)
# In-memory store for traces (for demo purposes)
trace_store = []

@trace_blueprint.route('/api/traces', methods=['POST'])
def ingest_traces():
    """
    Ingest a batch of trace spans posted as JSON:
    {
      "traces": [ { ...span data... }, ... ]
    }
    Each span will get an 'ingested_at' timestamp and be stored in memory.
    """
    traces = request.json.get('traces', [])
    for trace in traces:
        trace['ingested_at'] = datetime.datetime.utcnow().isoformat()
        trace_store.append(trace)
    return jsonify({"status": "success", "count": len(traces)}), 200

def correlate_traces_with_alerts(alerts):
    """
    For each alert, find any traces in trace_store that:
      - Belong to the same service as the alert
      - Occurred within ±5 minutes of the alert timestamp
    Attach matching traces under alert['traces'].
    """
    correlated = []
    for alert in alerts:
        alert_time = datetime.datetime.fromisoformat(alert['timestamp'])
        matched = []
        for trace in trace_store:
            if trace.get('service') == alert.get('service'):
                trace_time = datetime.datetime.fromisoformat(trace['timestamp'])
                # time difference in seconds
                if abs((trace_time - alert_time).total_seconds()) < 300:
                    matched.append(trace)
        if matched:
            alert['traces'] = matched
        correlated.append(alert)
    return correlated