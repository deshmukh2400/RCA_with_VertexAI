from flask import Blueprint, request, jsonify
import datetime

trace_blueprint = Blueprint('traces', __name__)
trace_store = []

def parse_iso(ts: str) -> datetime.datetime:
    """
    Parse an ISO-8601 timestamp, handling the 'Z' suffix as UTC.
    """
    # If ends with 'Z', convert to '+00:00' for fromisoformat
    if ts.endswith('Z'):
        ts = ts[:-1] + '+00:00'
    return datetime.datetime.fromisoformat(ts)

@trace_blueprint.route('/api/traces', methods=['POST', 'GET'])
def handle_traces():
    if request.method == 'POST':
        spans = request.json.get('traces', [])
        for span in spans:
            # Normalize and store
            span['ingested_at'] = datetime.datetime.utcnow().isoformat() + 'Z'
            # Ensure timestamp is parseable
            span['timestamp'] = parse_iso(span['timestamp']).isoformat()
            trace_store.append(span)
        return jsonify({"status": "success", "count": len(spans)}), 200
    else:
        # On GET, return raw store
        return jsonify(trace_store), 200

def correlate_traces_with_alerts(alerts):
    correlated = []
    for alert in alerts:
        # Normalize alert timestamp, too
        alert_time = parse_iso(alert['timestamp'])
        matched = []
        for trace in trace_store:
            if trace.get('service') == alert.get('service'):
                trace_time = parse_iso(trace['timestamp'])
                # within ±5 minutes?
                if abs((trace_time - alert_time).total_seconds()) < 300:
                    matched.append(trace)
        if matched:
            alert['traces'] = matched
        correlated.append(alert)
    return correlated