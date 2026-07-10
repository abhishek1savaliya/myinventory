export interface OrganizationBranding {
  logoUrl: string | null
  loginBackgroundUrl: string | null
  themeColor: string | null
}

export interface OrganizationSummary extends OrganizationBranding {
  id: string
  orgCode: string
  slug: string
  name: string
  tradingName: string
  ownerName: string
  email: string
  contactNumber: string
}

export interface OrganizationSignupResponse {
  organization: OrganizationSummary
  orgCode: string
  slug: string
  ownerEmail: string
}

export interface OrganizationPublicProfile extends OrganizationBranding {
  slug: string
  name: string
  tradingName: string
}
