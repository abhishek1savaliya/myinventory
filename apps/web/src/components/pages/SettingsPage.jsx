'use client'

import { useEffect, useState } from 'react'
import { FEATURE_LABELS } from '@myinventory/shared'
import { useAuth } from '@/contexts/use-auth'
import { isOrganizationOwner } from '@/lib/org-owner'
import { orgWelcomePath } from '@/lib/org-paths'
import { API_BASE_URL } from '@/lib/api-client'
import {
  getStoredScanSoundEnabled,
  getStoredScanSoundVolume,
  initScanAudio,
  playScanBeep,
  setStoredScanSoundEnabled,
  setStoredScanSoundVolume,
} from '@/lib/scan-sound'
import { getStoredTorchPreference, setStoredTorchPreference } from '@/lib/scan-torch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { CopyableValue } from '@/components/ui/copyable-value'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LoginBrandingSettings } from '@/components/settings/LoginBrandingSettings'

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
  const [scanSoundVolume, setScanSoundVolume] = useState(100)
  const isOwner = isOrganizationOwner(user)
  const org = user?.organization

  useEffect(() => {
    setTorchOn(getStoredTorchPreference())
    setScanSoundOn(getStoredScanSoundEnabled())
    setScanSoundVolume(getStoredScanSoundVolume())
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

  function handleScanSoundVolumeChange(volume) {
    const nextVolume = Number(volume)
    setScanSoundVolume(nextVolume)
    setStoredScanSoundVolume(nextVolume)
    if (scanSoundOn) {
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

      {isOwner && org && <LoginBrandingSettings org={org} />}

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
          {scanSoundOn && (
            <div className="rounded-md border border-[var(--color-border)] bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="setting-scan-sound-volume" className="text-sm font-medium text-gray-900">
                    Beep volume
                  </Label>
                  <p className="text-xs text-[var(--color-muted)]">
                    100% is default. Increase up to 200% for a louder scan beep on this device.
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-[var(--color-primary)]">
                  {scanSoundVolume}%
                </span>
              </div>
              <input
                id="setting-scan-sound-volume"
                type="range"
                min={50}
                max={200}
                step={5}
                value={scanSoundVolume}
                onChange={(event) => handleScanSoundVolumeChange(event.target.value)}
                className="mt-3 h-2 w-full cursor-pointer accent-[var(--color-primary)]"
              />
              <div className="mt-1 flex justify-between text-[10px] text-[var(--color-muted)]">
                <span>50%</span>
                <span>100%</span>
                <span>200%</span>
              </div>
            </div>
          )}
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
