'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ShoppingCart, Star, ChevronRight, Mail, MapPin, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'

const categories = [
  'Whiskey', 'Vodka', 'Gin', 'Cognac', 'Rum',
  'Brandy', 'Tequila', 'Wine', 'Ready to Drink', 'Liqueur', 'Mixers',
]

const featuredProducts = [
  { name: 'Wisher Vodka',    category: 'Vodka',   size: '750ml', description: 'Gluten-free, grain-free beet vodka. Distilled 9 times.' },
  { name: 'Reserve Bourbon', category: 'Whiskey', size: '750ml', description: 'Small-batch Kentucky straight bourbon.' },
  { name: 'London Dry Gin',  category: 'Gin',     size: '750ml', description: 'Classic botanical gin, perfect for cocktails.' },
  { name: 'Dark Reserve Rum',category: 'Rum',     size: '750ml', description: 'Aged Caribbean rum with rich caramel notes.' },
]

function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <LoginForm />
      </div>
    </div>
  )
}

export function MarketingPage() {
  const [qty, setQty] = useState(1)
  const [loginOpen, setLoginOpen] = useState(false)

  function openLogin() { setLoginOpen(true) }
  function closeLogin() { setLoginOpen(false) }

  return (
    <div className="min-h-screen bg-white font-sans">
      <LoginModal open={loginOpen} onClose={closeLogin} />

      {/* ── Nav ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0f2d5a] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3 shrink-0">
            <Image
              src="/brand/logo.png"
              alt="AHAWC"
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg bg-white p-1 object-contain"
            />
            <div className="hidden sm:block">
              <p className="font-bold text-white text-sm leading-none">AHAWC</p>
              <p className="text-[10px] text-blue-300 leading-none mt-0.5 uppercase tracking-wide">Distribution</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {['Brands', 'Products', 'About Us', 'Contact'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`}
                className="text-sm text-blue-200 hover:text-white transition-colors font-medium">
                {item}
              </a>
            ))}
          </nav>

          <button
            onClick={openLogin}
            className="bg-white text-[#0f2d5a] text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-[#0f2d5a] to-[#1a4a8a] text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-blue-300 text-xs uppercase tracking-widest font-semibold mb-1">Licensed Distributor · Washington DC Metro Area</p>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            Premium Spirits &amp; Wine<br className="hidden sm:block" /> Distribution
          </h1>
          <p className="text-blue-200 mt-3 max-w-lg text-sm leading-relaxed">
            AHAWC connects licensed retailers with the finest spirits, wines, and specialty beverages. Wholesale pricing, reliable delivery, exceptional service.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={openLogin}
              className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              Sign In to Order
            </button>
            <a href="#contact"
              className="border border-blue-400 text-blue-200 hover:text-white hover:border-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
              Request an Account
            </a>
          </div>
        </div>
      </section>

      {/* ── Product detail + categories ─────────────────── */}
      <section id="products" className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-6">
          <span className="text-[#0f2d5a] font-medium">Home</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[#0f2d5a] font-medium">Vodka</span>
          <ChevronRight className="w-3 h-3" />
          <span>Wisher Vodka</span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-8">

          {/* Product image */}
          <div className="lg:w-72 shrink-0">
            <div className="border rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center aspect-[3/4] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/products/wisher-vodka.jpg"
                alt="Wisher Vodka 750ml"
                className="object-contain h-full w-full"
              />
            </div>
            {/* Thumbnail */}
            <div className="flex gap-2 mt-2">
              <div className="w-14 h-16 border-2 border-[#0f2d5a] rounded-lg overflow-hidden bg-slate-50 cursor-pointer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/products/wisher-vodka.jpg"
                  alt="Wisher Vodka thumbnail"
                  className="object-contain w-full h-full p-1"
                />
              </div>
            </div>
          </div>

          {/* Product details */}
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-slate-900">Wisher Vodka <span className="text-slate-400 font-normal text-lg">(Wisher Vodka)</span></h2>
            <div className="flex items-center gap-2 mt-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-4 h-4 ${i < 4 ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
              ))}
              <span className="text-xs text-slate-500 ml-1">4.0 · 12 reviews</span>
            </div>

            <p className="text-3xl font-bold text-[#0f2d5a] mt-4">
              $44.99 <span className="text-sm font-normal text-slate-500">/ bottle</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Wholesale pricing available —{' '}
              <button onClick={openLogin} className="text-[#0f2d5a] underline">sign in to see case pricing</button>
            </p>

            <p className="text-slate-600 mt-4 leading-relaxed text-sm">
              Made from gluten and grain-free beets and distilled 9 times. Every batch is lab tested for quality assurance. Sip with confidence knowing that we use only vegan ingredients and processes. Proudly crafted in the USA by a pioneering women-owned brand.
            </p>

            <div className="flex items-center gap-3 mt-6">
              <div className="flex items-center border rounded-lg overflow-hidden">
                <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 font-bold transition-colors">−</button>
                <span className="px-4 py-2 text-sm font-medium border-x">{qty}</span>
                <button type="button" onClick={() => setQty(q => q + 1)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 font-bold transition-colors">+</button>
              </div>
              <button
                onClick={openLogin}
                className="flex items-center gap-2 bg-[#0f2d5a] hover:bg-[#1a4a8a] text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                Sign In to Order
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-500 border-t pt-4">
              <span><strong className="text-slate-700">Size:</strong> 750ml</span>
              <span><strong className="text-slate-700">Category:</strong> Vodka</span>
              <span><strong className="text-slate-700">Origin:</strong> USA</span>
              <span><strong className="text-slate-700">ABV:</strong> 40%</span>
            </div>

            {/* Tabs */}
            <div className="mt-6 border-t">
              <div className="flex gap-0 mt-4 border-b">
                {['Description', 'Product Details', 'Reviews (0)'].map((tab, i) => (
                  <button key={tab} type="button"
                    className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors ${i === 0 ? 'border-[#0f2d5a] text-[#0f2d5a]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    {tab}
                  </button>
                ))}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mt-4">
                Introducing Wisher Vodka, a super premium craft vodka with a unique twist. Made from gluten and grain-free beets and distilled 7–9 times for unparalleled purity. Every batch is lab tested for quality assurance. Sip with confidence knowing that Wisher uses only vegan ingredients and processes. Proudly crafted in the USA by a pioneering women-owned brand. Wisher Vodka has received accolades including being featured on the cover of The Wall Street Journal and in Forbes magazine.
              </p>
            </div>
          </div>

          {/* Categories sidebar */}
          <aside className="lg:w-56 shrink-0">
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-slate-800 text-white px-4 py-3">
                <h3 className="font-semibold text-sm">Categories</h3>
              </div>
              <ul className="divide-y">
                {categories.map(cat => (
                  <li key={cat}>
                    <button
                      onClick={openLogin}
                      className="flex items-center justify-between w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-[#0f2d5a] transition-colors group"
                    >
                      {cat}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0f2d5a]" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 border rounded-xl p-4 bg-amber-50 border-amber-200">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Licensed Retailers</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">Sign in to access wholesale pricing and place orders.</p>
              <button
                onClick={openLogin}
                className="mt-3 w-full text-center bg-[#0f2d5a] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#1a4a8a] transition-colors"
              >
                Sign In
              </button>
            </div>
          </aside>
        </div>
      </section>

      {/* ── Featured products ────────────────────────────── */}
      <section id="brands" className="bg-slate-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#0f2d5a] font-semibold">Our Portfolio</p>
              <h2 className="text-2xl font-bold text-slate-900 mt-0.5">Featured Products</h2>
            </div>
            <button onClick={openLogin} className="text-sm text-[#0f2d5a] font-medium hover:underline hidden sm:block">
              View full catalog →
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredProducts.map(p => (
              <div key={p.name} className="bg-white border rounded-xl overflow-hidden hover:shadow-md transition-shadow group">
                <div className="aspect-square bg-gradient-to-b from-slate-100 to-slate-50 flex items-center justify-center p-6">
                  <div className="w-10 h-28 rounded-full bg-gradient-to-b from-[#0f2d5a] to-[#1a4a8a] opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="p-3 border-t">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{p.category}</p>
                  <p className="font-semibold text-slate-900 text-sm mt-0.5">{p.name}</p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                  <p className="text-xs text-slate-400 mt-1">{p.size}</p>
                  <button
                    onClick={openLogin}
                    className="mt-3 w-full text-center border border-[#0f2d5a] text-[#0f2d5a] text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#0f2d5a] hover:text-white transition-colors"
                  >
                    Sign In to Order
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ─────────────────────────────────────────── */}
      <section id="about-us" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#0f2d5a] font-semibold mb-2">Who We Are</p>
          <h2 className="text-2xl font-bold text-slate-900">AHAWC LLC — Premium Spirits Distribution</h2>
          <p className="text-slate-600 mt-4 leading-relaxed text-sm">
            AHAWC is a licensed spirits and wine distributor serving the Washington DC metro area. We partner with world-class brands and pioneering craft producers to bring the finest beverages to licensed retailers, restaurants, and hospitality businesses.
          </p>
          <p className="text-slate-600 mt-3 leading-relaxed text-sm">
            Our B2B portal gives approved accounts real-time inventory, instant ordering, delivery tracking, and online invoicing — all in one place.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-6 text-center">
            {[['50+', 'Brands'], ['200+', 'Products'], ['DC Metro', 'Coverage']].map(([stat, label]) => (
              <div key={label} className="border rounded-xl p-3">
                <p className="text-xl font-bold text-[#0f2d5a]">{stat}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-center">
          <div className="w-64 h-64 rounded-2xl bg-gradient-to-br from-[#0f2d5a] to-[#1a4a8a] flex items-center justify-center shadow-xl">
            <Image src="/brand/logo.png" alt="AHAWC" width={140} height={140} className="object-contain" />
          </div>
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────────── */}
      <section id="contact" className="bg-[#0f2d5a] text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <h2 className="text-2xl font-bold">Get in Touch</h2>
              <p className="text-blue-200 mt-2 text-sm">Ready to carry our brands? Contact us to set up a wholesale account.</p>
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-sm text-blue-200">
                  <Mail className="w-4 h-4 shrink-0" />
                  <a href="mailto:admin@ahawc.com" className="hover:text-white transition-colors">admin@ahawc.com</a>
                </div>
                <div className="flex items-center gap-3 text-sm text-blue-200">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>Washington DC Metro Area</span>
                </div>
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-6 space-y-3">
              <p className="font-semibold text-sm">Request a Wholesale Account</p>
              <input type="text" placeholder="Business name" className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-white/30" />
              <input type="email" placeholder="Business email" className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-white/30" />
              <input type="tel" placeholder="Phone number" className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-white/30" />
              <a href="mailto:admin@ahawc.com?subject=Wholesale Account Request"
                className="block text-center bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
                Send Request
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Image src="/brand/logo.png" alt="AHAWC" width={28} height={28} className="h-7 w-7 rounded-md bg-white p-0.5 object-contain" />
            <span className="text-slate-300 font-medium">AHAWC LLC</span>
            <span>· Licensed Distributor · DC Metro Area</span>
          </div>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms &amp; Conditions</Link>
            <button onClick={openLogin} className="hover:text-white transition-colors">Sign In</button>
          </div>
          <p>© {new Date().getFullYear()} AHAWC LLC. All rights reserved. Must be 21+ to purchase.</p>
        </div>
      </footer>
    </div>
  )
}
