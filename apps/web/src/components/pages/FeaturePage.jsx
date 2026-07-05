export function FeaturePage({ title, description }) {
  return (
    <div>
      <h2 className="mb-1 text-2xl font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-[var(--color-muted)]">{description}</p>
    </div>
  )
}
