# Software Requirements Specification (SRS)
## WeatherPulse — Multi-Source Weather Intelligence PWA

**Document Version:** 1.0  
**Date:** 23 October 2026  
**Status:** Draft for development  
**Initial Coverage:** Indore, Madhya Pradesh, India  
**Primary Platform:** Progressive Web Application (PWA)  
**Database:** MongoDB

---

## 1. Introduction

### 1.1 Purpose
This document defines the software requirements for WeatherPulse, a Progressive Web Application that combines weather data from multiple providers, evaluates agreement and freshness, and presents a clear weather summary. It also enables users to share short-lived, location-aware weather photos that provide additional evidence about current local conditions.

### 1.2 Product Scope
WeatherPulse will initially focus on Indore. It will:
- Retrieve current weather information from three configured weather providers.
- Normalize provider responses into a common data model.
- calculate a source-agreement and freshness-based confidence score.
- Display the best-supported available weather summary, alongside source details and uncertainty.
- Allow users to post weather-related photos called **Moments**.
- Expire Moments after 60 minutes and remove their media from object storage.
- Use OCR and computer vision to extract relevant evidence from uploaded photos.
- Provide an installable, responsive PWA experience.

WeatherPulse is an aid for understanding local weather, not a replacement for official alerts or emergency guidance.

### 1.3 Intended Audience
- Product owner and project supervisor
- Frontend and backend developers
- UI/UX designers
- QA and test engineers
- Deployment and operations team

### 1.4 Definitions
| Term | Definition |
|---|---|
| PWA | Progressive Web Application installable on supported devices |
| Moment | A user-submitted weather photo that expires after 60 minutes |
| OCR | Optical Character Recognition; extracts text from images |
| Computer Vision | Analysis of image content such as visible clouds, rain, fog, or sky conditions |
| Provider | External weather-data service |
| Confidence Score | An estimate of agreement, freshness, and provider reliability; not the probability of rain |
| TTL | Time-to-live policy used for eventual expiry/deletion of database records |

### 1.5 Document Conventions
- **MUST** indicates a mandatory requirement.
- **SHOULD** indicates a recommended requirement.
- **MAY** indicates an optional requirement.
- Numerical targets in this draft are proposed acceptance criteria and should be validated during implementation.

---

## 2. Overall Description

### 2.1 Product Perspective
WeatherPulse is a web application composed of a responsive PWA frontend, server-side API routes, a weather aggregation and scoring service, MongoDB, media storage, and OCR/computer-vision processing.

### 2.2 Product Goals
1. Make local weather information easy to understand.
2. Reduce dependence on a single weather source.
3. Communicate disagreement and uncertainty instead of hiding it.
4. Add recent, community-contributed visual context.
5. Automatically expire temporary photo posts.

### 2.3 User Classes

| User Class | Description | Main Permissions |
|---|---|---|
| Guest | Visitor without an account | View weather dashboard and visible Moments; subject to configured rate limits |
| Registered User | Authenticated user | Create and manage their own Moments; report inappropriate content |
| Administrator | Authorized moderator | Review reports, remove inappropriate Moments, inspect service health and operational status |

If authentication is not included in the first release, Moment creation and moderation flows must be revised before implementation.

### 2.4 Operating Environment
- Current versions of Chrome, Edge, Firefox, and Safari, subject to PWA feature support.
- Responsive mobile, tablet, and desktop layouts.
- Next.js and TypeScript application.
- MongoDB Atlas or compatible MongoDB deployment.
- Server-side deployment such as Vercel or another compatible host.
- External weather provider APIs and a media storage service.

### 2.5 Constraints
- Weather provider access, rate limits, licensing, and attribution requirements must be verified before release.
- Provider outages or missing data must not crash the dashboard.
- OCR and computer vision results may be uncertain and must not be presented as ground truth.
- Browser geolocation requires user permission.
- MongoDB TTL deletion is asynchronous; application queries must stop showing expired Moments immediately, and stored media requires a separate cleanup process.
- Provider API keys and other secrets MUST remain server-side.

### 2.6 Assumptions and Dependencies
- Three weather providers can be configured and legally used for the target location.
- The application has access to a compatible object-storage service for photos.
- An OCR and image-analysis implementation is selected during technical design.
- The application can obtain an approximate location from a user-selected city or permitted browser location.
- Internet connectivity is required for live provider data; cached data may be shown when available.

