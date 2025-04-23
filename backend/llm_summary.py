import vertexai
from vertexai.generative_models import GenerativeModel, Part
import json

vertexai.init(project="your-gcp-project-id", location="us-central1")

class RCASummaryLLM:
    def __init__(self, model_name="gemini-1.0-pro"):
        self.model = GenerativeModel(model_name)

    def deduplicate_lines(self, title, data):
        if not data:
            return f"No {title.lower()} available."
        
        try:
            parsed = json.loads(data)
            if isinstance(parsed, list):
                unique_items = {json.dumps(item, sort_keys=True) for item in parsed}
                lines = [json.loads(item) for item in unique_items]
                summary = f"### {title}:\n" + json.dumps(lines, indent=2)
            else:
                summary = f"### {title}:\n" + json.dumps(parsed, indent=2)
        except Exception:
            # Fallback if data isn't valid JSON
            unique_lines = list(dict.fromkeys(data.strip().splitlines()))
            summary = f"### {title}:\n" + "\n".join(unique_lines)
        return summary

    def build_prompt(self, alerts, changes, traces, cmdb):
        return f"""
You are an expert Site Reliability Engineer working in a large banking environment. You are responsible for analyzing system-wide issues across services like Core Banking, Payments, Internet Banking, and Middleware.

Your inputs are:
- **Alerts** from monitoring systems
- **Change records** (completed or in-progress)
- **Traces** showing runtime behavior of services
- **CMDB data** defining dependencies between components

Based on the following data, identify:
1. If this is a **service degradation or outage**
2. The **most probable root cause** (infra, change, application, config, etc.)
3. Affected **business services**
4. A **step-by-step explanation**
5. **Missing or inconclusive signals**, if applicable

{self.deduplicate_lines("Alerts", alerts)}
{self.deduplicate_lines("Changes", changes)}
{self.deduplicate_lines("Traces", traces)}
{self.deduplicate_lines("CMDB Relationships", cmdb)}

Please analyze and answer:
- What is the most probable root cause of the issue?
- Is it linked to a recent change? Or is it an infrastructure failure?
- What evidence supports this?
- Which systems are impacted, and how?

Respond concisely and professionally.
"""

    def get_summary(self, alerts, changes, traces, cmdb):
        prompt = self.build_prompt(alerts, changes, traces, cmdb)

        response = self.model.generate_content(
            Part.from_text(prompt),
            generation_config={
                "temperature": 0.3,
                "max_output_tokens": 1024,
                "top_k": 40,
                "top_p": 0.9
            }
        )

        return response.text.strip()
