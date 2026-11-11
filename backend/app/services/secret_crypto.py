"""P1.5 — cifração em repouso de segredos (ai_settings.api_key) via Fernet.

Chave: derivada (SHA-256) da variável `ARCHIA_ENCRYPTION_SECRET`. Quando ausente
(ambiente de desenvolvimento), usa uma chave fallback ESTÁVEL E FRACA e loga
um warning — a produção DEVE definir ARCHIA_ENCRYPTION_SECRET.

Compatibilidade: valores legados em texto puro (sem o prefixo do marker) são
devolvidos inalterados em `decrypt_secret` e re-cifrados na próxima escrita.
"""

from __future__ import annotations

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

logger = logging.getLogger("archia.secret_crypto")

# Prefixo que marca um valor cifrado — permite distinguir legado em claro.
ENC_PREFIX = "archia-enc:v1:"
_FALLBACK_DEV_KEY_SEED = "archia-dev-insecure-fallback-key"


def _warn_fallback_once() -> None:
    if not getattr(_warn_fallback_once, "_warned", False):
        _warn_fallback_once._warned = True  # type: ignore[attr-defined]
        logger.warning(
            "ARCHIA_ENCRYPTION_SECRET não definido: usando chave de fallback insegura. "
            "Defina ARCHIA_ENCRYPTION_SECRET em produção."
        )


def _fernet() -> Fernet:
    """Fernet com chave derivada do segredo de ambiente (fallback em dev)."""
    seed = (settings.archia_encryption_secret or "").strip()
    if not seed:
        _warn_fallback_once()
        seed = _FALLBACK_DEV_KEY_SEED
    key = base64.urlsafe_b64encode(hashlib.sha256(seed.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    """Cifra um segredo e devolve a forma persistível (com marker)."""
    token = _fernet().encrypt((plaintext or "").encode("utf-8"))
    return ENC_PREFIX + token.decode("ascii")


def decrypt_secret(stored: str) -> str:
    """Devolve o segredo em claro. Valores legados (sem marker) voltam inalterados."""
    value = (stored or "").strip()
    if not value:
        return ""
    if not value.startswith(ENC_PREFIX):
        return value  # legado em texto puro — preservado p/ compatibilidade
    token = value[len(ENC_PREFIX):].encode("ascii")
    try:
        return _fernet().decrypt(token).decode("utf-8")
    except InvalidToken:
        # Chave mudou desde a cifra (nova ARCHIA_ENCRYPTION_SECRET): falha explícita.
        logger.error("secret_decrypt_failed valor não decifrável com a chave atual")
        raise ValueError("Segredo não pôde ser decifrado (chave de cifração mudou?).") from None


def is_encrypted(stored: str) -> bool:
    return (stored or "").startswith(ENC_PREFIX)
