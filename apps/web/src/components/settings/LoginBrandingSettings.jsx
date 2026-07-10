'use client'

import { useState } from 'react'
import Link from 'next/link'
import { apiFetch, ApiRequestError } from '@/lib/api-client'
import { compressImageFile } from '@/lib/compress-image'
import { orgLoginPath } from '@/lib/org-paths'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OrgThemeScope } from '@/components/theme/OrgThemeScope'

const DEFAULT_THEME_COLOR = '#1e3a5f'

function BrandingImageField({ id, label, description, previewUrl, onSelect, onRemove, disabled }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {description && <p className="text-xs text-[var(--color-muted)]">{description}</p>}
      {previewUrl ? (
        <div className="relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-gray-50">
          <img src={previewUrl} alt="" className="max-h-40 w-full object-contain p-3" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute right-2 top-2 bg-white/90"
            onClick={onRemove}
            disabled={disabled}
          >
            Remove
          </Button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-gray-50 px-4 py-8 text-center text-sm text-[var(--color-muted)] hover:bg-gray-100 ${
            disabled ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          Click to upload an image (JPEG, PNG, or WebP)
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={disabled}
            onChange={onSelect}
          />
        </label>
      )}
      {previewUrl && (
        <label htmlFor={`${id}-replace`} className="inline-block">
          <Button type="button" variant="outline" size="sm" asChild disabled={disabled}>
            <span>Replace image</span>
          </Button>
          <input
            id={`${id}-replace`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={disabled}
            onChange={onSelect}
          />
        </label>
      )}
    </div>
  )
}

export function LoginBrandingSettings({ org, onSaved }) {
  const [logoUrl, setLogoUrl] = useState(org.logoUrl)
  const [loginBackgroundUrl, setLoginBackgroundUrl] = useState(org.loginBackgroundUrl)
  const [themeColor, setThemeColor] = useState(org.themeColor ?? DEFAULT_THEME_COLOR)
  const [pendingLogo, setPendingLogo] = useState(null)
  const [pendingBackground, setPendingBackground] = useState(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [removeBackground, setRemoveBackground] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const logoPreview = pendingLogo ?? (removeLogo ? null : logoUrl)
  const backgroundPreview = pendingBackground ?? (removeBackground ? null : loginBackgroundUrl)

  async function handleImageSelect(setter, event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)
    setSuccess(null)

    try {
      const compressed = await compressImageFile(file)
      setter(compressed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process image')
    }
  }

  async function handleSave() {
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    const payload = {
      themeColor,
      ...(pendingLogo ? { logoBase64: pendingLogo } : {}),
      ...(pendingBackground ? { loginBackgroundBase64: pendingBackground } : {}),
      ...(removeLogo ? { removeLogo: true } : {}),
      ...(removeBackground ? { removeLoginBackground: true } : {}),
    }

    try {
      const response = await apiFetch('/api/organizations/branding', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })

      setLogoUrl(response.data.logoUrl)
      setLoginBackgroundUrl(response.data.loginBackgroundUrl)
      setThemeColor(response.data.themeColor ?? DEFAULT_THEME_COLOR)
      setPendingLogo(null)
      setPendingBackground(null)
      setRemoveLogo(false)
      setRemoveBackground(false)
      setSuccess('Login page branding saved.')
      onSaved?.(response.data)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Failed to save branding')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Login page branding</CardTitle>
        <CardDescription>
          Customize your sign-in page and app colors — logo, background image, and theme color.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <OrgThemeScope themeColor={themeColor} className="space-y-5 rounded-lg">
        <BrandingImageField
          id="branding-logo"
          label="Organization logo"
          description="Shown at the top of your login page."
          previewUrl={logoPreview}
          disabled={isSaving}
          onSelect={(event) => {
            setRemoveLogo(false)
            void handleImageSelect(setPendingLogo, event)
          }}
          onRemove={() => {
            setPendingLogo(null)
            setRemoveLogo(true)
          }}
        />

        <BrandingImageField
          id="branding-background"
          label="Login background image"
          description="Full-page background behind the sign-in card."
          previewUrl={backgroundPreview}
          disabled={isSaving}
          onSelect={(event) => {
            setRemoveBackground(false)
            void handleImageSelect(setPendingBackground, event)
          }}
          onRemove={() => {
            setPendingBackground(null)
            setRemoveBackground(true)
          }}
        />

        <div className="space-y-2">
          <Label htmlFor="branding-theme-color">Theme color</Label>
          <p className="text-xs text-[var(--color-muted)]">
            Applied across your login page, sidebar, buttons, and links. Text on buttons adjusts
            automatically for readability.
          </p>
          <div className="flex items-center gap-3">
            <input
              id="branding-theme-color"
              type="color"
              value={themeColor}
              disabled={isSaving}
              onChange={(event) => setThemeColor(event.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-[var(--color-border)] bg-white p-1"
            />
            <Input
              value={themeColor}
              disabled={isSaving}
              onChange={(event) => setThemeColor(event.target.value)}
              placeholder="#1e3a5f"
              className="max-w-[140px] font-mono uppercase"
              maxLength={7}
            />
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-sidebar)] p-4">
          <p className="mb-3 text-xs font-medium text-[var(--color-muted)]">Theme preview</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm">
              Primary button
            </Button>
            <Button type="button" variant="outline" size="sm">
              Outline button
            </Button>
            <span className="text-sm font-medium text-[var(--color-primary)]">Primary link text</span>
          </div>
        </div>
        </OrgThemeScope>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {success}
          </p>
        )}

        <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
          <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save branding'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={orgLoginPath(org.slug)} target="_blank" rel="noopener noreferrer">
              Preview login page
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
