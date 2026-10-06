"""Domain-level failures. `app.main` maps these onto HTTP status codes so
routers can stay free of error translation."""


class DomainError(Exception):
    """Base class. `status_code` is what the API layer will return."""

    status_code = 400
    code = "domain_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFound(DomainError):
    status_code = 404
    code = "not_found"


class PermissionDenied(DomainError):
    status_code = 403
    code = "permission_denied"


class NotAuthenticated(DomainError):
    status_code = 401
    code = "not_authenticated"


class Conflict(DomainError):
    status_code = 409
    code = "conflict"


class ValidationFailed(DomainError):
    status_code = 422
    code = "validation_failed"
