import os
import io
import re
import json
import hashlib

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader

load_dotenv()

PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()  # gemini | groq | openai
MAX_CHARS = int(os.getenv("MAX_CHARS", "6000"))         # keep small = fast demo

app = FastAPI(title="EduAccess AI")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE = {}  # stands in for ChromaDB: same PDF text -> no repeat LLM call

PROMPT = """You are a friendly study tutor. Make the academic text below quick and
easy for any student to understand: short sentences, plain words, one idea at a
time, jargon explained in brackets. Return ONLY a JSON object with exactly
these keys:

{
  "simplified": "plain-language explanation, short sentences, simple words, jargon explained in brackets, max 250 words",
  "key_points": ["5 to 7 short bullet strings"],
  "mermaid": "a valid Mermaid flowchart string starting with 'graph TD'",
  "flashcards": [{"q": "question", "a": "short answer"}]
}

Rules for "mermaid":
- Start with: graph TD
- Use simple node ids (A, B, C...) and put labels in square brackets with plain
  words only, e.g. A[Photosynthesis] --> B[Light energy]
- No parentheses, quotes, colons or special characters inside labels
- 6 to 10 nodes, separate statements with newlines

Rules for "flashcards": give 5 cards, answers under 20 words.

TEXT:
<<TEXT>>
"""


def call_llm(prompt: str) -> str:
    """Single place that talks to the AI. Swap provider via LLM_PROVIDER in .env."""
    if PROVIDER == "gemini":
        from google import genai
        client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        resp = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
        return resp.text

    if PROVIDER in ("groq", "openai"):
        from openai import OpenAI
        if PROVIDER == "groq":
            client = OpenAI(
                api_key=os.environ["GROQ_API_KEY"],
                base_url="https://api.groq.com/openai/v1",
            )
            model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        else:
            client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
            model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        return resp.choices[0].message.content

    raise RuntimeError(f"Unknown LLM_PROVIDER: {PROVIDER}")


def parse_json(raw: str) -> dict:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()
    return json.loads(raw)


def clean_mermaid(code: str) -> str:
    code = re.sub(r"```(?:mermaid)?", "", code).strip()
    if not code.startswith(("graph", "flowchart")):
        code = "graph TD\n" + code
    return code


def run_pipeline(text: str) -> dict:
    text = text.strip()[:MAX_CHARS]
    if len(text) < 50:
        raise HTTPException(
            422,
            "Could not read text from this PDF (it may be scanned images). "
            "Try a text-based PDF or use /process-text.",
        )

    key = hashlib.sha256(text.encode()).hexdigest()
    if key in CACHE:
        return CACHE[key]

    raw = call_llm(PROMPT.replace("<<TEXT>>", text))
    try:
        data = parse_json(raw)
    except json.JSONDecodeError:
        raise HTTPException(502, "AI returned invalid JSON. Please retry.")

    result = {
        "simplified": data.get("simplified", ""),
        "key_points": data.get("key_points", []),
        "mermaid": clean_mermaid(data.get("mermaid", "graph TD\nA[No diagram]")),
        "flashcards": data.get("flashcards", []),
    }
    CACHE[key] = result
    return result


class TextIn(BaseModel):
    text: str


@app.get("/health")
def health():
    return {"status": "ok", "provider": PROVIDER}


# Plain `def` (not async) so FastAPI runs the blocking LLM call in a thread pool.
@app.post("/process")
def process(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a PDF file.")
    try:
        reader = PdfReader(io.BytesIO(file.file.read()))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:
        raise HTTPException(400, "Could not open this PDF.")
    return run_pipeline(text)


@app.post("/process-text")
def process_text(body: TextIn):
    """Fallback for the demo: paste text if a PDF misbehaves."""
    return run_pipeline(body.text)
