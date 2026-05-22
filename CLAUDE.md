# Agent Instructions

## Human-Readable Code

Prefer clear, boring, human-reviewable code over compactness. Keep functions focused and shallow: use early returns, named predicates, small helpers, and table-driven data instead of nested conditionals, nested ternaries, long inline expressions, or mixed responsibilities.

When a function grows past roughly 40-60 lines, touches multiple domains, or needs comments to explain control flow, split it before adding behavior. Schema and test fixture modules should be organized by domain, with fixture data named for the scenario it supports.

Before adding a branch, ask whether a named helper, lookup map, or data-driven definition would make the next change easier to review. Do not hide business rules inside templates, route handlers, or chained expressions when a small domain helper would make the rule explicit.
