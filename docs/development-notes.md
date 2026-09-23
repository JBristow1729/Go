# Development decisions and remaining limits

- Source stays in this local directory instead of a Git worktree because the owner explicitly deferred GitHub and no repository existed. This preserves deliverables but provides no commit history yet.
- Dependencies use `pnpm-lock.yaml` with pnpm 11.19.0 because that package manager was available. Use the documented frozen installation for reproducibility.
- Compact pages use conservative server-side text shortening plus CSS ellipsis. This protects older browsers while full text remains reachable. Very different handset fonts still need device testing.
- Production requests use a 30-second session lease plus ETag-conditional session writes/deletion. The lease reduces duplicate work; ETags prevent expired owners from overwriting newer state. A crashed request can require a retry; exactly-once API calls across crashes are not promised.
- Standalone Chromium could not run under the macOS sandbox. The supported browser supplied actual viewport/UI evidence, while the standalone test suite remains available to run elsewhere.
- Desktop viewport testing is not actual Opera Mini testing. Hosting and account-plan checks remain part of the owner's later Netlify deployment. Attribution/privacy copy identifies providers and data handling; no legal certification is claimed.
- Live API calls work, but the free geocoder misses some landmark names, including Romsey Abbey in this test. Explicit result selection is required. Try an address or postcode if the intended name is missing.
- Deferred minor from review: missing/expired session cookies can leave orphan lock blobs. They do not hold journey data but can accumulate storage entries. Cleanup of those orphan locks is a future maintenance improvement.
