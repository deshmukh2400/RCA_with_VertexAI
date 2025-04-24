import traceback
from flask import Flask, jsonify, render_template, request
import json
from llm_summary import RCASummaryLLM
from graph_builder import build_relationship_graph
from trace_handler import trace_blueprint, correlate_traces_with_alerts

app = Flask(__name__, template_folder="templates", static_folder="static")
# Register the traces blueprint so /api/traces is available
app.register_blueprint(trace_blueprint)

# Load default/mock data
with open("data/alerts.json") as f:
    default_alerts = json.load(f)
with open("data/changes.json") as f:
    default_changes = json.load(f)
with open("data/cmdb.json") as f:
    default_cmdb = json.load(f)

# Instantiate the LLM engine (Gemini-based RCA)
llm_engine = RCASummaryLLM()

def build_alert_timeline(alerts):
    return sorted(alerts, key=lambda x: x["timestamp"])

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/rca", methods=["GET", "POST"])
def api_rca():
    try:
        if request.method == "POST":
            data    = request.get_json()
            alerts  = data.get("alerts", [])
            changes = data.get("changes", [])
            cmdb    = data.get("cmdb", {})
            traces  = data.get("traces", [])
        else:
            alerts, changes, cmdb = default_alerts, default_changes, default_cmdb
            traces = []

        # correlate and timeline
        alerts = correlate_traces_with_alerts(alerts)
        timeline = build_alert_timeline(alerts)

        # get summary
        summary = llm_engine.get_summary(
            alerts=json.dumps(alerts),
            changes=json.dumps(changes),
            traces=json.dumps(traces),
            cmdb=json.dumps(cmdb)
        )

        return jsonify({
            "root_cause": summary,
            "category": "AI-Powered Analysis",
            "timeline": timeline
        })
    except Exception as e:
        # Print full traceback to server logs
        traceback.print_exc()
        # Return error message to browser for quick debugging
        return jsonify({
            "error": str(e),
            "trace": traceback.format_exc().splitlines()[-3:]  # last few lines
        }), 500

@app.route("/api/cmdb")
def api_cmdb():
    return jsonify(default_cmdb)

if __name__ == "__main__":
    # Listen on all interfaces (0.0.0.0) so your VM/Docker can expose it
    app.run(host="0.0.0.0", port=5000, debug=True)