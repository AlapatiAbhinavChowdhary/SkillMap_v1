from __future__ import annotations

import os
import pickle
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
from sentence_transformers import SentenceTransformer
from sklearn.preprocessing import normalize as l2_normalize
from threading import Lock

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = Path(os.getenv("MODEL_DIR", BASE_DIR / "models"))
RESUME_CSV = BASE_DIR / "Resume.csv"
CLUSTER_RESULTS_CSV = MODEL_DIR / "cluster_results.csv"

URL_PATTERN = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
EMAIL_PATTERN = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b", re.IGNORECASE)
HTML_PATTERN = re.compile(r"<[^>]+>")
NON_TEXT_PATTERN = re.compile(r"[^a-z0-9+#/\s]")
WHITESPACE_PATTERN = re.compile(r"\s+")
SPLIT_PATTERN = re.compile(r"[,;/\n|•·\-]+")
SECTION_PATTERN = re.compile(r"(?is)\bskills?\b(.*)$")

BLOCKLIST = {
    "city",
    "state",
    "street",
    "avenue",
    "road",
    "zip",
    "phone",
    "email",
    "address",
    "name",
    "date",
    "year",
    "years",
    "month",
    "experience",
    "work",
    "job",
    "position",
    "role",
    "company",
    "university",
    "college",
    "school",
    "degree",
    "bachelor",
    "master",
    "summary",
    "objective",
    "reference",
    "skill",
    "ability",
    "knowledge",
    "proficient",
    "responsible",
    "using",
    "used",
    "use",
    "also",
    "well",
    "good",
    "new",
    "high",
    "large",
    "currently",
    "including",
    "within",
    "across",
    "various",
    "strong",
    "excellent",
    "team",
    "management",
    "development",
    "to",
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
}

COMMON_SKILL_STOPWORDS = BLOCKLIST | {
    "able",
    "accomplished",
    "administration",
    "advancement",
    "analysis",
    "analytical",
    "applications",
    "areas",
    "attention",
    "business",
    "client",
    "clients",
    "communication",
    "communications",
    "coordination",
    "customer",
    "quality",
    "meeting",
    "meetings",
    "driven",
    "efficiency",
    "focused",
    "leadership",
    "managed",
    "marketing",
    "microsoft",
    "multiple",
    "office",
    "organizational",
    "planning",
    "policy",
    "project",
    "projects",
    "recruitment",
    "reporting",
    "results",
    "sales",
    "skills",
    "teams",
    "training",
    "writing",
}


def load_pickle(path: Path) -> Any:
    with path.open("rb") as handle:
        return pickle.load(handle)


