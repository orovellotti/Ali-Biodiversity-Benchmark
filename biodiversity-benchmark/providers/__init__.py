"""Registre des fournisseurs de modèles."""

from __future__ import annotations

from .anthropic_provider import AnthropicProvider
from .base import BaseProvider, ProviderError
from .gemini_provider import GeminiProvider
from .mistral_provider import MistralProvider
from .ollama_provider import OllamaProvider
from .openai_provider import OpenAIProvider, OpenAISmallProvider

PROVIDER_CLASSES = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "mistral": MistralProvider,
    "gemini": GeminiProvider,
    "openai-small": OpenAISmallProvider,
    "ollama": OllamaProvider,
}


def get_provider(name: str, model: str | None = None) -> BaseProvider:
    """Instancie un fournisseur par son nom."""
    name = name.lower().strip()
    if name not in PROVIDER_CLASSES:
        raise ValueError(
            f"Fournisseur inconnu : {name!r}. "
            f"Disponibles : {', '.join(PROVIDER_CLASSES)}"
        )
    return PROVIDER_CLASSES[name](model=model)


__all__ = [
    "BaseProvider",
    "ProviderError",
    "PROVIDER_CLASSES",
    "get_provider",
]