---

## 3. Functional Requirements

### 3.1 Weather Provider Integration

**FR-001 — Multiple Providers:** The system MUST support three configured weather-data providers.

**FR-002 — Server-Side Requests:** Weather-provider requests MUST be made by the backend; private API keys MUST NOT be exposed to the browser.

**FR-003 — Normalization:** The backend MUST normalize provider responses into a shared schema, including provider name, observation/forecast time, retrieval time, location, temperature, apparent temperature where available, humidity, wind, precipitation/rain indicators, condition description, and source status.

**FR-004 — Error Isolation:** A timeout, invalid response, or outage from one provider MUST NOT prevent the system from using valid responses from other providers.

**FR-005 — Freshness:** The system MUST record retrieval time and provider observation time where available.

**FR-006 — Attribution:** The interface MUST display appropriate provider attribution and links where required by the provider's terms.

**FR-007 — Provider Configuration:** Provider endpoints, credentials, timeouts, and enable/disable settings MUST be configurable through server-side environment or application configuration.

### 3.2 Aggregation and Confidence Scoring

**FR-008 — Aggregation:** The backend MUST compare normalized readings for the same target location and comparable time window.

**FR-009 — Confidence Score:** The system MUST compute and display a 0–100 confidence score for the combined weather summary when sufficient data is available.

**FR-010 — Proposed Score Weights:** Initial scoring may use:
- 40% cross-provider agreement
- 30% data freshness
- 30% provider reliability/availability

These weights are provisional and MUST be calibrated against observed performance before being treated as validated.

**FR-011 — Separate Forecast Probability:** The confidence score MUST be labelled separately from any provider-supplied probability of precipitation. It MUST NOT be described as the probability of rain.

**FR-012 — Explainability:** The dashboard SHOULD explain the score using short indicators such as “sources agree,” “data is recent,” or “sources differ.”

**FR-013 — Insufficient Data:** If too few providers return usable data, the system MUST show a reduced-data or unavailable state rather than inventing a result.

**FR-014 — Disagreement:** When provider readings differ materially, the interface MUST disclose the disagreement and avoid implying false precision.

**FR-015 — Auditability:** The backend SHOULD retain enough non-sensitive metadata to troubleshoot aggregation and scoring decisions.

### 3.3 Weather Dashboard

**FR-016 — Default Location:** Indore, Madhya Pradesh, India MUST be the initial default location.

**FR-017 — Current Conditions:** The dashboard MUST show the selected location, current conditions, temperature, condition summary, last-updated time, and confidence score when available.

**FR-018 — Supporting Metrics:** The dashboard SHOULD display humidity, wind, precipitation indicators, and other metrics when data is available.

**FR-019 — Source Breakdown:** Users MUST be able to inspect provider status, observation/retrieval time, and key readings used in the combined summary.

**FR-020 — Refresh:** Users MUST be able to request a refresh. The backend MUST apply provider-aware timeouts and rate limits.

**FR-021 — Stale Data:** If cached data is shown because live refresh failed, the interface MUST label it as stale and show its timestamp.

**FR-022 — Loading and Error States:** The interface MUST provide loading, partial-data, empty, and recoverable-error states.

**FR-023 — Location Selection:** Users SHOULD be able to select a supported city/location. Browser geolocation MAY be offered only after permission is requested.

### 3.4 Weather Moments

**FR-024 — Upload:** Authorized users MUST be able to submit a weather-related photo with an optional caption.

**FR-025 — Expiry:** Each Moment MUST expire 60 minutes after its creation time.

**FR-026 — Immediate Visibility Expiry:** All read APIs and UI feeds MUST exclude Moments whose `expiresAt` is at or before the current time, regardless of whether database cleanup has run.

**FR-027 — Media Deletion:** A scheduled cleanup process MUST delete expired photo objects from media storage and update or remove related metadata.

**FR-028 — Feed:** The application SHOULD show recent, unexpired Moments relevant to the selected location, ordered by creation time.

**FR-029 — Location Privacy:** Public-facing Moment locations SHOULD be approximate (for example, a neighborhood or rounded coordinates), not precise home-level coordinates.

**FR-030 — Image Validation:** Uploads MUST validate file type, size, and decodability. Unsupported or suspicious files MUST be rejected.

