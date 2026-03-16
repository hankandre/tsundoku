# Tsundoku API Route Implementation Report

Audit scope: `tsundoku-api` only (legacy `booklore-api` excluded).

## Totals

| Category | Count |
|---|---:|
| Implemented routes | 82 |
| Unimplemented/placeholder routes | 28 |
| Missing/planned-but-not-wired routes | 1 |

## Implemented Routes

| Method | Path | Source file |
|---|---|---|
| GET | `/api/v1/healthcheck/` | `healthcheck.ts` |
| GET | `/api/v1/version/` | `version.ts` |
| GET | `/api/v1/version/changelog` | `version.ts` |
| POST | `/api/v1/auth/register` | `auth.ts` |
| POST | `/api/v1/auth/login` | `auth.ts` |
| POST | `/api/v1/auth/refresh` | `auth.ts` |
| POST | `/api/v1/auth/logout` | `auth.ts` |
| GET | `/api/v1/auth/remote` | `auth.ts` |
| GET | `/api/v1/setup/status` | `setup.ts` |
| POST | `/api/v1/setup/` | `setup.ts` |
| GET | `/api/v1/users/me` | `users.ts` |
| GET | `/api/v1/users/:id` | `users.ts` |
| GET | `/api/v1/users/` | `users.ts` |
| PUT | `/api/v1/users/:id` | `users.ts` |
| DELETE | `/api/v1/users/:id` | `users.ts` |
| PUT | `/api/v1/users/change-password` | `users.ts` |
| PUT | `/api/v1/users/change-user-password` | `users.ts` |
| PUT | `/api/v1/users/:id/settings` | `users.ts` |
| GET | `/api/v1/libraries/` | `libraries.ts` |
| GET | `/api/v1/libraries/health` | `libraries.ts` |
| GET | `/api/v1/libraries/:libraryId` | `libraries.ts` |
| POST | `/api/v1/libraries/` | `libraries.ts` |
| PUT | `/api/v1/libraries/:libraryId` | `libraries.ts` |
| DELETE | `/api/v1/libraries/:libraryId` | `libraries.ts` |
| PUT | `/api/v1/libraries/:libraryId/refresh` | `libraries.ts` |
| PATCH | `/api/v1/libraries/:libraryId/file-naming-pattern` | `libraries.ts` |
| POST | `/api/v1/libraries/scan` | `libraries.ts` |
| GET | `/api/v1/shelves/` | `shelves.ts` |
| GET | `/api/v1/shelves/:shelfId` | `shelves.ts` |
| POST | `/api/v1/shelves/` | `shelves.ts` |
| PUT | `/api/v1/shelves/:shelfId` | `shelves.ts` |
| DELETE | `/api/v1/shelves/:shelfId` | `shelves.ts` |
| GET | `/api/v1/books/` | `books.ts` |
| POST | `/api/v1/books/batch` | `books.ts` |
| GET | `books/metadata/detail/:provider/:providerItemId` | `books.ts` |
| POST | `/api/v1/books/metadata/isbn-lookup` | `books.ts` |
| PUT | `/api/v1/books/metadata/toggle-all-lock` | `books.ts` |
| PUT | `/api/v1/books/metadata/toggle-field-locks` | `books.ts` |
| PUT | `/api/v1/books/bulk-edit-metadata` | `books.ts` |
| GET | `/api/v1/books/:bookId` | `books.ts` |
| GET | `/api/v1/books/:bookId/metadata` | `books.ts` |
| PUT | `/api/v1/books/:bookId/metadata` | `books.ts` |
| GET | `/api/v1/settings/` | `settings.ts` |
| PUT | `/api/v1/settings/` | `settings.ts` |
| GET | `/api/v1/public-settings/` | `public-settings.ts` |
| GET | `/api/v1/tasks/` | `tasks.ts` |
| POST | `/api/v1/tasks/start` | `tasks.ts` |
| DELETE | `/api/v1/tasks/:taskId/cancel` | `tasks.ts` |
| GET | `/api/v1/tasks/last` | `tasks.ts` |
| PATCH | `/api/v1/tasks/:taskType/cron` | `tasks.ts` |
| POST | `/api/v1/reading-sessions/` | `reading-sessions.ts` |
| GET | `/api/v1/reading-sessions/book/:bookId` | `reading-sessions.ts` |
| GET | `/api/magic-shelves/` | `magic-shelves.ts` |
| GET | `/api/magic-shelves/:id` | `magic-shelves.ts` |
| POST | `/api/magic-shelves/` | `magic-shelves.ts` |
| DELETE | `/api/magic-shelves/:id` | `magic-shelves.ts` |
| GET | `/api/v1/bookmarks/book/:bookId` | `bookmarks.ts` |
| GET | `/api/v1/bookmarks/:bookmarkId` | `bookmarks.ts` |
| POST | `/api/v1/bookmarks/` | `bookmarks.ts` |
| PUT | `/api/v1/bookmarks/:bookmarkId` | `bookmarks.ts` |
| DELETE | `/api/v1/bookmarks/:bookmarkId` | `bookmarks.ts` |
| GET | `/api/v1/book-notes/book/:bookId` | `book-notes.ts` |
| GET | `/api/v1/book-notes/:noteId` | `book-notes.ts` |
| POST | `/api/v1/book-notes/` | `book-notes.ts` |
| PUT | `/api/v1/book-notes/:noteId` | `book-notes.ts` |
| DELETE | `/api/v1/book-notes/:noteId` | `book-notes.ts` |
| GET | `/api/v1/audit-logs/` | `audit-logs.ts` |
| GET | `/api/v1/audit-logs/usernames` | `audit-logs.ts` |
| GET | `/api/v1/reviews/book/:bookId` | `book-reviews.ts` |
| POST | `/api/v1/reviews/book/:bookId/refresh` | `book-reviews.ts` |
| DELETE | `/api/v1/reviews/:id` | `book-reviews.ts` |
| DELETE | `/api/v1/reviews/book/:bookId` | `book-reviews.ts` |
| GET | `/api/v1/koreader-users/me` | `koreader-users.ts` |
| PUT | `/api/v1/koreader-users/me` | `koreader-users.ts` |
| PATCH | `/api/v1/koreader-users/me/sync` | `koreader-users.ts` |
| PATCH | `/api/v1/koreader-users/me/sync-progress-with-booklore` | `koreader-users.ts` |
| GET | `/api/v1/path/` | `paths.ts` |
| GET | `/api/v1/authors/` | `authors.ts` |
| GET | `/api/v1/authors/by-name` | `authors.ts` |
| GET | `/api/v1/authors/book/:bookId` | `authors.ts` |
| GET | `/api/v1/authors/:authorId` | `authors.ts` |
| PUT | `/api/v1/authors/:authorId` | `authors.ts` |
| POST | `/api/v1/authors/:authorId/search-metadata` | `authors.ts` |
| POST | `/api/v1/authors/:authorId/quick-match` | `authors.ts` |
| DELETE | `/api/v1/authors/` | `authors.ts` |
| Multiple | `/api/v1/user-stats/reading/*` (17 endpoints) | `user-stats.ts` |
| Multiple | `/api/v1/user-stats/listening/*` (12 endpoints) | `user-stats.ts` |
| GET | `/api/v1/notebook/` | `notebook.ts` |
| GET | `/api/v1/notebook/export` | `notebook.ts` |
| GET | `/api/v1/notebook/books` | `notebook.ts` |
| GET | `/api/v1/icons/` | `icons.ts` |
| POST | `/api/v1/icons/` | `icons.ts` |
| POST | `/api/v1/icons/batch` | `icons.ts` |
| GET | `/api/v1/icons/:svgName/content` | `icons.ts` |
| DELETE | `/api/v1/icons/:svgName` | `icons.ts` |
| GET | `/api/v1/icons/all/content` | `icons.ts` |
| GET | `/api/v1/books/:bookId/sidecar` | `sidecar.ts` |
| GET | `/api/v1/books/:bookId/sidecar/status` | `sidecar.ts` |
| POST | `/api/v1/books/:bookId/sidecar/export` | `sidecar.ts` |
| POST | `/api/v1/books/:bookId/sidecar/import` | `sidecar.ts` |
| POST | `/api/v1/libraries/:libraryId/sidecar/export-all` | `sidecar.ts` |
| POST | `/api/v1/libraries/:libraryId/sidecar/import-all` | `sidecar.ts` |
| GET | `/api/v1/:userId/content-restrictions` | `content-restrictions.ts` |
| POST | `/api/v1/:userId/content-restrictions` | `content-restrictions.ts` |
| PUT | `/api/v1/:userId/content-restrictions` | `content-restrictions.ts` |
| DELETE | `/api/v1/:userId/content-restrictions/:restrictionId` | `content-restrictions.ts` |
| DELETE | `/api/v1/:userId/content-restrictions` | `content-restrictions.ts` |
| Multiple | `/api/v1/opds/*` (16 OPDS feeds) | `opds.ts` |
| GET | `/api/v2/opds-users/` | `opds-users.ts` |
| POST | `/api/v2/opds-users/` | `opds-users.ts` |
| DELETE | `/api/v2/opds-users/:id` | `opds-users.ts` |
| PATCH | `/api/v2/opds-users/:id` | `opds-users.ts` |
| GET | `/api/v1/auth/oidc/state` | `oidc-auth.ts` |
| POST | `/api/v1/auth/oidc/callback` | `oidc-auth.ts` |
| GET | `/api/v1/auth/oidc/redirect` | `oidc-auth.ts` |
| POST | `/api/v1/auth/oidc/mobile/callback` | `oidc-auth.ts` |
| POST | `/api/v1/auth/oidc/backchannel-logout` | `oidc-auth.ts` |
| GET | `/api/v1/admin/oidc-group-mappings/` | `oidc-auth.ts` |
| POST | `/api/v1/admin/oidc-group-mappings/` | `oidc-auth.ts` |
| PUT | `/api/v1/admin/oidc-group-mappings/:id` | `oidc-auth.ts` |
| DELETE | `/api/v1/admin/oidc-group-mappings/:id` | `oidc-auth.ts` |

