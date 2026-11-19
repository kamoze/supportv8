# Canonical ServiceV8 workforce portraits

Copied from the canonical ServiceV8 portrait bundle (`portraits-canonical`,
update 2026-11-19) on 2026-11-19. Its originals are Dominion main's
`packages/console/public/avatars`, pixel-identical to StudioV8's and Runtime's
where they overlap. Same file name means same image in every ServiceV8 app.

SupportV8 resolves every portrait with `src/lib/portraits.ts` (a port of the
canonical resolver; it passes `test/fixtures/portrait-test-vectors.json`) and
shows the small WebP copies:

- `beaver-<key>-<size>.webp` for the 12 keys with artwork (arthur, barnaby,
  cornelius, default, eleanor, intern, manager, maxwell, oliver, penelope,
  sophia, vivian) at the CSS sizes SupportV8 renders, 28 32 40 48 112, and their
  2x files 56 64 80 96 224. Slots of 20/24/36/96px use the next size up.
- Names without artwork of their own (caleb, chloe, clara, dominic, gideon,
  silas, theodore, valerie, winston) show the default beaver.

The JPEG originals kept here are only those that SupportV8's data and APIs still
carry as URLs (workforce, chat and marketplace records): analyst, arthur,
barnaby, curator, eleanor, intern, manager, receptionist, sophia and vivian.
The UI never downloads them for a portrait slot. The portrait is illustration
only: it never implies identity, hiring, readiness or authority.

## Original SHA-256 (from the bundle's originals.sha256)

| Asset | SHA-256 |
| --- | --- |
| beaver-analyst.jpg | `9af99cfac4da1074436c8a5f5402c6e69761f22f19ca5284cb69f782ca8d9c72` |
| beaver-arthur.jpg | `fc771c883a552029acfce3d2c9a33b4101b5e11aee8c0c5d30406093b4d61c6f` |
| beaver-barnaby.jpg | `6c309e496db71fd06f9c2e60565fc635fa133b03cc9bc4f243eb710ca2183ec7` |
| beaver-curator.jpg | `2e4712ac1a2a5b07b91d902e880c2f87b1b2a855a3588c8372fab70375862700` |
| beaver-eleanor.jpg | `748457c2bce297ed8d4c0095679071eb08020b28e1902bf5926102442813bd81` |
| beaver-intern.jpg | `cb391264e0ec87b65879ec20f9996d07b0826258a9b41a35a1bc3e59d9c698b4` |
| beaver-manager.jpg | `8cd629411ac15e91541d6462660245f9f8701e2e98b709d0c4d5b5466e402786` |
| beaver-receptionist.jpg | `4e2870c2e77bf6b1432418fb110632c927cc59e17b2aafd765acc54f80c97147` |
| beaver-sophia.jpg | `22d18326cb4d259d0a5a3891246b750cec9ca3f55c5ce8a936b1b70c0782a1db` |
| beaver-vivian.jpg | `478dccaabe6be3b6ae5ae884c1efdbc13c7aee3d4dd90d8c6e4fcb5b02053e31` |
