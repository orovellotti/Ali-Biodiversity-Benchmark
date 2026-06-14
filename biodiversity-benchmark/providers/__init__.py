"""Registre des fournisseurs de modèles."""

from __future__ import annotations

from .anthropic_provider import AnthropicProvider, AnthropicSmallProvider
from .base import BaseProvider, ProviderError
from .gemini_provider import GeminiProvider
from .mistral_provider import MistralProvider
from .ollama_provider import OllamaProvider
from .openai_provider import OpenAIProvider, OpenAISmallProvider
from .openrouter_provider import (
    Gemma2_27BProvider,
    Gemma3_4BProvider,
    Llama32_1BProvider,
    Llama32_3BProvider,
    Llama33_70BProvider,
    Ministral8BProvider,
    MistralSmall24BProvider,
    Qwen25_7BProvider,
)

PROVIDER_CLASSES = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "mistral": MistralProvider,
    "gemini": GeminiProvider,
    "openai-small": OpenAISmallProvider,
    "anthropic-small": AnthropicSmallProvider,
    "ollama": OllamaProvider,
    # Petits modèles open-source via OpenRouter (intégration IA Replit).
    "llama-3.2-3b": Llama32_3BProvider,
    "llama-3.2-1b": Llama32_1BProvider,
    "qwen-2.5-7b": Qwen25_7BProvider,
    "ministral-8b": Ministral8BProvider,
    "gemma-3-4b": Gemma3_4BProvider,
    "llama-3.3-70b": Llama33_70BProvider,
    "mistral-small-24b": MistralSmall24BProvider,
    "gemma-2-27b": Gemma2_27BProvider,
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
