# Atmos Architecture

## Services
- Frontend: React/TypeScript Bento UI.
- Weather Service: FastAPI adapter around the selected external weather provider.
- User Service: FastAPI API for saved locations and preferences.
- PostgreSQL: local MVP persistence for user-service data.

## Planned
- Consumer and enterprise OIDC authentication.
- Notification service and asynchronous delivery.
- AI service grounded in provider weather data.
- Azure Key Vault and managed identity.
- AKS deployments, Terraform modules, CI/CD quality gates.
- Prometheus, Grafana and centralized logs.

## Important security boundary
The current User Service is a local MVP scaffold. It has no authentication and uses one global saved-location/preferences scope. Do not expose it to the internet or use it with real user data until identity, per-user data ownership, authorization and migrations are implemented.
