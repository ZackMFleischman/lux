# LUX-171 delivered prototype

The five-node Living Ornament scene is running in the installed desktop, PID 18396, session aacb6fbd574770a366ede77bd537a1c0c230. The user requested keeping this session open and using MCP for live edits. Do not terminate it between changes.

## Delivered

Varied organic silhouettes and nesting; warm/cool watercolor; bold ink; six prototype pattern families; grouped shape, color, ink, pattern and motion controls. Slow curved ribbons carry their markings in intrinsic coordinates. Patterns remain internal renderer helpers until LUX-172 extracts independent components.

Library: Organic Regions revision 3; Animated Watercolor revision 3; Organic Boundary Ink revision 2; Composition Phrasing revision 2; new Ornament Region Styles (0b92b112-f315-4479-9331-7a815deec27e) revision 2. Historical sources preserved. Live publication receipts: live-foundation-publication.json and live-renderer-publication.json.

Saved normal animated scenes outside test artifacts:
- Living Ornament - Pattern Prototype.lux-scene
- Living Ornament - Shape and Pattern.lux-scene (five Library links; linked-foundation.json)

## Evidence

Actual screenshots: live-1789554721937.png and linked-scene live-1789555593106.png. Independent source/art review: lux-171-independent-review.md and pattern-milestone-review.md, plus final delta review.

Combined milestone QA: pattern-milestone-performance/result.json: 59.9189 observed FPS, 59.662 worker FPS, minimum interval 58.4324 FPS at 1920x1080 over20seconds; GPU maximum interval p95 4.521984ms; no fault. Save/reopen and invalid-edit pixel/source-file retention passed. This run precedes small live refinements to ribbon coordinates, fan curvature and ribbon color. Subsequent actual live builds/captures passed with no fault; no isolated performance claim is made for the active shared-GPU desktop session.

Original Living Painting at18 and42seconds was pixel-identical after dual-output producer changes (legacy-18-comparison.json, legacy-42-comparison.json). Root TypeScript check and component checks passed before final localized WGSL edits, which compiled and rendered in the actual live app.

Remaining work is tracked in LUX-172/173/174: independent motif Library components, coordinated expressive animation/color, and structural transformations. This milestone is a working prototype, not a claim that those later milestones are complete.
