"""Fournisseur Mistral AI."""

from __future__ import annotations

import config

from .base import BaseProvider, ProviderError


class MistralProvider(BaseProvider):
    name = "mistral"

    def __init__(self, model: str | None = None):
        super().__init__(model)
        self._client = None

    def _get_client(self):
        if self._client is None:
            api_key = config.get_api_key("mistral")
            if not api_key:
                raise ProviderError("MISTRAL_API_KEY manquante.")
            try:
                from mistralai import Mistral
            except ImportError as exc:  # pragma: no cover
                raise ProviderError(f"SDK mistralai non installé : {exc}") from exc
            self._client = Mistral(api_key=api_key)
        return self._client

    def is_available(self) -> bool:
        return bool(config.get_api_key("mistral"))

    def _generate(self, system: str, user: str) -> str:
        client = self._get_client()
        resp = client.chat.complete(
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
            raise ProviderError("Réponse Mistral vide.")
        if isinstance(content, list):
            # Certaines versions renvoient une liste de chunks de contenu.
            content = "".join(
                getattr(chunk, "text", "") if not isinstance(chunk, str) else chunk
                for chunk in content
            )
        return content.strip()
