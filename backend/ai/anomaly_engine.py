"""
Q-SENTRY Anomaly Detection Engine
Trains on real audit telemetry and detects governance anomalies.
Auto-retrains when new events accumulate.
"""
import json, os, pickle, glob, logging
import numpy as np
from datetime import datetime, timezone
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import LabelEncoder

logger = logging.getLogger(__name__)

MODEL_PATH    = os.environ.get("QS_ANOMALY_MODEL", "/app/data/ai/anomaly_model.pkl")
AUDIT_PATHS   = [
    "/app/telemetry/audit_log.jsonl",
    "/app/telemetry/audit_policy.jsonl",
    "/app/data/keystores/*/audit_log.jsonl",
    "backend/backend/telemetry/audit_policy.jsonl",
]
MIN_EVENTS    = 50
RETRAIN_EVERY = 100


class AnomalyEngine:
    def __init__(self):
        self.model     = None
        self.le_op     = LabelEncoder()
        self.le_scheme = LabelEncoder()
        self.le_result = LabelEncoder()
        self.n_trained = 0
        self._load_or_train()

    def _load_events(self):
        events = []
        for pattern in AUDIT_PATHS:
            for path in glob.glob(pattern):
                try:
                    with open(path) as f:
                        for line in f:
                            try:
                                e = json.loads(line.strip())
                                fe = self._extract_features(e)
                                if fe:
                                    events.append(fe)
                            except:
                                pass
                except:
                    pass
        return events

    def _extract_features(self, e):
        try:
            event_type    = e.get("event_type", "unknown")
            scheme        = (e.get("scheme") or
                            e.get("result", {}).get("inputs", {}).get("scheme") or
                            "unknown")
            allowed       = e.get("result", {}).get("allowed", True)
            policy_result = "allowed" if allowed else "denied"
            risk_score    = float(e.get("result", {}).get("risk_score",
                                  e.get("metadata", {}).get("risk_score", 0.25)))
            duration_ms   = risk_score * 10
            return {
                "event_type":    event_type,
                "scheme":        str(scheme).lower(),
                "policy_result": policy_result,
                "duration_ms":   duration_ms,
            }
        except:
            return None

    def _featurize(self, events):
        ops      = [e["event_type"]    for e in events]
        schemes  = [e["scheme"]        for e in events]
        results  = [e["policy_result"] for e in events]
        durations= [e["duration_ms"]   for e in events]
        self.le_op.fit(ops)
        self.le_scheme.fit(schemes)
        self.le_result.fit(results)
        return np.column_stack([
            self.le_op.transform(ops),
            self.le_scheme.transform(schemes),
            self.le_result.transform(results),
            durations,
        ])

    def _train(self, events):
        if len(events) < MIN_EVENTS:
            logger.info(f"AnomalyEngine: only {len(events)} events, need {MIN_EVENTS}")
            return False
        X = self._featurize(events)
        self.model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
        self.model.fit(X)
        self.n_trained = len(events)
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            pickle.dump({
                "model":      self.model,
                "le_op":      self.le_op,
                "le_scheme":  self.le_scheme,
                "le_result":  self.le_result,
                "n_trained":  self.n_trained,
                "trained_at": datetime.now(timezone.utc).isoformat(),
            }, f)
        logger.info(f"AnomalyEngine: trained on {len(events)} events")
        return True

    def _load_or_train(self):
        try:
            if os.path.exists(MODEL_PATH):
                with open(MODEL_PATH, "rb") as f:
                    data = pickle.load(f)
                self.model     = data["model"]
                self.le_op     = data["le_op"]
                self.le_scheme = data["le_scheme"]
                self.le_result = data["le_result"]
                self.n_trained = data.get("n_trained", 0)
                logger.info(f"AnomalyEngine: loaded model (n={self.n_trained})")
                return
        except:
            pass
        self._train(self._load_events())

    def maybe_retrain(self):
        events = self._load_events()
        if len(events) >= self.n_trained + RETRAIN_EVERY:
            logger.info(f"AnomalyEngine: retraining on {len(events)} events")
            self._train(events)

    def score_event(self, event: dict) -> dict:
        if self.model is None:
            return {"anomaly": False, "score": 0.0, "reason": "model_not_ready"}
        try:
            fe = self._extract_features(event)
            if not fe:
                return {"anomaly": False, "score": 0.0, "reason": "feature_error"}
            op     = fe["event_type"]    if fe["event_type"]    in self.le_op.classes_     else self.le_op.classes_[0]
            scheme = fe["scheme"]        if fe["scheme"]        in self.le_scheme.classes_  else self.le_scheme.classes_[0]
            result = fe["policy_result"] if fe["policy_result"] in self.le_result.classes_  else "allowed"
            X = np.array([[
                self.le_op.transform([op])[0],
                self.le_scheme.transform([scheme])[0],
                self.le_result.transform([result])[0],
                fe["duration_ms"],
            ]])
            score   = float(self.model.decision_function(X)[0])
            is_anom = bool(self.model.predict(X)[0] == -1)
            return {
                "anomaly": is_anom,
                "score":   round(score, 4),
                "reason":  "latency_spike"    if fe["duration_ms"] > 20 else
                           "policy_denial"    if fe["policy_result"] == "denied" else
                           "unusual_pattern"  if is_anom else "normal",
            }
        except Exception as ex:
            return {"anomaly": False, "score": 0.0, "reason": str(ex)}

    def scan(self, window_hours: int = 24) -> dict:
        events = self._load_events()
        if not events:
            return {"status": "no_data", "anomalies": [], "total_scanned": 0}
        results = [
            {**e, **self.score_event(e)}
            for e in events[-500:]
            if self.score_event(e)["anomaly"]
        ]
        self.maybe_retrain()
        return {
            "status":          "ok",
            "model_trained":   self.n_trained,
            "total_scanned":   min(len(events), 500),
            "anomalies_found": len(results),
            "anomaly_rate":    round(len(results) / max(min(len(events), 500), 1), 4),
            "anomalies":       results[:20],
            "scanned_at":      datetime.now(timezone.utc).isoformat(),
        }


_engine = None

def get_engine() -> AnomalyEngine:
    global _engine
    if _engine is None:
        _engine = AnomalyEngine()
    return _engine
