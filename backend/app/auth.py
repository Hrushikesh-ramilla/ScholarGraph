import time
from typing import Any

import httpx
import jwt
from langgraph_sdk import Auth

from app.core.config import settings

auth = Auth()

# In-process JWKS cache — avoids a network round-trip on every request
_jwks_data: dict | None = None
_jwks_fetched_at: float = 0.0
_JWKS_TTL = 3600.0  # refresh keys at most once per hour


async def _get_signing_key(token: str) -> Any:
    """Fetch Google JWKS asynchronously (httpx) and return the matching signing key."""
    global _jwks_data, _jwks_fetched_at

    now = time.monotonic()
    if _jwks_data is None or now - _jwks_fetched_at > _JWKS_TTL:
        async with httpx.AsyncClient() as client:
            resp = await client.get(settings.GOOGLE_JWKS_URL)
            resp.raise_for_status()
            _jwks_data = resp.json()
            _jwks_fetched_at = now

    kid = jwt.get_unverified_header(token).get("kid")
    jwk_set = jwt.PyJWKSet.from_dict(_jwks_data)
    for jwk in jwk_set.keys:
        if jwk.key_id == kid:
            return jwk.key

    # Refresh keys once in case Google rotated them
    if now - _jwks_fetched_at > 10.0:
        async with httpx.AsyncClient() as client:
            resp = await client.get(settings.GOOGLE_JWKS_URL)
            resp.raise_for_status()
            _jwks_data = resp.json()
            _jwks_fetched_at = now
        jwk_set = jwt.PyJWKSet.from_dict(_jwks_data)
        for jwk in jwk_set.keys:
            if jwk.key_id == kid:
                return jwk.key

    raise jwt.PyJWTError(f"No signing key found for kid={kid!r}")


@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    # If no token provided and DISABLE_AUTH is enabled, use local researcher session
    if settings.DISABLE_AUTH and not authorization:
        return {"identity": "local-researcher", "is_authenticated": True}

    if not authorization or not authorization.startswith("Bearer "):
        if settings.DISABLE_AUTH:
            return {"identity": "local-researcher", "is_authenticated": True}
        raise Auth.exceptions.HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        if settings.DISABLE_AUTH:
            return {"identity": "local-researcher", "is_authenticated": True}
        raise Auth.exceptions.HTTPException(status_code=401, detail="Empty bearer token")

    try:
        signing_key = await _get_signing_key(token)
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as e:
        if settings.DISABLE_AUTH:
            return {"identity": "local-researcher", "is_authenticated": True}
        raise Auth.exceptions.HTTPException(status_code=401, detail=str(e))

    identity = payload.get("email") or payload.get("sub", "authenticated-user")
    return {"identity": identity, "is_authenticated": True}


@auth.on
async def owner_only(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """Scope every thread, run, assistant, and cron to the authenticated user."""
    metadata = value.setdefault("metadata", {})
    metadata["owner"] = ctx.user.identity
    return {"owner": ctx.user.identity}