def read_dataframe(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Missing required file: {path}")
    return pd.read_csv(path, encoding="utf-8-sig", low_memory=False)


def clean_text(text: str) -> str:
    text = text or ""
    text = HTML_PATTERN.sub(" ", text)
    text = URL_PATTERN.sub(" ", text)
    text = EMAIL_PATTERN.sub(" ", text)
    text = text.lower()
    text = NON_TEXT_PATTERN.sub(" ", text)
    text = WHITESPACE_PATTERN.sub(" ", text).strip()
    return text


def normalize_phrase(text: str) -> str:
    text = clean_text(text)
    text = text.replace("/", " ")
    text = WHITESPACE_PATTERN.sub(" ", text).strip()
    return text


def extract_skills_from_resume(text: str) -> list[str]:
    if not isinstance(text, str) or not text.strip():
        return []

    segment = text
    matches = list(SECTION_PATTERN.finditer(text))
    if matches:
        segment = matches[-1].group(1)

    segment = HTML_PATTERN.sub(" ", segment)
    tokens = SPLIT_PATTERN.split(segment)
    skills: list[str] = []
    for token in tokens:
        phrase = normalize_phrase(token)
        if not phrase:
            continue
        if len(phrase) <= 3 or len(phrase) > 48:
            continue
        words = phrase.split()
        if all(word in COMMON_SKILL_STOPWORDS for word in words):
            continue
        if phrase in COMMON_SKILL_STOPWORDS:
            continue
        if phrase.isdigit():
            continue
        skills.append(phrase)
    return skills


def build_skill_vocabulary(resume_frame: pd.DataFrame) -> Counter:
    vocabulary: Counter[str] = Counter()
    for text in resume_frame["Resume_str"].fillna(""):
        vocabulary.update(extract_skills_from_resume(str(text)))
    return vocabulary


def pseudo_confidence(distances: np.ndarray) -> float:
    if distances.size == 0:
        return 0.0
    sorted_distances = np.sort(distances)
    if sorted_distances.size == 1:
        return 0.99
    best = float(sorted_distances[0])
    runner_up = float(sorted_distances[1])
    raw_score = 1.0 - (best / (runner_up + 1e-9))
    return float(np.clip(raw_score, 0.05, 0.99))


app = Flask(__name__)
CORS(app)

if not MODEL_DIR.exists():
    raise FileNotFoundError(f"Model directory not found: {MODEL_DIR}")

bert_model_name = load_pickle(MODEL_DIR / "bert_model_name.pkl")
umap_reducer = load_pickle(MODEL_DIR / "umap_reducer.pkl")
kmeans_model = load_pickle(MODEL_DIR / "kmeans_model.pkl")
cluster_name_source = load_pickle(MODEL_DIR / "cluster_names.pkl")

sentence_model: SentenceTransformer | None = None
sentence_model_lock = Lock()

resume_df = read_dataframe(RESUME_CSV).copy()
cluster_df = read_dataframe(CLUSTER_RESULTS_CSV).copy()

resume_df["ID"] = resume_df["ID"].astype(str)
cluster_df["ID"] = cluster_df["ID"].astype(str)
merged_df = resume_df.merge(cluster_df, on="ID", how="inner")
merged_df["cluster"] = merged_df["cluster"].astype(int)
merged_df["cluster_name"] = merged_df["cluster_name"].fillna("Unknown")

all_resume_texts = merged_df["Resume_str"].fillna("").astype(str).tolist()
skill_vocabulary = build_skill_vocabulary(merged_df)
cluster_counts = merged_df.groupby(["cluster", "cluster_name"]).size().reset_index(name="resume_count")
cluster_distribution = cluster_counts.sort_values("cluster").to_dict(orient="records")

cluster_skill_counter: dict[int, Counter[str]] = defaultdict(Counter)
cluster_sample_resumes: dict[int, list[dict[str, Any]]] = defaultdict(list)

for _, row in merged_df.iterrows():
    cluster_id = int(row["cluster"])
    skills = extract_skills_from_resume(str(row.get("Resume_str", "")))
    cluster_skill_counter[cluster_id].update(skills)
    if len(cluster_sample_resumes[cluster_id]) < 12:
        resume_text = str(row.get("Resume_str", ""))
        cluster_sample_resumes[cluster_id].append(
            {
                "id": str(row.get("ID", "")),
                "category": row.get("Category", ""),
                "snippet": re.sub(r"\s+", " ", resume_text[:420]).strip(),
                "skills": skills[:10],
            }
        )

cluster_lookup: dict[int, dict[str, Any]] = {}
for record in cluster_distribution:
    cluster_id = int(record["cluster"])
    name = record["cluster_name"]
    if isinstance(cluster_name_source, dict):
        name = cluster_name_source.get(cluster_id, name)
    elif isinstance(cluster_name_source, (list, tuple)) and cluster_id < len(cluster_name_source):
        name = cluster_name_source[cluster_id]
    cluster_lookup[cluster_id] = {
        "id": cluster_id,
        "name": name,
        "resume_count": int(record["resume_count"]),
        "top_skills": [skill for skill, _ in cluster_skill_counter[cluster_id].most_common(8)],
        "samples": cluster_sample_resumes[cluster_id],
    }

cluster_ids = sorted(cluster_lookup.keys())


def get_sentence_model() -> SentenceTransformer:
    global sentence_model

    if sentence_model is None:
        with sentence_model_lock:
            if sentence_model is None:
                sentence_model = SentenceTransformer(str(bert_model_name))
    return sentence_model


def build_cluster_features(text: str) -> tuple[int, str, float, list[str], list[float]]:
    cleaned = clean_text(text)
    if not cleaned:
        raise ValueError("resume_text cannot be empty")

    embedding = get_sentence_model().encode([cleaned], convert_to_numpy=True, show_progress_bar=False)
    embedding = l2_normalize(embedding)
    reduced = umap_reducer.transform(embedding)
    reduced = l2_normalize(reduced)

    prediction = int(kmeans_model.predict(reduced)[0])
    centers = np.asarray(kmeans_model.cluster_centers_)
    distances = np.linalg.norm(centers - reduced[0], axis=1)
    confidence = pseudo_confidence(distances)
    top_indices = np.argsort(distances)[:5]
    return prediction, cleaned, confidence, [int(index) for index in top_indices], distances.tolist()


def build_top_skills(text: str, cluster_id: int | None = None) -> list[str]:
    extracted = extract_skills_from_resume(text)
    if extracted:
        scored = Counter(extracted)
        return [skill for skill, _ in scored.most_common(6)]
    if cluster_id is not None and cluster_id in cluster_skill_counter:
        return [skill for skill, _ in cluster_skill_counter[cluster_id].most_common(6)]
    return [skill for skill, _ in skill_vocabulary.most_common(6)]


@app.get("/health")
def health() -> tuple[dict[str, str], int]:
    return {"status": "ok"}, 200


@app.post("/predict")
def predict() -> tuple[dict[str, Any], int]:
    payload = request.get_json(silent=True) or {}
    resume_text = str(payload.get("resume_text", "")).strip()
    if not resume_text:
        return {"error": "resume_text is required"}, 400

    cluster_id, _, confidence, nearest_clusters, distances = build_cluster_features(resume_text)
    cluster = cluster_lookup.get(cluster_id)
    if not cluster:
        return {"error": "Unable to map prediction to a known cluster"}, 500

    return (
        {
            "cluster_id": cluster_id,
            "cluster_name": cluster["name"],
            "confidence_score": round(confidence, 4),
            "top_skills": build_top_skills(resume_text, cluster_id),
            "nearest_clusters": [
                {
                    "cluster_id": cluster_ids[index],
                    "cluster_name": cluster_lookup[cluster_ids[index]]["name"],
                    "distance": round(float(distances[index]), 4),
                }
                for index in nearest_clusters
            ],
        },
        200,
    )


@app.get("/clusters")
def clusters() -> tuple[list[dict[str, Any]], int]:
    cluster_list = [
        {
            "id": cluster_lookup[cluster_id]["id"],
            "name": cluster_lookup[cluster_id]["name"],
            "resume_count": cluster_lookup[cluster_id]["resume_count"],
            "top_skills": cluster_lookup[cluster_id]["top_skills"],
        }
        for cluster_id in cluster_ids
    ]
    return cluster_list, 200


@app.get("/clusters/<int:cluster_id>/resumes")
def cluster_resumes(cluster_id: int) -> tuple[dict[str, Any], int]:
    cluster = cluster_lookup.get(cluster_id)
    if not cluster:
        return {"error": "Cluster not found"}, 404
    limit = max(1, min(int(request.args.get("limit", 8)), 20))
    return (
        {
            "cluster_id": cluster_id,
            "cluster_name": cluster["name"],
            "resumes": cluster_sample_resumes[cluster_id][:limit],
        },
        200,
    )


@app.post("/bulk-predict")
def bulk_predict() -> tuple[dict[str, Any], int]:
    payload = request.get_json(silent=True) or {}
    resumes = payload.get("resumes", [])
    if not isinstance(resumes, list) or not resumes:
        return {"error": "resumes must be a non-empty list"}, 400

    predictions: list[dict[str, Any]] = []
    for index, resume_text in enumerate(resumes):
        resume_text = str(resume_text).strip()
        if not resume_text:
            predictions.append({"index": index, "error": "Resume text is empty"})
            continue
        cluster_id, _, confidence, _, _ = build_cluster_features(resume_text)
        cluster = cluster_lookup[cluster_id]
        predictions.append(
            {
                "index": index,
                "cluster_id": cluster_id,
                "cluster_name": cluster["name"],
                "confidence_score": round(confidence, 4),
                "top_skills": build_top_skills(resume_text, cluster_id),
            }
        )

    return {"count": len(predictions), "predictions": predictions}, 200


@app.get("/stats")
def stats() -> tuple[dict[str, Any], int]:
    total_resumes = int(len(merged_df))
    cluster_distribution_payload = [
        {
            "id": cluster_id,
            "name": cluster_lookup[cluster_id]["name"],
            "resume_count": cluster_lookup[cluster_id]["resume_count"],
            "share": round(cluster_lookup[cluster_id]["resume_count"] / total_resumes * 100, 2) if total_resumes else 0,
            "top_skills": cluster_lookup[cluster_id]["top_skills"],
        }
        for cluster_id in cluster_ids
    ]
    top_skills_per_cluster = {
        str(cluster_id): [
            {"skill": skill, "count": int(count)}
            for skill, count in cluster_skill_counter[cluster_id].most_common(10)
        ]
        for cluster_id in cluster_ids
    }
    top_skills_overall = [
        {"skill": skill, "count": int(count)}
        for skill, count in skill_vocabulary.most_common(10)
    ]

    return (
        {
            "total_resumes": total_resumes,
            "clusters_found": len(cluster_ids),
            "top_skill_domains": top_skills_overall,
            "cluster_distribution": cluster_distribution_payload,
            "top_skills_per_cluster": top_skills_per_cluster,
        },
        200,
    )


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
