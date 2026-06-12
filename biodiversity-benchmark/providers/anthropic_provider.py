"""Fournisseur Anthropic (Claude, Messages API)."""

from __future__ import annotations

import config

from .base import BaseProvider, ProviderError


class AnthropicProvider(BaseProvider):
    name = "anthropic"

    def __init__(self, model: str | None = None):
        super().__init__(model)
        self._client = None

    def _get_client(self):
        if self._client is None:
            api_key = config.get_api_key("anthropic")
            if not api_key:
                raise ProviderError("ANTHROPIC_API_KEY manquante.")
            try:
                from anthropic import Anthropic
            except ImportError as exc:  # pragma: no cover
                raise ProviderError(f"SDK anthropic non installé : {exc}") from exc
            self._client = Anthropic(api_key=api_key, timeout=config.REQUEST_TIMEOUT)
        return self._client

    def is_available(self) -> bool:
        return bool(config.get_api_key("anthropic"))

    def _generate(self, system: str, user: str) -> str:
        client = self._get_client()
        resp = client.messages.create(
            model=self.model,
            system=system,
            max_tokens=config.MAX_TOKENS,
            temperature=config.TEMPERATURE,
            messages=[{"role": "user", "content": user}],
        )
        parts = [
            block.text
            for block in resp.content
            if getattr(block, "type", None) == "text"
        ]
        text = "\n".join(parts).strip()
        if not text:
            raise ProviderError("Réponse Anthropic vide.")
        return text


class AnthropicSmallProvider(AnthropicProvider):
    """Petit modèle Claude volontairement plus léger (baseline de comparaison).

    Réutilise le client Anthropic et la clé ANTHROPIC_API_KEY, mais pointe par
    défaut vers un modèle plus léger (Claude Haiku).
    """

    name = "anthropic-small"