**FR-031 — EXIF Removal:** The backend SHOULD strip EXIF metadata, including embedded GPS coordinates, before publishing an image.

**FR-032 — Moderation:** Users SHOULD be able to report a Moment. Administrators MUST be able to hide or remove reported or policy-violating content.

**FR-033 — Ownership:** Authenticated users MUST only be able to edit or delete their own Moments, except for authorized administrators.

**FR-034 — Rate Limiting:** Moment uploads and reports MUST be rate-limited to reduce abuse.

### 3.5 OCR and Computer Vision

**FR-035 — Image Analysis:** The system SHOULD analyze uploaded photos with computer vision to identify visible cues such as clouds, rain, fog, or general sky conditions where feasible.

**FR-036 — OCR:** OCR MAY extract relevant visible text, such as a readable weather display or sign, if useful and technically reliable.

**FR-037 — Evidence Metadata:** The backend SHOULD store structured analysis metadata, processing time, model/provider version, and a confidence indicator.

**FR-038 — Evidence Contribution:** Image-derived evidence MAY contribute to a separate local-observation indicator or a clearly explained adjustment to the weather assessment. The contribution MUST be limited by image-analysis confidence and recency.

**FR-039 — No Ground-Truth Claim:** The application MUST NOT treat a photo, OCR result, or model prediction as definitive proof of current weather or future precipitation.

**FR-040 — User Disclosure:** The interface SHOULD indicate when image analysis is automated and may be incorrect.

### 3.6 Accounts and Administration

**FR-041 — Authentication:** If Moment posting is enabled, the production system SHOULD authenticate users or provide an equivalent abuse-resistant identity mechanism.

**FR-042 — Authorization:** Protected endpoints MUST verify authentication and role/ownership permissions on the server.

**FR-043 — Moderation Queue:** Administrators SHOULD have a view of reported Moments and their status.

**FR-044 — Operational Health:** Authorized administrators SHOULD be able to inspect provider availability and recent processing failures without exposing secrets.

---

## 4. Non-Functional Requirements

### 4.1 Performance
- **NFR-001:** The dashboard shell SHOULD become usable within 3 seconds on a typical broadband connection, subject to hosting and device conditions.
- **NFR-002:** Cached dashboard data SHOULD be returned within 2 seconds under normal operating conditions.
- **NFR-003:** External provider calls MUST have configurable timeouts.
- **NFR-004:** OCR/computer-vision work SHOULD run asynchronously when it would delay photo upload or dashboard responses.

### 4.2 Availability and Resilience
- **NFR-005:** The system MUST degrade gracefully when one or more providers are unavailable.
- **NFR-006:** Provider failures MUST be logged without logging credentials or sensitive user data.
- **NFR-007:** A cached result MAY be served when live data is unavailable, with a visible stale-data label.

### 4.3 Security and Privacy
- **NFR-008:** All production traffic MUST use HTTPS.
- **NFR-009:** Secrets MUST be stored in deployment environment variables or a secret manager.
- **NFR-010:** Server routes MUST validate inputs and enforce rate limits.
- **NFR-011:** The system MUST validate and sanitize captions and user-supplied fields.
- **NFR-012:** Access to private user data and moderation actions MUST be authorized.
- **NFR-013:** Image storage permissions MUST prevent unintended public access to expired or private media.
- **NFR-014:** Expired Moment media MUST be removed from object storage, not merely hidden from the feed.
- **NFR-015:** The system SHOULD document retention periods for logs, account records, and reports.

### 4.4 Usability and Accessibility
- **NFR-016:** The interface MUST be responsive across mobile, tablet, and desktop sizes.
- **NFR-017:** Core actions MUST be keyboard accessible and use visible focus indicators.
- **NFR-018:** Text and interactive elements SHOULD meet WCAG 2.2 AA contrast and accessibility expectations.
- **NFR-019:** Weather data MUST use clear units and localized time labels.
- **NFR-020:** Errors MUST use understandable language and offer a recovery action where possible.

### 4.5 Maintainability
- **NFR-021:** Frontend, API, provider adapters, scoring logic, and media processing SHOULD be separated into modules.
- **NFR-022:** Provider-specific mappings MUST be isolated so providers can be replaced without rewriting the dashboard.
- **NFR-023:** Configuration and secrets MUST be documented in `.env.example` without real credentials.
- **NFR-024:** Core scoring, expiry, authorization, and normalization logic MUST have automated tests.

