"""
LLM 서비스 추상화 — 환경변수 LLM_PROVIDER 값으로 백엔드 전환

  LLM_PROVIDER=local   → Ollama (로컬 모델)
  LLM_PROVIDER=claude  → Anthropic Claude API (외부)

환경변수 정리:
  LLM_PROVIDER     local | claude          (기본: local)
  OLLAMA_URL       http://localhost:11434  (기본값)
  OLLAMA_MODEL     llama3.2                (기본값)
  ANTHROPIC_API_KEY  sk-ant-...            (claude 사용 시 필수)
  CLAUDE_MODEL     claude-sonnet-4-6       (기본값)
"""

import os
import httpx

LLM_PROVIDER   = os.getenv("LLM_PROVIDER", "local")       # "local" | "claude"

OLLAMA_URL     = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL   = os.getenv("OLLAMA_MODEL", "llama3.2")

ANTHROPIC_KEY  = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL   = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")

_TIMEOUT = 120


class LLMService:

    async def complete(self, prompt: str) -> str:
        """프롬프트를 받아 텍스트 응답을 반환. 실패 시 예외 raise."""
        if LLM_PROVIDER == "claude":
            return await self._call_claude(prompt)
        return await self._call_local(prompt)

    # ── Local (Ollama) ──────────────────────────────────────────────────────

    async def _call_local(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            )
            resp.raise_for_status()
            return resp.json().get("response", "")

    # ── Claude API ──────────────────────────────────────────────────────────

    async def _call_claude(self, prompt: str) -> str:
        if not ANTHROPIC_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다")

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": CLAUDE_MODEL,
                    "max_tokens": 2048,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            return resp.json()["content"][0]["text"]


llm_service = LLMService()
