# backend/trace_handler.py

from flask import Blueprint, request, jsonify
import datetime

# Define the blueprint
trace_blueprint = Blueprint('traces', __name__)

# In-memory store for all ingested spans
trace_store = []

def parse_iso(ts: str) -> datetime.datetime:
    """
    Parse timestamps in ISO-8601 format, handling the 'Z' suffix.
    """
    if ts.endswith('Z'):
        ts = ts[:-1] + '+00:00'
    return datetime.datetime.fromisoformat(ts)

@trace_blueprint.route('/api/traces', methods=['POST', 'GET'])
def handle_traces():
    global trace_store  # make sure we refer to the module-level variable
    if request.method == 'POST':
        spans = request.json.get('traces', [])
        for span in spans:
            # Normalize the incoming timestamp
            parsed = parse_iso(span['timestamp'])
            span['timestamp'] = parsed.isoformat()
            # Tag with ingestion time
            span['ingested_at'] = datetime.datetime.utcnow().isoformat() + 'Z'
            trace_store.append(span)
        return jsonify({"status": "success", "count": len(spans)}), 200

    # GET: return everything we’ve stored
    return jsonify(trace_store), 200

def correlate_traces_with_alerts(alerts):
    """
    For each alert, attach any traces from trace_store
    within ±5 minutes for the same service.
    """
    correlated = []
    for alert in alerts:
        alert_time = parse_iso(alert['timestamp'])
        matched = [
            t for t in trace_store
            if t.get('service') == alert.get('ci') and
               abs((parse_iso(t['timestamp']) - alert_time).total_seconds()) < 300
        ]
        if matched:
            alert['traces'] = matched
        correlated.append(alert)
    return correlated