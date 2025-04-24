from flask import Blueprint, request, jsonify
import datetime

trace_blueprint = Blueprint('traces', __name__)
trace_store = []

@trace_blueprint.route('/api/traces', methods=['POST', 'GET'])
def handle_traces():
    if request.method == 'POST':
        # Ingest new spans
        traces = request.json.get('traces', [])
        for span in traces:
            span['ingested_at'] = datetime.datetime.utcnow().isoformat()
            trace_store.append(span)
        return jsonify({"status": "success", "count": len(traces)}), 200

    else:  # GET
        # Return all ingested spans
        return jsonify(trace_store), 200

def correlate_traces_with_alerts(alerts):
    correlated = []
    for alert in alerts:
        alert_time = datetime.datetime.fromisoformat(alert['timestamp'])
        matched = []
        for trace in trace_store:
            if trace.get('service') == alert.get('service'):
                trace_time = datetime.datetime.fromisoformat(trace['timestamp'])
                if abs((trace_time - alert_time).total_seconds()) < 300:
                    matched.append(trace)
        if matched:
            alert['traces'] = matched
        correlated.append(alert)
    return correlated