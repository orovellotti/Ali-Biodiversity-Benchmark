"""Fournisseur OpenAI (Chat Completions)."""

from __future__ import annotations

import config

from .base import BaseProvider, ProviderError


class OpenAIProvider(BaseProvider):
    name = "openai"

    def __init__(self, model: str | None = None):
        super().__init__(model)
        self._client = None

    def _get_client(self):
        if self._client is None:
            api_key = config.get_api_key("openai")
            if not api_key:
                raise ProviderError("OPENAI_API_KEY manquante.")
            try:
                from openai import OpenAI
            except ImportError as exc:  # pragma: no cover
                raise ProviderError(f"SDK openai non installé : {exc}") from exc
            self._client = OpenAI(api_key=api_key, timeout=config.REQUEST_TIMEOUT)
        return self._client

    def is_available(self) -> bool:
        return bool(config.get_api_key("openai"))

    def _generate(self, system: str, user: str) -> str:
        client = self._get_client()
        resp = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=config.TEMPERATURE,
            max_tokens=config.MAX_TOKENS,
        )
        content = resp.choices[0].message.content
        if not content:
            raise ProviderError("Réponse OpenAI vide.")
        return content.strip()