---

## 5. Proposed System Architecture

### 5.1 Components
1. **PWA Frontend:** Weather dashboard, source breakdown, Moment feed, upload interface, and responsive navigation.
2. **API Layer:** Server-side route handlers for weather, Moments, accounts, and moderation.
3. **Provider Adapters:** One adapter per weather provider; normalizes response formats.
4. **Aggregation and Scoring Service:** Compares readings and calculates confidence and disagreement indicators.
5. **MongoDB:** Stores normalized snapshots, Moment metadata, users, reports, and processing status.
6. **Media Storage:** Stores uploaded image objects with access and lifecycle controls.
7. **Image Analysis Worker:** Runs OCR and computer vision and records structured outputs.
8. **Expiry/Cleanup Worker:** Removes expired Moment media and associated metadata.
9. **Observability:** Structured logs, health checks, and error monitoring.

### 5.2 Data Flow
1. The client requests weather for a selected location.
2. The backend queries enabled providers, using timeouts and cache policy.
3. Provider adapters normalize successful responses.
4. The scoring service calculates agreement, freshness, and a combined confidence score.
5. The API returns the summary, provider breakdown, and timestamps.
6. When a Moment is uploaded, the server validates it, strips metadata, stores the media, and writes its MongoDB record.
7. An asynchronous worker analyzes the image and updates evidence metadata.
8. The feed returns only unexpired, permitted Moments.
9. A cleanup worker deletes expired media objects and cleans up associated records.

### 5.3 Suggested Technology Stack
- **Frontend:** Next.js, React, TypeScript
- **Styling/UI:** Tailwind CSS and shadcn/ui (or an equivalent component system)
- **Database:** MongoDB Atlas with Mongoose or the official MongoDB driver
- **Backend:** Next.js Route Handlers or a separate Node.js API
- **Media Storage:** Cloudinary, Amazon S3, or compatible object storage
- **Image Analysis:** A selected OCR engine and computer-vision model/service
- **Deployment:** Vercel or a compatible platform
- **PWA:** Web app manifest, service worker, install flow, and offline fallback

The technology choices above are proposed defaults, not hard dependencies unless approved by the project owner.

---

## 6. Data Requirements

### 6.1 Suggested MongoDB Collections

#### `weather_snapshots`
- `_id`
- `locationId`
- `locationName`
- `provider`
- `observedAt`
- `fetchedAt`
- `normalizedMetrics`
- `providerStatus`
- `expiresAt` (optional retention policy)

#### `weather_summaries`
- `_id`
- `locationId`
- `generatedAt`
- `metrics`
- `confidenceScore`
- `confidenceBreakdown`
- `providerStatuses`
- `stale`
- `validUntil`

#### `moments`
- `_id`
- `userId`
- `caption`
- `mediaObjectKey`
- `createdAt`
- `expiresAt`
- `approximateLocation`
- `analysisStatus`
- `analysisResult`
- `moderationStatus`

#### `users`
- `_id`
- `authProviderId`
- `displayName`
- `role`
- `createdAt`

#### `moment_reports`
- `_id`
- `momentId`
- `reportingUserId`
- `reason`
- `createdAt`
- `status`

#### `processing_jobs` (optional)
- `_id`
- `jobType`
- `resourceId`
- `status`
- `attemptCount`
- `createdAt`
- `updatedAt`

### 6.2 Indexes and Expiry
- Index `weather_snapshots` by `{ locationId: 1, fetchedAt: -1 }`.
- Index `weather_summaries` by `{ locationId: 1, generatedAt: -1 }`.
- Index `moments` by `{ expiresAt: 1, createdAt: -1 }`.
- Index `moments` by `{ approximateLocation: 1, createdAt: -1 }` if required by the selected location model.
- Consider a TTL index on `moments.expiresAt` for eventual metadata deletion, but never rely on TTL for immediate visibility expiry or object-storage deletion.
- Index `moment_reports` by `{ status: 1, createdAt: -1 }`.

