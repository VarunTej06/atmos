# Atmos Architecture

## Services
- **Frontend**: React/TypeScript Bento UI. Saved locations and user preferences are stored in browser localStorage.
- **Weather Service**: FastAPI adapter around the selected external weather provider.

## Data Storage
- Saved locations and preferences are persisted in the browser via localStorage — no database required for the current architecture.

## Planned
- CI/CD pipeline with quality gates.
- Playwright end-to-end testing.
- Azure Container Apps deployment.
- Consumer and enterprise OIDC authentication.
- Notification service and asynchronous delivery.
- AI service grounded in provider weather data.
- Azure Key Vault and managed identity.
- Prometheus, Grafana and centralized logs.
