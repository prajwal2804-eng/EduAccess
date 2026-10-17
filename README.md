# EduAccess AI - Backend

FastAPI backend that transforms academic texts and PDFs into easy-to-understand study materials, key points, Mermaid flowcharts, and flashcards using LLM inference (Groq/Gemini/OpenAI).

## Features
- **PDF & Text Processing**: Extract text from uploaded PDFs or raw text inputs.
- **AI-Powered Simplification**: Generates plain-language explanations with jargon defined in brackets.
- **Visuals & Review**: Generates valid Mermaid diagram flowcharts and study flashcards.
- **Fast & Flexible**: Supports Groq, Google Gemini, and OpenAI with built-in caching.

## Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/<your-repo-name>.git
cd <your-repo-name>
```

### 2. Create and activate a Virtual Environment
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your API key:
```bash
cp .env.example .env
```
Edit `.env`:
```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=qwen/qwen3.8-27b
MAX_CHARS=6000
```

### 5. Run the Server
```bash
python -m uvicorn main:app --reload
```
The API will be live at `http://127.0.0.1:8000`. Interactive documentation is available at `http://127.0.0.1:8000/docs`.
