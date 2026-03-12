import Link from 'next/link'

export const metadata = {
  title: 'Terms & Conditions - AHAWC Distribution Portal',
  description: 'Terms and Conditions for the AHAWC Liquor Distribution Portal',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-slate-900 px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-white">AHAWC</span>
          <Link href="/login" className="text-sm text-slate-300 transition-colors hover:text-white">
            Sign In -&gt;
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Terms &amp; Conditions</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Effective date: March 9, 2026 &nbsp;|&nbsp; Last updated: March 12, 2026
          </p>
        </div>

        <p className="leading-relaxed text-slate-700">
          These Terms and Conditions (&quot;Terms&quot;) govern your access to and use of the AHAWC
          Distribution Portal (&quot;Portal&quot;) operated by AHAWC LLC (&quot;AHAWC,&quot;
          &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By accessing or using the Portal,
          you agree to be bound by these Terms. If you do not agree, do not use the Portal.
        </p>

        <Section title="1. Eligibility">
          <p>The Portal is a private, invitation-only business-to-business platform. Access is restricted to:</p>
          <ul>
            <li>Licensed alcohol beverage retailers, restaurants, and hospitality businesses operating under a valid license issued by the applicable state or local alcohol beverage control authority.</li>
            <li>Authorized employees and agents of such businesses.</li>
            <li>AHAWC LLC staff, drivers, and administrators.</li>
          </ul>
          <p>
            By using the Portal you represent that you are at least 21 years of age and are
            authorized to purchase or handle alcohol beverages under applicable law.
          </p>
        </Section>

        <Section title="2. Account Access">
          <p>
            Access credentials are issued by AHAWC. You are responsible for maintaining the
            confidentiality of your password and for all activity that occurs under your account.
            You agree to notify AHAWC immediately of any unauthorized use of your account at
            admin@ahawc.com. AHAWC reserves the right to suspend or terminate accounts at any time
            without notice.
          </p>
        </Section>

        <Section title="3. Orders &amp; Purchases">
          <ul>
            <li>All orders placed through the Portal are subject to availability and AHAWC&apos;s acceptance.</li>
            <li>Prices are subject to change without notice. The price displayed at the time of order confirmation is the price charged.</li>
            <li>Orders are fulfilled in accordance with applicable federal, state, and local alcohol beverage control laws and regulations.</li>
            <li>AHAWC reserves the right to cancel or modify any order that would violate applicable law or AHAWC&apos;s distribution policies.</li>
          </ul>
        </Section>

        <Section title="4. Payment Terms">
          <ul>
            <li>Payment is due in accordance with the payment terms assigned to your account (for example, NET30).</li>
            <li>Online payments are processed securely through Stripe. By submitting payment you agree to Stripe&apos;s Terms of Service.</li>
            <li>ACH and bank transfer payments may take 3-5 business days to settle. Orders are not fulfilled until payment clears unless otherwise agreed in writing.</li>
            <li>Late payments may be subject to account suspension and finance charges at AHAWC&apos;s discretion.</li>
          </ul>
        </Section>

        <Section title="5. SMS Communications">
          <p>
            If you explicitly opt in, you consent to receive SMS messages from AHAWC regarding your
            wholesale account request, orders, invoices, deliveries, and account status. Message and
            data rates may apply. Message frequency varies. Reply <strong>STOP</strong> to opt out
            at any time. Reply <strong>HELP</strong> for assistance. Consent is not a condition of
            purchase.
          </p>
        </Section>

        <Section title="6. Alcohol Compliance">
          <p>
            All purchases made through the Portal are subject to the laws and regulations governing
            the sale and distribution of alcohol beverages in the applicable jurisdiction. You agree to:
          </p>
          <ul>
            <li>Maintain a valid alcohol beverage license for the duration of your account.</li>
            <li>Not resell or redistribute products in violation of any applicable law.</li>
            <li>Promptly notify AHAWC if your license is suspended, revoked, or not renewed.</li>
          </ul>
          <p>
            AHAWC reserves the right to require proof of licensure at any time and to refuse or
            cancel orders if licensure cannot be verified.
          </p>
        </Section>

        <Section title="7. Intellectual Property">
          <p>
            All content, trademarks, logos, and software comprising the Portal are the property of
            AHAWC LLC or its licensors. You may not reproduce, distribute, or create derivative
            works without prior written permission from AHAWC.
          </p>
        </Section>

        <Section title="8. Limitation of Liability">
          <p>
            To the maximum extent permitted by applicable law, AHAWC shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages arising from your use
            of the Portal, including but not limited to loss of profits, data, or business
            opportunities. AHAWC&apos;s total liability to you for any claim arising from these Terms
            shall not exceed the total amounts paid by you to AHAWC in the three months preceding
            the claim.
          </p>
        </Section>

        <Section title="9. Disclaimer of Warranties">
          <p>
            The Portal is provided &quot;as is&quot; and &quot;as available&quot; without warranties
            of any kind, express or implied. AHAWC does not warrant that the Portal will be
            uninterrupted, error-free, or free of harmful components.
          </p>
        </Section>

        <Section title="10. Governing Law">
          <p>
            These Terms are governed by the laws of the State of Texas, without regard to its
            conflict of law provisions. Any disputes arising under these Terms shall be resolved
            exclusively in the state or federal courts located in Texas.
          </p>
        </Section>

        <Section title="11. Changes to These Terms">
          <p>
            AHAWC reserves the right to modify these Terms at any time. Changes will be posted to
            this page with an updated effective date. Continued use of the Portal after changes are
            posted constitutes acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="12. Contact">
          <address className="space-y-0.5 not-italic text-slate-700">
            <p className="font-semibold">AHAWC LLC</p>
            <p>
              Email:{' '}
              <a href="mailto:admin@ahawc.com" className="text-blue-600 hover:underline">
                admin@ahawc.com
              </a>
            </p>
            <p>
              Website:{' '}
              <a href="https://ahawc.com" className="text-blue-600 hover:underline">
                ahawc.com
              </a>
            </p>
          </address>
        </Section>

        <div className="flex gap-6 border-t pt-6 text-sm">
          <Link href="/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/login" className="text-blue-600 hover:underline">
            &lt;- Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2 leading-relaxed text-slate-700 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}
