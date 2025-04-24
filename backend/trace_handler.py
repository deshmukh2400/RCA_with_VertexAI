# backend/trace_handler.py

from flask import Blueprint, request, jsonify
import datetime

# 1) Define the blueprint and in-memory store
trace_blueprint = Blueprint('traces', __name__)
trace_store = []

def parse_iso(ts: str) -> datetime.datetime:
    if ts.endswith('Z'):
        ts = ts[:-1] + '+00:00'
    return datetime.datetime.fromisoformat(ts)

# 2) Combined POST & GET handler
@trace_blueprint.route('/api/traces', methods=['POST', 'GET'])
def handle_traces():
    global trace_store

    if request.method == 'GET':
        # THIS is the part you asked about:
        # it returns all spans you’ve ingested so far
        return jsonify(trace_store), 200

    # Otherwise it’s a POST: ingest new spans
    spans = request.json.get('traces', [])
    for span in spans:
        # Normalize timestamp
        span['timestamp'] = parse_iso(span['timestamp']).isoformat()
        span['ingested_at'] = datetime.datetime.utcnow().isoformat() + 'Z'
        trace_store.append(span)
    return jsonify({"status": "success", "count": len(spans)}), 200

def correlate_traces_with_alerts(alerts):
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