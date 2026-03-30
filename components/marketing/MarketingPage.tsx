'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ShoppingCart, Star, ChevronRight, Mail, MapPin, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'
import { WholesaleAccountRequestForm } from '@/components/marketing/WholesaleAccountRequestForm'

const categories = [
  'Whiskey', 'Vodka', 'Gin', 'Cognac', 'Rum',
  'Brandy', 'Tequila', 'Wine', 'Ready to Drink', 'Liqueur', 'Mixers',
]

function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <LoginForm />
      </div>
    </div>
  )
}

export function MarketingPage() {
  const [qty, setQty] = useState(1)
  const [loginOpen, setLoginOpen] = useState(false)

  function openLogin() {
    setLoginOpen(true)
  }

  function closeLogin() {
    setLoginOpen(false)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.55),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(254,215,170,0.42),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#eef4ff_46%,_#fffaf5_100%)] font-sans text-slate-900">
      <LoginModal open={loginOpen} onClose={closeLogin} />

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <Image
              src="/brand/logo.png"
              alt="AHAWC"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl border border-slate-200 bg-white p-1 object-contain shadow-sm"
            />
            <div className="hidden sm:block">
              <p className="text-sm font-bold leading-none text-slate-900">AHAWC</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">Distribution</p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            {['Brands', 'Products', 'About Us', 'Contact'].map(item => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(' ', '-')}`}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                {item}
              </a>
            ))}
          </nav>

          <button
            onClick={openLogin}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Sign In
          </button>
        </div>
      </header>

      <section className="px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,_rgba(255,255,255,0.95),_rgba(234,242,255,0.92))] p-8 shadow-[0_28px_80px_-36px_rgba(15,23,42,0.45)] sm:p-10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">
              Licensed Distributor · Washington DC Metro Area
            </p>
            <h1 className="text-4xl font-bold leading-tight text-slate-700 sm:text-5xl">
              Premium Spirits &amp; Wine
              <br className="hidden sm:block" /> Distribution
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              AHAWC connects licensed retailers with standout spirits, wines, and specialty beverages. Wholesale pricing, reliable delivery, and polished account support in one portal.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={openLogin}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Sign In to Order
              </button>
              <a
                href="#contact"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
              >
                Request an Account
              </a>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {[
              ['In-house', 'Sales and tasting teams'],
              ['Live', 'Delivery notifications and sales support'],
              ['DC Metro', 'Licensed retailer coverage'],
              ['Maryland', 'Warehousing services available'],
            ].map(([stat, label]) => (
              <div
                key={label}
                className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.38)]"
              >
                <p className="text-2xl font-bold text-slate-900">{stat}</p>
                <p className="mt-1 text-sm text-slate-600">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="products" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="font-medium text-slate-700">Home</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-slate-700">Vodka</span>
          <ChevronRight className="h-3 w-3" />
          <span>Wisher Vodka</span>
        </nav>

        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="lg:w-80 lg:shrink-0">
            <div className="aspect-[3/4] overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/products/wisher-vodka.jpg"
                alt="Wisher Vodka 750ml"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <div className="h-16 w-14 cursor-pointer overflow-hidden rounded-xl border-2 border-slate-900 bg-white p-1 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/products/wisher-vodka.jpg"
                  alt="Wisher Vodka thumbnail"
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1 rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)] sm:p-8">
            <h2 className="text-3xl font-bold text-slate-900">
              Wisher Vodka <span className="text-lg font-normal text-slate-400">(Wisher Vodka)</span>
            </h2>
            <div className="mt-2 flex items-center gap-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`h-4 w-4 ${i < 4 ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
              ))}
              <span className="ml-1 text-xs text-slate-500">4.0 · 12 reviews</span>
            </div>

            <p className="mt-5 text-4xl font-bold text-slate-900">
              $44.99 <span className="text-base font-normal text-slate-500">/ bottle</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Wholesale pricing available -{' '}
              <button onClick={openLogin} className="font-medium text-slate-700 underline underline-offset-2">
                sign in to see case pricing
              </button>
            </p>

            <p className="mt-5 text-sm leading-relaxed text-slate-600 sm:text-base">
              Made from gluten and grain-free beets and distilled 9 times. Every batch is lab tested for quality assurance. Sip with confidence knowing that we use only vegan ingredients and processes. Proudly crafted in the USA by a pioneering women-owned brand.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="px-4 py-3 font-bold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  -
                </button>
                <span className="border-x border-slate-200 px-5 py-3 text-sm font-medium">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty(q => q + 1)}
                  className="px-4 py-3 font-bold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  +
                </button>
              </div>
              <button
                onClick={openLogin}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                <ShoppingCart className="h-4 w-4" />
                Sign In to Order
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-4 border-t border-slate-200 pt-4 text-xs text-slate-500">
              <span><strong className="text-slate-700">Size:</strong> 750ml</span>
              <span><strong className="text-slate-700">Category:</strong> Vodka</span>
              <span><strong className="text-slate-700">Origin:</strong> USA</span>
              <span><strong className="text-slate-700">ABV:</strong> 40%</span>
            </div>

            <div className="mt-7 border-t border-slate-200">
              <div className="mt-4 flex gap-0 border-b border-slate-200">
                {['Description', 'Product Details', 'Reviews (0)'].map((tab, i) => (
                  <button
                    key={tab}
                    type="button"
                    className={`border-b-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${i === 0 ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Introducing Wisher Vodka, a super premium craft vodka with a unique twist. Made from gluten and grain-free beets and distilled 7-9 times for unparalleled purity. Every batch is lab tested for quality assurance. Sip with confidence knowing that Wisher uses only vegan ingredients and processes. Proudly crafted in the USA by a pioneering women-owned brand. Wisher Vodka has received accolades including being featured on the cover of The Wall Street Journal and in Forbes magazine.
              </p>
            </div>
          </div>

          <aside className="lg:w-64 lg:shrink-0">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
              <div className="border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
                <h3 className="text-sm font-semibold">Categories</h3>
              </div>
              <ul className="divide-y divide-slate-200">
                {categories.map(cat => (
                  <li key={cat}>
                    <button
                      onClick={openLogin}
                      className="group flex w-full items-center justify-between px-5 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                    >
                      {cat}
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-slate-900" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 rounded-[2rem] border border-amber-200 bg-amber-50 p-5 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.22)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Licensed Retailers</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-700">
                Sign in to access wholesale pricing and place orders.
              </p>
              <button
                onClick={openLogin}
                className="mt-4 w-full rounded-xl bg-slate-900 px-3 py-2.5 text-center text-xs font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Sign In
              </button>
            </div>
          </aside>
        </div>
      </section>

      <section id="about-us" className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">Who We Are</p>
          <h2 className="text-3xl font-bold text-slate-900">AHAWC LLC - Premium Spirits Distribution</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
            AHAWC is a women-owned spirits and wine distribution company serving the Washington DC metro area. We focus on bringing emerging brands, distinctive producers, and modern beverage programs to licensed retailers, restaurants, and hospitality businesses.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Our team helps new brands build real market presence with in-house sales support, tasting execution, delivery visibility, and a B2B portal that keeps ordering and invoicing in one place.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            {[['50+', 'Brands'], ['200+', 'Products'], ['DC Metro', 'Coverage']].map(([stat, label]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.3)]">
                <p className="text-xl font-bold text-slate-900">{stat}</p>
                <p className="mt-0.5 text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-center">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-10 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.35)]">
            <Image src="/brand/logo.png" alt="AHAWC" width={160} height={160} className="object-contain" />
          </div>
        </div>
      </section>

      <section id="contact" className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(238,244,255,0.96))] p-8 shadow-[0_28px_80px_-36px_rgba(15,23,42,0.35)] sm:p-10">
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">Contact</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">Get in Touch</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Ready to carry our brands? Contact us to set up a wholesale account.
              </p>
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                  <a href="mailto:admin@ahawc.com" className="transition-colors hover:text-slate-900">
                    admin@ahawc.com
                  </a>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>Washington DC Metro Area</span>
                </div>
              </div>
            </div>
            <WholesaleAccountRequestForm />
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white/70 px-4 py-6 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Image src="/brand/logo.png" alt="AHAWC" width={28} height={28} className="h-7 w-7 rounded-md border border-slate-200 bg-white p-0.5 object-contain" />
            <span className="font-medium text-slate-700">AHAWC LLC</span>
            <span>· Licensed Distributor · DC Metro Area</span>
          </div>
          <div className="flex gap-4">
            <Link href="/privacy" className="transition-colors hover:text-slate-900">Privacy Policy</Link>
            <Link href="/terms" className="transition-colors hover:text-slate-900">Terms &amp; Conditions</Link>
            <button onClick={openLogin} className="transition-colors hover:text-slate-900">Sign In</button>
          </div>
          <p>© {new Date().getFullYear()} AHAWC LLC. All rights reserved. Must be 21+ to purchase.</p>
        </div>
      </footer>
    </div>
  )
}
