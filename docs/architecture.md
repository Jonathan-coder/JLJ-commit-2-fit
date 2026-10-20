# Architecture – Commit to Fit

Web-based, responsive app (runs in the mobile browser). It talks to a
JavaScript (Node.js) backend via REST/JSON. Data is stored in PostgreSQL.
Product data can also come from Open Food Facts. The Sprint 2 scope is
highlighted in green.

```mermaid
flowchart TD
    subgraph Client [Web App - responsive, browser]
        direction TB
        C1[Login / Register]
        C2[Product search]
        C3[Barcode scan / manual entry]
        C4[Intake logging]
        C5[Diary & history]
        C6[Profile & targets]
        C7[Fasting timer]
    end

    subgraph Backend [Backend - Node.js REST API]
        direction TB
        B1[Auth API<br/>register, login, JWT]
        B2[Product API<br/>create, search, barcode, no duplicates]
        B3[Intake API<br/>log, diary, history]
        B4[Profile API<br/>height, weight, age, activity]
        B5[Warning logic<br/>target kcal/macros vs. intake]
        B6[Open Food Facts client]
        B7[OpenAPI / Swagger docs]
    end

    subgraph DB [PostgreSQL Database]
        direction TB
        D1[(users)]
        D2[(user_profiles)]
        D3[(products<br/>barcode UNIQUE)]
        D4[(intake_logs)]
        D5[(fasting_sessions)]
    end

    EXT[Open Food Facts API]

    Client -->|REST / JSON + JWT| Backend
    Backend -->|SQL / ORM| DB
    B6 -->|HTTPS| EXT

    B1 --> D1
    B2 --> D3
    B3 --> D4
    B4 --> D2
    B5 --> D2
    B5 --> D4
    B3 --> B5
    B2 --> B6
    C7 -.->|optional: save sessions| D5

    classDef sprint2 fill:#d4edda,stroke:#2e7d32,color:#000;
    class B1,B2,B7,D1,D3 sprint2;
```

## Notes
- **Multi-device:** The state lives on the server (JWT per device), so one account can be used on several devices.
- **Shared products:** `products` is global, and `barcode` is unique, so duplicates return `409`.
- **Warnings:** The backend computes the daily target from the profile (formula still open with the PO) and compares it with the sum of `intake_logs`.
- **Fasting timer:** It runs in the client. Saving sessions in `fasting_sessions` is optional, pending the PO answer.
- **Sprint 2 scope:** Auth, Product API, DB schema (`users`, `products`) and the OpenAPI docs.
