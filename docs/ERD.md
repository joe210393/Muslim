# ERD

對應 `packages/db/prisma/schema.prisma`。關聯刪除以 Restrict 為主，session 與重設 token 隨使用者刪除。

```mermaid
erDiagram
  Organization ||--o{ User : employs
  Organization ||--o{ Application : owns
  User ||--o{ Application : creates
  User ||--o{ Application : assigned
  ApplicationCategory ||--o{ CategoryFormVersion : versions
  ApplicationCategory ||--o{ Application : classifies
  CategoryFormVersion ||--o{ Application : binds
  Application ||--o{ ApplicationSubmission : snapshots
  Application ||--o{ ApplicationEvent : history
  Application ||--o{ ApplicationAttachment : files
  FileObject ||--o{ ApplicationAttachment : stores
  User ||--o{ FileObject : uploads
  Application ||--o| Certification : result
  User ||--o{ Course : creates
  Course ||--o{ Enrollment : seats
  User ||--o{ Enrollment : attends
  Application ||--o{ NotificationJob : notifies
  User ||--o{ AuditLog : acts
  User ||--o{ ImportBatch : imports
  User ||--o{ Session : sessions
```

案件編號使用 PostgreSQL sequence `application_no_seq`，不採筆數加一。`source_system` 與 `source_record_key` 必須同時有值或同時為空，並有唯一限制。