### 6.3 Retention Rules
- Moments expire 60 minutes after creation.
- Expired Moments must immediately disappear from query results.
- Media objects must be deleted by a reliable scheduled cleanup process.
- Database TTL is only a secondary cleanup mechanism because MongoDB TTL deletion is asynchronous.
- Other data retention periods must be documented before production release.

---

## 7. API Requirements

Exact paths may be adjusted to the chosen application structure.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/weather/current?location=indore` | Get aggregated current weather |
| `GET` | `/api/weather/sources?location=indore` | Get provider-level readings and status |
| `POST` | `/api/weather/refresh` | Request a controlled refresh |
| `GET` | `/api/moments?location=indore` | List unexpired Moments for a location |
| `POST` | `/api/moments` | Upload a Moment |
| `GET` | `/api/moments/:id` | Get an accessible Moment |
| `DELETE` | `/api/moments/:id` | Delete own Moment or moderator-authorized Moment |
| `POST` | `/api/moments/:id/report` | Report a Moment |
| `GET` | `/api/admin/providers` | View provider health; admin only |
| `GET` | `/api/admin/reports` | View moderation queue; admin only |

### 7.1 API Rules
- All endpoints MUST validate input and return consistent error responses.
- Protected endpoints MUST enforce authorization server-side.
- Upload endpoints MUST enforce file size, format, and rate limits.
- Weather responses SHOULD include `generatedAt`, provider statuses, `stale`, and `confidenceScore` when available.
- Moment list and detail endpoints MUST enforce `expiresAt > current time`.
- API errors MUST NOT expose API keys, stack traces, or internal secrets.

---

## 8. User Interface Requirements

### 8.1 Design Direction
- Clean, minimal, light interface with clear typography and strong readability.
- Use weather icons and restrained accent colors; reserve warning colors for meaningful alerts.
- Keep temperature and current condition visually prominent.
- Show confidence and source disagreement as supporting information, not as a substitute for the forecast.
- Provide mobile-first navigation and accessible controls.

### 8.2 Main Screens
1. **Weather Dashboard:** Location, temperature, condition, last updated, confidence score, key metrics, and provider status.
2. **Source Details:** Comparison of provider readings, timestamps, and source availability.
3. **Moment Feed:** Recent local weather photos with approximate location, timestamp, expiry indicator, and moderation/report action.
4. **Create Moment:** Photo selection/capture, optional caption, upload progress, and privacy notice.
5. **Account:** Sign-in and user-owned Moment management if accounts are enabled.
6. **Admin/Moderation:** Provider health and reported Moment queue for authorized administrators.
7. **Offline/Unavailable:** Cached-data notice and retry action.

### 8.3 UI States
Every data-driven screen MUST account for loading, success, partial data, empty results, stale data, offline mode, permission denial, and recoverable errors as applicable.

---

## 9. Acceptance Criteria

The first release is acceptable when:

1. The dashboard defaults to Indore and displays normalized data from available configured providers.
2. A single provider outage does not crash the dashboard.
3. The API returns a confidence score and its breakdown when enough valid data exists.
4. The UI distinguishes confidence in the combined assessment from precipitation probability.
5. The UI discloses source disagreement and stale data.
6. Provider attribution is present where required.
7. An authorized user can upload a valid weather photo with an optional caption.
8. A Moment is excluded from all feed/detail responses at or after its `expiresAt`.
9. The cleanup process deletes expired media from object storage.
10. OCR/computer-vision failures do not break uploads or the weather dashboard.
11. Image-analysis outputs are treated as uncertain supporting evidence.
12. Unauthorized users cannot delete another user's Moment or access restricted moderation actions.
13. Invalid file types, oversized uploads, and excessive requests are rejected safely.
14. The PWA is responsive and installable on supported browsers.
15. Automated tests cover provider normalization, scoring, expiry filtering, access control, and cleanup behavior.

---

## 10. Testing Strategy

### 10.1 Unit Tests
- Provider response normalization
- Freshness and agreement scoring
- Missing-provider behavior
- Moment expiry filtering
- Upload validation and metadata stripping
- Authorization and ownership checks

### 10.2 Integration Tests
- Weather aggregation across three providers
- Provider timeout and malformed response handling
- MongoDB persistence and indexes
- Media upload and cleanup
- OCR/computer-vision job status and failure handling

### 10.3 End-to-End Tests
- Open dashboard and view Indore weather
- Inspect source breakdown
- Upload a Moment and confirm it appears in the feed
- Verify expired Moments are not visible
- Verify unauthorized deletion is rejected
- Test mobile layout and install/offline behavior

### 10.4 Operational Tests
- Provider outage simulation
- Rate-limit checks
- Media cleanup retry behavior
- Logging and secret-redaction checks

---

## 11. Deployment and Configuration

### 11.1 Environment Variables
Use `.env.example` with placeholder values only. Actual names depend on the selected provider and storage services.

```env
MONGODB_URI=
WEATHER_PROVIDER_A_API_KEY=
WEATHER_PROVIDER_B_API_KEY=
WEATHER_PROVIDER_C_API_KEY=
MEDIA_STORAGE_PROVIDER=
MEDIA_STORAGE_API_KEY=
MEDIA_STORAGE_SECRET=
OCR_PROVIDER_API_KEY=
IMAGE_ANALYSIS_PROVIDER_API_KEY=
AUTH_SECRET=
APP_BASE_URL=
```

Do not commit real secrets. Provider-specific variable names should be finalized once the three services are selected.

### 11.2 Deployment Checklist
- Configure MongoDB network access and least-privilege database credentials.
- Configure provider credentials and confirm attribution/licensing.
- Configure private media storage and deletion credentials.
- Configure scheduled cleanup or a reliable worker.
- Configure authentication and admin authorization if Moments are enabled.
- Add request limits, upload limits, and monitoring.
- Verify environment variables and production HTTPS.
- Test expiry behavior independently of MongoDB TTL.
- Document backup, logging, and retention policies.

---

## 12. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Weather providers disagree | Show source-level readings and an explainable confidence score |
| Provider outage or rate limit | Timeouts, caching, partial results, and graceful fallback |
| Confidence score is misleading | Label it clearly, expose its components, and validate weights |
| User photos are inaccurate or old | Use creation time, location relevance, moderation, and analysis confidence |
| OCR/CV misclassification | Treat outputs as supporting evidence and expose uncertainty |
| Expired image remains in storage | Use scheduled object-storage deletion with retries and monitoring |
| Abuse or harmful uploads | Authentication, validation, rate limiting, reporting, moderation |
| Precise location exposure | Approximate public location and strip EXIF GPS metadata |
| Provider terms change | Review provider terms and attribution requirements before release |

---

## 13. Project Phases

### Phase 1 — Foundation
- Set up Next.js, TypeScript, UI system, MongoDB, and environment configuration.
- Implement provider adapters and normalized weather schema.
- Build dashboard and loading/error states.

### Phase 2 — Aggregation
- Implement source comparison, freshness handling, confidence scoring, source details, and caching.
- Add tests for missing data and provider failures.

### Phase 3 — Moments
- Implement authentication/authorization decision, upload validation, private media storage, feed, reporting, and 60-minute expiry.
- Implement immediate expiry filtering and scheduled media deletion.

### Phase 4 — Image Intelligence
- Integrate OCR and computer vision.
- Store analysis metadata and display uncertainty.
- Evaluate whether image evidence improves local observations before changing scoring.

### Phase 5 — PWA and Release
- Add manifest, service worker, install behavior, and offline fallback.
- Run accessibility, security, performance, and end-to-end testing.
- Deploy and monitor the production environment.

---

## 14. Open Decisions Before Production

The following decisions require project-owner approval:
1. Exact three weather providers and their API plans/terms.
2. Whether authentication is required for all Moment uploads.
3. Media-storage provider and signed/public access model.
4. OCR and computer-vision provider/model.
5. Whether image evidence is shown separately or contributes to a validated score.
6. Supported locations beyond Indore.
7. Retention policies for account, report, and operational data.
8. Moderation policy and administrator workflow.
9. Target service-level objectives and budget.

---

## 15. References

Use the current official documentation and verify service terms before implementation:
- Next.js: https://nextjs.org/docs
- MongoDB: https://www.mongodb.com/docs/
- MongoDB TTL indexes: https://www.mongodb.com/docs/manual/core/index-ttl/
- Progressive Web Apps: https://web.dev/learn/pwa/
- India Meteorological Department: https://mausam.imd.gov.in/
- Open-Meteo: https://open-meteo.com/en/docs
- OpenWeather: https://openweathermap.org/api

**End of Document**
