"""Fournisseur Ollama local (HTTP, sans dépendance externe)."""

from __future__ import annotations

import json
import urllib.error
import urllib.request

import config

from .base import BaseProvider, ProviderError


class OllamaProvider(BaseProvider):
    name = "ollama"

    def is_available(self) -> bool:
        """Vérifie que le serveur Ollama local répond."""
        url = f"{config.OLLAMA_HOST}/api/tags"
        try:
            with urllib.request.urlopen(url, timeout=3) as resp:
                return resp.status == 200
        except Exception:
            return False

    def _generate(self, system: str, user: str) -> str:
        url = f"{config.OLLAMA_HOST}/api/chat"
        payload = {
            "model": self.model,
            "stream": False,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "options": {
                "temperature": config.TEMPERATURE,
                "num_predict": config.MAX_TOKENS,
            },
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=config.REQUEST_TIMEOUT) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.URLError as exc:  # pragma: no cover - réseau
            raise ProviderError(f"Erreur Ollama : {exc}") from exc

        content = (body.get("message", {}) or {}).get("content", "").strip()
        if not content:
            raise ProviderError("Réponse Ollama vide.")
        return content
