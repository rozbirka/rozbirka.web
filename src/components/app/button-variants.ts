import { cva } from 'class-variance-authority'

/**
 * The cabinet button: `.rz-btn` from the design system kit
 * (docs/design-system/v2/components/Button.dc.html). Separate from
 * `components/ui/button`, which only serves the dev-only `/screens` prototypes.
 *
 * Variant names are the code's; v2 renamed them (D10): `ghost` here is the
 * bordered v2 secondary, `quiet` is the v2 ghost. Height follows
 * `--rz-control-h` (28/32 on desktop, 44 on a coarse pointer); `touch` is the
 * 44px auth target and `glove` the 56px warehouse one.
 */
export const appButtonVariants = cva(
  'rz-btn shrink-0 select-none disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'rz-btn--primary',
        ghost: '',
        quiet: 'rz-btn--ghost',
        danger: 'rz-btn--danger',
      },
      size: {
        md: '',
        sm: 'rz-btn--sm',
        lg: 'rz-btn--lg',
        icon: 'rz-btn--icon',
        wide: 'rz-btn--block',
        /** 44px, 14px type: auth flows and phone-first forms. */
        touch: 'rz-btn--touch',
        /** Warehouse floor: a gloved thumb needs the 56px glove target. */
        glove: 'rz-btn--glove',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
)
