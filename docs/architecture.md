```mermaid
flowchart TD
    subgraph App [Mobile App]
        direction TB
        P[Products] --> S[Scanner]
        I[Intake] --> H[History]
        F[Fasting Timer]
    end

    subgraph Backend [Backend]
        direction TB
        B1[Product API]
        B2[Intake API]
        B3[User API]
    end

    subgraph DB [PostgreSQL Database]
        direction TB
        D1[users]
        D2[products]
        D3[intake_logs]
    end

    App -->|REST / JSON| Backend
    Backend -->|SQL / ORM| DB