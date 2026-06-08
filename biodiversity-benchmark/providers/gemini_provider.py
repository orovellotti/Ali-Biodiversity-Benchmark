"""Fournisseur Google Gemini (SDK google-genai)."""

from __future__ import annotations

import config

from .base import BaseProvider, ProviderError


class GeminiProvider(BaseProvider):
    name = "gemini"

    def __init__(self, model: str | None = None):
        super().__init__(model)
        self._client = None

    def _get_client(self):
        if self._client is None:
            api_key = config.get_api_key("gemini")
            if not api_key:
                raise ProviderError("GEMINI_API_KEY manquante.")
            try:
                from google import genai
            except ImportError as exc:  # pragma: no cover
                raise ProviderError(f"SDK google-genai non installé : {exc}") from exc
            self._client = genai.Client(api_key=api_key)
        return self._client

    def is_available(self) -> bool:
        return bool(config.get_api_key("gemini"))

    def _generate(self, system: str, user: str) -> str:
        client = self._get_client()
        from google.genai import types

        resp = client.models.generate_content(
            model=self.model,
            contents=user,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=config.TEMPERATURE,
                max_output_tokens=config.MAX_TOKENS,
            ),
        )
        text = (resp.text or "").strip()
        if not text:
            raise ProviderError("Réponse Gemini vide.")
        return text
