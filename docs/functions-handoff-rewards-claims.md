# radius-functions handoff — Builder Rewards claim callables

Three callables the **web** now calls but the **backend hasn't implemented yet**. Until they're
deployed, the web UI shows the thrown error on the card / claim page instead of working. All are
**us-central1** (the web uses the default `getFunctions(app)` region). Web callsites are in
`radius-web/src/lib/rewards.ts`.

## Shared data model (already in use)

**`rewardFulfillments/{autoId}`** — one claim (covers all tiers earned at submit time):
```
userId: string            // CANONICAL id (resolveCanonicalId of the claimant)
tiers: ("gear"|"bag")[]   // what's being claimed
milestoneKeys: string[]   // e.g. ["builder-25"], ["builder-50"], or both
fullName, email, address1, address2, city, region, postcode, country, phone: string
bagRequest, bagLink, notes: string
courseCount: number       // browser-submitted at claim time — NOT authoritative
verifiedCourseCount: number   // written by onFulfillmentCreated (server recount, alias-merged)
status: "pending" | "shipped" | "rejected"
submittedAt: number       // epoch ms
platform: "web"
// shipped:  shippedAt, shippedBy, tracking, shipNote
// rejected: rejectedAt, rejectedBy, rejectReason
```

**`users/{canonicalId}.courseRewards`**:
```
awarded: string[]         // milestone keys the user has EARNED (e.g. "builder-25","builder-50")
merchFulfilled: string[]  // tiers already SHIPPED (so we never ask again)
lastCount: number         // course count at last recompute
```

Milestone → tier map: `builder-25 → gear`, `builder-50 → bag`.

**Staff check:** re-check `users/{callerCanonicalId}.staff === true` with the Admin SDK on every
privileged callable. Client-side staff checks are cosmetic (Stage-1 rules let any signed-in user
write), so the callable is the real gate.

---

## 1. `rejectFulfillment` — staff rejects/dismisses a claim (rare)

**Request:** `{ fulfillmentId: string, reason?: string }`
**Response:** `{ ok?: boolean, alreadyResolved?: boolean, error?: string }`

Logic:
1. `context.auth` required → resolve caller canonical id → assert `staff === true`, else
   `HttpsError("permission-denied", "Staff only.")`.
2. Load `rewardFulfillments/{fulfillmentId}`; if missing → `HttpsError("not-found", …)`.
3. If already `status === "rejected"` → return `{ alreadyResolved: true }` (idempotent; a
   double-click must not error).
4. If already `status === "shipped"` → `HttpsError("failed-precondition", "Already shipped — can't reject.")`.
5. Set `status:"rejected"`, `rejectedAt: now`, `rejectedBy: callerCanonicalId`,
   `rejectReason: (reason||"").trim()`.
6. Do **not** touch `courseRewards.merchFulfilled` (nothing shipped). Whether a rejected tier can be
   re-claimed is a policy call — see note below. Return `{ ok: true }`.

Note on re-claiming: web's `getClaimable` excludes any tier that appears on an existing
`rewardFulfillments` doc for the user (pending **or** shipped) so a refresh can't double-submit. A
**rejected** doc still carries `tiers`, so by default a rejected user can't re-claim via the account
path. If you want reject to *free up* a re-claim, either (a) clear `tiers` on reject, or (b) have
`getClaimable` ignore `status:"rejected"` docs — tell me which and I'll match it on web.

---

## 2. `resolveClaimToken` — open a tokenised claim link with no login

The app mints a single-use link and opens `radiusdiscgolf.com/rewards/claim/<tier>?t=TOKEN` in an
in-app browser. The token **is** the identity — resolve `userId` from the stored token server-side,
never from any client input (a forwarded link must not let someone else claim).

**Request:** `{ token: string }`
**Response:** `{ userId, milestoneKeys, name, username, email, courseCount }`

Logic:
1. Look up the token (the app already writes these — **match that collection/shape**; likely a
   `claimTokens` doc keyed by, or containing, the token, with `userId`, `milestoneKeys`,
   `createdAt`, `expiresAt`, and a `usedAt`/`used` marker). Token must be unguessable (crypto
   random), so this callable needs **no** auth/App-Check identity to resolve it.
2. Not found / malformed → `HttpsError("not-found", "This link isn't valid.")`
3. Already used (`usedAt` set) → `HttpsError("failed-precondition", "This link has already been used.")`
4. Expired (`now > expiresAt`) → `HttpsError("deadline-exceeded", "This link expired — open Builder Rewards in the app for a fresh one.")`
5. Otherwise read the user (`users/{tokenUserId}`) and return:
   `userId` (canonical), `milestoneKeys` (from the token), `name`, `username`, `email`,
   `courseCount` (use `verifiedCourseCount`/recount if handy, else `courseRewards.lastCount`).

The messages above are shown **verbatim** to the player — keep them player-facing.

---

## 3. `submitClaimWithToken` — burn token + create claim atomically

**Request:** `{ token: string, form: { fullName, address1, address2, city, region, postcode, country, phone, email, bagRequest, bagLink, notes } }`
**Response:** `{ ok?: boolean }`

Do the token re-validation (used/expired/invalid → same three HttpsErrors as #2) and the write in a
**single Firestore transaction** so a double-submit can't mint two claims:
1. Re-read the token in the txn; re-check not-used + not-expired.
2. Derive `tiers` from the token's `milestoneKeys` (`builder-25→gear`, `builder-50→bag`).
3. Create `rewardFulfillments/{autoId}` with the shape above: `userId` = token's canonical user (NOT
   from `form`), `tiers`, `milestoneKeys`, the `form` fields (trimmed), `courseCount` from the token
   record, `status:"pending"`, `submittedAt: now`, `platform:"web"`.
4. Mark the token used (`usedAt: now`, and/or delete) in the **same** txn.
5. `onFulfillmentCreated` should still fire to stamp `verifiedCourseCount` (see below).

---

## Related, already-live (context, no action unless noted)

- **`markFulfillmentShipped({ fulfillmentId, tracking?, note? })`** — staff-gated; sets
  `status:"shipped"` + `shippedAt/shippedBy/tracking/shipNote`, and adds the tier(s) to
  `users/{cid}.courseRewards.merchFulfilled`. (Web already calls this.)
- **`onFulfillmentCreated`** (Firestore onCreate for `rewardFulfillments`) — recounts the user's
  approved courses from `courses` (merged across canonical alias ids) and writes
  `verifiedCourseCount` onto the claim. The web fulfillment card shows this and flags any mismatch
  vs the browser-submitted `courseCount` (e.g. "12 courses · claimed 40"). Make sure token-created
  claims trigger it too.

## Deploy checklist
- [ ] `rejectFulfillment` (us-central1)
- [ ] `resolveClaimToken` (us-central1, no-auth, reads app-minted token collection)
- [ ] `submitClaimWithToken` (us-central1, transactional burn+create)
- [ ] Confirm `onFulfillmentCreated` fires for token-created docs
- [ ] Decide rejected-tier re-claim policy → tell web which behavior to match
