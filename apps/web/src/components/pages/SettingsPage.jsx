'use client'

import { useEffect, useState } from 'react'
import { FEATURE_LABELS } from '@myinventory/shared'
import { useAuth } from '@/contexts/use-auth'
import { isOrganizationOwner } from '@/lib/org-owner'
import { orgWelcomePath } from '@/lib/org-paths'
import { API_BASE_URL } from '@/lib/api-client'
import {
  getStoredScanSoundEnabled,
  initScanAudio,
  playScanBeep,
  setStoredScanSoundEnabled,
} from '@/lib/scan-sound'
import { getStoredTorchPreference, setStoredTorchPreference } from '@/lib/scan-torch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { CopyableValue } from '@/components/ui/copyable-value'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

function SettingToggle({ id, label, description, checked, onChange, disabled = false }) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start justify-between gap-4 rounded-md border border-[var(--color-border)] px-4 py-3 ${
        disabled ? 'cursor-not-allowed bg-gray-50 opacity-70' : 'cursor-pointer bg-white hover:bg-gray-50'
      }`}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-[var(--color-muted)]">{description}</p>}
      </div>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0"
      />
    </label>
  )
}

export function SettingsPage() {
  const { user } = useAuth()
  const [torchOn, setTorchOn] = useState(false)
  const [scanSoundOn, setScanSoundOn] = useState(true)
  const isOwner = isOrganizationOwner(user)
  const org = user?.organization

  useEffect(() => {
    setTorchOn(getStoredTorchPreference())
    setScanSoundOn(getStoredScanSoundEnabled())
  }, [])

  function handleTorchChange(enabled) {
    setTorchOn(enabled)
    setStoredTorchPreference(enabled)
  }

  function handleScanSoundChange(enabled) {
    setScanSoundOn(enabled)
    setStoredScanSoundEnabled(enabled)
    if (enabled) {
      initScanAudio()
      playScanBeep('scanned')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">Settings</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Manage your account and app preferences. Scan settings apply on this device.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
          <CardDescription>Your signed-in profile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-[var(--color-muted)]">Name</Label>
              <p className="font-medium text-gray-900">{user?.name ?? '—'}</p>
            </div>
            <div>
              <Label className="text-[var(--color-muted)]">Email</Label>
              <p className="font-medium text-gray-900">{user?.email ?? '—'}</p>
            </div>
            <div>
              <Label className="text-[var(--color-muted)]">Role</Label>
              <p className="font-medium text-gray-900">{user?.role ?? '—'}</p>
            </div>
            <div>
              <Label className="text-[var(--color-muted)]">Status</Label>
              <p className="font-medium text-gray-900">{user?.status ?? '—'}</p>
            </div>
          </div>
          {user?.features?.length > 0 && (
            <div>
              <Label className="text-[var(--color-muted)]">Enabled features</Label>
              <p className="mt-1 text-xs leading-relaxed text-gray-700">
                {user.features.map((feature) => FEATURE_LABELS[feature] ?? feature).join(', ')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {isOwner && org && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organization</CardTitle>
            <CardDescription>
              You are the registered organization owner. Share the organization ID with your team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-[var(--color-muted)]">Organization name</Label>
                <p className="font-medium text-gray-900">{org.name}</p>
              </div>
              <div>
                <Label className="text-[var(--color-muted)]">Trading name</Label>
                <p className="font-medium text-gray-900">{org.tradingName}</p>
              </div>
            </div>
            <CopyableValue
              label="Organization ID"
              value={org.orgCode}
              description="Required when signing in"
              mono
            />
            <Button asChild variant="outline" size="sm">
              <Link href={orgWelcomePath(org.slug)}>View full organization details</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scan</CardTitle>
          <CardDescription>Camera and barcode scan preferences for mobile scanning</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingToggle
            id="setting-scan-sound"
            label="Scan beep sound"
            description="Play a sound immediately when a barcode is detected"
            checked={scanSoundOn}
            onChange={handleScanSoundChange}
          />
          <SettingToggle
            id="setting-scan-torch"
            label="Flashlight on by default"
            description="Turn on the camera flashlight when scanning starts (Android rear camera only)"
            checked={torchOn}
            onChange={handleTorchChange}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <Label className="text-[var(--color-muted)]">Application</Label>
            <p className="font-medium text-gray-900">MyInventory Web</p>
          </div>
          {API_BASE_URL && (
            <div>
              <Label className="text-[var(--color-muted)]">API server</Label>
              <p className="break-all font-mono text-xs text-gray-700">{API_BASE_URL}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