## Unimplemented / Placeholder Routes

| Method | Path | Reason | Source file |
|---|---|---|---|
| GET | `/api/v1/libraries/:libraryId/book/:bookId` | 501 - Book retrieval not yet implemented | `libraries.ts` |
| GET | `/api/v1/libraries/:libraryId/book` | 501 - Book list not yet implemented | `libraries.ts` |
| GET | `/api/v1/libraries/:libraryId/format-counts` | 501 - Format counts not yet implemented | `libraries.ts` |
| GET | `/api/v1/shelves/:shelfId/books` | 501 - Shelf books not yet implemented | `shelves.ts` |
| POST | `/api/v1/books/shelves` | 501 - Assign books to shelves not yet implemented | `books.ts` |
| POST | `/api/v1/books/progress` | 501 - Update read progress not yet implemented | `books.ts` |
| GET | `/api/v1/books/:id/recommendations` | 501 - Book recommendations not yet implemented | `books.ts` |
| POST | `/api/v1/books/status` | 501 - Update read status not yet implemented | `books.ts` |
| POST | `/api/v1/books/reset-progress` | 501 - Reset reading progress not yet implemented | `books.ts` |
| PUT | `/api/v1/books/personal-rating` | 501 - Update personal rating not yet implemented | `books.ts` |
| POST | `/api/v1/books/reset-personal-rating` | 501 - Reset personal rating not yet implemented | `books.ts` |
| POST | `/api/v1/books/physical` | 501 - Create physical book not yet implemented | `books.ts` |
| DELETE | `/api/v1/books/` | 501 - Delete books not yet implemented | `books.ts` |
| GET | `/api/v1/books/:bookId/cbx/metadata/comicinfo` | 501 - ComicInfo metadata not yet implemented | `books.ts` |
| GET | `/api/v1/books/:bookId/file-metadata` | 501 - File metadata not yet implemented | `books.ts` |
| GET | `/api/v1/books/:bookId/content` | 501 - Book content streaming not yet implemented | `books.ts` |
| GET | `/api/v1/books/:bookId/download` | 501 - Download book not yet implemented | `books.ts` |
| GET | `/api/v1/books/:bookId/download-all` | 501 - Download all book files not yet implemented | `books.ts` |
| GET | `/api/v1/books/:bookId/viewer-setting` | 501 - Get viewer settings not yet implemented | `books.ts` |
| PUT | `/api/v1/books/:bookId/viewer-setting` | 501 - Update viewer settings not yet implemented | `books.ts` |
| POST | `/api/v1/books/duplicates` | 501 - Duplicate detection not yet implemented | `books.ts` |
| PATCH | `/api/v1/books/:bookId/physical` | 501 - Toggle physical flag not yet implemented | `books.ts` |
| POST | `/api/v1/books/:targetBookId/attach-file` | 501 - Attach book files not yet implemented | `books.ts` |
| POST | `/api/v1/books/metadata/recalculate-match-scores` | 501 - Requires metadata matching service | `books.ts` |
| POST | `/api/v1/books/metadata/manage/consolidate` | 501 - Requires admin metadata management service | `books.ts` |
| POST | `/api/v1/books/metadata/manage/delete` | 501 - Requires admin metadata management service | `books.ts` |
| POST | `/api/v1/settings/oidc/test` | 501 - OIDC connection test not yet implemented | `settings.ts` |
| GET | `/api/v1/opds/:bookId/download` | 404 - Download not implemented yet | `opds.ts` |

## Missing / Planned-But-Not-Wired

| Evidence | Source file | Notes |
|---|---|---|
| Test/reference expects `GET /api/v1/books/metadata/detail/:provider/:providerItemId`, but route is mounted as `books/metadata/detail/:provider/:providerItemId` | `books.ts`, `app.ts` | Likely prefix/path mismatch |

## Confidence Notes

1. `users.ts` appears to define duplicate `GET /:id` routes; the second one is likely unreachable.
2. `sidecar.ts` and `content-restrictions.ts` are mounted under `/api/v1`; internal route strings can look odd but still resolve correctly when mounted.
3. OPDS download endpoint is present but intentionally returns a placeholder `404` response.
