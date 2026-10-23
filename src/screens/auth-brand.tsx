/** The auth wordmark; the login screen omits the decorative square. */
export function AuthBrand({ showMark = true }: { showMark?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      {showMark ? (
        <span aria-hidden className="rz-avatar size-7 text-caption">
          R
        </span>
      ) : null}
      <span className="rz-strong font-bold">Rozbirka</span>
    </span>
  )
}
