"""Interface commune à tous les fournisseurs de modèles."""

from __future__ import annotations

import abc

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

import config


class ProviderError(Exception):
    """Erreur levée quand un fournisseur ne peut pas répondre."""


class BaseProvider(abc.ABC):
    """Classe de base : chaque fournisseur implémente `_generate`."""

    #: identifiant court du fournisseur (ex: "openai")
    name: str = "base"

    def __init__(self, model: str | None = None):
        self.model = model or config.DEFAULT_MODELS.get(self.name, "")

    @abc.abstractmethod
    def is_available(self) -> bool:
        """Indique si le fournisseur est utilisable (clé présente, SDK ok)."""
        raise NotImplementedError

    @abc.abstractmethod
    def _generate(self, system: str, user: str) -> str:
        """Appelle réellement l'API et renvoie le texte de la réponse."""
        raise NotImplementedError

    def generate(self, system: str, user: str) -> str:
        """Génère une réponse avec gestion des retries (tenacity)."""

        @retry(
            reraise=True,
            stop=stop_after_attempt(config.MAX_RETRIES),
            wait=wait_exponential(multiplier=1, min=2, max=30),
            retry=retry_if_exception_type(Exception),
        )
        def _call() -> str:
            return self._generate(system, user)

        return _call()

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<{self.__class__.__name__} model={self.model!r}>"
