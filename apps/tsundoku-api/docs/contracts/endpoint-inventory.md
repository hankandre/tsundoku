# Endpoint Inventory (Generated)

Generated at: 2026-03-13T15:01:51.794Z
Reviewed at: 2026-03-16

| Method | Path | Controller | Status | Notes |
| --- | --- | --- | --- | --- |
| ANY | `/` | ShelfController.java | missing | Not implemented in tsundoku-api |
| GET | `/` | ShelfController.java | missing | Not implemented in tsundoku-api |
| POST | `/` | ShelfController.java | missing | Not implemented in tsundoku-api |
| DELETE | `/{shelfId}` | ShelfController.java | missing | Not implemented in tsundoku-api |
| GET | `/{shelfId}` | ShelfController.java | missing | Not implemented in tsundoku-api |
| PUT | `/{shelfId}` | ShelfController.java | missing | Not implemented in tsundoku-api |
| GET | `/{shelfId}/books` | ShelfController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/kobo/{token}/**` | KoboController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/kobo/{token}/api/kobo/{token}` | KoboController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/kobo/{token}/v1/analytics/gettests` | KoboController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/kobo/{token}/v1/auth/device` | KoboController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/kobo/{token}/v1/books/{bookId}/download` | KoboController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/kobo/{token}/v1/books/{imageId}/{version}/thumbnail/{width}/{height}/{quality}/{isGreyscale}/image.jpg` | KoboController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/kobo/{token}/v1/books/{imageId}/{version}/thumbnail/{width}/{height}/false/image.jpg` | KoboController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/kobo/{token}/v1/books/{imageId}/thumbnail/{width}/{height}/{quality}/{isGreyscale}/image.jpg` | KoboController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/kobo/{token}/v1/books/{imageId}/thumbnail/{width}/{height}/false/image.jpg` | KoboController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/kobo/{token}/v1/initialization` | KoboController.java | missing | Not implemented in tsundoku-api |
| DELETE | `/api/kobo/{token}/v1/library/{bookId}` | KoboController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/kobo/{token}/v1/library/{bookId}/metadata` | KoboController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/kobo/{token}/v1/library/{bookId}/state` | KoboController.java | missing | Not implemented in tsundoku-api |
| PUT | `/api/kobo/{token}/v1/library/{bookId}/state` | KoboController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/kobo/{token}/v1/library/sync` | KoboController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/koreader/api/koreader` | KoreaderController.java | missing | Not implemented in tsundoku-api |
| PUT | `/api/koreader/syncs/progress` | KoreaderController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/koreader/syncs/progress/{bookHash}` | KoreaderController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/koreader/users/auth` | KoreaderController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/koreader/users/create` | KoreaderController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/magic-shelves` | MagicShelfController.java | parity | Implemented in tsundoku-api |
| POST | `/api/magic-shelves` | MagicShelfController.java | parity | Implemented in tsundoku-api |
| DELETE | `/api/magic-shelves/{id}` | MagicShelfController.java | parity | Implemented in tsundoku-api |
| GET | `/api/magic-shelves/{id}` | MagicShelfController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/magic-shelves/api/magic-shelves` | MagicShelfController.java | missing | Not implemented in tsundoku-api |
| DELETE | `/api/metadata/tasks/{taskId}` | MetadataTaskController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/metadata/tasks/{taskId}` | MetadataTaskController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/metadata/tasks/{taskId}/proposals/{proposalId}/status` | MetadataTaskController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/metadata/tasks/active` | MetadataTaskController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/metadata/tasks/api/metadata/tasks` | MetadataTaskController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/admin/oidc-group-mappings` | OidcGroupMappingController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/admin/oidc-group-mappings` | OidcGroupMappingController.java | parity | Implemented in tsundoku-api |
| DELETE | `/api/v1/admin/oidc-group-mappings/{id}` | OidcGroupMappingController.java | parity | Implemented in tsundoku-api |
| PUT | `/api/v1/admin/oidc-group-mappings/{id}` | OidcGroupMappingController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/admin/oidc-group-mappings/api/v1/admin/oidc-group-mappings` | OidcGroupMappingController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/annotations` | AnnotationController.java | missing | Not implemented in tsundoku-api |
| DELETE | `/api/v1/annotations/{annotationId}` | AnnotationController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/annotations/{annotationId}` | AnnotationController.java | missing | Not implemented in tsundoku-api |
| PUT | `/api/v1/annotations/{annotationId}` | AnnotationController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/annotations/api/v1/annotations` | AnnotationController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/annotations/book/{bookId}` | AnnotationController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/api/v1` | SidecarController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/audiobooks/{bookId}/cover` | AudiobookReaderController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/audiobooks/{bookId}/info` | AudiobookReaderController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/audiobooks/{bookId}/stream` | AudiobookReaderController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/audiobooks/{bookId}/track/{trackIndex}/stream` | AudiobookReaderController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/audiobooks/api/v1/audiobooks` | AudiobookReaderController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/audit-logs` | AuditLogController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/audit-logs/api/v1/audit-logs` | AuditLogController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/audit-logs/usernames` | AuditLogController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/auth/api/v1/auth` | AuthenticationController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/auth/api/v1/auth` | LogoutController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/auth/login` | AuthenticationController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/auth/logout` | LogoutController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/auth/oidc/api/v1/auth/oidc` | OidcAuthController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/auth/oidc/backchannel-logout` | OidcAuthController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/auth/oidc/callback` | OidcAuthController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/auth/oidc/mobile/callback` | OidcAuthController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/auth/oidc/redirect` | OidcAuthController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/auth/oidc/state` | OidcAuthController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/auth/refresh` | AuthenticationController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/auth/register` | AuthenticationController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/auth/remote` | AuthenticationController.java | parity | Implemented in tsundoku-api |
| DELETE | `/api/v1/authors` | AuthorController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/authors` | AuthorController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/authors/{authorId}` | AuthorController.java | parity | Implemented in tsundoku-api |
| PUT | `/api/v1/authors/{authorId}` | AuthorController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/authors/{authorId}/match` | AuthorController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/authors/{authorId}/photo/upload` | AuthorController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/authors/{authorId}/photo/url` | AuthorController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/authors/{authorId}/quick-match` | AuthorController.java | 501 | Author quick-match requires external provider integration |
| GET | `/api/v1/authors/{authorId}/search-metadata` | AuthorController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/authors/{authorId}/search-photos` | AuthorController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/authors/api/v1/authors` | AuthorController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/authors/auto-match` | AuthorController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/authors/book/{bookId}` | AuthorController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/authors/by-name` | AuthorController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/authors/unmatch` | AuthorController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/book-notes` | BookNoteController.java | parity | Implemented in tsundoku-api |
| DELETE | `/api/v1/book-notes/{noteId}` | BookNoteController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/book-notes/api/v1/book-notes` | BookNoteController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/book-notes/book/{bookId}` | BookNoteController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/bookdrop/api/v1/bookdrop` | BookdropFileController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/bookdrop/files` | BookdropFileController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/bookdrop/files/bulk-edit` | BookdropFileController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/bookdrop/files/discard` | BookdropFileController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/bookdrop/files/extract-pattern` | BookdropFileController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/bookdrop/imports/finalize` | BookdropFileController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/bookdrop/notification` | BookdropFileController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/bookdrop/rescan` | BookdropFileController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/bookmarks` | BookMarkController.java | parity | Implemented in tsundoku-api |
| DELETE | `/api/v1/bookmarks/{bookmarkId}` | BookMarkController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/bookmarks/{bookmarkId}` | BookMarkController.java | parity | Implemented in tsundoku-api |
| PUT | `/api/v1/bookmarks/{bookmarkId}` | BookMarkController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/bookmarks/api/v1/bookmarks` | BookMarkController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/bookmarks/book/{bookId}` | BookMarkController.java | parity | Implemented in tsundoku-api |
| DELETE | `/api/v1/books` | BookController.java | 501 | Delete books not yet implemented |
| GET | `/api/v1/books` | BookController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/books/{bookId}` | BookController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/books/{bookId}/cbx/metadata/comicinfo` | BookController.java | 501 | ComicInfo metadata not yet implemented |
| GET | `/api/v1/books/{bookId}/content` | BookController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/books/{bookId}/download` | BookController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/books/{bookId}/download-all` | BookController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/books/{bookId}/file-metadata` | BookController.java | 501 | File metadata not yet implemented |
| GET | `/api/v1/books/{bookId}/files` | AdditionalFileController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/books/{bookId}/files` | AdditionalFileController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/books/{bookId}/files` | AdditionalFileController.java | missing | Not implemented in tsundoku-api |
| DELETE | `/api/v1/books/{bookId}/files/{fileId}` | AdditionalFileController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/books/{bookId}/files/{fileId}/detach` | AdditionalFileController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/books/{bookId}/files/{fileId}/download` | AdditionalFileController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/books/{bookId}/files/api/v1/books/{bookId}/files` | AdditionalFileController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/books/{bookId}/generate-custom-audiobook-cover` | BookCoverController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/books/{bookId}/generate-custom-cover` | BookCoverController.java | missing | Not implemented in tsundoku-api |
| PUT | `/api/v1/books/{bookId}/metadata` | MetadataController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/books/{bookId}/metadata/audiobook-cover/from-url` | BookCoverController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/books/{bookId}/metadata/audiobook-cover/upload` | BookCoverController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/books/{bookId}/metadata/cover/from-url` | BookCoverController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/books/{bookId}/metadata/cover/upload` | BookCoverController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/books/{bookId}/metadata/covers` | BookCoverController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/books/{bookId}/metadata/prospective` | MetadataController.java | missing | Not implemented in tsundoku-api |
| PATCH | `/api/v1/books/{bookId}/physical` | BookController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/books/{bookId}/regenerate-audiobook-cover` | BookCoverController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/books/{bookId}/regenerate-cover` | BookCoverController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/books/{bookId}/sidecar` | SidecarController.java | 501 | Sidecar file operations require file system integration |
| POST | `/api/v1/books/{bookId}/sidecar/export` | SidecarController.java | 501 | Sidecar file operations require file system integration |
| POST | `/api/v1/books/{bookId}/sidecar/import` | SidecarController.java | 501 | Sidecar file operations require file system integration |
| GET | `/api/v1/books/{bookId}/sidecar/status` | SidecarController.java | 501 | Sidecar file operations require file system integration |
| GET | `/api/v1/books/{bookId}/viewer-setting` | BookController.java | parity | Implemented in tsundoku-api |
| PUT | `/api/v1/books/{bookId}/viewer-setting` | BookController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/books/{id}/recommendations` | BookController.java | 501 | Book recommendations not yet implemented |
| POST | `/api/v1/books/{targetBookId}/attach-file` | BookController.java | 501 | Attach book files not yet implemented |
| ANY | `/api/v1/books/api/v1/books` | BookController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/books/api/v1/books` | BookCoverController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/books/api/v1/books` | MetadataController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/books/batch` | BookController.java | parity | Implemented in tsundoku-api |
| PUT | `/api/v1/books/bulk-edit-metadata` | MetadataController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/books/bulk-generate-custom-covers` | BookCoverController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/books/bulk-regenerate-covers` | BookCoverController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/books/bulk-upload-cover` | BookCoverController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/books/duplicates` | BookController.java | 501 | Duplicate detection not yet implemented |
| GET | `/api/v1/books/metadata/detail/{provider}/{providerItemId}` | MetadataController.java | 501 | Provider metadata lookup requires external metadata provider integration |
| POST | `/api/v1/books/metadata/isbn-lookup` | MetadataController.java | 501 | ISBN lookup requires external metadata provider integration |
| POST | `/api/v1/books/metadata/manage/consolidate` | MetadataController.java | 501 | Consolidate metadata requires admin metadata management service |
| POST | `/api/v1/books/metadata/manage/delete` | MetadataController.java | 501 | Delete metadata requires admin metadata management service |
| POST | `/api/v1/books/metadata/recalculate-match-scores` | MetadataController.java | 501 | Recalculate match scores requires metadata matching service |
| PUT | `/api/v1/books/metadata/toggle-all-lock` | MetadataController.java | parity | Implemented in tsundoku-api |
| PUT | `/api/v1/books/metadata/toggle-field-locks` | MetadataController.java | parity | Implemented in tsundoku-api |
| PUT | `/api/v1/books/personal-rating` | BookController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/books/physical` | BookController.java | 501 | Create physical book not yet implemented |
| POST | `/api/v1/books/progress` | BookController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/books/regenerate-covers` | BookCoverController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/books/reset-personal-rating` | BookController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/books/reset-progress` | BookController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/books/shelves` | BookController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/books/status` | BookController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/cbx/{bookId}/page-info` | CbxReaderController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/cbx/{bookId}/pages` | CbxReaderController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/cbx/api/v1/cbx` | CbxReaderController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/custom-fonts` | CustomFontController.java | missing | Not implemented in tsundoku-api |
| DELETE | `/api/v1/custom-fonts/{fontId}` | CustomFontController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/custom-fonts/{fontId}/file` | CustomFontController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/custom-fonts/api/v1/custom-fonts` | CustomFontController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/custom-fonts/upload` | CustomFontController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/email/api/v1/email` | SendEmailV2Controller.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/email/book` | SendEmailV2Controller.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/email/book/{bookId}` | SendEmailV2Controller.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/email/providers` | EmailProviderV2Controller.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/email/providers` | EmailProviderV2Controller.java | missing | Not implemented in tsundoku-api |
| DELETE | `/api/v1/email/providers/{id}` | EmailProviderV2Controller.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/email/providers/{id}` | EmailProviderV2Controller.java | missing | Not implemented in tsundoku-api |
| PUT | `/api/v1/email/providers/{id}` | EmailProviderV2Controller.java | missing | Not implemented in tsundoku-api |
| PATCH | `/api/v1/email/providers/{id}/set-default` | EmailProviderV2Controller.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/email/providers/api/v1/email/providers` | EmailProviderV2Controller.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/email/recipients` | EmailRecipientV2Controller.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/email/recipients` | EmailRecipientV2Controller.java | missing | Not implemented in tsundoku-api |
| DELETE | `/api/v1/email/recipients/{id}` | EmailRecipientV2Controller.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/email/recipients/{id}` | EmailRecipientV2Controller.java | missing | Not implemented in tsundoku-api |
| PUT | `/api/v1/email/recipients/{id}` | EmailRecipientV2Controller.java | missing | Not implemented in tsundoku-api |
| PATCH | `/api/v1/email/recipients/{id}/set-default` | EmailRecipientV2Controller.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/email/recipients/api/v1/email/recipients` | EmailRecipientV2Controller.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/epub/{bookId}/file/**` | EpubReaderController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/epub/{bookId}/info` | EpubReaderController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/epub/api/v1/epub` | EpubReaderController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/files/api/v1/files` | FileMoveController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/files/api/v1/files` | FileUploadController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/files/move` | FileMoveController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/files/upload` | FileUploadController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/files/upload/bookdrop` | FileUploadController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/hardcover-sync-settings` | HardcoverSyncSettingsController.java | missing | Not implemented in tsundoku-api |
| PUT | `/api/v1/hardcover-sync-settings` | HardcoverSyncSettingsController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/hardcover-sync-settings/api/v1/hardcover-sync-settings` | HardcoverSyncSettingsController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/healthcheck` | HealthcheckController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/healthcheck/api/v1/healthcheck` | HealthcheckController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/icons` | IconController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/icons` | IconController.java | 501 | Icon storage requires file system integration |
| DELETE | `/api/v1/icons/{svgName}` | IconController.java | 501 | Icon storage requires file system integration |
| GET | `/api/v1/icons/{svgName}/content` | IconController.java | 501 | Icon storage requires file system integration |
| GET | `/api/v1/icons/all/content` | IconController.java | 501 | Icon storage requires file system integration |
| ANY | `/api/v1/icons/api/v1/icons` | IconController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/icons/batch` | IconController.java | 501 | Icon storage requires file system integration |
| GET | `/api/v1/kobo-settings` | KoboSettingsController.java | missing | Not implemented in tsundoku-api |
| PUT | `/api/v1/kobo-settings` | KoboSettingsController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/kobo-settings/api/v1/kobo-settings` | KoboSettingsController.java | missing | Not implemented in tsundoku-api |
| PUT | `/api/v1/kobo-settings/token` | KoboSettingsController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/koreader-users/api/v1/koreader-users` | KoreaderUserController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/koreader-users/me` | KoreaderUserController.java | parity | Implemented in tsundoku-api |
| PUT | `/api/v1/koreader-users/me` | KoreaderUserController.java | parity | Implemented in tsundoku-api |
| PATCH | `/api/v1/koreader-users/me/sync` | KoreaderUserController.java | parity | Implemented in tsundoku-api |
| PATCH | `/api/v1/koreader-users/me/sync-progress-with-booklore` | KoreaderUserController.java | 501 | KOReader sync progress with Booklore not yet implemented |
| GET | `/api/v1/libraries` | LibraryController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/libraries` | LibraryController.java | parity | Implemented in tsundoku-api |
| DELETE | `/api/v1/libraries/{libraryId}` | LibraryController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/libraries/{libraryId}` | LibraryController.java | parity | Implemented in tsundoku-api |
| PUT | `/api/v1/libraries/{libraryId}` | LibraryController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/libraries/{libraryId}/book` | LibraryController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/libraries/{libraryId}/book/{bookId}` | LibraryController.java | parity | Implemented in tsundoku-api |
| PATCH | `/api/v1/libraries/{libraryId}/file-naming-pattern` | LibraryController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/libraries/{libraryId}/format-counts` | LibraryController.java | parity | Implemented in tsundoku-api |
| PUT | `/api/v1/libraries/{libraryId}/refresh` | LibraryController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/libraries/{libraryId}/sidecar/export-all` | SidecarController.java | 501 | Sidecar file operations require file system integration |
| POST | `/api/v1/libraries/{libraryId}/sidecar/import-all` | SidecarController.java | 501 | Sidecar file operations require file system integration |
| ANY | `/api/v1/libraries/api/v1/libraries` | LibraryController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/libraries/health` | LibraryController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/libraries/scan` | LibraryController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/media/api/v1/media` | BookMediaController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/media/author/{authorId}/photo` | BookMediaController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/media/author/{authorId}/thumbnail` | BookMediaController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/media/book/{bookId}/audiobook-cover` | BookMediaController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/media/book/{bookId}/audiobook-thumbnail` | BookMediaController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/media/book/{bookId}/cbx/pages/{pageNumber}` | BookMediaController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/media/book/{bookId}/cover` | BookMediaController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/media/book/{bookId}/thumbnail` | BookMediaController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/media/bookdrop/{bookdropId}/cover` | BookMediaController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/notebook` | NotebookController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/notebook/api/v1/notebook` | NotebookController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/notebook/books` | NotebookController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/notebook/export` | NotebookController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/opds` | OpdsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/opds/{bookId}/cover` | OpdsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/opds/{bookId}/download` | OpdsController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/opds/api/v1/opds` | OpdsController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/opds/authors` | OpdsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/opds/catalog` | OpdsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/opds/libraries` | OpdsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/opds/magic-shelves` | OpdsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/opds/recent` | OpdsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/opds/search.opds` | OpdsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/opds/series` | OpdsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/opds/shelves` | OpdsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/opds/surprise` | OpdsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/path` | PathController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/path/api/v1/path` | PathController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/pdf-annotations/api/v1/pdf-annotations` | PdfAnnotationController.java | missing | Not implemented in tsundoku-api |
| DELETE | `/api/v1/pdf-annotations/book/{bookId}` | PdfAnnotationController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/pdf-annotations/book/{bookId}` | PdfAnnotationController.java | missing | Not implemented in tsundoku-api |
| PUT | `/api/v1/pdf-annotations/book/{bookId}` | PdfAnnotationController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/pdf/{bookId}/info` | PdfReaderController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/pdf/{bookId}/pages` | PdfReaderController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/pdf/api/v1/pdf` | PdfReaderController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/public-settings` | PublicAppSettingController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/public-settings/api/v1/public-settings` | PublicAppSettingController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/reading-sessions` | ReadingSessionController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/reading-sessions/api/v1/reading-sessions` | ReadingSessionController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/reading-sessions/book/{bookId}` | ReadingSessionController.java | parity | Implemented in tsundoku-api |
| DELETE | `/api/v1/reviews/{id}` | BookReviewController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/reviews/api/v1/reviews` | BookReviewController.java | missing | Not implemented in tsundoku-api |
| DELETE | `/api/v1/reviews/book/{bookId}` | BookReviewController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/reviews/book/{bookId}` | BookReviewController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/reviews/book/{bookId}/refresh` | BookReviewController.java | 501 | Review refresh requires external metadata provider integration |
| GET | `/api/v1/settings` | AppSettingController.java | parity | Implemented in tsundoku-api |
| PUT | `/api/v1/settings` | AppSettingController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/settings/api/v1/settings` | AppSettingController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/settings/oidc/test` | AppSettingController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/setup` | SetupController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/setup/api/v1/setup` | SetupController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/setup/status` | SetupController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/tasks` | TaskController.java | parity | Implemented in tsundoku-api |
| DELETE | `/api/v1/tasks/{taskId}/cancel` | TaskController.java | parity | Implemented in tsundoku-api |
| PATCH | `/api/v1/tasks/{taskType}/cron` | TaskController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/tasks/api/v1/tasks` | TaskController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/tasks/last` | TaskController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v1/tasks/start` | TaskController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/user-stats/api/v1/user-stats` | UserStatsController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/user-stats/listening/authors` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/listening/completion` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/listening/finish-funnel` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/listening/genres` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/listening/heatmap/monthly` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/listening/longest-books` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/listening/monthly-pace` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/listening/peak-hours` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/listening/session-scatter` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/listening/weekly-trend` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/book-completion-heatmap` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/book-distributions` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/book-timeline` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/completion-race` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/completion-timeline` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/dates` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/favorite-days` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/genres` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/heatmap` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/heatmap/monthly` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/page-turner-scores` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/peak-hours` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/session-scatter` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/speed` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/streak` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/user-stats/reading/timeline` | UserStatsController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/users` | UserController.java | parity | Implemented in tsundoku-api |
| DELETE | `/api/v1/users/{id}` | UserController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/users/{id}` | UserController.java | parity | Implemented in tsundoku-api |
| PUT | `/api/v1/users/{id}` | UserController.java | parity | Implemented in tsundoku-api |
| PUT | `/api/v1/users/{id}/settings` | UserController.java | parity | Implemented in tsundoku-api |
| DELETE | `/api/v1/users/{userId}/content-restrictions` | ContentRestrictionController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/users/{userId}/content-restrictions` | ContentRestrictionController.java | missing | Not implemented in tsundoku-api |
| POST | `/api/v1/users/{userId}/content-restrictions` | ContentRestrictionController.java | missing | Not implemented in tsundoku-api |
| PUT | `/api/v1/users/{userId}/content-restrictions` | ContentRestrictionController.java | missing | Not implemented in tsundoku-api |
| DELETE | `/api/v1/users/{userId}/content-restrictions/{restrictionId}` | ContentRestrictionController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/users/{userId}/content-restrictions/api/v1/users/{userId}/content-restrictions` | ContentRestrictionController.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v1/users/api/v1/users` | UserController.java | missing | Not implemented in tsundoku-api |
| PUT | `/api/v1/users/change-password` | UserController.java | parity | Implemented in tsundoku-api |
| PUT | `/api/v1/users/change-user-password` | UserController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/users/me` | UserController.java | parity | Implemented in tsundoku-api |
| GET | `/api/v1/version` | VersionController.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v1/version/api/v1/version` | VersionController.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v1/version/changelog` | VersionController.java | parity | Implemented in tsundoku-api |
| POST | `/api/v2/book-notes` | BookNotesV2Controller.java | missing | Not implemented in tsundoku-api |
| DELETE | `/api/v2/book-notes/{noteId}` | BookNotesV2Controller.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v2/book-notes/{noteId}` | BookNotesV2Controller.java | missing | Not implemented in tsundoku-api |
| PUT | `/api/v2/book-notes/{noteId}` | BookNotesV2Controller.java | missing | Not implemented in tsundoku-api |
| ANY | `/api/v2/book-notes/api/v2/book-notes` | BookNotesV2Controller.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v2/book-notes/book/{bookId}` | BookNotesV2Controller.java | missing | Not implemented in tsundoku-api |
| GET | `/api/v2/opds-users` | OpdsUserV2Controller.java | parity | Implemented in tsundoku-api |
| POST | `/api/v2/opds-users` | OpdsUserV2Controller.java | parity | Implemented in tsundoku-api |
| DELETE | `/api/v2/opds-users/{id}` | OpdsUserV2Controller.java | parity | Implemented in tsundoku-api |
| PATCH | `/api/v2/opds-users/{id}` | OpdsUserV2Controller.java | parity | Implemented in tsundoku-api |
| ANY | `/api/v2/opds-users/api/v2/opds-users` | OpdsUserV2Controller.java | missing | Not implemented in tsundoku-api |
| ANY | `/komga/api/komga/api` | KomgaController.java | missing | Not implemented in tsundoku-api |
| GET | `/komga/api/v1/books` | KomgaController.java | missing | Not implemented in tsundoku-api |
| GET | `/komga/api/v1/books/{bookId}` | KomgaController.java | missing | Not implemented in tsundoku-api |
| GET | `/komga/api/v1/books/{bookId}/file` | KomgaController.java | missing | Not implemented in tsundoku-api |
| GET | `/komga/api/v1/books/{bookId}/pages` | KomgaController.java | missing | Not implemented in tsundoku-api |
| GET | `/komga/api/v1/books/{bookId}/pages/{pageNumber}` | KomgaController.java | missing | Not implemented in tsundoku-api |
| GET | `/komga/api/v1/books/{bookId}/thumbnail` | KomgaController.java | missing | Not implemented in tsundoku-api |
| GET | `/komga/api/v1/collections` | KomgaController.java | missing | Not implemented in tsundoku-api |
| GET | `/komga/api/v1/libraries` | KomgaController.java | missing | Not implemented in tsundoku-api |
| GET | `/komga/api/v1/libraries/{libraryId}` | KomgaController.java | missing | Not implemented in tsundoku-api |
| GET | `/komga/api/v1/series` | KomgaController.java | missing | Not implemented in tsundoku-api |
| GET | `/komga/api/v1/series/{seriesId}` | KomgaController.java | missing | Not implemented in tsundoku-api |
| GET | `/komga/api/v1/series/{seriesId}/books` | KomgaController.java | missing | Not implemented in tsundoku-api |
| GET | `/komga/api/v1/series/{seriesId}/thumbnail` | KomgaController.java | missing | Not implemented in tsundoku-api |
| GET | `/komga/api/v2/users/me` | KomgaController.java | missing | Not implemented in tsundoku-api |


Status counts: parity=142, 501=26, mock=0, missing=192
Total endpoints: 360
