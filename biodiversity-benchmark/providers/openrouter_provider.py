"""Fournisseurs OpenRouter (modèles open-source via le proxy d'intégrations IA Replit).

OpenRouter expose une API compatible OpenAI ; on réutilise donc le SDK OpenAI en
le pointant vers le proxy Replit. L'accès est fourni par les intégrations IA
Replit : pas de clé personnelle à fournir, la facturation passe par les crédits.

Variables d'environnement (positionnées automatiquement par l'intégration) :
- ``AI_INTEGRATIONS_OPENROUTER_BASE_URL``
- ``AI_INTEGRATIONS_OPENROUTER_API_KEY``

Chaque petit modèle open-source est exposé comme un fournisseur distinct (un
identifiant = un modèle dans l'UI), tous partageant la même classe de base.
"""

from __future__ import annotations

import os

import config

from .base import BaseProvider, ProviderError

BASE_URL_ENV = "AI_INTEGRATIONS_OPENROUTER_BASE_URL"
API_KEY_ENV = "AI_INTEGRATIONS_OPENROUTER_API_KEY"


class OpenRouterProvider(BaseProvider):
    """Base commune : appelle OpenRouter via le SDK OpenAI (compatible)."""

    name = "openrouter"

    def __init__(self, model: str | None = None):
        super().__init__(model)
        self._client = None

    def _get_client(self):
        if self._client is None:
            base_url = os.environ.get(BASE_URL_ENV)
            api_key = os.environ.get(API_KEY_ENV)
            if not base_url or not api_key:
                raise ProviderError(
                    "Intégration OpenRouter non configurée "
                    f"({BASE_URL_ENV} / {API_KEY_ENV} manquantes)."
                )
            try:
                from openai import OpenAI
            except ImportError as exc:  # pragma: no cover
                raise ProviderError(f"SDK openai non installé : {exc}") from exc
            self._client = OpenAI(
                base_url=base_url,
                api_key=api_key,
                timeout=config.REQUEST_TIMEOUT,
            )
        return self._client

    def is_available(self) -> bool:
        return bool(os.environ.get(BASE_URL_ENV) and os.environ.get(API_KEY_ENV))

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
            raise ProviderError(f"Réponse OpenRouter vide ({self.model}).")
        return content.strip()


class Llama32_3BProvider(OpenRouterProvider):
    name = "llama-3.2-3b"


class Llama32_1BProvider(OpenRouterProvider):
    name = "llama-3.2-1b"


class Qwen25_7BProvider(OpenRouterProvider):
    name = "qwen-2.5-7b"


class Ministral8BProvider(OpenRouterProvider):
    name = "ministral-8b"


class Gemma3_4BProvider(OpenRouterProvider):
    name = "gemma-3-4b"


class Llama33_70BProvider(OpenRouterProvider):
    name = "llama-3.3-70b"


class MistralSmall24BProvider(OpenRouterProvider):
    name = "mistral-small-24b"


class Gemma2_27BProvider(OpenRouterProvider):
    name = "gemma-2-27b"
