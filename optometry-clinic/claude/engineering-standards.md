# Engineering standards — Olu Eye Clinic EMR

Standing conventions for this codebase. Follow them without being reminded.
Add to this file as new conventions are agreed.

---

## Buttons

**Every interactive button is a shadcn `Button` (`@/components/ui/button`)
variant. No hand-rolled or flat buttons** (no bare `<button className="bg-…">`,
no raw `<a>` styled as a button). The shared `Button` already guarantees, for
every variant:

- a **visible hover state** (per variant below),
- a **pointer cursor** (`cursor-pointer` on the base),
- a **~150ms transition** (`transition-all`, Tailwind's 150ms default),
- a **visible focus ring** (`focus-visible:ring-3 ring-ring/50`, ring = brand).

Using a variant is therefore how you get all four for free — don't re-implement
them with ad-hoc classes.

### The four roles

Stay on-brand: the only accent colour is brand teal `#0d7b5f` (the `--primary`
token and the `brand` utilities). Do **not** introduce a new colour.

| Role            | `variant`     | Looks like                                                        | Use for                                  |
| --------------- | ------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| **primary**     | `default`     | Filled brand teal, white text; hover = **darker** teal            | The main action on a view / form submit  |
| **secondary**   | `secondary`   | Teal border + teal text on transparent; **fills teal** on hover   | Supporting actions next to the primary   |
| **ghost**       | `ghost`       | No border/fill; subtle neutral hover background                   | Low-emphasis / dismiss (cancel, close)   |
| **destructive** | `destructive` | Soft red (de-emphasised); red text, light-red hover               | Delete, cancel-appointment, etc.         |

```tsx
<Button>Save</Button>                         {/* primary (default) */}
<Button variant="secondary">Reschedule</Button>
<Button variant="ghost">Cancel</Button>
<Button variant="destructive">Cancel appointment</Button>
```

Icons: use lucide icons inside the button; the base sizes them automatically.

### Notes

- `destructive` is intentionally **de-emphasised** (soft red), so a dangerous
  action doesn't shout. A destructive *confirmation* button inside a dialog may
  still use a stronger filled-red treatment where extra weight is warranted —
  that is the one sanctioned exception; everything else uses a variant.
- This rule is the standard going forward. Buttons elsewhere in the app that
  predate it are migrated opportunistically, not all at once.
